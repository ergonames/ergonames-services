// ErgoNames resolution SDK.
//
// ErgoNames are lifetime-ownership usernames on the Ergo blockchain: ~adoo
// is an NFT whose current holder IS the name's owner. Resolution is therefore
// live — transfer the NFT and the name resolves to the new wallet.
//
// This SDK is a thin, zero-dependency client for the public ErgoNames API.
// Typical wallet integration is two calls:
//   resolveAddress("~adoo")  -> where to send funds typed as a name
//   primaryName(address)     -> what to display instead of a raw address

export interface ErgoNamesOptions {
  /** API base URL. Defaults to the public ErgoNames API. */
  apiUrl?: string;
  /** Per-request timeout in milliseconds (default 10000). */
  timeoutMs?: number;
}

export interface ResolveResult {
  /** The name, without the leading tilde. */
  name: string;
  /** False when the string isn't a syntactically valid ErgoName. */
  isValid: boolean;
  /** True when the name has not been registered. */
  isAvailable?: boolean;
  /** True when the name is reserved and mintable only with verification. */
  isReserved?: boolean;
  /** Current holder's P2PK address (reflects NFT transfers). */
  owner?: string | null;
  /** How `owner` was resolved: "indexed" (fast), "live" (verified), or "live-fallback". */
  source?: "indexed" | "live" | "live-fallback";
  /** Block height the indexed owner is current as of (null on the live path). */
  asOfHeight?: number | null;
  /** "p2pk" | "contract" | "ambiguous" — null on the live path. */
  ownerType?: string | null;
  /** The name's NFT token id. */
  tokenId?: string;
  /** Registration metadata (present when registered). */
  mintTransactionId?: string;
  registrationNumber?: number;
  timestampRegistered?: number;
  /** Mint price in USD (present when available). */
  mintCost?: number;
}

export interface OwnedName {
  name: string;
  tokenId: string;
}

export interface ReverseResult {
  address: string;
  /** The address's primary name (earliest registered), or null. */
  primary: string | null;
  names: OwnedName[];
}

const DEFAULT_API = "https://api.ergonames.io";
const NAME_RE = /^[a-zA-Z0-9_]{1,25}$/;

/**
 * Strip the leading ~ and whitespace, and lowercase. Registered names are
 * lowercase-only (charset policy), so resolution is case-insensitive by
 * normalizing the query.
 */
export function normalize(name: string): string {
  return name.trim().replace(/^~/, "").toLowerCase();
}

/** Syntactic check only — says nothing about availability. */
export function isValidName(name: string): boolean {
  return NAME_RE.test(normalize(name));
}

export class ErgoNames {
  private apiUrl: string;
  private timeoutMs: number;

  constructor(options: ErgoNamesOptions = {}) {
    this.apiUrl = (options.apiUrl ?? DEFAULT_API).replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(this.apiUrl + path, {
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`ErgoNames API ${res.status} on ${path}`);
    return res.json() as Promise<T>;
  }

  /**
   * Full resolution record for a name.
   *
   * `verified` selects the resolution path (see the dual-path design):
   *   - false (default): the INDEXED path — fast, returns `source:"indexed"`
   *     and an `asOfHeight` freshness stamp. Right for display.
   *   - true: the VERIFIED path — a live chain lookup, always current but
   *     slower. Right before moving money.
   */
  async resolve(
    name: string,
    opts: { verified?: boolean } = {},
  ): Promise<ResolveResult> {
    const n = normalize(name);
    if (!NAME_RE.test(n)) return { name: n, isValid: false };
    const q = opts.verified ? "?verified=true" : "";
    const r = await this.get<Omit<ResolveResult, "name">>(`/resolve/${n}${q}`);
    return { name: n, ...r };
  }

  /**
   * The call wallets want: current address behind a name, or null when the
   * name is unregistered. DEFAULTS TO THE VERIFIED PATH — this call moves
   * money, so correctness beats latency. Pass `{ verified: false }` for the
   * fast indexed path when a wrong answer only costs a re-render. Throws only
   * on network/API failure, so callers can distinguish "no such name" (null)
   * from "couldn't check" (throw) and never send funds on a failed check.
   */
  async resolveAddress(
    name: string,
    opts: { verified?: boolean } = {},
  ): Promise<string | null> {
    const r = await this.resolve(name, { verified: opts.verified ?? true });
    return r.owner ?? null;
  }

  /** True when the name is registered to someone. */
  async isRegistered(name: string): Promise<boolean> {
    const r = await this.resolve(name);
    return r.isValid && r.isAvailable === false;
  }

  /** True when the name can be minted right now (valid, unregistered, not reserved). */
  async isAvailable(name: string): Promise<boolean> {
    const r = await this.resolve(name);
    return r.isValid && r.isAvailable === true && !r.isReserved;
  }

  /** All names currently held by an address, plus its primary name. Live. */
  async reverse(address: string): Promise<ReverseResult> {
    if (!/^[a-zA-Z0-9]{40,60}$/.test(address)) {
      throw new Error("invalid Ergo address");
    }
    return this.get<ReverseResult>(`/reverse/${address}`);
  }

  /**
   * The display call: what to show instead of a raw address, or null.
   * Never throws — display decoration must not break the host app.
   */
  async primaryName(address: string): Promise<string | null> {
    try {
      const r = await this.reverse(address);
      return r.primary;
    } catch {
      return null;
    }
  }
}

/** Shared default-config instance for one-line usage. */
export const ergonames = new ErgoNames();

// Direct-chain resolution (no ErgoNames server in the path) — reads names and
// owners straight from an Ergo explorer/node you choose. See ./chain.
export {
  ChainResolver,
  chain,
  ergoNameFromRevealR9,
  type ChainResolverOptions,
} from "./chain.js";
