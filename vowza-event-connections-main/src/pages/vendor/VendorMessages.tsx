// VendorMessages — 100% real chats from messages table, grouped by booking.
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Search, Send, MessageSquare, CheckCheck, Check } from 'lucide-react';
import { useVendorId, useVendorRealtime, useVendorMessages } from '@/hooks/useVendorData';

export default function VendorMessages() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: provider } = useVendorId();
  const vendorId = provider?.id ?? null;
  useVendorRealtime(vendorId);

  const { data, isLoading } = useVendorMessages(vendorId);
  const chats = data?.chats ?? [];

  // Auto-select first chat
  useEffect(() => {
    if (!selectedId && chats.length > 0) setSelectedId(chats[0].bookingId);
  }, [chats, selectedId]);

  const selected = chats.find((c: any) => c.bookingId === selectedId) ?? null;

  // Scroll to newest message
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages?.length]);

  // Mark unread messages as read when a chat opens
  useEffect(() => {
    if (!selected || !user || selected.unread === 0) return;
    (async () => {
      await supabase.from('messages' as any)
        .update({ is_read: true })
        .eq('booking_id', selected.bookingId)
        .neq('sender_id', user.id)
        .eq('is_read', false);
      qc.invalidateQueries({ queryKey: ['vendor-messages'] });
    })();
  }, [selected?.bookingId, selected?.unread, user, qc]);

  const filtered = chats.filter((c: any) =>
    !search || (c.customer?.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const send = async () => {
    if (!draft.trim() || !selected || !user) return;
    setSending(true);
    const { error } = await supabase.from('messages' as any).insert({
      booking_id: selected.bookingId,
      sender_id:  user.id,
      content:    draft.trim(),
      is_read:    false,
    });
    if (error) toast.error(error.message);
    else {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['vendor-messages'] });
    }
    setSending(false);
  };

  return (
    <div className="h-[calc(100vh-8rem)] max-w-[1200px]">
      <div className="bg-white rounded-2xl border border-border/60 h-full flex overflow-hidden">

        {/* Chat list */}
        <div className={cn('border-r border-border/60 flex flex-col flex-shrink-0',
          'w-full md:w-[320px]', selected && 'hidden md:flex')}>
          <div className="p-4 border-b border-border/40">
            <h2 className="text-base font-bold text-foreground mb-3">Messages</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-border/60 bg-[#FAFAFA] text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-border/30 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 bg-muted rounded" />
                    <div className="h-3 w-36 bg-muted rounded" />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-sm font-medium text-foreground mb-1">No Conversations</p>
                <p className="text-xs text-muted-foreground">
                  Messages from customers appear here once they contact you about a booking.
                </p>
              </div>
            ) : filtered.map((chat: any) => {
              const name = chat.customer?.full_name ?? 'Customer';
              return (
                <button key={chat.bookingId} onClick={() => setSelectedId(chat.bookingId)}
                  className={cn('w-full flex items-center gap-3 px-4 py-3.5 border-b border-border/30 transition-colors text-left',
                    selectedId === chat.bookingId ? 'bg-[#8B1538]/5' : 'hover:bg-[#FAFAFA]')}>
                  {chat.customer?.avatar_url ? (
                    <img src={chat.customer.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8B1538] to-[#D4AF37] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {new Date(chat.lastAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{chat.lastMessage}</p>
                  </div>
                  {chat.unread > 0 && (
                    <span className="w-5 h-5 bg-[#8B1538] text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                      {chat.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat area */}
        <div className={cn('flex-col flex-1', selected ? 'flex' : 'hidden md:flex')}>
          {selected ? (
            <>
              <div className="px-5 py-3.5 border-b border-border/60 flex items-center gap-3">
                <button onClick={() => setSelectedId(null)} className="md:hidden text-sm text-muted-foreground">
                  ←
                </button>
                {selected.customer?.avatar_url ? (
                  <img src={selected.customer.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#8B1538] to-[#D4AF37] flex items-center justify-center text-white text-sm font-bold">
                    {(selected.customer?.full_name ?? 'C').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {selected.customer?.full_name ?? 'Customer'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {selected.messages.length} message{selected.messages.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {selected.messages.map((msg: any) => {
                  const mine = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[75%] px-4 py-2.5 rounded-2xl text-sm',
                        mine ? 'bg-[#8B1538] text-white rounded-br-md' : 'bg-secondary text-foreground rounded-bl-md')}>
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <div className={cn('flex items-center gap-1 mt-1', mine ? 'justify-end' : 'justify-start')}>
                          <span className={cn('text-[10px]', mine ? 'text-white/60' : 'text-muted-foreground')}>
                            {new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                          {mine && (msg.is_read
                            ? <CheckCheck className="w-3 h-3 text-white/70" />
                            : <Check className="w-3 h-3 text-white/50" />)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <div className="px-5 py-3 border-t border-border/60 flex items-center gap-3">
                <input value={draft} onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Type a message…"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border/60 bg-[#FAFAFA] text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
                <button onClick={send} disabled={sending || !draft.trim()}
                  className="p-2.5 rounded-xl bg-[#8B1538] text-white hover:bg-[#8B1538]/90 transition-colors disabled:opacity-40">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <MessageSquare className="w-14 h-14 text-muted-foreground/20 mb-4" />
              <p className="text-base font-semibold text-foreground mb-1">No Conversation Selected</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Select a conversation from the list to view and reply to messages.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
