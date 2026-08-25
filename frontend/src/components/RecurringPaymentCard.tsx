import React from "react";
import type { RecurringSchedule, RecurringScheduleStatus } from "../types/accord";
import { formatInterval, shortenAddr } from "../lib/soroban";
import { useRecurringPayments } from "../hooks/useRecurringPayments";

export type RecurringPaymentCardProps = {
  schedule: RecurringSchedule;
  walletAddress?: string | null;
  isDue?: boolean;
  onDisburse?: (id: number) => void;
  onPause?: (id: number) => void;
  onResume?: (id: number) => void;
  onCancel?: (id: number) => void;
};

const STATUS_BADGES: Record<
  RecurringScheduleStatus,
  { label: string; style: string }
> = {
  active: {
    label: "Active",
    style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  paused: {
    label: "Paused",
    style: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  completed: {
    label: "Completed",
    style: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  },
  cancelled: {
    label: "Cancelled",
    style: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  },
};

export const RecurringPaymentCard = React.memo(function RecurringPaymentCard({
  schedule,
  walletAddress,
  isDue,
  onDisburse,
  onPause,
  onResume,
  onCancel,
}: RecurringPaymentCardProps) {
  const { disburse, pause, resume, cancel } = useRecurringPayments();
  const connected = !!walletAddress;

  const due =
    isDue !== undefined
      ? isDue
      : schedule.nextDisbursementTs !== undefined
      ? Date.now() >= schedule.nextDisbursementTs
      : true;

  const handleDisburse = () => {
    if (onDisburse) {
      onDisburse(schedule.id);
    } else {
      disburse(schedule.id);
    }
  };

  const handlePause = () => {
    if (onPause) {
      onPause(schedule.id);
    } else {
      pause(schedule.id);
    }
  };

  const handleResume = () => {
    if (onResume) {
      onResume(schedule.id);
    } else {
      resume(schedule.id);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel(schedule.id);
    } else {
      cancel(schedule.id);
    }
  };

  const badge = STATUS_BADGES[schedule.status] || {
    label: schedule.status,
    style: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };

  const cadenceText =
    schedule.cadence ??
    (schedule.interval !== undefined ? formatInterval(schedule.interval) : "—");

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-zinc-500">
              Schedule #{schedule.id}
            </span>
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium uppercase tracking-wider ${badge.style}`}
            >
              {badge.label}
            </span>
          </div>
          <h3 className="text-base font-semibold text-white">
            {schedule.amount} {schedule.token ? schedule.token : ""}
          </h3>
          <p className="font-mono text-sm text-zinc-400 mt-0.5">
            Recipient: {shortenAddr(schedule.recipient)}
          </p>
        </div>

        <div className="text-right text-xs text-zinc-500 space-y-1">
          <div>
            Cadence: <span className="text-zinc-300">{cadenceText}</span>
          </div>
          <div>
            Total Disbursed:{" "}
            <span className="text-zinc-300">{schedule.totalDisbursed}</span>
          </div>
          {schedule.cap && (
            <div>
              Cap: <span className="text-zinc-300">{schedule.cap}</span>
            </div>
          )}
        </div>
      </div>

      {schedule.description && (
        <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
          {schedule.description}
        </p>
      )}

      {/* Action buttons based on status */}
      <div className="flex items-center justify-between border-t border-zinc-800/60 pt-3 mt-3">
        <div className="text-xs text-zinc-500">
          {schedule.status === "active" &&
            (due ? (
              <span className="text-emerald-400">Payment is due</span>
            ) : (
              <span className="text-zinc-400">Next payment pending</span>
            ))}
        </div>

        <div className="flex items-center gap-2">
          {schedule.status === "active" && (
            <>
              <div title={due ? undefined : "Next disbursement not yet due"}>
                <button
                  type="button"
                  onClick={handleDisburse}
                  disabled={!due}
                  aria-label={
                    due ? "Disburse now" : "Next disbursement not yet due"
                  }
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                >
                  Disburse now
                </button>
              </div>

              {connected && (
                <>
                  <button
                    type="button"
                    onClick={handlePause}
                    aria-label="Pause schedule"
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-yellow-400 hover:bg-zinc-700 hover:text-yellow-300 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  >
                    Pause
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    aria-label="Cancel schedule"
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-zinc-700 hover:text-rose-300 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  >
                    Cancel
                  </button>
                </>
              )}
            </>
          )}

          {schedule.status === "paused" && (
            <>
              <button
                type="button"
                onClick={handleResume}
                aria-label="Resume schedule"
                className="rounded-lg bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-500 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={handleCancel}
                aria-label="Cancel schedule"
                className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-zinc-700 hover:text-rose-300 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                Cancel
              </button>
            </>
          )}

          {schedule.status === "completed" && (
            <span className="text-xs text-zinc-500 italic">
              Schedule completed
            </span>
          )}

          {schedule.status === "cancelled" && (
            <span className="text-xs text-zinc-500 italic">
              Schedule cancelled
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
