import { useEffect, useState } from "react";
import { getOwnerWeights } from "../lib/contract";
import type { OwnerWeight } from "../types/accord";

export const OWNER_WEIGHTS_REFRESH_INTERVAL_MS = 5000;

export type OwnerWeightsState = {
  ownerWeights: OwnerWeight[];
  loading: boolean;
  error: string | null;
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Failed to load owner weights";
}

export function useOwnerWeights(
  intervalMs = OWNER_WEIGHTS_REFRESH_INTERVAL_MS,
): OwnerWeightsState {
  const [state, setState] = useState<OwnerWeightsState>({
    ownerWeights: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    async function fetchWeights() {
      if (inFlight) {
        return;
      }

      inFlight = true;

      try {
        const ownerWeights = await getOwnerWeights();

        if (!cancelled) {
          setState({
            ownerWeights,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        console.error("Failed to fetch owner weights", err);

        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: errorMessage(err),
          }));
        }
      } finally {
        inFlight = false;
      }
    }

    fetchWeights();

    const intervalId = setInterval(fetchWeights, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [intervalMs]);

  return state;
}
