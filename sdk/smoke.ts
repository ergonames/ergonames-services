// Live smoke test against the production API: bun run smoke.ts
import { ErgoNames, isValidName, normalize } from "./src/index";

const sdk = new ErgoNames();

const adootest2 = await sdk.resolve("~adootest2");
console.log("resolve ~adootest2:", adootest2.isAvailable === false ? "registered ✓" : "FAIL", adootest2.tokenId);

const addr = await sdk.resolveAddress("adootest2");
console.log("resolveAddress:", addr ? `→ ${addr.slice(0, 12)}… ✓` : "FAIL");

const rev = addr ? await sdk.reverse(addr) : null;
console.log("reverse:", rev && rev.names.length > 0 ? `primary=~${rev.primary} (${rev.names.length} names) ✓` : "FAIL");

const avail = await sdk.isAvailable("surelyunminted12345");
console.log("isAvailable(unminted):", avail ? "true ✓" : "FAIL");

const reserved = await sdk.resolve("binance");
console.log("reserved flag:", reserved.isReserved ? "true ✓" : "FAIL");

console.log("validators:", isValidName("~ok_name") && !isValidName("bad name!") && normalize(" ~x ") === "x" ? "✓" : "FAIL");
