"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Team merged into Settings → People */
export default function TeamRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/settings?tab=people");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-mute">
      Opening People…
    </div>
  );
}
