/**
 * Booking Handler — Phase 7A
 *
 * Handles booking_request intent by:
 * 1. Extracting vendor reference from message (name, ordinal, previous mention)
 * 2. Finding vendor in the prior AI response's trusted vendor list
 * 3. Generating a deep link into Vowza's existing booking flow
 * 4. Saving booking intent to conversation history
 *
 * NOTE: Vendors are DBVendor records from the marketplace retriever — they are
 * keyed by `provider_id` (provider_profiles.id). No vendor data is invented here.
 */

import { DBVendor, PlannerContext, EventBudgetPlan } from './aiPlannerTypes';
import { ChatMessage } from './aiPlannerTypes';

export interface BookingResponse {
  vendorId: string | null;
  vendorName: string;
  vendorProfession: string;
  bookingUrl: string | null;
  message: string;
  action: 'show_calendar' | 'redirect_to_vendor' | 'ask_which_vendor';
}

/**
 * Extract vendor reference from booking message
 * Looks for explicit vendor name or ordinal reference ("first one", "that one")
 */
function extractVendorReference(message: string, vendors: DBVendor[]): string | null {
  const msgLower = message.toLowerCase().trim();

  // Ordinal references: "the first one", "second photographer", "that one"
  const ordinalMatch = msgLower.match(/(?:the\s+)?(first|second|third|1st|2nd|3rd|1|2|3)(?:\s+one)?/i);
  if (ordinalMatch) {
    const index = ['first', '1st', '1'].includes(ordinalMatch[1].toLowerCase()) ? 0
      : ['second', '2nd', '2'].includes(ordinalMatch[1].toLowerCase()) ? 1
      : ['third', '3rd', '3'].includes(ordinalMatch[1].toLowerCase()) ? 2
      : 0;
    if (vendors[index]) {
      return vendors[index].provider_id;
    }
  }

  // Exact name match: "Book Arpita Photography"
  for (const vendor of vendors) {
    const vendorName = vendor.stage_name?.toLowerCase() || '';
    if (vendorName && msgLower.includes(vendorName)) {
      return vendor.provider_id;
    }
  }

  // Partial name match: "Book Arpita"
  for (const vendor of vendors) {
    const nameParts = vendor.stage_name?.toLowerCase().split(' ') || [];
    for (const part of nameParts) {
      if (part.length > 3 && msgLower.includes(part)) {
        return vendor.provider_id;
      }
    }
  }

  return null;
}

/**
 * Find vendor by provider ID within the trusted vendor list. History search is
 * unnecessary because callers pass the full trusted set from the most recent
 * vendor_results response (see getPriorVendorsFromHistory).
 */
function findVendorById(
  providerId: string,
  currentVendors: DBVendor[]
): DBVendor | null {
  return currentVendors.find(v => v.provider_id === providerId) ?? null;
}

/**
 * Generate booking URL/link for vendor
 * Routes to vendor profile with booking parameters pre-filled
 */
/**
 * Deep link into Vowza's EXISTING booking flow.
 *
 * Routes are /artist/:id and /provider/:id (both render ProviderProfile, which
 * opens BookingModal). Query params pre-fill context for the booking modal —
 * they never replace the real flow.
 */
function generateBookingUrl(vendor: DBVendor, context: PlannerContext, plan: EventBudgetPlan | null): string {
  const params = new URLSearchParams({
    from: 'ai-planner',
    event_type: context.eventType || '',
    city: context.city || '',
    budget: (context.budget || 0).toString(),
    guests: (context.guestCount || 0).toString(),
    profession: vendor.profession || '',
  });

  if (plan) {
    const allocation = plan.allocations?.find(
      a => a.category.toLowerCase().includes(vendor.profession?.toLowerCase() || '')
    );
    if (allocation) {
      params.append('allocated_budget', allocation.allocatedAmount.toString());
    }
  }

  return `/artist/${vendor.provider_id}?${params.toString()}`;
}

/**
 * Handle booking_request intent
 *
 * @param message User's booking message ("Book this photographer")
 * @param priorVendors Vendors from prior search or plan
 * @param context Current event context
 * @param plan Current budget plan (if any)
 * @returns BookingResponse with vendor info and booking action
 */
