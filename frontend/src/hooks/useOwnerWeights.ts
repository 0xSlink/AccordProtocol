import { useEffect, useState } from "react";

export type OwnerWeightState = {
  weightsByAddress: Record<string, number>;
  totalWeight: number;
  loading: boolean;
  error: string | null;
};

function buildFlatOwnerWeights(ownerAddresses: string[]) {
  const weightsByAddress = ownerAddresses.reduce<Record<string, number>>(
    (acc, address) => {
      acc[address] = 1;
      return acc;
    },
    {},
  );

  return {
    weightsByAddress,
    totalWeight: ownerAddresses.length,
  };
}

export function useOwnerWeights(ownerAddresses: string[]): OwnerWeightState {
  const [state, setState] = useState<OwnerWeightState>(() => ({
    weightsByAddress: {},
    totalWeight: 0,
    loading: ownerAddresses.length > 0,
    error: null,
  }));

  const ownerAddressKey = ownerAddresses.join("\n");

  useEffect(() => {
    let cancelled = false;
    const addresses = ownerAddressKey ? ownerAddressKey.split("\n") : [];

    if (addresses.length === 0) {
      setState({
        weightsByAddress: {},
        totalWeight: 0,
        loading: false,
        error: null,
      });
      return () => {
        cancelled = true;
      };
    }

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    Promise.resolve()
      .then(() => buildFlatOwnerWeights(addresses))
      .then(({ weightsByAddress, totalWeight }) => {
        if (cancelled) return;
        setState({
          weightsByAddress,
          totalWeight,
          loading: false,
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          weightsByAddress: {},
          totalWeight: 0,
          loading: false,
          error:
            err instanceof Error
              ? err.message
              : "Failed to load owner weights",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [ownerAddressKey]);

  return state;
}
