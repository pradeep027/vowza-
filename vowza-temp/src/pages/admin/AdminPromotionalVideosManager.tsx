import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Trash2, Upload, Video, Eye } from 'lucide-react';
import {
  createPromotionVideo,
  deletePromotionVideo,
  deletePromotionVideoFile,
  fetchPromotionVideos,
  notifyPromotionVideoUpdated,
  updatePromotionVideo,
  uploadPromotionVideo,
  validatePromotionVideo,
  type PromotionVideo,
} from '@/integrations/supabase/promotion-videos';
import { toast } from 'sonner';

/**
 * Admin Panel: Promotional Videos Manager
 * Separate from homepage image carousel system
 * Manages promotional video ads with 15-user limit per video
 */

const PromotionVideoCard: React.FC<{
  video: PromotionVideo;
  index: number;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, updates: Partial<PromotionVideo>) => Promise<void>;
  isLoading: boolean;
}> = ({ video, index, onDelete, onUpdate, isLoading }) => {
  const positionLabels = {
    'top-left': 'Top Left',
    'top-right': 'Top Right',
    'bottom-left': 'Bottom Left',
    'bottom-right': 'Bottom Right',
  };

  const percentReached = Math.round((video.unique_users_reached / video.user_limit) * 100);

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start gap-4">
        {/* Video Thumbnail */}
        <div className="h-24 w-32 shrink-0 overflow-hidden rounded-md border border-border/50 bg-slate-100">
          <video
            src={video.video_url}
            muted
            preload="metadata"
            className="h-full w-full object-cover"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Video className="h-4 w-4" />
              Priority {video.priority_order}
            </h4>
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                video.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {video.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          {/* Stats */}
          <div className="mb-3 space-y-1">
            <p className="text-xs text-muted-foreground">
              <strong>Position:</strong> {positionLabels[video.display_position]}
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>User Limit:</strong> {video.user_limit}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex-1">
                <strong>Progress:</strong> {video.unique_users_reached} / {video.user_limit}
              </span>
              <div className="flex-1 max-w-[150px] bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-maroon h-full transition-all"
                  style={{ width: `${percentReached}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {video.unique_users_reached >= video.user_limit
                ? '✓ Limit reached'
                : `${video.user_limit - video.unique_users_reached} users remaining`}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                onUpdate(video.id, { is_active: !video.is_active })
              }
              disabled={isLoading}
              className="btn-secondary text-xs px-2.5 py-1.5"
            >
              {video.is_active ? 'Deactivate' : 'Activate'}
            </button>
            <button
              type="button"
              onClick={() => onDelete(video.id)}
              disabled={isLoading}
              className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="inline h-3.5 w-3.5 mr-1" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AdminPromotionalVideosManager: React.FC = () => {
  const [videos, setVideos] = useState<PromotionVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [position, setPosition] = useState<'bottom-right' | 'top-left' | 'top-right' | 'bottom-left'>('bottom-right');
  const [userLimit, setUserLimit] = useState(15);

  // Load videos
  const loadVideos = async () => {
    setLoading(true);
    try {
      const data = await fetchPromotionVideos();
      setVideos(data.sort((a, b) => a.priority_order - b.priority_order));
    } catch (error) {
      console.error('[AdminPromotionalVideos] Failed to load:', error);
      toast.error('Failed to load promotion videos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVideos();
  }, []);

  // File selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await validatePromotionVideo(file);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } catch (error) {
      event.target.value = '';
      toast.error(error instanceof Error ? error.message : 'Invalid video file');
    }
  };

  // Upload
  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const uploaded = await uploadPromotionVideo(selectedFile);
      const nextPriority = Math.max(...videos.map(v => v.priority_order), -1) + 1;
      const created = await createPromotionVideo(
        uploaded.url,
        uploaded.path,
        nextPriority,
        position,
        userLimit,
      );
      setVideos((prev) => [...prev, created].sort((a, b) => a.priority_order - b.priority_order));
      setSelectedFile(null);
      setPreviewUrl('');
      toast.success('Video uploaded successfully');
      notifyPromotionVideoUpdated();
    } catch (error) {
      console.error('[AdminPromotionalVideos] Upload failed:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Delete
  const handleDelete = async (videoId: string) => {
    if (!confirm('Delete this video? This cannot be undone.')) return;

    setLoading(true);
    try {
      const video = videos.find((v) => v.id === videoId);
      await deletePromotionVideo(videoId);
      await deletePromotionVideoFile(video?.storage_path ?? null);
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      toast.success('Video deleted');
      notifyPromotionVideoUpdated();
    } catch (error) {
      console.error('[AdminPromotionalVideos] Delete failed:', error);
      toast.error('Failed to delete video');
    } finally {
      setLoading(false);
    }
  };

  // Update
  const handleUpdate = async (videoId: string, updates: Partial<PromotionVideo>) => {
    setLoading(true);
    try {
      const updated = await updatePromotionVideo(videoId, updates);
      setVideos((prev) =>
        prev
          .map((v) => (v.id === videoId ? updated : v))
          .sort((a, b) => a.priority_order - b.priority_order),
      );
      toast.success('Video updated');
      notifyPromotionVideoUpdated();
    } catch (error) {
      console.error('[AdminPromotionalVideos] Update failed:', error);
      toast.error('Failed to update video');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="rounded-lg border border-border bg-background p-6">
        <h3 className="mb-4 text-base font-semibold">Upload New Promotion Video</h3>

        {!previewUrl ? (
          <>
            <div className="mb-4 rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-maroon/50">
              <input
                type="file"
                accept="video/mp4,video/webm"
                onChange={handleFileSelect}
                className="hidden"
                id="promo-video-upload"
              />
              <label htmlFor="promo-video-upload" className="block cursor-pointer">
                <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="font-semibold text-foreground">Upload Video</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  MP4 or WebM • Max 100MB
                </p>
              </label>
            </div>

            {/* Settings */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-2">Display Position</label>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value as any)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <option value="top-left">Top Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-right">Bottom Right</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2">User Limit</label>
                <input
                  type="number"
                  min="1"
                  value={userLimit}
                  onChange={(e) => setUserLimit(Math.max(1, parseInt(e.target.value) || 15))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="aspect-video overflow-hidden rounded-lg border-2 border-maroon/50 bg-slate-100">
              <video
                src={previewUrl}
                muted
                controls
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl('');
                }}
                disabled={uploading}
                className="btn-secondary flex-1 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="btn-primary flex-1 justify-center gap-2 text-sm"
              >
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                Upload Video
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Videos List */}
      <div className="rounded-lg border border-border bg-background p-6">
        <h3 className="mb-4 text-base font-semibold flex items-center gap-2">
          <Video className="h-5 w-5" />
          Promotion Videos ({videos.length})
        </h3>

        {loading && !videos.length ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : videos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No promotion videos uploaded yet
          </p>
        ) : (
          <div className="space-y-3">
            {videos.map((video, idx) => (
              <PromotionVideoCard
                key={video.id}
                video={video}
                index={idx}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                isLoading={loading}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-xs text-blue-900">
          <strong>How it works:</strong> Each video is shown to a maximum of 15 unique authenticated
          users. After reaching the limit, the next video in the priority order becomes active automatically.
          Admin can manually activate/deactivate videos regardless of user limits.
        </p>
      </div>
    </div>
  );
};

export default AdminPromotionalVideosManager;
