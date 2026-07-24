// ─── AI Response Cards ────────────────────────────────────────────────────────
// Renders rich structured data: budget table, timeline, vendor cards, checklists

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckSquare, Square, ChevronDown, ChevronUp, ExternalLink,
  AlertCircle, TrendingDown, ShieldAlert, Star,
  Sun, Sunset, Calendar, Users, MapPin, IndianRupee,
  Clock, Sparkles, CheckCircle2, ChevronRight,
} from 'lucide-react';
import type {
  AIResponse, ChecklistItem, RiskItem,
  WeddingPlan, DayPlan, TimeSlot,
} from '@/lib/aiPlannerTypes';

interface Props { response: AIResponse; }

// ─── Budget Plan Card ─────────────────────────────────────────────────────────
const BudgetCard = ({ response }: { response: AIResponse }) => {
  const [showSavings, setShowSavings] = useState(false);
  const plan = response.data?.budgetPlan;
  if (!plan) return null;

  const fmt = (n: number) => n >= 100000
    ? `₹${(n / 100000).toFixed(1)}L`
    : `₹${(n / 1000).toFixed(0)}K`;

  return (
    <div className="w-full mt-2 rounded-2xl border border-border/60 bg-card overflow-hidden text-sm">
      {/* Feasibility banner */}
      <div className={`px-4 py-2.5 text-xs font-medium flex items-center gap-2 ${
        plan.isFeasible ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
      }`}>
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
        {plan.feasibilityNote}
      </div>

      {/* Breakdown table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr className="text-[11px] text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium">Category</th>
              <th className="text-right px-3 py-2 font-medium">%</th>
              <th className="text-right px-3 py-2 font-medium">Recommended</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {plan.breakdown.map((item) => (
              <tr key={item.category} className="hover:bg-muted/20 transition-colors">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground font-medium">{item.category}</span>
                    {item.canReduce && (
                      <span title={item.reduceTip}>
                        <TrendingDown className="w-3 h-3 text-emerald-500" />
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{item.notes}</p>
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">{item.percentage}%</td>
                <td className="px-3 py-2 text-right font-semibold text-foreground">{fmt(item.recommended)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/30">
            <tr>
              <td className="px-3 py-2.5 font-bold text-foreground" colSpan={2}>Grand Total</td>
              <td className="px-3 py-2.5 text-right font-bold text-foreground">{fmt(plan.grandTotal)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-xs" colSpan={2}>
                <span className={plan.remaining >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                  {plan.remaining >= 0 ? 'Buffer remaining' : 'Over budget by'}
                </span>
              </td>
              <td className={`px-3 py-2 text-right text-xs font-semibold ${plan.remaining >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {fmt(Math.abs(plan.remaining))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Savings tips toggle */}
      <button onClick={() => setShowSavings(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors border-t border-border/30">
        <span className="font-medium">💡 {plan.savingTips.length} money-saving tips</span>
        {showSavings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {showSavings && (
        <div className="px-4 pb-3 space-y-1.5 border-t border-border/20 pt-2">
          {plan.savingTips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="text-gold mt-0.5">•</span>
              <span>{tip}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Timeline Card ────────────────────────────────────────────────────────────
const TimelineCard = ({ response }: { response: AIResponse }) => {
  const [showDay, setShowDay] = useState(false);
  const timeline = response.data?.timeline;
  if (!timeline) return null;

  const priorityColor = { critical: 'bg-red-100 text-red-700', important: 'bg-amber-100 text-amber-700', optional: 'bg-blue-100 text-blue-700' };

  return (
    <div className="w-full mt-2 rounded-2xl border border-border/60 bg-card overflow-hidden text-sm">
      <div className="px-4 py-3 bg-muted/30 border-b border-border/30">
        <p className="font-semibold text-foreground text-xs">📅 Planning Timeline</p>
      </div>
      <div className="divide-y divide-border/20 max-h-72 overflow-y-auto">
        {timeline.milestones.map((m) => (
          <div key={m.timeframe} className="px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${priorityColor[m.priority]}`}>
                {m.priority}
              </span>
              <p className="font-semibold text-xs text-foreground">{m.timeframe}</p>
            </div>
            <ul className="space-y-1">
              {m.tasks.map((task, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <span className="text-gold mt-0.5 flex-shrink-0">✓</span>
                  {task}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <button onClick={() => setShowDay(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors border-t border-border/30">
        <span>🕐 Event Day Schedule</span>
        {showDay ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {showDay && (
        <div className="divide-y divide-border/20 border-t border-border/30">
          {timeline.eventDaySchedule.map((slot, i) => (
            <div key={i} className="flex gap-3 px-4 py-2 hover:bg-muted/10 transition-colors">
              <span className="text-[11px] font-mono font-semibold text-gold w-16 flex-shrink-0">{slot.time}</span>
              <span className="text-xs text-muted-foreground">{slot.activity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Vendor Recommendations ───────────────────────────────────────────────────
const VendorCard = ({ response }: { response: AIResponse }) => {
  const vendors = response.data?.vendors;
  if (!vendors?.length) return null;

  const fmt = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n / 1000).toFixed(0)}K`;

  return (
    <div className="w-full mt-2 space-y-2">
      {vendors.map((v) => (
        <div key={v.category} className="rounded-xl border border-border/60 bg-card px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">{v.category}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{v.reason}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-bold text-foreground">{fmt(v.minPrice)}–{fmt(v.maxPrice)}</p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <div className="flex flex-wrap gap-1">
              {v.tips.slice(0, 2).map((tip, i) => (
                <span key={i} className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                  {tip}
                </span>
              ))}
            </div>
            <Link to={v.vowzaSearchUrl}
              className="flex items-center gap-1 text-xs font-semibold text-gold hover:text-gold-dark transition-colors flex-shrink-0">
              Find on Vowza <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Checklist Card ───────────────────────────────────────────────────────────
const ChecklistCard = ({ response }: { response: AIResponse }) => {
  const initial = response.data?.checklist;
  const [items, setItems] = useState<ChecklistItem[]>(initial ?? []);
  if (!items.length) return null;

  const toggle = (id: string) => setItems(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));
  const categories = [...new Set(items.map(i => i.category))];
  const done = items.filter(i => i.done).length;

  const priorityColor = { must: 'text-red-500', should: 'text-amber-500', nice: 'text-blue-500' };

  return (
    <div className="w-full mt-2 rounded-2xl border border-border/60 bg-card overflow-hidden text-sm">
      <div className="px-4 py-3 bg-muted/30 border-b border-border/30 flex items-center justify-between">
        <p className="font-semibold text-xs text-foreground">✅ Event Checklist</p>
        <span className="text-xs text-muted-foreground">{done}/{items.length} done</span>
      </div>
      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div className="h-full bg-gradient-to-r from-gold to-maroon transition-all duration-500"
          style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      <div className="max-h-72 overflow-y-auto divide-y divide-border/20">
        {categories.map(cat => (
          <div key={cat}>
            <p className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wide bg-muted/20">{cat}</p>
            {items.filter(i => i.category === cat).map(item => (
              <button key={item.id} onClick={() => toggle(item.id)}
                className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors text-left">
                {item.done
                  ? <CheckSquare className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  : <Square className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <p className={`text-xs ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {item.task}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{item.dueWhen}</span>
                    <span className={`text-[10px] font-semibold ${priorityColor[item.priority]}`}>
                      {item.priority}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Negotiation Card ─────────────────────────────────────────────────────────
const NegotiationCard = ({ response }: { response: AIResponse }) => {
  const neg = response.data?.negotiation;
  const [copied, setCopied] = useState(false);
  if (!neg) return null;

  const copy = () => {
    navigator.clipboard.writeText(neg.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full mt-2 rounded-2xl border border-border/60 bg-card overflow-hidden text-sm">
      <div className="px-4 py-3 bg-muted/30 border-b border-border/30 flex items-center justify-between">
        <p className="font-semibold text-xs text-foreground">🤝 Negotiation Message</p>
        <button onClick={copy} className="text-xs text-gold hover:text-gold-dark transition-colors font-medium">
          {copied ? '✓ Copied!' : 'Copy message'}
        </button>
      </div>
      <pre className="px-4 py-3 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed font-sans max-h-64 overflow-y-auto">
        {neg.message}
      </pre>
      {neg.tactics.length > 0 && (
        <div className="px-4 pb-3 border-t border-border/20 pt-2.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Negotiation Tips</p>
          {neg.tactics.map((t, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground mb-1">
              <span className="text-gold flex-shrink-0">•</span>{t}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Weather Card ─────────────────────────────────────────────────────────────
const WeatherCard = ({ response }: { response: AIResponse }) => {
  const w = response.data?.weather;
  if (!w) return null;
  const riskColor = { low: 'text-emerald-600 bg-emerald-50', medium: 'text-amber-600 bg-amber-50', high: 'text-red-600 bg-red-50' };

  return (
    <div className="w-full mt-2 rounded-2xl border border-border/60 bg-card overflow-hidden text-sm">
      <div className="px-4 py-3 bg-muted/30 border-b border-border/30 flex items-center justify-between">
        <p className="font-semibold text-xs text-foreground">🌤️ Season & Weather Advice</p>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${riskColor[w.risk]}`}>
          {w.risk.toUpperCase()} RISK
        </span>
      </div>
      <div className="px-4 py-3 space-y-2">
        <p className="text-xs text-muted-foreground leading-relaxed">{w.advice}</p>
        {w.backupPlan && w.backupPlan !== 'N/A for indoor events.' && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-100">
            <p className="text-xs font-semibold text-amber-700 mb-0.5">Backup Plan</p>
            <p className="text-xs text-amber-600">{w.backupPlan}</p>
          </div>
        )}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Best Months</p>
          <div className="flex flex-wrap gap-1">
            {w.bestMonths.map(m => (
              <span key={m} className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-medium">{m}</span>
            ))}
          </div>
        </div>
        {w.avoidMonths.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Avoid</p>
            <div className="flex flex-wrap gap-1">
              {w.avoidMonths.map(m => (
                <span key={m} className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-medium">{m}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Food Plan Card ───────────────────────────────────────────────────────────
const FoodCard = ({ response }: { response: AIResponse }) => {
  const fp = response.data?.foodPlan;
  if (!fp) return null;
  const fmt = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n / 1000).toFixed(0)}K`;

  return (
    <div className="w-full mt-2 rounded-2xl border border-border/60 bg-card overflow-hidden text-sm">
      <div className="px-4 py-3 bg-muted/30 border-b border-border/30">
        <p className="font-semibold text-xs text-foreground">🍽️ Food & Catering Plan</p>
      </div>
      <div className="px-4 py-3 grid grid-cols-2 gap-3 border-b border-border/20">
        <div className="p-2.5 rounded-xl bg-gold/10 text-center">
          <p className="text-[10px] text-muted-foreground">Per Plate</p>
          <p className="font-bold text-foreground">{fmt(fp.costPerPlate)}</p>
        </div>
        <div className="p-2.5 rounded-xl bg-maroon/10 text-center">
          <p className="text-[10px] text-muted-foreground">Total Food Cost</p>
          <p className="font-bold text-foreground">{fmt(fp.totalFoodCost)}</p>
        </div>
      </div>
      <div className="px-4 py-3 max-h-48 overflow-y-auto space-y-2">
        {fp.menuSuggestions.map(course => (
          <div key={course.course}>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{course.course}</p>
            <p className="text-xs text-foreground/80">{course.items.join(' · ')}</p>
          </div>
        ))}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mt-1">Live Counters</p>
          <p className="text-xs text-foreground/80">{fp.liveCounters.join(' · ')}</p>
        </div>
      </div>
    </div>
  );
};

// ─── Risk Analysis Card ───────────────────────────────────────────────────────
const RiskCard = ({ response }: { response: AIResponse }) => {
  const risks = response.data?.risks;
  if (!risks) return null;
  const probColor: Record<string, string> = { low:'bg-emerald-100 text-emerald-700', medium:'bg-amber-100 text-amber-700', high:'bg-red-100 text-red-700', critical:'bg-red-200 text-red-900' };
  const overallColor = risks.overallRisk === 'low' ? 'bg-emerald-50 text-emerald-700' : risks.overallRisk === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
  return (
    <div className="w-full mt-2 rounded-2xl border border-border/60 bg-card overflow-hidden text-sm">
      <div className={`px-4 py-2.5 flex items-center justify-between ${overallColor}`}>
        <div className="flex items-center gap-2"><ShieldAlert className="w-3.5 h-3.5" /><span className="font-semibold text-xs">Risk Analysis</span></div>
        <span className="text-xs font-bold uppercase">{risks.overallRisk} overall risk</span>
      </div>
      <div className="px-4 py-2 bg-muted/20 border-b border-border/20">
        <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Top Concern:</span> {risks.topConcern}</p>
      </div>
      <div className="divide-y divide-border/20 max-h-64 overflow-y-auto">
        {risks.risks.map((r: RiskItem, i: number) => (
          <div key={i} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="font-medium text-xs text-foreground flex-1">{r.risk}</p>
              <div className="flex gap-1 flex-shrink-0">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${probColor[r.probability]}`}>{r.probability}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${probColor[r.impact]}`}>{r.impact} impact</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mb-0.5"><span className="font-medium">Prevent:</span> {r.mitigation}</p>
            <p className="text-[11px] text-muted-foreground"><span className="font-medium">Backup:</span> {r.backupPlan}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Success Score Card ───────────────────────────────────────────────────────
const ScoreCard = ({ response }: { response: AIResponse }) => {
  const sc = response.data?.score;
  if (!sc) return null;
  const color = sc.overall >= 85 ? 'text-emerald-600' : sc.overall >= 70 ? 'text-amber-600' : 'text-red-500';
  const ring  = sc.overall >= 85 ? 'bg-emerald-50 border-emerald-200' : sc.overall >= 70 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  return (
    <div className="w-full mt-2 rounded-2xl border border-border/60 bg-card overflow-hidden text-sm">
      <div className="px-4 py-3 bg-muted/30 border-b border-border/30 flex items-center gap-2">
        <Star className="w-3.5 h-3.5 text-gold fill-gold" />
        <p className="font-semibold text-xs text-foreground">Event Success Score</p>
      </div>
      <div className="px-4 py-4 flex items-center gap-4">
        <div className={`w-20 h-20 rounded-full border-4 ${ring} flex flex-col items-center justify-center flex-shrink-0`}>
          <span className={`text-2xl font-bold ${color}`}>{sc.overall}</span>
          <span className="text-[10px] text-muted-foreground">/ 100</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground leading-relaxed">{sc.summary}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Confidence: <span className="font-semibold text-foreground">{sc.confidence}%</span></p>
        </div>
      </div>
      <div className="px-4 pb-3 space-y-1.5 border-t border-border/20 pt-2.5">
        {sc.categories.map((cat, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-40 flex-shrink-0 truncate">{cat.name}</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-gold to-maroon rounded-full transition-all" style={{ width: `${cat.score}%` }} />
            </div>
            <span className="text-[11px] font-semibold text-foreground w-8 text-right">{cat.score}</span>
          </div>
        ))}
      </div>
      {sc.improvements.length > 0 && (
        <div className="px-4 pb-3 border-t border-border/20 pt-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">To improve your score:</p>
          {sc.improvements.map((tip, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground mb-0.5">
              <span className="text-gold mt-0.5 flex-shrink-0">•</span>{tip}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Wedding Plan Card (main new component) ───────────────────────────────────
const periodColor: Record<string, string> = {
  morning:   'bg-amber-50 text-amber-700 border-amber-200',
  afternoon: 'bg-blue-50 text-blue-700 border-blue-200',
  evening:   'bg-purple-50 text-purple-700 border-purple-200',
  night:     'bg-slate-800 text-slate-200 border-slate-700',
};
const periodIcon: Record<string, React.ReactNode> = {
  morning:   <Sun className="w-3 h-3" />,
  afternoon: <Clock className="w-3 h-3" />,
  evening:   <Sunset className="w-3 h-3" />,
  night:     <Star className="w-3 h-3" />,
};

const feasibilityStyle: Record<string, string> = {
  excellent:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  good:         'bg-blue-50 text-blue-700 border-blue-200',
  tight:        'bg-amber-50 text-amber-700 border-amber-200',
  insufficient: 'bg-red-50 text-red-700 border-red-200',
};

const fmtAmt = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n / 1000).toFixed(0)}K`;

// Per-day expanded panel
const DayCard = ({ day, index }: { day: DayPlan; index: number }) => {
  const [open,         setOpen]         = useState(index === 0); // first day open by default
  const [activeTab,    setActiveTab]    = useState<'schedule'|'budget'|'vendors'|'checklist'|'tips'>('schedule');

  const periods = ['morning', 'afternoon', 'evening', 'night'] as const;
  const slotsByPeriod = periods.reduce((acc, p) => {
    acc[p] = day.slots.filter(s => s.period === p);
    return acc;
  }, {} as Record<string, TimeSlot[]>);

  const tabs = [
    { id: 'schedule'  as const, label: '🕐 Schedule',  count: day.slots.length },
    { id: 'budget'    as const, label: '💰 Budget',    count: day.budget.breakdown.length },
    { id: 'vendors'   as const, label: '🎯 Vendors',   count: day.vendors.length },
    { id: 'checklist' as const, label: '✅ Checklist', count: day.checklist.length },
    { id: 'tips'      as const, label: '✨ AI Tips',   count: day.aiTips.length },
  ];

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Day header — click to expand/collapse */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/20 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold flex-shrink-0">
            <span className="text-foreground font-bold text-sm">{day.day}</span>
          </div>
          <div>
            <p className="font-display font-semibold text-sm text-foreground">{day.label}</p>
            <p className="text-[11px] text-muted-foreground">{day.theme}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-foreground hidden sm:block">{fmtAmt(day.budget.total)}</span>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/40">
          {/* Day description */}
          <div className="px-4 py-3 bg-muted/10 border-b border-border/30">
            <p className="text-xs text-muted-foreground leading-relaxed">{day.description}</p>
            {day.goldenHour && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Star className="w-3 h-3 text-gold" />
                <span className="text-[11px] text-gold-dark font-medium">Golden Hour: {day.goldenHour}</span>
              </div>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 px-3 pt-3 pb-1 overflow-x-auto scrollbar-none">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-maroon text-primary-foreground shadow-sm'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-3">

            {/* ── Schedule tab ──────────────────────────────────────── */}
            {activeTab === 'schedule' && (
              <div className="space-y-4">
                {periods.map(period => {
                  const slots = slotsByPeriod[period];
                  if (!slots.length) return null;
                  return (
                    <div key={period}>
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border mb-2 ${periodColor[period]}`}>
                        {periodIcon[period]}
                        {period.charAt(0).toUpperCase() + period.slice(1)}
                      </div>
                      <div className="space-y-1.5 ml-1">
                        {slots.map((slot, i) => (
                          <div key={i} className="flex gap-3 items-start py-2 px-3 rounded-xl hover:bg-muted/30 transition-colors">
                            <span className="text-[11px] font-mono font-bold text-gold w-16 flex-shrink-0 pt-0.5">{slot.time}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-foreground">{slot.activity}</p>
                              <p className="text-[10px] text-muted-foreground">{slot.who}</p>
                              {slot.note && (
                                <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1">
                                  <AlertCircle className="w-2.5 h-2.5 flex-shrink-0" />
                                  {slot.note}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Budget tab ────────────────────────────────────────── */}
            {activeTab === 'budget' && (
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-semibold text-foreground">Day {day.day} Total</span>
                  <span className="text-sm font-bold text-foreground">{fmtAmt(day.budget.total)}</span>
                </div>
                <div className="space-y-1.5">
                  {day.budget.breakdown.map((b, i) => {
                    const pct = Math.round((b.amount / day.budget.total) * 100);
                    return (
                      <div key={i} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted/20 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-foreground">{b.category}</span>
                            <span className="text-xs font-bold text-foreground">{fmtAmt(b.amount)}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-gold to-maroon rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{b.note} — {pct}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Vendors tab ───────────────────────────────────────── */}
            {activeTab === 'vendors' && (
              <div className="space-y-2">
                {day.vendors.map((v, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 px-3 py-3 rounded-xl border border-border/40 bg-card hover:border-gold/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-semibold text-foreground">{v.role}</p>
                        {v.urgency === 'book_now' && (
                          <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">Book Early</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{v.description}</p>
                      <p className="text-[11px] font-semibold text-foreground mt-1">{v.budgetRange}</p>
                    </div>
                    <Link
                      to={v.searchUrl}
                      className="flex items-center gap-1 text-[11px] font-semibold text-gold hover:text-gold-dark transition-colors flex-shrink-0 mt-1"
                    >
                      Find <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            )}

            {/* ── Checklist tab ─────────────────────────────────────── */}
            {activeTab === 'checklist' && (
              <div className="space-y-1.5">
                {day.checklist.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/20 transition-colors">
                    <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                      item.priority === 'must' ? 'text-red-500' :
                      item.priority === 'should' ? 'text-amber-500' : 'text-blue-500'
                    }`} />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-foreground">{item.task}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">Owner: {item.owner}</span>
                        <span className={`text-[10px] font-semibold ${
                          item.priority === 'must' ? 'text-red-500' :
                          item.priority === 'should' ? 'text-amber-500' : 'text-blue-400'
                        }`}>{item.priority}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── AI Tips tab ───────────────────────────────────────── */}
            {activeTab === 'tips' && (
              <div className="space-y-2">
                {day.aiTips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-gold/5 border border-gold/15">
                    <Sparkles className="w-3.5 h-3.5 text-gold flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground/90 leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

const WeddingPlanCard = ({ response }: { response: AIResponse }) => {
  const plan = response.data?.weddingPlan;
  if (!plan) return null;

  const { overview, days, totalSpend, remaining, globalTips, successScore, confidence } = plan;

  const feasStyle = feasibilityStyle[overview.feasibility] ?? feasibilityStyle.good;
  const scoreColor = successScore >= 80 ? 'text-emerald-600' : successScore >= 65 ? 'text-amber-600' : 'text-red-500';
  const scoreRing  = successScore >= 80 ? 'border-emerald-200 bg-emerald-50' : successScore >= 65 ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50';

  return (
    <div className="w-full mt-2 space-y-3">

      {/* ── Wedding Overview Card ───────────────────────────────────── */}
      <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-card to-gold/5 overflow-hidden">
        <div className="px-4 py-3 bg-gradient-gold/10 border-b border-gold/20 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" />
          <p className="font-display font-semibold text-sm text-foreground">Wedding Overview</p>
        </div>
        <div className="p-4">
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {[
              { icon: <Calendar className="w-3.5 h-3.5" />,      label: "Duration",     value: `${overview.days} Days` },
              { icon: <IndianRupee className="w-3.5 h-3.5" />,   label: "Total Budget", value: fmtAmt(overview.totalBudget) },
              { icon: <Users className="w-3.5 h-3.5" />,         label: "Guests",       value: `${overview.guestCount}` },
              { icon: <MapPin className="w-3.5 h-3.5" />,        label: "Location",     value: overview.location },
              { icon: <Sparkles className="w-3.5 h-3.5" />,      label: "Style",        value: overview.style },
              { icon: <Sun className="w-3.5 h-3.5" />,           label: "Season",       value: overview.season },
            ].map(stat => (
              <div key={stat.label} className="bg-card rounded-xl p-2.5 border border-border/40">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  {stat.icon}
                  <span className="text-[10px] font-medium uppercase tracking-wide">{stat.label}</span>
                </div>
                <p className="text-xs font-bold text-foreground truncate">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Budget per day */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-secondary mb-3">
            <span className="text-xs text-muted-foreground">Budget per day</span>
            <span className="text-xs font-bold text-foreground">{fmtAmt(overview.budgetPerDay)}</span>
          </div>

          {/* Feasibility */}
          <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-xs ${feasStyle}`}>
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{overview.feasibilityNote}</span>
          </div>

          {/* Success Score */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30">
            <div className={`w-14 h-14 rounded-full border-4 ${scoreRing} flex flex-col items-center justify-center flex-shrink-0`}>
              <span className={`text-lg font-bold ${scoreColor}`}>{successScore}</span>
              <span className="text-[9px] text-muted-foreground">/100</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Plan Success Score</p>
              <p className="text-[11px] text-muted-foreground">Confidence: {confidence}%</p>
              <p className={`text-[11px] font-medium mt-0.5 ${scoreColor}`}>
                {successScore >= 80 ? 'Excellent plan — ready to execute' : successScore >= 65 ? 'Good plan — a few details to finalise' : 'Needs more information for full accuracy'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Day-wise Plan ────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide px-1">
          Day-wise Event Plan
        </p>
        {days.map((day, i) => (
          <DayCard key={day.day} day={day} index={i} />
        ))}
      </div>

      {/* ── Budget Summary ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b border-border/30">
          <p className="font-semibold text-xs text-foreground">💰 Total Budget Summary</p>
        </div>
        <div className="p-4">
          <div className="space-y-2 mb-3">
            {days.map(d => (
              <div key={d.day} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{d.label}</span>
                <span className="font-semibold text-foreground">{fmtAmt(d.budget.total)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border/30 pt-3 space-y-1.5">
            <div className="flex items-center justify-between text-sm font-bold">
              <span className="text-foreground">Total Spend</span>
              <span className="text-foreground">{fmtAmt(totalSpend)}</span>
            </div>
            <div className={`flex items-center justify-between text-xs font-semibold ${remaining >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              <span>{remaining >= 0 ? 'Buffer remaining' : 'Over budget by'}</span>
              <span>{fmtAmt(Math.abs(remaining))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Global AI Suggestions ────────────────────────────────────── */}
      <div className="rounded-2xl border border-gold/20 bg-gold/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-gold/15 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-gold" />
          <p className="font-semibold text-xs text-foreground">AI Suggestions for Your Entire Wedding</p>
        </div>
        <div className="p-3 space-y-2">
          {globalTips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-foreground/85 leading-relaxed">
              <ChevronRight className="w-3.5 h-3.5 text-gold flex-shrink-0 mt-0.5" />
              {tip}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

// ─── Router ───────────────────────────────────────────────────────────────────
const AIResponseCards = ({ response }: Props) => {
  if (!response.data) return null;

  // Wedding plan — new itinerary-first format
  if (response.type === 'wedding_plan' && response.data.weddingPlan) {
    return <WeddingPlanCard response={response} />;
  }

  if (response.type === 'full_plan' && response.data.fullPlan) {
    const fp = response.data.fullPlan;
    return (
      <>
        {fp.budget    && <BudgetCard    response={{ ...response, data: { budgetPlan: fp.budget } }} />}
        {fp.timeline  && <TimelineCard  response={{ ...response, data: { timeline: fp.timeline } }} />}
        {fp.vendors   && <VendorCard    response={{ ...response, data: { vendors: fp.vendors } }} />}
        {fp.checklist && <ChecklistCard response={{ ...response, data: { checklist: fp.checklist } }} />}
        {fp.weather   && <WeatherCard   response={{ ...response, data: { weather: fp.weather } }} />}
        {fp.risks     && <RiskCard      response={{ ...response, data: { risks: fp.risks } }} />}
        {fp.score     && <ScoreCard     response={{ ...response, data: { score: fp.score } }} />}
      </>
    );
  }

  switch (response.type) {
    case 'budget_plan':            return <BudgetCard       response={response} />;
    case 'timeline':               return <TimelineCard     response={response} />;
    case 'vendor_recommendations': return <VendorCard       response={response} />;
    case 'checklist':              return <ChecklistCard    response={response} />;
    case 'weather_advice':         return <WeatherCard      response={response} />;
    case 'food_plan':              return <FoodCard         response={response} />;
    case 'negotiation':            return <NegotiationCard  response={response} />;
    case 'risk_analysis':          return <RiskCard         response={response} />;
    case 'success_score':          return <ScoreCard        response={response} />;
    default:                       return null;
  }
};

export default AIResponseCards;
