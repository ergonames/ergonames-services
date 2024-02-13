import type { NextApiRequest, NextApiResponse } from "next";

import { getLastRegistrations, getApiInfo } from "@/utils/endpoints";

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  const last10Registrations = await getLastRegistrations(10);
  const apiInfo = await getApiInfo();

  res.status(200).json({ last10Registrations, apiInfo });
}
