-- Migration: 006_booking_multi_service.sql
-- Description: Add multi-service support to appointments

-- 1. Add total_price and currency to appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS total_price NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'ZMW';

-- 2. Create appointment_services join table
CREATE TABLE IF NOT EXISTS public.appointment_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  price_at_booking NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for appointment_services
ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view services for their own appointments" ON public.appointment_services
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.appointments a 
      WHERE a.id = appointment_id 
      AND (auth.uid() = a.client_id OR auth.uid() = a.technician_id)
    )
  );

-- 3. Update check_availability to handle multi-appointment technician views if needed (optional)
-- The existing check_availability works on a per-slot basis, which is fine for now.
