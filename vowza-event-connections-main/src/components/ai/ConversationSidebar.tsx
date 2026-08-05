// ─── Conversation Sidebar — ChatGPT-style ────────────────────────────────────
// Shows past AI conversations for the logged-in user, grouped by recency
// (Pinned / Today / Yesterday / Last 7 Days / Last 30 Days / Older), plus:
//  • Search across conversation titles
//  • Pin / Unpin, Archive / Restore, Rename, Delete
//  • Multi-select with bulk delete + "Delete All", both confirmed via dialog
//  • Archived conversations collapse into their own section

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Trash2, Pencil, Check, X, Plus, Clock,
  Pin, PinOff, Archive, ArchiveRestore, Search, CheckSquare, Square,
  AlertTriangle, Star, Copy, Download,
} from 'lucide-react';
import type { ConversationRow } from '@/lib/conversationTypes';

interface Props {
  conversations:      ConversationRow[];
  activeId:           string | null;
  onSelect:           (conv: ConversationRow) => void;
  onDelete:           (id: string) => void;
  onDeleteMultiple?:  (ids: string[]) => void;
  onDeleteAll?:       () => void;
  onRename:           (id: string, title: string) => void;
  onPin?:             (id: string, pinned: boolean) => void;
  onArchive?:         (id: string, archived: boolean) => void;
  onFavorite?:        (id: string, favorite: boolean) => void;
  onDuplicate?:       (id: string) => void;
  onExport?:          (id: string) => void;
  onNewChat:          () => void;
  isLoading:          boolean;
}

// ── Relative time label for a single row ──────────────────────────────────────
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

// ── Bucket a conversation into a sidebar section ──────────────────────────────
type Bucket = 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days' | 'Older';

function bucketFor(isoString: string): Bucket {
  const d    = new Date(isoString);
  const now  = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);

  if (diffDays < 1)  return 'Today';
  if (diffDays < 2)  return 'Yesterday';
  if (diffDays < 7)  return 'Last 7 Days';
  if (diffDays < 30) return 'Last 30 Days';
  return 'Older';
}

const BUCKET_ORDER: Bucket[] = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Older'];

