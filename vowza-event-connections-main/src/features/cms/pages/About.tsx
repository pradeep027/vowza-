// ─── Vowza About Us — Premium Editorial Design with Uploadable Hero Image ───
// Reference-inspired: premium, minimal, editorial, modern
import { useState, useEffect } from "react";
import Footer from "@/components/Footer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { fetchAboutContent, type AboutContent } from "../api/aboutContent";

// Hero Image Container — displays uploaded image or fallback
const HeroImageContainer = ({ imageUrl }: { imageUrl?: string }) => {
  console.log("[HeroImageContainer] RECEIVED imageUrl:", imageUrl ? `${imageUrl.substring(0, 100)}...` : "NULL/UNDEFINED");
  
  return (
    <div className="relative w-full h-full min-h-64 md:min-h-80 flex items-center justify-center rounded-2xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200">
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt="Vowza Hero"
            className="w-full h-full object-cover"
            loading="lazy"
            onLoad={() => console.log("[HeroImageContainer] ✓ Image loaded successfully")}
            onError={(err) => console.error("[HeroImageContainer] ✗ Image load failed:", err)}
          />
        </>
      ) : (
        <>
          <div className="flex flex-col items-center justify-center h-full w-full p-8 text-center">
            <div className="text-6xl font-display font-bold text-gold mb-4">V</div>
            <p className="text-lg font-semibold text-slate-900 mb-2">Vowza</p>
            <p className="text-sm text-slate-600">Plan • Connect • Celebrate</p>
          </div>
        </>
      )}
    </div>
  );
};

