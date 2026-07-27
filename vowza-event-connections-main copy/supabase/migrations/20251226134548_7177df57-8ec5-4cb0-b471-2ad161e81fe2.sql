-- Create messages table for booking chat
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_messages_booking_id ON public.messages(booking_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only booking participants can view and send messages
CREATE POLICY "Booking participants can view messages" ON public.messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id
    AND (
      b.customer_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.provider_profiles pp 
        WHERE pp.id = b.provider_id AND pp.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Booking participants can send messages" ON public.messages
FOR INSERT WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id
    AND (
      b.customer_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.provider_profiles pp 
        WHERE pp.id = b.provider_id AND pp.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can mark own received messages as read" ON public.messages
FOR UPDATE USING (
  sender_id != auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id
    AND (
      b.customer_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.provider_profiles pp 
        WHERE pp.id = b.provider_id AND pp.user_id = auth.uid()
      )
    )
  )
);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;