import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateRecurringPaymentModal } from "./CreateRecurringPaymentModal";
import { StrKey } from "@stellar/stellar-sdk";

vi.mock("@stellar/stellar-sdk", async () => {
  const original = (await vi.importActual("@stellar/stellar-sdk")) as any;
  return {
    ...original,
    StrKey: {
      ...original.StrKey,
      isValidEd25519PublicKey: vi.fn().mockReturnValue(true),
    },
  };
});

describe("CreateRecurringPaymentModal", () => {
  const defaultProps = {
    walletAddress: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4IQDNC",
    onClose: vi.fn(),
    onSubmitted: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (StrKey.isValidEd25519PublicKey as any).mockReturnValue(true);
  });

  const fillValidFields = () => {
    fireEvent.change(screen.getByPlaceholderText("G..."), {
      target: { value: "GBPLX2P3VWYKPQ7L5RI5OGXQ6T4G7QZMJ3HPQD7FZX5KJ3H2Z4YK5ABC" },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByPlaceholderText("30"), {
      target: { value: "30" },
    });
  };

  it("validates interval range and rejects out of range values", () => {
    render(<CreateRecurringPaymentModal {...defaultProps} />);
    fillValidFields();

    const intervalInput = screen.getByPlaceholderText("30");

    // Interval <= 0
    fireEvent.change(intervalInput, { target: { value: "0" } });
    fireEvent.click(screen.getByText("Review Schedule"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Interval must be between 1 and 365 days."
    );

    // Interval > 365
    fireEvent.change(intervalInput, { target: { value: "400" } });
    fireEvent.click(screen.getByText("Review Schedule"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Interval must be between 1 and 365 days."
    );
  });

  it("validates cliff and end coherence, rejecting cliff after end date", () => {
    render(<CreateRecurringPaymentModal {...defaultProps} />);
    fillValidFields();

    const dateInputs = document.querySelectorAll('input[type="date"]');
    const cliffInput = dateInputs[0];
    const endInput = dateInputs[1];

    // Cliff date set after end date
    fireEvent.change(cliffInput, { target: { value: "2026-12-01" } });
    fireEvent.change(endInput, { target: { value: "2026-11-01" } });

    fireEvent.click(screen.getByText("Review Schedule"));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Cliff date cannot be after end date."
    );
  });

  it("validates cap against payment amount, rejecting cap below amount", () => {
    render(<CreateRecurringPaymentModal {...defaultProps} />);
    fillValidFields(); // amount is 50

    const capInput = screen.getByPlaceholderText("Maximum total payout");
    fireEvent.change(capInput, { target: { value: "25" } }); // cap < amount

    fireEvent.click(screen.getByText("Review Schedule"));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Total cap cannot be less than payment amount."
    );
  });

  it("updates the schedule preview correctly when valid parameters are entered", () => {
    render(<CreateRecurringPaymentModal {...defaultProps} />);
    fillValidFields();

    const capInput = screen.getByPlaceholderText("Maximum total payout");
    fireEvent.change(capInput, { target: { value: "500" } });

    // Live preview in form step
    const preview = screen.getByLabelText("Schedule Preview");
    expect(preview).toBeDefined();
    expect(preview).toHaveTextContent("50 XLM");
    expect(preview).toHaveTextContent("Monthly");
    expect(preview).toHaveTextContent("Total Cap: 500 XLM");

    // Click Review Schedule to navigate to full preview step
    fireEvent.click(screen.getByText("Review Schedule"));

    expect(screen.getByText("Preview Recurring Schedule")).toBeDefined();
    expect(screen.getByText("50 XLM")).toBeDefined();
    expect(screen.getByText("Monthly")).toBeDefined();
    expect(screen.getByText("500 XLM")).toBeDefined();
    expect(
      screen.getByText("GBPLX2P3VWYKPQ7L5RI5OGXQ6T4G7QZMJ3HPQD7FZX5KJ3H2Z4YK5ABC")
    ).toBeDefined();
  });

  it("Back returns to form preserving input values and Close dismisses the modal", () => {
    render(<CreateRecurringPaymentModal {...defaultProps} />);
    fillValidFields();

    fireEvent.click(screen.getByText("Review Schedule"));
    expect(screen.getByText("Preview Recurring Schedule")).toBeDefined();

    fireEvent.click(screen.getByText("Back"));
    expect(screen.getByText("Create Recurring Payment")).toBeDefined();
    expect(screen.getByPlaceholderText("0.00")).toHaveValue(50);
    expect(screen.getByPlaceholderText("30")).toHaveValue(30);

    fireEvent.click(screen.getByLabelText("Close"));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});
