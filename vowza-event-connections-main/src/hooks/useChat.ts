import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Message {
  id: string;
  booking_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'file' | 'location';
  // Render-time signed URL; the database column stores the chat-media object path.
  attachment_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  latitude: number | null;
  longitude: number | null;
  location_label: string | null;
  is_read: boolean;
  delivered_at: string | null;
  read_at: string | null;
  reply_to_id: string | null;
  created_at: string;
}

interface SendOptions {
  content?: string;
  messageType?: Message['message_type'];
  attachmentPath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  replyToId?: string;
}

const CHAT_BUCKET = 'chat-media';

function chatObjectPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  if (!/^https?:\/\//i.test(value)) return value;
  try {
    const url = new URL(value);
    for (const marker of [
      `/storage/v1/object/public/${CHAT_BUCKET}/`,
      `/storage/v1/object/sign/${CHAT_BUCKET}/`,
    ]) {
      const index = url.pathname.indexOf(marker);
      if (index !== -1) return decodeURIComponent(url.pathname.slice(index + marker.length));
    }
  } catch {
    // Malformed legacy values are rejected rather than rendered as broken media.
  }
  return null;
}

async function hydrateMessages(rows: Message[]): Promise<Message[]> {
  return Promise.all(rows.map(async row => {
    if (!row.attachment_url || !['image', 'video', 'file'].includes(row.message_type)) return row;
    const path = chatObjectPath(row.attachment_url);
    if (!path) {
      console.error('[chat] Unable to parse stored attachment path');
      return { ...row, attachment_url: null };
    }
    const { data, error } = await supabase.storage.from(CHAT_BUCKET).createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      console.error('[chat] Unable to sign stored attachment');
      return { ...row, attachment_url: null };
    }
    return { ...row, attachment_url: data.signedUrl };
  }));
}

export const useChat = (bookingId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [otherTyping, setOtherTyping] = useState(false);
  const { user } = useAuth();
  const typingTimeout = useRef<NodeJS.Timeout>();
  const presenceChannel = useRef<any>(null);

  useEffect(() => {
    if (!bookingId || !user) return;

    const fetchMessages = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(await hydrateMessages(data as Message[]));
        // Mark unread messages as read + set read_at
        const unreadIds = data
          .filter((m: any) => !m.is_read && m.sender_id !== user.id)
          .map((m: any) => m.id);
        if (unreadIds.length > 0) {
          await supabase.from('messages')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .in('id', unreadIds);
        }
        // Mark delivered for messages not yet delivered
        const undelivered = data
          .filter((m: any) => !m.delivered_at && m.sender_id !== user.id)
          .map((m: any) => m.id);
        if (undelivered.length > 0) {
          await supabase.from('messages')
            .update({ delivered_at: new Date().toISOString() })
            .in('id', undelivered);
        }
      }
      setIsLoading(false);
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages-${bookingId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          const rawMsg = payload.new as Message;
          void hydrateMessages([rawMsg]).then(([msg]) => {
            if (!msg) return;
            setMessages(prev => {
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          });
          // Auto-mark as delivered + read if from other user
          if (rawMsg.sender_id !== user.id) {
            supabase.from('messages').update({ is_read: true, read_at: new Date().toISOString(), delivered_at: rawMsg.delivered_at || new Date().toISOString() }).eq('id', rawMsg.id);
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          void hydrateMessages([payload.new as Message]).then(([updated]) => {
            if (!updated) return;
            setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
          });
        }
      )
      .subscribe();

    // Presence channel for typing indicator
    const presence = supabase.channel(`typing-${bookingId}`, { config: { presence: { key: user.id } } });
    presence.on('presence', { event: 'sync' }, () => {
      const state = presence.presenceState();
      const others = Object.keys(state).filter(k => k !== user.id);
      setOtherTyping(others.some(k => (state[k] as any)?.[0]?.typing));
    });
    presence.subscribe();
    presenceChannel.current = presence;

    return () => {
      supabase.removeChannel(channel);
      if (presenceChannel.current) supabase.removeChannel(presenceChannel.current);
    };
  }, [bookingId, user]);

  // Send typing indicator
  const sendTyping = useCallback(() => {
    if (!presenceChannel.current || !user) return;
    presenceChannel.current.track({ typing: true });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      presenceChannel.current?.track({ typing: false });
    }, 3000);
  }, [user]);

  // Send message (text, media, location)
  const sendMessage = async (options: SendOptions) => {
    if (!user) return;
    const { content, messageType = 'text', attachmentPath, fileName, fileSize, mimeType, latitude, longitude, locationLabel, replyToId } = options;
    if (messageType === 'text' && (!content || !content.trim())) return;

    setIsSending(true);
    try {
      const { error } = await supabase.from('messages').insert({
        booking_id: bookingId,
        sender_id: user.id,
        content: content?.trim() || '',
        message_type: messageType,
        // Store the object path only. Signed URLs are created by hydrateMessages at read time.
        attachment_url: attachmentPath || null,
        file_name: fileName || null,
        file_size: fileSize || null,
        mime_type: mimeType || null,
        latitude: latitude || null,
        longitude: longitude || null,
        location_label: locationLabel || null,
        reply_to_id: replyToId || null,
      });
      if (error) throw error;
      // Stop typing
      presenceChannel.current?.track({ typing: false });
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    } finally {
      setIsSending(false);
    }
  };

  // Upload file to chat-media bucket
  const uploadFile = async (file: File): Promise<{ path: string }> => {
    if (!user) throw new Error('Not authenticated');
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${user.id}/${bookingId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('chat-media').upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      setUploadProgress(100);
      return { path };
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return { messages, isLoading, isSending, isUploading, uploadProgress, otherTyping, sendMessage, sendTyping, uploadFile };
};
