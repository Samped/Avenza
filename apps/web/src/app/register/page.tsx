"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthFrame } from "@/components/AuthFrame";
import { api, setToken } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const auth = await api<{ accessToken: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, fullName }),
      });
      setToken(auth.accessToken);
      router.push("/workspace/new");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame title={t("auth.registerTitle")}>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <p className="border border-black bg-soft px-3 py-2 text-sm text-ink">{error}</p>}
        <div>
          <label className="label">{t("auth.fullName")}</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div>
          <label className="label">{t("auth.workEmail")}</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
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
            minLength={10}
            autoComplete="new-password"
          />
        </div>
        <button className="btn-dark w-full py-3" disabled={loading}>
          {loading ? t("auth.creating") : t("chrome.getStarted")}
        </button>
        <p className="text-sm text-mute">
          {t("auth.haveAccount")}{" "}
          <Link className="text-ink hover:underline" href="/login">
            {t("auth.signInLink")}
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}
