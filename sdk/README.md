# ergonames

Resolve ErgoNames (`~name`) to Ergo addresses — and addresses back to names. Zero dependencies; works in browsers, Node 18+, and Bun.

ErgoNames are lifetime usernames on Ergo: each name is an NFT, and **whoever holds the NFT owns the name**. Resolution is live — transfer the NFT and the name follows the new wallet.

## Install

```sh
npm install ergonames
```

## Wallet integration in two calls

```ts
import { ergonames } from "ergonames";

// 1. User types "~adoo" in the send field — where does it go?
const address = await ergonames.resolveAddress("~adoo");
// "9h2quS8eoZ…" or null when the name isn't registered

// 2. Showing an address somewhere? Display the name instead.
const name = await ergonames.primaryName("9h2quS8eoZF9pEm6LN52Jgq9tvZ6C7TdjJXnGm2Keqc6L1ZDKs4");
// "adoo" or null — never throws, safe to decorate UI with
```

`resolveAddress` returns `null` for unregistered names and **throws** on network failure, so you can tell "no such name" apart from "couldn't check" (never send funds on a failed check). `primaryName` never throws — display decoration shouldn't break your app.

## Full API

```ts
import { ErgoNames, isValidName, normalize } from "ergonames";

const sdk = new ErgoNames();              // or new ErgoNames({ apiUrl, timeoutMs })

await sdk.resolve("~adoo");               // full record: owner, tokenId, mint tx, registration #
await sdk.resolveAddress("~adoo");        // current owner address | null
await sdk.isRegistered("adoo");           // boolean
await sdk.isAvailable("newname");         // valid + unregistered + not reserved
await sdk.reverse("9h2quS8e…");           // { primary, names: [{name, tokenId}] }
await sdk.primaryName("9h2quS8e…");       // "adoo" | null, never throws

isValidName("~some_name");                // syntax check, no network
normalize(" ~Adoo ");                     // "adoo" — strips tilde/whitespace, lowercases
```

Notes:

- The tilde is optional everywhere — `"~adoo"` and `"adoo"` are equivalent inputs.
- `resolve()` on a reserved name returns `isReserved: true`: it's unregistered but mintable only by a verified owner (anti-squatting for well-known projects and brands).
- Ownership lookups reflect the chain live, including NFT transfers after mint.

## Direct-chain mode — no ErgoNames server

The default client is fast because it talks to the ErgoNames API. If you want **zero dependency on any ErgoNames-operated service**, use `ChainResolver`: it reads names and owners straight from an Ergo explorer (or your own node), with the same method surface.

```ts
import { ChainResolver, chain } from "ergonames";

// `chain` is a ready-made resolver pointed at the public Ergo explorer.
await chain.resolveAddress("~adoo");   // current owner, read live from the chain
await chain.reverse("9h2quS8e…");      // { primary, names }

// Or point it at your own node / explorer for full self-sovereignty:
const r = new ChainResolver({ explorerUrl: "https://my-node.example" });
```

How it stays trustless:

- **Owner is always live.** A name's owner is whoever currently holds its NFT on-chain — looked up fresh on every call, so transfers are always reflected. No server's word is taken for who owns what.
- **The name is the consensus name.** It's decoded from the registration's commit-reveal data (the bytes the contracts actually hashed into the registry), not the cosmetic display register — so it can't be spoofed.

Trade-off to know: the chain stores only the registry's cryptographic digest, not the `name → token` map, so on first use `ChainResolver` reconstructs that map by walking the registry from genesis (cached afterwards, refreshed incrementally). That's near-instant at today's scale and ideal for self-hosted/self-sovereign integrators; a very large registry would want a light client or an on-chain index. For most apps, the API client above is the simpler choice — `ChainResolver` is there when you want no server in the path at all.

## Self-hosting

Point the API client at your own [ergonames-services](https://github.com/ergonames/ergonames-services) deployment:

```ts
const sdk = new ErgoNames({ apiUrl: "https://api.your-deployment.example" });
```
