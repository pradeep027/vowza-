// ─── Conversation Repository ──────────────────────────────────────────────────
// All Supabase read/write for AI conversation persistence.
// Every method is safe to call for unauthenticated users — it returns
// empty/null gracefully rather than throwing, so the UI degrades silently
// to session-only memory when the user isn't signed in.

import { supabase } from '@/integrations/supabase/client';
import type { ChatMessage, AIResponse, PlannerContext } from './aiPlannerTypes';
import type {
  ConversationRow, MessageRow,
  ConversationInsert, ConversationUpdate, MessageInsert,
} from './conversationTypes';

// ─── Title generator ─────────────────────────────────────────────────────────
// Derives a short title from the first user message (≤ 50 chars).
function generateTitle(firstUserMessage: string): string {
  const clean = firstUserMessage.trim().replace(/\s+/g, ' ');
  return clean.length > 50 ? clean.slice(0, 47) + '…' : clean;
}

// ─── Row → ChatMessage converter ─────────────────────────────────────────────
export function rowToChatMessage(row: MessageRow): ChatMessage {
  return {
    id:        row.id,
    role:      row.role,
    text:      row.content,
    response:  row.ai_response ?? undefined,
    timestamp: new Date(row.created_at),
  };
}

// ─── Create a new conversation ────────────────────────────────────────────────
export async function createConversation(
  userId: string,
  firstMessage: string,
  context: PlannerContext
): Promise<string | null> {
  const insert: ConversationInsert = {
    user_id:         userId,
    title:           generateTitle(firstMessage),
    context_summary: context,
    last_active_at:  new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('ai_conversations')
    .insert(insert as any)
    .select('id')
    .single();

  if (error) {
    console.error('[ConversationRepository] createConversation:', error.message);
    return null;
  }
  return (data as any)?.id ?? null;
}

// ─── Update conversation metadata ─────────────────────────────────────────────
export async function updateConversation(
  conversationId: string,
  updates: ConversationUpdate
): Promise<void> {
  const { error } = await supabase
    .from('ai_conversations')
    .update({ ...updates } as any)
    .eq('id', conversationId);

  if (error) {
    console.error('[ConversationRepository] updateConversation:', error.message);
  }
}

// ─── List conversations for a user (max 50, ordered by recency) ───────────────
export async function listConversations(userId: string): Promise<ConversationRow[]> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('last_active_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[ConversationRepository] listConversations:', error.message);
    return [];
  }
  return (data as any[]) ?? [];
}

// ─── Load messages for a conversation ─────────────────────────────────────────
export async function loadMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[ConversationRepository] loadMessages:', error.message);
    return [];
  }
  return ((data as any[]) ?? []).map(rowToChatMessage);
}

// ─── Save a single message ────────────────────────────────────────────────────
export async function saveMessage(
  conversationId: string,
  userId:         string,
  role:           'user' | 'assistant',
  content:        string,
  aiResponse?:    AIResponse
): Promise<string | null> {
  const insert: MessageInsert = {
    conversation_id: conversationId,
    user_id:         userId,
    role,
    content,
    ai_response:     aiResponse ?? null,
  };

  const { data, error } = await supabase
    .from('ai_messages')
    .insert(insert as any)
    .select('id')
    .single();

  if (error) {
    console.error('[ConversationRepository] saveMessage:', error.message);
    return null;
  }
  return (data as any)?.id ?? null;
}

// ─── Update a message's content (for edit/regenerate) ─────────────────────────
export async function updateMessage(
  messageId: string,
  content:   string,
  aiResponse?: AIResponse
): Promise<void> {
  const updates: any = { content };
  if (aiResponse !== undefined) updates.ai_response = aiResponse;

  const { error } = await supabase
    .from('ai_messages')
    .update(updates)
    .eq('id', messageId);

  if (error) {
    console.error('[ConversationRepository] updateMessage:', error.message);
  }
}

// ─── Delete a conversation and all its messages (cascade) ─────────────────────
export async function deleteConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', conversationId);

  if (error) {
    console.error('[ConversationRepository] deleteConversation:', error.message);
  }
}

// ─── Touch last_active_at ─────────────────────────────────────────────────────
export async function touchConversation(conversationId: string): Promise<void> {
  await updateConversation(conversationId, { last_active_at: new Date().toISOString() });
}
