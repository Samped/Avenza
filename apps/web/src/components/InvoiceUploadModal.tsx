"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getOrgId } from "@/lib/api";
import { DashModal } from "@/components/dash";

type Supplier = { id: string; legalName: string };

export function InvoiceUploadModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (invoiceId: string) => void;
}) {
  const router = useRouter();
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr("");
    setFile(null);
    setInvoiceNumber("");
    setBusy(false);
    setDragOver(false);
    if (fileRef.current) fileRef.current.value = "";
    const orgId = getOrgId();
    if (!orgId) {
      setErr("Select a workspace first");
      return;
    }
    api<Supplier[]>(`/organizations/${orgId}/suppliers`, { orgId })
      .then((sup) => {
        setSuppliers(sup);
        setSupplierId(sup[0]?.id || "");
      })
      .catch((e) => setErr((e as Error).message));
  }, [open]);

  function pickFile(f: File | null | undefined) {
    if (!f) return;
    setFile(f);
    setErr("");
    setInvoiceNumber((prev) => {
      if (prev) return prev;
      return f.name.replace(/\.[^.]+$/, "").slice(0, 64);
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setErr("Choose an invoice file to upload");
      return;
    }
    const orgId = getOrgId();
    if (!orgId) {
      setErr("Select a workspace first");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const inv = await api<{ id: string }>(`/organizations/${orgId}/invoices`, {
        method: "POST",
        orgId,
        body: JSON.stringify({
          supplierId: supplierId || undefined,
          invoiceNumber: invoiceNumber || undefined,
          currency: "USDC",
        }),
      });
      const fd = new FormData();
      fd.append("file", file, file.name);
      await api(`/organizations/${orgId}/invoices/${inv.id}/upload`, {
        method: "POST",
        orgId,
        body: fd,
      });
      try {
        await api(`/organizations/${orgId}/invoices/${inv.id}/extract`, { method: "POST", orgId });
      } catch {
        // Extraction is assistive — upload still succeeds without it.
      }
      onCreated?.(inv.id);
      onClose();
      router.push(`/app/invoices/${inv.id}`);
    } catch (error) {
      setErr((error as Error).message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashModal open={open} onClose={onClose} title="New invoice">
      <form className="fund-modal" onSubmit={onSubmit}>
        <div>
          <label className="label" htmlFor="invoice-supplier">
            Supplier (optional)
          </label>
          <select
            id="invoice-supplier"
            className="input"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            disabled={busy}
          >
            <option value="">Assign later</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.legalName}
              </option>
            ))}
          </select>
          {suppliers.length === 0 ? (
            <p className="fund-hint">
              No suppliers yet — you can still upload, or{" "}
              <Link href="/app/suppliers" onClick={onClose}>
                register one
              </Link>
              .
            </p>
          ) : null}
        </div>

        <div>
          <label className="label" htmlFor="invoice-number">
            Invoice number (optional)
          </label>
          <input
            id="invoice-number"
            className="input"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="INV-1001"
            disabled={busy}
          />
        </div>

        <div>
          <span className="label">Invoice file</span>
          <input
            id={fileInputId}
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.json,application/pdf,image/*"
            className="sr-only"
            onChange={(e) => pickFile(e.target.files?.[0])}
            disabled={busy}
          />
          <label
            htmlFor={fileInputId}
            className={`invoice-drop${dragOver ? " is-over" : ""}${file ? " has-file" : ""}${busy ? " is-disabled" : ""}`}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!busy) pickFile(e.dataTransfer.files?.[0]);
            }}
          >
            {file ? (
              <>
                <strong>{file.name}</strong>
                <span>{(file.size / 1024).toFixed(1)} KB · click to change</span>
              </>
            ) : (
              <>
                <strong>Choose file</strong>
                <span>PDF, image, or JSON — drag & drop or browse</span>
              </>
            )}
          </label>
        </div>

        {err ? <p className="fund-err">{err}</p> : null}

        <div className="fund-deposit-row" style={{ gridTemplateColumns: "1fr auto" }}>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-dark" disabled={busy || !file}>
            {busy ? "Uploading…" : "Upload invoice"}
          </button>
        </div>
      </form>
    </DashModal>
  );
}
