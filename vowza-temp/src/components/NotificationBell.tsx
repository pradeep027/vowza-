// ─── NotificationBell — Real-time notification center ────────────────────────
// Features: unread badge, mark as read, delete, preferences, realtime updates.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { NotificationService } from '@/services/notificationService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Bell, Check, CheckCheck, Trash2, Settings,
  Calendar, Star, UserCheck, UserX, XCircle,
  MessageSquare, User, Megaphone, Info,
} from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  reference_id: string | null;
}

// ─── Icon + colour per notification type ─────────────────────────────────────
const TYPE_META: Record<string, { icon: React.ReactNode; colour: string }> = {
  booking_received:  { icon: <Calendar className="w-4 h-4" />,    colour: 'text-blue-500'   },
  booking_accepted:  { icon: <UserCheck className="w-4 h-4" />,   colour: 'text-emerald-500' },
  booking_rejected:  { icon: <UserX className="w-4 h-4" />,       colour: 'text-red-500'    },
  booking_cancelled: { icon: <XCircle className="w-4 h-4" />,     colour: 'text-orange-500' },
  booking_completed: { icon: <CheckCheck className="w-4 h-4" />,  colour: 'text-emerald-600' },
  artist_approved:   { icon: <UserCheck className="w-4 h-4" />,   colour: 'text-emerald-500' },
  artist_rejected:   { icon: <UserX className="w-4 h-4" />,       colour: 'text-red-500'    },
  new_review:        { icon: <Star className="w-4 h-4" />,        colour: 'text-gold'       },
  profile_updated:   { icon: <User className="w-4 h-4" />,        colour: 'text-blue-400'   },
  admin_announcement:{ icon: <Megaphone className="w-4 h-4" />,   colour: 'text-violet-500' },
  email_verification:{ icon: <MessageSquare className="w-4 h-4" />,colour: 'text-blue-500' },
  password_reset:    { icon: <Info className="w-4 h-4" />,        colour: 'text-slate-500'  },
};

