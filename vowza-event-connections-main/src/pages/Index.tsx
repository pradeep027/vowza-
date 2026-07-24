import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import TrendingCategories from "@/components/TrendingCategories";
import ServiceCategories from "@/components/ServiceCategories";
import BrowseByEvent from "@/components/BrowseByEvent";
import FeaturedCollections from "@/components/FeaturedCollections";
import HowItWorks from "@/components/HowItWorks";
import TestimonialsSection from "@/components/TestimonialsSection";
import GallerySection from "@/components/GallerySection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* 1. Hero — primary acquisition */}
        <Hero />

        {/* 2. Trending Categories — 15-icon scrollable grid */}
        <TrendingCategories />

        {/* 3. Service Categories — existing 6-card grid, preserved */}
        <ServiceCategories />

        {/* 4. Browse by Event — 12 event type cards */}
        <BrowseByEvent />

        {/* 5. Featured Collections — 5 curated artist groups */}
        <FeaturedCollections />

        {/* 6. How It Works — dual-tab customer + artist flow */}
        <HowItWorks />

        {/* 9. Testimonials — customer success stories */}
        <TestimonialsSection />

        {/* 10. Gallery — Instagram-style event photo grid */}
        <GallerySection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
