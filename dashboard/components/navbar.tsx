import Link from "next/link"

export default function Navbar() {
    return (
        <div className="bg-[#2e2e2e] text-white py-2">
            <Link href="/" className="text-2xl pl-8 font-bold">Ergonames Dashboard</Link>
            <ul className="float-right pr-8 pt-1">
                <Link href="https://www.ergonames.io" className="hover:underline">Ergonames Minting Site</Link>
            </ul>
        </div>
    )
}