import {
  checkDatabaseConnection,
  createDatabaseSchema,
  loadLastProcessedTx,
  saveLastProcessedTx,
  writeToRegistrationTable,
} from "./utils/database";
import { getRegistryHop } from "./utils/endpoints";

const POLL_INTERVAL_MS = 30_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Follows the registry box spend chain from the genesis transaction and
// records every mint. Non-mint registry spends (seeding, escape-hatch
// upgrades) are followed transparently. At the chain tip it polls the
// explorer until the registry box is spent again. Progress is persisted so
// restarts resume from the last processed transaction.
async function main() {
  const configFilePath = Bun.argv[2] ?? "config.json";
  const config = await Bun.file(configFilePath).json();

  const genesisTxId: string =
    config.ergonamesInformation.registryCreationTransactionId;
  const registrySingletonTokenId: string =
    config.ergonamesInformation.registrySingletonTokenId;
  const explorerUrl: string = config.networkInformation.explorerUrl;

  while (!(await checkDatabaseConnection())) {
    console.log("Could not connect to database. Retrying in 5 seconds...");
    await sleep(5000);
  }
  await createDatabaseSchema();

  // Names carried over from earlier deployment lineages live in the seeded
  // registry tree but have no mint tx in this chain; ingest them from config.
  for (const seed of config.ergonamesInformation.seedRegistrations ?? []) {
    const reg = await hydrateSeedRegistration(seed, explorerUrl);
    await writeToRegistrationTable(reg);
    console.log(`seeded: ${reg.ergonameRegistered}`);
  }

  let txId = (await loadLastProcessedTx()) ?? genesisTxId;
  let lastRecordedMint = "";
  console.log(`Indexer starting from tx ${txId}`);

  while (true) {
    try {
      const hop = await getRegistryHop(
        txId,
        explorerUrl,
        registrySingletonTokenId,
      );
      if (hop.registration && txId !== lastRecordedMint) {
        await writeToRegistrationTable(hop.registration);
        lastRecordedMint = txId;
        console.log(
          `registered: ${hop.registration.ergonameRegistered} ` +
            `(${hop.registration.ergonameTokenId.slice(0, 12)}…) ` +
            `block ${hop.registration.blockRegistered}`,
        );
      }
      if (hop.nextSpendTransactionId) {
        await saveLastProcessedTx(txId);
        txId = hop.nextSpendTransactionId;
      } else {
        await sleep(POLL_INTERVAL_MS);
      }
    } catch (e) {
      console.log(`hop failed (${e}); retrying in ${POLL_INTERVAL_MS / 1000}s`);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

// A seed entry is (name, tokenId); the mint details come from the explorer's
// token issuing box (token id = reveal box id, issuing box = issuance box).
async function hydrateSeedRegistration(
  seed: { name: string; tokenId: string },
  explorerUrl: string,
) {
  const tokenInfo: any = await (
    await fetch(`${explorerUrl}/api/v1/tokens/${seed.tokenId}`)
  ).json();
  const box: any = await (
    await fetch(`${explorerUrl}/api/v1/boxes/${tokenInfo.boxId}`)
  ).json();
  return {
    ergonameRegistered: seed.name,
    ergonameTokenId: seed.tokenId,
    mintBoxId: box.boxId,
    mintTransactionId: box.transactionId,
    spendTransactionId: box.spentTransactionId ?? null,
    registeredAddress: box.address,
    blockRegistered: box.settlementHeight,
    timestampRegistered: tokenInfo.mintingTimestamp ?? 0,
  };
}

await main();
