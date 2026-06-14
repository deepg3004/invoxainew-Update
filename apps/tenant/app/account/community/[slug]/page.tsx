import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  getPublishedCommunityMeta,
  getMembership,
  listCommunityPosts,
  listCommunityMessages,
} from "@invoxai/db";
import { formatDateTimeShortIST } from "@invoxai/utils/date";
import { safeUrl } from "@invoxai/utils/blocks";
import { getSessionUser } from "../../../../lib/auth";
import { resolveTenantByHost } from "../../../../lib/resolve";
import { Composer, MessageActions } from "./Discussion";

export const dynamic = "force-dynamic";

export default async function CommunityMembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();

  const user = await getSessionUser();
  if (!user) redirect("/account/login");

  const { slug } = await params;
  const community = await getPublishedCommunityMeta(tenant.id, slug);
  if (!community) notFound();

  // ACCESS CONTROL: only a member (by profile or join/purchase email) sees the
  // gated content. Without a membership we never load posts or the access link.
  const membership = await getMembership({
    tenantId: tenant.id,
    communityId: community.id,
    profileId: user.id,
    email: user.email ?? null,
  });

  if (!membership) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold">{community.title}</h1>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          You’re not a member of this community yet.
          <Link href={`/m/${community.slug}`} className="ml-1 font-medium underline">
            Join →
          </Link>
        </div>
      </main>
    );
  }

  const posts = await listCommunityPosts(community.id);
  const threads = await listCommunityMessages(community.id);
  const accessHref = community.accessUrl ? safeUrl(community.accessUrl) : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/account" className="text-sm text-cyan underline">
        ← Your account
      </Link>
      <h1 className="mt-4 text-3xl font-bold">{community.title}</h1>
      {community.description ? (
        <p className="mt-2 whitespace-pre-line text-muted">{community.description}</p>
      ) : null}

      {accessHref ? (
        <a
          href={accessHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-block rounded-lg bg-brand px-4 py-2.5 font-medium text-white"
        >
          Open community link →
        </a>
      ) : null}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Announcements</h2>
      {posts.length === 0 ? (
        <p className="mt-3 text-muted">No posts yet — check back soon.</p>
      ) : (
        <div className="mt-3 space-y-5">
          {posts.map((p) => (
            <article key={p.id} className="rounded-xl border border-zinc-200 bg-surface p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-lg font-semibold text-zinc-900">{p.title}</h3>
                <span className="shrink-0 text-xs text-muted">
                  {formatDateTimeShortIST(p.createdAt)}
                </span>
              </div>
              {p.body ? (
                <p className="mt-2 whitespace-pre-line leading-relaxed text-zinc-700">{p.body}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">Discussion</h2>
      <p className="mt-1 text-xs text-muted">
        Chat with other members. Be kind — the community owner can remove messages.
      </p>
      <Composer slug={community.slug} />

      {threads.length === 0 ? (
        <p className="mt-6 text-muted">No messages yet — start the conversation above.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {threads.map((m) => (
            <article key={m.id} className="rounded-xl border border-zinc-200 bg-surface p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-zinc-900">{m.authorName}</span>
                <span className="shrink-0 text-xs text-muted">{formatDateTimeShortIST(m.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-line leading-relaxed text-zinc-700">{m.body}</p>
              <MessageActions
                slug={community.slug}
                messageId={m.id}
                canReply
                canDelete={m.buyerProfileId === user.id}
              />

              {m.replies.length > 0 ? (
                <div className="mt-3 space-y-3 border-l-2 border-zinc-100 pl-4">
                  {m.replies.map((r) => (
                    <div key={r.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-zinc-900">{r.authorName}</span>
                        <span className="shrink-0 text-xs text-muted">
                          {formatDateTimeShortIST(r.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-zinc-700">
                        {r.body}
                      </p>
                      <MessageActions
                        slug={community.slug}
                        messageId={r.id}
                        canReply={false}
                        canDelete={r.buyerProfileId === user.id}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
