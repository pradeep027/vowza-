import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type BookingStatus = Database['public']['Enums']['booking_status'];

export interface Booking {
  id: string;
  customer_id: string;
  provider_id: string;
  event_type_id: string | null;
  event_date: string;
  event_time: string | null;
  event_duration_hours: number | null;
  venue_address: string;
  venue_city: string;
  venue_area: string | null;
  requirements: string | null;
  amount: number;
  status: BookingStatus;
  customer_notes: string | null;
  provider_notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useBookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const hasLoadedOnce = useRef(false);

  const fetchBookings = async (isBackground = false) => {
    if (!user) {
      setBookings([]);
      setIsLoading(false);
      return;
    }

    // Only show full loading on initial load, not background refreshes
    if (!isBackground && !hasLoadedOnce.current) {
      setIsLoading(true);
    }
    setError(null);

    try {
      // Fetch generic bookings
      const { data: genericData, error: genericError } = await supabase
        .from('bookings')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (genericError) throw genericError;

      // Fetch photography bookings
      const { data: photoData } = await supabase
        .from('photography_package_bookings' as any)
        .select('*, photography_packages(name, photography_type)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      // Normalize photography bookings to match Booking interface
      const normalizedPhoto = (photoData ?? []).map((b: any) => ({
        id: b.id,
        customer_id: b.customer_id,
        provider_id: b.photographer_id,
        event_type_id: null,
        event_date: b.event_date,
        event_time: b.event_time,
        event_duration_hours: null,
        venue_address: b.venue || '',
        venue_city: b.venue?.split(',').pop()?.trim() || '',
        venue_area: null,
        requirements: b.notes,
        amount: Number(b.total_amount),
        status: (b.status === 'confirmed' ? 'in_progress' : b.status === 'pending' ? 'requested' : b.status === 'accepted' ? 'accepted' : b.status) as BookingStatus,
        customer_notes: b.notes,
        provider_notes: null,
        created_at: b.created_at,
        updated_at: b.created_at,
        _source: 'photography',
        _packageName: b.photography_packages?.name || 'Photography Package',
      }));

      // Fetch catering bookings
      const { data: cateringData } = await supabase
        .from('catering_bookings' as any)
        .select('*, catering_packages(name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      // Normalize catering bookings
      const normalizedCatering = (cateringData ?? []).map((b: any) => ({
        id: b.id,
        customer_id: b.customer_id,
        provider_id: b.provider_id,
        event_type_id: null,
        event_date: b.event_date,
        event_time: null,
        event_duration_hours: null,
        venue_address: b.venue || '',
        venue_city: b.venue?.split(',').pop()?.trim() || '',
        venue_area: null,
        requirements: b.special_requests,
        amount: Number(b.total_amount),
        status: (b.status === 'confirmed' ? 'in_progress' : b.status === 'pending' ? 'requested' : b.status === 'accepted' ? 'accepted' : b.status) as BookingStatus,
        customer_notes: b.special_requests,
        provider_notes: null,
        created_at: b.created_at,
        updated_at: b.created_at,
        _source: 'catering',
        _packageName: b.catering_packages?.name || 'Catering Package',
        _guestCount: b.guest_count,
      }));

      // Fetch drone bookings
      const { data: droneData } = await supabase
        .from('drone_bookings' as any)
        .select('*, drone_packages(name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      // Normalize drone bookings
      const normalizedDrone = (droneData ?? []).map((b: any) => ({
        id: b.id,
        customer_id: b.customer_id,
        provider_id: b.provider_id,
        event_type_id: null,
        event_date: b.event_date,
        event_time: b.event_time,
        event_duration_hours: null,
        venue_address: b.venue || '',
        venue_city: b.venue?.split(',').pop()?.trim() || '',
        venue_area: null,
        requirements: b.special_requests,
        amount: Number(b.total_amount),
        status: (b.status === 'confirmed' ? 'in_progress' : b.status === 'pending' ? 'requested' : b.status === 'accepted' ? 'accepted' : b.status) as BookingStatus,
        customer_notes: b.special_requests,
        provider_notes: null,
        created_at: b.created_at,
        updated_at: b.created_at,
        _source: 'drone',
        _packageName: b.drone_packages?.name || 'Drone Package',
      }));

      // Fetch videography bookings
      const { data: videographyData } = await supabase
        .from('videography_bookings' as any)
        .select('*, videography_packages(name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      // Normalize videography bookings
      const normalizedVideography = (videographyData ?? []).map((b: any) => ({
        id: b.id,
        customer_id: b.customer_id,
        provider_id: b.provider_id,
        event_type_id: null,
        event_date: b.event_date,
        event_time: b.event_time,
        event_duration_hours: null,
        venue_address: b.venue || '',
        venue_city: b.venue?.split(',').pop()?.trim() || '',
        venue_area: null,
        requirements: b.notes,
        amount: Number(b.total_amount),
        status: (b.status === 'confirmed' ? 'in_progress' : b.status === 'pending' ? 'requested' : b.status === 'accepted' ? 'accepted' : b.status) as BookingStatus,
        customer_notes: b.notes,
        provider_notes: null,
        created_at: b.created_at,
        updated_at: b.created_at,
        _source: 'videography',
        _packageName: b.videography_packages?.name || 'Videography Package',
      }));

      // Fetch DJ bookings
      const { data: djData } = await supabase
        .from('dj_bookings' as any)
        .select('*, dj_packages(name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      const normalizedDJ = (djData ?? []).map((b: any) => ({
        id: b.id,
        customer_id: b.customer_id,
        provider_id: b.provider_id,
        event_type_id: null,
        event_date: b.event_date,
        event_time: b.event_time,
        event_duration_hours: null,
        venue_address: b.venue || '',
        venue_city: b.city || b.venue?.split(',').pop()?.trim() || '',
        venue_area: null,
        requirements: b.special_instructions,
        amount: Number(b.total_amount),
        status: (b.status === 'confirmed' ? 'in_progress' : b.status === 'pending' ? 'requested' : b.status === 'accepted' ? 'accepted' : b.status) as BookingStatus,
        customer_notes: b.special_instructions,
        provider_notes: null,
        created_at: b.created_at,
        updated_at: b.created_at,
        _source: 'dj',
        _packageName: b.dj_packages?.name || 'DJ Package',
      }));

      // Fetch decorator bookings
      const { data: decoratorData } = await supabase
        .from('decorator_bookings' as any)
        .select('*, decorator_packages(name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      const normalizedDecorator = (decoratorData ?? []).map((b: any) => ({
        id: b.id,
        customer_id: b.customer_id,
        provider_id: b.provider_id,
        event_type_id: null,
        event_date: b.event_date,
        event_time: b.event_time,
        event_duration_hours: null,
        venue_address: b.venue || '',
        venue_city: b.city || '',
        venue_area: null,
        requirements: b.special_instructions,
        amount: Number(b.total_amount),
        status: (b.status === 'confirmed' ? 'in_progress' : b.status === 'pending' ? 'requested' : b.status === 'accepted' ? 'accepted' : b.status) as BookingStatus,
        customer_notes: b.special_instructions,
        provider_notes: null,
        created_at: b.created_at,
        updated_at: b.created_at,
        _source: 'decorator',
        _packageName: b.decorator_packages?.name || 'Decoration Package',
      }));

      // Fetch makeup bookings
      const { data: makeupData } = await supabase
        .from('makeup_bookings' as any)
        .select('*, makeup_packages(name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      const normalizedMakeup = (makeupData ?? []).map((b: any) => ({
        id: b.id,
        customer_id: b.customer_id,
        provider_id: b.provider_id,
        event_type_id: null,
        event_date: b.event_date,
        event_time: b.event_time,
        event_duration_hours: null,
        venue_address: b.venue || '',
        venue_city: b.city || '',
        venue_area: null,
        requirements: b.special_requirements,
        amount: Number(b.total_amount),
        status: (b.status === 'confirmed' ? 'in_progress' : b.status === 'pending' ? 'requested' : b.status === 'accepted' ? 'accepted' : b.status) as BookingStatus,
        customer_notes: b.special_requirements,
        provider_notes: null,
        created_at: b.created_at,
        updated_at: b.created_at,
        _source: 'makeup',
        _packageName: b.makeup_packages?.name || 'Makeup Package',
      }));

