// ─── Conversation Sidebar ─────────────────────────────────────────────────────
// Shows the list of past AI conversations for the logged-in user.
// Allows switching, renaming, and deleting conversations.

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Trash2, Pencil, Check, X, Plus, Clock } from 'lucide-react';
import type { ConversationRow } from '@/lib/conversationTypes';

interface Props {
  conversations:      ConversationRow[];
  activeId:           string | null;
  onSelect:           (conv: ConversationRow) => void;
  onDelete:           (id: string) => void;
  onRename:           (id: string, title: string) => void;
  onNewChat:          () => void;
  isLoading:          boolean;
}

// Format a date string into a relative label: "Today", "Yesterday", "3 days ago", etc.
function relativeTime(isoString: string): string {
  const d    = new Date(isoString);
  const now  = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diff < 60)           return 'Just now';
  if (diff < 3600)         return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)        return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 2)    return 'Yesterday';
  if (diff < 86400 * 7)    return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const ConversationSidebar = ({
  conversations, activeId, onSelect, onDelete, onRename, onNewChat, isLoading,
}: Props) => {
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  const startEdit = (conv: ConversationRow) => {
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const commitEdit = () => {
    if (editingId && editingTitle.trim()) {
      onRename(editingId, editingTitle.trim());
    }
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const handleEditKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter')  commitEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border/50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border/50 flex-shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Conversations
        </span>
        <button
          onClick={onNewChat}
          title="New conversation"
          className="w-7 h-7 rounded-lg bg-gold/10 hover:bg-gold/20 flex items-center justify-center transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-gold-dark" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading && (
          <div className="flex flex-col gap-2 p-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-9 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 px-3 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No conversations yet</p>
            <p className="text-[10px] text-muted-foreground/60">Start chatting to save history</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {conversations.map(conv => (
            <motion.div
              key={conv.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className={`group relative mx-1.5 mb-0.5 rounded-lg transition-colors ${
                conv.id === activeId
                  ? 'bg-gold/10 border border-gold/20'
                  : 'hover:bg-secondary border border-transparent'
              }`}
            >
              {editingId === conv.id ? (
                /* ── Inline rename input ── */
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <input
                    ref={editInputRef}
                    value={editingTitle}
                    onChange={e => setEditingTitle(e.target.value)}
                    onKeyDown={handleEditKey}
                    className="flex-1 text-xs bg-transparent border-b border-gold/40 focus:outline-none text-foreground"
                    maxLength={60}
                  />
                  <button onClick={commitEdit} className="text-emerald-500 hover:text-emerald-600 flex-shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                /* ── Normal row ── */
                <button
                  onClick={() => onSelect(conv)}
                  className="w-full text-left px-2.5 py-2 pr-14"
                >
                  <p className="text-xs font-medium text-foreground truncate leading-tight">
                    {conv.title}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="w-2.5 h-2.5 text-muted-foreground/50" />
                    <span className="text-[10px] text-muted-foreground/60">
                      {relativeTime(conv.last_active_at)}
                    </span>
                  </div>
                </button>
              )}

              {/* Action buttons — appear on hover */}
              {editingId !== conv.id && (
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => { e.stopPropagation(); startEdit(conv); }}
                    className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Rename"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(conv.id); }}
                    className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ConversationSidebar;
