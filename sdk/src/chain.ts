// Direct-chain ErgoNames resolution — NO ErgoNames server in the path.
//
// Reads straight from either a public Ergo **explorer** (Explorer v1 API) or
// your own **node** (`/blockchain/...`, requires extraIndex) — auto-detected
// from the URL, so a wallet can point at its own node and depend on nobody.
// Resolution is trustless: a name's owner is whoever currently holds its NFT
// on-chain, and the name itself is the CONSENSUS name from the reveal box's R9 —
// not the spoofable EIP-4 display register.
//
// How it works (mirrors the official indexer):
//   - `tokenId → owner`: query the unspent box holding the name token; the
//     owner is the P2PK holder. Always live, so transfers are reflected.
//   - `name → tokenId`: the registry stores only the AVL *digest* on-chain, so
//     the name→token map is reconstructed by walking the registry box spend
//     chain from genesis and decoding each mint. Built once, cached, then
//     extended incrementally from the last hop.
//
// Scaling note: the forward index is O(registrations) to build, so this is
// ideal at current scale and for self-sovereign integrators; very large
// registries want a light client or an on-chain name→token index. Reverse
// (address → names) is bounded by the wallet's own tokens and scales fine.

import type { ResolveResult, ReverseResult, OwnedName } from "./index.js";

// Inlined (kept identical to index.ts) so this module has no runtime dependency
// on index.ts — avoids a circular value import.
const NAME_RE = /^[a-zA-Z0-9_]{1,25}$/;
const normalize = (name: string): string => name.trim().replace(/^~/, "").toLowerCase();
const isValidName = (name: string): boolean => NAME_RE.test(normalize(name));

export interface ChainResolverOptions {
  /** Base URL of the data source — a public Ergo **explorer** (Explorer v1 API)
   *  or your own **node** with `extraIndex` enabled. The API surface is
   *  auto-detected (a node serves `/blockchain/...`, an explorer `/api/v1/...`),
   *  so the same URL field works for either. Default: the public Ergo explorer. */
  explorerUrl?: string;
  /** Skip auto-detection and force the backend: "explorer" (Explorer v1) or
   *  "node" (Ergo node `/blockchain/...`, requires extraIndex). */
  source?: "explorer" | "node";
  /** Registry genesis transaction id (chain head of the registry spend chain). */
  genesisTxId?: string;
  /** Registry singleton token id (identifies the registry box across hops). */
  registrySingletonTokenId?: string;
  /** Per-request timeout in ms (default 12000). */
  timeoutMs?: number;
  /** How long the built index is trusted before re-polling the chain tip for
   *  new registrations, in ms (default 15000). Owner lookups are always live
   *  regardless — this only bounds staleness of the name→token map. */
  refreshTtlMs?: number;
}

// Mainnet constants (from the deployed genesis manifest). Override via options
// for testnet / a new genesis.
const MAINNET = {
  explorerUrl: "https://api.ergoplatform.com",
  genesisTxId: "0bedde748e58de99764b1c913c6d256e56600894e4711c2e31b54531a4c5a98c",
  registrySingletonTokenId:
    "ce712171f9ef228ce20359eadc20d74aae6ab5c8c043489c3d75cecd6512c465",
};

// The reveal box R9 = (GroupElement, (Coll[Coll[Byte]], Coll[Long])); its first
// inner Coll[Byte] is the consensus-validated ergoName bytes the registry
// hashed into the AVL tree. Layout (names are 1-25 chars, single-byte VLQ):
//   [4 type bytes 0x433c1a11][33 GroupElement][1 coll-count 0x03][1 len][name]
const REVEAL_R9_PREFIX = "433c1a11";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

/** Decode the consensus name from a reveal box's R9 serialized hex, or null. */
export function ergoNameFromRevealR9(serializedHex: string): string | null {
  try {
    if (!serializedHex || !serializedHex.startsWith(REVEAL_R9_PREFIX)) return null;
    const b = hexToBytes(serializedHex);
    let off = 4 + 33; // type prefix + GroupElement
    if (b[off] !== 0x03) return null; // inner collection holds exactly 3 elements
    off += 1;
    const len = b[off];
    off += 1;
    if (len < 1 || len > 25 || off + len > b.length) return null;
    const name = new TextDecoder().decode(b.slice(off, off + len));
    if (!/^[a-z0-9_]+$/.test(name)) return null; // on-chain charset
    return name;
  } catch {
    return null;
  }
}

interface Entry { name: string; tokenId: string; regNumber: number }

