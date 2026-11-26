"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Audit merged into Settings → Activity */
export default function AuditRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/settings?tab=activity");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-mute">
      Opening Activity…
    </div>
  );
}
