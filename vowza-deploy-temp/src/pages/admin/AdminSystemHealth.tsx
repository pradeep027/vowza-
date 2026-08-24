// ─── Admin System Health — Production Diagnostics ─────────────────────────────
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity, Database, Wifi, Server, Cloud, CheckCircle, AlertCircle,
  RefreshCw, Clock, Shield, Users, BookOpen, Bell, MessageSquare,
  CalendarDays, CreditCard, MapPin, Package, XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Status = 'ok' | 'degraded' | 'error' | 'checking' | 'unknown';
interface HealthCheck {
  id: string;
  label: string;
  category: string;
  status: Status;
  latency?: number;
  detail?: string;
  error?: string;
  checkedAt?: string;
}

const CRITICAL_TABLES = [
  'profiles', 'provider_profiles', 'user_roles', 'bookings',
  'notifications', 'portfolio_items', 'reviews', 'payments',
  'provider_availability', 'booking_locations',
  'photography_packages', 'videography_packages', 'singer_packages',
  'dancer_packages', 'decorator_packages', 'makeup_packages',
  'mehendi_packages', 'anchor_packages', 'dj_packages', 'band_packages',
  'priest_packages', 'water_packages', 'rental_packages', 'banquet_halls',
];

const ENV_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_PROJECT_ID',
];

