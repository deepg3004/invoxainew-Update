"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 print:hidden"
    >
      Print
    </button>
  );
}