export async function handleBookingRequest(
  message: string,
  priorVendors: DBVendor[],
  context: PlannerContext,
  plan: EventBudgetPlan | null
): Promise<BookingResponse> {
  // If no prior vendors, we can't process booking
  if (!priorVendors || priorVendors.length === 0) {
    return {
      vendorId: null,
      vendorName: 'Unknown',
      vendorProfession: 'vendor',
      bookingUrl: null,
      message: `I'd love to help you book! Could you tell me which vendor you'd like to book, or share their name? You can also say "Show me [profession] again" to see the list.`,
      action: 'ask_which_vendor',
    };
  }

  // Try to extract vendor reference
  const vendorId = extractVendorReference(message, priorVendors);

  if (!vendorId) {
    // Couldn't identify specific vendor
    if (priorVendors.length === 1) {
      // Only one vendor shown, assume that one
      const vendor = priorVendors[0];
      const bookingUrl = generateBookingUrl(vendor, context, plan);

  return {
    vendorId: vendor.provider_id,
    vendorName: vendor.stage_name || vendor.full_name || 'Vendor',
    vendorProfession: vendor.profession || 'professional',
    bookingUrl,
    message: `Great! I'm taking you to **${vendor.stage_name || vendor.full_name}**'s Vowza profile with your event details pre-filled.\n\n[Open ${vendor.stage_name || vendor.full_name}'s profile](${bookingUrl})\n\nFrom there you can review packages and start the booking — they'll confirm availability and discuss details with you directly in Vowza.`,
    action: 'show_calendar',
  };
    }

    // Multiple vendors, need clarification
    const vendorList = priorVendors
      .slice(0, 3)
      .map((v, i) => `${i + 1}. ${v.stage_name || v.full_name || 'Vendor'} (⭐ ${v.average_rating || 0}/5)`)
      .join('\n');

    return {
      vendorId: null,
      vendorName: 'Unknown',
      vendorProfession: 'vendor',
      bookingUrl: null,
      message: `Which vendor would you like to book? Here are the options:\n\n${vendorList}\n\nYou can say "Book the first one" or "Book [vendor name]".`,
      action: 'ask_which_vendor',
    };
  }

  // Found vendor, resolve it from the trusted list
  const vendor = findVendorById(vendorId, priorVendors);
  if (!vendor) {
    return {
      vendorId: null,
      vendorName: 'Unknown',
      vendorProfession: 'vendor',
      bookingUrl: null,
      message: `I couldn't find that vendor in our system. Could you try again or select from the list above?`,
      action: 'ask_which_vendor',
    };
  }

  const bookingUrl = generateBookingUrl(vendor, context, plan);

  // Build booking confirmation message
  const eventTypeLabel = context.eventType ? `${context.eventType} event` : 'event';
  const guestLabel = context.guestCount ? ` for ${context.guestCount} guests` : '';

  return {
    vendorId: vendor.provider_id,
    vendorName: vendor.stage_name || vendor.full_name || 'Vendor',
    vendorProfession: vendor.profession || 'professional',
    bookingUrl,
    message: `✨ **Booking ${vendor.stage_name || vendor.full_name}** for your ${eventTypeLabel}${guestLabel}\n\n📅 **Check availability & book**\n[Open their Vowza profile to book](${bookingUrl})\n\n**What happens next:**\n1. Review their packages and pricing on the profile\n2. Open the booking calendar and select your preferred date & time\n3. Add event details and confirm your booking request\n\nThe vendor will respond to your request inside Vowza. Have questions? You can chat with them directly from their profile.`,
    action: 'show_calendar',
  };
}

/**
 * Format booking response for streaming display
 */
export function formatBookingResponse(booking: BookingResponse): string {
  return booking.message;
}

/**
 * Generate booking confirmation data for storing in conversation
 */
export function generateBookingData(
  booking: BookingResponse,
  context: PlannerContext,
  plan: EventBudgetPlan | null
) {
  return {
    type: 'booking_request',
    vendor_id: booking.vendorId,
    vendor_name: booking.vendorName,
    vendor_profession: booking.vendorProfession,
    booking_url: booking.bookingUrl,
    action: booking.action,
    event_context: {
      event_type: context.eventType,
      city: context.city,
      budget: context.budget,
      guest_count: context.guestCount,
    },
    plan_allocations: plan?.allocations || [],
    timestamp: new Date().toISOString(),
  };
}
