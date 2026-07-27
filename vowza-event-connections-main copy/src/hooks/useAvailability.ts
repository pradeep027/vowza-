// ─── useAvailability hook ────────────────────────────────────────────────────
// Fetches booked dates, blocked dates, and available dates for an artist.
// Used by AvailabilityCalendar and the booking flow to prevent double bookings.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DateAvailability {
  date: string;          // ISO date string YYYY-MM-DD
  status: 'available' | 'booked' | 'blocked' | 'past';
  bookingId?: string;
  reason?: string;
}

export interface AvailabilityResult {
  dates: DateAvailability[];
  bookedDates: Set<string>;
  blockedDates: Set<string>;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// ─── Check if a specific date+time is available for a provider ───────────────
export async function checkDateAvailable(
  providerId: string,
  date: string,
  time?: string,
  durationHours?: number
): Promise<{ available: boolean; reason?: string }> {
  // 1. Check if date is in the past
  if (new Date(date) < new Date(new Date().toDateString())) {
    return { available: false, reason: 'This date is in the past' };
  }

  // 2. Check blocked dates
  const { data: blocked } = await supabase
    .from('provider_availability')
    .select('id, reason, slot_type')
    .eq('provider_id', providerId)
    .eq('unavailable_date', date)
    .eq('slot_type', 'unavailable')
    .maybeSingle();

  if (blocked) {
    return { available: false, reason: blocked.reason || 'Artist has marked this date as unavailable' };
  }

  // 3. Check existing accepted/requested bookings on this date
  const { data: existing, error } = await supabase
    .from('bookings')
    .select('id, event_time, event_duration_hours, status')
    .eq('provider_id', providerId)
    .eq('event_date', date)
    .in('status', ['requested', 'accepted', 'in_progress']);

  if (error) return { available: true }; // fail open

  if (!existing || existing.length === 0) return { available: true };

  // 4. If time is not provided, the whole day is considered potentially booked
  if (!time) {
    return {
      available: false,
      reason: `Artist already has ${existing.length} booking(s) on this date. Please check availability or choose another date.`,
    };
  }

  // 5. Time conflict check
  const requestStart = parseTime(time);
  const requestEnd   = requestStart + (durationHours || 4) * 60;

  for (const booking of existing) {
    if (!booking.event_time) continue;
    const existStart = parseTime(booking.event_time);
    const existEnd   = existStart + (booking.event_duration_hours || 4) * 60;
    if (requestStart < existEnd && requestEnd > existStart) {
      return {
        available: false,
        reason: `Artist is already booked from ${booking.event_time} on this date. Please choose a different time.`,
      };
    }
  }

  return { available: true };
}

function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

// ─── Get nearest available dates after a given date ──────────────────────────
export async function getNearestAvailableDates(
  providerId: string,
  afterDate: string,
  count = 3
): Promise<string[]> {
  const available: string[] = [];
  const start = new Date(afterDate);
  start.setDate(start.getDate() + 1);

  for (let i = 0; available.length < count && i < 30; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    const result = await checkDateAvailable(providerId, iso);
    if (result.available) available.push(iso);
  }

  return available;
}

// ─── Hook: fetch all availability for a provider ─────────────────────────────
export function useAvailability(providerId: string | undefined, month?: Date): AvailabilityResult {
  const [dates, setDates] = useState<DateAvailability[]>([]);
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailability = useCallback(async () => {
    if (!providerId) return;

    setIsLoading(true);
    setError(null);

    try {
      const now = month ?? new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 2, 0); // 2 months ahead
      const startISO = startOfMonth.toISOString().split('T')[0];
      const endISO   = endOfMonth.toISOString().split('T')[0];

      // Fetch booked dates (accepted + requested + in_progress)
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('event_date, id, status')
        .eq('provider_id', providerId)
        .gte('event_date', startISO)
        .lte('event_date', endISO)
        .in('status', ['requested', 'accepted', 'in_progress']);

      // Fetch blocked dates
      const { data: blockedData } = await supabase
        .from('provider_availability')
        .select('unavailable_date, reason, slot_type')
        .eq('provider_id', providerId)
        .gte('unavailable_date', startISO)
        .lte('unavailable_date', endISO);

      const booked  = new Set<string>();
      const blocked = new Set<string>();
      const result:  DateAvailability[] = [];

      (bookingsData ?? []).forEach(b => {
        booked.add(b.event_date);
        result.push({ date: b.event_date, status: 'booked', bookingId: b.id });
      });

      (blockedData ?? []).forEach(b => {
        if (b.slot_type === 'unavailable') {
          blocked.add(b.unavailable_date);
          // Override if already marked as booked
          const idx = result.findIndex(r => r.date === b.unavailable_date);
          const entry: DateAvailability = { date: b.unavailable_date, status: 'blocked', reason: b.reason ?? undefined };
          if (idx >= 0) result[idx] = entry; else result.push(entry);
        }
      });

      setBookedDates(booked);
      setBlockedDates(blocked);
      setDates(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [providerId, month]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  return { dates, bookedDates, blockedDates, isLoading, error, refetch: fetchAvailability };
}

// ─── Hook: artist manages their own blocked dates ────────────────────────────
export function useArtistAvailabilityManager(providerId: string | undefined) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const blockDate = async (date: string, reason?: string) => {
    if (!providerId) return;
    setIsSubmitting(true);
    try {
      // Check if entry already exists
      const { data: existing } = await supabase
        .from('provider_availability')
        .select('id')
        .eq('provider_id', providerId)
        .eq('unavailable_date', date)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('provider_availability')
          .update({ slot_type: 'unavailable', reason: reason ?? null })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('provider_availability')
          .insert({
            provider_id:      providerId,
            unavailable_date: date,
            slot_type:        'unavailable',
            reason:           reason ?? null,
          } as any);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const unblockDate = async (date: string) => {
    if (!providerId) return;
    setIsSubmitting(true);
    try {
      await supabase
        .from('provider_availability')
        .delete()
        .eq('provider_id', providerId)
        .eq('unavailable_date', date)
        .eq('slot_type', 'unavailable');
    } finally {
      setIsSubmitting(false);
    }
  };

  return { blockDate, unblockDate, isSubmitting };
}
