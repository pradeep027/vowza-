// ─── Admin Event Packages Management ──────────────────────────────────────────
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, RefreshCw, Save, X, Search, ToggleRight, ToggleLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminEventPackageForm } from '@/components/AdminEventPackageForm';
import {
  useEventPackages,
  useCreateEventPackage,
  useUpdateEventPackage,
  useDeleteEventPackage,
  useUpsertPackageInclusion,
  type AdminEventPackage,
} from '@/hooks/useEventPackages';

interface EventType {
  id: string;
  name: string;
}

export default function AdminEventPackages() {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState<AdminEventPackage | null>(null);
  const [filterEventType, setFilterEventType] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: allPackages, isLoading, refetch } = useEventPackages();
  const createMutation = useCreateEventPackage();
  const updateMutation = useUpdateEventPackage();
  const deleteMutation = useDeleteEventPackage();
  const upsertInclusion = useUpsertPackageInclusion();

  // Load event types
  useEffect(() => {
    const loadEventTypes = async () => {
      const { data } = await supabase.from('event_types').select('id, name').order('name');
      if (data) setEventTypes(data);
    };
    loadEventTypes();
  }, []);

  const filteredPackages = (allPackages || []).filter((pkg) => {
    const matchEvent = !filterEventType || pkg.event_type_id === filterEventType;
    const matchTier = !filterTier || pkg.tier === filterTier;
    const matchSearch =
      !searchTerm ||
      pkg.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchEvent && matchTier && matchSearch;
  });

  const handleSave = async (formData: any) => {
    try {
      const packageData = {
        event_type_id: formData.event_type_id,
        tier: formData.tier,
        display_name: formData.display_name,
        description: formData.description || null,
        base_price: formData.base_price,
        discount_percentage: formData.discount_percentage,
        max_category_selections: formData.max_category_selections,
        max_professionals_per_category: formData.max_professionals_per_category,
        is_active: formData.is_active,
      };

      if (editingPackage) {
        await updateMutation.mutateAsync({ id: editingPackage.id, updates: packageData });
      } else {
        const result = await createMutation.mutateAsync(packageData as any);

        // Save inclusions
        if (formData.selected_categories && result.id) {
          for (const [categoryId, type] of Object.entries(formData.selected_categories)) {
            if (type !== null) {
              await upsertInclusion.mutateAsync({
                packageId: result.id,
                categoryId,
                isIncluded: type === 'mandatory',
              });
            }
          }
        }
      }

      setShowForm(false);
      setEditingPackage(null);
      await refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      setDeleteConfirm(null);
      await refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleActive = async (pkg: AdminEventPackage) => {
    try {
      await updateMutation.mutateAsync({
        id: pkg.id,
        updates: { is_active: !pkg.is_active },
      });
    } catch (err) {
      console.error(err);
    }
  };

  const getEventName = (eventTypeId: string) => {
    return eventTypes.find((et) => et.id === eventTypeId)?.name || 'Unknown';
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Event Packages</h1>
          <p className="text-sm text-muted-foreground">{filteredPackages.length} packages</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setEditingPackage(null);
              setShowForm(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-maroon text-white text-sm font-semibold hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            New Package
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Package name..."
                className="pl-8 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Event Type</label>
            <select
              value={filterEventType}
              onChange={(e) => setFilterEventType(e.target.value)}
              className="input-premium w-full text-sm"
            >
              <option value="">All Events</option>
              {eventTypes.map((et) => (
                <option key={et.id} value={et.id}>
                  {et.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Tier</label>
            <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} className="input-premium w-full text-sm">
              <option value="">All Tiers</option>
              <option value="Silver">Silver</option>
              <option value="Gold">Gold</option>
              <option value="Platinum">Platinum</option>
            </select>
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <AdminEventPackageForm
          package={editingPackage || undefined}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingPackage(null);
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Table */}
      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-12 rounded" />
            ))}
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No packages found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-surface-2">
                  {['Package', 'Event', 'Tier', 'Base Price', 'Discount', 'Final Price', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPackages.map((pkg) => (
                  <tr key={pkg.id} className="border-b border-border/40 hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-xs font-semibold text-foreground">{pkg.display_name}</p>
                        <p className="text-[10px] text-muted-foreground max-w-xs truncate">{pkg.description}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{getEventName(pkg.event_type_id)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-secondary">{pkg.tier}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">₹{pkg.base_price.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-xs">
                      {pkg.discount_percentage > 0 ? `${pkg.discount_percentage}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-maroon">
                      ₹{pkg.final_price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(pkg)}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          pkg.is_active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {pkg.is_active ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setEditingPackage(pkg);
                            setShowForm(true);
                          }}
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(pkg.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-6 max-w-sm">
            <h3 className="font-semibold mb-3">Delete Package?</h3>
            <p className="text-sm text-muted-foreground mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
