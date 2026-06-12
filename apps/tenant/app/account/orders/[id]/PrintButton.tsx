"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 print:hidden"
    >
      Print
    </button>
  );
}
