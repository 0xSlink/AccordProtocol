import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { OwnersPage } from "./OwnersPage";
import type { Owner } from "../types/accord";

const mockUseOwnerWeights = vi.fn();
const mockGetSpendingLimit = vi.fn();

vi.mock("../hooks/useOwnerWeights", () => ({
  useOwnerWeights: () => mockUseOwnerWeights(),
}));

vi.mock("../lib/contract", () => ({
  getSpendingLimit: (...args: unknown[]) => mockGetSpendingLimit(...args),
}));

vi.mock("../lib/submit", () => ({
  createSpendingLimitProposal: vi.fn(),
}));

const owners: Owner[] = [
  {
    address: "GOWNERA111111111111111111111111111111111111111111",
    label: "Owner A",
  },
  {
    address: "GOWNERB111111111111111111111111111111111111111111",
    label: "Owner B",
  },
  {
    address: "GOWNERC111111111111111111111111111111111111111111",
    label: "Owner C",
  },
];

function renderOwnersPage() {
  return render(
    <OwnersPage
      owners={owners}
      ownerAddresses={owners.map((owner) => owner.address)}
      threshold={2}
      totalOwners={3}
      walletAddress={null}
      onProposalSubmitted={() => undefined}
    />,
  );
}

describe("OwnersPage", () => {
  beforeEach(() => {
    mockUseOwnerWeights.mockReturnValue({
      weights: {
        [owners[0].address]: 20,
        [owners[1].address]: 50,
        [owners[2].address]: 30,
      },
      totalWeight: 100,
      loading: false,
      error: null,
    });
    mockGetSpendingLimit.mockResolvedValue(0n);
  });

  test("sorts by weight descending and filters by share threshold together", async () => {
    const user = userEvent.setup();
    const { container } = renderOwnersPage();

    const ownerLabels = Array.from(
      container.querySelectorAll("p.text-sm.text-zinc-300"),
    )
      .map((node) => node.textContent?.trim())
      .filter(Boolean);

    expect(ownerLabels).toEqual(["Owner A", "Owner B", "Owner C"]);

    await user.click(
      screen.getByRole("checkbox", { name: /weight descending/i }),
    );

    await user.selectOptions(screen.getByLabelText(/show owners/i), "above");
    await user.clear(screen.getByLabelText(/share threshold/i));
    await user.type(screen.getByLabelText(/share threshold/i), "25");

    const filteredLabels = Array.from(
      container.querySelectorAll("p.text-sm.text-zinc-300"),
    )
      .map((node) => node.textContent?.trim())
      .filter(Boolean);

    expect(filteredLabels).toEqual(["Owner B", "Owner C"]);
  });
});
