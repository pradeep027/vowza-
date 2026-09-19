// VendorNotifications — real notification feed from Supabase with mark-as-read.
// Badge in sidebar/topbar decreases instantly when a notification is opened.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Bell, CalendarDays, IndianRupee, Users, Star, MessageSquare,
  XCircle, BadgeCheck, ArrowUpRight, CheckCheck, Loader2, Inbox,
} from 'lucide-react';
import {
  useVendorId, useVendorRealtime, useVendorNotifications,
  markNotificationRead, markAllNotificationsRead,
} from '@/hooks/useVendorData';

// ── Notification type → icon, colour, destination ─────────────────────────────
interface TypeMeta {
  icon: React.ElementType;
  color: string;
  bg: string;
  route?: string;
}

function metaFor(type?: string, title?: string): TypeMeta {
  const t = String(type ?? '').toLowerCase();
  const s = String(title ?? '').toLowerCase();

  // Booking cancelled — check before generic booking
  if (t.includes('cancel') || s.includes('cancel'))
    return { icon: XCircle,     color: 'text-red-600',     bg: 'bg-red-50',     route: '/vendor/bookings' };
  if (t.includes('booking') || s.includes('booking'))
    return { icon: CalendarDays, color: 'text-blue-600',    bg: 'bg-blue-50',    route: '/vendor/bookings' };
  if (t.includes('payout') || s.includes('payout'))
    return { icon: ArrowUpRight, color: 'text-indigo-600',  bg: 'bg-indigo-50',  route: '/vendor/wallet' };
  if (t.includes('payment') || s.includes('payment'))
    return { icon: IndianRupee,  color: 'text-emerald-600', bg: 'bg-emerald-50', route: '/vendor/wallet' };
  if (t.includes('inquir') || s.includes('inquir') || s.includes('enquir'))
    return { icon: Users,        color: 'text-amber-600',   bg: 'bg-amber-50',   route: '/vendor/inquiries' };
  if (t.includes('review') || s.includes('review'))
    return { icon: Star,         color: 'text-yellow-600',  bg: 'bg-yellow-50',  route: '/vendor/reviews' };
  if (t.includes('message') || s.includes('message'))
    return { icon: MessageSquare, color: 'text-purple-600', bg: 'bg-purple-50',  route: '/vendor/messages' };
  if (t.includes('approv') || s.includes('approv'))
    return { icon: BadgeCheck,   color: 'text-emerald-600', bg: 'bg-emerald-50', route: '/vendor/dashboard' };

  return { icon: Bell, color: 'text-muted-foreground', bg: 'bg-secondary' };
}

// ── Relative time ─────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)    return 'just now';
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

type Filter = 'all' | 'unread';

export default function VendorNotifications() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [markingAll, setMarkingAll] = useState(false);

  const { data: provider } = useVendorId();
  useVendorRealtime(provider?.id ?? null);

  const { data, isLoading } = useVendorNotifications(100);
  const notifications = data?.notifications ?? [];
  const unread = data?.unread ?? 0;

  const shown = filter === 'unread'
    ? notifications.filter((n: any) => !n.is_read)
    : notifications;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['vendor-notifications'] });
    qc.invalidateQueries({ queryKey: ['vendor-badges'] });
  };

  // Open one notification: mark read, then navigate if it maps to a page
  const open = async (n: any) => {
    if (!n.is_read) {
      const { error } = await markNotificationRead(n.id);
      if (error) { toast.error(error.message); return; }
      refresh();
    }
    const route = metaFor(n.type, n.title).route;
    if (route) navigate(route);
  };

  const markAll = async () => {
    if (!user || unread === 0) return;
    setMarkingAll(true);
    const { error } = await markAllNotificationsRead(user.id);
    if (error) toast.error(error.message);
    else { toast.success('All notifications marked as read'); refresh(); }
    setMarkingAll(false);
  };

  return (
    <div className="space-y-6 max-w-[900px]">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading…'
              : unread > 0 ? `${unread} unread notification${unread === 1 ? '' : 's'}`
              : 'You are all caught up'}
          </p>
        </div>
        {unread > 0 && (
          <button onClick={markAll} disabled={markingAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50">
            {markingAll
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Marking…</>
              : <><CheckCheck className="w-3.5 h-3.5" /> Mark all as read</>}
          </button>
        )}
      </div>

      {/* Filter */}
      {notifications.length > 0 && (
        <div className="flex gap-1 p-1 bg-secondary rounded-xl w-fit border border-border/50">
          {(['all', 'unread'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize',
                filter === f ? 'bg-white shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {f === 'all' ? 'All' : `Unread${unread > 0 ? ` (${unread})` : ''}`}
            </button>
          ))}
        </div>
      )}

      {/* Feed */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-border/60 divide-y divide-border/40">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 flex items-start gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-muted flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 bg-muted rounded" />
                <div className="h-3 w-3/4 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border/60 p-16 text-center">
          <Inbox className="w-14 h-14 text-muted-foreground/20 mx-auto mb-5" />
          <h3 className="text-base font-semibold text-foreground mb-2">
            {filter === 'unread' ? 'No Unread Notifications' : 'No Notifications Yet'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {filter === 'unread'
              ? 'You have read everything. Switch to All to review past notifications.'
              : 'Booking requests, payments, reviews and messages will appear here as they happen.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border/60 divide-y divide-border/40 overflow-hidden">
          {shown.map((n: any) => {
            const meta = metaFor(n.type, n.title);
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={cn(
                  'w-full text-left p-4 flex items-start gap-3 transition-colors',
                  n.is_read ? 'hover:bg-[#FAFAFA]' : 'bg-[#8B1538]/[0.03] hover:bg-[#8B1538]/[0.06]',
                )}
              >
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', meta.bg)}>
                  <meta.icon className={cn('w-5 h-5', meta.color)} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn('text-sm truncate',
                      n.is_read ? 'font-medium text-foreground' : 'font-bold text-foreground')}>
                      {n.title || 'Notification'}
                    </p>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-[#8B1538] flex-shrink-0" aria-label="Unread" />
                    )}
                  </div>
                  {n.message && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                      {n.message}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1.5">{timeAgo(n.created_at)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
