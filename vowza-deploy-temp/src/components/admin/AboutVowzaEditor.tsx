// ─── Admin: About Vowza Editor ────────────────────────────────────────────
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AboutVowzaEditorProps {
  initialTitle?: string;
  initialDescription?: string;
  initialMission?: string;
  initialVision?: string;
  onSave?: (title: string, description: string, mission: string, vision: string) => void;
}

export function AboutVowzaEditor({
  initialTitle = "Where Talent Meets Celebration",
  initialDescription = "",
  initialMission = "Our mission is to make event planning simple and accessible for everyone.",
  initialVision = "To become the most trusted event services platform in India.",
  onSave,
}: AboutVowzaEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [mission, setMission] = useState(initialMission);
  const [vision, setVision] = useState(initialVision);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!description.trim()) {
      toast.error("Story description is required");
      return;
    }

    if (!mission.trim()) {
      toast.error("Mission statement is required");
      return;
    }

    if (!vision.trim()) {
      toast.error("Vision statement is required");
      return;
    }

    try {
      setIsSaving(true);

      console.log("[AboutVowzaEditor] Saving About Vowza content:", {
        title,
        descriptionLength: description.length,
        missionLength: mission.length,
        visionLength: vision.length,
      });

      // Update the single About Us record using its fixed UUID
      const { error } = await supabase
        .from("about_us")
        .update({
          title: title.trim(),
          description: description.trim(),
          mission: mission.trim(),
          vision: vision.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", "00000000-0000-0000-0000-000000000001");

      if (error) {
        console.error("[AboutVowzaEditor] Supabase error:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }

      toast.success("About Vowza updated successfully!");
      onSave?.(title, description, mission, vision);
    } catch (err) {
      console.error("[AboutVowzaEditor] Error saving:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to save changes"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-6">
      <div>
        <h3 className="text-xl font-semibold text-foreground mb-4">
          About Vowza Content
        </h3>

        {/* Title Field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Where Talent Meets Celebration"
            className="w-full px-4 py-2 rounded-lg border border-border/60 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
          />
        </div>

        {/* Story/Description Field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Our Story
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell the story of Vowza..."
            rows={6}
            className="w-full px-4 py-2 rounded-lg border border-border/60 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#8B1538] resize-none"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Supports multiple paragraphs. Line breaks will be preserved.
          </p>
        </div>

        {/* Mission Field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            🎯 Our Mission
          </label>
          <textarea
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            placeholder="What is Vowza's mission?"
            rows={4}
            className="w-full px-4 py-2 rounded-lg border border-border/60 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#8B1538] resize-none"
          />
        </div>

        {/* Vision Field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            👁 Our Vision
          </label>
          <textarea
            value={vision}
            onChange={(e) => setVision(e.target.value)}
            placeholder="What is Vowza's vision?"
            rows={4}
            className="w-full px-4 py-2 rounded-lg border border-border/60 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#8B1538] resize-none"
          />
        </div>

        {/* Save Button */}
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#8B1538] hover:bg-[#6B0E28] text-white font-medium"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
