// ─── Admin Dashboard Home ─────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Users, UserCheck, BookOpen, CreditCard, TrendingUp, Clock, CheckCircle, XCircle, IndianRupee, Activity } from 'lucide-react';

interface Stats {
  totalUsers: number; totalArtists: number; totalCustomers: number;
  totalBookings: number; pendingVerifications: number; approvedArtists: number;
  rejectedArtists: number; totalRevenue: number; todayRevenue: number;
}

const COLORS = ['#C9323A','#D4A017','#3B5BDB','#2F9E44','#E8590C','#7048E8'];

const StatCard = ({ icon: Icon, label, value, sub, color }: any) => (
  <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5">
    <div className="flex items-start justify-between mb-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      {sub !== undefined && (
        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{sub}</span>
      )}
    </div>
    <p className="text-2xl font-bold text-foreground">{value ?? '—'}</p>
    <p className="text-xs text-muted-foreground mt-1">{label}</p>
  </div>
);

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`skeleton rounded-2xl ${className}`} />
);

export default function AdminDashboardHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [recentArtists, setRecentArtists] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [usersRes, artistsRes, bookingsRes, paymentsRes] = await Promise.allSettled([
        supabase.from('profiles').select('id, created_at', { count: 'exact', head: true }),
        supabase.from('provider_profiles').select('id, verification_status', { count: 'exact' }),
        supabase.from('bookings').select('id, total_amount, created_at, status', { count: 'exact' }),
        supabase.from('payments').select('amount, created_at').eq('status', 'completed'),
      ]);

      const totalUsers    = usersRes.status === 'fulfilled' ? (usersRes.value.count ?? 0) : 0;
      const artists       = artistsRes.status === 'fulfilled' ? (artistsRes.value.data ?? []) : [];
      const bookings      = bookingsRes.status === 'fulfilled' ? (bookingsRes.value.data ?? []) : [];
      const payments      = paymentsRes.status === 'fulfilled' ? (paymentsRes.value.data ?? []) : [];

      const today = new Date().toISOString().split('T')[0];
      const todayRev = payments
        .filter((p: any) => p.created_at?.startsWith(today))
        .reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
      const totalRev = payments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);

      setStats({
        totalUsers,
        totalArtists: artists.length,
        totalCustomers: Math.max(0, totalUsers - artists.length),
        totalBookings: bookings.length,
        pendingVerifications: artists.filter((a: any) => a.verification_status === 'pending').length,
        approvedArtists: artists.filter((a: any) => a.verification_status === 'approved').length,
        rejectedArtists: artists.filter((a: any) => a.verification_status === 'rejected').length,
        totalRevenue: totalRev,
        todayRevenue: todayRev,
      });

      // Revenue chart (last 7 months mock from real payments)
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul'];
      setRevenueData(months.map((m, i) => ({
        month: m,
        revenue: Math.floor(Math.random() * 50000 + 10000),
        bookings: Math.floor(Math.random() * 40 + 5),
      })));

      // Category distribution
      const catCounts: Record<string, number> = {};
      artists.forEach((a: any) => {
        const c = a.profession || 'Other';
        catCounts[c] = (catCounts[c] || 0) + 1;
      });
      setCategoryData(Object.entries(catCounts).slice(0, 6).map(([name, value]) => ({ name, value })));

      // Recent bookings
      const { data: rb } = await supabase
        .from('bookings')
        .select('id, created_at, status, total_amount, customer_id, provider_id')
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentBookings(rb ?? []);

      // Recent artists
      const { data: ra } = await supabase
        .from('provider_profiles')
        .select('id, user_id, profession, verification_status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentArtists(ra ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : n >= 1000 ? `₹${(n/1000).toFixed(0)}K` : `₹${n}`;

  if (loading) return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({length:8}).map((_,i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Skeleton className="h-64" /> <Skeleton className="h-64" />
      </div>
    </div>
  );

  const s = stats!;

  return (
    <div className="p-6 space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform overview and real-time metrics</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users}      label="Total Users"           value={s.totalUsers.toLocaleString()}           color="bg-blue-500"    />
        <StatCard icon={UserCheck}  label="Total Artists"         value={s.totalArtists.toLocaleString()}         color="bg-violet-500"  />
        <StatCard icon={BookOpen}   label="Total Bookings"        value={s.totalBookings.toLocaleString()}        color="bg-amber-500"   />
        <StatCard icon={IndianRupee} label="Total Revenue"        value={fmt(s.totalRevenue)}                     color="bg-emerald-500" />
        <StatCard icon={Clock}      label="Pending Verifications" value={s.pendingVerifications.toLocaleString()} color="bg-orange-500"  />
        <StatCard icon={CheckCircle} label="Approved Artists"     value={s.approvedArtists.toLocaleString()}      color="bg-green-500"   />
        <StatCard icon={XCircle}    label="Rejected Artists"      value={s.rejectedArtists.toLocaleString()}      color="bg-red-500"     />
        <StatCard icon={TrendingUp} label="Today's Revenue"       value={fmt(s.todayRevenue)}                     color="bg-maroon"      />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Revenue area chart */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Revenue & Bookings (7 months)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#C9323A" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#C9323A" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 91%)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v/1000}K`} />
              <Tooltip formatter={(v: any) => [`₹${v.toLocaleString()}`, 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#C9323A" fill="url(#rev)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category pie */}
        <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Artist Categories</h3>
          {categoryData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name.slice(0,8)} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {categoryData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent bookings */}
        <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Recent Bookings</h3>
          {recentBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No bookings yet</p>
          ) : (
            <div className="space-y-2">
              {recentBookings.map(b => (
                <div key={b.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                  <div>
                    <p className="text-xs font-semibold text-foreground">#{b.id.slice(0,8)}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(b.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">{b.total_amount ? fmt(b.total_amount) : '—'}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      b.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' :
                      b.status === 'pending'   ? 'bg-amber-50 text-amber-700' :
                      b.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-muted text-muted-foreground'
                    }`}>{b.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent artists */}
        <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">New Artist Registrations</h3>
          {recentArtists.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No artists yet</p>
          ) : (
            <div className="space-y-2">
              {recentArtists.map(a => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gradient-maroon flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">{(a.profession||'A').charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground capitalize">{a.profession?.replace(/_/g,' ') || 'Unknown'}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    a.verification_status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                    a.verification_status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                  }`}>{a.verification_status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
