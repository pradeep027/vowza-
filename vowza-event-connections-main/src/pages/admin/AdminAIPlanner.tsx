// ─── Admin AI Planner Management ─────────────────────────────────────────────
import { useEffect, useState } from 'react';
import VowzaIcon from '@/components/VowzaIcon';
import { supabase } from '@/integrations/supabase/client';
import { generateAllEmbeddings } from '@/lib/embeddingGenerator';
import { toast } from 'sonner';
import { RefreshCw, MessageSquare, TrendingUp, Database, CheckCircle } from 'lucide-react';

export default function AdminAIPlanner() {
  const [stats, setStats]         = useState({ total: 0, today: 0, avgMessages: 0 });
  const [conversations, setConv]  = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [embRunning, setEmbRun]   = useState(false);
  const [embProgress, setEmbProg] = useState<{ done: number; total: number } | null>(null);
  const [embResult, setEmbResult] = useState<{ success: number; failed: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('ai_conversations' as any)
          .select('id, user_id, created_at, message_count')
          .order('created_at', { ascending: false })
          .limit(20);
        const all  = data ?? [];
        const today = new Date().toISOString().split('T')[0];
        setConv(all);
        setStats({
          total:       all.length,
          today:       all.filter((c: any) => c.created_at?.startsWith(today)).length,
          avgMessages: all.length ? Math.round(all.reduce((s: number, c: any) => s + (c.message_count || 1), 0) / all.length) : 0,
        });
      } catch { /* table may not exist yet */ }
      setLoading(false);
    })();
  }, []);

  const handleGenerateEmbeddings = async () => {
    setEmbRun(true);
    setEmbProg({ done: 0, total: 0 });
    setEmbResult(null);
    try {
      const result = await generateAllEmbeddings((done, total) => setEmbProg({ done, total }));
      setEmbResult(result);
      toast.success(`Embeddings done: ${result.success} success, ${result.failed} failed`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate embeddings');
    } finally {
      setEmbRun(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Vowza AI Planner</h1>
          <p className="text-sm text-muted-foreground">AI management, analytics and RAG configuration</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Conversations', value: stats.total,       icon: MessageSquare, color: 'bg-violet-500' },
          { label: "Today's Sessions",    value: stats.today,       icon: TrendingUp,    color: 'bg-emerald-500' },
          { label: 'Avg Msgs/Session',    value: stats.avgMessages, icon: VowzaIcon,      color: 'bg-amber-500'   },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5">
            <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center mb-3`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* RAG Embeddings panel */}
      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center">
              <Database className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">RAG Vector Embeddings</p>
              <p className="text-xs text-muted-foreground">Generate embeddings for semantic vendor search in Vowza AI Planner</p>
            </div>
          </div>
          <button
            onClick={handleGenerateEmbeddings}
            disabled={embRunning}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500 text-white text-xs font-semibold hover:bg-violet-600 transition-colors disabled:opacity-50"
          >
            {embRunning
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating…</>
              : <><Database className="w-3.5 h-3.5" /> Generate All Embeddings</>
            }
          </button>
        </div>

        {embRunning && embProgress && embProgress.total > 0 && (
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Processing vendor profiles…</span>
              <span>{embProgress.done} / {embProgress.total}</span>
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-300"
                style={{ width: `${embProgress.total ? (embProgress.done / embProgress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {embResult && (
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span className="font-medium text-foreground">{embResult.success} embeddings generated</span>
            {embResult.failed > 0 && <span className="text-red-500 ml-1">{embResult.failed} failed</span>}
          </div>
        )}

        <div className="bg-secondary/60 rounded-xl p-3 text-xs text-muted-foreground space-y-1">
          <p><strong>How it works:</strong> Embeddings convert vendor profile text into vectors. The AI uses these for semantic search — finding "photographers under ₹50K in Hyderabad" even if the vendor doesn't use those exact words.</p>
          <p>Requires <code className="bg-background px-1 py-0.5 rounded">VITE_OPENAI_KEY=sk-…</code> in <code className="bg-background px-1 py-0.5 rounded">.env</code>. Without a key, Vowza AI falls back to SQL-based search which still works well.</p>
        </div>
      </div>

      {/* Recent conversations */}
      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Recent AI Conversations</h3>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-10 rounded" />)}</div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <VowzaIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No AI conversations yet</p>
            <p className="text-xs mt-1">Conversations appear once users interact with Vowza AI Planner</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {conversations.map((c: any) => (
              <div key={c.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center">
                    <VowzaIcon className="w-4 h-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Session #{c.id?.slice(0, 8)}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{c.message_count || 1} msgs</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Config info */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-2xl p-5 flex gap-3">
        <VowzaIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Vowza AI Planner — RAG Architecture</p>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
            The AI now retrieves real vendors from your database before every response (SQL hybrid search).
            For semantic vector search, generate embeddings above and add <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">VITE_USE_AI_PROXY=true</code> +
            deploy the <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">ai-chat</code> Edge Function.
          </p>
        </div>
      </div>
    </div>
  );
}
