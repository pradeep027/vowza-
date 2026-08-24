// ─── Professional Photography & Videography Package Builder ─────────────────
// Multi-step wizard for creating professional service packages
// Replaces basic form with structured, event-marketplace-style experience

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft, ArrowRight, Check, Loader2, X, Upload, Trash2, Eye, EyeOff,
  Camera, Video, Plus, AlertCircle, Image as ImageIcon, Edit2, Save
} from 'lucide-react';
import { cn } from '@/lib/utils';

type PackageType = 'photography_only' | 'videography_only' | 'photography_and_videography';
type StepId = 'basics' | 'type-selection' | 'photography' | 'videography' | 'addons' | 'images' | 'preview';

interface StepDef {
  id: StepId;
  label: string;
  title: string;
  icon: React.ReactNode;
  visible: boolean;
}

interface PackageFormData {
  name: string;
  description: string;
  package_type: PackageType;
  price: number;
  duration: string;
  event_type: string;
  is_visible: boolean;
  is_active: boolean;
  status: 'draft' | 'active' | 'paused' | 'archived';
  
  // Photography
  photography_team_size: number;
  photography_team_size_custom: string;
  photography_edited_photos: number;
  photography_unlimited_edited: boolean;
  photography_raw_photos_included: boolean;
  photography_album_included: boolean;
  photography_album_details: string;
  photography_pre_event_shoot: boolean;
  photography_deliverables: string[];
  photography_delivery_time: string;
  
  // Videography
  videography_team_videographers: number;
  videography_team_assistants: number;
  videography_team_drone_operator: boolean;
  videography_team_editor: number;
  videography_coverage_hours: string;
  videography_event_types: string[];
  videography_included_services: string[];
  videography_deliverables: string[];
  videography_delivery_time: string;
  videography_equipment: string[];
  videography_editing_options: string[];
  videography_pre_event_shoot: boolean;
  
  // Travel
  travel_included: boolean;
  travel_radius_km: number;
  travel_extra_charge: number;
  travel_details: Record<string, any>;
}

interface Addon {
  id?: string;
  name: string;
  description: string;
  price: number;
  is_active: boolean;
}

interface PackageImage {
  id?: string;
  file?: File;
  preview: string;
  is_cover: boolean;
  alt_text: string;
}

const EVENT_TYPES = [
  'Wedding', 'Engagement', 'Reception', 'Haldi', 'Sangeet',
  'Birthday', 'Corporate', 'Anniversary', 'Pre-Wedding', 'Baby Shower', 'Other'
];

const DURATIONS = [
  '1 Hour', '2 Hours', '4 Hours', 'Half Day', 'Full Day', '2 Days', '3 Days', 'Custom'
];

const ADDON_TEMPLATES = [
  { name: 'Extra Photographer', price: 8000 },
  { name: 'Extra Videographer', price: 8000 },
  { name: 'Drone Coverage', price: 5000 },
  { name: 'Premium Album', price: 6000 },
  { name: 'Pre-Wedding Shoot', price: 10000 },
  { name: 'Same-Day Edit', price: 3000 },
  { name: 'Engagement Video', price: 4000 },
  { name: 'Cinematic Film', price: 7000 },
];

const emptyPackage: PackageFormData = {
  name: '',
  description: '',
  package_type: 'photography_only',
  price: 0,
  duration: 'Full Day',
  event_type: 'Wedding',
  is_visible: true,
  is_active: true,
  status: 'draft',
  photography_team_size: 1,
  photography_team_size_custom: '',
  photography_edited_photos: 500,
  photography_unlimited_edited: false,
  photography_raw_photos_included: false,
  photography_album_included: false,
  photography_album_details: '',
  photography_pre_event_shoot: false,
  photography_deliverables: [],
  photography_delivery_time: '7 Days',
  videography_team_videographers: 1,
  videography_team_assistants: 0,
  videography_team_drone_operator: false,
  videography_team_editor: 1,
  videography_coverage_hours: '8-10 Hours',
  videography_event_types: [],
  videography_included_services: [],
  videography_deliverables: [],
  videography_delivery_time: '14 Days',
  videography_equipment: [],
  videography_editing_options: [],
  videography_pre_event_shoot: false,
  travel_included: false,
  travel_radius_km: 50,
  travel_extra_charge: 0,
  travel_details: {},
};

