import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as contract from "../../lib/contract";
import { useOwnerWeights } from "../useOwnerWeights";

vi.mock("../../lib/contract", () => ({
  getOwnerWeights: vi.fn(),
}));

const intervalMs = 5000;
const initialWeights = [
  { address: "GOWNER111", weight: 4 },
  { address: "GOWNER222", weight: 6 },
];
const refreshedWeights = [
  { address: "GOWNER111", weight: 3 },
  { address: "GOWNER222", weight: 7 },
];

describe("useOwnerWeights", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("fetches owner weights on mount", async () => {
    vi.mocked(contract.getOwnerWeights).mockResolvedValueOnce(initialWeights);

    const { result } = renderHook(() => useOwnerWeights(intervalMs));

    expect(result.current).toEqual({
      ownerWeights: [],
      loading: true,
      error: null,
    });

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(contract.getOwnerWeights).toHaveBeenCalledTimes(1);
    expect(result.current.ownerWeights).toEqual(initialWeights);
    expect(result.current.error).toBeNull();
  });

  test("refreshes owner weights on an interval", async () => {
    vi.mocked(contract.getOwnerWeights)
      .mockResolvedValueOnce(initialWeights)
      .mockResolvedValueOnce(refreshedWeights);

    const { result } = renderHook(() => useOwnerWeights(intervalMs));

    await vi.waitFor(() => {
      expect(result.current.ownerWeights).toEqual(initialWeights);
    });

    act(() => {
      vi.advanceTimersByTime(intervalMs);
    });

    await vi.waitFor(() => {
      expect(contract.getOwnerWeights).toHaveBeenCalledTimes(2);
      expect(result.current.ownerWeights).toEqual(refreshedWeights);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test("keeps cached owner weights when a refresh fails", async () => {
    const refreshError = new Error("RPC unavailable");
    vi.mocked(contract.getOwnerWeights)
      .mockResolvedValueOnce(initialWeights)
      .mockRejectedValueOnce(refreshError);

    const { result } = renderHook(() => useOwnerWeights(intervalMs));

    await vi.waitFor(() => {
      expect(result.current.ownerWeights).toEqual(initialWeights);
    });

    act(() => {
      vi.advanceTimersByTime(intervalMs);
    });

    await vi.waitFor(() => {
      expect(contract.getOwnerWeights).toHaveBeenCalledTimes(2);
      expect(result.current.error).toBe("RPC unavailable");
    });

    expect(result.current.ownerWeights).toEqual(initialWeights);
    expect(result.current.loading).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      "Failed to fetch owner weights",
      refreshError,
    );
  });

  test("stops refreshing after unmount", async () => {
    vi.mocked(contract.getOwnerWeights).mockResolvedValueOnce(initialWeights);

    const { result, unmount } = renderHook(() => useOwnerWeights(intervalMs));

    await vi.waitFor(() => {
      expect(result.current.ownerWeights).toEqual(initialWeights);
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(intervalMs);
    });

    expect(contract.getOwnerWeights).toHaveBeenCalledTimes(1);
  });
});
