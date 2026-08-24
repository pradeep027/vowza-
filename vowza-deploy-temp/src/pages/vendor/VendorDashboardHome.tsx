// VendorDashboardHome — 100% data-driven. Every value comes from Supabase.
// Zero hardcoded, mock, sample or placeholder data.
import { useState } from 'react';
import VowzaIcon from '@/components/VowzaIcon';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  IndianRupee, TrendingUp, CalendarDays, Star, Eye, Users,
  Clock, Repeat, Image as ImageIcon, Package, Zap, Share2, Plus, ChevronLeft, ChevronRight, Inbox, AlertCircle,
  Landmark, BadgeCheck, Building2
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';
import {
  useVendorId, useVendorRealtime, useVendorKPIs, useVendorAnalytics,
  useVendorRevenueChart, useVendorBookingsChart, useVendorPortfolio,
  useVendorPackages, useVendorAvailability, useVendorInsights,
  useVendorProfileCompletion, useVendorBankDetails
} from '@/hooks/useVendorData';
import type { Period, BankDetails } from '@/hooks/useVendorData';

const inr = (n: number) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(1)}Cr`
  : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L`
  : n >= 1000   ? `₹${(n / 1000).toFixed(1)}K`
  : `₹${n}`;

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ label, value, change, icon: Icon, color, bgColor, loading }: {
  label: string; value: string; change?: number | null;
  icon: React.ElementType; color: string; bgColor: string; loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border/60 p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', bgColor)}>
          <Icon className={cn('w-5 h-5', color)} />
        </div>
        {change !== null && change !== undefined && change !== 0 && !loading && (
          <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full',
            change > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
            {change > 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
      {loading
        ? <div className="h-8 w-24 bg-muted rounded animate-pulse mb-1" />
        : <p className="text-2xl font-bold text-foreground mb-1">{value}</p>}
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Quick Action ──────────────────────────────────────────────────────────────
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

// ── Profile Completion (real data) ────────────────────────────────────────────
function ProfileCompletion({ percent, checklist, onComplete }: {
  percent: number; checklist: { label: string; done: boolean }[]; onComplete: () => void;
}) {
  const r = 45, c = 2 * Math.PI * r, offset = c - (percent / 100) * c;
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
        <div className="space-y-1.5 flex-1 max-h-[140px] overflow-y-auto">
          {checklist.map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={cn('w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                item.done ? 'bg-emerald-500 border-emerald-500' : 'border-border')}>
                {item.done && (
                  <svg className="w-2 h-2" viewBox="0 0 12 12">
                    <path d="M10 3L4.5 8.5 2 6" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <span className={cn('text-xs', item.done ? 'text-foreground' : 'text-muted-foreground')}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      {percent < 100 && (
        <button onClick={onComplete} className="w-full mt-5 py-2.5 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors">
          Complete Profile
        </button>
      )}
    </div>
  );
}

// ── Calendar (real availability data) ─────────────────────────────────────────
function AvailabilityCalendar({ booked, tentative, blocked }: {
  booked: string[]; tentative: string[]; blocked: string[];
}) {
  const [month, setMonth] = useState(new Date());
  const today = new Date();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();

  const iso = (day: number) =>
    `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return (
    <div className="bg-white rounded-2xl border border-border/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex gap-1">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1))} className="p-1 rounded-lg hover:bg-secondary"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1))} className="p-1 rounded-lg hover:bg-secondary"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-3">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1, date = iso(day);
          const isToday = day === today.getDate() && month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear();
          const isBooked = booked.includes(date);
          const isTentative = tentative.includes(date);
          const isBlocked = blocked.includes(date);
          return (
            <div key={day} className={cn(
              'relative w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors',
              isToday ? 'bg-[#8B1538] text-white font-bold' : 'hover:bg-secondary text-foreground'
            )}>
              {day}
              {(isBooked || isTentative || isBlocked) && !isToday && (
                <span className={cn('absolute bottom-0.5 w-1.5 h-1.5 rounded-full',
                  isBooked ? 'bg-red-500' : isTentative ? 'bg-amber-500' : 'bg-gray-400')} />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 pt-3 border-t border-border/40 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Available</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Tentative</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Booked</span>
      </div>
    </div>
  );
}

// ── Bank Details card (real data from provider_profiles) ──────────────────────
function BankDetailsCard({ bank, loading, onManage }: {
  bank?: BankDetails; loading: boolean; onManage: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border/60 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Bank Details</h3>
        {!loading && bank?.hasBank && (
          <span className={cn('flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border',
            bank.isVerified
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200')}>
            {bank.isVerified
              ? <><BadgeCheck className="w-3 h-3" /> Verified</>
              : <><Clock className="w-3 h-3" /> Pending</>}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-4 bg-muted rounded" style={{ width: `${55 + i * 8}%` }} />)}
        </div>
      ) : !bank?.hasBank ? (
        <div className="py-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Landmark className="w-6 h-6 text-amber-600" />
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            Add your bank details to receive payouts.
          </p>
          <button onClick={onManage}
            className="w-full py-2.5 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors">
            Add Bank Details
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border/40">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{bank.bankName || 'Bank'}</p>
              <p className="text-xs text-muted-foreground font-mono">{bank.maskedAccount}</p>
            </div>
          </div>

          <dl className="space-y-2.5">
            {[
              { label: 'Account Holder', value: bank.accountHolder },
              { label: 'IFSC Code',      value: bank.ifsc },
              { label: 'Branch',         value: bank.branchName },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <dt className="text-[11px] text-muted-foreground flex-shrink-0">{row.label}</dt>
                <dd className="text-xs font-medium text-foreground truncate text-right">{row.value || '—'}</dd>
              </div>
            ))}
          </dl>

          <button onClick={onManage}
            className="w-full mt-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-secondary transition-colors">
            Update Bank Details
          </button>
        </>
      )}
    </div>
  );
}

const PERIODS: { key: Period; label: string }[] = [
  { key: '7d', label: '7 Days' }, { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' }, { key: '1y', label: '1 Year' },
];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function VendorDashboardHome() {
  const navigate = useNavigate();
  const [revPeriod, setRevPeriod] = useState<Period>('7d');
  const [bookPeriod, setBookPeriod] = useState<Period>('30d');

  const { data: provider, isLoading: providerLoading } = useVendorId();
  const vendorId = provider?.id ?? null;

  useVendorRealtime(vendorId);

  const { data: kpis, isLoading: kpisLoading }   = useVendorKPIs(vendorId);
  const { data: analytics }                      = useVendorAnalytics(vendorId);
  const { data: revenueData = [] }               = useVendorRevenueChart(vendorId, revPeriod);
  const { data: bookingsData = [] }              = useVendorBookingsChart(vendorId, bookPeriod);
  const { data: portfolio }                      = useVendorPortfolio(vendorId);
  const { data: packagesData }                   = useVendorPackages(vendorId);
  const { data: availability }                   = useVendorAvailability(vendorId);
  const { data: bank, isLoading: bankLoading }   = useVendorBankDetails(vendorId);

  const insights = useVendorInsights(vendorId, provider, kpis, analytics, packagesData?.packages);
  const completion = useVendorProfileCompletion(
    provider, portfolio?.items.length ?? 0, packagesData?.packages.length ?? 0
  );

  // ── No provider profile yet ────────────────────────────────────────────────
  if (!providerLoading && !provider) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white rounded-2xl border border-border/60 p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-5">
          <AlertCircle className="w-7 h-7 text-amber-500" />
        </div>
        <h2 className="text-base font-semibold text-foreground mb-2">No Artist Profile Found</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Complete your artist registration to access the dashboard.
        </p>
        <button onClick={() => navigate('/provider/register')}
          className="px-6 py-2.5 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors">
          Complete Registration
        </button>
      </div>
    );
  }

  const hasRevenue  = revenueData.some(d => d.value > 0);
  const hasBookings = bookingsData.some(d => d.completed + d.pending + d.cancelled + d.confirmed > 0);

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Verification banner */}
      {provider && provider.verification_status !== 'approved' && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            Your profile is <strong>{provider.verification_status}</strong>. You will start receiving bookings once an admin approves it.
          </p>
        </div>
      )}

      {/* ── ROW 1: KPI Cards (all real) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Earnings"   value={inr(kpis?.totalEarnings ?? 0)}  change={analytics?.revenueGrowth} icon={IndianRupee} color="text-emerald-600" bgColor="bg-emerald-50" loading={kpisLoading} />
        <KPICard label="Monthly Revenue"  value={inr(kpis?.monthlyRevenue ?? 0)} change={analytics?.revenueGrowth} icon={TrendingUp}  color="text-blue-600"    bgColor="bg-blue-50"    loading={kpisLoading} />
        <KPICard label="Total Bookings"   value={String(kpis?.totalBookings ?? 0)} change={analytics?.bookingGrowth} icon={CalendarDays} color="text-purple-600" bgColor="bg-purple-50" loading={kpisLoading} />
        <KPICard label="Upcoming Events"  value={String(kpis?.upcomingEvents ?? 0)} icon={Clock}   color="text-amber-600"  bgColor="bg-amber-50"  loading={kpisLoading} />
        <KPICard label="Average Rating"   value={kpis?.totalReviews ? String(kpis.averageRating) : '—'} icon={Star} color="text-yellow-600" bgColor="bg-yellow-50" loading={kpisLoading} />
        <KPICard label="Pending Requests" value={String(kpis?.pendingRequests ?? 0)} icon={Inbox}  color="text-rose-600"   bgColor="bg-rose-50"   loading={kpisLoading} />
        <KPICard label="Repeat Customers" value={String(kpis?.repeatCustomers ?? 0)} icon={Repeat} color="text-teal-600"   bgColor="bg-teal-50"   loading={kpisLoading} />
        <KPICard label="Profile Views"    value={String(kpis?.profileViews ?? 0)}    icon={Eye}    color="text-indigo-600" bgColor="bg-indigo-50" loading={kpisLoading} />
      </div>

      {/* ── ROW 2: Charts (real data) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenue */}
        <div className="bg-white rounded-2xl border border-border/60 p-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-foreground">Revenue Trend</h3>
            <div className="flex gap-0.5 p-0.5 bg-secondary rounded-lg">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setRevPeriod(p.key)}
                  className={cn('px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all',
                    revPeriod === p.key ? 'bg-white shadow-xs text-foreground' : 'text-muted-foreground')}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {hasRevenue ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B1538" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#8B1538" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#999" />
                <YAxis tick={{ fontSize: 10 }} stroke="#999" tickFormatter={(v) => inr(Number(v))} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #eee', fontSize: 12 }}
                  formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
                <Area type="monotone" dataKey="value" stroke="#8B1538" fill="url(#revGrad)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center text-center">
              <IndianRupee className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm font-medium text-foreground">No revenue yet</p>
              <p className="text-xs text-muted-foreground mt-1">Revenue will appear here after your first completed booking.</p>
            </div>
          )}
        </div>

        {/* Bookings */}
        <div className="bg-white rounded-2xl border border-border/60 p-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-foreground">Bookings Overview</h3>
            <div className="flex gap-0.5 p-0.5 bg-secondary rounded-lg">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setBookPeriod(p.key)}
                  className={cn('px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all',
                    bookPeriod === p.key ? 'bg-white shadow-xs text-foreground' : 'text-muted-foreground')}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {hasBookings ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={bookingsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#999" />
                <YAxis tick={{ fontSize: 10 }} stroke="#999" allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #eee', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="completed" name="Completed" stackId="a" fill="#10b981" radius={[0,0,0,0]} />
                <Bar dataKey="confirmed" name="Confirmed" stackId="a" fill="#3b82f6" />
                <Bar dataKey="pending"   name="Pending"   stackId="a" fill="#D4AF37" />
                <Bar dataKey="cancelled" name="Cancelled" stackId="a" fill="#ef4444" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center text-center">
              <CalendarDays className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm font-medium text-foreground">No bookings yet</p>
              <p className="text-xs text-muted-foreground mt-1">Your booking activity will be charted here.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 3: Analytics metrics (real) ── */}
      {analytics && (kpis?.totalBookings ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border border-border/60 p-6">
          <h3 className="text-sm font-semibold text-foreground mb-5">Business Analytics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[
              { label: 'Acceptance Rate',   value: `${analytics.acceptanceRate}%` },
              { label: 'Completion Rate',   value: `${analytics.completionRate}%` },
              { label: 'Cancellation Rate', value: `${analytics.cancellationRate}%` },
              { label: 'Repeat Customers',  value: `${analytics.repeatCustomerRate}%` },
              { label: 'Conversion Rate',   value: analytics.conversionRate > 0 ? `${analytics.conversionRate}%` : '—' },
              { label: 'Avg Booking Value', value: analytics.avgBookingValue > 0 ? inr(analytics.avgBookingValue) : '—' },
              { label: 'Customer LTV',      value: analytics.customerLifetimeValue > 0 ? inr(analytics.customerLifetimeValue) : '—' },
              { label: 'Response Rate',     value: `${analytics.responseRate}%` },
              { label: 'Revenue Growth',    value: `${analytics.revenueGrowth > 0 ? '+' : ''}${analytics.revenueGrowth}%` },
              { label: 'Booking Growth',    value: `${analytics.bookingGrowth > 0 ? '+' : ''}${analytics.bookingGrowth}%` },
            ].map(m => (
              <div key={m.label} className="p-3 rounded-xl bg-[#FAFAFA] border border-border/40">
                <p className="text-lg font-bold text-foreground">{m.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ROW 4: Profile + Quick Actions + Calendar ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <ProfileCompletion
          percent={completion.percent}
          checklist={completion.checklist}
          onComplete={() => navigate('/vendor/settings')}
        />

        <div className="bg-white rounded-2xl border border-border/60 p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="grid grid-cols-3 gap-3">
            <QuickAction icon={ImageIcon}    label="Add Portfolio"    onClick={() => navigate('/vendor/portfolio')} />
            <QuickAction icon={Package}      label="Add Package"      onClick={() => navigate('/vendor/packages')} />
            <QuickAction icon={CalendarDays} label="Set Availability" onClick={() => navigate('/vendor/availability')} />
            <QuickAction icon={Zap}          label="Create Offer"     onClick={() => navigate('/vendor/marketing')} />
            <QuickAction icon={Share2}       label="Share Profile"    onClick={() => {
              if (provider?.id) {
                navigator.clipboard.writeText(`${window.location.origin}/artist/${provider.id}`);
              }
            }} />
            <QuickAction icon={VowzaIcon}     label="AI Assistant"     onClick={() => navigate('/vendor/ai-assistant')} />
          </div>
        </div>

        <AvailabilityCalendar
          booked={availability?.booked ?? []}
          tentative={availability?.tentative ?? []}
          blocked={availability?.blocked ?? []}
        />
      </div>

      {/* ── ROW 5: Bank Details ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <BankDetailsCard
          bank={bank}
          loading={bankLoading}
          onManage={() => navigate('/vendor/wallet')}
        />
      </div>

      {/* ── ROW 5: AI Insights (generated from real data only) ── */}
      <div className="bg-gradient-to-r from-[#8B1538]/5 to-[#D4AF37]/5 rounded-2xl border border-[#8B1538]/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B1538] to-[#D4AF37] flex items-center justify-center">
            <VowzaIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI Business Insights</h3>
            <p className="text-[11px] text-muted-foreground">Generated from your actual activity</p>
          </div>
        </div>
        {insights.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.map((tip, i) => (
              <div key={i} className="bg-white/80 backdrop-blur-sm rounded-xl p-3.5 border border-border/40 text-xs text-foreground leading-relaxed">
                {tip}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white/60 rounded-xl p-5 text-center">
            <p className="text-sm text-muted-foreground">
              Insights will appear here as you receive bookings, reviews and profile views.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
