// ─── Home Page ────────────────────────────────────────────────────────────────
import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import TrendingCategories from "@/components/TrendingCategories";
import BrowseByEvent from "@/components/BrowseByEvent";
import FeaturedCollections from "@/components/FeaturedCollections";
import HowItWorks from "@/components/HowItWorks";
import Footer from "@/components/Footer";
import WhyVowza from "@/components/WhyVowza";
import DownloadApp from "@/components/DownloadApp";
import FAQSection from "@/components/FAQSection";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Lightweight section skeleton used as Suspense fallback
const SectionSkeleton = () => (
  <div className="py-16 container px-4">
    <div className="skeleton h-8 w-48 rounded-xl mb-6" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton h-24 rounded-2xl" />
      ))}
    </div>
  </div>
);

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main>
      {/* Hero is synchronous — no boundary needed */}
      <Hero />

      {/* Dynamic sections — each wrapped independently so failures are isolated */}
      <ErrorBoundary>
        <Suspense fallback={<SectionSkeleton />}>
          <TrendingCategories />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary>
        <Suspense fallback={<SectionSkeleton />}>
          <FeaturedCollections />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary>
        <Suspense fallback={<SectionSkeleton />}>
          <BrowseByEvent />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary>
        <WhyVowza />
      </ErrorBoundary>

      <ErrorBoundary>
        <HowItWorks />
      </ErrorBoundary>

      <ErrorBoundary>
        <FAQSection />
      </ErrorBoundary>

      <ErrorBoundary>
        <DownloadApp />
      </ErrorBoundary>
    </main>
    <Footer />
  </div>
);

export default Index;
