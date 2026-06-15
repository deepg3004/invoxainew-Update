// Test stub for the `server-only` package. The real module throws when imported
// outside a React Server Component, which breaks unit tests that import
// server-only lib modules (e.g. the payment-signature verifier). Vitest aliases
// `server-only` to this no-op so those pure functions can be unit-tested.
export {};
