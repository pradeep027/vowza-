// VendorBookings — Premium bookings management with status tabs and actions
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  CalendarDays, Clock, MapPin, Users, IndianRupee,
  CheckCircle, XCircle, MessageSquare, Phone, Eye,
  Filter, Search, ChevronDown,
} from 'lucide-react';

type BookingStatus = 'requested' | 'confirmed' | 'completed' | 'cancelled';

interface Booking {
  id: string; customer_name: string; customer_avatar?: string;
  event_type: string; venue: string; date: string; time: string;
  guests: number; package_name: string; advance_paid: number;
  total_amount: number; status: BookingStatus; created_at: string;
}

const STATUS_CFG: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  requested: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  confirmed: { label: 'Confirmed', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  completed: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  cancelled: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
};

const TABS: BookingStatus[] = ['requested', 'confirmed', 'completed', 'cancelled'];

export default function VendorBookings() {
  const { user } = useAuth();
  const [tab, setTab] = useState<BookingStatus>('requested');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('bookings' as any)
        .select('*')
        .eq('provider_id', user.id)
        .eq('status', tab)
        .order('created_at', { ascending: false });
      setBookings((data as any) ?? []);
      setLoading(false);
    })();
  }, [user, tab]);

  // Mock data fallback for empty DB
  const displayBookings: Booking[] = bookings.length > 0 ? bookings : [
    { id: '1', customer_name: 'Rahul Sharma', event_type: 'Wedding', venue: 'Grand Hyatt, Hyderabad', date: '2026-08-15', time: '6:00 PM', guests: 200, package_name: 'Premium', advance_paid: 25000, total_amount: 75000, status: tab, created_at: '2026-08-01' },
    { id: '2', customer_name: 'Priya Reddy', event_type: 'Birthday', venue: 'Taj Krishna, Hyderabad', date: '2026-08-20', time: '7:30 PM', guests: 80, package_name: 'Gold', advance_paid: 10000, total_amount: 35000, status: tab, created_at: '2026-08-02' },
    { id: '3', customer_name: 'Ankit Gupta', event_type: 'Corporate Event', venue: 'ITC Kohenur', date: '2026-08-25', time: '10:00 AM', guests: 150, package_name: 'Luxury', advance_paid: 50000, total_amount: 120000, status: tab, created_at: '2026-08-03' },
  ];

  const filtered = displayBookings.filter(b =>
    !search || b.customer_name.toLowerCase().includes(search.toLowerCase()) || b.event_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Bookings</h1>
          <p className="text-sm text-muted-foreground">Manage all your event bookings</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl w-fit border border-border/50">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize',
              tab === t ? 'bg-white shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {STATUS_CFG[t].label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search bookings..." className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
      </div>

      {/* Booking Cards */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-border/60 p-5 animate-pulse">
              <div className="h-5 bg-muted rounded w-1/3 mb-3" />
              <div className="h-4 bg-muted rounded w-1/2 mb-2" />
              <div className="h-4 bg-muted rounded w-1/4" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border/60 p-12 text-center">
            <CalendarDays className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm font-semibold text-foreground mb-1">No {STATUS_CFG[tab].label} Bookings</p>
            <p className="text-xs text-muted-foreground">Bookings will appear here once customers make requests.</p>
          </div>
        ) : filtered.map(b => (
          <div key={b.id} className="bg-white rounded-2xl border border-border/60 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#8B1538] to-[#D4AF37] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {b.customer_name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{b.customer_name}</h3>
                  <p className="text-xs text-muted-foreground">{b.event_type}</p>
                </div>
              </div>
              <span className={cn('text-[10px] font-bold border px-2.5 py-1 rounded-full', STATUS_CFG[b.status].bg, STATUS_CFG[b.status].color)}>
                {STATUS_CFG[b.status].label}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" /> <span className="truncate">{b.venue}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="w-3.5 h-3.5" /> {new Date(b.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" /> {b.time}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" /> {b.guests} guests
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border/40">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] text-muted-foreground">Package</p>
                  <p className="text-xs font-semibold text-foreground">{b.package_name}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Advance</p>
                  <p className="text-xs font-semibold text-emerald-600">₹{b.advance_paid.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                  <p className="text-xs font-semibold text-foreground">₹{b.total_amount.toLocaleString('en-IN')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {tab === 'requested' && (
                  <>
                    <button className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="Accept">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Reject">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors" title="Chat">
                  <MessageSquare className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors" title="View">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
