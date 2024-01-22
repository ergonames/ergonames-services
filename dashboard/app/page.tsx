"use client";
import Navbar from "@/components/navbar"
import { ApiInfo } from "@/types/ApiInfo";
import { Registration } from "@/types/Registration";
import { getApiInfo, getLastRegistrations } from "@/utils/endpoints";
import { getShortenedString } from "@/utils/string";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [last10Registrations, setLast10Registrations] = useState<Registration[]>([]);
  const [apiInfo, setApiInfo] = useState<ApiInfo | null>(null);

  useEffect(() => {
    const fetchLast10Registrations = async () => {
      const latestRegistrationData = await getLastRegistrations(10);
      setLast10Registrations(latestRegistrationData);
    }
    const fetchApiInfo = async () => {
      const apiInfo = await getApiInfo();
      setApiInfo(apiInfo);
    }
    fetchLast10Registrations();
    fetchApiInfo();
  }, []);

  return (
    <div>
      <Navbar />
      <div className="flex justify-between items-center pt-12">
        <div className="w-[70%]">
          <table className="mx-auto text-center">
            <thead>
              <tr>
                <th className="border-2 py-2 px-2">Name</th>
                <th className="border-2 py-2 px-2">Token Id</th>
                <th className="border-2 py-2 px-2">Mint Transaction Id</th>
              </tr>
            </thead>
            <tbody>
              {last10Registrations.map((reg, i) => (
                <tr key={i}>
                  <td className="border-2 py-2 px-2">{reg.ergoname_name}</td>
                  <td className="border-2 py-2 px-2"><Link href={`https://testnet.ergoplatform.com/token/${reg.ergoname_token_id}`} className="hover:underline">{getShortenedString(reg.ergoname_token_id, 20)}</Link></td>
                  <td className="border-2 py-2 px-2"><Link href={`https://testnet.ergoplatform.com/transactions/${reg.mint_transaction_id}`} className="hover:underline">{getShortenedString(reg.mint_transaction_id, 20)}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="w-[30%]">
          <table>
            <thead>
              <tr>
                <th className="border-2 py-2 px-2">Total Registrations</th>
                <th className="border-2 py-2 px-2">Pending Registrations</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-2 py-2 px-2">{ apiInfo?.totalRegistrations }</td>
                <td className="border-2 py-2 px-2">{ apiInfo?.pendingRegistrations }</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
