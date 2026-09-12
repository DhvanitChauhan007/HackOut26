/**
 * Price decay — computed at read time, no cron/scheduler.
 *
 * current_price = max(price_floor, list_price - (elapsed / decay_window) * (list_price - price_floor))
 */

export interface ListingForDecay {
  list_price: number;
  price_floor: number;
  decay_window_seconds: number;
  created_at: string;
}

export function computeCurrentPrice(listing: ListingForDecay): number {
  const { list_price, price_floor, decay_window_seconds, created_at } = listing;
  const elapsedSeconds = (Date.now() - new Date(created_at).getTime()) / 1000;

  if (elapsedSeconds <= 0) return list_price;
  if (elapsedSeconds >= decay_window_seconds) return price_floor;

  const decayAmount = (elapsedSeconds / decay_window_seconds) * (list_price - price_floor);
  return Math.max(price_floor, list_price - decayAmount);
}

/** Returns the fraction of decay completed (0 = just listed, 1 = fully at floor). */
export function decayFraction(listing: ListingForDecay): number {
  const { decay_window_seconds, created_at } = listing;
  const elapsedSeconds = (Date.now() - new Date(created_at).getTime()) / 1000;
  return Math.min(1, Math.max(0, elapsedSeconds / decay_window_seconds));
}

/** Checks if the price has been at the floor for at least `timeoutSeconds`. */
export function isAtFloorForTimeout(listing: ListingForDecay, timeoutSeconds: number): boolean {
  const { decay_window_seconds, created_at } = listing;
  const elapsedSeconds = (Date.now() - new Date(created_at).getTime()) / 1000;
  const timeAtFloor = elapsedSeconds - decay_window_seconds;
  return timeAtFloor >= timeoutSeconds;
}

/** Checks if the listing's decay has crossed the batch-eligible threshold. */
export function isBatchEligible(listing: ListingForDecay, batchEligibleDecayPct: number): boolean {
  return decayFraction(listing) >= batchEligibleDecayPct;
}
