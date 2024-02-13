import type { RegistrationInformation } from "./types/RegistrationInformation";
import type { RegistryCreationInformation } from "./types/RegistryCreationInformation";
import { checkDatabaseConnection, createDatabaseSchema, writeToRegistrationTable } from "./utils/database";
import { getInitialRegistryCreationInformation, getRegistryInformation } from "./utils/endpoints";

async function main() {
    let args = Bun.argv;

    const configFilePath = args[2];
    const config = Bun.file(configFilePath);
    const programConstants = await config.json();

    const ergonamesInformation = programConstants.ergonamesInformation;
    const registryCreationTransactionId = ergonamesInformation.registryCreationTransactionId;

    const contractAddresses = programConstants.contractAddresses;
    const proxyAddress = contractAddresses.proxy;
    const registryAddress = contractAddresses.registry;
    const subnamesAddress = contractAddresses.subnames;

    const networkInformation = programConstants.networkInformation;
    const networkType = networkInformation.type;
    const nodeUrl = networkInformation.nodeUrl;
    const explorerUrl = networkInformation.explorerUrl;

    let connectedToDatabase = false;
    while (!connectedToDatabase) {
        connectedToDatabase = await checkDatabaseConnection();
        if (!connectedToDatabase) {
            console.log("Could not connect to database. Retrying in 5 seconds...");
            await new Promise(r => setTimeout(r, 5000));
        }
    }

    await createDatabaseSchema();

    let irci: RegistryCreationInformation = await getInitialRegistryCreationInformation(registryCreationTransactionId, explorerUrl);
    // console.log(irci);

    let ri: RegistrationInformation = await getRegistryInformation(irci.spentTransactionId, explorerUrl);
    console.log(ri);
    await writeToRegistrationTable(ri);
    while (ri.spendTransactionId != null) {
        ri = await getRegistryInformation(ri.spendTransactionId, explorerUrl);
        console.log(ri);
        await writeToRegistrationTable(ri);
    }
}

await main();