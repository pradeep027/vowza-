// ─── Vowza Planner — Dedicated Full-Page AI Event Planning Assistant ──────────
// Route: /ai-planner
// Premium ChatGPT-style experience, centered layout, mobile responsive.

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Send, Mic, MicOff, Sparkles, RotateCcw,
  ChevronDown, Check, Copy, Pencil, RefreshCw, PanelLeft,
  ThumbsUp, ThumbsDown, Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAIChat } from '@/components/ai/useAIChat';
import MarkdownMessage from '@/components/ai/MarkdownMessage';
import AIResponseCards from '@/components/ai/AIResponseCards';
import ConversationSidebar from '@/components/ai/ConversationSidebar';
import { useAuth } from '@/contexts/AuthContext';
import type { ChatMessage } from '@/lib/aiPlannerTypes';

// ─── Typing dots ─────────────────────────────────────────────────────────────
const TypingDots = () => (
  <div className="flex items-center gap-1.5 py-1">
    {[0, 1, 2].map(i => (
      <motion.span key={i} className="w-2.5 h-2.5 rounded-full bg-gradient-gold"
        animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }} />
    ))}
  </div>
);

// ─── Blinking cursor shown at the end of streaming text ───────────────────────
const StreamingCursor = () => (
  <span className="inline-block w-[2px] h-4 bg-gold ml-0.5 align-middle animate-blink-cursor" />
);

