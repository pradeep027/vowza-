-- Enhance provider_availability table to include time slots
ALTER TABLE public.provider_availability 
ADD COLUMN IF NOT EXISTS time_slot_start TIME,
ADD COLUMN IF NOT EXISTS time_slot_end TIME,
ADD COLUMN IF NOT EXISTS slot_type TEXT DEFAULT 'unavailable' CHECK (slot_type IN ('available', 'unavailable', 'busy'));

-- Create provider_time_slots table for recurring availability
CREATE TABLE IF NOT EXISTS public.provider_time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, day_of_week, start_time, end_time)
);

-- Enable RLS on provider_time_slots
ALTER TABLE public.provider_time_slots ENABLE ROW LEVEL SECURITY;

-- RLS policies for provider_time_slots
CREATE POLICY "Everyone can view time slots" ON public.provider_time_slots FOR SELECT USING (true);
CREATE POLICY "Providers can manage own time slots" ON public.provider_time_slots FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- Add updated_at trigger for provider_time_slots
CREATE TRIGGER update_provider_time_slots_updated_at BEFORE UPDATE ON public.provider_time_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
