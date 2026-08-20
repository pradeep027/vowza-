// ─── Admin: About Us Management ────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertCircle } from "lucide-react";
import { AboutVowzaEditor } from "@/components/admin/AboutVowzaEditor";
import { FounderManager } from "@/components/admin/FounderManager";
import { CoFoundersManager } from "@/components/admin/CoFoundersManager";

interface AboutContent {
  id: string;
  title: string;
  description: string;
  mission: string;
  vision: string;
  updated_at: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo_url?: string;
  email?: string;
  linkedin_url?: string;
  member_type: "founder" | "co_founder";
  display_order: number;
  is_active: boolean;
}

export default function AdminAboutUs() {
  const [aboutContent, setAboutContent] = useState<AboutContent | null>(null);
  const [founder, setFounder] = useState<TeamMember | null>(null);
  const [coFounders, setCoFounders] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
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
        setAboutContent(aboutData);
      } else {
        // Create default if doesn't exist
        const { data: newAbout, error: createError } = await supabase
          .from("about_us")
          .insert({
            id: "00000000-0000-0000-0000-000000000001",
            title: "Where Talent Meets Celebration",
            description:
              "Vowza is the premier platform connecting event organizers with top-tier professionals. Our mission is to make event planning seamless, affordable, and stress-free.",
            mission: "Our mission is to make event planning simple and accessible for everyone.",
            vision: "To become the most trusted event services platform in India.",
          })
          .select()
          .single();

        if (createError) throw createError;
        if (newAbout) setAboutContent(newAbout);
      }

      // Fetch Team Members (admin can see all)
      const { data: teamData, error: teamError } = await supabase
        .from("about_team_members")
        .select("*")
        .order("member_type", { ascending: true })
        .order("display_order", { ascending: true });

      if (teamError) throw teamError;

      if (teamData) {
        const founderData = teamData.find((m) => m.member_type === "founder");
        if (founderData) {
          setFounder(founderData as TeamMember);
        }

        const coFoundersData = teamData.filter(
          (m) => m.member_type === "co_founder"
        );
        setCoFounders(coFoundersData as TeamMember[]);
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
          Manage Vowza's public About page content, founder, and co-founders
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
        onSave={() => {
          toast.success("About Vowza updated");
          fetchData();
        }}
      />

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Founder Manager */}
      <FounderManager
        founder={founder}
        onSave={(newFounder) => {
          setFounder(newFounder);
          toast.success("Founder updated");
        }}
      />

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Co-Founders Manager */}
      <CoFoundersManager
        coFounders={coFounders}
        onRefresh={fetchData}
      />

      {/* Info Box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">About Us Feature</p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-xs">
          <li>Changes are published immediately to the public About page</li>
          <li>Photos must be JPG, PNG, or WebP format (max 5MB)</li>
          <li>Maximum 1 founder and 6 co-founders</li>
          <li>Use the visibility toggle to show/hide co-founders without deleting</li>
          <li>Reorder team members using the arrow buttons</li>
        </ul>
      </div>
    </div>
  );
}
