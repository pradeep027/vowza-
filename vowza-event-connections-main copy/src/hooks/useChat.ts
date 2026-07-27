import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Message {
  id: string;
  booking_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export const useChat = (bookingId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const { user } = useAuth();

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
        setMessages(data);
        // Mark unread messages as read
        const unreadIds = data
          .filter(m => !m.is_read && m.sender_id !== user.id)
          .map(m => m.id);
        
        if (unreadIds.length > 0) {
          await supabase
            .from('messages')
            .update({ is_read: true })
            .in('id', unreadIds);
        }
      }
      setIsLoading(false);
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages-${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `booking_id=eq.${bookingId}`
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages(prev => [...prev, newMessage]);
          
          // Mark as read if not sender
          if (newMessage.sender_id !== user.id) {
            supabase
              .from('messages')
              .update({ is_read: true })
              .eq('id', newMessage.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, user]);

  const sendMessage = async (content: string) => {
    if (!user || !content.trim()) return;

    setIsSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          booking_id: bookingId,
          sender_id: user.id,
          content: content.trim()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    } finally {
      setIsSending(false);
    }
  };

  return {
    messages,
    isLoading,
    isSending,
    sendMessage
  };
};
