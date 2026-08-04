// VendorMessages — Premium chat list with unread indicators
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Search, Send, Paperclip, Sparkles, Check, CheckCheck } from 'lucide-react';

interface Chat {
  id: string; name: string; avatar?: string; lastMessage: string;
  time: string; unread: number; online: boolean;
}

const chats: Chat[] = [
  { id: '1', name: 'Rahul Sharma', lastMessage: 'Can we discuss the wedding timeline?', time: '2m ago', unread: 3, online: true },
  { id: '2', name: 'Priya Reddy', lastMessage: 'Thanks! The photos look amazing', time: '15m ago', unread: 0, online: true },
  { id: '3', name: 'Ankit Gupta', lastMessage: 'Please share the revised quote', time: '1h ago', unread: 1, online: false },
  { id: '4', name: 'Meera Joshi', lastMessage: 'Looking forward to the shoot!', time: '3h ago', unread: 0, online: false },
  { id: '5', name: 'Vikram Patel', lastMessage: 'Is 5th Aug available for you?', time: 'Yesterday', unread: 2, online: true },
];

const messages = [
  { id: '1', sender: 'customer', text: 'Hi! I loved your portfolio. Are you available for a wedding on Aug 15?', time: '10:30 AM' },
  { id: '2', sender: 'vendor', text: 'Thank you! Yes, I am available on Aug 15. Would you like to discuss packages?', time: '10:32 AM' },
  { id: '3', sender: 'customer', text: 'Yes please! Can we discuss the wedding timeline? I was thinking of starting at 6 PM.', time: '10:35 AM' },
  { id: '4', sender: 'vendor', text: 'Perfect. For evening weddings, I recommend the Gold package which includes pre-wedding coverage. Shall I send details?', time: '10:38 AM' },
  { id: '5', sender: 'customer', text: 'Can we discuss the wedding timeline?', time: '10:40 AM' },
];

export default function VendorMessages() {
  const [selected, setSelected] = useState<Chat | null>(chats[0]);
  const [search, setSearch] = useState('');
  const [newMsg, setNewMsg] = useState('');

  const filtered = chats.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-[calc(100vh-8rem)] max-w-[1200px]">
      <div className="bg-white rounded-2xl border border-border/60 h-full flex overflow-hidden">
        {/* Chat list */}
        <div className="w-full md:w-[320px] border-r border-border/60 flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-border/40">
            <h2 className="text-base font-bold text-foreground mb-3">Messages</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-border/60 bg-[#FAFAFA] text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.map(chat => (
              <button key={chat.id} onClick={() => setSelected(chat)}
                className={cn('w-full flex items-center gap-3 px-4 py-3.5 border-b border-border/30 transition-colors text-left',
                  selected?.id === chat.id ? 'bg-[#8B1538]/5' : 'hover:bg-[#FAFAFA]')}>
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8B1538] to-[#D4AF37] flex items-center justify-center text-white text-sm font-bold">
                    {chat.name.charAt(0)}
                  </div>
                  {chat.online && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground truncate">{chat.name}</p>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{chat.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{chat.lastMessage}</p>
                </div>
                {chat.unread > 0 && (
                  <span className="w-5 h-5 bg-[#8B1538] text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                    {chat.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="hidden md:flex flex-col flex-1">
          {selected ? (
            <>
              {/* Chat header */}
              <div className="px-5 py-3.5 border-b border-border/60 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#8B1538] to-[#D4AF37] flex items-center justify-center text-white text-sm font-bold">
                  {selected.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{selected.name}</p>
                  <p className="text-[11px] text-emerald-600">{selected.online ? 'Online' : 'Offline'}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {messages.map(msg => (
                  <div key={msg.id} className={cn('flex', msg.sender === 'vendor' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[75%] px-4 py-2.5 rounded-2xl text-sm',
                      msg.sender === 'vendor'
                        ? 'bg-[#8B1538] text-white rounded-br-md'
                        : 'bg-secondary text-foreground rounded-bl-md')}>
                      <p>{msg.text}</p>
                      <div className={cn('flex items-center gap-1 mt-1', msg.sender === 'vendor' ? 'justify-end' : 'justify-start')}>
                        <span className={cn('text-[10px]', msg.sender === 'vendor' ? 'text-white/60' : 'text-muted-foreground')}>{msg.time}</span>
                        {msg.sender === 'vendor' && <CheckCheck className="w-3 h-3 text-white/60" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* AI suggested replies */}
              <div className="px-5 py-2 border-t border-border/40 flex gap-2 overflow-x-auto">
                {['Sure, let me check!', 'I\'ll send the quote shortly', 'Would you prefer a video call?'].map(s => (
                  <button key={s} onClick={() => setNewMsg(s)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#8B1538]/5 border border-[#8B1538]/20 text-[11px] font-medium text-[#8B1538] whitespace-nowrap hover:bg-[#8B1538]/10 transition-colors">
                    <Sparkles className="w-3 h-3" /> {s}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="px-5 py-3 border-t border-border/60 flex items-center gap-3">
                <button className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
                  <Paperclip className="w-4.5 h-4.5" />
                </button>
                <input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border/60 bg-[#FAFAFA] text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
                <button className="p-2.5 rounded-xl bg-[#8B1538] text-white hover:bg-[#8B1538]/90 transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
