// ─── Admin: Co-Founders Manager ───────────────────────────────────────────────
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Upload,
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CoFounder {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo_url?: string;
  display_order: number;
  is_active: boolean;
}

interface CoFoundersManagerProps {
  coFounders: CoFounder[];
  onRefresh?: () => void;
}

export function CoFoundersManager({ coFounders, onRefresh }: CoFoundersManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<CoFounder>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleEdit = (coFounder: CoFounder) => {
    setEditingId(coFounder.id);
    setFormData({ ...coFounder });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({});
  };

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    cofounderId: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Please upload a JPG, PNG, or WebP image");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    try {
      setIsUploading(true);

      // Step 1: Upload new photo first
      const timestamp = Date.now();
      const filename = `cofounders_${timestamp}_${file.name}`;

      const { data, error: uploadError } = await supabase.storage
        .from("about-us")
        .upload(filename, file, { upsert: false });

      if (uploadError) throw uploadError;

      // Step 2: Get public URL of new photo
      const {
        data: { publicUrl },
      } = supabase.storage.from("about-us").getPublicUrl(filename);

      // Step 3: Update database with new photo URL
      const { error: updateError } = await supabase
        .from("about_team_members")
        .update({
          photo_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cofounderId);

      if (updateError) throw updateError;

      // Step 4: Only after database update succeeds, delete old photo
      if (formData.photo_url) {
        const oldFilename = formData.photo_url.split("/").pop();
        if (oldFilename) {
          // Best-effort deletion - don't throw if this fails
          await supabase.storage.from("about-us").remove([oldFilename]);
        }
      }

      // Step 5: Update UI only after everything succeeds
      setFormData({
        ...formData,
        photo_url: publicUrl,
      });
      toast.success("Photo uploaded successfully!");
    } catch (err) {
      console.error("[CoFoundersManager] Upload error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to upload photo"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePhoto = async (photoUrl?: string) => {
    if (!photoUrl && !formData.photo_url) return;

    const confirmDelete = window.confirm("Delete this profile photo?");
    if (!confirmDelete) return;

    try {
      setIsUploading(true);

      const urlToDelete = photoUrl || formData.photo_url;
      
      // Step 1: Delete from storage using complete filename
      if (urlToDelete) {
        const filename = urlToDelete.split("/").pop();
        if (filename) {
          const { error: deleteError } = await supabase.storage
            .from("about-us")
            .remove([filename]);

          if (deleteError) throw deleteError;
        }
      }

      // Step 2: Update database to set photo_url = NULL
      if (editingId) {
        const { error: updateError } = await supabase
          .from("about_team_members")
          .update({
            photo_url: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);

        if (updateError) throw updateError;
      }

      // Step 3: Clear UI only after storage and database operations succeed
      setFormData({ ...formData, photo_url: "" });
      toast.success("Photo deleted successfully!");
    } catch (err) {
      console.error("[CoFoundersManager] Delete error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete photo"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!formData.role?.trim()) {
      toast.error("Role is required");
      return;
    }

    try {
      setIsSaving(true);

      const { error } = await supabase
        .from("about_team_members")
        .update({
          name: formData.name?.trim(),
          role: formData.role?.trim(),
          bio: formData.bio?.trim() || "",
          photo_url: formData.photo_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingId);

      if (error) {
        console.error("[CoFoundersManager] Supabase error:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }

      toast.success("Co-founder updated successfully!");
      setEditingId(null);
      setFormData({});
      onRefresh?.();
    } catch (err) {
      console.error("[CoFoundersManager] Error saving:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to save co-founder"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCoFounder = async () => {
    try {
      setIsSaving(true);

      const { data, error } = await supabase
        .from("about_team_members")
        .insert({
          name: "New Co-Founder",
          role: "Co-Founder",
          bio: "",
          member_type: "co_founder",
          display_order: Math.max(...coFounders.map((c) => c.display_order)) + 1 || 0,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Co-founder added successfully!");
      onRefresh?.();
    } catch (err) {
      console.error("[CoFoundersManager] Error adding:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to add co-founder"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (cofounderId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this co-founder? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      setIsDeleting(cofounderId);

      // Find the co-founder to get their photo URL
      const coFounderToDelete = coFounders.find((c) => c.id === cofounderId);
      
      // Step 1: Delete photo from storage if it exists
      if (coFounderToDelete?.photo_url) {
        const filename = coFounderToDelete.photo_url.split("/").pop();
        if (filename) {
          const { error: deleteError } = await supabase.storage
            .from("about-us")
            .remove([filename]);

          // Log error but continue with database deletion
          if (deleteError) {
            console.error("[CoFoundersManager] Storage delete error:", deleteError);
          }
        }
      }

      // Step 2: Delete the co-founder record
      const { error } = await supabase
        .from("about_team_members")
        .delete()
        .eq("id", cofounderId);

      if (error) throw error;

      toast.success("Co-founder deleted successfully!");
      onRefresh?.();
    } catch (err) {
      console.error("[CoFoundersManager] Error deleting:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete co-founder"
      );
    } finally {
      setIsDeleting(null);
    }
  };

  const handleToggleActive = async (cofounderId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("about_team_members")
        .update({ is_active: !isActive })
        .eq("id", cofounderId);

      if (error) throw error;

      toast.success(
        isActive ? "Co-founder hidden" : "Co-founder shown"
      );
      onRefresh?.();
    } catch (err) {
      console.error("[CoFoundersManager] Error toggling:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to update co-founder"
      );
    }
  };

  const handleReorder = async (cofounderId: string, direction: "up" | "down") => {
    const index = coFounders.findIndex((c) => c.id === cofounderId);
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === coFounders.length - 1) return;

    const otherIndex = direction === "up" ? index - 1 : index + 1;
    const other = coFounders[otherIndex];

    try {
      const { error: err1 } = await supabase
        .from("about_team_members")
        .update({ display_order: other.display_order })
        .eq("id", cofounderId);

      const { error: err2 } = await supabase
        .from("about_team_members")
        .update({ display_order: coFounders[index].display_order })
        .eq("id", other.id);

      if (err1 || err2) throw err1 || err2;

      toast.success("Order updated!");
      onRefresh?.();
    } catch (err) {
      console.error("[CoFoundersManager] Error reordering:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to reorder"
      );
    }
  };

  if (coFounders.length === 0) {
    return (
      <div className="space-y-6 bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-6">
        <div>
          <h3 className="text-xl font-semibold text-foreground mb-4">
            Co-Founders ({coFounders.length}/6)
          </h3>
          <p className="text-muted-foreground mb-4">
            No co-founders added yet.
          </p>
          <Button
            onClick={handleAddCoFounder}
            disabled={isSaving}
            className="bg-[#8B1538] hover:bg-[#6B0E28] text-white font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Co-Founder
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-6">
      <div>
        <h3 className="text-xl font-semibold text-foreground mb-4">
          Co-Founders ({coFounders.length}/6)
        </h3>

        {/* Co-Founders List */}
        <div className="space-y-4 mb-6">
          {coFounders.map((coFounder, index) => (
            <div key={coFounder.id} className="border border-border/40 rounded-lg p-4">
              {editingId === coFounder.id ? (
                // Edit Form
                <div className="space-y-4">
                  {/* Photo Upload in Edit */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Photo
                    </label>
                    <div className="flex gap-4">
                      {(formData.photo_url || coFounder.photo_url) && (
                        <div className="relative">
                          <img
                            src={formData.photo_url || coFounder.photo_url}
                            alt="Preview"
                            className="w-20 h-20 rounded-lg object-cover border border-border/60"
                          />
                          <button
                            onClick={() =>
                              handleDeletePhoto(formData.photo_url || coFounder.photo_url)
                            }
                            disabled={isUploading}
                            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
                            title="Delete photo"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <label className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-border/60 hover:border-[#8B1538] text-sm disabled:opacity-50">
                        <Upload className="w-3 h-3" />
                        <span>{isUploading ? "Uploading..." : (formData.photo_url || coFounder.photo_url) ? "Change Photo" : "Upload"}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) =>
                            handlePhotoUpload(e, coFounder.id)
                          }
                          disabled={isUploading}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={formData.name || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 bg-background"
                    />
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Role
                    </label>
                    <input
                      type="text"
                      value={formData.role || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, role: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 bg-background"
                    />
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Bio
                    </label>
                    <textarea
                      value={formData.bio || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, bio: e.target.value })
                      }
                      rows={2}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 bg-background resize-none"
                    />
                  </div>

                  {/* Save/Cancel */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      size="sm"
                      className="bg-[#8B1538] hover:bg-[#6B0E28] text-white"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      onClick={handleCancel}
                      disabled={isSaving}
                      size="sm"
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                // Display View
                <div className="flex items-center gap-4">
                  {/* Photo */}
                  {coFounder.photo_url && (
                    <img
                      src={coFounder.photo_url}
                      alt={coFounder.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground truncate">
                      {coFounder.name}
                    </h4>
                    <p className="text-sm text-muted-foreground truncate">
                      {coFounder.role}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    {/* Toggle Active */}
                    <button
                      onClick={() =>
                        handleToggleActive(coFounder.id, coFounder.is_active)
                      }
                      title={coFounder.is_active ? "Hide" : "Show"}
                      className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {coFounder.is_active ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>

                    {/* Reorder Up */}
                    <button
                      onClick={() => handleReorder(coFounder.id, "up")}
                      disabled={index === 0}
                      title="Move up"
                      className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>

                    {/* Reorder Down */}
                    <button
                      onClick={() => handleReorder(coFounder.id, "down")}
                      disabled={index === coFounders.length - 1}
                      title="Move down"
                      className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => handleEdit(coFounder)}
                      className="px-3 py-2 rounded-lg bg-[#8B1538]/10 text-[#8B1538] hover:bg-[#8B1538]/20 text-sm font-medium transition-colors"
                    >
                      Edit
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(coFounder.id)}
                      disabled={isDeleting === coFounder.id}
                      className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                    >
                      {isDeleting === coFounder.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add New Button */}
        {coFounders.length < 6 && (
          <Button
            onClick={handleAddCoFounder}
            disabled={isSaving}
            variant="outline"
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Co-Founder
          </Button>
        )}

        {coFounders.length >= 6 && (
          <p className="text-sm text-muted-foreground">
            Maximum 6 co-founders reached.
          </p>
        )}
      </div>
    </div>
  );
}
