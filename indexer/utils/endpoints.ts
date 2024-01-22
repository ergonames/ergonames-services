import type { RegistrationInformation } from '../types/RegistrationInformation';
import type { RegistryCreationInformation } from '../types/RegistryCreationInformation';
import { decodeFromBase16Register } from './decode';

export async function getInitialRegistryCreationInformation(initialTransactionId: string, explorerUrl: string): Promise<RegistryCreationInformation> {
    let urlPath = "/api/v1/transactions/" + initialTransactionId;
    let url = explorerUrl + urlPath;
    let response = await fetch(url);
    let json: any = await response.json();
    let transactionId: string = json.id;
    let boxId: string = json.outputs[0].boxId;
    let spentTransactionId: string = json.outputs[0].spentTransactionId;
    let irci: RegistryCreationInformation = {
        transactionId: transactionId,
        boxId: boxId,
        spentTransactionId: spentTransactionId
    };
    return irci;
}

export async function getRegistryInformation(tx: string, explorerUrl: string): Promise<RegistrationInformation> {
    let urlPath = "/api/v1/transactions/" + tx;
    let url = explorerUrl + urlPath;
    console.log(url);
    let response = await fetch(url);
    let json: any = await response.json();
    let transactionId: string = json.id;
    let boxId: string = json.outputs[0].boxId;
    let spentTransactionId: string = json.outputs[1].spentTransactionId;
    let ergonameName: string = json.outputs[0].assets[0].name;
    let tokenId: string = json.outputs[0].assets[0].tokenId;
    let blockRegistered: number = json.outputs[0].settlementHeight;
    let ri: RegistrationInformation = {
        ergonameRegistered: ergonameName,
        ergonameTokenId: tokenId,
        mintBoxId: boxId,
        mintTransactionId: transactionId,
        spendTransactionId: spentTransactionId,
        blockRegistered: blockRegistered
    };
    return ri;
}