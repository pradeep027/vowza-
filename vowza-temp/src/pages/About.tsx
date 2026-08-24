// ─── About Us Public Page — Premium Redesign ──────────────────────────────────
// Elegant, minimal company profile page with founder, mission/vision, and co-founder grid
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Footer from "@/components/Footer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ExternalLink } from "lucide-react";

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
      <div className="min-h-screen flex flex-col bg-stone-50">
        <main className="flex-1">
          {/* SECTION 1: Company Introduction — Premium & Compact */}
          <section className="w-full py-16 md:py-20 lg:py-24">
            <div className="max-w-3xl mx-auto px-4 md:px-6">
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-4 tracking-tight">
                About Vowza
              </h1>
              
              <div className="space-y-4 text-base md:text-lg text-stone-700 leading-relaxed">
                <p>
                  Vowza is an AI-powered event planning and service platform built to make every celebration simple, smart, and seamless.
                </p>
                <p>
                  We connect customers with verified event professionals and artists, helping them discover, compare, plan, and book the right services for their special occasions.
                </p>
                <p>
                  With Vowza Planner, our intelligent AI assistant helps users understand their event requirements, plan budgets and schedules, discover suitable services, and simplify the entire event-planning journey.
                </p>
                <p>
                  Vowza also empowers event professionals with digital visibility, customer opportunities, and business growth.
                </p>
                
                {/* Premium closing statement */}
                <p className="pt-2 font-medium text-stone-900 italic">
                  From the first idea to the final celebration, Vowza brings everything together in one trusted ecosystem.
                </p>
              </div>
            </div>
          </section>

          {/* Subtle divider */}
          <div className="w-full h-px bg-stone-200" />

          {/* SECTION 2: Founder Profile — Refined & Balanced */}
          {founder && !isLoading && (
            <section className="w-full py-16 md:py-20">
              <div className="max-w-4xl mx-auto px-4 md:px-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 items-center">
                  {/* Founder Photo — LEFT */}
                  {founder.photo_url && (
                    <div className="md:col-span-1">
                      <img
                        src={founder.photo_url}
                        alt={founder.name}
                        className="w-48 h-48 md:w-56 md:h-56 rounded-lg object-cover shadow-sm border border-stone-200"
                      />
                    </div>
                  )}

                  {/* Founder Details — RIGHT */}
                  <div className={founder.photo_url ? "md:col-span-2" : "md:col-span-3"}>
                    <h2 className="text-2xl md:text-3xl font-serif font-bold text-stone-900 mb-1">
                      {founder.name}
                    </h2>
                    <p className="text-sm md:text-base text-stone-600 font-medium mb-4">
                      {founder.role}
                    </p>
                    
                    {founder.bio && (
                      <p className="text-base text-stone-700 leading-relaxed mb-4">
                        {founder.bio}
                      </p>
                    )}

                    {/* LinkedIn Link */}
                    {founder.linkedin_url && (
                      <a
                        href={founder.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
                        </svg>
                        View on LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Subtle divider */}
          <div className="w-full h-px bg-stone-200" />

          {/* SECTION 3: Our Story */}
          {aboutContent?.description && (
            <section className="w-full py-16 md:py-20">
              <div className="max-w-3xl mx-auto px-4 md:px-6">
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-stone-900 mb-6">
                  Our Story
                </h2>
                <p className="text-base text-stone-700 leading-relaxed">
                  {aboutContent.description}
                </p>
              </div>
            </section>
          )}

          {/* Subtle divider */}
          <div className="w-full h-px bg-stone-200" />

          {/* SECTION 4: Mission & Vision — Premium Cards */}
          <section className="w-full py-16 md:py-20">
            <div className="max-w-4xl mx-auto px-4 md:px-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Mission Card */}
                {aboutContent?.mission && (
                  <div className="space-y-3 p-6 rounded-lg border border-stone-200 bg-white hover:shadow-md transition-shadow">
                    <h3 className="text-lg font-serif font-bold text-stone-900">
                      🎯 Our Mission
                    </h3>
                    <p className="text-sm text-stone-700 leading-relaxed">
                      {aboutContent.mission}
                    </p>
                  </div>
                )}

                {/* Vision Card */}
                {aboutContent?.vision && (
                  <div className="space-y-3 p-6 rounded-lg border border-stone-200 bg-white hover:shadow-md transition-shadow">
                    <h3 className="text-lg font-serif font-bold text-stone-900">
                      👁 Our Vision
                    </h3>
                    <p className="text-sm text-stone-700 leading-relaxed">
                      {aboutContent.vision}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Subtle divider */}
          <div className="w-full h-px bg-stone-200" />

          {/* SECTION 5: Co-Founders — Premium 4-Column Responsive Grid */}
          {coFounders.length > 0 && (
            <section className="w-full py-16 md:py-20">
              <div className="max-w-6xl mx-auto px-4 md:px-6">
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-stone-900 mb-10">
                  Leadership Team
                </h2>

                {/* Responsive Grid: 1 col mobile, 2 tablet, 4 desktop */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {coFounders.map((cofounder) => (
                    <div
                      key={cofounder.id}
                      className="group rounded-lg border border-stone-200 bg-white overflow-hidden hover:shadow-lg transition-all duration-300"
                    >
                      {/* Photo */}
                      {cofounder.photo_url && (
                        <div className="overflow-hidden bg-stone-100 h-56">
                          <img
                            src={cofounder.photo_url}
                            alt={cofounder.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      )}

                      {/* Content */}
                      <div className="p-5 space-y-3">
                        <div>
                          <h3 className="text-base font-serif font-bold text-stone-900 line-clamp-2">
                            {cofounder.name}
                          </h3>
                          <p className="text-xs text-stone-600 font-medium mt-1">
                            {cofounder.role}
                          </p>
                        </div>

                        {cofounder.bio && (
                          <p className="text-xs text-stone-700 leading-relaxed line-clamp-3">
                            {cofounder.bio}
                          </p>
                        )}

                        {/* LinkedIn Link */}
                        {cofounder.linkedin_url && (
                          <a
                            href={cofounder.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors pt-2"
                            title="View LinkedIn profile"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span className="text-xs font-medium">LinkedIn</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
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
