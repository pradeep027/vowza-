// ─── Admin: About Vowza Editor ────────────────────────────────────────────
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Save, Upload, X, AlertCircle } from "lucide-react";
import {
  updateAboutContent,
  verifyAboutHeroImageUrl,
  uploadAboutHeroImage,
  removeAboutHeroImage,
} from "../api/aboutContent";

interface AboutVowzaEditorProps {
  initialTitle?: string;
  initialDescription?: string;
  initialMission?: string;
  initialVision?: string;
  initialHeroImageUrl?: string;
  onSave?: (title: string, description: string, mission: string, vision: string, heroImageUrl?: string) => void;
}

export function AboutVowzaEditor({
  initialTitle = "Where Talent Meets Celebration",
  initialDescription = "",
  initialMission = "Our mission is to make event planning simple and accessible for everyone.",
  initialVision = "To become the most trusted event-planning ecosystem in India.",
  initialHeroImageUrl = "",
  onSave,
}: AboutVowzaEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [mission, setMission] = useState(initialMission);
  const [vision, setVision] = useState(initialVision);
  const [heroImageUrl, setHeroImageUrl] = useState(initialHeroImageUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(heroImageUrl);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log("[AboutVowzaEditor] No file selected");
      return;
    }

    console.log("[AboutVowzaEditor] File selected:", {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeInMB: (file.size / 1024 / 1024).toFixed(2),
    });

    // Validate file type
    if (!file.type.startsWith("image/")) {
      console.error("[AboutVowzaEditor] Invalid file type:", file.type);
      toast.error("Please select a valid image file (JPG, PNG, or WebP)");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      console.error("[AboutVowzaEditor] File too large:", file.size);
      toast.error("Image must be less than 5MB");
      return;
    }

    console.log("[AboutVowzaEditor] File validation passed, creating preview");
    setPreviewFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      console.log("[AboutVowzaEditor] Preview URL created");
      setPreviewUrl(dataUrl);
    };
    reader.onerror = (err) => {
      console.error("[AboutVowzaEditor] FileReader error:", err);
      toast.error("Failed to preview image");
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = async () => {
    if (!previewFile) {
      console.warn("[AboutVowzaEditor] No preview file to upload");
      toast.error("No image selected");
      return;
    }

    try {
      setIsUploading(true);
      console.log("[AboutVowzaEditor] Upload starting for:", previewFile.name);

      // Upload to Supabase Storage via the CMS API boundary
      const publicUrl = await uploadAboutHeroImage(previewFile);

      // **CRITICAL: Set the URL immediately**
      setHeroImageUrl(publicUrl);
      setPreviewFile(null);

      toast.success("Image uploaded successfully! Click 'Save Changes' to publish.");
      console.log("[AboutVowzaEditor] Upload complete, URL is ready to save");
    } catch (err) {
      console.error("[AboutVowzaEditor] Error uploading image:", err);
      const errorMsg =
        err instanceof Error ? err.message : "Failed to upload image";
      toast.error(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!heroImageUrl) {
      console.warn("[AboutVowzaEditor] No image URL to remove");
      return;
    }

    try {
      console.log("[AboutVowzaEditor] Removing image from Storage:", heroImageUrl);

      await removeAboutHeroImage(heroImageUrl);

      setHeroImageUrl("");
      setPreviewUrl("");
      setPreviewFile(null);

      toast.success("Image removed successfully!");
    } catch (err) {
      console.error("[AboutVowzaEditor] Error removing image:", err);
      toast.error(err instanceof Error ? err.message : "Failed to remove image");
    }
  };

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
        title: title.trim().substring(0, 50),
        descriptionLength: description.length,
        missionLength: mission.length,
        visionLength: vision.length,
        heroImageUrl: heroImageUrl ? `${heroImageUrl.substring(0, 50)}...` : "null",
      });

      // Update the single About Us record via the CMS API boundary
      console.log("[AboutVowzaEditor] About to save with heroImageUrl:", heroImageUrl ? `${heroImageUrl.substring(0, 50)}...` : "NULL");

      const updatedData = await updateAboutContent({
        title: title.trim(),
        description: description.trim(),
        mission: mission.trim(),
        vision: vision.trim(),
        heroImageUrl: heroImageUrl || undefined,
      });

      console.log("[AboutVowzaEditor] Update response - updatedData:", updatedData ? `ID=${updatedData.id}, hero_image_url=${updatedData.hero_image_url ? updatedData.hero_image_url.substring(0, 50) + "..." : "NULL"}` : "NULL");

      console.log("[AboutVowzaEditor] Database update successful");
      console.log("[AboutVowzaEditor] Saved record:", {
        hero_image_url: updatedData?.hero_image_url ? `${updatedData.hero_image_url.substring(0, 80)}...` : null,
      });

      // VERIFICATION: Perform a fresh SELECT to confirm database persistence
      const storedHeroImageUrl = await verifyAboutHeroImageUrl();

      if (storedHeroImageUrl === null && updatedData?.hero_image_url) {
        console.error("[AboutVowzaEditor] Verification query failed");
      } else {
        console.log("[AboutVowzaEditor] VERIFICATION - Fresh database SELECT:", {
          hero_image_url: storedHeroImageUrl ? `${storedHeroImageUrl.substring(0, 80)}...` : null,
        });
        if (storedHeroImageUrl !== (updatedData?.hero_image_url ?? null)) {
          console.error("[AboutVowzaEditor] MISMATCH: Updated data does not match fresh SELECT!");
        } else {
          console.log("[AboutVowzaEditor] ✓ Confirmed: Database contains the image URL");
        }
      }

      toast.success("About Vowza updated successfully!");
      onSave?.(title, description, mission, vision, heroImageUrl);
    } catch (err) {
      console.error("[AboutVowzaEditor] Error saving:", err);
      const errorMsg =
        err instanceof Error ? err.message : "Failed to save changes";
      toast.error(errorMsg);
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

        {/* Hero Image Upload */}
        <div className="mb-6 p-4 border border-border/60 rounded-lg bg-background">
          <label className="block text-sm font-medium text-foreground mb-3">
            📸 About Us Hero Image
          </label>
          <p className="text-xs text-muted-foreground mb-4">
            Upload an image to display in the hero section of the About Us page. Max 5MB. Recommended: square aspect ratio.
          </p>

          {/* Image Preview */}
          {previewUrl && (
            <div className="mb-4">
              <div className="w-full max-w-xs aspect-square rounded-lg overflow-hidden border border-border/60 bg-slate-100">
                <img src={previewUrl} alt="Hero preview" className="w-full h-full object-cover" />
              </div>
            </div>
          )}

          {/* Upload Area */}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => {
                console.log("[AboutVowzaEditor] Upload button clicked");
                fileInputRef.current?.click();
              }}
              disabled={isUploading}
              className="flex-1 px-4 py-2 rounded-lg border border-border/60 bg-background text-foreground font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {heroImageUrl || previewFile ? "Change Image" : "Upload Hero Image"}
            </button>

            {(heroImageUrl || previewFile) && (
              <button
                type="button"
                onClick={() => {
                  setPreviewFile(null);
                  setPreviewUrl("");
                }}
                disabled={isUploading}
                className="px-4 py-2 rounded-lg border border-border/60 bg-background text-foreground hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Upload Button (if preview exists but not saved) */}
          {previewFile && !isUploading && (
            <button
              type="button"
              onClick={handleImageUpload}
              className="mt-2 w-full px-4 py-2 rounded-lg bg-[#8B1538] hover:bg-[#6B0E28] text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Confirm Upload
            </button>
          )}

          {isUploading && (
            <div className="mt-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center gap-3 text-sm text-blue-700 dark:text-blue-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading image...
            </div>
          )}

          {/* Remove Button (if saved) */}
          {heroImageUrl && !previewFile && (
            <button
              type="button"
              onClick={handleRemoveImage}
              disabled={isUploading}
              className="mt-2 w-full px-4 py-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 font-medium hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Remove Image
            </button>
          )}
        </div>

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
            disabled={isSaving || isUploading}
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
