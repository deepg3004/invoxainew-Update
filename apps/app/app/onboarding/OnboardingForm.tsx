"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { validateUsername } from "@invoxai/utils/username";
import {
  checkUsernameAction,
  createTenantAction,
  type OnboardingState,
} from "./actions";

const ROOT = "invoxai.io";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-lg bg-brand px-3 py-2 font-medium text-white disabled:opacity-50"
    >
      {pending ? "Creating your site…" : "Create my site"}
    </button>
  );
}

export function OnboardingForm() {
  const [state, formAction] = useActionState<OnboardingState, FormData>(
    createTenantAction,
    {},
  );

  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<{
    available: boolean;
    message: string;
  } | null>(null);

  // Debounced availability check. Client-side syntax check first to avoid
  // pointless server round-trips for obviously invalid input.
  useEffect(() => {
    const v = validateUsername(username);
    if (!v.ok) {
      setStatus(username ? { available: false, message: v.message } : null);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      const res = await checkUsernameAction(username);
      if (alive) setStatus(res);
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [username]);

  const blockSubmit = status !== null && !status.available;

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label className="text-sm font-medium">Your site name (optional)</label>
        <input
          name="name"
          placeholder="Deep's Store"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Choose your username</label>
        <div className="mt-1 flex items-center rounded-lg border border-zinc-300 bg-white focus-within:border-brand">
          <input
            name="username"
            required
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="deep"
            className="w-full rounded-l-lg bg-transparent px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none"
          />
          <span className="px-3 text-sm text-muted">.{ROOT}</span>
        </div>
        {status ? (
          <p
            className={
              "mt-1 text-sm " +
              (status.available ? "text-green-600" : "text-red-600")
            }
          >
            {status.message}
          </p>
        ) : null}
      </div>

      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <SubmitButton disabled={blockSubmit} />
    </form>
  );
}
