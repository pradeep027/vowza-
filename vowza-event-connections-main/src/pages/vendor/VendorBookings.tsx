// VendorBookings — 100% real data from Supabase. Zero mock values.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  CalendarDays, Clock, MapPin, Users, CheckCircle, XCircle,
  MessageSquare, Eye, Search, Inbox, IndianRupee,
} from 'lucide-react';
import { useVendorId, useVendorRealtime, useVendorBookings } from '@/hooks/useVendorData';

type Tab = 'requested' | 'confirmed' | 'completed' | 'cancelled';

const TAB_CFG: Record<Tab, { label: string; color: string; bg: string }> = {
  requested: { label: 'Pending',   color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  confirmed: { label: 'Confirmed', color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
  completed: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  cancelled: { label: 'Cancelled', color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
};

const TABS: Tab[] = ['requested', 'confirmed', 'completed', 'cancelled'];

export default function VendorBookings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('requested');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const { data: provider } = useVendorId();
  const vendorId = provider?.id ?? null;
  useVendorRealtime(vendorId);

  const { data: bookings = [], isLoading } = useVendorBookings(vendorId, tab);

  const filtered = bookings.filter((b: any) =>
    !search ||
    b.customer?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.venue_city?.toLowerCase().includes(search.toLowerCase()) ||
    b.venue_address?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Accept / Reject ────────────────────────────────────────────────────────
  const updateStatus = async (booking: any, newStatus: 'confirmed' | 'cancelled') => {
    setBusy(booking.id);
    // Map UI status to valid database enum values
    const dbStatus = newStatus === 'confirmed' ? 'accepted' : 'cancelled';

    // Determine which table to update based on booking source
    const table = booking._source === 'photography' ? 'photography_package_bookings' : 'bookings';
    const updatePayload: any = { status: dbStatus };
    if (table === 'bookings') updatePayload.updated_at = new Date().toISOString();
    const { error } = await supabase
      .from(table as any)
      .update(updatePayload)
      .eq('id', booking.id);

    if (error) {
      toast.error(`Failed: ${error.message}`);
    } else {
      // Notify the customer
      if (booking.customer_id) {
        await supabase.from('notifications' as any).insert({
          user_id: booking.customer_id,
          title:   newStatus === 'confirmed' ? 'Booking Confirmed' : 'Booking Declined',
          message: newStatus === 'confirmed'
            ? 'Your booking request has been accepted. Check your bookings for details.'
            : 'Your booking request could not be accepted. Please explore other artists.',
          type: 'booking',
          reference_id: booking.id,
          is_read: false,
        });
      }
      toast.success(newStatus === 'confirmed' ? 'Booking accepted' : 'Booking declined');
      qc.invalidateQueries({ queryKey: ['vendor-bookings'] });
      qc.invalidateQueries({ queryKey: ['vendor-kpis'] });
      // Pending-bookings badge must update immediately
      qc.invalidateQueries({ queryKey: ['vendor-badges'] });
    }
    setBusy(null);
  };

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h1 className="text-xl font-bold text-foreground">Bookings</h1>
        <p className="text-sm text-muted-foreground">Manage all your event bookings</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl w-fit border border-border/50 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap',
              tab === t ? 'bg-white shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {TAB_CFG[t].label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by customer or venue..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
      </div>

      {/* List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-border/60 p-5 animate-pulse">
              <div className="h-5 bg-muted rounded w-1/3 mb-3" />
              <div className="h-4 bg-muted rounded w-1/2 mb-2" />
              <div className="h-4 bg-muted rounded w-1/4" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border/60 p-16 text-center">
            <Inbox className="w-14 h-14 text-muted-foreground/20 mx-auto mb-5" />
            <h3 className="text-base font-semibold text-foreground mb-2">
              No {TAB_CFG[tab].label} Bookings
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {tab === 'requested'
                ? 'New booking requests from customers will appear here.'
                : `You have no ${TAB_CFG[tab].label.toLowerCase()} bookings yet.`}
            </p>
          </div>
        ) : filtered.map((b: any) => {
          const advance   = Number(b.advance_paid ?? 0);
          const total     = Number(b.amount ?? 0);
          const remaining = Math.max(0, total - advance);
          const name      = b.customer?.full_name ?? 'Customer';

          return (
            <div key={b.id} className="bg-white rounded-2xl border border-border/60 p-5 hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  {b.customer?.avatar_url ? (
                    <img src={b.customer.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#8B1538] to-[#D4AF37] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {b.customer?.email ?? b.customer?.phone ?? '—'}
                    </p>
                  </div>
                </div>
                <span className={cn('text-[10px] font-bold border px-2.5 py-1 rounded-full capitalize flex-shrink-0',
                  TAB_CFG[tab].bg, TAB_CFG[tab].color)}>
                  {b.status}
                </span>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">
                    {b.venue_address || b.venue_city || b.venue_area || 'Venue not set'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                  {b.event_date
                    ? new Date(b.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'Date TBD'}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  {b.event_time || 'Time TBD'}
                  {b.event_duration_hours ? ` · ${b.event_duration_hours}h` : ''}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="w-3.5 h-3.5 flex-shrink-0" />
                  {b.guest_count ? `${b.guest_count} guests` : 'Guests TBD'}
                </div>
              </div>

              {/* Requirements */}
              {b.requirements && (
                <p className="text-xs text-muted-foreground bg-[#FAFAFA] rounded-xl p-3 mb-4 leading-relaxed">
                  {b.requirements}
                </p>
              )}

              {/* Money + actions */}
              <div className="flex items-end justify-between gap-4 pt-4 border-t border-border/40 flex-wrap">
                <div className="flex items-center gap-5">
                  {b.package_name && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Package</p>
                      <p className="text-xs font-semibold text-foreground">{b.package_name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-muted-foreground">Advance</p>
                    <p className="text-xs font-semibold text-emerald-600">
                      {advance > 0 ? `₹${advance.toLocaleString('en-IN')}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Remaining</p>
                    <p className="text-xs font-semibold text-foreground">
                      {remaining > 0 ? `₹${remaining.toLocaleString('en-IN')}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                    <p className="text-xs font-bold text-foreground">
                      {total > 0 ? `₹${total.toLocaleString('en-IN')}` : 'Quote pending'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {tab === 'requested' && (
                    <>
                      <button onClick={() => updateStatus(b, 'confirmed')} disabled={busy === b.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50">
                        <CheckCircle className="w-3.5 h-3.5" /> Accept
                      </button>
                      <button onClick={() => updateStatus(b, 'cancelled')} disabled={busy === b.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors disabled:opacity-50">
                        <XCircle className="w-3.5 h-3.5" /> Decline
                      </button>
                    </>
                  )}
                  <button onClick={() => navigate(`/chat/${b.id}`)}
                    className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors" title="Chat">
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
