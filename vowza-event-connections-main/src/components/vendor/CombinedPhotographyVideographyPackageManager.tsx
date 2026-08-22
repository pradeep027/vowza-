// ─── Combined Photography & Videography Package Manager ──────────────────────
// Handles Photography-only, Videography-only, and Combined packages
// Unified UI for all three package types with conditional field rendering

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus, Edit2, Trash2, Eye, EyeOff, Copy, Loader2,
  X, Save, Camera, Video, Check, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

type PackageType = 'photography_only' | 'videography_only' | 'photography_and_videography';

interface UnifiedPackage {
  id: string;
  provider_id: string;
  name: string;
  description?: string;
  package_type: PackageType;
  price: number;
  duration?: string;
  is_active: boolean;
  is_visible: boolean;
  status: 'draft' | 'active' | 'paused' | 'archived';
  
  // Photography fields
  photography_team_size?: number;
  photography_edited_photos?: number;
  photography_unlimited_edited?: boolean;
  photography_album_included?: boolean;
  photography_deliverables?: string[];
  
  // Videography fields
  videography_team_videographers?: number;
  videography_team_drone_operator?: boolean;
  videography_coverage_hours?: string;
  videography_deliverables?: string[];
  
  created_at: string;
  updated_at: string;
}

const packageTypeOptions: { value: PackageType; label: string; icon: React.ReactNode }[] = [
  { value: 'photography_only', label: '📸 Photography Only', icon: <Camera className="w-4 h-4" /> },
  { value: 'videography_only', label: '🎥 Videography Only', icon: <Video className="w-4 h-4" /> },
  { value: 'photography_and_videography', label: '📸🎥 Photography + Videography', icon: null },
];

const eventTypes = [
  'Wedding', 'Reception', 'Haldi', 'Sangeet', 'Engagement',
  'Pre-Wedding', 'Birthday', 'Corporate', 'Baby Shower', 'Private Party'
];

const durations = [
  '1 Hour', '2 Hours', '4 Hours', 'Half Day', 'Full Day', '2 Days', 'Custom'
];

