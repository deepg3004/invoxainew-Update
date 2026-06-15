"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { addSlotsAction, deleteSlotAction } from "./actions";

export interface SlotView {
  id: string;
  startsAt: string; // ISO
  status: string; // OPEN | BOOKED
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function SlotManager({ bookingTypeId, slots }: { bookingTypeId: string; slots: SlotView[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function add() {
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      // datetime-local has no timezone; treat it as local and send an ISO string.
      const iso = new Date(value).toISOString();
      const res = await addSlotsAction(bookingTypeId, [iso]);
      if (res.ok) {
        setValue("");
        router.refresh();
      } else setError(res.error);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setPendingId(id);
    try {
      await deleteSlotAction(bookingTypeId, id);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Add a time slot</span>
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand"
          />
        </label>
        <button
          type="button"
          onClick={add}
          disabled={busy || !value}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add slot"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      {slots.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No slots yet. Add the times you’re available above.</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-surface">
          {slots.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span className="text-zinc-800">{fmt(s.startsAt)}</span>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.status === "BOOKED" ? "bg-green-50 text-green-700" : "bg-zinc-100 text-muted"
                  }`}
                >
                  {s.status === "BOOKED" ? "Booked" : "Open"}
                </span>
                {s.status === "OPEN" ? (
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    disabled={pendingId === s.id}
                    className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                    aria-label="Delete slot"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
