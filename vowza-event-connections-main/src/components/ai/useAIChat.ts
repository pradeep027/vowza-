// ─── AI Chat Hook — Production Version ───────────────────────────────────────
// Adds full DB persistence on top of the existing streaming + context layer.
//
// Behaviour:
//  • Authenticated users  → history persisted to Supabase, restored on mount
//  • Unauthenticated users → session-only memory (sessionStorage context only)
//
// Conversation lifecycle:
//  1. First message sent → createConversation() → conversationId stored
//  2. Every message → saveMessage() to DB
//  3. Panel opens with an existing conversationId → loadMessages() restores history
//  4. User switches conversation → loadConversation() replaces message list
//  5. User deletes conversation → deleteConversation() + reset state

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { sendMessage } from '@/lib/llm';
import { QUICK_PROMPTS } from '@/lib/aiPlanner';
import type { ChatMessage, PlannerContext } from '@/lib/aiPlannerTypes';
import {
  createConversation, loadMessages, saveMessage, updateMessage,
  updateConversation, deleteConversation, touchConversation, listConversations,
  deleteConversations, deleteAllConversations, setConversationPinned, setConversationArchived,
  setConversationFavorite, duplicateConversation, exportConversationAsFile,
} from '@/lib/conversationRepository';
import type { ConversationRow } from '@/lib/conversationTypes';
import { useDashboardLink } from '@/hooks/useDashboardLink';

// ─── sessionStorage keys ─────────────────────────────────────────────────────
const CTX_KEY  = 'vowza_ai_context';
const CONV_KEY = 'vowza_ai_conv_id';

// ─── Navigation command detector ─────────────────────────────────────────────
const NAV_COMMANDS: { pattern: RegExp; path: string }[] = [
  { pattern: /artist.*registr|join.*artist|become.*artist/i, path: '/provider/register' },
  { pattern: /browse.*artist|find.*artist|show.*artist|search.*artist/i, path: '/artists' },
  { pattern: /photographer/i, path: '/artists?category=photographers' },
  { pattern: /decorator/i, path: '/artists?category=decorators' },
  { pattern: /\bdj\b/i, path: '/artists?category=dj' },
  { pattern: /makeup/i, path: '/artists?category=makeup' },
  { pattern: /my booking/i, path: '/my-bookings' },
  { pattern: /dashboard/i, path: '' },  // resolved dynamically below
  { pattern: /^(home|homepage)$/i, path: '/' },
];

function detectNavCommand(msg: string): string | null {
  if (!/(take me|go to|open|navigate|show me|visit)/i.test(msg)) return null;
  for (const cmd of NAV_COMMANDS) {
    if (cmd.pattern.test(msg)) return cmd.path;
  }
  return null;
}

