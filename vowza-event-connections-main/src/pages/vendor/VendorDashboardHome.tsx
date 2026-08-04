// VendorDashboardHome — Premium KPI cards, analytics charts, quick actions, calendar
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  IndianRupee, TrendingUp, CalendarDays, Star, Eye, Users,
  Clock, Repeat, Image, Package, Zap, Share2, Sparkles,
  ArrowRight, Plus, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

// ── KPI Card ──────────────────────────────────────────────────────────────────
interface KPIProps {
  label: string; value: string; change: string; positive: boolean;
  icon: React.ElementType; color: string; bgColor: string;
}

function KPICard({ label, value, change, positive, icon: Icon, color, bgColor }: KPIProps) {
  return (
    <div className="bg-white rounded-2xl border border-border/60 p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', bgColor)}>
          <Icon className={cn('w-5 h-5', color)} />
        </div>
        <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full',
          positive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
          {positive ? '+' : ''}{change}
        </span>
      </div>
      <p className="text-2xl font-bold text-foreground mb-1">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Quick Action Card ─────────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-border/60 bg-white hover:border-[#8B1538]/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
      <div className="w-10 h-10 rounded-xl bg-[#8B1538]/5 group-hover:bg-[#8B1538]/10 flex items-center justify-center transition-colors">
        <Icon className="w-5 h-5 text-[#8B1538]" />
      </div>
      <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground text-center leading-tight">{label}</span>
    </button>
  );
}

// ── Profile Completion ────────────────────────────────────────────────────────
function ProfileCompletion({ percent }: { percent: number }) {
  const r = 45; const c = 2 * Math.PI * r; const offset = c - (percent / 100) * c;
  return (
    <div className="bg-white rounded-2xl border border-border/60 p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4">Profile Completion</h3>
      <div className="flex items-center gap-6">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f1f1" strokeWidth="8" />
            <circle cx="50" cy="50" r={r} fill="none" stroke="#8B1538" strokeWidth="8"
              strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
              className="transition-all duration-1000" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-foreground">{percent}%</span>
          </div>
        </div>
        <div className="space-y-2 flex-1">
          {[
            { label: 'Basic Details', done: true },
            { label: 'Portfolio', done: percent > 40 },
            { label: 'Packages', done: percent > 60 },
            { label: 'Verification', done: percent > 80 },
            { label: 'Bank Details', done: percent > 90 },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={cn('w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center',
                item.done ? 'bg-emerald-500 border-emerald-500' : 'border-border')}>
                {item.done && <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L4.5 8.5 2 6" stroke="currentColor" strokeWidth="2" fill="none" /></svg>}
              </div>
              <span className={cn('text-xs', item.done ? 'text-foreground' : 'text-muted-foreground')}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <button className="w-full mt-5 py-2.5 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors">
        Complete Profile
      </button>
    </div>
  );
}

// ── Mini Calendar ─────────────────────────────────────────────────────────────
function MiniCalendar() {
  const [month, setMonth] = useState(new Date());
  const today = new Date();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const monthName = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white rounded-2xl border border-border/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">{monthName}</h3>
        <div className="flex gap-1">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1))} className="p-1 rounded-lg hover:bg-secondary"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1))} className="p-1 rounded-lg hover:bg-secondary"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['S','M','T','W','T','F','S'].map(d => (
          <div key={d} className="text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const isToday = day === today.getDate() && month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear();
          return (
            <div key={day} className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-xs cursor-pointer transition-colors',
              isToday ? 'bg-[#8B1538] text-white font-bold' : 'hover:bg-secondary text-foreground')}>
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Chart data (mock — replace with real Supabase data) ───────────────────────
const revenueData = [
  { name: 'Mon', revenue: 4500 }, { name: 'Tue', revenue: 8200 },
  { name: 'Wed', revenue: 6100 }, { name: 'Thu', revenue: 12400 },
  { name: 'Fri', revenue: 9800 }, { name: 'Sat', revenue: 18500 },
  { name: 'Sun', revenue: 15200 },
];

const bookingsData = [
  { name: 'Jan', bookings: 8 }, { name: 'Feb', bookings: 12 },
  { name: 'Mar', bookings: 15 }, { name: 'Apr', bookings: 10 },
  { name: 'May', bookings: 18 }, { name: 'Jun', bookings: 22 },
];

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function VendorDashboardHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalEarnings: '0', monthlyRevenue: '0', totalBookings: 0,
    upcomingEvents: 0, avgRating: '0.0', pendingRequests: 0,
    repeatCustomers: 0, profileViews: 0,
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Fetch provider stats from Supabase
      const { data: provider } = await supabase
        .from('provider_profiles')
        .select('total_bookings, average_rating, total_reviews')
        .eq('user_id', user.id)
        .limit(1);

      if (provider && provider.length > 0) {
        const p = provider[0] as any;
        setStats(s => ({
          ...s,
          totalBookings: p.total_bookings ?? 0,
          avgRating: (p.average_rating ?? 0).toFixed(1),
        }));
      }
    })();
  }, [user]);

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* ── ROW 1: KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Earnings" value="₹2,45,000" change="12%" positive icon={IndianRupee} color="text-emerald-600" bgColor="bg-emerald-50" />
        <KPICard label="Monthly Revenue" value="₹48,500" change="8%" positive icon={TrendingUp} color="text-blue-600" bgColor="bg-blue-50" />
        <KPICard label="Total Bookings" value={String(stats.totalBookings || 24)} change="15%" positive icon={CalendarDays} color="text-purple-600" bgColor="bg-purple-50" />
        <KPICard label="Upcoming Events" value="5" change="2" positive icon={Clock} color="text-amber-600" bgColor="bg-amber-50" />
        <KPICard label="Average Rating" value={stats.avgRating || '4.8'} change="0.2" positive icon={Star} color="text-yellow-600" bgColor="bg-yellow-50" />
        <KPICard label="Pending Requests" value="3" change="1" positive={false} icon={Users} color="text-rose-600" bgColor="bg-rose-50" />
        <KPICard label="Repeat Customers" value="18" change="6%" positive icon={Repeat} color="text-teal-600" bgColor="bg-teal-50" />
        <KPICard label="Profile Views" value="1,240" change="22%" positive icon={Eye} color="text-indigo-600" bgColor="bg-indigo-50" />
      </div>

      {/* ── ROW 2: Analytics Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenue Chart */}
        <div className="bg-white rounded-2xl border border-border/60 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-foreground">Revenue Trend</h3>
            <span className="text-[11px] font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">This Week</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B1538" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#8B1538" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#999" />
              <YAxis tick={{ fontSize: 11 }} stroke="#999" />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #eee', fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue" stroke="#8B1538" fill="url(#revGrad)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Bookings Chart */}
        <div className="bg-white rounded-2xl border border-border/60 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-foreground">Bookings Overview</h3>
            <span className="text-[11px] font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">6 Months</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={bookingsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#999" />
              <YAxis tick={{ fontSize: 11 }} stroke="#999" />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #eee', fontSize: 12 }} />
              <Bar dataKey="bookings" fill="#D4AF37" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── ROW 3: Profile + Quick Actions + Calendar ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <ProfileCompletion percent={72} />

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-border/60 p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="grid grid-cols-3 gap-3">
            <QuickAction icon={Image} label="Add Portfolio" onClick={() => navigate('/vendor/portfolio')} />
            <QuickAction icon={Package} label="Add Package" onClick={() => navigate('/vendor/packages')} />
            <QuickAction icon={CalendarDays} label="Set Availability" onClick={() => navigate('/vendor/availability')} />
            <QuickAction icon={Zap} label="Create Offer" onClick={() => navigate('/vendor/marketing')} />
            <QuickAction icon={Share2} label="Share Profile" onClick={() => {}} />
            <QuickAction icon={Sparkles} label="AI Caption" onClick={() => navigate('/vendor/ai-assistant')} />
          </div>
        </div>

        <MiniCalendar />
      </div>

      {/* ── ROW 4: AI Insights ── */}
      <div className="bg-gradient-to-r from-[#8B1538]/5 to-[#D4AF37]/5 rounded-2xl border border-[#8B1538]/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B1538] to-[#D4AF37] flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI Business Insights</h3>
            <p className="text-[11px] text-muted-foreground">Personalized recommendations for you</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            'Upload 10 more portfolio images to increase bookings by 18%.',
            'Enable weekend availability — 70% of inquiries are for Sat/Sun.',
            'Your Premium package has the highest conversion. Promote it.',
            'Respond faster — avg 4h response time loses 30% of leads.',
            'Customers prefer evening slots. Add more 5-9 PM availability.',
            'Your pricing is 15% below market average. Consider increasing.',
          ].map((tip, i) => (
            <div key={i} className="bg-white/80 backdrop-blur-sm rounded-xl p-3.5 border border-border/40 text-xs text-foreground leading-relaxed">
              {tip}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
