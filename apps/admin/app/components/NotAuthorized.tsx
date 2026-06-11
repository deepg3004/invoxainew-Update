/**
 * Shown to a signed-in user whose email is NOT on the ADMIN_EMAILS allowlist.
 * We don't bounce them to /login (they're already authenticated — that would
 * loop); we tell them plainly and offer a sign-out to switch accounts.
 */
export function NotAuthorized({ email }: { email: string | null | undefined }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">Not authorized</h1>
      <p className="mt-2 text-neutral-500">
        {email ? <strong>{email}</strong> : "This account"} is not a platform
        admin. If this is a mistake, ask an existing admin to add you to the
        allowlist.
      </p>
      <form action="/auth/signout" method="post" className="mt-6">
        <button className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
          Sign out
        </button>
      </form>
    </main>
  );
}
