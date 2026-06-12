import Link from "next/link";
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
      <Link href="/forms" className="text-sm text-cyan underline">
        ← Lead forms
      </Link>
      <h1 className="mt-3 text-3xl font-bold">New lead form</h1>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {ERRORS[error] ?? "Something went wrong."}
        </p>
      ) : null}

      <form action={createLeadFormAction} className="mt-6 space-y-4">
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

        <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4">
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
          <input type="checkbox" name="publish" /> Publish now (make the form live)
        </label>

        <button className="w-full rounded-xl bg-brand-gradient px-4 py-2.5 font-medium text-white shadow-glow">
          Create form
        </button>
      </form>
    </div>
  );
}