export default function PhotoVideoPackageBuilder() {
  const { user } = useAuth();
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<StepId>('basics');
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<PackageFormData>(emptyPackage);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [images, setImages] = useState<PackageImage[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load packages on mount
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
      setPackages(data || []);
    } catch (err) {
      console.error('Error loading packages:', err);
      toast.error('Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  // Get visible steps based on package type
  const getVisibleSteps = (): StepDef[] => {
    const baseSteps: StepDef[] = [
      { id: 'basics', label: '1', title: 'Basics', icon: <Check className="w-4 h-4" />, visible: true },
      { id: 'photography', label: '2', title: 'Photography', icon: <Camera className="w-4 h-4" />, visible: formData.package_type !== 'videography_only' },
      { id: 'videography', label: '3', title: 'Videography', icon: <Video className="w-4 h-4" />, visible: formData.package_type !== 'photography_only' },
      { id: 'addons', label: '4', title: 'Add-ons', icon: <Plus className="w-4 h-4" />, visible: true },
      { id: 'images', label: '5', title: 'Images', icon: <ImageIcon className="w-4 h-4" />, visible: true },
      { id: 'preview', label: '6', title: 'Preview', icon: <Eye className="w-4 h-4" />, visible: true },
    ];
    return baseSteps.filter(s => s.visible);
  };

  const visibleSteps = getVisibleSteps();
  const currentStepIndex = visibleSteps.findIndex(s => s.id === currentStep);

  const goToStep = (stepId: StepId) => {
    setCurrentStep(stepId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const nextStep = () => {
    if (currentStepIndex < visibleSteps.length - 1) {
      goToStep(visibleSteps[currentStepIndex + 1].id);
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      goToStep(visibleSteps[currentStepIndex - 1].id);
    }
  };

  const validateBasics = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) newErrors.name = 'Package name is required';
    if (formData.name.length < 2) newErrors.name = 'Package name must be at least 2 characters';
    if (formData.price <= 0) newErrors.price = 'Price must be greater than 0';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePackageSubmit = async () => {
    if (!validateBasics()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        provider_id: user?.id,
      };

      let packageId: string;
      if (editingPackageId) {
        const { error } = await supabase
          .from('photography_videography_packages')
          .update(payload)
          .eq('id', editingPackageId);

        if (error) throw error;
        packageId = editingPackageId;
        toast.success('Package updated successfully');
      } else {
        const { data, error } = await supabase
          .from('photography_videography_packages')
          .insert([payload])
          .select('id');

        if (error) throw error;
        packageId = data?.[0]?.id;
        toast.success('Package created successfully');
      }

      // Save addons
      if (packageId) {
        await supabase
          .from('photography_videography_package_addons')
          .delete()
          .eq('package_id', packageId);

        if (addons.length > 0) {
          const addonPayload = addons.map((a, idx) => ({
            package_id: packageId,
            name: a.name,
            description: a.description,
            price: a.price,
            is_active: a.is_active,
            sort_order: idx,
          }));
          await supabase
            .from('photography_videography_package_addons')
            .insert(addonPayload);
        }

        // Save images
        await supabase
          .from('photography_videography_package_images')
          .delete()
          .eq('package_id', packageId);

        for (const img of images) {
          if (img.file) {
            const path = `${user?.id}/${packageId}/${crypto.randomUUID()}-${img.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const { error: uploadError } = await supabase.storage
              .from('photography-videography-package-images')
              .upload(path, img.file, { contentType: img.file.type });

            if (uploadError) throw uploadError;

            const publicUrl = supabase.storage
              .from('photography-videography-package-images')
              .getPublicUrl(path).data.publicUrl;

            await supabase
              .from('photography_videography_package_images')
              .insert({
                package_id: packageId,
                storage_path: path,
                public_url: publicUrl,
                is_cover: img.is_cover,
                alt_text: img.alt_text,
                sort_order: images.indexOf(img),
              });
          }
        }
      }

      // Reset and reload
      setMode('list');
      setCurrentStep('basics');
      setFormData(emptyPackage);
      setAddons([]);
      setImages([]);
      loadPackages();
    } catch (err) {
      console.error('Error saving package:', err);
      toast.error('Failed to save package');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle package edit
  const handleEditPackage = async (pkg: any) => {
    setEditingPackageId(pkg.id);
    setFormData({
      ...emptyPackage,
      ...pkg,
    });

    // Load addons
    const { data: addonsData } = await supabase
      .from('photography_videography_package_addons')
      .select('*')
      .eq('package_id', pkg.id)
      .order('sort_order');

    if (addonsData) {
      setAddons(addonsData.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        price: a.price,
        is_active: a.is_active,
      })));
    }

    // Load images
    const { data: imagesData } = await supabase
      .from('photography_videography_package_images')
      .select('*')
      .eq('package_id', pkg.id)
      .order('sort_order');

    if (imagesData) {
      setImages(imagesData.map(img => ({
        id: img.id,
        preview: img.public_url,
        is_cover: img.is_cover,
        alt_text: img.alt_text,
      })));
    }

    setMode('create');
    setCurrentStep('basics');
  };

  // Render mode: List
  if (mode === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">📸🎥 Photography & Videography Packages</h2>
            <p className="text-sm text-muted-foreground mt-1">Create and manage professional packages</p>
          </div>
          <button
            onClick={() => {
              setMode('create');
              setEditingPackageId(null);
              setFormData(emptyPackage);
              setAddons([]);
              setImages([]);
              setCurrentStep('basics');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-maroon text-white rounded-lg hover:bg-maroon-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Package
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : packages.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-2xl">
            <Camera className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No packages yet</h3>
            <p className="text-muted-foreground mb-6">Create your first professional package to get started</p>
            <button
              onClick={() => {
                setMode('create');
                setFormData(emptyPackage);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-maroon text-white rounded-lg hover:bg-maroon-dark transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Your First Package
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {packages.map((pkg) => (
              <div key={pkg.id} className="border border-border rounded-xl p-6 bg-card hover:border-maroon/50 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-foreground">{pkg.name}</h3>
                      <span className="px-2 py-1 text-xs font-medium bg-maroon/10 text-maroon rounded-full">
                        {pkg.package_type === 'photography_only' && '📸 Photography Only'}
                        {pkg.package_type === 'videography_only' && '🎥 Videography Only'}
                        {pkg.package_type === 'photography_and_videography' && '📸🎥 Combined'}
                      </span>
                      {pkg.status === 'draft' && (
                        <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                          Draft
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Price</p>
                        <p className="font-semibold text-foreground">₹{pkg.price.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Duration</p>
                        <p className="font-semibold text-foreground">{pkg.duration}</p>
                      </div>
                      {pkg.package_type !== 'videography_only' && (
                        <div>
                          <p className="text-xs text-muted-foreground">📸 Photographers</p>
                          <p className="font-semibold text-foreground">{pkg.photography_team_size || 1}</p>
                        </div>
                      )}
                      {pkg.package_type !== 'photography_only' && (
                        <div>
                          <p className="text-xs text-muted-foreground">🎥 Videographers</p>
                          <p className="font-semibold text-foreground">{pkg.videography_team_videographers || 1}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className={cn('font-semibold', pkg.is_active ? 'text-emerald-600' : 'text-muted-foreground')}>
                          {pkg.is_active ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                    </div>

                    {pkg.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{pkg.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditPackage(pkg)}
                      className="p-2 hover:bg-secondary rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm('Delete this package? This cannot be undone.')) {
                          await supabase.from('photography_videography_packages').delete().eq('id', pkg.id);
                          loadPackages();
                          toast.success('Package deleted');
                        }
                      }}
                      className="p-2 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Render mode: Create/Edit
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMode('list')}
          className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Packages
        </button>
        <h2 className="text-2xl font-bold text-foreground">
          {editingPackageId ? 'Edit Package' : 'Create New Package'}
        </h2>
        <div className="w-24" />
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-between bg-card border border-border rounded-xl p-4">
        {visibleSteps.map((step, idx) => (
          <div key={step.id} className="flex items-center gap-3 flex-1">
            <button
              onClick={() => goToStep(step.id)}
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                currentStep === step.id
                  ? 'bg-maroon text-white shadow-lg'
                  : idx < currentStepIndex
                  ? 'bg-emerald-500 text-white'
                  : 'bg-secondary text-muted-foreground border border-border'
              )}
            >
              {idx < currentStepIndex ? <Check className="w-4 h-4" /> : idx + 1}
            </button>
            <div className="hidden md:block">
              <p className="text-xs text-muted-foreground">{step.label}</p>
              <p className="text-sm font-semibold text-foreground">{step.title}</p>
            </div>
            {idx < visibleSteps.length - 1 && (
              <div className={cn(
                'flex-1 h-1 mx-2',
                idx < currentStepIndex ? 'bg-emerald-500' : 'bg-border'
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-card border border-border rounded-xl p-8">
        {/* Step: Basics */}
        {currentStep === 'basics' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground mb-6">Package Basics</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Package Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Premium Wedding Photo & Video"
                  className={cn(
                    'w-full px-4 py-3 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon',
                    errors.name && 'border-red-500 ring-2 ring-red-500/20'
                  )}
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Package Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.package_type}
                  onChange={(e) => {
                    setFormData({ ...formData, package_type: e.target.value as PackageType });
                    setCurrentStep('basics');
                  }}
                  className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon"
                >
                  <option value="photography_only">📸 Photography Only</option>
                  <option value="videography_only">🎥 Videography Only</option>
                  <option value="photography_and_videography">📸🎥 Photography + Videography</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Price (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  placeholder="50000"
                  className={cn(
                    'w-full px-4 py-3 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon',
                    errors.price && 'border-red-500 ring-2 ring-red-500/20'
                  )}
                />
                {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Coverage Duration
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon"
                >
                  {DURATIONS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Event Type
                </label>
                <select
                  value={formData.event_type}
                  onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                  className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon"
                >
                  {EVENT_TYPES.map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Package Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what customers will receive in this package..."
                rows={4}
                className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon resize-none"
              />
            </div>

            <div className="flex items-center gap-4 pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_visible}
                  onChange={(e) => setFormData({ ...formData, is_visible: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm font-medium text-foreground">Visible to Customers</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm font-medium text-foreground">Active for Bookings</span>
              </label>
            </div>
          </div>
        )}

        {/* Step: Photography */}
        {currentStep === 'photography' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2 mb-6">
                <Camera className="w-5 h-5 text-rose-600" />
                Photography Services
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Number of Photographers
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.photography_team_size}
                  onChange={(e) => setFormData({ ...formData, photography_team_size: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Edited Photos Count
                </label>
                <input
                  type="number"
                  value={formData.photography_edited_photos}
                  onChange={(e) => setFormData({ ...formData, photography_edited_photos: parseInt(e.target.value) || 0 })}
                  placeholder="500"
                  className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Photo Delivery Time
                </label>
                <input
                  type="text"
                  value={formData.photography_delivery_time}
                  onChange={(e) => setFormData({ ...formData, photography_delivery_time: e.target.value })}
                  placeholder="e.g., 7 Days"
                  className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Custom Team Description
                </label>
                <input
                  type="text"
                  value={formData.photography_team_size_custom}
                  onChange={(e) => setFormData({ ...formData, photography_team_size_custom: e.target.value })}
                  placeholder="e.g., Lead + 1 Assistant"
                  className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-border rounded-lg hover:bg-secondary transition-colors">
                <input
                  type="checkbox"
                  checked={formData.photography_unlimited_edited}
                  onChange={(e) => setFormData({ ...formData, photography_unlimited_edited: e.target.checked })}
                  className="rounded border-border"
                />
                <div>
                  <p className="font-semibold text-foreground">Unlimited Edited Photos</p>
                  <p className="text-xs text-muted-foreground">All captured photos will be edited</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 border border-border rounded-lg hover:bg-secondary transition-colors">
                <input
                  type="checkbox"
                  checked={formData.photography_raw_photos_included}
                  onChange={(e) => setFormData({ ...formData, photography_raw_photos_included: e.target.checked })}
                  className="rounded border-border"
                />
                <div>
                  <p className="font-semibold text-foreground">Raw Photos Included</p>
                  <p className="text-xs text-muted-foreground">Unedited RAW files for professional editing</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 border border-border rounded-lg hover:bg-secondary transition-colors">
                <input
                  type="checkbox"
                  checked={formData.photography_album_included}
                  onChange={(e) => setFormData({ ...formData, photography_album_included: e.target.checked })}
                  className="rounded border-border"
                />
                <div>
                  <p className="font-semibold text-foreground">Premium Album Included</p>
                  <p className="text-xs text-muted-foreground">Professional printed album</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 border border-border rounded-lg hover:bg-secondary transition-colors">
                <input
                  type="checkbox"
                  checked={formData.photography_pre_event_shoot}
                  onChange={(e) => setFormData({ ...formData, photography_pre_event_shoot: e.target.checked })}
                  className="rounded border-border"
                />
                <div>
                  <p className="font-semibold text-foreground">Pre-Wedding Shoot Included</p>
                  <p className="text-xs text-muted-foreground">Additional photoshoot session</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Step: Videography */}
        {currentStep === 'videography' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2 mb-6">
                <Video className="w-5 h-5 text-blue-600" />
                Videography Services
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Number of Videographers
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.videography_team_videographers}
                  onChange={(e) => setFormData({ ...formData, videography_team_videographers: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Coverage Hours
                </label>
                <input
                  type="text"
                  value={formData.videography_coverage_hours}
                  onChange={(e) => setFormData({ ...formData, videography_coverage_hours: e.target.value })}
                  placeholder="e.g., 8-10 Hours"
                  className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Number of Assistants
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.videography_team_assistants}
                  onChange={(e) => setFormData({ ...formData, videography_team_assistants: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Video Delivery Time
                </label>
                <input
                  type="text"
                  value={formData.videography_delivery_time}
                  onChange={(e) => setFormData({ ...formData, videography_delivery_time: e.target.value })}
                  placeholder="e.g., 14 Days"
                  className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-border rounded-lg hover:bg-secondary transition-colors">
                <input
                  type="checkbox"
                  checked={formData.videography_team_drone_operator}
                  onChange={(e) => setFormData({ ...formData, videography_team_drone_operator: e.target.checked })}
                  className="rounded border-border"
                />
                <div>
                  <p className="font-semibold text-foreground">Drone Coverage Included</p>
                  <p className="text-xs text-muted-foreground">Aerial shots and drone coverage</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 border border-border rounded-lg hover:bg-secondary transition-colors">
                <input
                  type="checkbox"
                  checked={formData.videography_pre_event_shoot}
                  onChange={(e) => setFormData({ ...formData, videography_pre_event_shoot: e.target.checked })}
                  className="rounded border-border"
                />
                <div>
                  <p className="font-semibold text-foreground">Pre-Wedding Video Included</p>
                  <p className="text-xs text-muted-foreground">Additional videography session</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Step: Add-ons */}
        {currentStep === 'addons' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2 mb-6">
                <Plus className="w-5 h-5" />
                Optional Add-ons
              </h3>
              <p className="text-sm text-muted-foreground">
                Offer optional extras that customers can purchase along with the package
              </p>
            </div>

            {/* Add-on Templates */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Quick Add Templates:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {ADDON_TEMPLATES.map((template) => (
                  <button
                    key={template.name}
                    onClick={() => {
                      if (!addons.some(a => a.name.toLowerCase() === template.name.toLowerCase())) {
                        setAddons([...addons, { name: template.name, description: '', price: template.price, is_active: true }]);
                      } else {
                        toast.info('This add-on is already added');
                      }
                    }}
                    className="px-3 py-2 text-xs font-medium border border-border rounded-lg hover:bg-secondary transition-colors text-left"
                  >
                    <Plus className="w-3 h-3 inline mr-1" />
                    {template.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Existing Add-ons */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Your Add-ons:</p>
              {addons.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No add-ons yet. Use templates or create custom ones below.</p>
              ) : (
                addons.map((addon, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{addon.name}</p>
                      <p className="text-xs text-muted-foreground">₹{addon.price.toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => setAddons(addons.filter((_, i) => i !== idx))}
                      className="p-2 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Custom Add-on Form */}
            <div className="space-y-3 border-t pt-6">
              <p className="text-sm font-semibold text-foreground">Add Custom Add-on:</p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Add-on name (e.g., Extra Photographer)"
                  id="customAddonName"
                  className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  id="customAddonDesc"
                  className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon"
                />
                <input
                  type="number"
                  placeholder="Price (₹)"
                  id="customAddonPrice"
                  className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-maroon"
                />
                <button
                  onClick={() => {
                    const name = (document.getElementById('customAddonName') as HTMLInputElement)?.value;
                    const desc = (document.getElementById('customAddonDesc') as HTMLInputElement)?.value;
                    const price = parseFloat((document.getElementById('customAddonPrice') as HTMLInputElement)?.value || '0');
                    
                    if (name && price > 0) {
                      setAddons([...addons, { name, description: desc, price, is_active: true }]);
                      (document.getElementById('customAddonName') as HTMLInputElement).value = '';
                      (document.getElementById('customAddonDesc') as HTMLInputElement).value = '';
                      (document.getElementById('customAddonPrice') as HTMLInputElement).value = '';
                    } else {
                      toast.error('Enter add-on name and price');
                    }
                  }}
                  className="w-full px-4 py-3 bg-maroon text-white rounded-lg hover:bg-maroon-dark transition-colors font-semibold"
                >
                  Add Custom Add-on
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Images */}
        {currentStep === 'images' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2 mb-6">
                <ImageIcon className="w-5 h-5" />
                Package Images
              </h3>
              <p className="text-sm text-muted-foreground">
                Upload professional images to showcase your package
              </p>
            </div>

            {/* Upload Area */}
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-maroon/50 transition-colors cursor-pointer"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('border-maroon', 'bg-maroon/5');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('border-maroon', 'bg-maroon/5');
              }}
              onClick={() => document.getElementById('imageUpload')?.click()}
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold text-foreground mb-1">Click to upload or drag and drop</p>
              <p className="text-xs text-muted-foreground">PNG, JPG, WebP up to 8MB</p>
              <input
                id="imageUpload"
                type="file"
                multiple
                accept="image/*"
                hidden
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) {
                    for (let i = 0; i < Math.min(files.length, 10 - images.length); i++) {
                      const file = files[i];
                      if (file.size <= 8 * 1024 * 1024) {
                        setImages([...images, {
                          file,
                          preview: URL.createObjectURL(file),
                          is_cover: images.length === 0,
                          alt_text: '',
                        }]);
                      }
                    }
                  }
                }}
              />
            </div>

            {/* Image Gallery */}
            {images.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">{images.length} images uploaded</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img src={img.preview} alt={img.alt_text || `Image ${idx + 1}`} className="w-full h-32 object-cover rounded-lg" />
                      {img.is_cover && (
                        <span className="absolute top-2 left-2 px-2 py-1 text-xs font-bold bg-maroon text-white rounded">
                          Cover
                        </span>
                      )}
                      <button
                        onClick={() => setImages(images.map((i, i2) => ({ ...i, is_cover: i2 === idx })))}
                        className="absolute bottom-2 left-2 px-2 py-1 text-xs font-medium bg-white text-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Set as Cover
                      </button>
                      <button
                        onClick={() => setImages(images.filter((_, i) => i !== idx))}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: Preview */}
        {currentStep === 'preview' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2 mb-6">
                <Eye className="w-5 h-5" />
                Preview Package
              </h3>
              <p className="text-sm text-muted-foreground">
                This is how customers will see your package
              </p>
            </div>

            {/* Package Preview Card */}
            <div className="border border-border rounded-xl overflow-hidden">
              {images.length > 0 && (
                <div className="relative w-full h-64 bg-secondary">
                  <img
                    src={images.find(i => i.is_cover)?.preview || images[0].preview}
                    alt="Package cover"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">{formData.name}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formData.package_type === 'photography_only' && '📸 Photography Only'}
                      {formData.package_type === 'videography_only' && '🎥 Videography Only'}
                      {formData.package_type === 'photography_and_videography' && '📸🎥 Combined Photography & Videography'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-maroon">₹{formData.price.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{formData.duration}</p>
                  </div>
                </div>

                {formData.description && (
                  <div>
                    <p className="text-sm text-foreground">{formData.description}</p>
                  </div>
                )}

                {/* Photography Section */}
                {(formData.package_type === 'photography_only' || formData.package_type === 'photography_and_videography') && (
                  <div className="space-y-3 border-t pt-4">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <Camera className="w-4 h-4 text-rose-600" />
                      Photography
                    </h3>
                    <ul className="text-sm space-y-2 text-muted-foreground">
                      <li>✓ {formData.photography_team_size} Photographer{formData.photography_team_size > 1 ? 's' : ''}</li>
                      {formData.photography_unlimited_edited ? (
                        <li>✓ Unlimited Edited Photos</li>
                      ) : (
                        <li>✓ {formData.photography_edited_photos} Edited Photos</li>
                      )}
                      {formData.photography_album_included && <li>✓ Premium Album</li>}
                      {formData.photography_raw_photos_included && <li>✓ Raw Photos Included</li>}
                      {formData.photography_pre_event_shoot && <li>✓ Pre-Wedding Shoot</li>}
                      <li>✓ Delivery in {formData.photography_delivery_time}</li>
                    </ul>
                  </div>
                )}

                {/* Videography Section */}
                {(formData.package_type === 'videography_only' || formData.package_type === 'photography_and_videography') && (
                  <div className="space-y-3 border-t pt-4">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <Video className="w-4 h-4 text-blue-600" />
                      Videography
                    </h3>
                    <ul className="text-sm space-y-2 text-muted-foreground">
                      <li>✓ {formData.videography_team_videographers} Videographer{formData.videography_team_videographers > 1 ? 's' : ''}</li>
                      <li>✓ {formData.videography_coverage_hours} Coverage</li>
                      {formData.videography_team_drone_operator && <li>✓ Drone Coverage</li>}
                      {formData.videography_pre_event_shoot && <li>✓ Pre-Wedding Video</li>}
                      <li>✓ Delivery in {formData.videography_delivery_time}</li>
                    </ul>
                  </div>
                )}

                {/* Add-ons Section */}
                {addons.length > 0 && (
                  <div className="space-y-3 border-t pt-4">
                    <h3 className="font-semibold text-foreground">Optional Add-ons</h3>
                    <ul className="text-sm space-y-2">
                      {addons.map((addon, idx) => (
                        <li key={idx} className="flex justify-between text-muted-foreground">
                          <span>+ {addon.name}</span>
                          <span className="font-semibold">₹{addon.price.toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Ready to Publish */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm text-emerald-700">
                ✓ Your package is ready to be published! Click "Publish Package" to make it live for customers.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={prevStep}
          disabled={currentStepIndex === 0}
          className={cn(
            'flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors',
            currentStepIndex === 0
              ? 'text-muted-foreground cursor-not-allowed'
              : 'text-foreground hover:bg-secondary'
          )}
        >
          <ArrowLeft className="w-4 h-4" />
          Previous
        </button>

        <div className="text-sm text-muted-foreground">
          Step {currentStepIndex + 1} of {visibleSteps.length}
        </div>

        {currentStepIndex === visibleSteps.length - 1 ? (
          <div className="flex gap-3">
            <button
              onClick={() => {
                setFormData({ ...formData, status: 'draft' });
                handlePackageSubmit();
              }}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-3 border border-border rounded-lg font-semibold hover:bg-secondary transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save as Draft
            </button>
            <button
              onClick={() => {
                setFormData({ ...formData, status: 'active' });
                handlePackageSubmit();
              }}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-3 bg-maroon text-white rounded-lg font-semibold hover:bg-maroon-dark transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Publish Package
            </button>
          </div>
        ) : (
          <button
            onClick={nextStep}
            className="flex items-center gap-2 px-6 py-3 bg-maroon text-white rounded-lg font-semibold hover:bg-maroon-dark transition-colors"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