export default function CombinedPhotographyVideographyPackageManager() {
  const { user } = useAuth();
  const [packages, setPackages] = useState<UnifiedPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<UnifiedPackage>>({
    name: '',
    description: '',
    package_type: 'photography_only',
    price: 0,
    duration: 'Full Day',
    is_active: true,
    is_visible: true,
    status: 'active',
    photography_team_size: 1,
    photography_edited_photos: 500,
    photography_unlimited_edited: false,
    photography_album_included: false,
    videography_team_videographers: 1,
    videography_team_drone_operator: false,
    videography_coverage_hours: '8-10 hours',
  });

  // Load packages
  useEffect(() => {
    if (user) loadPackages();
  }, [user]);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('photography_videography_packages')
        .select('*')
        .eq('provider_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPackages((data || []) as UnifiedPackage[]);
    } catch (err) {
      console.error('Error loading packages:', err);
      toast.error('Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name?.trim()) {
      toast.error('Package name is required');
      return;
    }
    
    if (!formData.price || formData.price <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...formData,
        provider_id: user?.id,
      };

      if (editingId) {
        const { error } = await supabase
          .from('photography_videography_packages')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Package updated successfully');
      } else {
        const { error } = await supabase
          .from('photography_videography_packages')
          .insert([payload]);

        if (error) throw error;
        toast.success('Package created successfully');
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({
        name: '',
        description: '',
        package_type: 'photography_only',
        price: 0,
        duration: 'Full Day',
        is_active: true,
        is_visible: true,
        status: 'active',
      });
      loadPackages();
    } catch (err) {
      console.error('Error saving package:', err);
      toast.error('Failed to save package');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (pkg: UnifiedPackage) => {
    setFormData(pkg);
    setEditingId(pkg.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this package?')) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('photography_videography_packages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Package deleted');
      loadPackages();
    } catch (err) {
      console.error('Error deleting package:', err);
      toast.error('Failed to delete package');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('photography_videography_packages')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;
      toast.success(isActive ? 'Package deactivated' : 'Package activated');
      loadPackages();
    } catch (err) {
      console.error('Error toggling status:', err);
      toast.error('Failed to update package status');
    }
  };

  const getPackageTypeLabel = (type: PackageType): string => {
    const opt = packageTypeOptions.find(o => o.value === type);
    return opt?.label || type;
  };

  const showPhotographyFields = 
    formData.package_type === 'photography_only' || 
    formData.package_type === 'photography_and_videography';

  const showVideographyFields = 
    formData.package_type === 'videography_only' || 
    formData.package_type === 'photography_and_videography';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">📸🎥 Photography & Videography Packages</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage your photography, videography, and combined packages
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setFormData({
                name: '',
                description: '',
                package_type: 'photography_only',
                price: 0,
                duration: 'Full Day',
                is_active: true,
                is_visible: true,
                status: 'active',
              });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-maroon text-white rounded-lg hover:bg-maroon-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Package
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="border border-border rounded-lg p-6 bg-card space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {editingId ? 'Edit Package' : 'Create New Package'}
            </h3>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="p-1 hover:bg-secondary rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Basic Information</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Package Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Premium Wedding Photo + Video"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Package Type *
                  </label>
                  <select
                    value={formData.package_type}
                    onChange={(e) => setFormData({ ...formData, package_type: e.target.value as PackageType })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon"
                  >
                    {packageTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    value={formData.price || 0}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Duration
                  </label>
                  <select
                    value={formData.duration || 'Full Day'}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon"
                  >
                    {durations.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what's included in this package"
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon"
                />
              </div>
            </div>

            {/* Photography Fields */}
            {showPhotographyFields && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Photography Services
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Number of Photographers
                    </label>
                    <input
                      type="number"
                      value={formData.photography_team_size || 1}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        photography_team_size: parseInt(e.target.value) 
                      })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Edited Photos
                    </label>
                    <input
                      type="number"
                      value={formData.photography_edited_photos || 0}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        photography_edited_photos: parseInt(e.target.value) 
                      })}
                      placeholder="e.g., 500"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="unlimited_edited"
                    checked={formData.photography_unlimited_edited || false}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      photography_unlimited_edited: e.target.checked 
                    })}
                    className="rounded border-border"
                  />
                  <label htmlFor="unlimited_edited" className="text-sm font-medium text-foreground">
                    Unlimited Edited Photos
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="album_included"
                    checked={formData.photography_album_included || false}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      photography_album_included: e.target.checked 
                    })}
                    className="rounded border-border"
                  />
                  <label htmlFor="album_included" className="text-sm font-medium text-foreground">
                    Album Included
                  </label>
                </div>
              </div>
            )}

            {/* Videography Fields */}
            {showVideographyFields && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Video className="w-4 h-4" /> Videography Services
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Number of Videographers
                    </label>
                    <input
                      type="number"
                      value={formData.videography_team_videographers || 1}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        videography_team_videographers: parseInt(e.target.value) 
                      })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Coverage Hours
                    </label>
                    <input
                      type="text"
                      value={formData.videography_coverage_hours || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        videography_coverage_hours: e.target.value 
                      })}
                      placeholder="e.g., 8-10 hours"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="drone_operator"
                    checked={formData.videography_team_drone_operator || false}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      videography_team_drone_operator: e.target.checked 
                    })}
                    className="rounded border-border"
                  />
                  <label htmlFor="drone_operator" className="text-sm font-medium text-foreground">
                    Drone Coverage Included
                  </label>
                </div>
              </div>
            )}

            {/* Status */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-semibold text-foreground">Visibility & Status</h4>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_visible"
                  checked={formData.is_visible !== false}
                  onChange={(e) => setFormData({ ...formData, is_visible: e.target.checked })}
                  className="rounded border-border"
                />
                <label htmlFor="is_visible" className="text-sm font-medium text-foreground">
                  Visible to Customers
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active !== false}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-border"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-foreground">
                  Active for Bookings
                </label>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center gap-3 border-t pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-maroon text-white rounded-lg hover:bg-maroon-dark disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? 'Update Package' : 'Create Package'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Packages List */}
      {!showForm && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : packages.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-lg">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">No packages yet. Create your first package to get started.</p>
            </div>
          ) : (
            packages.map((pkg) => (
              <div
                key={pkg.id}
                className="border border-border rounded-lg p-4 bg-card hover:border-maroon/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-foreground">{pkg.name}</h3>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-maroon/10 text-maroon">
                        {getPackageTypeLabel(pkg.package_type)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Price</span>
                        <p className="font-semibold text-foreground">₹{pkg.price.toLocaleString()}</p>
                      </div>
                      {pkg.duration && (
                        <div>
                          <span className="text-muted-foreground">Duration</span>
                          <p className="font-semibold text-foreground">{pkg.duration}</p>
                        </div>
                      )}
                      {pkg.package_type !== 'videography_only' && pkg.photography_team_size && (
                        <div>
                          <span className="text-muted-foreground">📸 Photographers</span>
                          <p className="font-semibold text-foreground">{pkg.photography_team_size}</p>
                        </div>
                      )}
                      {pkg.package_type !== 'photography_only' && pkg.videography_team_videographers && (
                        <div>
                          <span className="text-muted-foreground">🎥 Videographers</span>
                          <p className="font-semibold text-foreground">{pkg.videography_team_videographers}</p>
                        </div>
                      )}
                    </div>

                    {pkg.description && (
                      <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{pkg.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(pkg)}
                      className="p-2 hover:bg-secondary rounded-lg transition-colors"
                      title="Edit package"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(pkg.id, pkg.is_active)}
                      className="p-2 hover:bg-secondary rounded-lg transition-colors"
                      title={pkg.is_active ? 'Deactivate package' : 'Activate package'}
                    >
                      {pkg.is_active ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(pkg.id)}
                      className="p-2 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors"
                      title="Delete package"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 text-xs">
                  {pkg.is_active && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded">
                      <Check className="w-3 h-3" /> Active
                    </span>
                  )}
                  {!pkg.is_visible && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded">
                      <AlertCircle className="w-3 h-3" /> Hidden
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    Created {new Date(pkg.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
