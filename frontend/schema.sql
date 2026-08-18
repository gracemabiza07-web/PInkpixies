-- Supabase Schema for "pink pixies" Global Nail Network (Updated for Phase 1)

-- 0. Enable Extensions
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Create custom types
-- Drop if they exist to avoid errors on re-run
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('client', 'technician', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';

DO $$ BEGIN
    CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create the Profiles table (handles both Clients and Technicians)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role user_role NOT NULL DEFAULT 'client',
  full_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  location TEXT, 
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  coords GEOGRAPHY(Point, 4326),
  phone_number TEXT,
  whatsapp_number TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_pink_badge BOOLEAN DEFAULT FALSE,
  post_vibes INTEGER DEFAULT 0,
  specialties TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for spatial queries
CREATE INDEX IF NOT EXISTS profiles_coords_idx ON public.profiles USING GIST (coords);

-- If table already existed from before, add the new columns just in case:
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- 3. Create the Posts table (Inspiration social feed)
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create the Services table (Nail tech offerings)
CREATE TABLE IF NOT EXISTS public.services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  technician_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  base_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  base_currency VARCHAR(3) NOT NULL DEFAULT 'ZMW',
  duration_minutes INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RPC Function for incrementing likes safely
CREATE OR REPLACE FUNCTION increment_vibe(post_id UUID, increment_val INTEGER)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  post_author_id UUID;
BEGIN
  -- 1. Update the post's likes_count
  UPDATE public.posts 
  SET likes_count = likes_count + increment_val 
  WHERE id = post_id
  RETURNING author_id INTO post_author_id;

  -- 2. Update the profile's total post_vibes
  UPDATE public.profiles
  SET post_vibes = post_vibes + increment_val
  WHERE id = post_author_id;

  -- 3. Check for Pink Badge unlock (1000+ vibes)
  UPDATE public.profiles
  SET is_pink_badge = TRUE
  WHERE id = post_author_id AND post_vibes >= 1000 AND is_pink_badge = FALSE;
END;
$$;

-- 5. Create the Appointments table ("Add to cart" booking)
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT NOT NULL,
  technician_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE RESTRICT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  total_price NUMERIC DEFAULT 0,
  status appointment_status DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.1. Create the Appointment Services table (junction for multi-service bookings)
CREATE TABLE IF NOT EXISTS public.appointment_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE RESTRICT NOT NULL,
  price_at_booking NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create the Reviews table (Dual-review system)
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reviewee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Create the Messages table (Real-time In-App Chat)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Function to automatically update 'updated_at' columns
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Add trigger for updated_at to profiles and appointments
DROP TRIGGER IF EXISTS on_profiles_updated ON public.profiles;
CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS on_appointments_updated ON public.appointments;
CREATE TRIGGER on_appointments_updated
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- IMPORTANT: Ensure Realtime is enabled for the 'messages' table in your Supabase Dashboard!

-- 10. Create the Certifications table (Professionalism Portal)
CREATE TABLE IF NOT EXISTS public.certifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  technician_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Row Level Security (RLS) Policies

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Posts (Inspiration Gallery)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
CREATE POLICY "Authenticated users can create posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Authors can delete own posts" ON public.posts;
CREATE POLICY "Authors can delete own posts" ON public.posts FOR DELETE USING (auth.uid() = author_id);

-- Services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Services are viewable by everyone" ON public.services;
CREATE POLICY "Services are viewable by everyone" ON public.services FOR SELECT USING (true);
DROP POLICY IF EXISTS "Technicians can manage own services" ON public.services;
CREATE POLICY "Technicians can manage own services" ON public.services FOR ALL USING (auth.uid() = technician_id);

-- Appointments
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;
CREATE POLICY "Users can view their own appointments" ON public.appointments FOR SELECT USING (auth.uid() = client_id OR auth.uid() = technician_id);
DROP POLICY IF EXISTS "Clients can book appointments" ON public.appointments;
CREATE POLICY "Clients can book appointments" ON public.appointments FOR INSERT WITH CHECK (auth.uid() = client_id);
DROP POLICY IF EXISTS "Participants can update appointment status" ON public.appointments;
CREATE POLICY "Participants can update appointment status" ON public.appointments FOR UPDATE USING (auth.uid() = client_id OR auth.uid() = technician_id);

-- Reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reviews viewable by everyone" ON public.reviews;
CREATE POLICY "Reviews viewable by everyone" ON public.reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can leave reviews" ON public.reviews;
CREATE POLICY "Authenticated users can leave reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- Messages (In-App Chat)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
CREATE POLICY "Users can view their own messages" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Certifications
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Technicians can view own certifications" ON public.certifications;
CREATE POLICY "Technicians can view own certifications" ON public.certifications FOR SELECT USING (auth.uid() = technician_id);
DROP POLICY IF EXISTS "Technicians can upload certifications" ON public.certifications;
CREATE POLICY "Technicians can upload certifications" ON public.certifications FOR INSERT WITH CHECK (auth.uid() = technician_id);

-- Admin Override
DROP POLICY IF EXISTS "Admins have full access" ON public.profiles;
CREATE POLICY "Admins have full access" ON public.profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Phase 2: Scheduling & Availability Logic

-- 1. Table for Professional Working Hours
CREATE TABLE IF NOT EXISTS public.working_hours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  technician_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  UNIQUE(technician_id, day_of_week)
);

