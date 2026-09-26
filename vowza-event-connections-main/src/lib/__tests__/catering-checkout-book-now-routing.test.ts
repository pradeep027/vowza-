/**
 * BUG FIX — the generic Checkout cart path never worked for per-plate catering.
 *
 * BEFORE: Checkout.tsx routed EVERY unrecognised bookingTable (including
 * 'catering_bookings') through one generic INSERT that wrote `event_time` and
 * `special_requirements` — columns catering_bookings does NOT have — and carried
 * NO guest_count, the per-plate pricing multiplier. So a cart checkout of a
 * catering package could only ever fail at the database with a confusing column
 * error; it never produced a valid booking.
 *
 * AFTER: catering is given its own branch that stops the broken generic INSERT
 * and tells the user to use the package's "Book Now" flow
 * (CateringBookingModal -> CateringCartPage -> create_catering_booking), which
 * collects the guest count and derives every amount server-side. This is a
 * behaviour change (a clear error instead of a silent DB failure), tracked here
 * in its own commit rather than hidden inside the financial-authority change.
 * It also aligns with financial authority: there is no cart-side catering INSERT
 * left that could carry client-supplied amounts once the column lockdown lands.
 *
 * STATIC / CONTRACT guard (no DB): proves the catering branch exists, routes to
 * Book Now, and never runs the generic amount-carrying INSERT.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CHECKOUT_TSX = readFileSync(
  fileURLToPath(new URL('../../pages/Checkout.tsx', import.meta.url)),
  'utf8',
);

describe('Checkout — per-plate catering is routed to Book Now, not the broken generic INSERT', () => {
  it('has a dedicated catering_bookings branch', () => {
    expect(CHECKOUT_TSX).toMatch(/item\.bookingTable === 'catering_bookings'/);
  });

  it('the catering branch routes to Book Now and never runs a generic INSERT', () => {
    const cateringBranch = (CHECKOUT_TSX.match(
      /item\.bookingTable === 'catering_bookings'\)\s*\{([\s\S]*?)\}\s*else\s*\{/,
    ) ?? ['', ''])[1];
    expect(cateringBranch.length).toBeGreaterThan(0);
    // no generic amount-carrying INSERT in the catering branch...
    expect(cateringBranch).not.toMatch(/\.insert\(/);
    // ...and it points the user at the Book Now flow instead.
    expect(cateringBranch).toMatch(/Book Now/i);
  });
});
