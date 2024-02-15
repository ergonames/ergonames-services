import { randomInt } from "crypto";
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
  let pendingRegistrations = randomInt(10);
  let totalRegistrations = await sql`
    SELECT COUNT(*) FROM registrations
  `;
  totalRegistrations = totalRegistrations[0].count;
  let info = {
    pendingRegistrations: pendingRegistrations,
    totalRegistrations: totalRegistrations,
  };
  res.json(info);
});

app.get("/resolve/:name", async (req: Request, res: Response) => {
  let name = req.params.name;
  let query = await sql`
        SELECT * FROM registrations WHERE ergoname_name = ${name}
    `;
  res.json(query);
});

app.get("/owner/:name", async (req: Request, res: Response) => {
  let name = req.params.name;
  let query = await sql`
        SELECT * FROM registrations WHERE ergoname_name = ${name}
    `;
  if (query.length === 0) {
    res.json({ message: "Name not found" });
  }
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
  res.json(query);
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
