import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useOwnerWeights } from "../hooks/useOwnerWeights";
import type { Owner } from "../types/accord";
import { OwnersPage } from "./OwnersPage";

vi.mock("../hooks/useOwnerWeights", () => ({
  useOwnerWeights: vi.fn(),
}));

const mockUseOwnerWeights = vi.mocked(useOwnerWeights);

const ownerAddresses = ["GOWNER111", "GOWNER222"];
const owners: Owner[] = [
  { address: "GOWNER...R111", label: "Signer 1" },
  { address: "GOWNER...R222", label: "Signer 2" },
];

function renderOwnersPage() {
  render(
    <OwnersPage
      owners={owners}
      ownerAddresses={ownerAddresses}
      threshold={5}
      totalOwners={owners.length}
    />,
  );
}

describe("OwnersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("shows weighted quorum and each owner voting share", () => {
    mockUseOwnerWeights.mockReturnValue({
      ownerWeights: [
        { address: "GOWNER111", weight: 5 },
        { address: "GOWNER222", weight: 15 },
      ],
      loading: false,
      error: null,
    });

    renderOwnersPage();

    expect(mockUseOwnerWeights).toHaveBeenCalledWith();
    expect(screen.getByText("Requires 5 of 20 voting weight")).toBeInTheDocument();
    expect(screen.getByText("25.0% of voting power must approve."))
      .toBeInTheDocument();
    expect(screen.getByText("Signer 1")).toBeInTheDocument();
    expect(screen.getByText("GOWNER...R111")).toBeInTheDocument();
    expect(screen.getByText("Weight 5")).toBeInTheDocument();
    expect(screen.getByText("25.0% of voting power")).toBeInTheDocument();
    expect(screen.getByText("Weight 15")).toBeInTheDocument();
    expect(screen.getByText("75.0% of voting power")).toBeInTheDocument();
  });

  test("keeps owners visible while voting weights load", () => {
    mockUseOwnerWeights.mockReturnValue({
      ownerWeights: [],
      loading: true,
      error: null,
    });

    renderOwnersPage();

    expect(screen.getByText("Requires 5 voting weight")).toBeInTheDocument();
    expect(
      screen.getByText("Loading voting power across 2 owners..."),
    ).toBeInTheDocument();
    expect(screen.getByText("Signer 1")).toBeInTheDocument();
    expect(screen.getByText("Signer 2")).toBeInTheDocument();
    expect(screen.getAllByText("Loading weight...")).toHaveLength(2);
  });

  test("keeps owners visible when voting weights fail to load", () => {
    mockUseOwnerWeights.mockReturnValue({
      ownerWeights: [],
      loading: false,
      error: "Failed to load owner weights",
    });

    renderOwnersPage();

    expect(screen.getByText("Requires 5 voting weight")).toBeInTheDocument();
    expect(
      screen.getByText("Voting power unavailable; owners remain visible."),
    ).toBeInTheDocument();
    expect(screen.getByText("Voting weights unavailable.")).toBeInTheDocument();
    expect(screen.getByText("Signer 1")).toBeInTheDocument();
    expect(screen.getByText("Signer 2")).toBeInTheDocument();
    expect(screen.getAllByText("Weight unavailable")).toHaveLength(2);
  });
});
