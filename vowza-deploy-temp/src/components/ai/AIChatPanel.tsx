// ─── AI Chat Panel — Phase 2 Production Version ──────────────────────────────
// Full ChatGPT-style panel with:
//  • Persistent conversation history (Supabase)
//  • Conversation sidebar (switch / rename / delete)
//  • Message edit + regenerate
//  • Streaming responses with typing animation
//  • Voice input (Web Speech API)
//  • Markdown rendering
//  • Context pills (event details remembered)

import { useState, useRef, useEffect, useCallback } from 'react';
import VowzaIcon from '@/components/VowzaIcon';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Send, Mic, MicOff, Paperclip,
  RotateCcw, ChevronDown, Check, Copy, PanelLeft,
  Pencil, RefreshCw, ThumbsUp, ThumbsDown, Share2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAIChat } from './useAIChat';
import MarkdownMessage from './MarkdownMessage';
import AIResponseCards from './AIResponseCards';
import ConversationSidebar from './ConversationSidebar';
import type { ChatMessage } from '@/lib/aiPlannerTypes';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  isOpen:              boolean;
  onClose:             () => void;
  prefillQuery?:       string;
  onPrefillConsumed?:  () => void;
}

// ─── Typing animation dots ────────────────────────────────────────────────────
const TypingDots = () => (
  <div className="flex items-center gap-1.5 px-1.5 py-1">
    {[0, 1, 2].map(i => (
      <motion.span
        key={i}
        className="w-2 h-2 rounded-full bg-gradient-gold"
        animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }}
      />
    ))}
  </div>
);

// ─── Blinking cursor shown at the end of streaming text ───────────────────────
const StreamingCursor = () => (
  <span className="inline-block w-[2px] h-4 bg-gold ml-0.5 align-middle animate-blink-cursor" />
);