// ── Confirmation dialog (used for single/bulk/all deletes) ────────────────────
const ConfirmDialog = ({
  title, body, confirmLabel, onConfirm, onCancel,
}: {
  title: string; body: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={onCancel}
  >
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={e => e.stopPropagation()}
      className="w-full max-w-xs bg-card border border-border rounded-2xl p-4 shadow-2xl"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-500" />
        </div>
        <p className="font-semibold text-sm text-foreground">{title}</p>
      </div>
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{body}</p>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
          Cancel
        </button>
        <button onClick={onConfirm} className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors">
          {confirmLabel}
        </button>
      </div>
    </motion.div>
  </motion.div>
);

const ConversationSidebar = ({
  conversations, activeId, onSelect, onDelete, onDeleteMultiple, onDeleteAll,
  onRename, onPin, onArchive, onFavorite, onDuplicate, onExport, onNewChat, isLoading,
}: Props) => {
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [editingTitle,  setEditingTitle]  = useState('');
  const [search,        setSearch]        = useState('');
  const [showArchived,  setShowArchived]  = useState(false);
  const [selectMode,    setSelectMode]    = useState(false);
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [confirmState,  setConfirmState]  = useState<
    | null
    | { type: 'single'; id: string }
    | { type: 'bulk' }
    | { type: 'all' }
  >(null);

  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  const startEdit = (conv: ConversationRow) => {
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };
  const commitEdit = () => {
    if (editingId && editingTitle.trim()) onRename(editingId, editingTitle.trim());
    setEditingId(null);
  };
  const cancelEdit = () => setEditingId(null);
  const handleEditKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter')  commitEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Filter + split active vs archived vs favorite ─────────────────────────
  const { pinned, favorites, grouped, archived } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? conversations.filter(c => c.title.toLowerCase().includes(q))
      : conversations;

    const active = filtered.filter(c => !c.is_archived);
    const archivedList = filtered.filter(c => c.is_archived);

    const pinnedList = active.filter(c => c.is_pinned);
    const favoriteList = active.filter(c => c.is_favorite && !c.is_pinned);
    const rest = active.filter(c => !c.is_pinned && !c.is_favorite);

    const buckets: Record<Bucket, ConversationRow[]> = {
      'Today': [], 'Yesterday': [], 'Last 7 Days': [], 'Last 30 Days': [], 'Older': [],
    };
    for (const c of rest) buckets[bucketFor(c.last_active_at)].push(c);

    return { pinned: pinnedList, favorites: favoriteList, grouped: buckets, archived: archivedList };
  }, [conversations, search]);

  const hasAnyResults = pinned.length > 0
    || favorites.length > 0
    || BUCKET_ORDER.some(b => grouped[b].length > 0)
    || archived.length > 0;

  // ── Single conversation row ────────────────────────────────────────────────
  const Row = ({ conv }: { conv: ConversationRow }) => (
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
        <button
          onClick={() => selectMode ? toggleSelected(conv.id) : onSelect(conv)}
          className="w-full text-left px-2.5 py-2 pr-14 flex items-start gap-2"
        >
          {selectMode && (
            selectedIds.has(conv.id)
              ? <CheckSquare className="w-3.5 h-3.5 text-gold-dark flex-shrink-0 mt-0.5" />
              : <Square className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              {conv.is_pinned && <Pin className="w-2.5 h-2.5 text-gold-dark flex-shrink-0" />}
              {conv.is_favorite && <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500 flex-shrink-0" />}
              <p className="text-xs font-medium text-foreground truncate leading-tight">
                {conv.title}
              </p>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Clock className="w-2.5 h-2.5 text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground/60">
                {relativeTime(conv.last_active_at)}
              </span>
            </div>
          </div>
        </button>
      )}

      {editingId !== conv.id && !selectMode && (
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-card/95 rounded-lg">
          {onFavorite && (
            <button
              onClick={e => { e.stopPropagation(); onFavorite(conv.id, !conv.is_favorite); }}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={conv.is_favorite ? 'Unfavorite' : 'Favorite'}
            >
              <Star className={`w-3 h-3 ${conv.is_favorite ? 'text-amber-500 fill-amber-500' : ''}`} />
            </button>
          )}
          {onPin && (
            <button
              onClick={e => { e.stopPropagation(); onPin(conv.id, !conv.is_pinned); }}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={conv.is_pinned ? 'Unpin' : 'Pin'}
            >
              {conv.is_pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
            </button>
          )}
          {onArchive && (
            <button
              onClick={e => { e.stopPropagation(); onArchive(conv.id, !conv.is_archived); }}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={conv.is_archived ? 'Restore' : 'Archive'}
            >
              {conv.is_archived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
            </button>
          )}
          {onDuplicate && (
            <button
              onClick={e => { e.stopPropagation(); onDuplicate(conv.id); }}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Duplicate"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
          {onExport && (
            <button
              onClick={e => { e.stopPropagation(); onExport(conv.id); }}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Export"
            >
              <Download className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); startEdit(conv); }}
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Rename"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); setConfirmState({ type: 'single', id: conv.id }); }}
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </motion.div>
  );

  const Section = ({ label, items }: { label: string; items: ConversationRow[] }) => {
    if (!items.length) return null;
    return (
      <div className="mb-1">
        <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wide">
          {label}
        </p>
        <AnimatePresence initial={false}>
          {items.map(conv => <Row key={conv.id} conv={conv} />)}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border/50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border/50 flex-shrink-0 gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Chats
        </span>
        <div className="flex items-center gap-1">
          {conversations.length > 0 && (onDeleteMultiple || onDeleteAll) && (
            <button
              onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()); }}
              title={selectMode ? 'Cancel selection' : 'Select conversations'}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                selectMode ? 'bg-secondary text-foreground' : 'hover:bg-secondary text-muted-foreground'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onNewChat}
            title="New conversation"
            className="w-7 h-7 rounded-lg bg-gold/10 hover:bg-gold/20 flex items-center justify-center transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-gold-dark" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border/40 flex-shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search chats"
            className="w-full text-xs bg-secondary rounded-lg pl-8 pr-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gold/40 text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {selectMode && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-secondary/50 flex-shrink-0">
          <span className="text-[11px] text-muted-foreground">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            {onDeleteAll && (
              <button
                onClick={() => setConfirmState({ type: 'all' })}
                className="text-[11px] text-red-500 hover:text-red-600 font-medium"
              >
                Delete All
              </button>
            )}
            {onDeleteMultiple && (
              <button
                onClick={() => selectedIds.size > 0 && setConfirmState({ type: 'bulk' })}
                disabled={selectedIds.size === 0}
                className="text-[11px] text-red-500 hover:text-red-600 font-medium disabled:opacity-40"
              >
                Delete Selected
              </button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1 scrollbar-thin">
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

        {!isLoading && conversations.length > 0 && !hasAnyResults && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 px-3 text-center">
            <Search className="w-6 h-6 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No matching chats</p>
          </div>
        )}

        {!isLoading && (
          <>
            <Section label="Pinned" items={pinned} />
            <Section label="Favorites" items={favorites} />
            {BUCKET_ORDER.map(b => <Section key={b} label={b} items={grouped[b]} />)}

            {archived.length > 0 && (
              <div className="mt-1 border-t border-border/30 pt-1">
                <button
                  onClick={() => setShowArchived(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  <span className="flex items-center gap-1">
                    <Archive className="w-3 h-3" /> Archived ({archived.length})
                  </span>
                  <span>{showArchived ? '▾' : '▸'}</span>
                </button>
                {showArchived && (
                  <AnimatePresence initial={false}>
                    {archived.map(conv => <Row key={conv.id} conv={conv} />)}
                  </AnimatePresence>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirmation dialogs */}
      <AnimatePresence>
        {confirmState?.type === 'single' && (
          <ConfirmDialog
            title="Delete this chat?"
            body="This conversation and all its messages will be permanently deleted. This cannot be undone."
            confirmLabel="Delete"
            onCancel={() => setConfirmState(null)}
            onConfirm={() => { onDelete(confirmState.id); setConfirmState(null); }}
          />
        )}
        {confirmState?.type === 'bulk' && onDeleteMultiple && (
          <ConfirmDialog
            title={`Delete ${selectedIds.size} chats?`}
            body="These conversations and all their messages will be permanently deleted. This cannot be undone."
            confirmLabel="Delete"
            onCancel={() => setConfirmState(null)}
            onConfirm={() => {
              onDeleteMultiple(Array.from(selectedIds));
              setSelectedIds(new Set());
              setSelectMode(false);
              setConfirmState(null);
            }}
          />
        )}
        {confirmState?.type === 'all' && onDeleteAll && (
          <ConfirmDialog
            title="Delete all chats?"
            body="Every conversation in your history will be permanently deleted. This cannot be undone."
            confirmLabel="Delete All"
            onCancel={() => setConfirmState(null)}
            onConfirm={() => { onDeleteAll(); setSelectMode(false); setConfirmState(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ConversationSidebar;
