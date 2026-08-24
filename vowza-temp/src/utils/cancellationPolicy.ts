/**
 * Vowza Cancellation Refund Policy
 * Calculates refund based on exact time remaining before event.
 *
 * >= 5 days:       95% refund
 * >= 4, < 5 days:  90% refund
 * >= 3, < 4 days:  80% refund
 * >= 48hrs, < 3 days: 50% refund
 * < 48 hours:      0% refund
 */

export interface CancellationResult {
  hoursRemaining: number;
  policyTier: '5_plus_days' | '4_days' | '3_days' | '48_hours' | 'under_48';
  refundPercentage: number;
  refundAmount: number;
  amountRetained: number;
  tierLabel: string;
}

/**
 * Calculate cancellation refund.
 * @param eventDate - ISO date string (YYYY-MM-DD)
 * @param eventTime - Optional time string (HH:MM)
 * @param amountPaid - Actual eligible amount paid by customer
 * @param now - Current timestamp (defaults to Date.now())
 */
export function calculateCancellationRefund(
  eventDate: string,
  eventTime: string | null | undefined,
  amountPaid: number,
  now?: number
): CancellationResult {
  // Build event timestamp — use event time if available, else assume start of day
  const eventStr = eventTime
    ? `${eventDate}T${eventTime}:00`
    : `${eventDate}T00:00:00`;
  const eventTs = new Date(eventStr).getTime();
  const currentTs = now ?? Date.now();

  const diffMs = eventTs - currentTs;
  const hoursRemaining = Math.max(0, diffMs / (1000 * 60 * 60));

  // Determine tier
  let policyTier: CancellationResult['policyTier'];
  let refundPercentage: number;
  let tierLabel: string;

  const FIVE_DAYS = 5 * 24;
  const FOUR_DAYS = 4 * 24;
  const THREE_DAYS = 3 * 24;
  const TWO_DAYS = 48;

  if (hoursRemaining >= FIVE_DAYS) {
    policyTier = '5_plus_days';
    refundPercentage = 95;
    tierLabel = '5+ days before event — 95% refund';
  } else if (hoursRemaining >= FOUR_DAYS) {
    policyTier = '4_days';
    refundPercentage = 90;
    tierLabel = '4-5 days before event — 90% refund';
  } else if (hoursRemaining >= THREE_DAYS) {
    policyTier = '3_days';
    refundPercentage = 80;
    tierLabel = '3-4 days before event — 80% refund';
  } else if (hoursRemaining >= TWO_DAYS) {
    policyTier = '48_hours';
    refundPercentage = 50;
    tierLabel = '48hrs-3 days before event — 50% refund';
  } else {
    policyTier = 'under_48';
    refundPercentage = 0;
    tierLabel = 'Less than 48 hours — No refund';
  }

  const refundAmount = Math.round(amountPaid * refundPercentage / 100);
  const amountRetained = amountPaid - refundAmount;

  return {
    hoursRemaining: Math.round(hoursRemaining * 100) / 100,
    policyTier,
    refundPercentage,
    refundAmount,
    amountRetained,
    tierLabel,
  };
}

/** Format hours remaining as human-readable string */
export function formatTimeRemaining(hours: number): string {
  if (hours >= 48) {
    const days = Math.floor(hours / 24);
    const remainingHrs = Math.round(hours % 24);
    return remainingHrs > 0 ? `${days} days ${remainingHrs} hours` : `${days} days`;
  }
  return `${Math.round(hours)} hours`;
}
