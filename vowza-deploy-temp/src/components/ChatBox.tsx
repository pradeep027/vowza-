import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useChat, Message } from '@/hooks/useChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, Plus, Image, Video, FileText, MapPin, Smile, X, Check, CheckCheck, Download, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ChatBoxProps {
  bookingId: string;
  otherUserName: string;
  disabled?: boolean;
  readOnly?: boolean; // admin mode: no ticks, no send
}

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_FILE = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain'];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

const EMOJI_LIST = ['😊','😂','❤️','👍','🙏','🎉','🔥','💯','😍','🥳','👋','✨','💪','🎶','📸','💐','🙌','😎','🤝','👏','💕','🌟','🎊','😢','🤔','👌','💃','🕺','🎵','🌹'];

const ChatBox = ({ bookingId, otherUserName, disabled = false, readOnly = false }: ChatBoxProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ file: File; type: 'image' | 'video' | 'file' } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { messages, isLoading, isSending, isUploading, uploadProgress, otherTyping, sendMessage, sendTyping, uploadFile } = useChat(bookingId);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || isSending || disabled || readOnly) return;
    const content = newMessage;
    setNewMessage('');
    try { await sendMessage({ content, messageType: 'text' }); }
    catch { setNewMessage(content); toast.error('Failed to send'); }
  };

  const handleFileSelect = (type: 'image' | 'video' | 'file') => {
    setShowAttachMenu(false);
    if (!fileInputRef.current) return;
    const accept = type === 'image' ? ALLOWED_IMAGE.join(',') : type === 'video' ? ALLOWED_VIDEO.join(',') : ALLOWED_FILE.join(',');
    fileInputRef.current.accept = accept;
    fileInputRef.current.dataset.type = type;
    fileInputRef.current.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SIZE) { toast.error('File too large (max 50MB)'); return; }
    const type = (e.target.dataset.type || 'file') as 'image' | 'video' | 'file';
    setPreviewFile({ file, type });
    e.target.value = '';
  };

  const handleSendMedia = async () => {
    if (!previewFile || isUploading || disabled || readOnly) return;
    try {
      const { url } = await uploadFile(previewFile.file);
      const msgType = previewFile.type === 'image' ? 'image' : previewFile.type === 'video' ? 'video' : 'file';
      await sendMessage({ content: previewFile.file.name, messageType: msgType, attachmentUrl: url, fileName: previewFile.file.name, fileSize: previewFile.file.size, mimeType: previewFile.file.type });
      setPreviewFile(null);
    } catch { toast.error('Upload failed'); }
  };

  const handleShareLocation = async () => {
    setShowAttachMenu(false);
    if (disabled || readOnly) return;
    if (!navigator.geolocation) { toast.error('Location not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await sendMessage({ content: 'Shared location', messageType: 'location', latitude: pos.coords.latitude, longitude: pos.coords.longitude, locationLabel: 'Current Location' });
        } catch { toast.error('Failed to share location'); }
      },
      () => { toast.error('Location permission denied'); }
    );
  };

  const handleTyping = () => { if (!disabled && !readOnly) sendTyping(); };

  const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const formatDate = (d: string) => { const date = new Date(d); const today = new Date(); if (date.toDateString() === today.toDateString()) return 'Today'; const y = new Date(); y.setDate(y.getDate()-1); if (date.toDateString() === y.toDateString()) return 'Yesterday'; return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); };
  const formatSize = (b: number) => b < 1024 ? `${b}B` : b < 1048576 ? `${(b/1024).toFixed(1)}KB` : `${(b/1048576).toFixed(1)}MB`;

  // Group by date
  const grouped = messages.reduce((g, m) => { const d = new Date(m.created_at).toDateString(); if (!g[d]) g[d]=[]; g[d].push(m); return g; }, {} as Record<string, Message[]>);

  // Delivery ticks component
  const Ticks = ({ msg }: { msg: Message }) => {
    if (readOnly) return null; // admin: no ticks
    if (msg.sender_id !== user?.id) return null; // only show on own messages
    if (msg.read_at) return <CheckCheck className="w-3 h-3 text-blue-500" />;
    if (msg.delivered_at || msg.is_read) return <CheckCheck className="w-3 h-3 text-white/60" />;
    return <Check className="w-3 h-3 text-white/50" />;
  };

  // Message content renderer
  const MessageContent = ({ msg }: { msg: Message }) => {
    if (msg.message_type === 'image' && msg.attachment_url) {
      return (
        <div className="space-y-1">
          <img src={msg.attachment_url} alt={msg.file_name || 'Image'} className="max-w-[240px] rounded-lg cursor-pointer" onClick={() => window.open(msg.attachment_url!, '_blank')} loading="lazy" />
          {msg.content && msg.content !== msg.file_name && <p className="text-sm">{msg.content}</p>}
        </div>
      );
    }
    if (msg.message_type === 'video' && msg.attachment_url) {
      return (
        <div className="space-y-1">
          <video src={msg.attachment_url} controls className="max-w-[260px] rounded-lg" preload="metadata" />
          {msg.content && msg.content !== msg.file_name && <p className="text-sm">{msg.content}</p>}
        </div>
      );
    }
    if (msg.message_type === 'file' && msg.attachment_url) {
      return (
        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition">
          <FileText className="w-5 h-5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{msg.file_name || 'File'}</p>
            {msg.file_size && <p className="text-[10px] opacity-70">{formatSize(msg.file_size)}</p>}
          </div>
          <Download className="w-4 h-4 flex-shrink-0 opacity-70" />
        </a>
      );
    }
    if (msg.message_type === 'location') {
      const mapUrl = `https://www.google.com/maps?q=${msg.latitude},${msg.longitude}`;
      return (
        <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition">
          <MapPin className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">{msg.location_label || 'Shared Location'}</p>
            <p className="text-[10px] opacity-70">Tap to open in Maps</p>
          </div>
        </a>
      );
    }
    return <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>;
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div>;

  return (
    <div className="flex flex-col h-[500px] bg-card rounded-lg border border-gold/20 relative">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30 rounded-t-lg flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">{otherUserName}</h3>
          <p className="text-[11px] text-muted-foreground">{otherTyping ? <span className="text-emerald-600 animate-pulse">typing...</span> : 'Booking conversation'}</p>
        </div>
        {readOnly && <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-medium">Admin View</span>}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {disabled ? 'This conversation is closed.' : 'No messages yet. Start the conversation!'}
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([date, msgs]) => (
              <div key={date}>
                <div className="flex items-center justify-center my-3">
                  <span className="px-3 py-0.5 text-[10px] bg-muted rounded-full text-muted-foreground">{formatDate(msgs[0].created_at)}</span>
                </div>
                <div className="space-y-1.5">
                  {msgs.map((msg) => {
                    const isOwn = msg.sender_id === user?.id;
                    return (
                      <div key={msg.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                        <div className={cn('max-w-[75%] px-3 py-2 rounded-2xl', isOwn ? 'bg-[#8B1538] text-white rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm')}>
                          <MessageContent msg={msg} />
                          <div className={cn('flex items-center gap-1 mt-0.5', isOwn ? 'justify-end' : 'justify-start')}>
                            <span className={cn('text-[10px]', isOwn ? 'text-white/60' : 'text-muted-foreground')}>{formatTime(msg.created_at)}</span>
                            <Ticks msg={msg} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* File preview */}
      {previewFile && (
        <div className="absolute inset-0 bg-background/95 z-10 flex flex-col items-center justify-center p-4 rounded-lg">
          <button onClick={() => setPreviewFile(null)} className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted"><X className="w-5 h-5" /></button>
          {previewFile.type === 'image' && <img src={URL.createObjectURL(previewFile.file)} alt="Preview" className="max-h-[300px] max-w-full rounded-xl object-contain" />}
          {previewFile.type === 'video' && <video src={URL.createObjectURL(previewFile.file)} controls className="max-h-[300px] max-w-full rounded-xl" />}
          {previewFile.type === 'file' && <div className="flex items-center gap-3 p-4 rounded-xl bg-muted"><FileText className="w-8 h-8" /><div><p className="font-medium text-sm">{previewFile.file.name}</p><p className="text-xs text-muted-foreground">{formatSize(previewFile.file.size)}</p></div></div>}
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setPreviewFile(null)}>Cancel</Button>
            <Button onClick={handleSendMedia} disabled={isUploading} className="bg-[#8B1538] hover:bg-[#70102d] text-white">
              {isUploading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />{uploadProgress}%</> : <><Send className="w-4 h-4 mr-1" />Send</>}
            </Button>
          </div>
        </div>
      )}

      {/* Input area */}
      {disabled || readOnly ? (
        <div className="p-3 border-t border-border bg-muted/50">
          <p className="text-xs text-muted-foreground text-center">{readOnly ? 'Admin view — read only' : 'This conversation is closed.'}</p>
        </div>
      ) : (
        <div className="p-3 border-t border-border relative">
          {/* Emoji picker */}
          {showEmoji && (
            <div className="absolute bottom-full left-0 right-0 p-3 bg-card border border-border rounded-t-xl shadow-lg max-h-[180px] overflow-y-auto">
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_LIST.map(e => (
                  <button key={e} onClick={() => { setNewMessage(prev => prev + e); setShowEmoji(false); }} className="text-xl hover:scale-125 transition-transform p-1">{e}</button>
                ))}
              </div>
            </div>
          )}
          {/* Attachment menu */}
          {showAttachMenu && (
            <div className="absolute bottom-full left-3 mb-2 bg-card border border-border rounded-xl shadow-lg p-2 space-y-1 min-w-[150px] z-20">
              <button onClick={() => handleFileSelect('image')} className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium rounded-lg hover:bg-muted transition"><Image className="w-4 h-4 text-emerald-600" />Photo</button>
              <button onClick={() => handleFileSelect('video')} className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium rounded-lg hover:bg-muted transition"><Video className="w-4 h-4 text-blue-600" />Video</button>
              <button onClick={() => handleFileSelect('file')} className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium rounded-lg hover:bg-muted transition"><FileText className="w-4 h-4 text-orange-600" />File</button>
              <button onClick={handleShareLocation} className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium rounded-lg hover:bg-muted transition"><MapPin className="w-4 h-4 text-red-600" />Location</button>
            </div>
          )}
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <button type="button" onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmoji(false); }} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition"><Plus className="w-5 h-5" /></button>
            <button type="button" onClick={() => { setShowEmoji(!showEmoji); setShowAttachMenu(false); }} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition"><Smile className="w-5 h-5" /></button>
            <Input
              value={newMessage}
              onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
              onFocus={() => { setShowAttachMenu(false); setShowEmoji(false); }}
              placeholder="Type a message..."
              className="flex-1 border-border focus:border-gold text-sm"
              disabled={isSending}
            />
            <Button type="submit" size="icon" disabled={!newMessage.trim() || isSending} className="bg-[#8B1538] hover:bg-[#70102d] text-white">
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
        </div>
      )}
    </div>
  );
};

export default ChatBox;
