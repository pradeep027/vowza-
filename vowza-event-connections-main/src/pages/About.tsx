// ─── About Us Public Page ──────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AboutHero } from "@/components/about/AboutHero";
import { AboutContent } from "@/components/about/AboutContent";
import { FounderSection } from "@/components/about/FounderSection";
import { CoFoundersGrid } from "@/components/about/CoFoundersGrid";
import Footer from "@/components/Footer";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface AboutContent {
  title: string;
  description: string;
  mission: string;
  vision: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio?: string;
  photo_url?: string;
  email?: string;
  linkedin_url?: string;
  member_type: "founder" | "co_founder";
  display_order: number;
  is_active: boolean;
}

export default function About() {
  const [aboutContent, setAboutContent] = useState<AboutContent | null>(null);
  const [founder, setFounder] = useState<TeamMember | null>(null);
  const [coFounders, setCoFounders] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAboutData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch About Us content
        const { data: aboutData, error: aboutError } = await supabase
          .from("about_us")
          .select("*")
          .limit(1)
          .single();

        if (aboutError && aboutError.code !== "PGRST116") {
          // PGRST116 = no rows found, which is acceptable
          throw aboutError;
        }

        if (aboutData) {
          setAboutContent({
            title: aboutData.title || "About Vowza",
            description: aboutData.description || "",
            mission: aboutData.mission || "",
            vision: aboutData.vision || "",
          });
        }

        // Fetch Team Members (public reads only active members)
        const { data: teamData, error: teamError } = await supabase
          .from("about_team_members")
          .select("*")
          .eq("is_active", true)
          .order("display_order", { ascending: true });

        if (teamError) throw teamError;

        if (teamData) {
          const founderData = teamData.find((m) => m.member_type === "founder");
          if (founderData) {
            setFounder(founderData as TeamMember);
          }

          const coFoundersData = teamData.filter((m) => m.member_type === "co_founder");
          setCoFounders(coFoundersData as TeamMember[]);
        }
      } catch (err) {
        console.error("[About] Error fetching data:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load About Us content"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchAboutData();
  }, []);

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-background">
        {/* Main content */}
        <main className="flex-1">
          {/* Hero */}
          <AboutHero 
            title={aboutContent?.title || "About Vowza"}
            subtitle="Where Talent Meets Celebration"
          />

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* Two-Column Intro Section: Founder LEFT + About Content RIGHT */}
          <section className="w-full py-12 md:py-16">
            <div className="max-w-6xl mx-auto px-4 md:px-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start">
                {/* LEFT: Founder Profile */}
                <div>
                  {(founder || isLoading) && (
                    <FounderSection founder={founder || undefined} isLoading={isLoading} />
                  )}
                </div>

                {/* RIGHT: About Vowza Content (Story, Mission, Vision) */}
                <div>
                  <AboutContent
                    story={aboutContent?.description}
                    mission={aboutContent?.mission}
                    vision={aboutContent?.vision}
                    isLoading={isLoading}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* Co-Founders Grid */}
          {(coFounders.length > 0 || isLoading) && (
            <CoFoundersGrid coFounders={coFounders} isLoading={isLoading} />
          )}

          {/* Error State */}
          {error && (
            <section className="w-full py-12 md:py-16">
              <div className="max-w-2xl mx-auto px-4 md:px-6">
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <p className="font-medium">Error loading content</p>
                  <p className="mt-1">{error}</p>
                </div>
              </div>
            </section>
          )}
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </ErrorBoundary>
  );
}
