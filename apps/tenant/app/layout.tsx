import type { Metadata } from "next";
import { headers } from "next/headers";
import { Sora, Plus_Jakarta_Sans } from "next/font/google";
import { safeUrl } from "@invoxai/utils/blocks";
import "./globals.css";
import { UtmCapture } from "./UtmCapture";
import { PageViewBeacon } from "./PageViewBeacon";
import { AnnouncementBar } from "./AnnouncementBar";
import { resolveTenantByHost } from "../lib/resolve";

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

export const metadata: Metadata = {
  title: "InvoxAI",
  description: "AI website, store, course & payment-page builder.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Per-tenant storefront announcement bar. resolveTenantByHost is React-cached,
  // so this shares the page's tenant query (no extra DB round-trip). Hidden for
  // suspended stores. The link is sanitized server-side before reaching the bar.
  const tenant = await resolveTenantByHost((await headers()).get("host"));
  const announcement =
    tenant && !tenant.suspendedAt ? (tenant.announcement?.trim() || null) : null;
  const annHref = announcement && tenant?.announcementLink ? safeUrl(tenant.announcementLink) : null;

  return (
    <html lang="en" className={`${sora.variable} ${jakarta.variable}`}>
      <body>
        <UtmCapture />
        <PageViewBeacon />
        {announcement ? <AnnouncementBar text={announcement} href={annHref} /> : null}
        {children}
      </body>
    </html>
  );
}
