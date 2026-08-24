// ─── AvailabilityCalendar ─────────────────────────────────────────────────────
// Visual calendar showing available / booked / blocked / past dates.
// Used in BookingModal (customer view) and ProviderDashboard (artist management).

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAvailability } from '@/hooks/useAvailability';

interface Props {
  providerId:     string;
  selectedDate?:  string;
  onSelectDate?:  (date: string) => void;
  // When true: clicking a booked/blocked date is disallowed
  readOnly?:      boolean;
  // When true: allows artist to click to block/unblock their dates
  manageMode?:    boolean;
  onBlockDate?:   (date: string) => void;
  onUnblockDate?: (date: string) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const AvailabilityCalendar = ({
  providerId, selectedDate, onSelectDate,
  readOnly = false, manageMode = false,
  onBlockDate, onUnblockDate,
}: Props) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const { bookedDates, blockedDates, refetch } = useAvailability(providerId, viewMonth);

  const prevMonth = () => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const year  = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const first = new Date(year, month, 1).getDay(); // 0=Sun
    const last  = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];

    // Leading empty cells
    for (let i = 0; i < first; i++) cells.push(null);
    // Day numbers
    for (let d = 1; d <= last; d++) cells.push(d);
    // Trailing empty cells to complete the last row
    while (cells.length % 7 !== 0) cells.push(null);

    return cells;
  }, [viewMonth]);

  const getISODate = (day: number) => {
    const y = viewMonth.getFullYear();
    const m = String(viewMonth.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  type DayStatus = 'past' | 'blocked' | 'booked' | 'selected' | 'today' | 'available';

  const getDayStatus = (day: number): DayStatus => {
    const iso  = getISODate(day);
    const date = new Date(iso);
    if (date < today)             return 'past';
    if (blockedDates.has(iso))    return 'blocked';
    if (bookedDates.has(iso))     return 'booked';
    if (iso === selectedDate)     return 'selected';
    if (date.getTime() === today.getTime()) return 'today';
    return 'available';
  };

  const handleDayClick = (day: number) => {
    const iso    = getISODate(day);
    const status = getDayStatus(day);

    if (status === 'past') return;

    if (manageMode) {
      if (status === 'blocked') {
        onUnblockDate?.(iso);
        setTimeout(refetch, 300);
      } else if (status !== 'booked') {
        onBlockDate?.(iso);
        setTimeout(refetch, 300);
      }
      return;
    }

    if (readOnly) return;

    if (status === 'booked' || status === 'blocked') return;

    onSelectDate?.(iso);
  };

  const dayStyles: Record<DayStatus, string> = {
    past:      'text-muted-foreground/40 cursor-not-allowed bg-transparent',
    blocked:   `${manageMode ? 'cursor-pointer' : 'cursor-not-allowed'} bg-red-100 text-red-500 hover:bg-red-200`,
    booked:    'cursor-not-allowed bg-amber-100 text-amber-700',
    selected:  'cursor-pointer bg-gold text-foreground font-bold shadow-gold ring-2 ring-gold/40',
    today:     `cursor-pointer border-2 border-gold/50 text-foreground font-semibold ${readOnly ? '' : 'hover:bg-gold/10'}`,
    available: `${readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-gold/15'} text-foreground`,
  };

  return (
    <div className="w-full">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          disabled={viewMonth <= new Date(today.getFullYear(), today.getMonth(), 1)}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-semibold text-foreground">
          {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </p>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day header row */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const status = getDayStatus(day);
          return (
            <motion.button
              key={day}
              whileHover={status !== 'past' ? { scale: 1.08 } : {}}
              whileTap={status !== 'past' ? { scale: 0.95 } : {}}
              onClick={() => handleDayClick(day)}
              className={`
                aspect-square rounded-xl text-xs flex items-center justify-center
                transition-all duration-150 select-none
                ${dayStyles[status]}
              `}
            >
              {day}
            </motion.button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-border/30">
        {[
          { color: 'bg-gold',         label: 'Selected' },
          { color: 'bg-amber-100',    label: 'Booked' },
          { color: 'bg-red-100',      label: manageMode ? 'Blocked (click to unblock)' : 'Unavailable' },
          { color: 'bg-secondary',    label: 'Available' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${item.color} border border-border/40`} />
            <span className="text-[10px] text-muted-foreground">{item.label}</span>
          </div>
        ))}
        {manageMode && (
          <p className="text-[10px] text-muted-foreground w-full mt-1">
            Click any available date to block it. Click a blocked date to unblock it.
          </p>
        )}
      </div>
    </div>
  );
};

export default AvailabilityCalendar;
