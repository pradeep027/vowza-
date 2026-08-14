/**
 * Real-Time Availability — Phase 7F
 *
 * Sync vendor calendars, implement 24-hour hold, show live availability
 * Integrates with provider_availability table for real-time vendor scheduling
 */

import type { DBVendor, PlannerContext } from './aiPlannerTypes';

export interface AvailabilitySlot {
  vendorId: string;
  vendorName: string;
  date: string;        // YYYY-MM-DD
  startTime: string;   // HH:mm
  endTime: string;     // HH:mm
  status: 'available' | 'booked' | 'hold' | 'maintenance';
  holdExpiresAt?: string; // ISO timestamp when hold expires (24 hours from booking)
  notes?: string;
}

export interface VendorCalendarStatus {
  vendorId: string;
  vendorName: string;
  profession: string;
  totalSlots: number;
  availableSlots: number;
  bookedSlots: number;
  holdSlots: number;
  nextAvailableDate?: string;
  lastUpdated: string;
}

export interface HoldRequest {
  vendorId: string;
  eventDate: string;  // YYYY-MM-DD
  holdId: string;     // unique hold identifier
  expiresAt: string;  // ISO timestamp (24 hours from now)
  eventDetails: {
    type: string;
    guestCount?: number;
    budget?: number;
  };
}

/**
 * Check if a vendor has availability on a specific date
 */
export function checkVendorAvailability(
  vendor: DBVendor,
  eventDate: string
): { available: boolean; reason?: string } {
  if (!vendor.provider_availability) {
    return { available: true, reason: 'No availability data — contact vendor' };
  }

  // Check if any availability slots exist for the date
  const slotsForDate = vendor.provider_availability.filter(slot => {
    return slot.date === eventDate && slot.status === 'available';
  });

  if (slotsForDate.length === 0) {
    return { available: false, reason: 'Fully booked on this date' };
  }

  return { available: true, reason: `${slotsForDate.length} slot(s) available` };
}

/**
 * Get all available slots for a vendor on a specific date
 */
export function getAvailableSlots(
  vendor: DBVendor,
  eventDate: string
): AvailabilitySlot[] {
  if (!vendor.provider_availability) return [];

  return vendor.provider_availability
    .filter(slot => {
      const isDateMatch = slot.date === eventDate;
      const isAvailable = slot.status === 'available';
      const notExpired = !slot.holdExpiresAt || new Date(slot.holdExpiresAt) > new Date();
      return isDateMatch && isAvailable && notExpired;
    })
    .map(slot => ({
      vendorId: vendor.id,
      vendorName: vendor.stage_name,
      date: slot.date,
      startTime: slot.startTime || '09:00',
      endTime: slot.endTime || '18:00',
      status: slot.status,
      holdExpiresAt: slot.holdExpiresAt,
      notes: slot.notes,
    }));
}

/**
 * Calculate next available date for vendor
 */
export function getNextAvailableDate(vendor: DBVendor): string | null {
  if (!vendor.provider_availability || vendor.provider_availability.length === 0) {
    return null;
  }

  // Find first available slot in future
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const availableSlots = vendor.provider_availability
    .filter(slot => {
      const slotDate = new Date(slot.date);
      const isInFuture = slotDate >= today;
      const isAvailable = slot.status === 'available';
      const notExpired = !slot.holdExpiresAt || new Date(slot.holdExpiresAt) > new Date();
      return isInFuture && isAvailable && notExpired;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return availableSlots.length > 0 ? availableSlots[0].date : null;
}

/**
 * Format availability status for display
 */
export function formatAvailabilityStatus(vendor: DBVendor, eventDate?: string): string {
  if (!vendor.provider_availability || vendor.provider_availability.length === 0) {
    return '⏱ No real-time availability data — contact vendor directly';
  }

  if (eventDate) {
    const check = checkVendorAvailability(vendor, eventDate);
    if (check.available) {
      const slots = getAvailableSlots(vendor, eventDate);
      return `✅ Available on ${eventDate} (${slots.length} slot${slots.length !== 1 ? 's' : ''})`;
    } else {
      return `❌ ${check.reason || 'Not available on this date'}`;
    }
  }

  // General availability overview
  const total = vendor.provider_availability.length;
  const available = vendor.provider_availability.filter(s => s.status === 'available').length;
  const booked = vendor.provider_availability.filter(s => s.status === 'booked').length;
  const nextDate = getNextAvailableDate(vendor);

  let status = `📅 ${available}/${total} slots available`;
  if (nextDate) {
    status += ` • Next: ${formatDateReadable(nextDate)}`;
  }
  return status;
}

/**
 * Format date in readable format
 */
export function formatDateReadable(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  return date.toLocaleDateString('en-IN', options);
}

/**
 * Create a 24-hour hold on vendor availability
 */
export function createHold(
  vendor: DBVendor,
  eventDate: string,
  eventDetails: { type: string; guestCount?: number; budget?: number }
): HoldRequest | null {
  const check = checkVendorAvailability(vendor, eventDate);
  if (!check.available) {
    return null; // Cannot hold unavailable date
  }

  const holdId = `hold_${vendor.id}_${Date.now()}`;
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  return {
    vendorId: vendor.id,
    eventDate,
    holdId,
    expiresAt: expiresAt.toISOString(),
    eventDetails,
  };
}

/**
 * Format hold expiration time
 */
export function formatHoldExpiration(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const hoursRemaining = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60));
  const minutesRemaining = Math.floor(
    ((expiry.getTime() - now.getTime()) % (1000 * 60 * 60)) / (1000 * 60)
  );

  if (hoursRemaining < 0) return 'Expired';
  if (hoursRemaining === 0) return `Expires in ${minutesRemaining} minutes`;
  return `Expires in ${hoursRemaining}h ${minutesRemaining}m`;
}

