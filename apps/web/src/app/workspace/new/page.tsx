"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AuthFrame } from "@/components/AuthFrame";
import { api, clearToken, getToken, setOrgId } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function NewWorkspacePage() {
  const router = useRouter();
  const { t, locale } = useI18n();
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
      <AuthFrame title={t("workspace.title")}>
        <p className="text-sm text-mute">{t("chrome.loadingWorkspace")}</p>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title={t("workspace.title")}>
      <p className="mb-6 text-sm leading-relaxed text-mute">
{t("workspace.signedInHint")}
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <p className="border border-black bg-soft px-3 py-2 text-sm text-ink">{error}</p>}
        <div>
          <label className="label">{t("workspace.legalName")}</label>
          <input
            className="input"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            required
            minLength={2}
            placeholder={t("workspace.placeholder")}
            autoFocus
          />
        </div>
        <button className="btn-dark w-full py-3" disabled={loading}>
          {loading ? t("workspace.creating") : t("workspace.submit")}
        </button>
        <p className="text-sm text-mute">
          {t("workspace.wrongAccount")}{" "}
          <button
            type="button"
            className="btn-quiet btn-sm"
            onClick={() => {
              clearToken();
              router.push("/login");
            }}
          >
            {t("chrome.signOut")}
          </button>
        </p>
      </form>
    </AuthFrame>
  );
}
