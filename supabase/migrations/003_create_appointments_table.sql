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
