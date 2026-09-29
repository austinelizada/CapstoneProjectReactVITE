import { describe, it, expect } from "vitest";
import { getCustomerPaymentProof, isPaymentProofConfirmed } from "@/pages/Transactions/paymentProofUtils";

describe("getCustomerPaymentProof", () => {
  it("detects submitted proof and prefers customer proof fields", () => {
    const order = {
      payment_status: "paid",
      payment_proof_amount: 1250,
      payment_proof_file_name: "proof.png",
      payment_method: "Online",
      transaction_number: "TXN-123",
      payment_amount: 1000,
    };

    expect(getCustomerPaymentProof(order)).toEqual({
      submitted: true,
      amount: 1250,
      fileName: "proof.png",
      paymentMethod: "Online",
      transactionNumber: "TXN-123",
    });
  });

  it("returns no-submission state when no proof exists", () => {
    const order = {
      payment_status: "not_paid",
      payment_amount: 0,
      downpayment_amount: 0,
    };

    expect(getCustomerPaymentProof(order)).toEqual({
      submitted: false,
      amount: 0,
      fileName: "",
      paymentMethod: "Cash",
      transactionNumber: "",
    });
  });
});

describe("isPaymentProofConfirmed", () => {
  it("returns true after an admin confirmation timestamp is saved", () => {
    expect(isPaymentProofConfirmed({ payment_proof_confirmed_at: "2026-09-29T12:00:00.000Z" })).toBe(true);
  });

  it("returns false while proof is unconfirmed", () => {
    expect(isPaymentProofConfirmed({ payment_proof_submitted_at: "2026-09-29T12:00:00.000Z" })).toBe(false);
  });
});
