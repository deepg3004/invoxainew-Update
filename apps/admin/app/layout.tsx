import type { Metadata } from "next";
import { Sora, Plus_Jakarta_Sans } from "next/font/google";
import { getBranding } from "@invoxai/db";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  let icons: Metadata["icons"] | undefined;
  try {
    const { faviconUrl } = await getBranding();
    if (faviconUrl) icons = { icon: faviconUrl };
  } catch {
    icons = undefined;
  }
  return {
    title: "InvoxAI — Admin",
    description: "AI website, store, course & payment-page builder.",
    icons,
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sora.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