-- 2. Table for Blocked Time / Vacations
CREATE TABLE IF NOT EXISTS public.blocked_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  technician_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  reason TEXT,
  CHECK (start_time < end_time)
);

-- RLS for Availability
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Working hours viewable by everyone" ON public.working_hours FOR SELECT USING (true);
CREATE POLICY "Technicians can manage own hours" ON public.working_hours FOR ALL USING (auth.uid() = technician_id);

ALTER TABLE public.blocked_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Blocked slots viewable by everyone" ON public.blocked_slots FOR SELECT USING (true);
CREATE POLICY "Technicians can manage own blocked slots" ON public.blocked_slots FOR ALL USING (auth.uid() = technician_id);

-- 3. Function to check if a slot is truly available
CREATE OR REPLACE FUNCTION public.check_availability(
  p_technician_id UUID,
  p_start_time TIMESTAMP WITH TIME ZONE,
  p_duration_minutes INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_end_time TIMESTAMP WITH TIME ZONE;
  v_day_of_week INTEGER;
  v_time_only TIME;
  v_in_working_hours BOOLEAN;
  v_has_conflict BOOLEAN;
BEGIN
  v_end_time := p_start_time + (p_duration_minutes || ' minutes')::interval;
  v_day_of_week := extract(dow from p_start_time);
  v_time_only := p_start_time::time;

  -- Check working hours
  SELECT EXISTS (
    SELECT 1 FROM public.working_hours 
    WHERE technician_id = p_technician_id 
    AND day_of_week = v_day_of_week
    AND v_time_only >= start_time 
    AND (v_end_time::time) <= end_time
  ) INTO v_in_working_hours;

  IF NOT v_in_working_hours THEN RETURN FALSE; END IF;

  -- Check overlapping appointments
  SELECT EXISTS (
    SELECT 1 FROM public.appointments
    WHERE technician_id = p_technician_id
    AND status IN ('confirmed', 'pending')
    AND start_time < v_end_time
    AND end_time > p_start_time
  ) INTO v_has_conflict;

  IF v_has_conflict THEN RETURN FALSE; END IF;

  -- Check blocked slots
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_slots
    WHERE technician_id = p_technician_id
    AND start_time < v_end_time
    AND end_time > p_start_time
  ) INTO v_has_conflict;

  IF v_has_conflict THEN RETURN FALSE; END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Phase 3: Split Payments Logic

-- 1. Table to track transactions and split payments
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  technician_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  platform_fee NUMERIC(10, 2) NOT NULL,
  payout_amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'ZMW' NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed', 'refunded')),
  payment_method TEXT,
  external_ref TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own transactions" ON public.transactions 
  FOR SELECT USING (auth.uid() = client_id OR auth.uid() = technician_id);

-- Admins can view all
CREATE POLICY "Admins can view all transactions" ON public.transactions 
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Phase 7: Loyalty & Referrals

