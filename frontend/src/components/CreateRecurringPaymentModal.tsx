import React, { useState, useEffect, useRef, type RefObject } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import { formatInterval } from "../lib/soroban";

type Props = {
  walletAddress: string | null;
  onClose: () => void;
  onSubmitted?: () => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
};

type Step = "form" | "preview";

function truncateAddress(address: string | null) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function CreateRecurringPaymentModal({
  walletAddress,
  onClose,
  onSubmitted,
  triggerRef,
}: Props) {
  const [step, setStep] = useState<Step>("form");
  const [recipient, setRecipient] = useState("");
  const [recipientTouched, setRecipientTouched] = useState(false);
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("XLM");
  const [intervalDays, setIntervalDays] = useState("30");
  const [cliffDate, setCliffDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cap, setCap] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const firstInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const currentTrigger = triggerRef?.current;
    if (firstInputRef.current) {
      firstInputRef.current.focus();
    }
    return () => {
      if (currentTrigger && typeof currentTrigger.focus === "function") {
        currentTrigger.focus();
      } else if (
        previousActiveElement &&
        typeof previousActiveElement.focus === "function"
      ) {
        previousActiveElement.focus();
      }
    };
  }, [triggerRef]);

  // Focus trap & escape key handler
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const FOCUSABLE_SELECTORS =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      ).filter((el) => !el.closest('[aria-hidden="true"]'));

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    modal.addEventListener("keydown", handleKeyDown);
    return () => modal.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function validate(): boolean {
    setError(null);

    if (!walletAddress) {
      setError("Connect your wallet first.");
      return false;
    }

    if (!recipient.trim()) {
      setError("Recipient address is required.");
      return false;
    }

    if (!StrKey.isValidEd25519PublicKey(recipient.trim())) {
      setError("Enter a valid Stellar address.");
      return false;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Enter a valid amount.");
      return false;
    }

    const intervalNum = parseInt(intervalDays, 10);
    if (isNaN(intervalNum) || intervalNum < 1 || intervalNum > 365) {
      setError("Interval must be between 1 and 365 days.");
      return false;
    }

    if (cliffDate && endDate) {
      const cliffMs = new Date(cliffDate).getTime();
      const endMs = new Date(endDate).getTime();
      if (cliffMs > endMs) {
        setError("Cliff date cannot be after end date.");
        return false;
      }
    }

    if (cap.trim()) {
      const capNum = parseFloat(cap);
      if (isNaN(capNum) || capNum < amountNum) {
        setError("Total cap cannot be less than payment amount.");
        return false;
      }
    }

    return true;
  }

  function handleReview() {
    if (!validate()) return;
    setStep("preview");
  }

  async function handleConfirmSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (onSubmitted) onSubmitted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  const intervalSeconds = (parseInt(intervalDays, 10) || 0) * 86400;
  const cadenceFormatted =
    intervalSeconds > 0 ? formatInterval(intervalSeconds) : "—";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-5"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 id="modal-title" className="text-lg font-semibold text-white">
            {step === "form"
              ? "Create Recurring Payment"
              : "Preview Recurring Schedule"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-zinc-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400"
          >
            {error}
          </div>
        )}

        {step === "form" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Proposer</label>
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm font-mono text-zinc-300">
                {truncateAddress(walletAddress)}
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                Recipient Address
              </label>
              <input
                ref={firstInputRef}
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value);
                  setRecipientTouched(true);
                }}
                onBlur={() => setRecipientTouched(true)}
                placeholder="G..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder-zinc-600 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
              />
              {recipientTouched &&
                recipient.trim() &&
                !StrKey.isValidEd25519PublicKey(recipient.trim()) && (
                  <p className="text-xs text-red-400 mt-1">
                    Enter a valid Stellar address.
                  </p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Amount</label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  min="0"
                  step="any"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-600 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Token</label>
                <select
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-zinc-400 focus:outline-none"
                >
                  <option value="XLM">XLM</option>
                  <option value="USDC">USDC</option>
                  <option value="EURC">EURC</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                Interval (Days)
              </label>
              <input
                value={intervalDays}
                onChange={(e) => setIntervalDays(e.target.value)}
                placeholder="30"
                type="number"
                min="1"
                max="365"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-600 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Cliff Date (Optional)
                </label>
                <input
                  type="date"
                  value={cliffDate}
                  onChange={(e) => setCliffDate(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-zinc-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-zinc-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                Total Cap (Optional)
              </label>
              <input
                value={cap}
                onChange={(e) => setCap(e.target.value)}
                placeholder="Maximum total payout"
                type="number"
                min="0"
                step="any"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-600 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What is this recurring payment for?"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-600 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
              />
            </div>

            {/* Live preview section within the form when valid */}
            {recipient && amount && (
              <div
                aria-label="Schedule Preview"
                className="rounded-xl border border-zinc-800 bg-zinc-800/40 p-4 space-y-2"
              >
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Live Schedule Preview
                </h3>
                <div className="text-sm text-zinc-200">
                  <span className="font-semibold text-white">
                    {amount} {token}
                  </span>{" "}
                  disbursed <span className="text-emerald-400">{cadenceFormatted}</span> to{" "}
                  <span className="font-mono text-zinc-300">
                    {truncateAddress(recipient)}
                  </span>
                </div>
                {cap && (
                  <div className="text-xs text-zinc-400">
                    Total Cap: <span className="font-mono text-zinc-200">{cap} {token}</span>
                  </div>
                )}
                {(cliffDate || endDate) && (
                  <div className="text-xs text-zinc-400">
                    {cliffDate && <span>Cliff: {cliffDate} </span>}
                    {endDate && <span>End: {endDate}</span>}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 rounded-lg font-medium transition-colors focus:ring-2 focus:ring-zinc-400 focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReview}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg font-medium transition-colors focus:ring-2 focus:ring-zinc-400 focus:outline-none"
              >
                Review Schedule
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-800/50 p-4 space-y-3">
              <div>
                <span className="text-xs text-zinc-500 block">Recipient</span>
                <span className="text-sm font-mono text-white break-all">
                  {recipient}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-zinc-500 block">Amount</span>
                  <span className="text-sm font-semibold text-white">
                    {amount} {token}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 block">Cadence</span>
                  <span className="text-sm text-zinc-300">{cadenceFormatted}</span>
                </div>
              </div>
              {cap && (
                <div>
                  <span className="text-xs text-zinc-500 block">Total Cap</span>
                  <span className="text-sm font-mono text-zinc-300">
                    {cap} {token}
                  </span>
                </div>
              )}
              {cliffDate && (
                <div>
                  <span className="text-xs text-zinc-500 block">Cliff Date</span>
                  <span className="text-sm text-zinc-300">{cliffDate}</span>
                </div>
              )}
              {endDate && (
                <div>
                  <span className="text-xs text-zinc-500 block">End Date</span>
                  <span className="text-sm text-zinc-300">{endDate}</span>
                </div>
              )}
              {description && (
                <div>
                  <span className="text-xs text-zinc-500 block">Description</span>
                  <span className="text-sm text-zinc-300">{description}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep("form")}
                disabled={submitting}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 rounded-lg font-medium transition-colors focus:ring-2 focus:ring-zinc-400 focus:outline-none"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={submitting || !walletAddress}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition-colors focus:ring-2 focus:ring-zinc-400 focus:outline-none"
              >
                {submitting ? "Submitting…" : "Confirm & Create"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
