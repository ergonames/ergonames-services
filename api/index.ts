import express, { Request, Response } from "express";
import fetch from "axios";
import postgres from "postgres";
const cors = require("cors");

const app = express();
app.use(cors());

const sql = postgres(
  process.env.DATABASE_URL ??
    "postgres://ergonames:ergonames@ergonames-db:5432/ergonames",
);
const EXPLORER_URL =
  process.env.EXPLORER_URL ?? "https://api.ergoplatform.com";

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "ErgoNames API" });
});

app.get("/info", async (req: Request, res: Response) => {
  let pendingRegistrations = 0;
  let result = await sql`
    SELECT COUNT(*) FROM registrations
  `;
  let totalRegistrations = parseInt(result[0].count, 10);

  if (isNaN(pendingRegistrations) || isNaN(totalRegistrations)) {
    return res
      .status(500)
      .json({ error: "Error fetching registration counts" });
  }

  let currentTimestampInMilliseconds = Date.now();
  let millisecondsInDay = 1000 * 60 * 60 * 24;

  let last24Hours = await sql`
    SELECT COUNT(*) FROM registrations WHERE timestamp_registered > ${currentTimestampInMilliseconds - millisecondsInDay}
    `;
  console.log(last24Hours);
  let last7Days = await sql`
    SELECT COUNT(*) FROM registrations WHERE timestamp_registered > ${currentTimestampInMilliseconds - millisecondsInDay * 7}
    `;

  let totalLast24Hours = parseInt(last24Hours[0].count, 10);
  let totalLast7Days = parseInt(last7Days[0].count, 10);

  let info = {
    pendingRegistrations: pendingRegistrations,
    totalRegistrations: totalRegistrations,
    last24Hours: totalLast24Hours,
    last7Days: totalLast7Days,
  };

  res.json(info);
});

app.get("/resolve/:name", async (req: Request, res: Response) => {
  let name = req.params.name;
  if (!validSyntax(name)) {
    let json = {
      isValid: false,
    };
    res.json(json);
  } else {
    let query = await sql`
  SELECT * FROM registrations WHERE ergoname_name = ${name}
  `;
    if (query.length === 0) {
      let cost = getMintCost(name);
      let fee = getTransactionFee();
      let json = {
        isValid: true,
        isAvailable: true,
        mintCost: cost,
        transactionFee: fee,
      };
      res.json(json);
    } else {
      let json = {
        isValid: true,
        isAvailable: false,
        ergoname: query[0].ergoname_name,
        tokenId: query[0].ergoname_token_id,
        mintTransactionId: query[0].mint_transaction_id,
        mintBoxId: query[0].mint_box_id,
        spentTransactionId: query[0].spent_transaction_id,
        blockRegistered: query[0].block_registered,
        timestampRegistered: query[0].timestamp_registered,
        registrationNumber: query[0].registration_number,
      };
      res.json(json);
    }
  }
});

app.get("/owner/:name", async (req: Request, res: Response) => {
  let name = req.params.name;
  let query = await sql`
  SELECT * FROM registrations WHERE ergoname_name = ${name}
  `;
  if (query.length === 0) {
    res.json({ message: "Name not found" });
  } else {
    // The ErgoName token has two live units: the owner's wallet box and the
    // subname registry box (a contract). The owner is the P2PK holder.
    let token_id = query[0].ergoname_token_id;
    let boxesUrl = `${EXPLORER_URL}/api/v1/boxes/unspent/byTokenId/${token_id}`;
    let boxes = await fetch(boxesUrl);
    let items: any[] = boxes.data.items ?? [];
    let p2pk = items.find((b: any) => b.address && b.address.length <= 60);
    if (!p2pk) {
      res.json({ message: "Owner box not found" });
    } else {
      res.json({ owner: p2pk.address });
    }
  }
});

app.get("/latest-registrations/:limit", async (req: Request, res: Response) => {
  let limit = req.params.limit;
  let query = await sql`
        SELECT * FROM registrations ORDER BY registration_number DESC LIMIT ${limit}
    `;
  res.json(query);
});

app.get("/token/:tokenId", async (req: Request, res: Response) => {
  let tokenId = req.params.tokenId;
  let query = await sql`
        SELECT * FROM registrations WHERE ergoname_token_id = ${tokenId}
    `;
  if (query.length === 0) {
    res.json({ message: "Token not found" });
  } else {
    let json = {
      ergoname: query[0].ergoname_name,
      tokenId: query[0].ergoname_token_id,
      mintTransactionId: query[0].mint_transaction_id,
      mintBoxId: query[0].mint_box_id,
      spentTransactionId: query[0].spent_transaction_id,
      blockRegistered: query[0].block_registered,
      timestampRegistered: query[0].timestamp_registered,
      registrationNumber: query[0].registration_number,
    };
    res.json(json);
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

function validSyntax(ergoname: string): boolean {
  if (ergoname.length < 3 || ergoname.length > 25) {
    return false;
  }
  let regex = /^[a-zA-Z0-9_]+$/;
  return regex.test(ergoname);
}

// Mirrors the on-chain registry price map (R7, USD by name length;
// the last entry applies to all longer names).
const PRICE_MAP_USD = [9999, 100, 50, 25, 10, 5, 3, 2, 1];

function getMintCost(ergoname: string): number {
  const idx = Math.min(ergoname.length, PRICE_MAP_USD.length - 1);
  return PRICE_MAP_USD[idx];
}

function getTransactionFee(): number {
  return 0.001;
}
