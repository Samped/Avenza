"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Treasury lives under Settings → Workspace + Payments */
export default function TreasuryRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/settings?tab=workspace");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-mute">
      Opening Treasury…
    </div>
  );
}