export class ChainResolver {
  private explorerUrl: string;
  private genesisTxId: string;
  private registryToken: string;
  private timeoutMs: number;
  private refreshTtlMs: number;
  private mode: "explorer" | "node" | null; // null = auto-detect on first use

  // Built forward index + reverse lookup, with the spend-chain cursor for
  // incremental extension.
  private nameToToken = new Map<string, Entry>();
  private tokenToName = new Map<string, Entry>();
  private cursorTx: string;
  private regCount = 0;
  private lastRefresh = 0;
  private building: Promise<void> | null = null;

  constructor(options: ChainResolverOptions = {}) {
    this.explorerUrl = (options.explorerUrl ?? MAINNET.explorerUrl).replace(/\/$/, "");
    this.genesisTxId = options.genesisTxId ?? MAINNET.genesisTxId;
    this.registryToken = options.registrySingletonTokenId ?? MAINNET.registrySingletonTokenId;
    this.timeoutMs = options.timeoutMs ?? 12000;
    this.refreshTtlMs = options.refreshTtlMs ?? 15000;
    this.mode = options.source ?? null;
    this.cursorTx = this.genesisTxId;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(this.explorerUrl + path, {
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`${res.status} on ${path}`);
    return res.json() as Promise<T>;
  }

  /** Resolve the backend API once and cache it: an Ergo node serves
   *  `/blockchain/indexedHeight`; an explorer 404s it. */
  private async detectMode(): Promise<"explorer" | "node"> {
    if (this.mode) return this.mode;
    try {
      const res = await fetch(this.explorerUrl + "/blockchain/indexedHeight", {
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { accept: "application/json" },
      });
      this.mode = res.ok ? "node" : "explorer";
    } catch {
      this.mode = "explorer";
    }
    return this.mode;
  }

  /** A transaction by id. Explorer and node return compatible inputs/outputs:
   *  each output carries assets + additionalRegisters + spentTransactionId, each
   *  input carries boxId + additionalRegisters (node registers are hex strings,
   *  explorer registers are `{serializedValue}` — both handled downstream). */
  private async fetchTx(txId: string): Promise<any> {
    const mode = await this.detectMode();
    return this.get(
      mode === "node"
        ? `/blockchain/transaction/byId/${txId}`
        : `/api/v1/transactions/${txId}`,
    );
  }

  /** Unspent boxes holding a token, normalized to `{ address, height }`. The
   *  node returns a bare array with `inclusionHeight`; the explorer wraps the
   *  list in `items` with `settlementHeight`. */
  private async fetchUnspentByToken(
    tokenId: string,
  ): Promise<Array<{ address: string | null; height: number }>> {
    const mode = await this.detectMode();
    if (mode === "node") {
      const arr: any = await this.get(`/blockchain/box/unspent/byTokenId/${tokenId}`);
      return (Array.isArray(arr) ? arr : []).map((b: any) => ({
        address: b.address ?? null,
        height: b.inclusionHeight ?? 0,
      }));
    }
    const j: any = await this.get(`/api/v1/boxes/unspent/byTokenId/${tokenId}`);
    return (j.items ?? []).map((b: any) => ({
      address: b.address ?? null,
      height: b.settlementHeight ?? 0,
    }));
  }

  /** Confirmed token balance for an address. The node takes a POST body and
   *  nests tokens under `confirmed`; the explorer is a GET. */
  private async fetchBalanceTokens(address: string): Promise<any[]> {
    const mode = await this.detectMode();
    if (mode === "node") {
      const res = await fetch(this.explorerUrl + "/blockchain/balance", {
        method: "POST",
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { "content-type": "text/plain", accept: "application/json" },
        body: address,
      });
      if (!res.ok) throw new Error(`${res.status} on /blockchain/balance`);
      const j: any = await res.json();
      return j?.confirmed?.tokens ?? [];
    }
    const j: any = await this.get(`/api/v1/addresses/${address}/balance/confirmed`);
    return j.tokens ?? [];
  }

  /** Walk the registry spend chain from the cursor to the tip, recording mints.
   *  Idempotent + incremental; concurrent callers share one in-flight build. */
  private async ensureIndex(): Promise<void> {
    if (this.building) return this.building;
    // Trust a freshly-built index for a short window to keep bursts of lookups
    // fast; owner lookups stay live regardless.
    if (this.lastRefresh > 0 && Date.now() - this.lastRefresh < this.refreshTtlMs) return;
    this.building = (async () => {
      let txId: string | null = this.cursorTx;
      while (txId) {
        const tx: any = await this.fetchTx(txId);
        const regIdx = tx.outputs.findIndex((o: any) =>
          (o.assets ?? []).some((a: any) => a.tokenId === this.registryToken),
        );
        if (regIdx < 0) break; // not a registry tx (shouldn't happen) — stop
        const registryOut = tx.outputs[regIdx];

        // v1 mint layout: registry at output 1, 6 outputs, issuance box at 0.
        const isMint =
          regIdx === 1 && tx.outputs.length === 6 && (tx.outputs[0].assets ?? []).length > 0;
        if (isMint) {
          const tokenId = tx.outputs[0].assets[0].tokenId;
          // token id == reveal box id by construction; find that input.
          const revealInput = (tx.inputs ?? []).find((i: any) => i.boxId === tokenId);
          const r9 =
            revealInput?.additionalRegisters?.R9?.serializedValue ??
            revealInput?.additionalRegisters?.R9;
          const name = typeof r9 === "string" ? ergoNameFromRevealR9(r9) : null;
          if (name && !this.tokenToName.has(tokenId)) {
            const entry: Entry = { name, tokenId, regNumber: ++this.regCount };
            this.nameToToken.set(name, entry);
            this.tokenToName.set(tokenId, entry);
          }
        }

        const next: string | null = registryOut.spentTransactionId ?? null;
        // Persist the cursor at the last SPENT box so a refresh resumes here.
        if (next) this.cursorTx = next;
        else this.cursorTx = txId; // tip: re-poll this tx next time
        txId = next;
      }
    })();
    try {
      await this.building;
      this.lastRefresh = Date.now();
    } finally {
      this.building = null;
    }
  }

  /** Current on-chain owner of a name token (the P2PK holder), or null. */
  private async lookupOwner(tokenId: string): Promise<{ owner: string | null; ownerType: string }> {
    const boxes = await this.fetchUnspentByToken(tokenId);
    const p2pk = boxes.filter((b) => b.address && b.address.length <= 60);
    if (p2pk.length === 0) return { owner: null, ownerType: "contract" };
    if (p2pk.length === 1) return { owner: p2pk[0].address, ownerType: "p2pk" };
    // Multiple P2PK holders — anomalous (e.g. duplicate-token vector); newest wins.
    const newest = p2pk.reduce((a, b) => (b.height > a.height ? b : a));
    return { owner: newest.address, ownerType: "ambiguous" };
  }

  /** Full resolution record for a name, read live from the chain. */
  async resolve(name: string): Promise<ResolveResult> {
    const n = normalize(name);
    if (!isValidName(n)) return { name: n, isValid: false };
    await this.ensureIndex();
    const entry = this.nameToToken.get(n);
    if (!entry) return { name: n, isValid: true, isAvailable: true, source: "live" };
    const { owner, ownerType } = await this.lookupOwner(entry.tokenId);
    return {
      name: n,
      isValid: true,
      isAvailable: false,
      owner,
      ownerType,
      source: "live",
      tokenId: entry.tokenId,
      registrationNumber: entry.regNumber,
    };
  }

  /** Current address behind a name, or null. Always live (verified). */
  async resolveAddress(name: string): Promise<string | null> {
    return (await this.resolve(name)).owner ?? null;
  }

  /** True when the name is registered to someone. */
  async isRegistered(name: string): Promise<boolean> {
    const r = await this.resolve(name);
    return r.isValid && r.isAvailable === false;
  }

  /** True when the name can be minted right now (valid + unregistered). */
  async isAvailable(name: string): Promise<boolean> {
    const r = await this.resolve(name);
    return r.isValid && r.isAvailable === true;
  }

  /** Names currently held by an address + its primary (earliest-registered). */
  async reverse(address: string): Promise<ReverseResult> {
    if (!/^[a-zA-Z0-9]{40,60}$/.test(address)) throw new Error("invalid Ergo address");
    await this.ensureIndex();
    const tokens = await this.fetchBalanceTokens(address);
    const held: OwnedName[] = [];
    let primary: Entry | null = null;
    for (const t of tokens) {
      const entry = this.tokenToName.get(t.tokenId);
      if (!entry) continue;
      held.push({ name: entry.name, tokenId: entry.tokenId });
      if (!primary || entry.regNumber < primary.regNumber) primary = entry;
    }
    return { address, primary: primary ? primary.name : null, names: held };
  }

  /** What to display for an address, or null. Never throws. */
  async primaryName(address: string): Promise<string | null> {
    try {
      return (await this.reverse(address)).primary;
    } catch {
      return null;
    }
  }
}

/** Shared default-config chain resolver (mainnet, public explorer). */
export const chain = new ChainResolver();
