import { useEffect, useState } from "react";
import { getSpendingLimit } from "../lib/contract";
import { createSpendingLimitProposal } from "../lib/submit";
import { displayToStroops, stroopsToDisplay, shortenAddr } from "../lib/soroban";
import { StrKey } from "@stellar/stellar-sdk";
import type { Owner } from "../types/accord";
import { useOwnerWeights } from "../hooks/useOwnerWeights";

const CHART_COLORS = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-orange-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
  "bg-teal-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-lime-500",
  "bg-red-400",
  "bg-purple-400",
  "bg-sky-500",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-indigo-400",
];

const TOKEN_ADDRESSES: Record<string, string> = {
  XLM: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  USDC: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  EURC: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4IQDNC",
};

const TOKEN_SYMBOLS = ["XLM", "USDC", "EURC"] as const;

type SpendingLimitMap = Record<string, Record<string, bigint>>;

type OwnersPageProps = {
  owners: Owner[];
  ownerAddresses: string[];
  threshold: number;
  totalOwners: number;
  walletAddress: string | null;
  onProposalSubmitted: () => void;
};

export function OwnersPage({
  owners,
  ownerAddresses,
  threshold,
  totalOwners,
  walletAddress,
  onProposalSubmitted,
}: OwnersPageProps) {
  const { weights, totalWeight, loading: weightsLoading } = useOwnerWeights(ownerAddresses);
  const [spendingLimits, setSpendingLimits] = useState<SpendingLimitMap>({});
  const [limitsLoading, setLimitsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Spending limit proposal form state
  const [slOwner, setSlOwner] = useState("");
  const [slToken, setSlToken] = useState("XLM");
  const [slAmount, setSlAmount] = useState("");
  const [slDescription, setSlDescription] = useState("");
  const [slDeadline, setSlDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [slSubmitting, setSlSubmitting] = useState(false);
  const [slError, setSlError] = useState<string | null>(null);

  // Load spending limits for all owners and tokens
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLimitsLoading(true);
      const map: SpendingLimitMap = {};
      for (const addr of ownerAddresses) {
        map[addr] = {};
        for (const symbol of TOKEN_SYMBOLS) {
          const tokenAddr = TOKEN_ADDRESSES[symbol];
          const limit = await getSpendingLimit(addr, tokenAddr);
          if (!cancelled) {
            map[addr][symbol] = limit;
          }
        }
      }
      if (!cancelled) {
        setSpendingLimits(map);
        setLimitsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [ownerAddresses]);

  function formatLimit(limit: bigint, symbol: string): { text: string; variant: "unrestricted" | "zero" | "configured" } {
    if (limit < 0n) return { text: "Unrestricted", variant: "unrestricted" };
    if (limit === 0n) return { text: `0 ${symbol}`, variant: "zero" };
    return { text: `${stroopsToDisplay(limit)} ${symbol}`, variant: "configured" };
  }

  async function handleCreateSpendingLimit() {
    if (!walletAddress) {
      setSlError("Connect your wallet first.");
      return;
    }
    if (!slOwner.trim() || !slAmount.trim() || !slDescription.trim()) {
      setSlError("Owner, amount, and description are required.");
      return;
    }
    if (!StrKey.isValidEd25519PublicKey(slOwner.trim())) {
      setSlError("Enter a valid Stellar address for the owner.");
      return;
    }
    const tokenAddr = TOKEN_ADDRESSES[slToken];
    if (!tokenAddr) {
      setSlError("Unknown token.");
      return;
    }
    const amountNum = parseFloat(slAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      setSlError("Enter a valid amount (0 to block spending).");
      return;
    }
    const deadlineMs = new Date(slDeadline).getTime();
    const nowMs = Date.now();
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    if (deadlineMs <= todayMidnight.getTime()) {
      setSlError("Deadline must be in the future.");
      return;
    }
    const maxMs = nowMs + 90 * 24 * 3600 * 1000;
    if (deadlineMs > maxMs) {
      setSlError("Deadline cannot be more than 90 days away.");
      return;
    }

    setSlSubmitting(true);
    setSlError(null);
    try {
      await createSpendingLimitProposal(
        walletAddress,
        slOwner.trim(),
        tokenAddr,
        displayToStroops(amountNum),
        slDescription.trim(),
        BigInt(Math.floor(deadlineMs / 1000))
      );
      onProposalSubmitted();
      setShowForm(false);
      setSlAmount("");
      setSlDescription("");
    } catch (e) {
      setSlError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setSlSubmitting(false);
    }
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-semibold">Multisig Owners</h1>
        <div className="space-y-1 text-sm text-zinc-400">
          <p>
            {hasOwnerWeights
              ? `Requires ${threshold} of ${totalWeight} voting weight`
              : `Requires ${threshold} voting weight`}
          </p>
          <p>
            {ownerWeightsLoading
              ? `Loading voting power across ${ownerCountLabel}...`
              : ownerWeightsError
                ? "Voting power unavailable; owners remain visible."
                : `${quorumPercent} of voting power must approve.`}
          </p>
          {ownerWeightsError && (
            <p className="text-amber-400">Voting weights unavailable.</p>
          )}
        </div>
      </div>

      {/* Weight Distribution Chart */}
      <div className="mb-8 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Voting Weight Distribution</h2>
        {weightsLoading ? (
          <div className="h-6 bg-zinc-800 animate-pulse rounded-lg w-full" />
        ) : ownerAddresses.length === 0 ? (
          <div className="h-6 bg-zinc-850 rounded-lg flex items-center justify-center text-xs text-zinc-500">
            No voting power registered.
          </div>
        ) : (
          <div>
            <div role="region" aria-label={`Voting weight distribution across ${ownerAddresses.length} owners, total weight ${totalWeight}`} className="flex h-6 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 w-full mb-3">
              {ownerAddresses.map((addr, idx) => {
                const weight = weights[addr] ?? 1;
                const pct = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
                const ownerInfo = owners.find((o) => o.address === addr) || { label: `Signer ${idx + 1}`, address: addr };
                const labelText = `${ownerInfo.label} (${addr.slice(0, 6)}...${addr.slice(-4)})`;
                const titleStr = `${labelText}: weight ${weight} (${pct.toFixed(1)}%)`;

                if (pct <= 0) return null;

                return (
                  <div
                    key={addr}
                    title={titleStr}
                    style={{ width: `${pct}%` }}
                    className={`${CHART_COLORS[idx % CHART_COLORS.length]} h-full transition-all duration-300 relative group cursor-pointer hover:brightness-110`}
                    tabIndex={0}
                    role="img"
                    aria-label={titleStr}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                      }
                    }}
                  />
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
              {ownerAddresses.map((addr, idx) => {
                const weight = weights[addr] ?? 1;
                const pct = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
                const ownerInfo = owners.find((o) => o.address === addr) || { label: `Signer ${idx + 1}`, address: addr };
                const legendLabel = `${ownerInfo.label} ${addr.slice(0,6)}…${addr.slice(-4)}: ${weight} weight (${pct.toFixed(0)}%)`;
                return (
                  <div key={addr} className="flex items-center gap-1.5 text-xs text-zinc-400" aria-label={legendLabel}>
                    <span aria-hidden className={`w-2.5 h-2.5 rounded-full ${CHART_COLORS[idx % CHART_COLORS.length]}`} />
                    <span className="font-medium text-zinc-300">{ownerInfo.label}</span>
                    <span className="font-mono text-zinc-500">({addr.slice(0, 6)}…{addr.slice(-4)})</span>
                    <span className="font-medium text-zinc-300">({weight} w, {pct.toFixed(0)}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Owners list with spending limits */}
      {owners.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-zinc-600">No owners found.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800 mb-8">
          {owners.map((owner) => (
            <div key={owner.address}>
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-400">
                  {owner.label[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-300">{owner.label}</p>
                    {/* subtle badge retained for quick glance when not loading */}
                    {!weightsLoading && (
                      <span className="text-xs text-zinc-400 bg-zinc-850 border border-zinc-800 px-2 py-0.5 rounded-full font-mono">
                        Weight: {weights[owner.address] ?? 1}
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-xs text-zinc-500">
                    {shortenAddr(owner.address)}
                    {!weightsLoading && (
                      <span className="text-xs text-zinc-400 ml-2">· weight {weights[owner.address] ?? 1}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Spending limits per token */}
              {limitsLoading ? (
                <div className="px-4 pb-4">
                  <div className="h-4 w-32 bg-zinc-800 animate-pulse rounded" />
                </div>
              ) : (
                <div className="px-4 pb-4 pl-14 grid grid-cols-3 gap-2">
                  {TOKEN_SYMBOLS.map((symbol) => {
                    const rawAddr = ownerAddresses[
                      owners.findIndex((o) => o.address === owner.address)
                    ];
                    const limit = rawAddr ? spendingLimits[rawAddr]?.[symbol] : undefined;
                    const info = limit !== undefined
                      ? formatLimit(limit, symbol)
                      : { text: "—", variant: "unrestricted" as const };

                    const variantStyles = {
                      unrestricted: "text-zinc-500",
                      zero: "text-red-400",
                      configured: "text-emerald-400",
                    };

                    return (
                      <div key={symbol} className="text-xs">
                        <span className="text-zinc-600">{symbol}: </span>
                        <span className={`font-mono ${variantStyles[info.variant]}`}>
                          {info.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Spending limit proposal form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Spending Limits</h2>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            aria-expanded={showForm}
            aria-controls="spending-limit-form"
            aria-label={showForm ? "Close spending limit form" : "Open spending limit form"}
            className="text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors focus:ring-2 focus:ring-zinc-400 focus:outline-none"
          >
            {showForm ? "Cancel" : "Set Spending Limit"}
          </button>
        </div>

        {showForm && (
          <div id="spending-limit-form" className="space-y-4 border-t border-zinc-800 pt-4">
            <p className="text-xs text-zinc-400">
              Propose a per-owner, per-token spending limit. Set to 0 to block spending for that token.
            </p>

            <div>
              <label htmlFor="sl-owner" className="text-xs text-zinc-400 block mb-1.5">Owner Address</label>
              <input
                id="sl-owner"
                value={slOwner}
                onChange={(e) => setSlOwner(e.target.value)}
                placeholder="G..."
                aria-label="Owner Stellar address"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono placeholder-zinc-600 focus:ring-2 focus:ring-zinc-400 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="sl-amount" className="text-xs text-zinc-400 block mb-1.5">
                  Limit Amount
                </label>
                <input
                  id="sl-amount"
                  value={slAmount}
                  onChange={(e) => setSlAmount(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  min="0"
                  step="any"
                  aria-label="Spending limit amount"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-zinc-600 focus:ring-2 focus:ring-zinc-400 focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div className="w-28">
                <label className="text-xs text-zinc-400 block mb-1.5">Token</label>
                <div className="grid grid-cols-3 gap-1" role="group" aria-label="Token selector">
                  {TOKEN_SYMBOLS.map((symbol) => {
                    const active = slToken === symbol;
                    return (
                      <button
                        key={symbol}
                        type="button"
                        onClick={() => setSlToken(symbol)}
                        aria-pressed={active}
                        aria-label={`Select token ${symbol}`}
                        className={`rounded-lg border px-1.5 py-2 text-xs font-medium transition-colors focus:ring-2 focus:ring-zinc-400 focus:outline-none ${
                          active
                            ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                            : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                        }`}
                      >
                        {symbol}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="sl-description" className="text-xs text-zinc-400 block mb-1.5">Description</label>
              <input
                id="sl-description"
                value={slDescription}
                onChange={(e) => setSlDescription(e.target.value)}
                placeholder="Reason for spending limit"
                maxLength={300}
                aria-label="Spending limit description"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-zinc-600 focus:ring-2 focus:ring-zinc-400 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label htmlFor="sl-deadline" className="text-xs text-zinc-400 block mb-1.5">Deadline</label>
              <input
                id="sl-deadline"
                type="date"
                value={slDeadline}
                onChange={(e) => setSlDeadline(e.target.value)}
                aria-label="Spending limit deadline"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-zinc-400 focus:outline-none focus:border-zinc-500"
              />
            </div>

            {slError && (
              <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                {slError}
              </p>
            )}

            <button
              type="button"
              onClick={handleCreateSpendingLimit}
              aria-label="Create spending limit proposal"
              disabled={slSubmitting || !walletAddress}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition-colors focus:ring-2 focus:ring-zinc-400 focus:outline-none"
            >
              {slSubmitting ? "Submitting…" : "Create Spending Limit Proposal"}
            </button>
          </div>
        )}

        {!showForm && (
          <p className="text-xs text-zinc-500">
            Configure per-owner spending limits for specific tokens. All changes require multisig approval.
          </p>
        )}
      </div>
    </>
  );
}
