// ─── Conversation Repository ──────────────────────────────────────────────────
// All Supabase read/write for AI conversation persistence.
// Every method is safe to call for unauthenticated users — it returns
// empty/null gracefully rather than throwing, so the UI degrades silently
// to session-only memory when the user isn't signed in.

import { supabase } from '@/integrations/supabase/client';
import type { ChatMessage, AIResponse, PlannerContext } from './aiPlannerTypes';
import { rehydrateVerifiedDBVendors } from './ragRetriever';
import type {
  ConversationRow, MessageRow,
  ConversationInsert, ConversationUpdate, MessageInsert,
} from './conversationTypes';

// ─── Title generator ─────────────────────────────────────────────────────────
// Builds a smart, ChatGPT-style title from the extracted PlannerContext, e.g.
// "Wedding Hyderabad ₹8L", "Birthday 150 Guests", "Corporate Conference".
// Falls back to a truncated first message when context is too sparse.
function fmtBudgetShort(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(0)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: 'Wedding', reception: 'Reception', engagement: 'Engagement',
  haldi: 'Haldi', mehendi: 'Mehendi', sangeet: 'Sangeet',
  birthday: 'Birthday', babyshower: 'Baby Shower', housewarming: 'Housewarming',
  anniversary: 'Anniversary', corporate: 'Corporate', conference: 'Conference',
  productlaunch: 'Product Launch', exhibition: 'Exhibition', collegefest: 'College Fest',
  concert: 'Concert', djnight: 'DJ Night', fashionshow: 'Fashion Show',
  sportsEvent: 'Sports Event', temple: 'Temple Event', festival: 'Festival',
  charity: 'Charity Event', privateparty: 'Private Party',
};

function generateTitle(firstUserMessage: string, context?: PlannerContext): string {
  if (context) {
    const eventLabel = context.eventType ? EVENT_TYPE_LABELS[context.eventType] ?? context.eventType : null;
    const parts: string[] = [];
    if (eventLabel) parts.push(eventLabel);
    if (context.city) parts.push(context.city);
    if (context.budget) parts.push(fmtBudgetShort(context.budget));
    else if (context.guestCount) parts.push(`${context.guestCount} Guests`);

    if (parts.length >= 2) return parts.join(' ');
    if (eventLabel && context.guestCount) return `${eventLabel} ${context.guestCount} Guests`;
    if (eventLabel) return `${eventLabel} Planning`;
  }

  const clean = firstUserMessage.trim().replace(/\s+/g, ' ');
  return clean.length > 50 ? clean.slice(0, 47) + '…' : clean;
}

const SAVED_VENDOR_RESULTS_NOTICE =
  'Saved marketplace results were refreshed from Vowza before display. Availability should still be confirmed before booking.';

// ─── Row → ChatMessage converter ─────────────────────────────────────────────
export function rowToChatMessage(row: MessageRow): ChatMessage {
  // This synchronous converter is deliberately fail-closed for callers that do
  // not perform async revalidation. loadMessages() below restores live cards.
  const response = row.ai_response?.type === 'vendor_results'
    ? { ...row.ai_response, data: { ...row.ai_response.data, dbVendors: [] } }
    : row.ai_response ?? undefined;
  return {
    id:        row.id,
    role:      row.role,
    text:      row.ai_response?.type === 'vendor_results' ? SAVED_VENDOR_RESULTS_NOTICE : row.content,
    response,
    timestamp: new Date(row.created_at),
  };
}

