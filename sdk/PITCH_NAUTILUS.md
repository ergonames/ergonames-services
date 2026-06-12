# Outreach draft: Nautilus integration

(Internal — Aadarsh sends this; adjust voice as needed. Best channel: Nautilus GitHub
discussions/issues at github.com/nautls/nautilus-wallet, or the dev's DMs on Ergo Discord.)

---

Hey! ErgoNames is live again on mainnet — lifetime ~usernames as NFTs, with the registry
fully on-chain (AVL trees) and live resolution that follows NFT transfers.

I'd love to make Nautilus the first wallet where names just work. Two integration points,
both tiny:

**1. Send-to-name.** When the recipient field starts with `~`, resolve it:

```ts
import { ergonames } from "@ergonames/sdk";
const address = await ergonames.resolveAddress(input); // null = not registered
```

Null means "no such name" (block the send); a throw means "couldn't check" (also block,
different message). No protocol code, no crypto — one HTTPS call to the public API, or to
any self-hosted instance of our open-source indexer (github.com/ergonames/ergonames-services).

**2. Names instead of addresses.** Anywhere you render an address:

```ts
const name = await ergonames.primaryName(address); // "adoo" | null, never throws
```

It's read-only decoration — cache it per session if you like, resolution is one indexed
DB lookup on our side and the endpoints are CDN-fronted.

The SDK is zero-dependency TS (browser/Node/Bun), MIT, ~150 lines you can audit in one
sitting: github.com/ergonames/ergonames-services/tree/master/sdk

Happy to add anything you'd need — batch endpoints, websockets for name transfers,
whatever makes it painless. And if you'd rather own the verification path, you can run
the whole resolution stack yourself with docker compose.

~adoo holds the keys to prove it works: https://www.ergonames.io/name/adootest2
