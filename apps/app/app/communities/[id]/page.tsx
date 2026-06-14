import { notFound } from "next/navigation";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { formatDateTimeShortIST } from "@invoxai/utils/date";
import { getCommunityById, listCommunityPosts, listCommunityMessages } from "@invoxai/db";
import { requireTenant } from "../../../lib/tenant";
import { CommunityForm } from "../CommunityForm";
import { PostForm } from "../PostForm";
import {
  updateCommunityAction,
  createPostAction,
  deletePostAction,
  hideMessageAction,
  showMessageAction,
  deleteMessageAction,
} from "../actions";

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
  const threads = await listCommunityMessages(community.id, { includeHidden: true });

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

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">Member discussion</h2>
        <p className="mt-1 text-sm text-muted">
          Messages members post to each other. Hide removes a message from the members view (reversible);
          Delete removes it for good. Replies are shown indented.
        </p>
        {threads.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No member messages yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-surface">
            {threads.flatMap((m) => [m, ...m.replies.map((r) => ({ ...r, isReply: true as const }))]).map(
              (msg) => {
                const isReply = "isReply" in msg && msg.isReply;
                const hidden = msg.status === "HIDDEN";
                return (
                  <li
                    key={msg.id}
                    className={`flex items-start gap-3 p-3 ${isReply ? "pl-8" : ""} ${
                      hidden ? "opacity-60" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-zinc-900">{msg.authorName}</span>
                        {isReply ? <span className="text-xs text-muted">· reply</span> : null}
                        {hidden ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                            Hidden
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block whitespace-pre-line text-sm text-zinc-700">
                        {msg.body}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {formatDateTimeShortIST(msg.createdAt)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <form
                        action={(hidden ? showMessageAction : hideMessageAction).bind(
                          null,
                          community.id,
                          msg.id,
                        )}
                      >
                        <button className="text-sm text-muted underline hover:text-zinc-900">
                          {hidden ? "Show" : "Hide"}
                        </button>
                      </form>
                      <form action={deleteMessageAction.bind(null, community.id, msg.id)}>
                        <button className="text-sm text-muted underline hover:text-red-700">Delete</button>
                      </form>
                    </div>
                  </li>
                );
              },
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
