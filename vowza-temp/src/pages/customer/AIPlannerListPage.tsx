// AIPlannerListPage — customer dashboard view of previously generated AI plans.
// Reuses conversationRepository directly (same data source as the floating
// ConversationSidebar widget). Maintains Vowza AI branding.
import { useState, useEffect, useCallback } from 'react';
import VowzaIcon from '@/components/VowzaIcon';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  listConversations, deleteConversation, duplicateConversation, loadMessages,
  exportConversationAsFile
} from '@/lib/conversationRepository';
import type { ConversationRow } from '@/lib/conversationTypes';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Copy, Trash2, Download, MessageSquarePlus, PlusCircle
} from 'lucide-react';

const CONV_KEY = 'vowza_ai_conv_id';

export default function AIPlannerListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }
    setIsLoading(true);
    const rows = await listConversations(user.id);
    setConversations(rows);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleOpen = (conv: ConversationRow) => {
    sessionStorage.setItem(CONV_KEY, conv.id);
    navigate('/ai-planner');
  };

  const handleNewPlan = () => {
    sessionStorage.removeItem(CONV_KEY);
    navigate('/ai-planner');
  };

  const handleDuplicate = async (conv: ConversationRow) => {
    if (!user) return;
    setBusyId(conv.id);
    try {
      const newId = await duplicateConversation(user.id, conv);
      if (newId) {
        toast.success('Plan duplicated');
        await refresh();
      } else {
        toast.error('Failed to duplicate plan');
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = async (conv: ConversationRow) => {
    setBusyId(conv.id);
    try {
      const messages = await loadMessages(conv.id);
      exportConversationAsFile(conv, messages);
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget);
    try {
      await deleteConversation(deleteTarget);
      setConversations(prev => prev.filter(c => c.id !== deleteTarget));
      toast.success('Plan deleted');
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <VowzaIcon className="w-6 h-6 text-[#D4AF37]" /> Vowza AI Planner
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Your saved event planning conversations.</p>
        </div>
        <Button onClick={handleNewPlan} className="bg-gradient-to-r from-[#8B1538] to-[#A31E42] hover:opacity-90">
          <PlusCircle className="w-4 h-4 mr-1.5" /> Generate New Plan
        </Button>
      </div>

      {conversations.length === 0 ? (
        <EmptyState onNewPlan={handleNewPlan} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {conversations.map((conv, i) => (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                whileHover={{ y: -3 }}
                className="rounded-2xl bg-white border border-border p-5 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B1538] to-[#D4AF37] flex items-center justify-center shrink-0">
                    <VowzaIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{conv.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {new Date(conv.last_active_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-auto pt-2">
                  <Button size="sm" className="flex-1 bg-gradient-to-r from-[#8B1538] to-[#A31E42] hover:opacity-90" onClick={() => handleOpen(conv)}>
                    Open
                  </Button>
                  <Button size="sm" variant="outline" disabled={busyId === conv.id} onClick={() => handleDuplicate(conv)} aria-label="Duplicate">
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" disabled={busyId === conv.id} onClick={() => handleExport(conv)} aria-label="Export">
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" disabled={busyId === conv.id} onClick={() => setDeleteTarget(conv.id)} aria-label="Delete">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-1">Delete this plan?</h3>
            <p className="text-sm text-muted-foreground mb-4">This will permanently remove the conversation and all its messages.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleConfirmDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onNewPlan }: { onNewPlan: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="rounded-3xl border border-dashed border-border bg-white/60 py-16 flex flex-col items-center text-center px-6"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8B1538]/10 to-[#D4AF37]/10 flex items-center justify-center mb-4">
        <MessageSquarePlus className="w-8 h-8 text-[#8B1538]" />
      </div>
      <h3 className="font-display font-semibold text-lg text-foreground mb-1">No plans yet</h3>
      <p className="text-muted-foreground text-sm max-w-sm mb-5">
        Start a conversation with Vowza AI Planner to get personalized event planning suggestions.
      </p>
      <Button onClick={onNewPlan} className="bg-gradient-to-r from-[#8B1538] to-[#A31E42] hover:opacity-90">
        <VowzaIcon className="w-4 h-4 mr-1.5" /> Generate New Plan
      </Button>
    </motion.div>
  );
}
