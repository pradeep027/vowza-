// DashboardHome — Welcome section + real-data summary cards
import { motion } from 'framer-motion';
import VowzaIcon from '@/components/VowzaIcon';
import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, CheckCircle2, Heart, Bell, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBookings } from '@/hooks/useBookings';
import { useFavorites } from '@/hooks/useArtists';
import { NotificationService } from '@/services/notificationService';
import { cn } from '@/lib/utils';

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: 'easeOut' },
  }),
};

export default function DashboardHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { bookings, isLoading: bookingsLoading } = useBookings();
  const { data: favoriteIds = [], isLoading: favLoading } = useFavorites();
  const [unreadCount, setUnreadCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    NotificationService.getUnreadCount(user.id).then(setUnreadCount);
  }, [user]);

  const upcomingCount = useMemo(
    () => bookings.filter(b => ['requested', 'accepted', 'in_progress'].includes(b.status)).length,
    [bookings]
  );
  const completedCount = useMemo(
    () => bookings.filter(b => b.status === 'completed').length,
    [bookings]
  );

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'there';

  const cards = [
    {
      label: 'Upcoming Bookings',
      value: bookingsLoading ? null : upcomingCount,
      icon: CalendarCheck,
      gradient: 'from-[#8B1538] to-[#A31E42]',
      onClick: () => navigate('/dashboard/bookings'),
    },
    {
      label: 'Completed Bookings',
      value: bookingsLoading ? null : completedCount,
      icon: CheckCircle2,
      gradient: 'from-[#0F766E] to-[#14B8A6]',
      onClick: () => navigate('/dashboard/bookings'),
    },
    {
      label: 'Saved Artists',
      value: favLoading ? null : favoriteIds.length,
      icon: Heart,
      gradient: 'from-[#D4AF37] to-[#F0C94A]',
      onClick: () => navigate('/dashboard/wishlist'),
    },
    {
      label: 'Notifications',
      value: unreadCount,
      icon: Bell,
      gradient: 'from-[#4338CA] to-[#6366F1]',
      onClick: () => navigate('/dashboard/notifications'),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome section */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#8B1538] via-[#8B1538] to-[#5c0e26] p-8 md:p-10 text-white"
      >
        <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-[#D4AF37]/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-40 h-40 rounded-full bg-white/5 blur-2xl" />
        <div className="relative z-10 flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
            <VowzaIcon className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <span className="text-sm font-medium text-white/80">Your dashboard</span>
        </div>
        <h1 className="relative z-10 text-2xl md:text-3xl font-display font-bold mb-2">
          Welcome back, {displayName}
        </h1>
        <p className="relative z-10 text-white/75 max-w-lg">
          Here's what's happening with your bookings and saved artists today.
        </p>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((card, i) => (
          <motion.button
            key={card.label}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={CARD_VARIANTS}
            onClick={card.onClick}
            whileHover={{ y: -4 }}
            className={cn(
              'group text-left relative overflow-hidden rounded-2xl p-5 bg-white/70 backdrop-blur-xl border border-white/60',
              'shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)] hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.14)]',
              'transition-shadow duration-300'
            )}
          >
            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br mb-4 shadow-sm transition-transform duration-300 group-hover:scale-110', card.gradient)}>
              <card.icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-end justify-between">
              <div>
                {card.value === null ? (
                  <div className="h-8 w-10 rounded-md bg-muted animate-pulse" />
                ) : (
                  <p className="text-3xl font-display font-bold text-foreground">{card.value}</p>
                )}
                <p className="text-sm text-muted-foreground mt-1">{card.label}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-300" />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
