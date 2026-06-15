import { Button, GlassCard, PageHeader } from "@invoxai/ui";
import { listBuilderTemplates } from "@invoxai/db";
import { THEME_PRESETS, type ThemePreset } from "@invoxai/utils/blocks";
import { requireAdmin } from "../../lib/auth";
import { AdminShell } from "../components/AdminShell";
import { NotAuthorized } from "../components/NotAuthorized";
import { createTemplateAction, updateTemplateAction, deleteTemplateAction } from "./actions";

export const dynamic = "force-dynamic";

const input = "rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand";
const PRESETS = Object.keys(THEME_PRESETS) as ThemePreset[];

const STARTER_CONTENT = JSON.stringify(
  {
    title: "Your headline here",
    theme: { preset: "light", accent: "#6366F1" },
    blocks: [
      { type: "heading", text: "Your headline here", level: 1 },
      { type: "text", text: "A short, benefit-led paragraph for the seller to edit." },
      { type: "button", label: "Get started", href: "/store" },
    ],
  },
  null,
  2,
);

function PresetSelect({ name, value }: { name: string; value?: string }) {
  return (
    <select name={name} defaultValue={value ?? "light"} className={`${input} w-28`}>
      {PRESETS.map((p) => (
        <option key={p} value={p}>{p}</option>
      ))}
    </select>
  );
}

export default async function TemplatesPage() {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const templates = await listBuilderTemplates();

  return (
    <AdminShell email={gate.user.email}>
      <PageHeader
        eyebrow="InvoxAI · admin"
        title="Builder templates"
        description="Author starter templates sellers can apply to a new page. Premium templates are billed via the “builder_template” feature rule (set its price under Feature billing). Content is block JSON, re-validated on save and on apply."
      />

      <GlassCard title={`Templates (${templates.length})`}>
        <div className="space-y-4">
          {templates.map((t) => (
            <form
              key={t.id}
              action={updateTemplateAction.bind(null, t.id)}
              className="space-y-2 rounded-xl border border-zinc-200 bg-surface p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <input name="name" defaultValue={t.name} className={`${input} w-48`} />
                <input name="category" defaultValue={t.category} className={`${input} w-28`} placeholder="category" />
                <PresetSelect name="themePreset" value={t.themePreset} />
                <label className="flex items-center gap-1">sort<input name="sortOrder" defaultValue={t.sortOrder} className={`${input} w-14`} /></label>
                <label className="flex items-center gap-1"><input type="checkbox" name="isPremium" defaultChecked={t.isPremium} /> premium</label>
                <label className="flex items-center gap-1"><input type="checkbox" name="isPublished" defaultChecked={t.isPublished} /> published</label>
              </div>
              <input name="description" defaultValue={t.description} className={`${input} w-full`} placeholder="Short description" />
              <textarea
                name="content"
                defaultValue={JSON.stringify(t.content, null, 2)}
                rows={6}
                className={`${input} w-full font-mono text-xs`}
              />
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm">Save</Button>
                <Button type="submit" variant="secondary" size="sm" formAction={deleteTemplateAction.bind(null, t.id)}>
                  Delete
                </Button>
              </div>
            </form>
          ))}

          {/* New template */}
          <form action={createTemplateAction} className="space-y-2 rounded-xl border border-dashed border-zinc-300 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <input name="name" placeholder="Template name" className={`${input} w-48`} />
              <input name="category" placeholder="category" defaultValue="landing" className={`${input} w-28`} />
              <PresetSelect name="themePreset" />
              <label className="flex items-center gap-1">sort<input name="sortOrder" defaultValue="0" className={`${input} w-14`} /></label>
              <label className="flex items-center gap-1"><input type="checkbox" name="isPremium" /> premium</label>
              <label className="flex items-center gap-1"><input type="checkbox" name="isPublished" defaultChecked /> published</label>
            </div>
            <input name="description" placeholder="Short description" className={`${input} w-full`} />
            <textarea name="content" defaultValue={STARTER_CONTENT} rows={8} className={`${input} w-full font-mono text-xs`} />
            <Button type="submit" variant="secondary" size="sm">Add template</Button>
          </form>
        </div>
      </GlassCard>
    </AdminShell>
  );
}
