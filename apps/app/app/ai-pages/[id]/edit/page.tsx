import { notFound } from "next/navigation";
import { getAiPageForOwner, listAiPageVersions } from "@invoxai/db";
import { normalizeToBlocks } from "@invoxai/utils/blocks";
import { requireTenant } from "../../../../lib/tenant";
import { PageEditor } from "./PageEditor";
import { VersionHistory } from "./VersionHistory";

export const dynamic = "force-dynamic";

function buyerBase(username: string): string {
  return process.env.NODE_ENV === "development"
    ? `http://${username}.localhost:3003`
    : `https://${username}.invoxai.io`;
}

export default async function EditAiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant } = await requireTenant();
  const { id } = await params;
  const page = await getAiPageForOwner(tenant.id, id);
  if (!page) notFound();

  const content = normalizeToBlocks(page.content);
  const liveUrl = `${buyerBase(tenant.username)}/${page.slug}`;
  const versions = await listAiPageVersions(tenant.id, page.id);

  return (
    <>
      {/* key by updatedAt so a Restore (which redirects back) remounts the editor
          with the restored content instead of keeping stale local state. */}
      <PageEditor
        key={page.updatedAt.getTime()}
        pageId={page.id}
        slug={page.slug}
        liveUrl={liveUrl}
        initialTitle={content.title}
        initialBlocks={content.blocks}
        initialTheme={content.theme}
      />
      <VersionHistory pageId={page.id} versions={versions} />
    </>
  );
}
