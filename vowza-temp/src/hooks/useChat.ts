import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Message {
  id: string;
  booking_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'file' | 'location';
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
  attachmentUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  replyToId?: string;
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
        setMessages(data as Message[]);
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
          const msg = payload.new as Message;
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // Auto-mark as delivered + read if from other user
          if (msg.sender_id !== user.id) {
            supabase.from('messages').update({ is_read: true, read_at: new Date().toISOString(), delivered_at: msg.delivered_at || new Date().toISOString() }).eq('id', msg.id);
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
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
    const { content, messageType = 'text', attachmentUrl, fileName, fileSize, mimeType, latitude, longitude, locationLabel, replyToId } = options;
    if (messageType === 'text' && (!content || !content.trim())) return;

    setIsSending(true);
    try {
      const { error } = await supabase.from('messages').insert({
        booking_id: bookingId,
        sender_id: user.id,
        content: content?.trim() || '',
        message_type: messageType,
        attachment_url: attachmentUrl || null,
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
  const uploadFile = async (file: File): Promise<{ url: string; path: string }> => {
    if (!user) throw new Error('Not authenticated');
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${user.id}/${bookingId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('chat-media').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      setUploadProgress(100);
      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);
      return { url: urlData.publicUrl, path };
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return { messages, isLoading, isSending, isUploading, uploadProgress, otherTyping, sendMessage, sendTyping, uploadFile };
};
