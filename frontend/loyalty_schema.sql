-- Phase 9: Loyalty & Referral System

-- 1. Create the user_loyalty table
CREATE TABLE IF NOT EXISTS public.loyalty_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  points INTEGER DEFAULT 0 NOT NULL,
  tier TEXT DEFAULT 'Bronze' CHECK (tier IN ('Bronze', 'Silver', 'Gold', 'Pink')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create the referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  referred_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  reward_awarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS
ALTER TABLE public.loyalty_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Users can view their own loyalty status" ON public.loyalty_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- 5. Function to award loyalty points
CREATE OR REPLACE FUNCTION public.award_loyalty_points()
RETURNS TRIGGER AS $$
DECLARE
  v_points_to_award INTEGER := 10; -- Base points per appointment
  v_commission_loyalty BOOLEAN := FALSE;
BEGIN
  -- Only award points when appointment is marked as 'completed'
  IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') THEN
    
    -- Award points to the client
    INSERT INTO public.loyalty_profiles (user_id, points)
    VALUES (NEW.client_id, v_points_to_award)
    ON CONFLICT (user_id) DO UPDATE
    SET points = loyalty_profiles.points + v_points_to_award,
        updated_at = now();

    -- Check if this was a referred user's first completed appointment
    UPDATE public.referrals
    SET status = 'completed',
        reward_awarded = TRUE
    WHERE referred_id = NEW.client_id AND status = 'pending'
    RETURNING TRUE INTO v_commission_loyalty;

    -- If referral was triggered, award bonus to referrer
    IF v_commission_loyalty THEN
      INSERT INTO public.loyalty_profiles (user_id, points)
      SELECT referrer_id, 50 -- Bonus for successful referral
      FROM public.referrals
      WHERE referred_id = NEW.client_id
      ON CONFLICT (user_id) DO UPDATE
      SET points = loyalty_profiles.points + 50,
          updated_at = now();
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger for awarding points
DROP TRIGGER IF EXISTS tr_award_loyalty ON public.appointments;
CREATE TRIGGER tr_award_loyalty
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.award_loyalty_points();
