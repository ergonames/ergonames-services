import type { RegistrationInformation } from "../types/RegistrationInformation";

export interface RegistryHop {
  transactionId: string;
  isMint: boolean;
  nextSpendTransactionId: string | null;
  registration: RegistrationInformation | null;
}

// Follows the registry box chain one transaction at a time. The registry
// output is identified by the registry singleton token. A hop is a mint when
// the registry sits at output index 1 with the issuance box at index 0 (the
// v1 mint layout); genesis, seeding, and escape-hatch upgrades carry the
// singleton at index 0 and are followed but not recorded.
export async function getRegistryHop(
  txId: string,
  explorerUrl: string,
  registrySingletonTokenId: string,
): Promise<RegistryHop> {
  const url = `${explorerUrl}/api/v1/transactions/${txId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`explorer returned ${response.status} for ${txId}`);
  }
  const json: any = await response.json();

  const registryIndex = json.outputs.findIndex((o: any) =>
    (o.assets ?? []).some((a: any) => a.tokenId === registrySingletonTokenId),
  );
  if (registryIndex < 0) {
    throw new Error(`registry singleton not found in outputs of ${txId}`);
  }
  const registryOutput = json.outputs[registryIndex];

  const isMint =
    registryIndex === 1 &&
    json.outputs.length === 6 &&
    (json.outputs[0].assets ?? []).length > 0;

  let registration: RegistrationInformation | null = null;
  if (isMint) {
    const issuance = json.outputs[0];
    registration = {
      ergonameRegistered: issuance.assets[0].name.replace(/^~/, ""),
      ergonameTokenId: issuance.assets[0].tokenId,
      mintBoxId: issuance.boxId,
      mintTransactionId: json.id,
      spendTransactionId: registryOutput.spentTransactionId ?? null,
      registeredAddress: issuance.address,
      blockRegistered: issuance.settlementHeight,
      timestampRegistered: json.timestamp,
    };
  }

  return {
    transactionId: json.id,
    isMint: isMint,
    nextSpendTransactionId: registryOutput.spentTransactionId ?? null,
    registration: registration,
  };
}
