// ─── Admin: About Us Management ────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, AlertCircle } from "lucide-react";
import { AboutVowzaEditor } from "../components/AboutVowzaEditor";
import {
  fetchAdminAboutContent,
  ensureDefaultAboutContent,
  type AboutContent,
} from "../api/aboutContent";

export default function AdminAboutUs() {
  const [aboutContent, setAboutContent] = useState<AboutContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch About Us content via the CMS API boundary
      const aboutData = await fetchAdminAboutContent();

      if (aboutData) {
        setAboutContent(aboutData);
      } else {
        // Create default if doesn't exist
        const newAbout = await ensureDefaultAboutContent();
        if (newAbout) setAboutContent(newAbout);
      }
    } catch (err) {
      console.error("[AdminAboutUs] Error fetching:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load data"
      );
      toast.error("Failed to load About Us content");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#8B1538] animate-spin" />
          <p className="text-sm text-muted-foreground">Loading About Us management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">
          About Us Management
        </h1>
        <p className="text-muted-foreground">
          Manage Vowza's public About page content and hero image
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <p className="font-medium">Error loading data</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* About Vowza Editor */}
      <AboutVowzaEditor
        initialTitle={aboutContent?.title}
        initialDescription={aboutContent?.description}
        initialMission={aboutContent?.mission}
        initialVision={aboutContent?.vision}
        initialHeroImageUrl={aboutContent?.hero_image_url}
        onSave={() => {
          toast.success("About Vowza updated");
          fetchData();
        }}
      />

      {/* Info Box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">About Us Management</p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-xs">
          <li>Edit the About Us content and hero image from this dashboard</li>
          <li>Hero image must be JPG, PNG, or WebP format (max 5MB)</li>
          <li>Changes are published immediately to the public About page</li>
        </ul>
      </div>
    </div>
  );
}
