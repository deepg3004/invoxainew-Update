import type { Metadata } from "next";
import { Sora, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Shell, type Chrome } from "./components/Shell";
import { getSessionUser } from "../lib/auth";
import {
  getTenantByOwnerId,
  getWalletByTenant,
  countUnreadNotifications,
  getBranding,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";

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
    title: "InvoxAI — Dashboard",
    description: "AI website, store, course & payment-page builder.",
    icons,
  };
}

// Best-effort header data for the dashboard chrome (null on login/onboarding or
// any failure — must never break the layout that wraps every page).
async function loadChrome(): Promise<Chrome> {
  try {
    const user = await getSessionUser();
    if (!user) return null;
    const tenant = await getTenantByOwnerId(user.id);
    if (!tenant) return null;
    const [wallet, unread, branding] = await Promise.all([
      getWalletByTenant(tenant.id),
      countUnreadNotifications(tenant.id),
      getBranding(),
    ]);
    return {
      name: tenant.name ?? tenant.username,
      email: user.email ?? null,
      walletLabel: formatRupees(wallet?.balancePaise ?? 0),
      unread,
      logoUrl: branding.logoUrl,
    };
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const chrome = await loadChrome();
  return (
    <html lang="en" className={`${sora.variable} ${jakarta.variable}`}>
      <body>
        <Shell chrome={chrome}>{children}</Shell>
      </body>
    </html>
  );
}
