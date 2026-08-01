// ─── Admin AI Planner Management ─────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, RefreshCw, MessageSquare, TrendingUp } from 'lucide-react';

export default function AdminAIPlanner() {
  const [stats, setStats] = useState({ total: 0, today: 0, avgMessages: 0 });
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('ai_conversations' as any)
          .select('id, user_id, created_at, message_count')
          .order('created_at', { ascending: false })
          .limit(20);
        const all = data ?? [];
        const today = new Date().toISOString().split('T')[0];
        setConversations(all);
        setStats({
          total: all.length,
          today: all.filter((c: any) => c.created_at?.startsWith(today)).length,
          avgMessages: all.length ? Math.round(all.reduce((s: number, c: any) => s + (c.message_count || 1), 0) / all.length) : 0,
        });
      } catch { /* table may not exist yet */ }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold text-foreground">Vowza AI Planner</h1><p className="text-sm text-muted-foreground">Vowza AI management and analytics</p></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Conversations', value: stats.total, icon: MessageSquare, color: 'bg-violet-500' },
          { label: "Today's Sessions",    value: stats.today, icon: TrendingUp,    color: 'bg-emerald-500' },
          { label: 'Avg Messages/Session',value: stats.avgMessages, icon: Sparkles, color: 'bg-gold-dark bg-[hsl(40_85%_38%)]' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5">
            <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center mb-3`}><s.icon className="w-5 h-5 text-white"/></div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5">
        <h3 className="text-sm font-semibold mb-4">Recent AI Conversations</h3>
        {loading ? <div className="space-y-2">{Array.from({length:4}).map((_,i)=><div key={i} className="skeleton h-10 rounded"/>)}</div>
        : conversations.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30"/>
            <p className="text-sm">No AI conversations recorded yet</p>
            <p className="text-xs mt-1">Conversations will appear here once users interact with Vowza Planner</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {conversations.map((c: any) => (
              <div key={c.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center"><Sparkles className="w-4 h-4 text-violet-500"/></div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Session #{c.id?.slice(0,8)}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{c.message_count || 1} msgs</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-2xl p-5 flex gap-3">
        <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"/>
        <div>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Vowza AI Planner Configuration</p>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">AI keys and prompts are configured via environment variables. To modify AI behavior, update VITE_OPENAI_API_KEY and prompt templates in Settings.</p>
        </div>
      </div>
    </div>
  );
}
