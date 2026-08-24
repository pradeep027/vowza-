import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://vavfeataqwwbpjonknne.supabase.co",
  "sb_publishable_Kd62nZ1jG5OHiCZaBjmMuw_CcZFYUWI"
);

async function testVendorSearch() {
  console.log("\n=== VENDOR SEARCH DATABASE TEST ===\n");

  // Step 1: Check profession enum values
  console.log("STEP 1: Query profession_type enum values");
  const { data: professions, error: profErr } = await supabase
    .from("artist_categories")
    .select("profession_type, name")
    .order("name");

  if (profErr) {
    console.error("ERROR:", profErr.message);
  } else {
    console.log(`Found ${professions?.length ?? 0} profession categories:`);
    professions?.forEach((p) =>
      console.log(`  - ${p.name} (${p.profession_type})`)
    );
  }

  // Step 2: Count photographers in database
  console.log("\n\nSTEP 2: Count photographers (all, unfiltered)");
  const { data: allPhotographers, error: photErr } = await supabase
    .from("provider_profiles")
    .select("id, profession, city", { count: "exact" })
    .eq("profession", "photographer");

  if (photErr) {
    console.error("ERROR:", photErr.message);
  } else {
    console.log(`Total photographers in database: ${allPhotographers?.length ?? 0}`);
    if (allPhotographers && allPhotographers.length > 0) {
      console.log("First 5:", allPhotographers.slice(0, 5));
    }
  }

  // Step 3: Count VERIFIED photographers
  console.log("\n\nSTEP 3: Count VERIFIED photographers");
  const { data: verifiedPhotos, error: verErr } = await supabase
    .from("provider_profiles")
    .select("id, profession, is_verified, is_published, verification_status", {
      count: "exact",
    })
    .eq("profession", "photographer")
    .eq("is_verified", true)
    .eq("is_published", true)
    .in("verification_status", ["approved", "verified"]);

  if (verErr) {
    console.error("ERROR:", verErr.message);
  } else {
    console.log(
      `Verified & published photographers: ${verifiedPhotos?.length ?? 0}`
    );
    if (verifiedPhotos && verifiedPhotos.length > 0) {
      console.log("First 3:", verifiedPhotos.slice(0, 3));
    }
  }

  // Step 4: Count photographers in Hyderabad
  console.log("\n\nSTEP 4: Count photographers in Hyderabad (with city check)");
  const { data: hyderabadPhotos, error: hydErr } = await supabase
    .from("provider_profiles")
    .select(
      `id, profession, is_verified, is_published, verification_status, user_id, 
       profiles(full_name, city, area)`,
      { count: "exact" }
    )
    .eq("profession", "photographer")
    .eq("is_verified", true)
    .eq("is_published", true)
    .in("verification_status", ["approved", "verified"]);

  if (hydErr) {
    console.error("ERROR:", hydErr.message);
  } else {
    const inHyderabad =
      hyderabadPhotos?.filter((p: any) =>
        p.profiles?.city?.toLowerCase().includes("hyderabad")
      ) ?? [];
    console.log(`Total verified photographers: ${hyderabadPhotos?.length ?? 0}`);
    console.log(`  in Hyderabad: ${inHyderabad.length}`);
    if (inHyderabad.length > 0) {
      console.log("First 3 photographers in Hyderabad:");
      inHyderabad.slice(0, 3).forEach((p: any) => {
        console.log(`  - ${p.profiles?.full_name} (${p.profiles?.city})`);
      });
    }
  }

  // Step 5: Test RPC directly
  console.log("\n\nSTEP 5: Test RPC search_vendors_sql for photographer, Hyderabad");
  const { data: rpcResult, error: rpcErr } = await supabase.rpc(
    "search_vendors_sql",
    {
      p_profession: "photographer",
      p_city: "Hyderabad",
      p_price_max: null,
      p_min_rating: 0,
      p_area: null,
      p_limit: 10,
    }
  );

  if (rpcErr) {
    console.error("RPC ERROR:", rpcErr.message);
  } else {
    console.log(`RPC returned: ${rpcResult?.length ?? 0} results`);
    if (rpcResult && rpcResult.length > 0) {
      console.log("First result:", rpcResult[0]);
    }
  }

  // Step 6: Count catering services
  console.log("\n\nSTEP 6: Count catering_services (all, unfiltered)");
  const { data: allCatering, error: cateringErr } = await supabase
    .from("provider_profiles")
    .select("id, profession, city", { count: "exact" })
    .eq("profession", "catering_services");

  if (cateringErr) {
    console.error("ERROR:", cateringErr.message);
  } else {
    console.log(`Total catering_services in database: ${allCatering?.length ?? 0}`);
    if (allCatering && allCatering.length > 0) {
      console.log("First 3:", allCatering.slice(0, 3));
    }
  }

  // Step 7: Test RPC for catering
  console.log("\n\nSTEP 7: Test RPC search_vendors_sql for catering_services, Hyderabad");
  const { data: cateringRpc, error: cateringRpcErr } = await supabase.rpc(
    "search_vendors_sql",
    {
      p_profession: "catering_services",
      p_city: "Hyderabad",
      p_price_max: null,
      p_min_rating: 0,
      p_area: null,
      p_limit: 10,
    }
  );

  if (cateringRpcErr) {
    console.error("RPC ERROR:", cateringRpcErr.message);
  } else {
    console.log(`RPC returned: ${cateringRpc?.length ?? 0} results`);
    if (cateringRpc && cateringRpc.length > 0) {
      console.log("First result:", cateringRpc[0]);
    }
  }

  // Step 8: Check all cities in database
  console.log("\n\nSTEP 8: All cities in profiles table");
  const { data: cities, error: citiesErr } = await supabase
    .from("profiles")
    .select("city", { count: "exact" })
    .not("city", "is", null)
    .then((r) => ({
      ...r,
      data: r.data ? [...new Set(r.data.map((p: any) => p.city))] : [],
    }));

  if (citiesErr) {
    console.error("ERROR:", citiesErr.message);
  } else {
    console.log(`Unique cities: ${(cities?.data as any[])?.length ?? 0}`);
    (cities?.data as any[])?.slice(0, 10).forEach((city) =>
      console.log(`  - ${city}`)
    );
  }

  console.log("\n=== END TEST ===\n");
}

testVendorSearch().catch(console.error);