// ─── Single message bubble ────────────────────────────────────────────────────
const MessageBubble = ({
  msg,
  onEdit,
  onRegenerate,
  onReact,
  isLast,
}: {
  msg:           ChatMessage;
  onEdit:        (id: string, text: string) => void;
  onRegenerate:  () => void;
  onReact:       (id: string, reaction: 'like' | 'dislike') => void;
  isLast:        boolean;
}) => {
  const [copied,    setCopied]    = useState(false);
  const [editing,   setEditing]   = useState(false);
  const [editText,  setEditText]  = useState(msg.text);
  const isUser = msg.role === 'user';

  const copyText = () => {
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

  const commitEdit = () => {
    if (editText.trim() && editText !== msg.text) {
      onEdit(msg.id, editText.trim());
    }
    setEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={`flex gap-2.5 group ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
        ${isUser
          ? 'bg-royal/20 text-royal'
          : 'bg-gradient-gold text-foreground shadow-gold'}`}>
        {isUser ? <span className="text-xs font-bold">U</span> : <VowzaIcon className="w-3.5 h-3.5" />}
      </div>

      <div className={`flex flex-col gap-1 max-w-[85%] min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Bubble */}
        {editing ? (
          <div className="w-full">
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); } if (e.key === 'Escape') setEditing(false); }}
              className="w-full text-sm bg-secondary border border-gold/40 rounded-xl px-3 py-2 focus:outline-none resize-none text-foreground"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 mt-1.5 justify-end">
              <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-secondary transition-colors">
                Cancel
              </button>
              <button onClick={commitEdit} className="text-xs bg-gold text-foreground px-3 py-1 rounded-lg hover:opacity-90 transition-opacity font-medium">
                Send
              </button>
            </div>
          </div>
        ) : (
          <div className={`rounded-2xl px-4 py-3 text-sm shadow-sm
            ${isUser
              ? 'bg-gradient-to-br from-royal to-royal/80 text-white rounded-tr-sm'
              : 'bg-card border border-border/60 text-foreground rounded-tl-sm'}`}>
            <MarkdownMessage text={msg.text} />
          </div>
        )}

        {/* Structured response cards */}
        {!editing && msg.response && msg.response.type !== 'text' && msg.response.data && (
          <AIResponseCards response={msg.response} />
        )}

        {/* Actions row — visible on hover */}
        {!editing && (
          <div className={`flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity
            ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-[10px] text-muted-foreground">
              {msg.timestamp instanceof Date
                ? msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>

            {/* Copy — assistant only */}
            {!isUser && (
              <button onClick={copyText} title="Copy"
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary">
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            )}

            {/* Like / Dislike — assistant only */}
            {!isUser && (
              <>
                <button onClick={() => onReact(msg.id, 'like')} title="Good response"
                  className={`transition-colors p-1 rounded-md hover:bg-secondary ${
                    msg.reaction === 'like' ? 'text-emerald-500' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  <ThumbsUp className={`w-3 h-3 ${msg.reaction === 'like' ? 'fill-emerald-500' : ''}`} />
                </button>
                <button onClick={() => onReact(msg.id, 'dislike')} title="Bad response"
                  className={`transition-colors p-1 rounded-md hover:bg-secondary ${
                    msg.reaction === 'dislike' ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  <ThumbsDown className={`w-3 h-3 ${msg.reaction === 'dislike' ? 'fill-red-500' : ''}`} />
                </button>
                <button onClick={shareMessage} title="Share"
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary">
                  <Share2 className="w-3 h-3" />
                </button>
              </>
            )}

            {/* Edit — user only */}
            {isUser && (
              <button onClick={() => { setEditing(true); setEditText(msg.text); }} title="Edit message"
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary">
                <Pencil className="w-3 h-3" />
              </button>
            )}

            {/* Regenerate — last assistant message only */}
            {!isUser && isLast && (
              <button onClick={onRegenerate} title="Regenerate response"
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary">
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── Main panel ───────────────────────────────────────────────────────────────
const AIChatPanel = ({ isOpen, onClose, prefillQuery, onPrefillConsumed }: Props) => {
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

  const [input,          setInput]          = useState('');
  const [isListening,    setIsListening]    = useState(false);
  const [showScrollBtn,  setShowScrollBtn]  = useState(false);
  const [showSidebar,    setShowSidebar]    = useState(false);

  const messagesEndRef       = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef             = useRef<HTMLTextAreaElement>(null);
  const recognitionRef       = useRef<any>(null);

  // Auto-scroll when new messages or streaming text arrive
  useEffect(() => {
    if (!showScrollBtn) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingText, showScrollBtn]);

  // Focus input on panel open
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  // When opened from Hero "Vowza Planner" button — auto-send the prefill query
  useEffect(() => {
    if (isOpen && prefillQuery && !isStreaming) {
      const timer = setTimeout(() => {
        send(prefillQuery);
        onPrefillConsumed?.();
      }, 400); // small delay so panel animation completes first
      return () => clearTimeout(timer);
    }
  }, [isOpen, prefillQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  }, []);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto';
    send(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  // Voice input via Web Speech API
  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = 'en-IN';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setInput(prev => prev + (prev ? ' ' : '') + t);
      setIsListening(false);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend   = () => setIsListening(false);
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  };

  // Context pills
  const ctxPills = [
    context.eventType  && `${context.eventType}`,
    context.city       && `📍 ${context.city}`,
    context.budget     && `💰 ₹${(context.budget / 100000).toFixed(1)}L`,
    context.guestCount && `👥 ${context.guestCount} guests`,
  ].filter(Boolean) as string[];

  const isEmpty = messages.length === 0 && !isStreaming && !historyLoading;

  // Index of the last assistant message (for regenerate button)
  const lastAssistantIdx = messages.reduce((acc, m, i) => m.role === 'assistant' ? i : acc, -1);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[49] md:hidden"
            onClick={onClose}
          />

          {/* Panel wrapper */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed z-50
              bottom-0 left-0 right-0 h-[92dvh]
              md:bottom-24 md:right-6 md:left-auto md:h-[680px]
              md:w-[440px] lg:w-[500px]
              bg-background border border-border/60 rounded-t-3xl md:rounded-2xl
              shadow-2xl flex overflow-hidden"
          >
            {/* ── Mobile-only backdrop so the sidebar overlays instead of squeezing chat (md+ untouched) ── */}
            <AnimatePresence>
              {showSidebar && user && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 z-10 bg-black/40 md:hidden"
                  onClick={() => setShowSidebar(false)}
                />
              )}
            </AnimatePresence>

            {/* ── Conversation sidebar (slides in) ──────────────────────── */}
            <AnimatePresence>
              {showSidebar && user && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 240, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="absolute inset-y-0 left-0 z-20 md:relative md:z-auto flex-shrink-0 overflow-hidden"
                  style={{ width: 240 }}
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
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Main chat column ───────────────────────────────────────── */}
            <div className="flex flex-col flex-1 min-w-0">

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/50 bg-card/80 backdrop-blur-sm flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  {/* Sidebar toggle — only for logged-in users */}
                  {user && (
                    <button
                      onClick={() => setShowSidebar(v => !v)}
                      title="Conversation history"
                      className={`p-1.5 rounded-lg transition-colors ${
                        showSidebar ? 'bg-gold/20 text-gold-dark' : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <PanelLeft className="w-4 h-4" />
                    </button>
                  )}
                  <div className="w-8 h-8 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold">
                    <VowzaIcon className="w-4 h-4 text-foreground" />
                  </div>
                  <div>
                    <p className="font-display font-semibold text-sm text-foreground leading-tight">✨ Vowza Planner</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      {historyLoading ? (
                        <span className="text-muted-foreground animate-pulse">Loading history…</span>
                      ) : isStreaming ? (
                        <span className="text-gold animate-pulse">Planning your event…</span>
                      ) : (
                        'AI Event Planning Assistant · Always here'
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <button onClick={clearChat} title="New chat"
                      className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={onClose}
                    className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Context pills */}
              {ctxPills.length > 0 && (
                <div className="flex items-center gap-1.5 px-4 py-2 bg-gold/5 border-b border-gold/10 flex-wrap flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground font-medium">Remembering:</span>
                  {ctxPills.map(pill => (
                    <span key={pill}
                      className="px-2 py-0.5 rounded-full bg-gold/15 text-gold-dark text-[10px] font-medium">
                      {pill}
                    </span>
                  ))}
                </div>
              )}

              {/* History loading skeleton */}
              {historyLoading && (
                <div className="flex flex-col gap-4 px-4 py-5">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`flex gap-2.5 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
                      <div className="w-7 h-7 rounded-full skeleton flex-shrink-0" />
                      <div className={`h-12 rounded-2xl skeleton ${i % 2 === 0 ? 'w-2/3' : 'w-3/4'}`} />
                    </div>
                  ))}
                </div>
              )}

              {/* Messages area */}
              {!historyLoading && (
                <div
                  ref={messagesContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 space-y-5 scroll-smooth scrollbar-thin"
                >
                  {/* Empty state */}
                  {isEmpty && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="h-full flex flex-col items-center justify-center text-center gap-4 pb-4 min-h-[300px]"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-gradient-gold flex items-center justify-center shadow-gold">
                        <VowzaIcon className="w-8 h-8 text-foreground" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-lg text-foreground">✨ Vowza Planner</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-[280px] leading-relaxed">
                          Your personal AI event planning assistant. Describe your dream event and I'll build a complete plan — vendors, budget, timeline, and more.
                        </p>
                        {!user && (
                          <p className="text-[11px] text-muted-foreground/60 mt-2">
                            <a href="/auth" className="text-gold underline hover:text-gold-dark">Sign in</a> to save your conversation history.
                          </p>
                        )}
                      </div>
                      {/* Quick prompt grid */}
                      <div className="grid grid-cols-2 gap-2 w-full mt-2">
                        {quickPrompts.slice(0, 6).map(qp => (
                          <button
                            key={qp.prompt}
                            onClick={() => send(qp.prompt)}
                            className="text-left px-3 py-2.5 rounded-xl border border-border/60 bg-card hover:border-gold/40 hover:bg-gold/5 transition-all text-xs group"
                          >
                            <span className="text-base mr-1.5">{qp.icon}</span>
                            <span className="text-foreground/80 group-hover:text-foreground font-medium leading-tight">
                              {qp.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Message list */}
                  {messages.map((msg, idx) => (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      isLast={idx === lastAssistantIdx}
                      onEdit={editAndResend}
                      onRegenerate={regenerateLastResponse}
                      onReact={setMessageReaction}
                    />
                  ))}

                  {/* Streaming bubble */}
                  {isStreaming && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-2.5"
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-gold flex items-center justify-center flex-shrink-0 mt-0.5 shadow-gold">
                        <VowzaIcon className="w-3.5 h-3.5 text-foreground" />
                      </div>
                      <div className="bg-card border border-border/60 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] min-w-0">
                        {streamingText
                          ? <>
                              <MarkdownMessage text={streamingText} />
                              <StreamingCursor />
                            </>
                          : <TypingDots />}
                      </div>
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}

              {/* Scroll-to-bottom button */}
              <AnimatePresence>
                {showScrollBtn && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    className="absolute bottom-20 right-4 w-8 h-8 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-secondary transition-colors z-10"
                  >
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Quick prompts row (shown when messages exist) */}
              {messages.length > 0 && !isStreaming && (
                <div className="flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-none flex-shrink-0">
                  {quickPrompts.slice(0, 5).map(qp => (
                    <button
                      key={qp.prompt}
                      onClick={() => send(qp.prompt)}
                      className="flex-shrink-0 px-3 py-1.5 rounded-full border border-border/60 bg-card hover:border-gold/40 hover:bg-gold/5 transition-all text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
                    >
                      {qp.icon} {qp.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Input bar */}
              <div className="px-3 pb-3 pt-2 border-t border-border/50 bg-card/80 flex-shrink-0">
                <div className="flex items-end gap-2 bg-secondary rounded-2xl px-3 py-2 border border-border/60 focus-within:border-gold/40 transition-colors">
                  {/* Attach placeholder */}
                  <button
                    title="Attach file (coming soon)"
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mb-0.5 opacity-50 cursor-not-allowed"
                    disabled
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  {/* Auto-grow textarea */}
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe your dream event… e.g., Plan a wedding for 300 guests in Hyderabad under ₹10 lakh."
                    rows={1}
                    disabled={isStreaming || historyLoading}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed py-0.5 min-h-[24px] max-h-[120px] disabled:opacity-50"
                    style={{ height: 'auto' }}
                  />

                  {/* Voice */}
                  <button
                    onClick={toggleVoice}
                    title={isListening ? 'Stop listening' : 'Voice input'}
                    className={`p-1 transition-colors flex-shrink-0 mb-0.5 ${
                      isListening ? 'text-maroon animate-pulse' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  {/* Send */}
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isStreaming || historyLoading}
                    className="w-8 h-8 rounded-xl bg-gradient-gold flex items-center justify-center flex-shrink-0
                      hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed shadow-gold"
                  >
                    <Send className="w-3.5 h-3.5 text-foreground" />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                  Shift+Enter for new line
                  {user ? ' · Conversations auto-saved' : ' · Sign in to save history'}
                </p>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AIChatPanel;
