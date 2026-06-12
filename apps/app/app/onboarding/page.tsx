import { redirect } from "next/navigation";
import { getTenantByOwnerId } from "@invoxai/db";
import { getSessionUser } from "../../lib/auth";
import { OnboardingForm } from "./OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Already onboarded → straight to the dashboard.
  const tenant = await getTenantByOwnerId(user.id);
  if (tenant) redirect("/");

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-sm font-medium uppercase tracking-wide text-muted">
        InvoxAI · onboarding
      </p>
      <h1 className="mt-1 text-2xl font-bold">Claim your address</h1>
      <p className="mt-2 text-muted">
        This is where your site will live. You can add a custom domain later.
      </p>
      <OnboardingForm />
    </div>
  );
}
