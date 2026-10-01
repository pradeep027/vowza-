// ─── Supabase Edge Function: create-booking  (DEPRECATED / NEUTRALIZED) ──────
//
// ─── THE HOLE (why this file was rewritten) ──────────────────────────────────
// The previous version of this function was a second, parallel booking-creation
// path that:
//   1. Took the authoritative financial values base_amount / addons_amount /
//      total_amount STRAIGHT FROM THE REQUEST BODY and wrote them into the
//      per-category booking tables. A tampered client could POST total_amount=1.
//      This is exactly the browser-trust hole that Phase B closed on the live
//      path by moving every booking into the server-authoritative
//      public.create_<category>_booking(...) SECURITY DEFINER RPCs, which derive
//      every amount from trusted package/addon rows and force
//      customer_id = auth.uid().
//   2. Advertised itself as "all booking validations happen at backend (cannot
//      be bypassed)" — a FALSE guarantee, since the amounts were bypass-able.
//   3. Built its Supabase client from SUPABASE_SERVICE_ROLE_KEY with the caller's
//      Authorization forwarded. RLS applied only because of that forwarded
//      header; dropping it in a future refactor would have silently escalated
//      every query to full service-role (RLS bypass).
//
// This endpoint is DEAD on the live app: its only caller was
// src/hooks/useSafeBooking.ts, which no module imported. Every real booking
// surface (the per-category *Menu.tsx components, Checkout, BookingModal,
// useBookings, useEventPackages) calls the matching create_*_booking RPC
// directly, and its stale input shape cannot even supply the category-specific
// fields those RPCs expect.
//
// ─── THE FIX (ADDITIVE, safe on redeploy) ────────────────────────────────────
// This function no longer creates a database client, reads no financial field
// from the body, and inserts nothing. It authenticates the caller (so it is not
// an open endpoint) and returns 410 Gone directing any caller to the
// server-authoritative per-category RPC. Deploying this version over a
// previously-deployed insecure one closes the live hole through the normal
// `supabase functions deploy` flow — no financial value can cross the trust
// boundary here anymore.
//
// Deploy:  supabase functions deploy create-booking
//          (or remove it entirely:  supabase functions delete create-booking)

Deno.serve((req) => {
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Still enforce authz presence — this must never be an anonymous endpoint.
  if (!req.headers.get("authorization")) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Booking creation is server-authoritative in the database. There is nothing
  // safe for this edge function to do with client-supplied amounts, so it does
  // nothing and says so.
  return json(
    {
      error:
        "create-booking is deprecated. Booking creation is server-authoritative: " +
        "call the public.create_<category>_booking RPC, which derives all amounts " +
        "server-side and binds the booking to the authenticated customer.",
      code: "DEPRECATED_USE_RPC",
    },
    410,
  );
});
