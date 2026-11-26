"use client";

import { ReactNode, useEffect } from "react";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { createPortal } from "react-dom";

export function DashPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`dash ${className}`.trim()}>{children}</div>;
}

export function DashHeader({
  eyebrow,
  title,
  lead,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="dash-header">
      <div>
        {eyebrow ? <p className="dash-eyebrow">{eyebrow}</p> : null}
        <h1 className="dash-title">{title}</h1>
        {lead ? <p className="dash-lead">{lead}</p> : null}
      </div>
      {actions ? <div className="dash-actions">{actions}</div> : null}
    </header>
  );
}

export function DashPanel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`dash-panel ${className}`.trim()}>
      {title ? (
        <div className="dash-panel-head">
          <h2>{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function DashEmpty({ children }: { children: ReactNode }) {
  return <div className="dash-empty">{children}</div>;
}

export function DashStatus({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "ok" | "wait" | "bad" | "neutral";
}) {
  return <span className={`dash-status dash-status--${tone}`}>{children}</span>;
}

export function DashModal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useI18n();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="dash-modal-root" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="dash-modal-backdrop" aria-label={t("common.close")} onClick={onClose} />
      <div className={`dash-modal${wide ? " is-wide" : ""}`}>
        <div className="dash-modal-head">
          <h2>{title}</h2>
          <button type="button" className="dash-modal-close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>
        <div className="dash-modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
