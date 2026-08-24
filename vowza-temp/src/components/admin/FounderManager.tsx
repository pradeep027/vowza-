// ─── Admin: Founder Manager ───────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Save, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Founder {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo_url?: string;
  linkedin_url?: string;
}

interface FounderManagerProps {
  founder?: Founder | null;
  onSave?: (founder: Founder) => void;
}

export function FounderManager({ founder, onSave }: FounderManagerProps) {
  const [name, setName] = useState(founder?.name || "");
  const [role, setRole] = useState(founder?.role || "Founder & CEO");
  const [bio, setBio] = useState(founder?.bio || "");
  const [linkedinUrl, setLinkedinUrl] = useState(founder?.linkedin_url || "");
  const [photoUrl, setPhotoUrl] = useState(founder?.photo_url || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(founder?.photo_url || "");

  useEffect(() => {
    if (founder) {
      setName(founder.name);
      setRole(founder.role);
      setBio(founder.bio);
      setLinkedinUrl(founder.linkedin_url || "");
      setPhotoUrl(founder.photo_url || "");
      setPhotoPreview(founder.photo_url || "");
    }
  }, [founder]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Please upload a JPG, PNG, or WebP image");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    try {
      setIsUploading(true);

      // Step 1: Upload new photo first (before deleting old)
      const timestamp = Date.now();
      const filename = `founder_${timestamp}_${file.name}`;

      const { data, error: uploadError } = await supabase.storage
        .from("about-us")
        .upload(filename, file, { upsert: false });

      if (uploadError) throw uploadError;

      // Step 2: Get public URL of new photo
      const {
        data: { publicUrl },
      } = supabase.storage.from("about-us").getPublicUrl(filename);

      // Step 3: Update database with new photo URL
      if (founder?.id) {
        const { error: updateError } = await supabase
          .from("about_team_members")
          .update({
            photo_url: publicUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", founder.id);

        if (updateError) throw updateError;
      }

      // Step 4: Only after database update succeeds, delete old photo
      if (photoUrl) {
        const oldFilename = photoUrl.split("/").pop();
        if (oldFilename) {
          // Best-effort deletion - don't throw if this fails
          await supabase.storage.from("about-us").remove([oldFilename]);
        }
      }

      // Step 5: Update UI only after everything succeeds
      setPhotoUrl(publicUrl);
      setPhotoPreview(publicUrl);
      toast.success("Photo uploaded successfully!");
    } catch (err) {
      console.error("[FounderManager] Upload error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to upload photo"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!photoUrl) return;

    const confirmDelete = window.confirm("Delete this profile photo?");
    if (!confirmDelete) return;

    try {
      setIsUploading(true);

      // Step 1: Delete from storage using complete filename
      const filename = photoUrl.split("/").pop();
      if (filename) {
        const { error: deleteError } = await supabase.storage
          .from("about-us")
          .remove([filename]);

        if (deleteError) throw deleteError;
      }

      // Step 2: Update database to set photo_url = NULL
      if (founder?.id) {
        const { error: updateError } = await supabase
          .from("about_team_members")
          .update({
            photo_url: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", founder.id);

        if (updateError) throw updateError;
      }

      // Step 3: Clear UI only after storage and database operations succeed
      setPhotoUrl("");
      setPhotoPreview("");
      toast.success("Photo deleted successfully!");
    } catch (err) {
      console.error("[FounderManager] Delete error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete photo"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Founder name is required");
      return;
    }

    if (!role.trim()) {
      toast.error("Founder role is required");
      return;
    }

    try {
      setIsSaving(true);

      // Log the operation for debugging
      console.log("[FounderManager] Save operation:", {
        operation: founder?.id ? "UPDATE" : "INSERT",
        founderId: founder?.id,
        name,
        role,
        bioLength: bio.length,
        hasPhoto: !!photoUrl,
      });

      if (founder?.id) {
        // Update existing founder
        // NOTE: Do NOT include display_order in UPDATE - preserve existing value
        console.log("[FounderManager] Executing UPDATE:", {
          table: "about_team_members",
          filterId: founder.id,
          columns: {
            name,
            role,
            bio,
            photo_url: photoUrl || null,
            updated_at: new Date().toISOString(),
          }
        });

        const { error } = await supabase
          .from("about_team_members")
          .update({
            name: name.trim(),
            role: role.trim(),
            bio: bio.trim(),
            photo_url: photoUrl || null,
            linkedin_url: linkedinUrl?.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", founder.id);

        if (error) {
          console.error("[FounderManager] UPDATE FAILED - Supabase Error:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            status: (error as any).status,
          });
          throw error;
        }

        console.log("[FounderManager] UPDATE succeeded");
      } else {
        // Create new founder
        // NOTE: Founder always gets display_order = 0
        const displayOrderValue: number = 0;

        if (!Number.isFinite(displayOrderValue)) {
          throw new Error(`Invalid display_order calculated: ${displayOrderValue}`);
        }

        console.log("[FounderManager] Executing INSERT:", {
          table: "about_team_members",
          columns: {
            name,
            role,
            bio,
            photo_url: photoUrl || null,
            member_type: "founder",
            display_order: displayOrderValue,
            is_active: true,
          }
        });

        const insertPayload = {
          name: name.trim(),
          role: role.trim(),
          bio: bio.trim(),
          photo_url: photoUrl || null,
          member_type: "founder",
          display_order: displayOrderValue as number,
          linkedin_url: linkedinUrl?.trim() || null,
          is_active: true,
        };

        console.log("[FounderManager] FINAL INSERT PAYLOAD:", insertPayload);

        const { data, error } = await supabase
          .from("about_team_members")
          .insert(insertPayload)
          .select()
          .single();

        if (error) {
          console.error("[FounderManager] INSERT FAILED - Supabase Error:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            status: (error as any).status,
          });
          throw error;
        }

        console.log("[FounderManager] INSERT succeeded", data);
        if (data) {
          onSave?.(data);
        }
      }

      toast.success("Founder saved successfully!");
    } catch (err) {
      console.error("[FounderManager] Error saving:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to save founder";
      console.error("[FounderManager] Final error message:", errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-6">
      <div>
        <h3 className="text-xl font-semibold text-foreground mb-4">
          Founder Profile
        </h3>

        {/* Photo Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-3">
            Founder Photo
          </label>
          <div className="flex gap-4">
            {photoPreview && (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Founder preview"
                  className="w-32 h-32 rounded-lg object-cover border border-border/60"
                />
                <button
                  onClick={handleDeletePhoto}
                  disabled={isUploading}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
                  title="Delete photo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex-1 flex items-center">
              <label className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-border/60 hover:border-[#8B1538] hover:bg-[#8B1538]/5 transition-all disabled:opacity-50">
                <Upload className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {isUploading ? "Uploading..." : photoPreview ? "Change Photo" : "Upload Photo"}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            JPG, PNG, or WebP. Max 5MB.
          </p>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Founder name"
            className="w-full px-4 py-2 rounded-lg border border-border/60 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
          />
        </div>

        {/* Role */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Role
          </label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g., Founder & CEO"
            className="w-full px-4 py-2 rounded-lg border border-border/60 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
          />
        </div>

        {/* Bio */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Founder bio..."
            rows={4}
            className="w-full px-4 py-2 rounded-lg border border-border/60 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#8B1538] resize-none"
          />
        </div>

        {/* LinkedIn URL */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            LinkedIn URL (Optional)
          </label>
          <input
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://www.linkedin.com/in/username"
            className="w-full px-4 py-2 rounded-lg border border-border/60 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
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
                Save Founder
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
