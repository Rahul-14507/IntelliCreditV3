import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IntelliCredit v3 — AI Credit Analytics Platform",
  description: "Transform raw financial documents into comprehensive AI-backed credit assessment reports for IIT Hyderabad Hackathon Round 2.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0A0F1E] text-white min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