/**
 * Get vendor calendar status overview
 */
export function getCalendarStatus(vendor: DBVendor): VendorCalendarStatus {
  const availability = vendor.provider_availability || [];

  const total = availability.length;
  const available = availability.filter(s => s.status === 'available').length;
  const booked = availability.filter(s => s.status === 'booked').length;
  const hold = availability.filter(s => s.status === 'hold').length;

  return {
    vendorId: vendor.id,
    vendorName: vendor.stage_name,
    profession: vendor.profession || 'Vendor',
    totalSlots: total,
    availableSlots: available,
    bookedSlots: booked,
    holdSlots: hold,
    nextAvailableDate: getNextAvailableDate(vendor) || undefined,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Filter vendors by availability on specific date
 */
export function filterVendorsByAvailability(
  vendors: DBVendor[],
  eventDate: string
): { available: DBVendor[]; unavailable: DBVendor[] } {
  const available: DBVendor[] = [];
  const unavailable: DBVendor[] = [];

  vendors.forEach(vendor => {
    const check = checkVendorAvailability(vendor, eventDate);
    if (check.available) {
      available.push(vendor);
    } else {
      unavailable.push(vendor);
    }
  });

  return { available, unavailable };
}

/**
 * Format availability comparison table
 */
export function formatAvailabilityComparison(vendors: DBVendor[], eventDate: string): string {
  if (vendors.length === 0) return '';

  const { available, unavailable } = filterVendorsByAvailability(vendors, eventDate);

  let table = `## 📅 Availability for ${formatDateReadable(eventDate)}\n\n`;

  if (available.length > 0) {
    table += `### ✅ Available Vendors (${available.length})\n\n`;
    table += `| Vendor | Status | Next Slots |\n`;
    table += `|--------|--------|------------|\n`;

    available.forEach(vendor => {
      const slots = getAvailableSlots(vendor, eventDate);
      const times = slots.map(s => `${s.startTime}-${s.endTime}`).slice(0, 2).join(', ');
      table += `| **${vendor.stage_name}** | ✅ Available | ${times}${slots.length > 2 ? ' +more' : ''} |\n`;
    });

    table += '\n';
  }

  if (unavailable.length > 0) {
    table += `### ❌ Unavailable (${unavailable.length})\n\n`;
    table += `| Vendor | Status | Next Available |\n`;
    table += `|--------|--------|----------------|\n`;

    unavailable.forEach(vendor => {
      const nextDate = getNextAvailableDate(vendor);
      const nextDisplay = nextDate ? formatDateReadable(nextDate) : 'Unknown';
      table += `| **${vendor.stage_name}** | ❌ Booked | ${nextDisplay} |\n`;
    });
  }

  return table;
}

/**
 * Format live availability widget for LLM context
 */
export function buildLiveAvailabilityContext(
  vendors: DBVendor[],
  eventDate: string
): string {
  if (vendors.length === 0) return '';

  const { available, unavailable } = filterVendorsByAvailability(vendors, eventDate);

  let context = `\n**Real-Time Availability for ${formatDateReadable(eventDate)}:**\n`;

  if (available.length > 0) {
    context += `✅ ${available.length} vendor${available.length !== 1 ? 's' : ''} available:\n`;
    available.forEach(vendor => {
      const nextDate = getNextAvailableDate(vendor);
      context += `  - ${vendor.stage_name}${nextDate ? ` (next: ${formatDateReadable(nextDate)})` : ''}\n`;
    });
  }

  if (unavailable.length > 0) {
    context += `❌ ${unavailable.length} vendor${unavailable.length !== 1 ? 's' : ''} not available on this date\n`;
  }

  context += `\nRecommendation: Show available vendors first; offer alternatives with next available date.\n`;

  return context;
}

/**
 * Check if hold needs refresh (older than 1 hour)
 */
export function isHoldExpiringSoon(hold: HoldRequest): boolean {
  const now = new Date();
  const expiry = new Date(hold.expiresAt);
  const hoursUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntilExpiry < 1; // Expiring within next hour
}

/**
 * Format booking confirmation with hold details
 */
export function formatBookingWithHold(
  vendor: DBVendor,
  eventDate: string,
  hold: HoldRequest
): string {
  let confirmation = `## ✅ Hold Confirmed\n\n`;
  confirmation += `**Vendor:** ${vendor.stage_name}\n`;
  confirmation += `**Date:** ${formatDateReadable(eventDate)}\n`;
  confirmation += `**Hold ID:** ${hold.holdId}\n\n`;

  confirmation += `### ⏰ Important\n`;
  confirmation += `Your 24-hour hold is active. ${formatHoldExpiration(hold.expiresAt)}.\n\n`;

  confirmation += `✅ Slot is reserved\n`;
  confirmation += `✅ No other bookings allowed\n`;
  confirmation += `⏳ Complete booking to finalize\n\n`;

  confirmation += `[Complete Booking](javascript:void(0))  |  [Cancel Hold](javascript:void(0))\n`;

  return confirmation;
}
