"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { postMessageAction, deleteOwnMessageAction, type DiscussionState } from "./actions";

const textCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 resize-y";

/** The top-level "start a discussion" composer. Clears on a successful post. */
export function Composer({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<DiscussionState, FormData>(postMessageAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="mt-3">
      <input type="hidden" name="slug" value={slug} />
      <textarea
        name="body"
        rows={3}
        maxLength={4000}
        required
        placeholder="Share something with the community…"
        className={textCls}
      />
      {state.error ? <p className="mt-1 text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Posting…" : "Post message"}
      </button>
    </form>
  );
}

/** Per-message actions for a member: a Reply toggle (replies to top-level only)
 *  and a Delete button on the member's OWN messages. */
export function MessageActions({
  slug,
  messageId,
  canReply,
  canDelete,
}: {
  slug: string;
  messageId: string;
  canReply: boolean;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rState, rAction, rPending] = useActionState<DiscussionState, FormData>(postMessageAction, {});
  const [, dAction, dPending] = useActionState<DiscussionState, FormData>(deleteOwnMessageAction, {});
  const replyRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (rState.ok) {
      replyRef.current?.reset();
      setOpen(false);
    }
  }, [rState.ok]);

  return (
    <div className="mt-2">
      <div className="flex items-center gap-4 text-xs">
        {canReply ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="font-medium text-cyan hover:underline"
          >
            {open ? "Cancel" : "Reply"}
          </button>
        ) : null}
        {canDelete ? (
          <form action={dAction}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="messageId" value={messageId} />
            <button
              type="submit"
              disabled={dPending}
              className="text-muted hover:text-red-700 hover:underline disabled:opacity-60"
            >
              {dPending ? "Deleting…" : "Delete"}
            </button>
          </form>
        ) : null}
      </div>

      {open ? (
        <form ref={replyRef} action={rAction} className="mt-2">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="parentId" value={messageId} />
          <textarea
            name="body"
            rows={2}
            maxLength={4000}
            required
            placeholder="Write a reply…"
            className={textCls}
          />
          {rState.error ? <p className="mt-1 text-sm text-red-600">{rState.error}</p> : null}
          <button
            type="submit"
            disabled={rPending}
            className="mt-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            {rPending ? "Replying…" : "Reply"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
