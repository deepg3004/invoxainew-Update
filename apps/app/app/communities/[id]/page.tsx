import { notFound } from "next/navigation";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { formatDateTimeShortIST } from "@invoxai/utils/date";
import { getCommunityById, listCommunityPosts } from "@invoxai/db";
import { requireTenant } from "../../../lib/tenant";
import { CommunityForm } from "../CommunityForm";
import { PostForm } from "../PostForm";
import { updateCommunityAction, createPostAction, deletePostAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditCommunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant } = await requireTenant();
  const { id } = await params;
  const community = await getCommunityById(tenant.id, id);
  if (!community) notFound();
  const posts = await listCommunityPosts(community.id);

  const communityAction = updateCommunityAction.bind(null, community.id);
  const addPostAction = createPostAction.bind(null, community.id);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="InvoxAI · communities" title="Edit community" description={community.title} />

      <GlassCard>
        <CommunityForm
          action={communityAction}
          submitLabel="Save community"
          initial={{
            slug: community.slug,
            title: community.title,
            description: community.description,
            pricePaise: community.pricePaise,
            compareAtPaise: community.compareAtPaise,
            imageUrl: community.imageUrl,
            accessUrl: community.accessUrl,
            sortOrder: community.sortOrder,
          }}
        />
      </GlassCard>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">Announcements</h2>
        {posts.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No posts yet. Share the first below.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-surface">
            {posts.map((p) => (
              <li key={p.id} className="flex items-start gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-zinc-900">{p.title}</span>
                  <span className="block text-xs text-muted">{formatDateTimeShortIST(p.createdAt)}</span>
                </div>
                <form action={deletePostAction.bind(null, community.id, p.id)}>
                  <button className="text-sm text-muted underline hover:text-red-700">Delete</button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <GlassCard className="mt-5" title="Post an announcement">
          <PostForm action={addPostAction} />
        </GlassCard>
      </section>
    </div>
  );
}