export default function AdminSystemHealth() {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<string>('');
  const [tableResults, setTableResults] = useState<{ name: string; ok: boolean; error?: string }[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const now = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const updateCheck = useCallback((id: string, patch: Partial<HealthCheck>) => {
    setChecks(prev => prev.map(c => c.id === id ? { ...c, ...patch, checkedAt: now() } : c));
  }, []);

  const runChecks = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);

    const initial: HealthCheck[] = [
      { id: 'db', label: 'Supabase Database', category: 'Infrastructure', status: 'checking' },
      { id: 'auth', label: 'Authentication', category: 'Infrastructure', status: 'checking' },
      { id: 'storage', label: 'Storage', category: 'Infrastructure', status: 'checking' },
      { id: 'realtime', label: 'Realtime', category: 'Infrastructure', status: 'checking' },
      { id: 'env', label: 'Environment Config', category: 'Configuration', status: 'checking' },
      { id: 'tables', label: 'Database Schema', category: 'Database', status: 'checking' },
      { id: 'artists', label: 'Artist Profiles', category: 'Business', status: 'checking' },
      { id: 'bookings', label: 'Booking System', category: 'Business', status: 'checking' },
      { id: 'notifications', label: 'Notifications', category: 'Business', status: 'checking' },
      { id: 'availability', label: 'Calendar/Availability', category: 'Business', status: 'checking' },
      { id: 'payments', label: 'Payment Records', category: 'Business', status: 'checking' },
      { id: 'location', label: 'Location Data', category: 'Business', status: 'checking' },
    ];
    setChecks(initial);

    // 1. Database connectivity
    const t0 = Date.now();
    try {
      const { count, error } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
      if (error) throw error;
      updateCheck('db', { status: 'ok', latency: Date.now() - t0, detail: `Connected · ${count ?? 0} profiles` });
    } catch (e: any) {
      updateCheck('db', { status: 'error', latency: Date.now() - t0, error: e.message, detail: 'Connection failed' });
    }

    // 2. Auth
    const t1 = Date.now();
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      updateCheck('auth', { status: 'ok', latency: Date.now() - t1, detail: data.session ? 'Session active' : 'Service reachable' });
    } catch (e: any) {
      updateCheck('auth', { status: 'error', latency: Date.now() - t1, error: e.message, detail: 'Auth service unreachable' });
    }

    // 3. Storage
    const t2 = Date.now();
    try {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw error;
      updateCheck('storage', { status: 'ok', latency: Date.now() - t2, detail: `${data?.length ?? 0} buckets available` });
    } catch (e: any) {
      updateCheck('storage', { status: 'error', latency: Date.now() - t2, error: e.message, detail: 'Storage unreachable' });
    }

    // 4. Realtime — test using same pattern as actual Vowza subscriptions
    const t3 = Date.now();
    try {
      const channelName = 'health-' + Date.now();
      const ch = supabase.channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {});
      const subResult = await new Promise<string>((resolve) => {
        const timeout = setTimeout(() => { resolve('TIMEOUT'); }, 8000);
        ch.subscribe((status) => {
          if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            clearTimeout(timeout);
            resolve(status);
          }
        });
      });
      supabase.removeChannel(ch);
      if (subResult === 'SUBSCRIBED') {
        updateCheck('realtime', { status: 'ok', latency: Date.now() - t3, detail: 'Channel subscribed successfully' });
      } else if (subResult === 'TIMEOUT') {
        updateCheck('realtime', { status: 'degraded', latency: Date.now() - t3, detail: 'Subscription timeout (may still work)', error: 'Channel did not confirm within 8s — this is common in some network environments' });
      } else {
        updateCheck('realtime', { status: 'degraded', latency: Date.now() - t3, detail: `Status: ${subResult}`, error: 'Non-critical — Realtime may still function for active sessions' });
      }
    } catch (e: any) {
      updateCheck('realtime', { status: 'error', latency: Date.now() - t3, error: e.message, detail: 'Realtime connection failed' });
    }

    // 5. Environment
    const missing = ENV_KEYS.filter(k => !import.meta.env[k]);
    updateCheck('env', { status: missing.length ? 'error' : 'ok', detail: missing.length ? `Missing: ${missing.join(', ')}` : `${ENV_KEYS.length} keys configured` });

    // 6. Schema / Table checks
    const tResults: { name: string; ok: boolean; error?: string }[] = [];
    let tableOk = 0;
    for (const table of CRITICAL_TABLES) {
      try {
        const { error } = await supabase.from(table as any).select('id', { count: 'exact', head: true });
        if (error) { tResults.push({ name: table, ok: false, error: error.message }); }
        else { tResults.push({ name: table, ok: true }); tableOk++; }
      } catch (e: any) { tResults.push({ name: table, ok: false, error: e.message }); }
    }
    setTableResults(tResults);
    const tableFailed = tResults.filter(t => !t.ok);
    updateCheck('tables', {
      status: tableFailed.length === 0 ? 'ok' : tableFailed.length <= 3 ? 'degraded' : 'error',
      detail: `${tableOk}/${CRITICAL_TABLES.length} tables accessible${tableFailed.length ? ` · ${tableFailed.length} failed` : ''}`,
      error: tableFailed.length ? tableFailed.map(t => `${t.name}: ${t.error}`).slice(0, 3).join('; ') : undefined,
    });

    // 7. Artist profiles
    try {
      const { count, error } = await supabase.from('provider_profiles').select('id', { count: 'exact', head: true });
      if (error) throw error;
      updateCheck('artists', { status: 'ok', detail: `${count ?? 0} artist profiles` });
    } catch (e: any) { updateCheck('artists', { status: 'error', error: e.message, detail: 'Cannot read artist data' }); }

    // 8. Bookings
    try {
      const { count, error } = await supabase.from('bookings').select('id', { count: 'exact', head: true });
      if (error) throw error;
      updateCheck('bookings', { status: 'ok', detail: `${count ?? 0} bookings in system` });
    } catch (e: any) { updateCheck('bookings', { status: 'error', error: e.message, detail: 'Booking system unavailable' }); }

    // 9. Notifications
    try {
      const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true });
      if (error) throw error;
      updateCheck('notifications', { status: 'ok', detail: `${count ?? 0} notifications` });
    } catch (e: any) { updateCheck('notifications', { status: 'error', error: e.message }); }

    // 10. Availability
    try {
      const { count, error } = await supabase.from('provider_availability').select('id', { count: 'exact', head: true });
      if (error) throw error;
      updateCheck('availability', { status: 'ok', detail: `${count ?? 0} availability records` });
    } catch (e: any) { updateCheck('availability', { status: 'error', error: e.message }); }

    // 11. Payments
    try {
      const { count, error } = await supabase.from('payments' as any).select('id', { count: 'exact', head: true });
      if (error) throw error;
      updateCheck('payments', { status: 'ok', detail: `${count ?? 0} payment records` });
    } catch (e: any) { updateCheck('payments', { status: e.message?.includes('does not exist') ? 'unknown' : 'error', error: e.message, detail: e.message?.includes('does not exist') ? 'Table not found' : 'Payment system issue' }); }

    // 12. Location
    try {
      const { count, error } = await supabase.from('booking_locations' as any).select('id', { count: 'exact', head: true });
      if (error) throw error;
      updateCheck('location', { status: 'ok', detail: `${count ?? 0} location records` });
    } catch (e: any) { updateCheck('location', { status: 'error', error: e.message }); }

    setLastRun(now());
    setLoading(false);
  }, [updateCheck]);

  useEffect(() => { runChecks(); }, []);

  const overall: Status = checks.length === 0 ? 'checking' :
    checks.some(c => c.status === 'error') ? 'error' :
    checks.some(c => c.status === 'degraded' || c.status === 'checking') ? 'degraded' : 'ok';

  const statusColor = (s: Status) => ({ ok: 'text-emerald-600', degraded: 'text-amber-600', error: 'text-red-600', checking: 'text-blue-500', unknown: 'text-gray-400' }[s]);
  const statusBg = (s: Status) => ({ ok: 'bg-emerald-50 border-emerald-200', degraded: 'bg-amber-50 border-amber-200', error: 'bg-red-50 border-red-200', checking: 'bg-blue-50 border-blue-200', unknown: 'bg-gray-50 border-gray-200' }[s]);
  const StatusDot = ({ s }: { s: Status }) => <span className={cn('w-2.5 h-2.5 rounded-full', { 'bg-emerald-500': s === 'ok', 'bg-amber-400 animate-pulse': s === 'degraded', 'bg-red-500': s === 'error', 'bg-blue-400 animate-pulse': s === 'checking', 'bg-gray-300': s === 'unknown' })} />;

  const categories = ['Infrastructure', 'Configuration', 'Database', 'Business'];
  const iconMap: Record<string, any> = { db: Database, auth: Shield, storage: Cloud, realtime: Activity, env: Server, tables: Database, artists: Users, bookings: BookOpen, notifications: Bell, availability: CalendarDays, payments: CreditCard, location: MapPin };

  return (
    <div className="p-6 space-y-6 max-w-[1100px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">System Health</h1>
          <p className="text-sm text-muted-foreground">Real-time diagnostics for Vowza platform services</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRun && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{lastRun}</span>}
          <button onClick={runChecks} disabled={loading} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-secondary disabled:opacity-50">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /> Refresh
          </button>
        </div>
      </div>

      {/* Overall Banner */}
      <div className={cn('rounded-2xl border p-5 flex items-center gap-4', statusBg(overall))}>
        <StatusDot s={overall} />
        <div>
          <p className={cn('text-sm font-bold', statusColor(overall))}>
            {overall === 'ok' ? 'All Systems Operational' : overall === 'degraded' ? 'System Degraded' : overall === 'error' ? 'Critical Issues Detected' : 'Running Diagnostics...'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {checks.filter(c => c.status === 'ok').length}/{checks.length} checks passed
            {checks.filter(c => c.status === 'error').length > 0 && ` · ${checks.filter(c => c.status === 'error').length} failed`}
          </p>
        </div>
      </div>

      {/* Service Checks by Category */}
      {categories.map(cat => {
        const items = checks.filter(c => c.category === cat);
        if (!items.length) return null;
        return (
          <div key={cat}>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{cat}</h2>
            <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 divide-y divide-border/40">
              {items.map(c => {
                const Icon = iconMap[c.id] || Activity;
                return (
                  <div key={c.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-muted-foreground" /></div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{c.label}</p>
                        {c.detail && <p className="text-[10px] text-muted-foreground truncate max-w-[300px]">{c.detail}</p>}
                        {c.error && <p className="text-[10px] text-red-500 truncate max-w-[400px] mt-0.5">{c.error}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {c.latency !== undefined && <span className="text-xs text-muted-foreground">{c.latency}ms</span>}
                      {c.checkedAt && <span className="text-[9px] text-muted-foreground hidden md:block">{c.checkedAt}</span>}
                      <StatusDot s={c.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Schema Details */}
      {tableResults.length > 0 && (
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Database Tables ({tableResults.filter(t => t.ok).length}/{tableResults.length})</h2>
          <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {tableResults.map(t => (
                <div key={t.name} className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs', t.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
                  {t.ok ? <CheckCircle className="w-3 h-3 shrink-0" /> : <XCircle className="w-3 h-3 shrink-0" />}
                  <span className="truncate">{t.name}</span>
                </div>
              ))}
            </div>
            {tableResults.some(t => !t.ok) && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100">
                <p className="text-xs font-semibold text-red-700 mb-1">Failed Tables</p>
                {tableResults.filter(t => !t.ok).map(t => (
                  <p key={t.name} className="text-[10px] text-red-600">{t.name}: {t.error}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Environment */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Environment</h2>
        <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Mode', value: import.meta.env.MODE || 'production' },
              { label: 'Framework', value: 'React 18 + Vite 5' },
              { label: 'Database', value: 'Supabase PostgreSQL' },
              { label: 'Supabase Project', value: import.meta.env.VITE_SUPABASE_PROJECT_ID ? `${import.meta.env.VITE_SUPABASE_PROJECT_ID.slice(0, 8)}...` : 'Not set' },
            ].map(item => (
              <div key={item.label} className="p-3 rounded-xl bg-surface-2">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">{item.label}</p>
                <p className="text-sm font-semibold text-foreground mt-1">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {ENV_KEYS.map(k => (
              <div key={k} className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs', import.meta.env[k] ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
                {import.meta.env[k] ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                {k.replace('VITE_', '')}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Security Monitoring */}
      <SecurityMonitoringSection />
    </div>
  );
}


// ─── Security Monitoring Section ──────────────────────────────────────────────
function SecurityMonitoringSection() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from('security_events' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (filter !== 'all') q = q.eq('severity', filter);
      const { data } = await q;
      setEvents(data ?? []);
    } catch { setEvents([]); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription for live events
  useEffect(() => {
    const ch = supabase.channel('security-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'security_events' }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const criticalCount = events.filter(e => e.severity === 'critical').length;
  const highCount = events.filter(e => e.severity === 'high').length;
  const totalToday = events.filter(e => {
    const d = new Date(e.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  const overallSecurity = criticalCount > 0 ? 'critical' : highCount > 0 ? 'warning' : 'safe';

  const severityColor = (s: string) => ({
    critical: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-blue-100 text-blue-700 border-blue-200',
    info: 'bg-gray-100 text-gray-600 border-gray-200',
  }[s] || 'bg-gray-100 text-gray-600');

  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Security & Threat Monitoring</h2>

      {/* Security Status Banner */}
      <div className={cn('rounded-2xl border p-5 mb-4', overallSecurity === 'safe' ? 'bg-emerald-50 border-emerald-200' : overallSecurity === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className={cn('w-5 h-5', overallSecurity === 'safe' ? 'text-emerald-600' : overallSecurity === 'warning' ? 'text-amber-600' : 'text-red-600')} />
            <div>
              <p className={cn('text-sm font-bold', overallSecurity === 'safe' ? 'text-emerald-700' : overallSecurity === 'warning' ? 'text-amber-700' : 'text-red-700')}>
                {overallSecurity === 'safe' ? 'No Active Threats' : overallSecurity === 'warning' ? 'Suspicious Activity Detected' : 'Security Incidents Detected'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {events.length === 0 ? 'No security events recorded' : `${totalToday} events today · ${criticalCount} critical · ${highCount} high`}
              </p>
            </div>
          </div>
          <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-white/50 text-muted-foreground">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Stats */}
      {events.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total Events', value: events.length, color: 'text-foreground' },
            { label: 'Critical', value: criticalCount, color: 'text-red-600' },
            { label: 'High Risk', value: highCount, color: 'text-orange-600' },
            { label: 'Today', value: totalToday, color: 'text-blue-600' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-[#1a1a24] rounded-xl border border-border/60 p-3">
              <p className="text-[10px] text-muted-foreground font-bold uppercase">{s.label}</p>
              <p className={cn('text-xl font-bold mt-1', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {['all', 'critical', 'high', 'medium', 'low', 'info'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-colors', filter === f ? 'bg-[#8B1538] text-white border-[#8B1538]' : 'border-border text-muted-foreground hover:bg-secondary')}>
            {f}
          </button>
        ))}
      </div>

      {/* Event List */}
      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading security events...</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center">
            <Shield className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">No suspicious activity detected</p>
            <p className="text-xs text-muted-foreground mt-1">No recent unauthorized access attempts have been recorded.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40 max-h-[500px] overflow-y-auto">
            {events.map((ev: any) => (
              <div key={ev.id} className="px-5 py-4 hover:bg-surface-2 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border', severityColor(ev.severity))}>
                        {ev.severity}
                      </span>
                      <span className="text-xs font-semibold text-foreground">{ev.event_type?.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{ev.action || ev.reason || '—'}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                      <span>{ev.is_authenticated ? (ev.user_email || 'Authenticated User') : 'Anonymous / Unauthenticated'}</span>
                      {ev.endpoint && <span className="font-mono truncate max-w-[200px]">{ev.endpoint}</span>}
                      {ev.risk_score > 0 && <span className="font-semibold text-red-500">Risk: {ev.risk_score}/100</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground">{new Date(ev.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                    <p className="text-[9px] text-muted-foreground">{new Date(ev.created_at).toLocaleDateString('en-IN')}</p>
                    {ev.http_status && <span className={cn('text-[9px] font-bold', ev.http_status >= 400 ? 'text-red-500' : 'text-emerald-500')}>{ev.http_status}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
