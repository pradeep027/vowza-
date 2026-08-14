// ─── useEventPackages Hook — Admin Event Packages Query ────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AdminEventPackage {
  id: string;
  event_type_id: string;
  tier: 'Silver' | 'Gold' | 'Platinum';
  display_name: string;
  description: string | null;
  base_price: number;
  discount_percentage: number;
  final_price: number;
  max_category_selections: number;
  max_professionals_per_category: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface AdminEventPackageInclusion {
  id: string;
  package_id: string;
  category_id: string;
  is_included: boolean;
  sort_order: number;
  created_at: string;
}

export interface AdminEventPackageBooking {
  id: string;
  customer_id: string;
  package_id: string;
  event_date: string;
  event_location: string | null;
  guest_count: number | null;
  package_price: number;
  discount_applied: number;
  final_price: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  payment_status: 'unpaid' | 'partial' | 'paid';
  created_at: string;
  updated_at: string;
}

// ─── ADMIN: Get all packages ───────────────────────────────────────────────────
export const useEventPackages = () => {
  return useQuery({
    queryKey: ['event-packages-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_event_packages')
        .select('*')
        .order('event_type_id, tier');
      if (error) throw error;
      return (data || []) as AdminEventPackage[];
    },
  });
};

// ─── CUSTOMER: Get packages by event type (published only) ──────────────────────
export const useEventPackagesByEventType = (eventTypeId: string) => {
  return useQuery({
    queryKey: ['event-packages-event', eventTypeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_event_packages')
        .select('*')
        .eq('event_type_id', eventTypeId)
        .eq('is_active', true)
        .order('tier');
      if (error) throw error;
      return (data || []) as AdminEventPackage[];
    },
    enabled: !!eventTypeId,
  });
};

// ─── ADMIN: Get packages by event type ─────────────────────────────────────────
export const useEventPackagesByEventTypeAdmin = (eventTypeId: string) => {
  return useQuery({
    queryKey: ['event-packages-event-admin', eventTypeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_event_packages')
        .select('*')
        .eq('event_type_id', eventTypeId)
        .order('tier');
      if (error) throw error;
      return (data || []) as AdminEventPackage[];
    },
    enabled: !!eventTypeId,
  });
};

// ─── Get single package ────────────────────────────────────────────────────────
export const useEventPackageById = (packageId: string) => {
  return useQuery({
    queryKey: ['event-package', packageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_event_packages')
        .select('*')
        .eq('id', packageId)
        .single();
      if (error) throw error;
      return data as AdminEventPackage;
    },
    enabled: !!packageId,
  });
};

// ─── ADMIN: Create package ────────────────────────────────────────────────────
export const useCreateEventPackage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pkg: Omit<AdminEventPackage, 'id' | 'created_at' | 'updated_at' | 'final_price'>) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('admin_event_packages')
        .insert({
          ...pkg,
          created_by: userData?.user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as AdminEventPackage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-packages-all'] });
      toast.success('Package created successfully');
    },
    onError: (err: any) => {
      toast.error(`Failed to create package: ${err.message}`);
    },
  });
};

// ─── ADMIN: Update package ────────────────────────────────────────────────────
export const useUpdateEventPackage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AdminEventPackage> }) => {
      const { data, error } = await supabase
        .from('admin_event_packages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as AdminEventPackage;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event-packages-all'] });
      queryClient.invalidateQueries({ queryKey: ['event-package', data.id] });
      queryClient.invalidateQueries({ queryKey: ['event-packages-event-admin', data.event_type_id] });
      toast.success('Package updated successfully');
    },
    onError: (err: any) => {
      toast.error(`Failed to update package: ${err.message}`);
    },
  });
};

// ─── ADMIN: Delete package ────────────────────────────────────────────────────
export const useDeleteEventPackage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('admin_event_packages')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-packages-all'] });
      toast.success('Package deleted successfully');
    },
    onError: (err: any) => {
      toast.error(`Failed to delete package: ${err.message}`);
    },
  });
};

// ─── Get package inclusions ────────────────────────────────────────────────────
export const usePackageInclusions = (packageId: string) => {
  return useQuery({
    queryKey: ['package-inclusions', packageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_event_package_inclusions')
        .select(`
          id,
          package_id,
          category_id,
          is_included,
          sort_order,
          created_at,
          artist_categories:category_id(id, name, icon)
        `)
        .eq('package_id', packageId)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as AdminEventPackageInclusion[];
    },
    enabled: !!packageId,
  });
};

// ─── Add/update package inclusion ──────────────────────────────────────────────
export const useUpsertPackageInclusion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      packageId,
      categoryId,
      isIncluded,
    }: {
      packageId: string;
      categoryId: string;
      isIncluded: boolean;
    }) => {
      const { data, error } = await supabase
        .from('admin_event_package_inclusions')
        .upsert({ package_id: packageId, category_id: categoryId, is_included: isIncluded })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['package-inclusions', variables.packageId] });
    },
  });
};

// ─── Delete package inclusion ──────────────────────────────────────────────────
export const useDeletePackageInclusion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inclusionId: string) => {
      const { error } = await supabase
        .from('admin_event_package_inclusions')
        .delete()
        .eq('id', inclusionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['package-inclusions'] });
    },
  });
};

// ─── CUSTOMER: Create booking ──────────────────────────────────────────────────
export const useCreateEventPackageBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (booking: Omit<AdminEventPackageBooking, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('admin_event_package_bookings')
        .insert({
          ...booking,
          customer_id: userData.user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as AdminEventPackageBooking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-package-bookings'] });
      toast.success('Booking created successfully');
    },
    onError: (err: any) => {
      toast.error(`Failed to create booking: ${err.message}`);
    },
  });
};

// ─── Get customer's bookings ───────────────────────────────────────────────────
export const useMyEventPackageBookings = () => {
  return useQuery({
    queryKey: ['my-event-package-bookings'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('admin_event_package_bookings')
        .select('*')
        .eq('customer_id', userData.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as AdminEventPackageBooking[];
    },
  });
};
