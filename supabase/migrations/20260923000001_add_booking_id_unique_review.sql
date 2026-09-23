-- Add booking_id column to business_reviews table for booking review gating
ALTER TABLE business_reviews 
ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;

-- Add DB-level UNIQUE constraint on booking_id to prevent concurrent review race conditions
ALTER TABLE business_reviews 
ADD CONSTRAINT business_reviews_booking_id_key UNIQUE (booking_id);
