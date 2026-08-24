-- Add category and style_tag columns to portfolio_items for singer/dancer style association
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='portfolio_items' AND column_name='category') THEN
    ALTER TABLE public.portfolio_items ADD COLUMN category text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='portfolio_items' AND column_name='style_tag') THEN
    ALTER TABLE public.portfolio_items ADD COLUMN style_tag text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='portfolio_items' AND column_name='event_name') THEN
    ALTER TABLE public.portfolio_items ADD COLUMN event_name text;
  END IF;
END $$;
