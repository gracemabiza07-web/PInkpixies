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