      // Fetch mehendi bookings
      const { data: mehendiData } = await supabase
        .from('mehendi_bookings' as any)
        .select('*, mehendi_packages(name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      const normalizedMehendi = (mehendiData ?? []).map((b: any) => ({
        id: b.id, customer_id: b.customer_id, provider_id: b.provider_id,
        event_type_id: null, event_date: b.event_date, event_time: b.event_time,
        event_duration_hours: null, venue_address: b.venue || '', venue_city: b.city || '',
        venue_area: null, requirements: b.special_requests,
        amount: Number(b.total_amount),
        status: (b.status === 'confirmed' ? 'in_progress' : b.status === 'pending' ? 'requested' : b.status === 'accepted' ? 'accepted' : b.status) as BookingStatus,
        customer_notes: b.special_requests, provider_notes: null,
        created_at: b.created_at, updated_at: b.created_at,
        _source: 'mehendi',
        _packageName: b.mehendi_packages?.name || 'Mehendi Package',
      }));

      // Fetch anchor bookings
      const { data: anchorData } = await supabase
        .from('anchor_bookings' as any)
        .select('*, anchor_packages(name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      const normalizedAnchor = (anchorData ?? []).map((b: any) => ({
        id: b.id, customer_id: b.customer_id, provider_id: b.provider_id,
        event_type_id: null, event_date: b.event_date, event_time: b.event_time,
        event_duration_hours: null, venue_address: b.venue || '', venue_city: b.city || '',
        venue_area: null, requirements: b.special_requirements,
        amount: Number(b.total_amount),
        status: (b.status === 'confirmed' ? 'in_progress' : b.status === 'pending' ? 'requested' : b.status === 'accepted' ? 'accepted' : b.status) as BookingStatus,
        customer_notes: b.special_requirements, provider_notes: null,
        created_at: b.created_at, updated_at: b.created_at,
        _source: 'anchor',
        _packageName: b.anchor_packages?.name || 'Anchor Package',
      }));

      // Fetch banquet bookings
      const { data: banquetData } = await supabase
        .from('banquet_bookings' as any)
        .select('*, banquet_halls(name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      const normalizedBanquet = (banquetData ?? []).map((b: any) => ({
        id: b.id, customer_id: b.customer_id, provider_id: b.provider_id,
        event_type_id: null, event_date: b.event_date, event_time: b.event_time,
        event_duration_hours: null, venue_address: b.venue || '', venue_city: b.city || '',
        venue_area: null, requirements: b.special_requirements,
        amount: Number(b.total_amount),
        status: (b.status === 'confirmed' ? 'in_progress' : b.status === 'pending' ? 'requested' : b.status === 'accepted' ? 'accepted' : b.status) as BookingStatus,
        customer_notes: b.special_requirements, provider_notes: null,
        created_at: b.created_at, updated_at: b.created_at,
        _source: 'banquet',
        _packageName: b.banquet_halls?.name || 'Banquet Hall',
      }));

      // Fetch rental bookings
      const { data: rentalData } = await supabase
        .from('rental_bookings' as any)
        .select('*, rental_packages(name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      const normalizedRental = (rentalData ?? []).map((b: any) => ({
        id: b.id, customer_id: b.customer_id, provider_id: b.provider_id,
        event_type_id: null, event_date: b.event_date, event_time: b.event_time,
        event_duration_hours: null, venue_address: b.delivery_address || '', venue_city: b.city || '',
        venue_area: null, requirements: b.special_instructions,
        amount: Number(b.total_amount),
        status: (b.status === 'confirmed' ? 'in_progress' : b.status === 'pending' ? 'requested' : b.status === 'accepted' ? 'accepted' : b.status) as BookingStatus,
        customer_notes: b.special_instructions, provider_notes: null,
        created_at: b.created_at, updated_at: b.created_at,
        _source: 'rental',
        _packageName: b.rental_packages?.name || 'Rental Package',
      }));

      // Fetch priest bookings
      const { data: priestData } = await supabase
        .from('priest_bookings' as any)
        .select('*, priest_packages(name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      const normalizedPriest = (priestData ?? []).map((b: any) => ({
        id: b.id, customer_id: b.customer_id, provider_id: b.provider_id,
        event_type_id: null, event_date: b.event_date, event_time: b.event_time,
        event_duration_hours: null, venue_address: b.venue || '', venue_city: b.city || '',
        venue_area: null, requirements: b.special_instructions,
        amount: Number(b.total_amount),
        status: (b.status === 'confirmed' ? 'in_progress' : b.status === 'pending' ? 'requested' : b.status === 'accepted' ? 'accepted' : b.status) as BookingStatus,
        customer_notes: b.special_instructions, provider_notes: null,
        created_at: b.created_at, updated_at: b.created_at,
        _source: 'priest',
        _packageName: b.priest_packages?.name || 'Priest Service',
      }));

      // Fetch water bookings
      const { data: waterData } = await supabase
        .from('water_bookings' as any)
        .select('*, water_packages(name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      const normalizedWater = (waterData ?? []).map((b: any) => ({
        id: b.id, customer_id: b.customer_id, provider_id: b.provider_id,
        event_type_id: null, event_date: b.event_date, event_time: b.delivery_time,
        event_duration_hours: null, venue_address: b.delivery_address || '', venue_city: b.city || '',
        venue_area: null, requirements: b.special_instructions,
        amount: Number(b.total_amount),
        status: (b.status === 'confirmed' ? 'in_progress' : b.status === 'pending' ? 'requested' : b.status === 'accepted' ? 'accepted' : b.status) as BookingStatus,
        customer_notes: b.special_instructions, provider_notes: null,
        created_at: b.created_at, updated_at: b.created_at,
        _source: 'water',
        _packageName: b.water_packages?.name || 'Water Supply',
      }));

      // Fetch band bookings
      const { data: bandData } = await supabase
        .from('band_bookings' as any)
        .select('*, band_packages(name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      const normalizedBand = (bandData ?? []).map((b: any) => ({
        id: b.id, customer_id: b.customer_id, provider_id: b.provider_id,
        event_type_id: null, event_date: b.event_date, event_time: b.event_time,
        event_duration_hours: null, venue_address: b.venue || '', venue_city: b.city || '',
        venue_area: null, requirements: b.special_requirements,
        amount: Number(b.total_amount),
        status: (b.status === 'confirmed' ? 'in_progress' : b.status === 'pending' ? 'requested' : b.status === 'accepted' ? 'accepted' : b.status) as BookingStatus,
        customer_notes: b.special_requirements, provider_notes: null,
        created_at: b.created_at, updated_at: b.created_at,
        _source: 'band',
        _packageName: b.band_packages?.name || 'Band Package',
      }));

      // Fetch singer bookings
      const { data: singerData } = await supabase
        .from('singer_bookings' as any)
        .select('*, singer_packages(name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      const normalizedSinger = (singerData ?? []).map((b: any) => ({
        id: b.id, customer_id: b.customer_id, provider_id: b.provider_id,
        event_type_id: null, event_date: b.event_date, event_time: b.event_time,
        event_duration_hours: null, venue_address: b.venue || '', venue_city: b.city || '',
        venue_area: null, requirements: b.special_requirements,
        amount: Number(b.total_amount),
        status: (b.status === 'confirmed' ? 'in_progress' : b.status === 'pending' ? 'requested' : b.status === 'accepted' ? 'accepted' : b.status) as BookingStatus,
        customer_notes: b.special_requirements, provider_notes: null,
        created_at: b.created_at, updated_at: b.created_at,
        _source: 'singer',
        _packageName: b.singer_packages?.name || 'Singer Package',
      }));

      // Fetch dancer bookings
      const { data: dancerData } = await supabase
        .from('dancer_bookings' as any)
        .select('*, dancer_packages(name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      const normalizedDancer = (dancerData ?? []).map((b: any) => ({
        id: b.id, customer_id: b.customer_id, provider_id: b.provider_id,
        event_type_id: null, event_date: b.event_date, event_time: b.event_time,
        event_duration_hours: null, venue_address: b.venue || '', venue_city: b.city || '',
        venue_area: null, requirements: b.special_requirements,
        amount: Number(b.total_amount),
        status: (b.status === 'confirmed' ? 'in_progress' : b.status === 'pending' ? 'requested' : b.status === 'accepted' ? 'accepted' : b.status) as BookingStatus,
        customer_notes: b.special_requirements, provider_notes: null,
        created_at: b.created_at, updated_at: b.created_at,
        _source: 'dancer',
        _packageName: b.dancer_packages?.name || 'Dance Package',
      }));

      // Combine and sort by date
      const combined = [
        ...(genericData || []).map((b: any) => ({ ...b, _source: 'generic' })),
        ...normalizedPhoto,
        ...normalizedCatering,
        ...normalizedDrone,
        ...normalizedVideography,
        ...normalizedDJ,
        ...normalizedDecorator,
        ...normalizedMakeup,
        ...normalizedMehendi,
        ...normalizedAnchor,
        ...normalizedBanquet,
        ...normalizedRental,
        ...normalizedPriest,
        ...normalizedWater,
        ...normalizedBand,
        ...normalizedSinger,
        ...normalizedDancer,
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setBookings(combined as any);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      hasLoadedOnce.current = true;
    }
  };

  useEffect(() => {
    fetchBookings(); // initial load — shows loading skeleton

    // Subscribe to realtime updates for both tables
    const channel = supabase
      .channel('customer-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `customer_id=eq.${user?.id}`
        },
        () => {
          fetchBookings(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photography_package_bookings',
          filter: `customer_id=eq.${user?.id}`
        },
        () => {
          fetchBookings(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'catering_bookings',
          filter: `customer_id=eq.${user?.id}`
        },
        () => {
          fetchBookings(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drone_bookings',
          filter: `customer_id=eq.${user?.id}`
        },
        () => {
          fetchBookings(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'videography_bookings',
          filter: `customer_id=eq.${user?.id}`
        },
        () => {
          fetchBookings(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dj_bookings',
          filter: `customer_id=eq.${user?.id}`
        },
        () => {
          fetchBookings(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mehendi_bookings',
          filter: `customer_id=eq.${user?.id}`
        },
        () => {
          fetchBookings(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'anchor_bookings',
          filter: `customer_id=eq.${user?.id}`
        },
        () => {
          fetchBookings(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'banquet_bookings',
          filter: `customer_id=eq.${user?.id}`
        },
        () => {
          fetchBookings(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rental_bookings',
          filter: `customer_id=eq.${user?.id}`
        },
        () => {
          fetchBookings(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'priest_bookings',
          filter: `customer_id=eq.${user?.id}`
        },
        () => {
          fetchBookings(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'water_bookings',
          filter: `customer_id=eq.${user?.id}`
        },
        () => {
          fetchBookings(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'band_bookings',
          filter: `customer_id=eq.${user?.id}`
        },
        () => {
          fetchBookings(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Refetch when tab becomes visible (handles realtime misses)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && user) fetchBookings(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { document.removeEventListener('visibilitychange', handleVisibility); };
  }, [user]);

  const createBooking = async (bookingData: {
    provider_id: string;
    event_type_id?: string;
    event_date: string;
    event_time?: string;
    event_duration_hours?: number;
    venue_address: string;
    venue_city: string;
    venue_area?: string;
    requirements?: string;
    amount: number;
  }) => {
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        ...bookingData,
        customer_id: user.id,
        platform_fee: 0
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  };

  const cancelBooking = async (bookingId: string) => {
    // Try to cancel in all booking tables (only one will match)
    const booking = bookings.find(b => b.id === bookingId);
    const source = (booking as any)?._source;

    if (source === 'photography') {
      const { error } = await supabase.from('photography_package_bookings' as any).update({ status: 'cancelled' }).eq('id', bookingId);
      if (error) throw error;
    } else if (source === 'catering') {
      const { error } = await supabase.from('catering_bookings' as any).update({ status: 'cancelled' }).eq('id', bookingId);
      if (error) throw error;
    } else if (source === 'drone') {
      const { error } = await supabase.from('drone_bookings' as any).update({ status: 'cancelled' }).eq('id', bookingId);
      if (error) throw error;
    } else if (source === 'videography') {
      const { error } = await supabase.from('videography_bookings' as any).update({ status: 'cancelled' }).eq('id', bookingId);
      if (error) throw error;
    } else if (source === 'dj') {
      const { error } = await supabase.from('dj_bookings' as any).update({ status: 'cancelled' }).eq('id', bookingId);
      if (error) throw error;
    } else if (source === 'decorator') {
      const { error } = await supabase.from('decorator_bookings' as any).update({ status: 'cancelled' }).eq('id', bookingId);
      if (error) throw error;
    } else if (source === 'makeup') {
      const { error } = await supabase.from('makeup_bookings' as any).update({ status: 'cancelled' }).eq('id', bookingId);
      if (error) throw error;
    } else if (source === 'mehendi') {
      const { error } = await supabase.from('mehendi_bookings' as any).update({ status: 'cancelled' }).eq('id', bookingId);
      if (error) throw error;
    } else if (source === 'anchor') {
      const { error } = await supabase.from('anchor_bookings' as any).update({ status: 'cancelled' }).eq('id', bookingId);
      if (error) throw error;
    } else if (source === 'banquet') {
      const { error } = await supabase.from('banquet_bookings' as any).update({ status: 'cancelled' }).eq('id', bookingId);
      if (error) throw error;
    } else if (source === 'rental') {
      const { error } = await supabase.from('rental_bookings' as any).update({ status: 'cancelled' }).eq('id', bookingId);
      if (error) throw error;
    } else if (source === 'priest') {
      const { error } = await supabase.from('priest_bookings' as any).update({ status: 'cancelled' }).eq('id', bookingId);
      if (error) throw error;
    } else if (source === 'water') {
      const { error } = await supabase.from('water_bookings' as any).update({ status: 'cancelled' }).eq('id', bookingId);
      if (error) throw error;
    } else if (source === 'band') {
      const { error } = await supabase.from('band_bookings' as any).update({ status: 'cancelled' }).eq('id', bookingId);
      if (error) throw error;
    } else if (source === 'singer') {
      const { error } = await supabase.from('singer_bookings' as any).update({ status: 'cancelled' }).eq('id', bookingId);
      if (error) throw error;
    } else if (source === 'dancer') {
      const { error } = await supabase.from('dancer_bookings' as any).update({ status: 'cancelled' }).eq('id', bookingId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('bookings').update({ status: 'cancelled' as BookingStatus }).eq('id', bookingId);
      if (error) throw error;
    }

    await fetchBookings(true);
  };

  return {
    bookings,
    isLoading,
    error,
    createBooking,
    cancelBooking,
    refetch: fetchBookings
  };
};
