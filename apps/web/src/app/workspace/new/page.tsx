"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AuthFrame } from "@/components/AuthFrame";
import { api, clearToken, getToken, setOrgId } from "@/lib/api";

export default function NewWorkspacePage() {
  const router = useRouter();
  const [legalName, setLegalName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api<{ organizations: Array<{ id: string }> }>("/auth/me")
      .then((me) => {
        if (me.organizations[0]) {
          setOrgId(me.organizations[0].id);
          router.replace("/app");
          return;
        }
        setReady(true);
      })
      .catch(() => {
        clearToken();
        router.replace("/login");
      });
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const org = await api<{ id: string }>("/organizations", {
        method: "POST",
        body: JSON.stringify({ legalName }),
      });
      setOrgId(org.id);
      router.push("/app");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <AuthFrame title="Create workspace">
        <p className="text-sm text-mute">Checking your session…</p>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Create workspace">
      <p className="mb-6 text-sm leading-relaxed text-mute">
        You&apos;re signed in. Name the organization you want to operate in AVENZA.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <p className="border border-black bg-soft px-3 py-2 text-sm text-ink">{error}</p>}
        <div>
          <label className="label">Organization legal name</label>
          <input
            className="input"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            required
            minLength={2}
            placeholder="Acme Holdings Ltd"
            autoFocus
          />
        </div>
        <button className="btn-dark w-full py-3" disabled={loading}>
          {loading ? "Creating workspace…" : "Create workspace"}
        </button>
        <p className="text-sm text-mute">
          Wrong account?{" "}
          <button
            type="button"
            className="btn-quiet btn-sm"
            onClick={() => {
              clearToken();
              router.push("/login");
            }}
          >
            Sign out
          </button>
        </p>
      </form>
    </AuthFrame>
  );
}
