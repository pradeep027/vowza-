/**
 * PERMANENT SELF-BOOKING PREVENTION
 * 
 * This function enforces that artists/vendors CANNOT book their own packages,
 * but CAN book packages from other artists/vendors.
 * 
 * Business Rule:
 * - If artist owns the package being booked → REJECT
 * - If artist is booking someone else's package → ALLOW
 * - If customer is booking any package → ALLOW
 * 
 * Implementation: Backend enforcement at RPC layer (cannot be bypassed by frontend manipulation)
 */

import { createClient } from "@supabase/supabase-js";

interface CreateBookingRequest {
  category: "catering" | "photography" | "dj" | "singer" | "dancer" | "band" | "priest" | "decorator" | "makeup" | "mehendi" | "water" | "rental" | "banquet" | "anchor" | "videography" | "drone";
  packageId: string;
  eventDate: string;
  eventTime?: string;
  venue?: string;
  notes?: string;
  guestCount?: number;
  addonIds?: string[];
  [key: string]: any;
}

// Map category to booking table
const BOOKING_TABLES: Record<string, string> = {
  catering: "catering_bookings",
  photography: "photography_package_bookings",
  dj: "dj_bookings",
  singer: "singer_bookings",
  dancer: "dancer_bookings",
  band: "band_bookings",
  priest: "priest_bookings",
  decorator: "decorator_bookings",
  makeup: "makeup_bookings",
  mehendi: "mehendi_bookings",
  water: "water_bookings",
  rental: "rental_bookings",
  banquet: "banquet_bookings",
  anchor: "anchor_bookings",
  videography: "videography_bookings",
  drone: "drone_bookings",
};

// Map category to provider ID column (photography uses "photographer_id", others use "provider_id")
const PROVIDER_COLUMNS: Record<string, string> = {
  photography: "photographer_id",
  videography: "videography_provider_id", // if it exists, fallback to provider_id
};

Deno.serve(async (req) => {
  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const body: CreateBookingRequest = await req.json();
    const { category, packageId, eventDate, eventTime, venue, notes, guestCount, addonIds = [] } = body;

    // Validate inputs
    if (!category || !packageId || !eventDate) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const bookingTable = BOOKING_TABLES[category];
    if (!bookingTable) {
      return new Response(JSON.stringify({ error: "Invalid category" }), { status: 400 });
    }

    // Create Supabase client with auth header
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), { status: 401 });
    }

    const userId = userData.user.id;

    // ────────────────────────────────────────────────────────────────────────────
    // CRITICAL: CHECK IF USER OWNS THE PACKAGE (SELF-BOOKING PREVENTION)
    // ────────────────────────────────────────────────────────────────────────────

    // Step 1: Get the package to find its provider_id
    const packageTableName = category === "photography" ? "photography_packages" : `${category}_packages`;
    
    const { data: pkgData, error: pkgError } = await supabase
      .from(packageTableName)
      .select("id, provider_id, photographer_id")
      .eq("id", packageId)
      .single();

    if (pkgError || !pkgData) {
      return new Response(JSON.stringify({ error: "Package not found" }), { status: 404 });
    }

    // Determine which provider column to use
    const providerColumn = PROVIDER_COLUMNS[category] || "provider_id";
    const packageProviderId = pkgData[providerColumn] || pkgData.provider_id;

    if (!packageProviderId) {
      return new Response(JSON.stringify({ error: "Package has no provider" }), { status: 400 });
    }

    // Step 2: Check if the current user owns this provider profile
    const { data: providerData, error: providerError } = await supabase
      .from("provider_profiles")
      .select("id, user_id")
      .eq("id", packageProviderId)
      .eq("user_id", userId)
      .single();

    // If provider is found (user owns it), reject the booking
    if (providerData && providerData.user_id === userId) {
      return new Response(
        JSON.stringify({
          error: "You cannot book your own package.",
          code: "SELF_BOOKING_PREVENTED",
        }),
        { status: 403 }
      );
    }

    // ────────────────────────────────────────────────────────────────────────────
    // BOOKING IS ALLOWED - PROCEED WITH INSERTION
    // ────────────────────────────────────────────────────────────────────────────

    // Prepare booking data based on category
    let bookingData: any = {
      package_id: packageId,
      [providerColumn]: packageProviderId,
      customer_id: userId,
      event_date: eventDate,
    };

    // Add optional fields
    if (eventTime) bookingData.event_time = eventTime;
    if (venue) bookingData.venue = venue;
    if (notes) bookingData.notes = notes;
    if (guestCount) bookingData.guest_count = guestCount;
    if (addonIds && addonIds.length > 0) bookingData.selected_addon_ids = addonIds;

    // Calculate amounts (if addon info provided in body)
    if ("baseAmount" in body) bookingData.base_amount = body.baseAmount;
    if ("addonsAmount" in body) bookingData.addons_amount = body.addonsAmount;
    if ("totalAmount" in body) bookingData.total_amount = body.totalAmount;

    // Insert booking
    const { data: bookingResult, error: insertError } = await supabase
      .from(bookingTable)
      .insert(bookingData)
      .select("id")
      .single();

    if (insertError) {
      console.error("Booking insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create booking", details: insertError.message }),
        { status: 400 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        bookingId: bookingResult.id,
        message: "Booking created successfully",
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: (error as Error).message }),
      { status: 500 }
    );
  }
});
