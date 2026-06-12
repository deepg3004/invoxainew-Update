// Fixed, decorative aurora gradient field for the premium-dark surfaces.
// Pure CSS, pointer-events-none, sits behind all content.
export function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink"
    >
      <div className="absolute -left-32 -top-40 h-[34rem] w-[34rem] animate-float rounded-full bg-brand/30 blur-[120px]" />
      <div
        className="absolute -right-40 top-10 h-[30rem] w-[30rem] animate-float rounded-full bg-cyan/20 blur-[120px]"
        style={{ animationDelay: "2s" }}
      />
      <div
        className="absolute bottom-[-12rem] left-1/3 h-[28rem] w-[28rem] animate-float rounded-full bg-accent/20 blur-[130px]"
        style={{ animationDelay: "4s" }}
      />
    </div>
  );
}
