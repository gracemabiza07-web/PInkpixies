-- Supabase Schema for "pink pixies" Global Nail Network (Updated for Phase 1: Ecosystem Foundations)

-- 0. Enable Extensions
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Create custom types
-- Drop if they exist to avoid errors on re-run
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('client', 'technician', 'admin');
EXCEPTION
    WHEN duplicate_object THEN 
        -- If it exists, we might need to add 'admin' if it's missing
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
END $$;

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
  is_pink_badge BOOLEAN DEFAULT FALSE,
  post_vibes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for spatial queries
CREATE INDEX IF NOT EXISTS profiles_coords_idx ON public.profiles USING GIST (coords);

-- If table already existed from before, add the new columns just in case:
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

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
  duration_minutes INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RPC Function for incrementing likes safely
CREATE OR REPLACE FUNCTION increment_vibe(post_id UUID, increment_val INTEGER)
RETURNS void LANGUAGE plpgsql AS $$
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
  service_id UUID REFERENCES public.services(id) ON DELETE RESTRICT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status appointment_status DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
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
-- Add base_price and base_currency to the services table
-- This allows professionals to set their own prices in their local currency

ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS base_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS base_currency VARCHAR(3) NOT NULL DEFAULT 'ZMW';

-- Add a check constraint to ensure the currency is a valid 3-letter ISO code
ALTER TABLE public.services
ADD CONSTRAINT check_valid_currency CHECK (base_currency ~ '^[A-Z]{3}$');

-- Optionally add a trigger to normalize the currency code to uppercase
CREATE OR REPLACE FUNCTION normalize_currency_code()
RETURNS TRIGGER AS $$
BEGIN
    NEW.base_currency = UPPER(NEW.base_currency);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_normalize_currency_code
BEFORE INSERT OR UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION normalize_currency_code();
-- Phase 3: Social Inspiration Feed Schema

-- Table for Social Posts
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption TEXT,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table for Post Likes (to track which user liked which post)
CREATE TABLE IF NOT EXISTS public.post_likes (
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (post_id, user_id)
);

-- Table for Post Comments
CREATE TABLE IF NOT EXISTS public.post_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies for posts
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can insert their own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users can delete their own posts" ON public.posts FOR DELETE USING (auth.uid() = author_id);

-- RLS Policies for likes
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes are viewable by everyone" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own likes" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own likes" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for comments
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments are viewable by everyone" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert their own comments" ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can delete their own comments" ON public.post_comments FOR DELETE USING (auth.uid() = author_id);
-- Phase 3 Part 2: Booking Engine Schema

-- Table for Appointments / Bookings
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    technician_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.services(id) ON DELETE RESTRICT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'ZMW',
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, completed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies for appointments
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Clients can see their own appointments
CREATE POLICY "Clients can view their own appointments" ON public.appointments
    FOR SELECT USING (auth.uid() = client_id);

-- Technicians can see their own appointments
CREATE POLICY "Technicians can view their own appointments" ON public.appointments
    FOR SELECT USING (auth.uid() = technician_id);

-- Clients can create appointments
CREATE POLICY "Clients can book appointments" ON public.appointments
    FOR INSERT WITH CHECK (auth.uid() = client_id);

-- Both parties can update the status (e.g., cancel, confirm)
CREATE POLICY "Parties involved can update appointments" ON public.appointments
    FOR UPDATE USING (auth.uid() = client_id OR auth.uid() = technician_id);
-- Phase 3 Part 3: Dual-Review System & Professionalism Portal

-- Table for Client/Technician Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    reviewee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure a user can only review a specific appointment once
    UNIQUE (appointment_id, reviewer_id)
);

-- Table for Professional Certifications
CREATE TABLE IF NOT EXISTS public.certifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    technician_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, verified, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies Enhancements
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Services are viewable by everyone" ON public.services FOR SELECT USING (true);
CREATE POLICY "Technicians can manage own services" ON public.services 
  FOR ALL USING (auth.uid() = technician_id);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own appointments" ON public.appointments 
  FOR SELECT USING (auth.uid() = client_id OR auth.uid() = technician_id);
CREATE POLICY "Clients can book appointments" ON public.appointments 
  FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Involved parties can update appointments" ON public.appointments 
  FOR UPDATE USING (auth.uid() = client_id OR auth.uid() = technician_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews are viewable by everyone" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Clients can review completed appointments" ON public.reviews 
  FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id AND 
    EXISTS (
      SELECT 1 FROM public.appointments 
      WHERE id = appointment_id 
      AND client_id = auth.uid() 
      AND status = 'completed'
    )
  );

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Messages are viewable by sender or receiver" ON public.messages 
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages" ON public.messages 
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Certs viewable by owner or verified" ON public.certifications 
  FOR SELECT USING (auth.uid() = technician_id OR status = 'verified');
CREATE POLICY "Technicians can upload certs" ON public.certifications 
  FOR INSERT WITH CHECK (auth.uid() = technician_id);

-- Admin Global Policy (example: override for profiles)
CREATE POLICY "Admins have full access to profiles" ON public.profiles 
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

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
  
  -- Notify Technician (Simplified logic)
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.notifications (user_id, title, content, type, link)
    VALUES (NEW.technician_id, 'New Booking Request', 'You have a new booking request. Check your portal!', 'booking', '/#portal');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_appointment_status_changed ON public.appointments;
CREATE TRIGGER on_appointment_status_changed
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
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
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
    p.latitude,
    p.longitude,
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
$$ LANGUAGE plpgsql;
