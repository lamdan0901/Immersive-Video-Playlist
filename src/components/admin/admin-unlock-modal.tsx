"use client";

import { useState } from "react";
import { validateAdminSecret } from "@/actions/admin";

type AdminUnlockModalProps = {
  open: boolean;
  onClose: () => void;
  onUnlocked?: () => void;
};

export function AdminUnlockModal({ open, onClose, onUnlocked }: AdminUnlockModalProps) {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const result = await validateAdminSecret(secret);

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    localStorage.setItem("adminSecret", secret);
    setSecret("");
    setSubmitting(false);
    onUnlocked?.();
    onClose();
  }

  function handleClose() {
    setSecret("");
    setError("");
    setSubmitting(false);
    onClose();
  }

  return (
    <div className="admin-unlock-modal" role="dialog" aria-modal="true" aria-labelledby="admin-unlock-title">
      <div className="admin-unlock-backdrop" onClick={handleClose} />
      <div className="admin-unlock-panel">
        <div className="admin-unlock-header">
          <h2 id="admin-unlock-title">Admin unlock</h2>
          <button type="button" className="admin-unlock-close" onClick={handleClose} aria-label="Close admin unlock">
            Close
          </button>
        </div>
        <form className="admin-unlock-form" onSubmit={handleSubmit}>
          <label className="admin-unlock-field">
            <span>Shared secret</span>
            <input
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="Enter admin secret"
              autoFocus
            />
          </label>
          {error ? <p className="admin-unlock-error">{error}</p> : null}
          <div className="admin-unlock-actions">
            <button type="button" className="ghost-button" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="accent-button" disabled={submitting || !secret.trim()}>
              {submitting ? "Unlocking..." : "Unlock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
