"use client";

import { useState } from "react";
import { submitLeadAction } from "./actions";

export interface LeadFormConfig {
  id: string;
  buttonLabel: string;
  successMessage: string | null;
  collectPhone: boolean;
  collectMessage: boolean;
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export function LeadFormView({ form }: { form: LeadFormConfig }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("sending");
    try {
      const res = await submitLeadAction({ formId: form.id, name, email, phone, message });
      if (res.ok) setStatus("done");
      else {
        setError("Couldn’t submit. Please try again.");
        setStatus("idle");
      }
    } catch {
      setError("Couldn’t submit. Please try again.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="mt-6 rounded-2xl border border-success/30 bg-success/10 px-5 py-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success text-white">
          ✓
        </div>
        <p className="mt-3 font-medium text-white">
          {form.successMessage || "Thanks — we’ll be in touch!"}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className={inputCls}
      />
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className={inputCls}
      />
      {form.collectPhone ? (
        <input
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (optional)"
          className={inputCls}
        />
      ) : null}
      {form.collectMessage ? (
        <textarea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message (optional)"
          className={inputCls}
        />
      ) : null}
      {error ? (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-xl bg-brand-gradient px-4 py-2.5 font-medium text-white shadow-glow disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : form.buttonLabel}
      </button>
    </form>
  );
}
