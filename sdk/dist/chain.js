// Direct-chain ErgoNames resolution — NO ErgoNames server in the path.
//
// Reads straight from an Ergo explorer (or your own node's explorer-compatible
// API). Resolution is trustless: a name's owner is whoever currently holds its
// NFT on-chain, and the name itself is the CONSENSUS name from the reveal box's
// R9 — not the spoofable EIP-4 display register.
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
// Inlined (kept identical to index.ts) so this module has no runtime dependency
// on index.ts — avoids a circular value import.
const NAME_RE = /^[a-zA-Z0-9_]{1,25}$/;
const normalize = (name) => name.trim().replace(/^~/, "").toLowerCase();
const isValidName = (name) => NAME_RE.test(normalize(name));
// Mainnet constants (from the deployed genesis manifest). Override via options
// for testnet / a new genesis.
const MAINNET = {
    explorerUrl: "https://api.ergoplatform.com",
    genesisTxId: "0bedde748e58de99764b1c913c6d256e56600894e4711c2e31b54531a4c5a98c",
    registrySingletonTokenId: "ce712171f9ef228ce20359eadc20d74aae6ab5c8c043489c3d75cecd6512c465",
};
// The reveal box R9 = (GroupElement, (Coll[Coll[Byte]], Coll[Long])); its first
// inner Coll[Byte] is the consensus-validated ergoName bytes the registry
// hashed into the AVL tree. Layout (names are 1-25 chars, single-byte VLQ):
//   [4 type bytes 0x433c1a11][33 GroupElement][1 coll-count 0x03][1 len][name]
const REVEAL_R9_PREFIX = "433c1a11";
function hexToBytes(hex) {
    const out = new Uint8Array(hex.length >> 1);
    for (let i = 0; i < out.length; i++)
        out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
}
/** Decode the consensus name from a reveal box's R9 serialized hex, or null. */
export function ergoNameFromRevealR9(serializedHex) {
    try {
        if (!serializedHex || !serializedHex.startsWith(REVEAL_R9_PREFIX))
            return null;
        const b = hexToBytes(serializedHex);
        let off = 4 + 33; // type prefix + GroupElement
        if (b[off] !== 0x03)
            return null; // inner collection holds exactly 3 elements
        off += 1;
        const len = b[off];
        off += 1;
        if (len < 1 || len > 25 || off + len > b.length)
            return null;
        const name = new TextDecoder().decode(b.slice(off, off + len));
        if (!/^[a-z0-9_]+$/.test(name))
            return null; // on-chain charset
        return name;
    }
    catch {
        return null;
    }
}
export class ChainResolver {
    explorerUrl;
    genesisTxId;
    registryToken;
    timeoutMs;
    refreshTtlMs;
    // Built forward index + reverse lookup, with the spend-chain cursor for
    // incremental extension.
    nameToToken = new Map();
    tokenToName = new Map();
    cursorTx;
    regCount = 0;
    lastRefresh = 0;
    building = null;
    constructor(options = {}) {
        this.explorerUrl = (options.explorerUrl ?? MAINNET.explorerUrl).replace(/\/$/, "");
        this.genesisTxId = options.genesisTxId ?? MAINNET.genesisTxId;
        this.registryToken = options.registrySingletonTokenId ?? MAINNET.registrySingletonTokenId;
        this.timeoutMs = options.timeoutMs ?? 12000;
        this.refreshTtlMs = options.refreshTtlMs ?? 15000;
        this.cursorTx = this.genesisTxId;
    }
    async get(path) {
        const res = await fetch(this.explorerUrl + path, {
            signal: AbortSignal.timeout(this.timeoutMs),
            headers: { accept: "application/json" },
        });
        if (!res.ok)
            throw new Error(`explorer ${res.status} on ${path}`);
        return res.json();
    }
    /** Walk the registry spend chain from the cursor to the tip, recording mints.
     *  Idempotent + incremental; concurrent callers share one in-flight build. */
    async ensureIndex() {
        if (this.building)
            return this.building;
        // Trust a freshly-built index for a short window to keep bursts of lookups
        // fast; owner lookups stay live regardless.
        if (this.lastRefresh > 0 && Date.now() - this.lastRefresh < this.refreshTtlMs)
            return;
        this.building = (async () => {
            let txId = this.cursorTx;
            while (txId) {
                const tx = await this.get(`/api/v1/transactions/${txId}`);
                const regIdx = tx.outputs.findIndex((o) => (o.assets ?? []).some((a) => a.tokenId === this.registryToken));
                if (regIdx < 0)
                    break; // not a registry tx (shouldn't happen) — stop
                const registryOut = tx.outputs[regIdx];
                // v1 mint layout: registry at output 1, 6 outputs, issuance box at 0.
                const isMint = regIdx === 1 && tx.outputs.length === 6 && (tx.outputs[0].assets ?? []).length > 0;
                if (isMint) {
                    const tokenId = tx.outputs[0].assets[0].tokenId;
                    // token id == reveal box id by construction; find that input.
                    const revealInput = (tx.inputs ?? []).find((i) => i.boxId === tokenId);
                    const r9 = revealInput?.additionalRegisters?.R9?.serializedValue ??
                        revealInput?.additionalRegisters?.R9;
                    const name = typeof r9 === "string" ? ergoNameFromRevealR9(r9) : null;
                    if (name && !this.tokenToName.has(tokenId)) {
                        const entry = { name, tokenId, regNumber: ++this.regCount };
                        this.nameToToken.set(name, entry);
                        this.tokenToName.set(tokenId, entry);
                    }
                }
                const next = registryOut.spentTransactionId ?? null;
                // Persist the cursor at the last SPENT box so a refresh resumes here.
                if (next)
                    this.cursorTx = next;
                else
                    this.cursorTx = txId; // tip: re-poll this tx next time
                txId = next;
            }
        })();
        try {
            await this.building;
            this.lastRefresh = Date.now();
        }
        finally {
            this.building = null;
        }
    }
    /** Current on-chain owner of a name token (the P2PK holder), or null. */
    async lookupOwner(tokenId) {
        const j = await this.get(`/api/v1/boxes/unspent/byTokenId/${tokenId}`);
        const p2pk = (j.items ?? []).filter((b) => b.address && b.address.length <= 60);
        if (p2pk.length === 0)
            return { owner: null, ownerType: "contract" };
        if (p2pk.length === 1)
            return { owner: p2pk[0].address, ownerType: "p2pk" };
        // Multiple P2PK holders — anomalous (e.g. duplicate-token vector); newest wins.
        const newest = p2pk.reduce((a, b) => (b.settlementHeight ?? 0) > (a.settlementHeight ?? 0) ? b : a);
        return { owner: newest.address, ownerType: "ambiguous" };
    }
    /** Full resolution record for a name, read live from the chain. */
    async resolve(name) {
        const n = normalize(name);
        if (!isValidName(n))
            return { name: n, isValid: false };
        await this.ensureIndex();
        const entry = this.nameToToken.get(n);
        if (!entry)
            return { name: n, isValid: true, isAvailable: true, source: "live" };
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
    async resolveAddress(name) {
        return (await this.resolve(name)).owner ?? null;
    }
    /** True when the name is registered to someone. */
    async isRegistered(name) {
        const r = await this.resolve(name);
        return r.isValid && r.isAvailable === false;
    }
    /** True when the name can be minted right now (valid + unregistered). */
    async isAvailable(name) {
        const r = await this.resolve(name);
        return r.isValid && r.isAvailable === true;
    }
    /** Names currently held by an address + its primary (earliest-registered). */
    async reverse(address) {
        if (!/^[a-zA-Z0-9]{40,60}$/.test(address))
            throw new Error("invalid Ergo address");
        await this.ensureIndex();
        const bal = await this.get(`/api/v1/addresses/${address}/balance/confirmed`);
        const held = [];
        let primary = null;
        for (const t of bal.tokens ?? []) {
            const entry = this.tokenToName.get(t.tokenId);
            if (!entry)
                continue;
            held.push({ name: entry.name, tokenId: entry.tokenId });
            if (!primary || entry.regNumber < primary.regNumber)
                primary = entry;
        }
        return { address, primary: primary ? primary.name : null, names: held };
    }
    /** What to display for an address, or null. Never throws. */
    async primaryName(address) {
        try {
            return (await this.reverse(address)).primary;
        }
        catch {
            return null;
        }
    }
}
/** Shared default-config chain resolver (mainnet, public explorer). */
export const chain = new ChainResolver();
