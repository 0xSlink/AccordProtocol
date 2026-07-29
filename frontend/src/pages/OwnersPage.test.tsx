import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useOwnerWeights } from "../hooks/useOwnerWeights";
import { getWeightCapPct, getRequiredQuorumWeight, getSpendingLimit } from "../lib/contract";
import type { Owner } from "../types/accord";
import { OwnersPage } from "./OwnersPage";

vi.mock("../hooks/useOwnerWeights", () => ({
  useOwnerWeights: vi.fn(),
}));

vi.mock("../lib/contract", () => ({
  getSpendingLimit: vi.fn(),
  getWeightCapPct: vi.fn(),
  getRequiredQuorumWeight: vi.fn(),
}));

const mockUseOwnerWeights = vi.mocked(useOwnerWeights);
const mockGetWeightCapPct = vi.mocked(getWeightCapPct);
const mockGetRequiredQuorumWeight = vi.mocked(getRequiredQuorumWeight);
const mockGetSpendingLimit = vi.mocked(getSpendingLimit);

const ownerAddresses = ["GOWNER111", "GOWNER222"];
const owners: Owner[] = [
  { address: "GOWNER111", label: "Signer 1" },
  { address: "GOWNER222", label: "Signer 2" },
];

function renderOwnersPage() {
  render(
    <OwnersPage
      owners={owners}
      ownerAddresses={ownerAddresses}
      threshold={5}
    />,
  );
}

describe("OwnersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWeightCapPct.mockResolvedValue(50);
    mockGetRequiredQuorumWeight.mockResolvedValue(10);
    mockGetSpendingLimit.mockResolvedValue(-1n);
  });

  test("shows weighted quorum and each owner voting share", async () => {
    mockUseOwnerWeights.mockReturnValue({
      weights: { GOWNER111: 5, GOWNER222: 15 },
      totalWeight: 20,
      loading: false,
      error: null,
    });

    renderOwnersPage();

    expect(await screen.findByText("Requires 5 of 20 voting weight")).toBeInTheDocument();
    expect(await screen.findByText("25.0 of voting power must approve."))
      .toBeInTheDocument();
    expect(screen.getAllByText("Signer 1")).toHaveLength(2);
    expect(screen.getAllByText("Signer 2")).toHaveLength(2);
  });

  test("keeps owners visible while voting weights load", () => {
    mockUseOwnerWeights.mockReturnValue({
      weights: {},
      totalWeight: 0,
      loading: true,
      error: null,
    });

    renderOwnersPage();

    expect(screen.getByText("Requires 5 voting weight")).toBeInTheDocument();
    expect(
      screen.getByText("Loading voting power across 2 owners..."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Signer 1")).toHaveLength(1);
    expect(screen.getAllByText("Signer 2")).toHaveLength(1);
  });

  test("keeps owners visible when voting weights fail to load", () => {
    mockUseOwnerWeights.mockReturnValue({
      weights: {},
      totalWeight: 0,
      loading: false,
      error: "Failed to load owner weights",
    });

    renderOwnersPage();

    expect(screen.getByText("Requires 5 voting weight")).toBeInTheDocument();
    expect(
      screen.getByText("Voting power unavailable; owners remain visible."),
    ).toBeInTheDocument();
    expect(screen.getByText("Voting weights unavailable.")).toBeInTheDocument();
    expect(screen.getAllByText("Signer 1")).toHaveLength(2);
    expect(screen.getAllByText("Signer 2")).toHaveLength(2);
  });

  test("shows urgent warning when owner weight meets quorum", async () => {
    mockUseOwnerWeights.mockReturnValue({
      weights: { GOWNER111: 12, GOWNER222: 3 },
      totalWeight: 15,
      loading: false,
      error: null,
    });

    renderOwnersPage();

    expect(await screen.findByText("Single-owner quorum", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("Above weight cap", { exact: false })).not.toBeInTheDocument();
  });

  test("shows general warning when owner exceeds weight cap", async () => {
    mockUseOwnerWeights.mockReturnValue({
      weights: { GOWNER111: 8, GOWNER222: 7 },
      totalWeight: 15,
      loading: false,
      error: null,
    });

    renderOwnersPage();

    expect(await screen.findByText("Above weight cap", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("Single-owner quorum", { exact: false })).not.toBeInTheDocument();
  });

  test("shows no warnings for balanced owners", async () => {
    mockUseOwnerWeights.mockReturnValue({
      weights: { GOWNER111: 5, GOWNER222: 5 },
      totalWeight: 10,
      loading: false,
      error: null,
    });

    renderOwnersPage();

    expect(screen.queryByText("Single-owner quorum", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText("Above weight cap", { exact: false })).not.toBeInTheDocument();
  });
});
