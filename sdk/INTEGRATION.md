# Integrating ErgoNames resolution

Resolve `~name` → Ergo address (and address → name) in a wallet or dApp.
Zero dependencies; works in browsers, Node 18+, and Bun.

```sh
npm install ergonames
```

## Two ways to resolve — pick per your trust/latency needs

### Option A — API client (fastest, simplest)
```ts
import { ergonames } from "ergonames";

await ergonames.resolveAddress("~alice"); // address | null  (verified/live by default)
await ergonames.primaryName(addr);        // display name | null  (never throws)
```
Talks to the public ErgoNames API. Lowest latency, one line.

### Option B — straight from a node/explorer, **no ErgoNames server in the path** (recommended for a wallet)
```ts
import { ChainResolver } from "ergonames";

// Auto-detects node (/blockchain/…, needs extraIndex) vs explorer (/api/v1/…).
const en = new ChainResolver({ explorerUrl: "<your node or explorer URL>" });

await en.resolveAddress("~alice");
await en.primaryName(addr);
await en.reverse(addr); // { primary, names: [{name, tokenId}] }
```
Reads the chain directly — **point it at the node Nautilus already uses and depend on nobody.** Resolution is trustless: a name's owner is whoever currently holds its NFT (always live, so transfers are reflected), and the name is the consensus name from the registration data (not the spoofable display register).

> **Cold-start tip:** the first call builds a small `name → token` index by walking the registry from genesis (~seconds at current scale), then caches it (15s freshness TTL). Construct **one** instance at wallet load and call `resolveAddress` once in the background to warm it, so the send field is instant when the user gets there. (`import { chain }` gives a ready instance against the public explorer if you don't want to manage one.)

## Send-flow wiring (the main integration)
When the recipient field holds a name (starts with `~`, or just looks like one), resolve it before building the tx:

```ts
import { ergonames, isValidName } from "ergonames"; // or your ChainResolver instance

async function resolveRecipient(input: string): Promise<string | null> {
  if (!isValidName(input)) return null;            // not a name → treat as a raw address
  try {
    return await ergonames.resolveAddress(input);  // resolved address, or null if unregistered
  } catch {
    // network / lookup failure — DO NOT send; surface "couldn't verify, try again"
    throw new Error("Couldn't resolve that name right now.");
  }
}
```

**The one critical contract:** `resolveAddress` returns `null` for *"no such name"* and **throws** on *network failure* — so you can tell "unknown name" apart from "couldn't check," and never send funds on a failed check. The leading `~` is optional (`"~alice"` ≡ `"alice"`); `isValidName()` and `normalize()` are exported for input handling.

## Reverse display (optional)
Show a name instead of a raw address wherever you list recipients/contacts:
```ts
const label = (await ergonames.primaryName(addr)) ?? shorten(addr); // never throws
```

## Beta now → launch
ErgoNames is currently in **beta on mainnet** — a throwaway phase (test names, no guarantees). At public launch we'll cut a **fresh genesis** (new registry + collection) with the finalized contracts. The **SDK API surface is stable** — `resolveAddress` / `primaryName` / `ChainResolver` won't change, so your integration won't need rework. What changes underneath:
- **API client (Option A):** nothing to do — `api.ergonames.io` switches to the launch registry automatically.
- **ChainResolver (Option B):** the genesis constants (`genesisTxId`, `registrySingletonTokenId`) are baked in; we'll ship an SDK release with the launch values — bump the package at launch, or pass them via options. We'll give integrators the new version + a heads-up ahead of the cutover.
- **Names:** beta registrations don't carry to launch (beta holders migrate / re-claim), so integrate and test freely now — just don't treat beta-resolved names as permanent yet.

## Notes
- All calls are async — debounce the send-field resolve on input.
- TypeScript types are bundled (`.d.ts`).
- New genesis / testnet: override `genesisTxId` + `registrySingletonTokenId` (+ `explorerUrl`) on `ChainResolver`.
- Source + license (MIT): https://github.com/ergonames/ergonames-services/tree/master/sdk
