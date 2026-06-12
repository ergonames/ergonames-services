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
const DEFAULT_API = "https://api.ergonames.io";
const NAME_RE = /^[a-zA-Z0-9_]{1,25}$/;
/**
 * Strip the leading ~ and whitespace, and lowercase. Registered names are
 * lowercase-only (charset policy), so resolution is case-insensitive by
 * normalizing the query.
 */
export function normalize(name) {
    return name.trim().replace(/^~/, "").toLowerCase();
}
/** Syntactic check only — says nothing about availability. */
export function isValidName(name) {
    return NAME_RE.test(normalize(name));
}
export class ErgoNames {
    apiUrl;
    timeoutMs;
    constructor(options = {}) {
        this.apiUrl = (options.apiUrl ?? DEFAULT_API).replace(/\/$/, "");
        this.timeoutMs = options.timeoutMs ?? 10000;
    }
    async get(path) {
        const res = await fetch(this.apiUrl + path, {
            signal: AbortSignal.timeout(this.timeoutMs),
            headers: { accept: "application/json" },
        });
        if (!res.ok)
            throw new Error(`ErgoNames API ${res.status} on ${path}`);
        return res.json();
    }
    /** Full resolution record for a name. */
    async resolve(name) {
        const n = normalize(name);
        if (!NAME_RE.test(n))
            return { name: n, isValid: false };
        const r = await this.get(`/resolve/${n}`);
        return { name: n, ...r };
    }
    /**
     * The call wallets want: current address behind a name, or null when the
     * name is unregistered. Throws only on network/API failure, so callers can
     * distinguish "no such name" (null) from "couldn't check" (throw).
     */
    async resolveAddress(name) {
        const r = await this.resolve(name);
        return r.owner ?? null;
    }
    /** True when the name is registered to someone. */
    async isRegistered(name) {
        const r = await this.resolve(name);
        return r.isValid && r.isAvailable === false;
    }
    /** True when the name can be minted right now (valid, unregistered, not reserved). */
    async isAvailable(name) {
        const r = await this.resolve(name);
        return r.isValid && r.isAvailable === true && !r.isReserved;
    }
    /** All names currently held by an address, plus its primary name. Live. */
    async reverse(address) {
        if (!/^[a-zA-Z0-9]{40,60}$/.test(address)) {
            throw new Error("invalid Ergo address");
        }
        return this.get(`/reverse/${address}`);
    }
    /**
     * The display call: what to show instead of a raw address, or null.
     * Never throws — display decoration must not break the host app.
     */
    async primaryName(address) {
        try {
            const r = await this.reverse(address);
            return r.primary;
        }
        catch {
            return null;
        }
    }
}
/** Shared default-config instance for one-line usage. */
export const ergonames = new ErgoNames();
