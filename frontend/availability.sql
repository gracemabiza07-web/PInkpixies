-- Phase 2: Scheduling & Availability Logic

-- 1. Table for Professional Working Hours
CREATE TABLE IF NOT EXISTS public.working_hours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  technician_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6) NOT NULL, -- 0 = Sunday, 1 = Monday, etc.
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

  -- 1. Check if it's within working hours
  SELECT EXISTS (
    SELECT 1 FROM public.working_hours 
    WHERE technician_id = p_technician_id 
    AND day_of_week = v_day_of_week
    AND v_time_only >= start_time 
    AND (v_end_time::time) <= end_time
  ) INTO v_in_working_hours;

  IF NOT v_in_working_hours THEN
    RETURN FALSE;
  END IF;

  -- 2. Check for overlapping appointments
  SELECT EXISTS (
    SELECT 1 FROM public.appointments
    WHERE technician_id = p_technician_id
    AND status IN ('confirmed', 'pending')
    AND start_time < v_end_time
    AND end_time > p_start_time
  ) INTO v_has_conflict;

  IF v_has_conflict THEN
    RETURN FALSE;
  END IF;

  -- 3. Check for blocked slots
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_slots
    WHERE technician_id = p_technician_id
    AND start_time < v_end_time
    AND end_time > p_start_time
  ) INTO v_has_conflict;

  IF v_has_conflict THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 4. Constraint trigger to prevent double booking on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.prevent_double_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- We assume New.service_id provides the duration normally, 
  -- but for simplicity we check availability using the record's start/end times directly.
  IF NOT public.check_availability(
    NEW.technician_id, 
    NEW.start_time, 
    extract(epoch from (NEW.end_time - NEW.start_time))::integer / 60
  ) THEN
    RAISE EXCEPTION 'This slot is no longer available.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Uncomment the following lines if you want to strictly enforce this at the DB level
-- DROP TRIGGER IF EXISTS enforce_availability ON public.appointments;
-- CREATE TRIGGER enforce_availability
--   BEFORE INSERT OR UPDATE ON public.appointments
--   FOR EACH ROW EXECUTE PROCEDURE public.prevent_double_booking();
