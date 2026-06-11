import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

// useSearchParams() inside LoginForm requires a Suspense boundary.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
