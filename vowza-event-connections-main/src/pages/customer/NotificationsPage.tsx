// NotificationsPage — real notifications from the notifications table
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationService } from '@/services/notificationService';
import { Button } from '@/components/ui/button';
import {
  Bell, BellRing, CheckCheck, CalendarCheck, CreditCard, BadgeCheck,
  MessageSquare, Info, Trash2,
} from 'lucide-react';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

const iconFor = (type: string) => {
  if (type.startsWith('booking')) return CalendarCheck;
  if (type.includes('payment')) return CreditCard;
  if (type.includes('artist')) return BadgeCheck;
  if (type.includes('review')) return MessageSquare;
  return Info;
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }
    setIsLoading(true);
    const data = await NotificationService.getNotifications(user.id, 50);
    setNotifications(data as Notification[]);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    if (!user) return;
    await NotificationService.markAllAsRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleMarkRead = async (id: string) => {
    await NotificationService.markAsRead(id);
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const handleDelete = async (id: string) => {
    await NotificationService.deleteNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="w-4 h-4 mr-1.5" /> Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {notifications.map((n, i) => {
              const Icon = iconFor(n.type);
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ delay: i * 0.03, duration: 0.3 }}
                  onClick={() => !n.is_read && handleMarkRead(n.id)}
                  className={`group rounded-2xl border p-4 flex items-start gap-3 transition-colors duration-200 cursor-pointer ${
                    n.is_read ? 'bg-white border-border' : 'bg-[#8B1538]/[0.04] border-[#8B1538]/20'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    n.is_read ? 'bg-muted text-muted-foreground' : 'bg-gradient-to-br from-[#8B1538] to-[#A31E42] text-white'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-semibold text-sm ${n.is_read ? 'text-foreground' : 'text-[#8B1538]'}`}>{n.title}</p>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-[#D4AF37] shrink-0" />}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1.5">
                      {new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                    className="min-w-10 min-h-10 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-red-600 transition-opacity shrink-0"
                    aria-label="Delete notification"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="rounded-3xl border border-dashed border-border bg-white/60 py-16 flex flex-col items-center text-center px-6"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8B1538]/10 to-[#D4AF37]/10 flex items-center justify-center mb-4">
        <BellRing className="w-8 h-8 text-[#8B1538]" />
      </div>
      <h3 className="font-display font-semibold text-lg text-foreground mb-1">No notifications yet</h3>
      <p className="text-muted-foreground text-sm max-w-sm">
        We'll let you know here about booking updates, payments, and important account activity.
      </p>
    </motion.div>
  );
}