// ─── sessionStorage helpers ───────────────────────────────────────────────────
function loadContext(): PlannerContext {
  try { return JSON.parse(sessionStorage.getItem(CTX_KEY) ?? '{}'); } catch { return {}; }
}
function saveContext(ctx: PlannerContext) {
  try { sessionStorage.setItem(CTX_KEY, JSON.stringify(ctx)); } catch { /* quota */ }
}
function loadConvId(): string | null {
  return sessionStorage.getItem(CONV_KEY);
}
function saveConvId(id: string | null) {
  if (id) sessionStorage.setItem(CONV_KEY, id);
  else sessionStorage.removeItem(CONV_KEY);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAIChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { dashboardLink } = useDashboardLink();

  const [messages,        setMessages]        = useState<ChatMessage[]>([]);
  const [isStreaming,     setIsStreaming]      = useState(false);
  const [streamingText,   setStreamingText]    = useState('');
  const [context,         setContext]          = useState<PlannerContext>(loadContext);
  const [conversationId,  setConversationId]   = useState<string | null>(loadConvId);
  const [conversations,   setConversations]    = useState<ConversationRow[]>([]);
  const [historyLoading,  setHistoryLoading]   = useState(false);
  const abortRef     = useRef(false);
  // ─── Keep a ref that always holds the latest messages array ─────────────────
  // This fixes the closure stale-state bug where send() saw an outdated history.
  const messagesRef  = useRef<ChatMessage[]>([]);
  const contextRef   = useRef<PlannerContext>(loadContext());
  const convIdRef    = useRef<string | null>(loadConvId());

  // Keep refs in sync with state
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { contextRef.current  = context;  }, [context]);
  useEffect(() => { convIdRef.current   = conversationId; }, [conversationId]);

  // ── On mount: restore conversation from DB if user is logged in ─────────────
  useEffect(() => {
    if (!user) return;

    const storedId = loadConvId();

    // Load conversation list for the sidebar
    listConversations(user.id).then(setConversations);

    // Restore last active conversation
    if (storedId) {
      setHistoryLoading(true);
      loadMessages(storedId).then(msgs => {
        messagesRef.current = msgs;
        setMessages(msgs);
        setHistoryLoading(false);
      });
    }
  }, [user?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load a specific conversation (called from sidebar) ──────────────────────
  const loadConversation = useCallback(async (conv: ConversationRow) => {
    setHistoryLoading(true);
    const msgs = await loadMessages(conv.id);
    messagesRef.current = msgs;
    setMessages(msgs);
    convIdRef.current = conv.id;
    setConversationId(conv.id);
    saveConvId(conv.id);
    if (conv.context_summary) {
      contextRef.current = conv.context_summary;
      setContext(conv.context_summary);
      saveContext(conv.context_summary);
    }
    setHistoryLoading(false);
  }, []);

  // ── Refresh sidebar conversation list ────────────────────────────────────────
  const refreshConversations = useCallback(async () => {
    if (!user) return;
    const list = await listConversations(user.id);
    setConversations(list);
  }, [user]);

  // ── Delete a conversation ────────────────────────────────────────────────────
  const removeConversation = useCallback(async (convId: string) => {
    await deleteConversation(convId);
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (conversationId === convId) {
      setMessages([]);
      setConversationId(null);
      saveConvId(null);
    }
  }, [conversationId]);

  // ── Rename a conversation ────────────────────────────────────────────────────
  const renameConversation = useCallback(async (convId: string, title: string) => {
    await updateConversation(convId, { title });
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, title } : c));
  }, []);

  // ── Delete multiple conversations (with confirmation handled by the UI) ─────
  const removeConversations = useCallback(async (convIds: string[]) => {
    await deleteConversations(convIds);
    setConversations(prev => prev.filter(c => !convIds.includes(c.id)));
    if (conversationId && convIds.includes(conversationId)) {
      setMessages([]);
      setConversationId(null);
      saveConvId(null);
    }
  }, [conversationId]);

  // ── Delete ALL conversations for the current user ────────────────────────────
  const removeAllConversations = useCallback(async () => {
    if (!user) return;
    await deleteAllConversations(user.id);
    setConversations([]);
    setMessages([]);
    setConversationId(null);
    saveConvId(null);
  }, [user]);

  // ── Pin / Unpin ───────────────────────────────────────────────────────────────
  const pinConversation = useCallback(async (convId: string, pinned: boolean) => {
    await setConversationPinned(convId, pinned);
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, is_pinned: pinned } : c));
  }, []);

  // ── Archive / Restore ─────────────────────────────────────────────────────────
  const archiveConversation = useCallback(async (convId: string, archived: boolean) => {
    await setConversationArchived(convId, archived);
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, is_archived: archived } : c));
  }, []);

  // ── Favorite / Unfavorite ─────────────────────────────────────────────────────
  const favoriteConversation = useCallback(async (convId: string, favorite: boolean) => {
    await setConversationFavorite(convId, favorite);
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, is_favorite: favorite } : c));
  }, []);

  // ── Duplicate a conversation ──────────────────────────────────────────────────
  const duplicateConversationById = useCallback(async (convId: string) => {
    if (!user) return;
    const source = conversations.find(c => c.id === convId);
    if (!source) return;
    const newId = await duplicateConversation(user.id, source);
    if (newId) await refreshConversations();
  }, [user, conversations, refreshConversations]);

  // ── Export a conversation as a downloadable Markdown file ───────────────────
  const exportConversation = useCallback(async (convId: string) => {
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;
    const msgs = convId === conversationId ? messagesRef.current : await loadMessages(convId);
    exportConversationAsFile(conv, msgs);
  }, [conversations, conversationId]);

  // ── Main send ────────────────────────────────────────────────────────────────
  const send = useCallback(async (userText: string) => {
    if (!userText.trim() || isStreaming) return;
    abortRef.current = false;

    // Use refs to get current values — avoids stale closure bug
    const currentMessages = messagesRef.current;
    const currentContext  = contextRef.current;
    let   currentConvId   = convIdRef.current;

    // Navigation shortcut — handle before touching DB
    const navPath = (() => {
      if (!/(take me|go to|open|navigate|show me|visit)/i.test(userText)) return null;
      for (const cmd of NAV_COMMANDS) {
        if (!cmd.path) continue; // skip dashboard placeholder
        if (cmd.pattern.test(userText)) return cmd.path;
      }
      // Dashboard resolved dynamically from roles
      if (/dashboard/i.test(userText)) return dashboardLink;
      return null;
    })();
    const userMsg: ChatMessage = {
      id:        `u-${Date.now()}`,
      role:      'user',
      text:      userText,
      timestamp: new Date(),
    };
    // Add user message and update ref immediately
    messagesRef.current = [...currentMessages, userMsg];
    setMessages(messagesRef.current);

    if (navPath) {
      const navReply: ChatMessage = {
        id:        `a-${Date.now()}`,
        role:      'assistant',
        text:      `Sure! Taking you there now... 🚀`,
        timestamp: new Date(),
      };
      messagesRef.current = [...messagesRef.current, navReply];
      setMessages(messagesRef.current);
      setTimeout(() => navigate(navPath), 600);
      return;
    }

    // ── Ensure a conversation exists in DB ────────────────────────────────────
    if (!currentConvId && user) {
      const newId = await createConversation(user.id, userText, currentContext);
      if (newId) {
        currentConvId = newId;
        convIdRef.current = newId;
        setConversationId(newId);
        saveConvId(newId);
        refreshConversations();
      }
    }

    // Save user message to DB
    if (currentConvId && user) {
      saveMessage(currentConvId, user.id, 'user', userText);
    }

    // ── Stream AI response ────────────────────────────────────────────────────
    setIsStreaming(true);
    setStreamingText('');
    let accumulated = '';
    let finalAIResponse: any = null;
    let finalContext: PlannerContext = currentContext;

    try {
      // ── IMPORTANT: onChunk fires synchronously INSIDE sendMessage ──────────
      // We must NOT reference `result` inside onChunk because `result` is still
      // in the Temporal Dead Zone (TDZ) when onChunk fires with done:true.
      // All data we need (fullText, aiResponse, updatedContext) is captured
      // via the `accumulated` local variable and via the returned promise.
      await sendMessage({
        message: userText,
        history: currentMessages,
        context: currentContext,
        onChunk: ({ delta, done }) => {
          if (abortRef.current) return;
          if (!done) {
            accumulated += delta;
            setStreamingText(accumulated);
          }
          // Do NOT use `result` here — it doesn't exist yet (TDZ).
          // We handle the final message AFTER the await resolves below.
        },
      }).then(res => {
        // This runs after sendMessage fully resolves — result is safe to use here.
        finalAIResponse = res.aiResponse;
        finalContext     = res.updatedContext;
        // Use accumulated text (what was streamed) — fall back to res.fullText only
        // if streaming somehow produced nothing (e.g. very fast deterministic reply).
        const finalText = accumulated || res.fullText;

        setStreamingText('');
        const assistantMsg: ChatMessage = {
          id:        `a-${Date.now()}`,
          role:      'assistant',
          text:      finalText,
          response:  res.aiResponse,
          timestamp: new Date(),
        };
        messagesRef.current = [...messagesRef.current, assistantMsg];
        setMessages(messagesRef.current);
        setIsStreaming(false);

        // Persist to DB
        if (currentConvId && user) {
          saveMessage(currentConvId, user.id, 'assistant', finalText, res.aiResponse);
          touchConversation(currentConvId);
          updateConversation(currentConvId, { context_summary: res.updatedContext });
        }

        // Update context ref and state
        contextRef.current = res.updatedContext;
        setContext(res.updatedContext);
        saveContext(res.updatedContext);
      });

    } catch (err: any) {
      setStreamingText('');
      setIsStreaming(false);
      const errMsg: ChatMessage = {
        id:        `e-${Date.now()}`,
        role:      'assistant',
        text:      `Sorry, I ran into an issue. Please try again. 🙏\n\n_${err?.message ?? 'Unknown error'}_`,
        timestamp: new Date(),
      };
      messagesRef.current = [...messagesRef.current, errMsg];
      setMessages(messagesRef.current);
    }
  }, [isStreaming, user, navigate, refreshConversations]);

  // ── Edit + regenerate ─────────────────────────────────────────────────────────
  const editAndResend = useCallback(async (messageId: string, newText: string) => {
    const idx = messagesRef.current.findIndex(m => m.id === messageId);
    if (idx !== -1) {
      messagesRef.current = messagesRef.current.slice(0, idx);
      setMessages(messagesRef.current);
    }
    if (convIdRef.current && user && !messageId.startsWith('u-')) {
      updateMessage(messageId, newText);
    }
    await send(newText);
  }, [send, user]);

  const regenerateLastResponse = useCallback(async () => {
    const lastUser = [...messagesRef.current].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    const idx = messagesRef.current.findIndex(m => m.id === lastUser.id);
    if (idx !== -1) {
      messagesRef.current = messagesRef.current.slice(0, idx);
      setMessages(messagesRef.current);
    }
    await send(lastUser.text);
  }, [send]);

  // ── Clear ─────────────────────────────────────────────────────────────────────
  // "New Chat" must start with ZERO memory — no leftover event type, city,
  // budget, guest count, etc. from the previous conversation. That memory is
  // scoped to a single conversation only; it is never carried into a new one.
  const clearChat = useCallback(() => {
    messagesRef.current = [];
    setMessages([]);
    setStreamingText('');
    setIsStreaming(false);
    convIdRef.current = null;
    setConversationId(null);
    saveConvId(null);
    abortRef.current = true;

    // Reset planning context (event type, city, budget, guests, theme, etc.)
    contextRef.current = {};
    setContext({});
    sessionStorage.removeItem(CTX_KEY);
  }, []);

  const clearContext = useCallback(() => {
    setContext({});
    sessionStorage.removeItem(CTX_KEY);
  }, []);

  return {
    messages,
    isStreaming,
    streamingText,
    context,
    conversationId,
    conversations,
    historyLoading,
    send,
    editAndResend,
    regenerateLastResponse,
    clearChat,
    clearContext,
    loadConversation,
    removeConversation,
    removeConversations,
    removeAllConversations,
    renameConversation,
    pinConversation,
    archiveConversation,
    favoriteConversation,
    duplicateConversationById,
    exportConversation,
    refreshConversations,
    quickPrompts: QUICK_PROMPTS,
  };
}
