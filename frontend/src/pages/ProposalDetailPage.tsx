import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ApprovalBar } from "../components/ApprovalBar";
import { StatusBadge } from "../components/StatusBadge";
import type { Proposal, ProposalEvent } from "../types/accord";
import { getProposalEvents } from "../lib/contract";

type ProposalDetailPageProps = {
  proposals: Proposal[];
  walletAddress: string | null;
  onApprove: (id: number) => void;
  onExecute: (id: number) => void;
};

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">{label}</p>
      <div className="mt-2 text-sm text-zinc-200">{children}</div>
    </div>
  );
}

export function ProposalDetailPage({
  proposals,
  walletAddress,
  onApprove,
  onExecute,
}: ProposalDetailPageProps) {
  const { id } = useParams();
  const proposalId = Number(id);
  const proposal = Number.isInteger(proposalId)
    ? proposals.find((candidate) => candidate.id === proposalId)
    : undefined;
  const connected = Boolean(walletAddress);
  const showApprove = proposal?.status === "pending" && !proposal.userHasApproved;
  const showExecute = connected && proposal?.status === "ready";
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const [events, setEvents] = useState<ProposalEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  useEffect(() => {
    setAwaitingConfirmation(false);

    if (!proposal) return;

    let active = true;
    setLoadingEvents(true);
    setEventsError(null);

    getProposalEvents(proposal.id)
      .then((data) => {
        if (active) {
          setEvents(data);
          setLoadingEvents(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.error("Failed to load proposal events:", err);
          setEventsError(
            err instanceof Error ? err.message : "Failed to load events."
          );
          setLoadingEvents(false);
        }
      });

    return () => {
      active = false;
    };
  }, [proposal?.id, proposal?.status]);

  if (!proposal) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <p className="text-lg font-semibold text-white">Proposal not found</p>
        <p className="mt-2 text-sm text-zinc-500">
          No proposal matches this URL.
        </p>
        <Link
          to="/app"
          className="mt-6 inline-flex rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to="/app"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Back to dashboard
          </Link>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-600">
            Proposal Detail
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Proposal #{proposal.id}
          </h1>
        </div>
        <StatusBadge status={proposal.status} />
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-zinc-500">Amount</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {proposal.amount} {proposal.token}
            </p>
          </div>
          <div className="sm:min-w-64">
            <ApprovalBar
              approvals={proposal.approvals}
              threshold={proposal.threshold}
              approverAddresses={proposal.approverAddresses}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <DetailRow label="Recipient Address">
          <p className="break-all font-mono">{proposal.to}</p>
        </DetailRow>
        <DetailRow label="Approvals">
          {proposal.approvals} / {proposal.threshold}
        </DetailRow>
        <DetailRow label="Deadline">{proposal.deadline}</DetailRow>
        <DetailRow label="Created Date">{proposal.createdAt}</DetailRow>
        <DetailRow label="Status">
          <StatusBadge status={proposal.status} />
        </DetailRow>
        <DetailRow label="Proposer">
          <p className="break-all font-mono">{proposal.proposer}</p>
        </DetailRow>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
          Description
        </p>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-300">
          {proposal.description || "No description provided."}
        </p>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
            Activity Timeline
          </p>
          {loadingEvents && (
            <span className="text-xs text-zinc-500 animate-pulse">
              Loading events...
            </span>
          )}
        </div>

        {eventsError && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {eventsError}
          </div>
        )}

        {!loadingEvents && !eventsError && events.length === 0 && (
          <p className="mt-4 text-sm text-zinc-500">No activity yet</p>
        )}

        {!loadingEvents && !eventsError && events.length > 0 && (
          <div className="mt-4 space-y-3">
            {events.map((event, index) => {
              const badgeColors =
                event.type === "approved"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : event.type === "executed"
                  ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20";

              const label =
                event.type === "approved"
                  ? "Approved"
                  : event.type === "executed"
                  ? "Executed"
                  : "Revoked";

              return (
                <div
                  key={`${event.type}-${event.actor}-${index}`}
                  className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider ${badgeColors}`}
                    >
                      {label}
                    </span>
                    <span className="font-mono text-sm text-zinc-200">
                      {event.actor}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500">{event.timestamp}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {(showApprove || showExecute) && (
        <section className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 sm:flex-row sm:items-center sm:justify-end">
          {showApprove && (
            <button
              type="button"
              onClick={() => onApprove(proposal.id)}
              aria-label={
                connected
                  ? `Approve proposal #${proposal.id}`
                  : `Connect and approve proposal #${proposal.id}`
              }
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              {connected ? "Approve" : "Connect & Approve"}
            </button>
          )}

          {showExecute && !awaitingConfirmation && (
            <button
              type="button"
              onClick={() => setAwaitingConfirmation(true)}
              aria-label={`Execute proposal #${proposal.id}`}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              Execute
            </button>
          )}

          {showExecute && awaitingConfirmation && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="text-sm text-zinc-400">Send this transaction?</span>
              <button
                type="button"
                onClick={() => {
                  onExecute(proposal.id);
                  setAwaitingConfirmation(false);
                }}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setAwaitingConfirmation(false)}
                className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                Cancel
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

