import express, { Request, Response } from "express";
import fetch from "axios";
import postgres from "postgres";
const cors = require("cors");

const app = express();
app.use(cors());

const sql = postgres(
  "postgres://ergonames:ergonames@ergonames-db:5432/ergonames",
);

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

  let info = {
    pendingRegistrations: pendingRegistrations,
    totalRegistrations: totalRegistrations,
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
    let token_id = query[0].ergoname_token_id;
    let boxesUrl = `https://api-testnet.ergoplatform.com/api/v1/boxes/byTokenId/${token_id}`;
    let amountBoxesUrl = boxesUrl + "?limit=1";
    let totalBoxesResponse = await fetch(amountBoxesUrl);
    let totalBoxes: any = totalBoxesResponse.data;
    let total = totalBoxes.total;
    let offset = 0;
    while (total > 100) {
      total -= 100;
      offset += 100;
    }
    let boxes = await fetch(boxesUrl + `?limit=100&offset=${offset}`);
    let boxesJson: any = boxes.data.items;
    console.log(boxesJson);
    let lastBox = boxesJson[boxesJson.length - 1];
    let owner = lastBox.address;
    res.json({ owner: owner });
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
  let regex = /^[a-z0-9]+$/;
  return regex.test(ergoname);
}

// Diamond(3 char): $500
// Gold(4 char): $150
// Silver (5-6 char): $50
// Bronze (7-8 char): $15
// Iron(>8 char): $5

function getMintCost(ergoname: string): number {
  let cost = 0.0;
  switch (ergoname.length) {
    case 3:
      cost = 500;
      break;
    case 4:
      cost = 150;
      break;
    case 5:
    case 6:
      cost = 50;
      break;
    case 7:
    case 8:
      cost = 15;
      break;
    default:
      cost = 5;
  }
  return cost;
}

function getTransactionFee(): number {
  return 0.001;
}
