import type { ResolveResult, ReverseResult } from "./index.js";
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
/** Decode the consensus name from a reveal box's R9 serialized hex, or null. */
export declare function ergoNameFromRevealR9(serializedHex: string): string | null;
export declare class ChainResolver {
    private explorerUrl;
    private genesisTxId;
    private registryToken;
    private timeoutMs;
    private refreshTtlMs;
    private mode;
    private nameToToken;
    private tokenToName;
    private cursorTx;
    private regCount;
    private lastRefresh;
    private building;
    constructor(options?: ChainResolverOptions);
    private get;
    /** Resolve the backend API once and cache it: an Ergo node serves
     *  `/blockchain/indexedHeight`; an explorer 404s it. */
    private detectMode;
    /** A transaction by id. Explorer and node return compatible inputs/outputs:
     *  each output carries assets + additionalRegisters + spentTransactionId, each
     *  input carries boxId + additionalRegisters (node registers are hex strings,
     *  explorer registers are `{serializedValue}` — both handled downstream). */
    private fetchTx;
    /** Unspent boxes holding a token, normalized to `{ address, height }`. The
     *  node returns a bare array with `inclusionHeight`; the explorer wraps the
     *  list in `items` with `settlementHeight`. */
    private fetchUnspentByToken;
    /** Confirmed token balance for an address. The node takes a POST body and
     *  nests tokens under `confirmed`; the explorer is a GET. */
    private fetchBalanceTokens;
    /** Walk the registry spend chain from the cursor to the tip, recording mints.
     *  Idempotent + incremental; concurrent callers share one in-flight build. */
    private ensureIndex;
    /** Current on-chain owner of a name token (the P2PK holder), or null. */
    private lookupOwner;
    /** Full resolution record for a name, read live from the chain. */
    resolve(name: string): Promise<ResolveResult>;
    /** Current address behind a name, or null. Always live (verified). */
    resolveAddress(name: string): Promise<string | null>;
    /** True when the name is registered to someone. */
    isRegistered(name: string): Promise<boolean>;
    /** True when the name can be minted right now (valid + unregistered). */
    isAvailable(name: string): Promise<boolean>;
    /** Names currently held by an address + its primary (earliest-registered). */
    reverse(address: string): Promise<ReverseResult>;
    /** What to display for an address, or null. Never throws. */
    primaryName(address: string): Promise<string | null>;
}
/** Shared default-config chain resolver (mainnet, public explorer). */
export declare const chain: ChainResolver;