-- 1. Table for Loyalty Profiles
CREATE TABLE IF NOT EXISTS public.loyalty_profiles (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  points INTEGER DEFAULT 0 NOT NULL,
  tier TEXT DEFAULT 'Bronze' CHECK (tier IN ('Bronze', 'Silver', 'Gold', 'Pink')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Loyalty
ALTER TABLE public.loyalty_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own loyalty profile" ON public.loyalty_profiles;
CREATE POLICY "Users can view own loyalty profile" ON public.loyalty_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- 2. Table for Referrals
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  referred_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  reward_awarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Referrals
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- 3. Trigger to award points on completed appointments
CREATE OR REPLACE FUNCTION public.award_completion_points()
RETURNS TRIGGER AS $$
DECLARE
  v_referral_id UUID;
BEGIN
  IF (OLD.status <> 'completed' AND NEW.status = 'completed') THEN
    -- Award points to Client (20 pts)
    INSERT INTO public.loyalty_profiles (user_id, points)
    VALUES (NEW.client_id, 20)
    ON CONFLICT (user_id) DO UPDATE
    SET points = loyalty_profiles.points + 20,
        tier = CASE 
          WHEN (loyalty_profiles.points + 20) >= 1000 THEN 'Pink'
          WHEN (loyalty_profiles.points + 20) >= 500 THEN 'Gold'
          WHEN (loyalty_profiles.points + 20) >= 200 THEN 'Silver'
          ELSE 'Bronze'
        END;

    -- Check for an active referral for this client
    UPDATE public.referrals
    SET status = 'completed',
        reward_awarded = TRUE
    WHERE referred_id = NEW.client_id 
    AND status = 'pending'
    AND reward_awarded = FALSE
    RETURNING id INTO v_referral_id;

    -- If referral was confirmed, award bonus to Referrer (50 pts)
    IF v_referral_id IS NOT NULL THEN
      INSERT INTO public.loyalty_profiles (user_id, points)
      SELECT referrer_id, 50 
      FROM public.referrals
      WHERE id = v_referral_id
      ON CONFLICT (user_id) DO UPDATE
      SET points = loyalty_profiles.points + 50;
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_appointment_completed_loyalty ON public.appointments;
CREATE TRIGGER on_appointment_completed_loyalty
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.award_completion_points();

-- Phase 5: Real-time Notifications

-- 1. Table for Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT CHECK (type IN ('booking', 'payment', 'review', 'system')),
  is_read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notifications" ON public.notifications 
  FOR ALL USING (auth.uid() = user_id);

-- 2. Trigger Function for Appointment Notifications
CREATE OR REPLACE FUNCTION public.notify_appointment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify Client
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.notifications (user_id, title, content, type, link)
    VALUES (NEW.client_id, 'Booking Received', 'Your booking with the technician is pending confirmation.', 'booking', '/#bookings');
  ELSIF (TG_OP = 'UPDATE' AND OLD.status <> NEW.status) THEN
    INSERT INTO public.notifications (user_id, title, content, type, link)
    VALUES (NEW.client_id, 'Booking Update', 'Your booking status changed to ' || NEW.status || '.', 'booking', '/#bookings');
  END IF;
  
  -- Notify Technician
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.notifications (user_id, title, content, type, link)
    VALUES (NEW.technician_id, 'New Booking Request', 'You have a new booking request. Check your portal!', 'booking', '/#portal');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_appointment_notified ON public.appointments;
CREATE TRIGGER on_appointment_notified
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_appointment_status();

-- Phase 6: Advanced Search & Discovery (PostGIS)

-- 1. Function to find technicians within a radius
CREATE OR REPLACE FUNCTION public.search_technicians_nearby(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_radius_meters DOUBLE PRECISION DEFAULT 10000,
  p_search_query TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  location TEXT,
  distance_meters DOUBLE PRECISION,
  avg_rating NUMERIC
) AS $$
DECLARE
  v_point GEOGRAPHY;
BEGIN
  v_point := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::GEOGRAPHY;

  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.avatar_url,
    p.bio,
    p.location,
    ST_Distance(p.coords, v_point) AS distance_meters,
    (SELECT COALESCE(AVG(rating), 0) FROM public.reviews r WHERE r.reviewee_id = p.id) AS avg_rating
  FROM public.profiles p
  WHERE p.role = 'technician'
  AND ST_DWithin(p.coords, v_point, p_radius_meters)
  AND (
    p_search_query IS NULL 
    OR p.full_name ILIKE ('%' || p_search_query || '%')
    OR p.bio ILIKE ('%' || p_search_query || '%')
    OR p.location ILIKE ('%' || p_search_query || '%')
  )
  ORDER BY distance_meters ASC;
END;
-- 2. Trigger to generate unique referral code for new profiles
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  v_code TEXT;
BEGIN
  LOOP
    v_code := upper(substring(md5(random()::text) from 1 for 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code);
  END LOOP;
  NEW.referral_code := v_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profile_created_referral ON public.profiles;
CREATE TRIGGER on_profile_created_referral
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION public.generate_referral_code();
