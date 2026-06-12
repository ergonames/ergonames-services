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
    /** Current holder's P2PK address (live — reflects NFT transfers). */
    owner?: string | null;
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
/**
 * Strip the leading ~ and whitespace, and lowercase. Registered names are
 * lowercase-only (charset policy), so resolution is case-insensitive by
 * normalizing the query.
 */
export declare function normalize(name: string): string;
/** Syntactic check only — says nothing about availability. */
export declare function isValidName(name: string): boolean;
export declare class ErgoNames {
    private apiUrl;
    private timeoutMs;
    constructor(options?: ErgoNamesOptions);
    private get;
    /** Full resolution record for a name. */
    resolve(name: string): Promise<ResolveResult>;
    /**
     * The call wallets want: current address behind a name, or null when the
     * name is unregistered. Throws only on network/API failure, so callers can
     * distinguish "no such name" (null) from "couldn't check" (throw).
     */
    resolveAddress(name: string): Promise<string | null>;
    /** True when the name is registered to someone. */
    isRegistered(name: string): Promise<boolean>;
    /** True when the name can be minted right now (valid, unregistered, not reserved). */
    isAvailable(name: string): Promise<boolean>;
    /** All names currently held by an address, plus its primary name. Live. */
    reverse(address: string): Promise<ReverseResult>;
    /**
     * The display call: what to show instead of a raw address, or null.
     * Never throws — display decoration must not break the host app.
     */
    primaryName(address: string): Promise<string | null>;
}
/** Shared default-config instance for one-line usage. */
export declare const ergonames: ErgoNames;
