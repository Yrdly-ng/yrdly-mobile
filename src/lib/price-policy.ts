export const MIN_PAID_PRICE = 1200;
export const MINIMUM_PRICE_MESSAGE =
  'Paid prices must be at least ₦1,200, with at most two decimal places.';

export function isPaidPrice(value: number, allowFree = false): boolean {
  return (
    Number.isFinite(value) &&
    value >= 0 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.000001 &&
    (value >= MIN_PAID_PRICE || (allowFree && value === 0))
  );
}
