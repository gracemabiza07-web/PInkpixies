-- Seed Data for Phase 5 Discovery Testing

-- 1. Create Mock Technicians
-- Note: Replace UUIDs if you want to link them to real auth.users later.
-- For now, this just populates the public table for discovery rendering.

INSERT INTO public.profiles (id, role, full_name, username, avatar_url, bio, location, is_pink_badge, post_vibes)
VALUES 
('d5e89101-7b3e-4d51-897d-4818a7a51001', 'technician', 'Zoe Nails', 'zoe_nails', 'https://images.unsplash.com/photo-1519014816548-bf5fe059e98b?auto=format&fit=crop&w=500&q=80', 'Specialist in Russian manis and precision art.', 'Lusaka, ZM', true, 1250),
('d5e89101-7b3e-4d51-897d-4818a7a51002', 'technician', 'Ebony Beauty', 'ebony_b', 'https://images.unsplash.com/photo-1512496015851-a1dc8a47814b?auto=format&fit=crop&w=500&q=80', 'Master of hybrid and mega volume lash sets.', 'Ndola, ZM', false, 450),
('d5e89101-7b3e-4d51-897d-4818a7a51003', 'technician', 'Graceful Tips', 'grace_tips', 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=500&q=80', 'Artistic acrylics and structural overlays.', 'Lusaka, ZM', true, 980);

-- 2. Add Services for them
INSERT INTO public.services (technician_id, title, description, price, duration_minutes, base_price, base_currency)
VALUES 
('d5e89101-7b3e-4d51-897d-4818a7a51001', 'Signature Gel Set', 'Classic long lasting gel nails.', 300, 60, 300, 'ZMW'),
('d5e89101-7b3e-4d51-897d-4818a7a51001', 'Nail Art (Per Finger)', 'Intricate hand painted designs.', 50, 15, 50, 'ZMW'),
('d5e89101-7b3e-4d51-897d-4818a7a51002', 'Hybrid Lash Extensions', 'Perfect mix of volume and length.', 450, 90, 450, 'ZMW'),
('d5e89101-7b3e-4d51-897d-4818a7a51003', 'Acrylic Full Set', 'Classic strong extensions.', 350, 75, 350, 'ZMW');

-- 3. Add Mock Reviews
INSERT INTO public.reviews (reviewer_id, reviewee_id, rating, comment)
VALUES 
('d5e89101-7b3e-4d51-897d-4818a7a51001', 'd5e89101-7b3e-4d51-897d-4818a7a51001', 5, 'Absolutely incredible work!'),
('d5e89101-7b3e-4d51-897d-4818a7a51001', 'd5e89101-7b3e-4d51-897d-4818a7a51002', 4, 'Very nice lashes, lasted 3 weeks.'),
('d5e89101-7b3e-4d51-897d-4818a7a51001', 'd5e89101-7b3e-4d51-897d-4818a7a51003', 5, 'Highly recommend for extensions.');
