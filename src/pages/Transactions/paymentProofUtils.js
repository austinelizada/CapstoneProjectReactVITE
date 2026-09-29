export const getCustomerPaymentProof = (order) => {
  if (!order) {
    return {
      submitted: false,
      amount: 0,
      fileName: "",
      paymentMethod: "Cash",
      transactionNumber: "",
    };
  }

  const proofAmount = Number(order.payment_proof_amount ?? order.payment_amount ?? order.amount_paid ?? order.paid_amount ?? order.downpayment_amount ?? 0);
  const hasProofSubmission = Boolean(
    order.payment_proof_file_name ||
    order.payment_proof_file_url ||
    order.payment_proof ||
    order.proof_of_payment ||
    order.proof_file ||
    order.payment_status === "paid" ||
    proofAmount > 0
  );

  const normalizedMethod = order.payment_method || order.paymentMethod || (order.acceptance_method === "online" ? "Online" : "Cash");

  return {
    submitted: hasProofSubmission,
    amount: Number.isFinite(proofAmount) ? proofAmount : 0,
    fileName: order.payment_proof_file_name || order.payment_proof_file_url || order.payment_proof || order.proof_of_payment || order.proof_file || "",
    fileUrl: order.payment_proof_file_url || order.proof_file_url || order.payment_proof_url || order.proof_url || "",
    paymentMethod: normalizedMethod || "Cash",
    transactionNumber: order.transaction_number || order.transactionNumber || "",
  };
};

export const isPaymentProofConfirmed = (order) => Boolean(order?.payment_proof_confirmed_at);
