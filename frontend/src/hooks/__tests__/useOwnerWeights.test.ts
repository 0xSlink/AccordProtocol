import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useOwnerWeights } from "../useOwnerWeights";

describe("useOwnerWeights", () => {
  test("returns no weights for an empty owner list", () => {
    const { result } = renderHook(() => useOwnerWeights([]));

    expect(result.current).toEqual({
      weightsByAddress: {},
      totalWeight: 0,
      loading: false,
      error: null,
    });
  });

  test("loads current flat voting weights for owners", async () => {
    const ownerAddresses = ["GOWNER111", "GOWNER222"];

    const { result } = renderHook(() => useOwnerWeights(ownerAddresses));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.totalWeight).toBe(2);
    expect(result.current.weightsByAddress).toEqual({
      GOWNER111: 1,
      GOWNER222: 1,
    });
  });
});
