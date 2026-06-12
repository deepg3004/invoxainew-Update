"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5 print:hidden"
    >
      Print
    </button>
  );
}
