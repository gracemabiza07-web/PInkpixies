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

-- RLS Policies for Reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews are viewable by everyone" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users can insert their own reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- RLS Policies for Certifications
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Technicians can view their own certs" ON public.certifications FOR SELECT USING (auth.uid() = technician_id);
-- Admins/public might need to view verified certs
CREATE POLICY "Public can view verified certs" ON public.certifications FOR SELECT USING (status = 'verified');
CREATE POLICY "Technicians can insert their own certs" ON public.certifications FOR INSERT WITH CHECK (auth.uid() = technician_id);
