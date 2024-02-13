import postgres from "postgres";
import type { RegistrationInformation } from "../types/RegistrationInformation";

const sql = postgres(
  "postgres://ergonames:ergonames@ergonames-db:5432/ergonames",
);

export async function createDatabaseSchema() {
  await sql`
        CREATE TABLE IF NOT EXISTS registrations (
        ergoname_name VARCHAR(255) NOT NULL PRIMARY KEY,
        mint_transaction_id VARCHAR(64) NOT NULL,
        mint_box_id VARCHAR(64) NOT NULL,
        spent_transaction_id VARCHAR(64),
        ergoname_token_id VARCHAR(64) NOT NULL,
        block_registered INTEGER NOT NULL,
        registration_number SERIAL NOT NULL
        );
    `;
}

export async function writeToRegistrationTable(
  ergonameToRegister: RegistrationInformation,
) {
  await sql`
        INSERT INTO registrations (
            ergoname_name,
            mint_transaction_id,
            mint_box_id,
            spent_transaction_id,
            ergoname_token_id,
            block_registered
        ) VALUES (
            ${ergonameToRegister.ergonameRegistered},
            ${ergonameToRegister.mintTransactionId},
            ${ergonameToRegister.mintBoxId},
            ${ergonameToRegister.spendTransactionId},
            ${ergonameToRegister.ergonameTokenId},
            ${ergonameToRegister.blockRegistered}
        ) ON CONFLICT (ergoname_name) DO UPDATE SET
            spent_transaction_id = ${ergonameToRegister.spendTransactionId}
    `;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (e) {
    return false;
  }
}
