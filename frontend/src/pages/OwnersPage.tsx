import { useOwnerWeights } from "../hooks/useOwnerWeights";
import { formatWeightPercent } from "../lib/soroban";
import type { Owner } from "../types/accord";

type OwnersPageProps = {
  owners: Owner[];
  ownerAddresses: string[];
  threshold: number;
  totalOwners: number;
};

export function OwnersPage({
  owners,
  ownerAddresses,
  threshold,
  totalOwners,
}: OwnersPageProps) {
  const {
    ownerWeights,
    loading: ownerWeightsLoading,
    error: ownerWeightsError,
  } = useOwnerWeights();

  const weightsByAddress = ownerWeights.reduce<Record<string, number>>(
    (acc, { address, weight }) => {
      acc[address] = weight;
      return acc;
    },
    {},
  );
  const totalWeight = ownerWeights.reduce(
    (total, { weight }) => total + weight,
    0,
  );
  const ownerCountLabel = `${totalOwners} ${totalOwners === 1 ? "owner" : "owners"}`;
  const weightsUnavailable = Boolean(ownerWeightsError && ownerWeights.length === 0);
  const hasOwnerWeights = !ownerWeightsLoading && !weightsUnavailable;
  const weightsStale = Boolean(ownerWeightsError && ownerWeights.length > 0);
  const quorumPercent = hasOwnerWeights
    ? formatWeightPercent(threshold, totalWeight)
    : null;

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
              : weightsUnavailable
                ? "Voting power unavailable; owners remain visible."
                : `${quorumPercent} of voting power must approve.`}
          </p>
          {weightsStale && (
            <p className="text-amber-400">Voting weights may be stale.</p>
          )}
          {weightsUnavailable && (
            <p className="text-amber-400">Voting weights unavailable.</p>
          )}
        </div>
      </div>

      {owners.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-zinc-600">No owners found.</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900">
          {owners.map((owner, index) => {
            const ownerAddress = ownerAddresses[index] ?? owner.address;
            const weight = weightsByAddress[ownerAddress] ?? 0;

            return (
              <div
                key={ownerAddress}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs text-zinc-400">
                    {owner.label[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-300">{owner.label}</p>
                    <p className="truncate font-mono text-xs text-zinc-500">
                      {owner.address}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 sm:text-right">
                  {ownerWeightsLoading ? (
                    <p className="text-xs text-zinc-500">Loading weight...</p>
                  ) : weightsUnavailable ? (
                    <p className="text-xs text-zinc-500">Weight unavailable</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-zinc-200">
                        Weight {weight}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatWeightPercent(weight, totalWeight)} of voting
                        power
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