// ─── Message bubble ───────────────────────────────────────────────────────────
const MessageBubble = ({
  msg, isLast, onEdit, onRegenerate, onReact,
}: {
  msg: ChatMessage;
  isLast: boolean;
  onEdit: (id: string, text: string) => void;
  onRegenerate: () => void;
  onReact: (id: string, reaction: 'like' | 'dislike') => void;
}) => {
  const [copied,   setCopied]   = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [editText, setEditText] = useState(msg.text);
  const isUser = msg.role === 'user';

  const copy = () => {
    navigator.clipboard.writeText(msg.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const shareMessage = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Vowza Planner', text: msg.text });
      } else {
        await navigator.clipboard.writeText(msg.text);
        toast.success('Copied to clipboard — ready to share');
      }
    } catch {
      /* user cancelled share sheet — no-op */
    }
  };

  const commit = () => {
    if (editText.trim() && editText !== msg.text) onEdit(msg.id, editText.trim());
    setEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-3 group ${isUser ? 'flex-row-reverse' : 'flex-row'} max-w-3xl ${isUser ? 'ml-auto' : 'mr-auto'} w-full`}
    >
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1
        ${isUser ? 'bg-royal/20 text-royal' : 'bg-gradient-gold shadow-gold text-foreground'}`}>
        {isUser ? <span className="text-xs font-bold">U</span> : <Sparkles className="w-4 h-4" />}
      </div>

      <div className={`flex flex-col gap-1.5 min-w-0 flex-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Label */}
        <span className="text-[11px] font-semibold text-muted-foreground px-1">
          {isUser ? 'You' : '✨ Vowza Planner'}
        </span>

        {/* Bubble */}
        {editing ? (
          <div className="w-full max-w-xl">
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); } if (e.key === 'Escape') setEditing(false); }}
              autoFocus rows={3}
              className="w-full text-sm bg-secondary border border-gold/40 rounded-2xl px-4 py-3 focus:outline-none resize-none text-foreground"
            />
            <div className="flex gap-2 mt-2 justify-end">
              <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={commit} className="text-xs bg-gold text-foreground px-4 py-1.5 rounded-lg hover:opacity-90 font-semibold">Send</button>
            </div>
          </div>
        ) : (
          <div className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm max-w-xl
            ${isUser
              ? 'bg-gradient-to-br from-royal to-royal/80 text-white rounded-tr-sm'
              : 'bg-card border border-border/50 text-foreground rounded-tl-sm'}`}>
            <MarkdownMessage text={msg.text} />
          </div>
        )}

        {/* Structured cards */}
        {!editing && msg.response && msg.response.type !== 'text' && msg.response.data && (
          <div className="w-full max-w-2xl">
            <AIResponseCards response={msg.response} />
          </div>
        )}

        {/* Action bar — ALWAYS visible for assistant messages */}
        {!editing && !isUser && (
          <div className="flex items-center gap-1 px-1 mt-1">
            <button onClick={copy} title="Copy"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-transparent hover:border-border/50">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button onClick={() => onReact(msg.id, 'like')} title="Good response"
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-colors border border-transparent hover:border-border/50 ${
                msg.reaction === 'like' ? 'text-emerald-600 bg-emerald-50' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}>
              <ThumbsUp className={`w-3.5 h-3.5 ${msg.reaction === 'like' ? 'fill-emerald-500' : ''}`} />
              <span>Like</span>
            </button>
            <button onClick={() => onReact(msg.id, 'dislike')} title="Bad response"
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-colors border border-transparent hover:border-border/50 ${
                msg.reaction === 'dislike' ? 'text-red-600 bg-red-50' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}>
              <ThumbsDown className={`w-3.5 h-3.5 ${msg.reaction === 'dislike' ? 'fill-red-500' : ''}`} />
              <span>Dislike</span>
            </button>
            <button onClick={shareMessage} title="Share"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-transparent hover:border-border/50">
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
            {isLast && (
              <button onClick={onRegenerate} title="Regenerate"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-transparent hover:border-border/50">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Regenerate</span>
              </button>
            )}
          </div>
        )}

        {/* Edit button for user messages */}
        {!editing && isUser && (
          <div className="flex items-center gap-1 px-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => { setEditing(true); setEditText(msg.text); }} title="Edit"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── Quick prompt pills ───────────────────────────────────────────────────────
const STARTER_PROMPTS = [
  { icon: '💒', label: 'Plan my wedding', prompt: 'Plan my complete wedding' },
  { icon: '💰', label: 'Budget breakdown', prompt: 'Give me a detailed budget breakdown for my event' },
  { icon: '📋', label: 'Full event plan', prompt: 'Create a complete plan for my event with timeline and vendors' },
  { icon: '🎯', label: 'Recommend vendors', prompt: 'Recommend the best vendors for my event' },
  { icon: '📅', label: 'Event timeline', prompt: 'Create a complete planning timeline for my event' },
  { icon: '⚠️', label: 'Risk analysis', prompt: 'Analyse risks for my event and suggest backup plans' },
];

// ─── Main page ────────────────────────────────────────────────────────────────
const AIPlanner = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    messages, isStreaming, streamingText, context,
    conversationId, conversations, historyLoading,
    send, editAndResend, regenerateLastResponse,
    clearChat, loadConversation, removeConversation,
    removeConversations, removeAllConversations,
    renameConversation, pinConversation, archiveConversation,
    favoriteConversation, duplicateConversationById, exportConversation,
    setMessageReaction,
    quickPrompts,
  } = useAIChat();

  const [input,         setInput]         = useState('');
  const [isListening,   setIsListening]   = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showSidebar,   setShowSidebar]   = useState(false);

  const messagesEndRef   = useRef<HTMLDivElement>(null);
  const containerRef     = useRef<HTMLDivElement>(null);
  const inputRef         = useRef<HTMLTextAreaElement>(null);
  const recognitionRef   = useRef<any>(null);

  // Check for prefill from Hero "Plan My Event" button
  useEffect(() => {
    const prefill = sessionStorage.getItem('vowza_planner_prefill');
    if (prefill) {
      sessionStorage.removeItem('vowza_planner_prefill');
      setTimeout(() => send(prefill), 400);
    }
    inputRef.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    if (!showScrollBtn) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, showScrollBtn]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 150);
  }, []);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    send(text);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const rec = new SR();
    rec.lang = 'en-IN'; rec.continuous = false; rec.interimResults = false;
    rec.onresult = (e: any) => { setInput(p => p + (p ? ' ' : '') + e.results[0][0].transcript); setIsListening(false); };
    rec.onerror = rec.onend = () => setIsListening(false);
    rec.start(); recognitionRef.current = rec; setIsListening(true);
  };

  const ctxPills = [
    context.eventType  && context.eventType,
    context.city       && `📍 ${context.city}`,
    context.budget     && `💰 ₹${(context.budget / 100000).toFixed(1)}L`,
    context.guestCount && `👥 ${context.guestCount}`,
  ].filter(Boolean) as string[];

  const lastAssistantIdx = messages.reduce((acc, m, i) => m.role === 'assistant' ? i : acc, -1);
  const isEmpty = messages.length === 0 && !isStreaming && !historyLoading;

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* ── Mobile-only backdrop behind the sidebar drawer (md+ untouched) ──── */}
      <AnimatePresence>
        {showSidebar && user && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setShowSidebar(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSidebar && user && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-y-0 left-0 z-40 md:relative md:z-auto flex-shrink-0 overflow-hidden border-r border-border/50 bg-card"
            style={{ width: 280 }}
          >
            <ConversationSidebar
              conversations={conversations}
              activeId={conversationId}
              isLoading={historyLoading}
              onSelect={conv => { loadConversation(conv); setShowSidebar(false); }}
              onDelete={removeConversation}
              onDeleteMultiple={removeConversations}
              onDeleteAll={removeAllConversations}
              onRename={renameConversation}
              onPin={pinConversation}
              onArchive={archiveConversation}
              onFavorite={favoriteConversation}
              onDuplicate={duplicateConversationById}
              onExport={exportConversation}
              onNewChat={() => { clearChat(); setShowSidebar(false); }}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main column ──────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* ── Top bar ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3.5 border-b border-border/50 bg-card/90 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="w-px h-5 bg-border" />
            {user && (
              <button onClick={() => setShowSidebar(v => !v)}
                className={`p-1.5 rounded-lg transition-colors ${showSidebar ? 'bg-gold/15 text-gold-dark' : 'hover:bg-secondary text-muted-foreground hover:text-foreground'}`}
                title="Conversation history">
                <PanelLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold">
                <Sparkles className="w-4 h-4 text-foreground" />
              </div>
              <div>
                <p className="text-sm font-display font-semibold text-foreground leading-tight">✨ Vowza Planner</p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {historyLoading ? <span className="animate-pulse">Loading…</span>
                    : isStreaming ? <span className="text-gold animate-pulse">Planning your event…</span>
                    : 'AI Event Planning Assistant'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button onClick={clearChat} title="New conversation"
                className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Context pills ───────────────────────────────────────────────── */}
        {ctxPills.length > 0 && (
          <div className="flex items-center gap-2 px-4 md:px-6 py-2 bg-gold/5 border-b border-gold/10 flex-wrap flex-shrink-0">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Remembering:</span>
            {ctxPills.map(p => (
              <span key={p} className="px-2.5 py-0.5 rounded-full bg-gold/15 text-gold-dark text-[11px] font-medium">{p}</span>
            ))}
          </div>
        )}

        {/* ── Messages area ───────────────────────────────────────────────── */}
        <div ref={containerRef} onScroll={handleScroll}
          className="flex-1 overflow-y-auto scroll-smooth scrollbar-thin">
          <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">

            {/* History loading skeleton */}
            {historyLoading && (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className={`flex gap-3 max-w-xl ${i % 2 === 0 ? 'ml-auto flex-row-reverse' : ''}`}>
                    <div className="w-8 h-8 rounded-xl skeleton flex-shrink-0" />
                    <div className={`h-14 rounded-2xl skeleton flex-1`} />
                  </div>
                ))}
              </div>
            )}

            {/* Empty welcome state */}
            {isEmpty && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center text-center gap-6 py-16">
                <div className="w-20 h-20 rounded-3xl bg-gradient-gold flex items-center justify-center shadow-gold">
                  <Sparkles className="w-10 h-10 text-foreground" />
                </div>
                <div className="max-w-md">
                  <h1 className="text-2xl font-display font-bold text-foreground mb-2">✨ Vowza Planner</h1>
                  <p className="text-muted-foreground leading-relaxed text-sm">
                    Your AI event planning expert. I'll instantly create budgets, timelines, checklists, decoration ideas, photography plans, and more — just tell me about your event.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">✓ No unnecessary questions</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold">✓ Real vendors only</span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-semibold">✓ Instant planning</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold">✓ Smart follow-ups</span>
                  </div>
                  {!user && (
                    <p className="text-sm text-muted-foreground/60 mt-3">
                      <a href="/auth" className="text-gold underline hover:text-gold-dark">Sign in</a> to save your conversation history across sessions.
                    </p>
                  )}
                </div>

                {/* Starter prompt grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-2xl mt-2">
                  {STARTER_PROMPTS.map(p => (
                    <button key={p.prompt} onClick={() => send(p.prompt)}
                      className="flex items-center gap-3 text-left px-4 py-3.5 rounded-2xl border border-border/60 bg-card hover:border-gold/40 hover:bg-gold/5 transition-all group shadow-sm">
                      <span className="text-2xl">{p.icon}</span>
                      <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground leading-tight">{p.label}</span>
                    </button>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground/50 mt-2">
                  Or type anything — e.g. "Plan a wedding for 300 guests in Hyderabad under ₹12 lakh"
                </p>
              </motion.div>
            )}

            {/* Messages */}
            {!historyLoading && messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id} msg={msg}
                isLast={idx === lastAssistantIdx}
                onEdit={editAndResend}
                onRegenerate={regenerateLastResponse}
                onReact={setMessageReaction}
              />
            ))}

            {/* Streaming bubble */}
            {isStreaming && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 max-w-3xl mr-auto min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-gold flex items-center justify-center flex-shrink-0 mt-1 shadow-gold">
                  <Sparkles className="w-4 h-4 text-foreground" />
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <span className="text-[11px] font-semibold text-muted-foreground px-1">✨ Vowza Planner</span>
                  <div className="bg-card border border-border/50 rounded-2xl rounded-tl-sm px-5 py-3.5 max-w-xl min-w-0">
                    {streamingText
                      ? <>
                          <MarkdownMessage text={streamingText} />
                          <StreamingCursor />
                        </>
                      : <TypingDots />}
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Scroll to bottom button */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="fixed bottom-28 right-4 md:right-10 w-9 h-9 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-secondary transition-colors z-10">
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Quick prompts strip ─────────────────────────────────────────── */}
        {messages.length > 0 && !isStreaming && (
          <div className="border-t border-border/30 flex-shrink-0">
            <div className="max-w-4xl mx-auto px-4 md:px-6 py-2 flex gap-2 overflow-x-auto no-scrollbar">
              {quickPrompts.slice(0, 6).map(qp => (
                <button key={qp.prompt} onClick={() => send(qp.prompt)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full border border-border/60 bg-card hover:border-gold/40 hover:bg-gold/5 transition-all text-xs text-muted-foreground hover:text-foreground whitespace-nowrap">
                  {qp.icon} {qp.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Input bar ───────────────────────────────────────────────────── */}
        <div className="border-t border-border/50 bg-card/90 backdrop-blur-sm flex-shrink-0 px-4 md:px-6 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-3 bg-secondary rounded-2xl px-4 py-3 border border-border/60 focus-within:border-gold/40 transition-colors shadow-sm">
              {/* Textarea */}
              <textarea ref={inputRef} value={input} onChange={handleChange} onKeyDown={handleKey}
                placeholder="Describe your dream event… e.g., Plan a wedding for 300 guests in Hyderabad under ₹10 lakh."
                rows={1} disabled={isStreaming || historyLoading}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none resize-none leading-relaxed py-0.5 min-h-[24px] max-h-[140px] disabled:opacity-50" />

              {/* Voice */}
              <button onClick={toggleVoice} title={isListening ? 'Stop' : 'Voice input'}
                className={`p-1.5 rounded-lg transition-colors flex-shrink-0 mb-0.5 ${isListening ? 'text-maroon animate-pulse' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Send */}
              <button onClick={handleSend} disabled={!input.trim() || isStreaming || historyLoading}
                className="w-9 h-9 rounded-xl bg-gradient-gold flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed shadow-gold">
                <Send className="w-4 h-4 text-foreground" />
              </button>
            </div>
            <p className="text-center text-[10px] text-muted-foreground/50 mt-2">
              Shift+Enter for new line · {user ? 'Conversations auto-saved' : 'Sign in to save history'}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AIPlanner;