async function rehydrateRowToChatMessage(row: MessageRow): Promise<ChatMessage> {
  if (row.ai_response?.type !== 'vendor_results') return rowToChatMessage(row);

  const dbVendors = await rehydrateVerifiedDBVendors(row.ai_response.data?.dbVendors ?? []);
  return {
    id: row.id,
    role: row.role,
    text: SAVED_VENDOR_RESULTS_NOTICE,
    response: {
      ...row.ai_response,
      text: SAVED_VENDOR_RESULTS_NOTICE,
      data: { ...row.ai_response.data, dbVendors },
    },
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
    title:           generateTitle(firstMessage, context),
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
  // Normalize: if DB doesn't have is_pinned/is_archived/is_favorite columns yet,
  // default them to false so the sidebar still renders correctly.
  return ((data as any[]) ?? []).map((row: any) => ({
    ...row,
    is_pinned:   row.is_pinned   ?? false,
    is_archived: row.is_archived ?? false,
    is_favorite: row.is_favorite ?? false,
  }));
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
  return await Promise.all(((data as unknown as MessageRow[]) ?? []).map((row) => rehydrateRowToChatMessage(row)));
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

// ─── Delete multiple conversations at once ────────────────────────────────────
export async function deleteConversations(conversationIds: string[]): Promise<void> {
  if (!conversationIds.length) return;
  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .in('id', conversationIds);

  if (error) {
    console.error('[ConversationRepository] deleteConversations:', error.message);
  }
}

// ─── Delete ALL conversations for a user ──────────────────────────────────────
export async function deleteAllConversations(userId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('[ConversationRepository] deleteAllConversations:', error.message);
  }
}

// ─── Pin / Unpin ───────────────────────────────────────────────────────────────
export async function setConversationPinned(conversationId: string, pinned: boolean): Promise<void> {
  const { error } = await supabase
    .from('ai_conversations')
    .update({ is_pinned: pinned } as any)
    .eq('id', conversationId);
  if (error) console.warn('[ConversationRepository] setConversationPinned — column may not exist yet:', error.message);
}

// ─── Archive / Restore ─────────────────────────────────────────────────────────
export async function setConversationArchived(conversationId: string, archived: boolean): Promise<void> {
  const { error } = await supabase
    .from('ai_conversations')
    .update({ is_archived: archived } as any)
    .eq('id', conversationId);
  if (error) console.warn('[ConversationRepository] setConversationArchived — column may not exist yet:', error.message);
}

// ─── Favorite / Unfavorite ──────────────────────────────────────────────────────
export async function setConversationFavorite(conversationId: string, favorite: boolean): Promise<void> {
  const { error } = await supabase
    .from('ai_conversations')
    .update({ is_favorite: favorite } as any)
    .eq('id', conversationId);
  if (error) console.warn('[ConversationRepository] setConversationFavorite — column may not exist yet:', error.message);
}

// ─── Duplicate a conversation (copies title + context + all messages) ──────────
export async function duplicateConversation(
  userId: string,
  source: ConversationRow
): Promise<string | null> {
  const insert: ConversationInsert = {
    user_id:         userId,
    title:           `${source.title} (Copy)`,
    context_summary: source.context_summary,
    last_active_at:  new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('ai_conversations')
    .insert(insert as any)
    .select('id')
    .single();

  if (error || !data) {
    console.error('[ConversationRepository] duplicateConversation (create):', error?.message);
    return null;
  }

  const newId = (data as any).id as string;
  const originalMessages = await loadMessages(source.id);

  for (const msg of originalMessages) {
    await saveMessage(newId, userId, msg.role, msg.text, msg.response);
  }

  return newId;
}

// ─── Export a conversation as a Markdown string ────────────────────────────────
// Pure client-side formatting — no network call. Caller is responsible for
// triggering the actual file download (see exportConversationAsFile below).
export function formatConversationAsMarkdown(
  conv: ConversationRow,
  messages: ChatMessage[]
): string {
  const lines: string[] = [
    `# ${conv.title}`,
    ``,
    `_Exported from Vowza Planner on ${new Date().toLocaleString()}_`,
    ``,
    `---`,
    ``,
  ];

  for (const msg of messages) {
    const speaker = msg.role === 'user' ? '**You**' : '**Vowza Planner**';
    const time = msg.timestamp instanceof Date
      ? msg.timestamp.toLocaleString()
      : new Date(msg.timestamp).toLocaleString();
    lines.push(`### ${speaker} · ${time}`);
    lines.push('');
    lines.push(msg.text);
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Trigger a browser download of the conversation as a .md file ──────────────
export function exportConversationAsFile(conv: ConversationRow, messages: ChatMessage[]): void {
  const markdown = formatConversationAsMarkdown(conv, messages);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${conv.title.replace(/[^\w\s-]/g, '').trim() || 'conversation'}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Touch last_active_at ─────────────────────────────────────────────────────
export async function touchConversation(conversationId: string): Promise<void> {
  await updateConversation(conversationId, { last_active_at: new Date().toISOString() });
}
