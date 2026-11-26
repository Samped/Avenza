"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthFrame } from "@/components/AuthFrame";
import { api, setOrgId, setToken } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api<{ accessToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(res.accessToken);
      const me = await api<{
        organizations: Array<{ id: string }>;
      }>("/auth/me");
      if (me.organizations[0]) {
        setOrgId(me.organizations[0].id);
        router.push("/app");
      } else {
        router.push("/workspace/new");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame title={t("auth.signInTitle")}>
      <form onSubmit={onSubmit} className="space-y-5">
        {error && <p className="border border-black bg-soft px-3 py-2 text-sm text-ink">{error}</p>}
        <div>
          <label className="label">{t("auth.workEmail")}</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label">{t("auth.password")}</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <button className="btn-dark w-full py-3" disabled={loading}>
          {loading ? t("auth.signingIn") : t("chrome.signIn")}
        </button>
        <p className="text-sm text-mute">
          {t("auth.noAccount")}{" "}
          <Link className="text-ink hover:underline" href="/register">
            {t("auth.createLink")}
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}