export default function About() {
  const [aboutData, setAboutData] = useState<AboutContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAboutData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch About Us content with hero image URL via the CMS API boundary
        const data = await fetchAboutContent();

        if (data) {
          setAboutData(data);
          console.log("[About.tsx] RECEIVED DATA from database:", {
            id: data.id,
            hero_image_url: data.hero_image_url ? `${data.hero_image_url.substring(0, 100)}...` : "NULL",
          });
        } else {
          console.log("[About.tsx] No About Us data found - query returned no results");
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
      <div className="min-h-screen flex flex-col bg-white overflow-x-hidden">
        <main className="flex-1">
          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* HERO — Proper responsive two-column layout with uploadable image */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          <section className="w-full py-20 md:py-28 lg:py-32 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto w-full">
              {/* Desktop: 2-column grid | Mobile: 1-column stacked */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 w-full">
                {/* LEFT: Hero Text — NO overflow */}
                <div className="flex flex-col justify-center min-w-0">
                  {/* Eyebrow */}
                  <div className="flex items-center gap-2 mb-6 sm:mb-8">
                    <span className="inline-block w-6 sm:w-8 h-px bg-gold flex-shrink-0"></span>
                    <span className="text-xs font-bold tracking-widest text-gold uppercase whitespace-nowrap">
                      About Vowza
                    </span>
                  </div>

                  {/* Main Headline — guaranteed no clipping */}
                  <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold text-slate-900 mb-6 sm:mb-8 leading-tight break-words">
                    The future of event planning starts here.
                  </h1>

                  {/* Primary Description */}
                  <p className="text-base sm:text-lg md:text-xl text-slate-700 mb-4 sm:mb-6 leading-relaxed font-medium break-words">
                    {aboutData?.description || "Vowza brings people, event professionals, and intelligent planning together in one connected platform."}
                  </p>

                  {/* Secondary Description */}
                  <p className="text-sm sm:text-base md:text-lg text-slate-600 leading-relaxed break-words">
                    Simplifying the discovery, organization, and execution of celebrations through technology.
                  </p>
                </div>

                {/* RIGHT: Hero Image — contained, responsive */}
                <div className="hidden lg:flex items-center justify-center min-w-0 w-full">
                  <div className="w-full max-w-md aspect-square">
                    <HeroImageContainer imageUrl={aboutData?.hero_image_url} />
                  </div>
                </div>
              </div>

              {/* Mobile Image — below text on mobile */}
              <div className="mt-12 sm:mt-16 lg:hidden w-full flex justify-center px-2">
                <div className="w-full max-w-xs aspect-square">
                  <HeroImageContainer imageUrl={aboutData?.hero_image_url} />
                </div>
              </div>
            </div>
          </section>

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* MISSION + VISION — Premium composition */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          <section className="w-full py-20 md:py-28 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
              <div className="border border-slate-300 rounded-3xl overflow-hidden bg-white shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-300">
                  {/* Mission */}
                  <div className="p-12 md:p-16 relative">
                    {/* Icon */}
                    <div className="absolute top-8 right-8 w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
                      <span className="text-lg">🎯</span>
                    </div>

                    <div className="flex items-baseline gap-4 mb-8">
                      <span className="text-6xl md:text-7xl font-bold text-gold/20">01</span>
                    </div>

                    <h3 className="text-2xl md:text-3xl font-display font-bold text-slate-900 mb-4">
                      Our Mission
                    </h3>

                    <p className="text-base md:text-lg text-slate-700 leading-relaxed mb-4 font-medium">
                      Make event planning simple, accessible, and reliable.
                    </p>

                    <p className="text-sm md:text-base text-slate-600 leading-relaxed">
                      We connect people with trusted event professionals through one seamless platform, removing friction and stress from planning celebrations.
                    </p>
                  </div>

                  {/* Vision */}
                  <div className="p-12 md:p-16 relative">
                    {/* Icon */}
                    <div className="absolute top-8 right-8 w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
                      <span className="text-lg">👁️</span>
                    </div>

                    <div className="flex items-baseline gap-4 mb-8">
                      <span className="text-6xl md:text-7xl font-bold text-gold/20">02</span>
                    </div>

                    <h3 className="text-2xl md:text-3xl font-display font-bold text-slate-900 mb-4">
                      Our Vision
                    </h3>

                    <p className="text-base md:text-lg text-slate-700 leading-relaxed mb-4 font-medium">
                      India's most trusted event-planning ecosystem.
                    </p>

                    <p className="text-sm md:text-base text-slate-600 leading-relaxed">
                      A future where technology makes event planning transparent, personalized, and effortless—where every celebration happens the way it should.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* WE BELIEVE */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          <section className="w-full py-28 md:py-36 lg:py-40 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gold/5 via-gold/3 to-transparent relative">
            {/* Decorative elements */}
            <div className="absolute top-8 right-12 w-3 h-3 rounded-full bg-gold/40"></div>
            <div className="absolute bottom-12 left-12 w-2 h-2 rounded-full bg-gold/30"></div>

            <div className="max-w-4xl mx-auto text-center relative z-10">
              <span className="inline-block text-xs font-bold tracking-widest text-gold uppercase mb-8">
                We Believe
              </span>

              <h2 className="text-5xl sm:text-6xl md:text-7xl font-display font-bold text-slate-900 leading-tight mb-8">
                Great celebrations should be about the moment — not the stress behind it.
              </h2>

              {/* Decorative star */}
              <div className="flex justify-center">
                <span className="text-gold text-2xl">✦</span>
              </div>
            </div>
          </section>

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* CLOSING — Dark navy section like reference */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          <section className="w-full py-28 md:py-36 lg:py-40 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-900 to-slate-800 relative overflow-hidden">
            {/* Decorative stars */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-10 left-1/4 w-1 h-1 bg-gold rounded-full"></div>
              <div className="absolute top-20 right-1/3 w-1.5 h-1.5 bg-gold rounded-full"></div>
              <div className="absolute bottom-20 left-1/3 w-1 h-1 bg-gold rounded-full"></div>
              <div className="absolute bottom-10 right-1/4 w-1 h-1 bg-gold rounded-full"></div>
            </div>

            <div className="max-w-4xl mx-auto text-center relative z-10">
              <h2 className="text-5xl sm:text-6xl md:text-7xl font-display font-bold text-white leading-tight mb-8">
                Plan less.<br />
                Celebrate more.
              </h2>

              <p className="text-lg md:text-xl text-slate-100 leading-relaxed">
                Vowza is building a simpler way to bring every celebration together.
              </p>
            </div>
          </section>

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* ERROR STATE */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {error && !isLoading && (
            <section className="w-full py-12 md:py-16 px-4 sm:px-6 lg:px-8">
              <div className="max-w-2xl mx-auto">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
                  <p className="font-semibold mb-1">Error loading content</p>
                  <p>{error}</p>
                </div>
              </div>
            </section>
          )}
        </main>

        <Footer />
      </div>
    </ErrorBoundary>
  );
}
