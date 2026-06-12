import type { Metadata } from "next";
import { Sora, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Shell, type Chrome } from "./components/Shell";
import { getSessionUser } from "../lib/auth";
import { getTenantByOwnerId, getWalletByTenant, countUnreadNotifications } from "@invoxai/db";
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

export const metadata: Metadata = {
  title: "InvoxAI — Dashboard",
  description: "AI website, store, course & payment-page builder.",
};

// Best-effort header data for the dashboard chrome (null on login/onboarding or
// any failure — must never break the layout that wraps every page).
async function loadChrome(): Promise<Chrome> {
  try {
    const user = await getSessionUser();
    if (!user) return null;
    const tenant = await getTenantByOwnerId(user.id);
    if (!tenant) return null;
    const [wallet, unread] = await Promise.all([
      getWalletByTenant(tenant.id),
      countUnreadNotifications(tenant.id),
    ]);
    return {
      name: tenant.name ?? tenant.username,
      email: user.email ?? null,
      walletLabel: formatRupees(wallet?.balancePaise ?? 0),
      unread,
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
