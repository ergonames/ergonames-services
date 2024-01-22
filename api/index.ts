import { randomInt } from 'crypto';
import express, { Request, Response } from 'express';
import postgres from 'postgres';
const cors = require('cors');

const app = express();
app.use(cors());

const sql = postgres('postgres://ergonames:ergonames@localhost:5432/ergonames');

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'ErgoNames API' });
});

app.get('/info', async (req: Request, res: Response) => {
  let pendingRegistrations = randomInt(10);
  let totalRegistrations = await sql`
    SELECT COUNT(*) FROM registrations
  `;
  totalRegistrations = totalRegistrations[0].count;
  let info = {
    "pendingRegistrations": pendingRegistrations,
    "totalRegistrations": totalRegistrations,
  }
  res.json(info);
});

app.get('/resolve/:name', async (req: Request, res: Response) => {
    let name = req.params.name;
    let query = await sql`
        SELECT * FROM registrations WHERE ergoname_name = ${name}
    `;
    res.json(query);
});

app.get('/latest-registrations/:limit', async (req: Request, res: Response) => {
    let limit = req.params.limit;
    let query = await sql`
        SELECT * FROM registrations ORDER BY registration_number DESC LIMIT ${limit}
    `;
    res.json(query);
});

app.get('/token/:tokenId', async (req: Request, res: Response) => {
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