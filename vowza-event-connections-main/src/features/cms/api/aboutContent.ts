// ─── CMS feature API — About Us content ──────────────────────────────────────
// Single data-access boundary for the CMS/About feature.
// Pages and components in features/cms must NOT call the Supabase client
// directly; they go through these typed functions only.
// Behavior is preserved verbatim from the original page/component implementations.

import { supabase } from "@/integrations/supabase/client";

/** Fixed singleton row id used by the About Us content. */
const ABOUT_US_ID = "00000000-0000-0000-0000-000000000001";

/** Storage bucket holding the About Us hero image. */
const ABOUT_US_BUCKET = "about-us";

/** Smallest CMS-specific domain type for the About Us content row. */
export interface AboutContent {
  id: string;
  title: string;
  description: string;
  mission: string;
  vision: string;
  hero_image_url?: string;
  updated_at?: string;
}

function isNoRowError(error: { code?: string | null } | null): boolean {
  return error?.code === "PGRST116";
}

/**
 * Public About page fetch. Tries hero_image_url first and falls back to a
 * select without it if the column does not exist. Resolves to null when the
 * row is absent (PGRST116); throws on any other error.
 */
export async function fetchAboutContent(): Promise<AboutContent | null> {
  // First try with hero_image_url, fall back to without it if column doesn't exist
  let { data: aboutRawData, error: aboutError } = await supabase
    .from("about_us")
    .select("id, title, description, mission, vision, hero_image_url")
    .eq("id", ABOUT_US_ID)
    .single();

  if (aboutError && aboutError.message?.includes("does not exist")) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("about_us")
      .select("id, title, description, mission, vision")
      .eq("id", ABOUT_US_ID)
      .single();

    aboutRawData = fallbackData;
    aboutError = fallbackError;
  }

  if (aboutError && !isNoRowError(aboutError)) throw aboutError;

  return (aboutRawData as AboutContent) ?? null;
}

/**
 * Admin fetch: whole row, null when absent (PGRST116); throws otherwise.
 */
export async function fetchAdminAboutContent(): Promise<AboutContent | null> {
  const { data: aboutData, error: aboutError } = await supabase
    .from("about_us")
    .select("*")
    .limit(1)
    .single();

  if (aboutError && !isNoRowError(aboutError)) throw aboutError;

  return (aboutData as AboutContent) ?? null;
}

/**
 * Creates the default About Us row when none exists. Exact values preserved
 * from the original AdminAboutUs implementation.
 */
export async function ensureDefaultAboutContent(): Promise<AboutContent | null> {
  const { data: newAbout, error: createError } = await supabase
    .from("about_us")
    .insert({
      id: ABOUT_US_ID,
      title: "Where Talent Meets Celebration",
      description:
        "Vowza is the premier platform connecting event organizers with top-tier professionals. Our mission is to make event planning seamless, affordable, and stress-free.",
      mission: "Our mission is to make event planning simple and accessible for everyone.",
      vision: "To become the most trusted event services platform in India.",
    })
    .select()
    .single();

  if (createError) throw createError;
  return (newAbout as AboutContent) ?? null;
}

export interface UpdateAboutContentInput {
  title: string;
  description: string;
  mission: string;
  vision: string;
  heroImageUrl?: string;
}

/**
 * Updates the single About Us record and returns the updated row.
 * Exact update shape, filter, and select columns preserved.
 */
export async function updateAboutContent(
  input: UpdateAboutContentInput,
): Promise<AboutContent | null> {
  const { data: updatedData, error } = await supabase
    .from("about_us")
    .update({
      title: input.title,
      description: input.description,
      mission: input.mission,
      vision: input.vision,
      hero_image_url: input.heroImageUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ABOUT_US_ID)
    .select("id, title, description, mission, vision, hero_image_url, updated_at")
    .single();

  if (error) {
    console.error("[AboutVowzaEditor] Supabase database error:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  return (updatedData as AboutContent) ?? null;
}

/**
 * Fresh SELECT used after saving to confirm database persistence.
 * Returns the stored hero_image_url (null when absent).
 */
export async function verifyAboutHeroImageUrl(): Promise<string | null> {
  const { data: verifyData, error: verifyError } = await supabase
    .from("about_us")
    .select("hero_image_url")
    .eq("id", ABOUT_US_ID)
    .single();

  if (verifyError) {
    console.error("[AboutVowzaEditor] Verification query failed:", verifyError);
    return null;
  }

  return verifyData?.hero_image_url ?? null;
}

/**
 * Uploads the hero image to the about-us storage bucket and returns its
 * public URL. Filename scheme and upload options preserved exactly.
 */
export async function uploadAboutHeroImage(file: File): Promise<string> {
  // Generate unique filename
  const timestamp = Date.now();
  const sanitizedName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/\.([^.]*)$/, (match, ext) => `.${ext}`);
  const filename = `hero-image-${timestamp}-${sanitizedName}`;

  console.log("[AboutVowzaEditor] Generated filename:", filename);

  const { data, error } = await supabase.storage
    .from(ABOUT_US_BUCKET)
    .upload(filename, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("[AboutVowzaEditor] Storage upload error:", {
      message: error.message,
      name: error.name,
    });
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  console.log("[AboutVowzaEditor] Upload successful, path:", data.path);

  const { data: publicUrlData } = supabase.storage
    .from(ABOUT_US_BUCKET)
    .getPublicUrl(data.path);

  console.log("[AboutVowzaEditor] Public URL generated:", publicUrlData.publicUrl);
  return publicUrlData.publicUrl;
}

/**
 * Removes the stored hero image file extracted from its public URL.
 * Preserves the original filename-extraction behavior.
 */
export async function removeAboutHeroImage(heroImageUrl: string): Promise<void> {
  const url = new URL(heroImageUrl);
  const pathParts = url.pathname.split("/");
  const filename = pathParts[pathParts.length - 1];

  console.log("[AboutVowzaEditor] Extracted filename:", filename);

  if (filename) {
    const { error } = await supabase.storage
      .from(ABOUT_US_BUCKET)
      .remove([filename]);

    if (error) {
      console.error("[AboutVowzaEditor] Storage remove error:", error);
      throw error;
    }
    console.log("[AboutVowzaEditor] File removed from Storage");
  }
}
