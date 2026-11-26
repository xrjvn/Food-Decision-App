export function isDeliveryAppPrice(status: string) {
  return status === "Third-party price (delivery app)";
}

export function isEligiblePrice(status: string) {
  return status.startsWith("Verified") || isDeliveryAppPrice(status);
}
