-- Drop and recreate profession_type enum with 30+ categories
DROP TYPE IF EXISTS public.profession_type CASCADE;

CREATE TYPE public.profession_type AS ENUM (
  'music_band',
  'traditional_band',
  'maharashtra_band',
  'dj',
  'singer',
  'instrumental_artist',
  'classical_musician',
  'photographer',
  'videographer',
  'cinematographer',
  'drone_operator',
  'dancer',
  'choreographer',
  'kuchipudi_dancer',
  'classical_dancer',
  'western_dancer',
  'event_decorator',
  'wedding_decorator',
  'stage_decorator',
  'makeup_artist',
  'mehendi_artist',
  'anchor',
  'host',
  'magician',
  'stand_up_comedian',
  'celebrity_artist',
  'live_performer',
  'folk_artist',
  'lighting_services',
  'sound_services',
  'event_planner',
  'wedding_planner',
  'catering_services',
  'event_support'
);

-- Create artist_categories table for dynamic category management
CREATE TABLE IF NOT EXISTS public.artist_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  profession_type profession_type NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on artist_categories
ALTER TABLE public.artist_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for artist_categories
CREATE POLICY "Everyone can view categories" ON public.artist_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.artist_categories FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Insert default categories
INSERT INTO public.artist_categories (name, profession_type, description, icon, sort_order) VALUES
('Music Bands', 'music_band', 'Live bands for weddings and events', 'music', 1),
('Traditional Bands', 'traditional_band', 'Traditional Indian bands', 'music', 2),
('Maharashtra Bands', 'maharashtra_band', 'Regional Maharashtra bands', 'music', 3),
('DJs', 'dj', 'Professional DJs for all events', 'disc3', 4),
('Singers', 'singer', 'Vocal artists and singers', 'mic2', 5),
('Instrumental Artists', 'instrumental_artist', 'Musicians playing instruments', 'music', 6),
('Classical Musicians', 'classical_musician', 'Traditional classical artists', 'music', 7),
('Photographers', 'photographer', 'Professional photography services', 'camera', 8),
('Videographers', 'videographer', 'Video recording and editing', 'video', 9),
('Cinematographers', 'cinematographer', 'Cinematic video production', 'video', 10),
('Drone Operators', 'drone_operator', 'Aerial photography and videography', 'plane', 11),
('Dancers', 'dancer', 'Professional dance performers', 'users', 12),
('Choreographers', 'choreographer', 'Dance choreography services', 'users', 13),
('Kuchipudi Dancers', 'kuchipudi_dancer', 'Traditional Kuchipudi dance', 'users', 14),
('Classical Dancers', 'classical_dancer', 'Classical dance forms', 'users', 15),
('Western Dancers', 'western_dancer', 'Western dance styles', 'users', 16),
('Event Decorators', 'event_decorator', 'Event decoration services', 'palette', 17),
('Wedding Decorators', 'wedding_decorator', 'Wedding decoration specialists', 'palette', 18),
('Stage Decorators', 'stage_decorator', 'Stage and set decoration', 'palette', 19),
('Makeup Artists', 'makeup_artist', 'Professional makeup services', 'sparkles', 20),
('Mehendi Artists', 'mehendi_artist', 'Mehendi design specialists', 'sparkles', 21),
('Anchors', 'anchor', 'Event anchors and emcees', 'mic2', 22),
('Hosts', 'host', 'Event hosts and presenters', 'mic2', 23),
('Magicians', 'magician', 'Magic show performers', 'sparkles', 24),
('Stand-up Comedians', 'stand_up_comedian', 'Comedy entertainers', 'mic2', 25),
('Celebrity Artists', 'celebrity_artist', 'Celebrity performers', 'star', 26),
('Live Performers', 'live_performer', 'Various live performances', 'music', 27),
('Folk Artists', 'folk_artist', 'Traditional folk performers', 'music', 28),
('Lighting Services', 'lighting_services', 'Event lighting and effects', 'lightbulb', 29),
('Sound Services', 'sound_services', 'Sound system and audio services', 'volume2', 30),
('Event Planners', 'event_planner', 'Complete event planning', 'calendar', 31),
('Wedding Planners', 'wedding_planner', 'Wedding planning services', 'heart', 32),
('Catering Services', 'catering_services', 'Food and catering services', 'utensils', 33),
('Event Support', 'event_support', 'General event support staff', 'users', 34)
ON CONFLICT (profession_type) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;

-- Add updated_at trigger for artist_categories
CREATE TRIGGER update_artist_categories_updated_at BEFORE UPDATE ON public.artist_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
