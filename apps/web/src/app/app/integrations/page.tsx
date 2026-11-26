"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Integrations merged into Settings */
export default function IntegrationsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/settings?tab=integrations");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-mute">
      Opening Integrations…
    </div>
  );
}
