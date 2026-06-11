import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default function BuyerLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
