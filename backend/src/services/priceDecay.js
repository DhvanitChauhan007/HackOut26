/**
 * Price decay — computed at read time, no cron/scheduler.
 *
 * current_price = max(price_floor, list_price - (elapsed / decay_window) * (list_price - price_floor))
 */
function computeCurrentPrice(listing) {
  const { list_price, price_floor, decay_window_seconds, created_at } = listing;
  const elapsedSeconds = (Date.now() - new Date(created_at).getTime()) / 1000;

  if (elapsedSeconds <= 0) return list_price;
  if (elapsedSeconds >= decay_window_seconds) return price_floor;

  const decayAmount = (elapsedSeconds / decay_window_seconds) * (list_price - price_floor);
  return Math.max(price_floor, list_price - decayAmount);
}

/**
 * Returns the fraction of decay completed (0 = just listed, 1 = fully at floor).
 */
function decayFraction(listing) {
  const { decay_window_seconds, created_at } = listing;
  const elapsedSeconds = (Date.now() - new Date(created_at).getTime()) / 1000;
  return Math.min(1, Math.max(0, elapsedSeconds / decay_window_seconds));
}

/**
 * Checks if the price has been at the floor for at least `timeoutSeconds`.
 */
function isAtFloorForTimeout(listing, timeoutSeconds) {
  const { decay_window_seconds, created_at } = listing;
  const elapsedSeconds = (Date.now() - new Date(created_at).getTime()) / 1000;
  const timeAtFloor = elapsedSeconds - decay_window_seconds;
  return timeAtFloor >= timeoutSeconds;
}

/**
 * Checks if the listing's decay has crossed the batch-eligible threshold.
 * batchEligibleDecayPct = fraction of the way from list_price to price_floor.
 */
function isBatchEligible(listing, batchEligibleDecayPct) {
  return decayFraction(listing) >= batchEligibleDecayPct;
}

module.exports = { computeCurrentPrice, decayFraction, isAtFloorForTimeout, isBatchEligible };