const getMeta = (type: string) => TYPE_META[type] ?? { icon: <Bell className="w-4 h-4" />, colour: 'text-muted-foreground' };

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [open,            setOpen]          = useState(false);
  const [notifications,   setNotifications] = useState<Notification[]>([]);
  const [unreadCount,     setUnreadCount]   = useState(0);
  const [loadingPrefs,    setLoadingPrefs]  = useState(false);
  const [prefs, setPrefs] = useState({
    sms_enabled:             true,
    email_enabled:           true,
    push_enabled:            true,
    booking_notifications:   true,
    payment_notifications:   true,
    marketing_notifications: false,
  });

  // ── Fetch helpers ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!user) return;
    const data = await NotificationService.getNotifications(user.id, 40);
    setNotifications(data as Notification[]);
    setUnreadCount(data.filter((n: any) => !n.is_read).length);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPrefs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) setPrefs(data as any);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetchAll();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const n = payload.new as Notification;
        setNotifications(prev => [n, ...prev]);
        setUnreadCount(c => c + 1);
        // Toast for new notification
        toast(n.title, {
          description: n.message,
          duration: 5000,
          icon: getMeta(n.type).icon,
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const updated = payload.new as Notification;
        setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
        setUnreadCount(prev => Math.max(0, prev - (updated.is_read ? 1 : 0)));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const deleted = payload.old as { id: string; is_read: boolean };
        setNotifications(prev => prev.filter(n => n.id !== deleted.id));
        if (!deleted.is_read) setUnreadCount(c => Math.max(0, c - 1));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchAll]);

  // Load preferences when settings tab is shown
  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) fetchPrefs();
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const markRead = async (id: string) => {
    await NotificationService.markAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    if (!user) return;
    await NotificationService.markAllAsRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const deleteNotif = async (id: string, wasUnread: boolean) => {
    await NotificationService.deleteNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (wasUnread) setUnreadCount(c => Math.max(0, c - 1));
  };

  const handleNotifClick = (notif: Notification) => {
    if (!notif.is_read) markRead(notif.id);
    if (notif.reference_id) {
      if (notif.type.startsWith('booking')) navigate(`/my-bookings`);
      else if (notif.type === 'new_review') navigate(`/provider/dashboard`);
    }
  };

  const savePrefs = async () => {
    if (!user) return;
    setLoadingPrefs(true);
    await supabase
      .from('notification_settings')
      .upsert({ user_id: user.id, ...prefs, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    setLoadingPrefs(false);
    toast.success('Notification preferences saved');
  };

  if (!user) return null;

  const unread = notifications.filter(n => !n.is_read);
  const read   = notifications.filter(n =>  n.is_read);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 bg-red-500 text-white text-[10px] border-0">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[380px] p-0 shadow-elevated"
        align="end"
        sideOffset={8}
      >
        <Tabs defaultValue="notifications">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <TabsList className="h-8 p-0.5">
              <TabsTrigger value="notifications" className="h-7 text-xs px-3">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="settings" className="h-7 text-xs px-3">
                <Settings className="w-3.5 h-3.5 mr-1" />
                Prefs
              </TabsTrigger>
            </TabsList>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead}
                className="h-7 text-xs text-muted-foreground hover:text-foreground">
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                All read
              </Button>
            )}
          </div>

          {/* Notifications tab */}
          <TabsContent value="notifications" className="mt-0 focus-visible:outline-none">
            <ScrollArea className="h-[420px]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px] gap-3 text-center px-6">
                  <Bell className="w-10 h-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                  <p className="text-xs text-muted-foreground/60">
                    You'll see booking updates, reviews, and announcements here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {/* Unread section */}
                  {unread.length > 0 && (
                    <>
                      <p className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wide bg-muted/20">
                        New
                      </p>
                      {unread.map(n => <NotifRow key={n.id} n={n} onRead={markRead} onDelete={deleteNotif} onClick={handleNotifClick} />)}
                    </>
                  )}
                  {/* Read section */}
                  {read.length > 0 && (
                    <>
                      <p className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wide bg-muted/20">
                        Earlier
                      </p>
                      {read.map(n => <NotifRow key={n.id} n={n} onRead={markRead} onDelete={deleteNotif} onClick={handleNotifClick} />)}
                    </>
                  )}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Preferences tab */}
          <TabsContent value="settings" className="mt-0 focus-visible:outline-none">
            <div className="px-4 py-3 space-y-4">
              <p className="text-xs text-muted-foreground">
                Choose which notifications you want to receive.
              </p>
              {[
                { key: 'booking_notifications',   label: 'Booking updates',        desc: 'Requests, accepts, rejections' },
                { key: 'payment_notifications',   label: 'Payment updates',        desc: 'Receipts and payouts' },
                { key: 'email_enabled',            label: 'Email notifications',    desc: 'Send alerts to your email' },
                { key: 'sms_enabled',              label: 'SMS notifications',      desc: 'Send alerts to your phone' },
                { key: 'push_enabled',             label: 'Push notifications',     desc: 'Browser push alerts' },
                { key: 'marketing_notifications',  label: 'Promotions & updates',   desc: 'News and offers from Vowza' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <Label className="text-sm font-medium">{label}</Label>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={prefs[key as keyof typeof prefs] as boolean}
                    onCheckedChange={v => setPrefs(p => ({ ...p, [key]: v }))}
                  />
                </div>
              ))}
              <Button onClick={savePrefs} disabled={loadingPrefs}
                className="w-full bg-gradient-gold text-foreground hover:opacity-90 mt-2 h-9 text-sm">
                {loadingPrefs ? 'Saving…' : 'Save Preferences'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};

// ─── Single notification row ───────────────────────────────────────────────────
const NotifRow = ({
  n, onRead, onDelete, onClick,
}: {
  n: Notification;
  onRead:   (id: string) => void;
  onDelete: (id: string, unread: boolean) => void;
  onClick:  (n: Notification) => void;
}) => {
  const { icon, colour } = getMeta(n.type);
  return (
    <div
      className={`group flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors ${
        !n.is_read ? 'bg-gold/5' : ''
      }`}
      onClick={() => onClick(n)}
    >
      {/* Icon */}
      <div className={`mt-0.5 flex-shrink-0 ${colour}`}>{icon}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <p className={`text-sm leading-tight ${!n.is_read ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
            {n.title}
          </p>
          {!n.is_read && (
            <span className="w-2 h-2 rounded-full bg-gold flex-shrink-0 mt-1" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
          {n.message}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">{relativeTime(n.created_at)}</p>
      </div>

      {/* Actions — show on hover */}
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {!n.is_read && (
          <button
            onClick={e => { e.stopPropagation(); onRead(n.id); }}
            className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-emerald-600"
            title="Mark as read"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); onDelete(n.id, !n.is_read); }}
          className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
