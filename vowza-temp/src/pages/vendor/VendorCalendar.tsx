import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X, Lock, CheckCircle, Clock, MapPin } from 'lucide-react';
import { useVendorId, useVendorRealtime, useVendorAvailability } from '@/hooks/useVendorData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function VendorCalendar() {
  const qc = useQueryClient();
  const { data: provider } = useVendorId();
  const vendorId = provider?.id ?? null;
  useVendorRealtime(vendorId);
  const { data: availability } = useVendorAvailability(vendorId);

  const booked = availability?.booked ?? [];
  const tentative = availability?.tentative ?? [];
  const blocked = availability?.blocked ?? [];

  const [month, setMonth] = useState(new Date());
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blocking, setBlocking] = useState(false);

  const today = new Date();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();

  const iso = (day: number) =>
    `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const handleBlockDates = async () => {
    if (!vendorId || !blockStart) { toast.error('Please select a start date'); return; }
    if (!blockReason.trim()) { toast.error('Please enter a reason'); return; }
    const end = blockEnd || blockStart;
    setBlocking(true);
    try {
      const startD = new Date(blockStart);
      const endD = new Date(end);
      const dates: string[] = [];
      for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }
      // Check for conflicts with confirmed bookings
      const conflicts = dates.filter(d => booked.includes(d));
      if (conflicts.length > 0) {
        toast.error(`Cannot block ${conflicts.join(', ')} — confirmed bookings exist.`);
        setBlocking(false);
        return;
      }
      // Insert availability blocks
      const rows = dates.map(d => ({
        provider_id: vendorId,
        unavailable_date: d,
        slot_type: 'unavailable',
        reason: blockReason || 'Blocked by artist',
      }));
      const { error } = await supabase.from('provider_availability').upsert(rows, { onConflict: 'provider_id,unavailable_date' });
      if (error) throw error;
      toast.success(`${dates.length} date${dates.length > 1 ? 's' : ''} blocked`);
      setBlockOpen(false); setBlockStart(''); setBlockEnd(''); setBlockReason('');
      qc.invalidateQueries({ queryKey: ['vendor-availability', vendorId] });
    } catch (err: any) { toast.error(err.message || 'Failed to block dates'); }
    finally { setBlocking(false); }
  };

  const handleUnblock = async (date: string) => {
    if (!vendorId) return;
    await supabase.from('provider_availability').delete().eq('provider_id', vendorId).eq('unavailable_date', date);
    toast.success('Date unblocked');
    qc.invalidateQueries({ queryKey: ['vendor-availability', vendorId] });
  };

  // Upcoming confirmed bookings
  const upcomingBooked = useMemo(() => {
    const todayStr = today.toISOString().split('T')[0];
    return booked.filter(d => d >= todayStr).sort().slice(0, 5);
  }, [booked]);

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground">Manage your bookings and availability.</p>
        </div>
        <Button onClick={() => setBlockOpen(true)} className="bg-[#8B1538] hover:bg-[#70102d] text-white">
          <Lock className="w-4 h-4 mr-1.5" /> Block Dates
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Calendar Grid */}
        <div className="bg-white rounded-2xl border border-border/60 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setMonth(new Date())} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-secondary">Today</button>
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1))} className="p-2 rounded-lg hover:bg-secondary"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1))} className="p-2 rounded-lg hover:bg-secondary"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} className="h-14" />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1, date = iso(day);
              const isToday = day === today.getDate() && month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear();
              const isBooked = booked.includes(date);
              const isTentative = tentative.includes(date);
              const isBlocked = blocked.includes(date);
              const isPast = new Date(date) < new Date(today.toISOString().split('T')[0]);
              return (
                <div key={day} className={cn(
                  'relative h-14 rounded-xl flex flex-col items-center justify-center text-sm transition-all cursor-default border',
                  isToday ? 'border-[#8B1538] bg-[#8B1538]/5 font-bold' : 'border-transparent',
                  isBooked ? 'bg-emerald-50' : isBlocked ? 'bg-red-50' : isTentative ? 'bg-amber-50' : isPast ? 'bg-muted/30' : 'hover:bg-secondary',
                )}>
                  <span className={cn('text-xs', isPast && !isToday && 'text-muted-foreground')}>{day}</span>
                  {isBooked && <span className="absolute bottom-1 text-[8px] font-bold text-emerald-600">BOOKED</span>}
                  {isBlocked && !isBooked && <span className="absolute bottom-1 text-[8px] font-bold text-red-500">BLOCKED</span>}
                  {isTentative && !isBooked && !isBlocked && <span className="absolute bottom-1 text-[8px] font-bold text-amber-600">PENDING</span>}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-6 pt-4 border-t border-border/40 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Confirmed</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> Pending</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> Blocked</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-border" /> Available</span>
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Today */}
          <div className="bg-white rounded-2xl border border-border/60 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Today's Status</h3>
            {booked.includes(today.toISOString().split('T')[0]) ? (
              <div className="flex items-center gap-2 text-emerald-700 text-sm"><CheckCircle className="w-4 h-4" /> Booked</div>
            ) : blocked.includes(today.toISOString().split('T')[0]) ? (
              <div className="flex items-center gap-2 text-red-600 text-sm"><Lock className="w-4 h-4" /> Blocked</div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-600 text-sm"><CheckCircle className="w-4 h-4" /> Available</div>
            )}
          </div>

          {/* Upcoming */}
          <div className="bg-white rounded-2xl border border-border/60 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Upcoming Bookings</h3>
            {upcomingBooked.length === 0 ? (
              <p className="text-xs text-muted-foreground">No upcoming confirmed bookings.</p>
            ) : (
              <div className="space-y-2">
                {upcomingBooked.map(d => (
                  <div key={d} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                    <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-medium text-emerald-800">{new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Blocked Dates */}
          <div className="bg-white rounded-2xl border border-border/60 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Blocked Dates</h3>
            {blocked.length === 0 ? (
              <p className="text-xs text-muted-foreground">No blocked dates.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {blocked.sort().map(d => (
                  <div key={d} className="flex items-center justify-between text-xs p-2 rounded-lg bg-red-50 border border-red-100">
                    <span className="text-red-700 font-medium">{new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    <button onClick={() => handleUnblock(d)} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Block Dates Dialog */}
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Block Availability</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <label className="block">
              <span className="text-sm font-semibold text-foreground">Start Date *</span>
              <input type="date" className="w-full mt-1 rounded-xl border border-border px-3 py-2.5 text-sm" value={blockStart} onChange={e => setBlockStart(e.target.value)} min={today.toISOString().split('T')[0]} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-foreground">End Date</span>
              <input type="date" className="w-full mt-1 rounded-xl border border-border px-3 py-2.5 text-sm" value={blockEnd} onChange={e => setBlockEnd(e.target.value)} min={blockStart || today.toISOString().split('T')[0]} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-foreground">Reason <span className="text-red-500">*</span></span>
              <input type="text" className="w-full mt-1 rounded-xl border border-border px-3 py-2.5 text-sm" value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="Enter the reason for blocking these dates..." />
            </label>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setBlockOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-[#8B1538] hover:bg-[#70102d] text-white" disabled={blocking || !blockStart} onClick={handleBlockDates}>
                {blocking ? 'Blocking...' : 'Block Dates'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
