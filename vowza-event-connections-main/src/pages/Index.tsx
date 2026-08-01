// ─── Home Page — Corporate Premium Edition ───────────────────────────────────
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import TrendingCategories from "@/components/TrendingCategories";
import BrowseByEvent from "@/components/BrowseByEvent";
import FeaturedCollections from "@/components/FeaturedCollections";
import HowItWorks from "@/components/HowItWorks";
import TestimonialsSection from "@/components/TestimonialsSection";
import Footer from "@/components/Footer";
import WhyVowza from "@/components/WhyVowza";
import DownloadApp from "@/components/DownloadApp";
import FAQSection from "@/components/FAQSection";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main>
      <Hero />
      <TrendingCategories />
      <FeaturedCollections />
      <BrowseByEvent />
      <WhyVowza />
      <HowItWorks />
      <TestimonialsSection />
      <FAQSection />
      <DownloadApp />
    </main>
    <Footer />
  </div>
);

export default Index;
