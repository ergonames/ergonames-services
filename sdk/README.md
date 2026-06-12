# @ergonames/sdk

Resolve ErgoNames (`~name`) to Ergo addresses — and addresses back to names. Zero dependencies; works in browsers, Node 18+, and Bun.

ErgoNames are lifetime usernames on Ergo: each name is an NFT, and **whoever holds the NFT owns the name**. Resolution is live — transfer the NFT and the name follows the new wallet.

## Install

```sh
npm install @ergonames/sdk
```

## Wallet integration in two calls

```ts
import { ergonames } from "@ergonames/sdk";

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
import { ErgoNames, isValidName, normalize } from "@ergonames/sdk";

const sdk = new ErgoNames();              // or new ErgoNames({ apiUrl, timeoutMs })

await sdk.resolve("~adoo");               // full record: owner, tokenId, mint tx, registration #
await sdk.resolveAddress("~adoo");        // current owner address | null
await sdk.isRegistered("adoo");           // boolean
await sdk.isAvailable("newname");         // valid + unregistered + not reserved
await sdk.reverse("9h2quS8e…");           // { primary, names: [{name, tokenId}] }
await sdk.primaryName("9h2quS8e…");       // "adoo" | null, never throws

isValidName("~some_name");                // syntax check, no network
normalize(" ~Adoo ");                     // "Adoo" — strips tilde/whitespace
```

Notes:

- The tilde is optional everywhere — `"~adoo"` and `"adoo"` are equivalent inputs.
- `resolve()` on a reserved name returns `isReserved: true`: it's unregistered but mintable only by a verified owner (anti-squatting for well-known projects and brands).
- Ownership lookups reflect the chain live, including NFT transfers after mint.

## Self-hosting

Point the SDK at your own [ergonames-services](https://github.com/ergonames/ergonames-services) deployment:

```ts
const sdk = new ErgoNames({ apiUrl: "https://api.your-deployment.example" });
```
