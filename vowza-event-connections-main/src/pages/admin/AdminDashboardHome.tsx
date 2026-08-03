// ─── Admin Dashboard Home — Real-time stats, live charts, activity feed ───────
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminStats, fmtCurrency } from '@/hooks/useAdminStats';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
  Users, UserCheck, BookOpen, IndianRupee, Clock,
  CheckCircle, XCircle, TrendingUp, Star, Tag,
  ArrowUpRight, RefreshCw, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const COLORS = ['#C9323A','#D4A017','#3B5BDB','#2F9E44','#E8590C','#7048E8','#0CA678'];

// ── Stat card — module scope ──────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, trend, onClick }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string; trend?: number; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5 text-left',
        'hover:shadow-md hover:border-border transition-all duration-200',
        onClick ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend !== undefined && (
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5',
            trend >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
            <ArrowUpRight className={cn('w-2.5 h-2.5', trend < 0 && 'rotate-180')} />
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </button>
  );
}

const Sk = ({ h = 'h-24' }: { h?: string }) => (
  <div className={`skeleton rounded-2xl ${h}`} />
);

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminDashboardHome() {
  const { stats, refresh } = useAdminStats();
  const navigate = useNavigate();

  const [monthlyData,  setMonthlyData]  = useState<any[]>([]);
  const [catData,      setCatData]      = useState<any[]>([]);
  const [recentActs,   setRecentActs]   = useState<any[]>([]);
  const [chartsLoaded, setChartsLoaded] = useState(false);

  useEffect(() => { loadCharts(); }, []);

  // Re-fetch charts when provider_profiles changes (approval/rejection triggers this)
  useEffect(() => {
    const ch = supabase.channel('dashboard-charts-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'provider_profiles' }, () => {
        loadCharts();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const loadCharts = async () => {
    try {
      const now = new Date();
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        return { label: d.toLocaleString('default', { month: 'short' }), year: d.getFullYear(), month: d.getMonth() };
      });

      const [bookRes, artistsRes, paymentsRes, recentRes] = await Promise.allSettled([
        supabase.from('bookings').select('created_at,total_amount,status'),
        supabase.from('provider_profiles').select('profession,verification_status,created_at'),
        supabase.from('payments' as any).select('amount,created_at,status'),
        supabase.from('provider_profiles').select('id,profession,verification_status,created_at')
          .order('created_at', { ascending: false }).limit(8),
      ]);

      const bookings = bookRes.status    === 'fulfilled' ? (bookRes.value.data    ?? []) : [];
      const artists  = artistsRes.status === 'fulfilled' ? (artistsRes.value.data ?? []) : [];
      const payments = paymentsRes.status === 'fulfilled' ? (paymentsRes.value.data ?? []) : [];
      const recent   = recentRes.status  === 'fulfilled' ? (recentRes.value.data  ?? []) : [];

      // Monthly chart data
      const monthly = months.map(m => {
        const bks = bookings.filter((b: any) => {
          const d = new Date(b.created_at);
          return d.getFullYear() === m.year && d.getMonth() === m.month;
        });
        const rev = payments
          .filter((p: any) => {
            const d = new Date(p.created_at);
            return p.status === 'completed' && d.getFullYear() === m.year && d.getMonth() === m.month;
          })
          .reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
        const newArtists = artists.filter((a: any) => {
          const d = new Date(a.created_at);
          return d.getFullYear() === m.year && d.getMonth() === m.month;
        }).length;
        return { month: m.label, bookings: bks.length, revenue: rev, artists: newArtists };
      });
      setMonthlyData(monthly);

      // Category distribution
      const catCounts: Record<string, number> = {};
      artists.forEach((a: any) => {
        const c = (a.profession ?? 'Other').replace(/_/g, ' ');
        catCounts[c] = (catCounts[c] ?? 0) + 1;
      });
      setCatData(Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, value]) => ({ name, value })));

      // Recent activity
      setRecentActs(recent);
    } catch (e) { console.error(e); }
    finally { setChartsLoaded(true); }
  };

  const s = stats;

  // Show error state if RLS is blocking all queries
  const isBlocked = s.error && s.totalArtists === 0 && s.totalUsers === 0;

  if (s.loading && !chartsLoaded) return (
    <div className="p-6 space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 16 }).map((_, i) => <Sk key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Sk h="h-72 lg:col-span-2" /> <Sk h="h-72" />
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {s.lastUpdated ? `Last updated ${s.lastUpdated.toLocaleTimeString('en-IN')}` : 'Loading…'}
          </p>
        </div>
        <button onClick={() => { refresh(); loadCharts(); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors">
          <RefreshCw className={cn('w-3.5 h-3.5', s.loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* RLS / Permission warning */}
      {isBlocked && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-red-700 mb-2">⚠️ Database Access Issue</h3>
          <p className="text-xs text-red-600 leading-relaxed">
            The admin dashboard cannot read data. This is usually caused by missing RLS policies.
            Run the migration file <code className="bg-red-100 px-1 rounded">20260803000000_approval_workflow.sql</code> in your
            Supabase SQL Editor to fix admin access permissions.
          </p>
          <p className="text-xs text-red-500 mt-2 font-mono">{s.error}</p>
        </div>
      )}

      {/* Empty state when DB has no data yet */}
      {!s.loading && !isBlocked && s.totalArtists === 0 && s.totalUsers === 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-2xl p-5">
          <p className="text-sm font-semibold text-blue-700">📊 Dashboard is ready</p>
          <p className="text-xs text-blue-600 mt-1">
            No data yet — stats will appear here as artists register, customers sign up, and bookings are made.
          </p>
        </div>
      )}
      {s.pendingVerifications > 0 && (
        <button onClick={() => navigate('/admin/artists')}
          className="w-full flex items-center gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 hover:bg-amber-100 transition-colors text-left">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            {s.pendingVerifications} artist{s.pendingVerifications > 1 ? 's' : ''} waiting for verification — click to review
          </span>
          <ArrowUpRight className="w-4 h-4 text-amber-500 ml-auto flex-shrink-0" />
        </button>
      )}

      {/* Stat cards — Row 1: Artists */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Artists</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={UserCheck}   label="Total Artists"          value={s.totalArtists}             color="bg-violet-500" onClick={() => navigate('/admin/artists')} />
          <StatCard icon={Clock}       label="Pending Verification"   value={s.pendingVerifications}     color="bg-amber-500"  onClick={() => navigate('/admin/artists')} />
          <StatCard icon={CheckCircle} label="Approved Artists"       value={s.approvedArtists}          color="bg-emerald-500" />
          <StatCard icon={XCircle}     label="Rejected Artists"       value={s.rejectedArtists}          color="bg-red-500" />
        </div>
      </div>

      {/* Row 2: Users + Bookings */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Users & Bookings</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={Users}     label="Total Users"         value={s.totalUsers}          color="bg-blue-500"   onClick={() => navigate('/admin/customers')} />
          <StatCard icon={BookOpen}  label="Total Bookings"      value={s.totalBookings}       color="bg-indigo-500" onClick={() => navigate('/admin/bookings')} />
          <StatCard icon={Clock}     label="Today's Bookings"    value={s.todayBookings}       color="bg-sky-500" />
          <StatCard icon={CheckCircle} label="Completed"         value={s.completedBookings}   color="bg-teal-500" />
        </div>
      </div>

      {/* Row 3: Revenue */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Revenue</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={IndianRupee} label="Total Revenue"     value={fmtCurrency(s.totalRevenue)}   color="bg-emerald-500" onClick={() => navigate('/admin/payments')} />
          <StatCard icon={TrendingUp}  label="Today's Revenue"   value={fmtCurrency(s.todayRevenue)}   color="bg-maroon bg-[hsl(345_72%_32%)]" />
          <StatCard icon={IndianRupee} label="Monthly Revenue"   value={fmtCurrency(s.monthlyRevenue)} color="bg-green-600" />
          <StatCard icon={Star}        label="Avg. Rating"        value={`${s.averageRating}★`}         color="bg-yellow-500" />
        </div>
      </div>

      {/* Row 4: Misc */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Platform</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={Tag}       label="Categories"         value={s.totalCategories}     color="bg-lime-600"   onClick={() => navigate('/admin/categories')} />
          <StatCard icon={Star}      label="Total Reviews"      value={s.totalReviews}        color="bg-orange-500" onClick={() => navigate('/admin/reviews')} />
          <StatCard icon={BookOpen}  label="Pending Bookings"   value={s.pendingBookings}     color="bg-amber-600"  onClick={() => navigate('/admin/bookings')} />
          <StatCard icon={XCircle}   label="Cancelled Bookings" value={s.cancelledBookings}   color="bg-rose-500"   onClick={() => navigate('/admin/bookings')} />
        </div>
      </div>

      {/* Charts */}
      {chartsLoaded && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Monthly trend */}
          <div className="lg:col-span-2 bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Revenue & Bookings — Last 6 Months</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#C9323A" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#C9323A" stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="bk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3B5BDB" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3B5BDB" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 91%)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="rev" tick={{ fontSize: 11 }} tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}`} />
                <YAxis yAxisId="bk" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any, n: any) => [n === 'revenue' ? fmtCurrency(v) : v, n === 'revenue' ? 'Revenue' : 'Bookings']} />
                <Area yAxisId="rev" type="monotone" dataKey="revenue"  stroke="#C9323A" fill="url(#rev)" strokeWidth={2} />
                <Area yAxisId="bk"  type="monotone" dataKey="bookings" stroke="#3B5BDB" fill="url(#bk)"  strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Category distribution */}
          <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Artist Categories</h3>
            {catData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No artists yet</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={catData} cx="50%" cy="50%" outerRadius={75} dataKey="value" labelLine={false}>
                      {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any, _: any, p: any) => [v, p.payload.name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1">
                  {catData.slice(0, 5).map((c, i) => (
                    <div key={c.name} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground capitalize truncate max-w-[120px]">{c.name}</span>
                      </div>
                      <span className="font-semibold text-foreground">{c.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Recent registrations */}
      {chartsLoaded && (
        <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Recent Artist Registrations</h3>
            <button onClick={() => navigate('/admin/artists')} className="text-xs font-semibold text-maroon hover:opacity-75 flex items-center gap-1">
              View all <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          {recentActs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No artist registrations yet</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {recentActs.map((a: any) => (
                <div key={a.id} className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-2 border border-border/40">
                  <div className="w-9 h-9 rounded-xl bg-gradient-maroon flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-white">{(a.profession ?? 'A').charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground capitalize truncate">{(a.profession ?? '—').replace(/_/g, ' ')}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-auto flex-shrink-0 ${
                    a.verification_status === 'approved' ? 'bg-emerald-50 text-emerald-700'
                    : a.verification_status === 'rejected' ? 'bg-red-50 text-red-700'
                    : 'bg-amber-50 text-amber-700'}`}>
                    {a.verification_status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
