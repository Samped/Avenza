"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Reconciliation folded into Payments ledger */
export default function ReconciliationRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/payments");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-mute">
      Opening Payments…
    </div>
  );
}
