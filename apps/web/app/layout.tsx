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

// Re-read admin branding at most every 10 min so the marketing site stays
// cache-fast (favicon/logo rarely change). Best-effort — never break metadata.
export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  let icons: Metadata["icons"] | undefined;
  try {
    const { faviconUrl } = await getBranding();
    if (faviconUrl) icons = { icon: faviconUrl };
  } catch {
    icons = undefined;
  }
  return {
    title: "InvoxAI — AI website, store & payment builder",
    description:
      "Build an AI-powered website, store, course and payment page where buyers pay straight into your own gateway. InvoxAI never holds your sales money.",
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
