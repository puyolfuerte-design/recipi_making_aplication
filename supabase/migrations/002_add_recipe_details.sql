-- Step 2: Add ingredients and instructions columns to recipes table
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS ingredients TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS instructions TEXT;
