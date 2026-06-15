import Link from "next/link";
import { Button, GlassCard, PageHeader } from "@invoxai/ui";
import { requireTenant } from "../../../lib/tenant";
import { createLeadFormAction } from "../actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  title: "Please give your form a title.",
  slug: "Couldn’t generate a unique link — try a different title.",
};

export default async function NewFormPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireTenant();
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/forms" className="text-sm text-brand-strong underline">
        ← Lead forms
      </Link>
      <PageHeader title="New lead form" />

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {ERRORS[error] ?? "Something went wrong."}
        </p>
      ) : null}

      <GlassCard className="mt-6">
      <form action={createLeadFormAction} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Title</label>
          <input
            name="title"
            required
            placeholder="Get in touch"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Description (optional)</label>
          <textarea
            name="description"
            rows={3}
            placeholder="Tell buyers what this form is for."
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Button label</label>
            <input
              name="buttonLabel"
              defaultValue="Submit"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Success message (optional)</label>
            <input
              name="successMessage"
              placeholder="Thanks — we’ll be in touch!"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
            />
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-zinc-100 bg-surface p-4">
          <p className="text-sm font-medium">Fields to collect</p>
          <p className="text-xs text-muted">Name and email are always collected.</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="collectPhone" defaultChecked /> Phone
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="collectMessage" defaultChecked /> Message
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="notifyOnSubmit" defaultChecked /> Notify me on each submission
        </label>

        <div>
          <label className="text-sm font-medium">Redirect after submit (optional)</label>
          <input
            name="redirectUrl"
            placeholder="https://… or /thank-you"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
          />
          <p className="mt-1 text-xs text-muted">Sends the visitor here after submitting, instead of showing the success message.</p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="publish" /> Publish now (make the form live)
        </label>

        <Button type="submit" className="w-full">
          Create form
        </Button>
      </form>
      </GlassCard>
    </div>
  );
}
