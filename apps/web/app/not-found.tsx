import { AuroraBackground, Button } from "@invoxai/ui";

export default function NotFound() {
  return (
    <>
      <AuroraBackground />
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-accent">404</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Page not found</h1>
        <p className="mt-2 text-muted">The page you’re looking for isn’t here.</p>
        <Button href="/" className="mt-7">
          Back to home
        </Button>
      </main>
    </>
  );
}
