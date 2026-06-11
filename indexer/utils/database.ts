import postgres from "postgres";
import type { RegistrationInformation } from "../types/RegistrationInformation";

const sql = postgres(
  process.env.DATABASE_URL ??
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
        registered_address VARCHAR(64) NOT NULL,
        block_registered INTEGER NOT NULL,
        timestamp_registered BIGINT NOT NULL,
        registration_number SERIAL NOT NULL
        );
    `;
  await sql`
        CREATE TABLE IF NOT EXISTS indexer_state (
        id INTEGER PRIMARY KEY DEFAULT 1,
        last_processed_tx VARCHAR(64) NOT NULL,
        CONSTRAINT single_row CHECK (id = 1)
        );
    `;
}

export async function writeToRegistrationTable(
  r: RegistrationInformation,
) {
  await sql`
        INSERT INTO registrations (
            ergoname_name,
            mint_transaction_id,
            mint_box_id,
            spent_transaction_id,
            ergoname_token_id,
            registered_address,
            block_registered,
            timestamp_registered
        ) VALUES (
            ${r.ergonameRegistered},
            ${r.mintTransactionId},
            ${r.mintBoxId},
            ${r.spendTransactionId},
            ${r.ergonameTokenId},
            ${r.registeredAddress},
            ${r.blockRegistered},
            ${r.timestampRegistered}
        ) ON CONFLICT (ergoname_name) DO UPDATE SET
            spent_transaction_id = ${r.spendTransactionId}
    `;
}

export async function loadLastProcessedTx(): Promise<string | null> {
  const rows = await sql`SELECT last_processed_tx FROM indexer_state WHERE id = 1`;
  return rows.length > 0 ? rows[0].last_processed_tx : null;
}

export async function saveLastProcessedTx(txId: string) {
  await sql`
        INSERT INTO indexer_state (id, last_processed_tx) VALUES (1, ${txId})
        ON CONFLICT (id) DO UPDATE SET last_processed_tx = ${txId}
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
