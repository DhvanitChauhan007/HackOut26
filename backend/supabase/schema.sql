-- ============================================================
-- Circular Packaging & Materials Exchange — Database Schema
-- Run this against your Supabase Postgres instance.
-- ============================================================

-- Custom enum types
CREATE TYPE user_role AS ENUM ('manufacturer', 'retailer', 'recycler', 'logistics');
CREATE TYPE listing_status AS ENUM ('open', 'claimed', 'completed');
CREATE TYPE request_status AS ENUM ('pending', 'accepted', 'declined');
CREATE TYPE transaction_status AS ENUM ('pending', 'estimated', 'committed', 'completed');
CREATE TYPE job_status AS ENUM ('open', 'assigned', 'delivered');
CREATE TYPE bulk_lot_status AS ENUM ('forming', 'open', 'claimed', 'completed', 'dissolved');

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY,  -- matches Supabase Auth uid
  name TEXT NOT NULL,
  role user_role NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION,
  long DOUBLE PRECISION,
  is_fixed_recycler BOOLEAN DEFAULT FALSE,
  is_seed BOOLEAN DEFAULT FALSE,
  auto_accept BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LISTINGS
-- ============================================================
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id),
  material_type TEXT NOT NULL,
  sub_grade TEXT,
  contamination_pct NUMERIC DEFAULT 0,
  quantity NUMERIC NOT NULL,
  unit TEXT DEFAULT 'kg',
  condition TEXT,
  photo_url TEXT,
  list_price NUMERIC NOT NULL,
  price_floor NUMERIC NOT NULL,
  decay_window_seconds INTEGER NOT NULL,
  pickup_lat DOUBLE PRECISION,
  pickup_long DOUBLE PRECISION,
  status listing_status DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listings_seller ON listings(seller_id);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_material ON listings(material_type);

-- ============================================================
-- REQUESTS
-- ============================================================
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  status request_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_requests_listing ON requests(listing_id);
CREATE INDEX idx_requests_buyer ON requests(buyer_id);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id),       -- nullable for bulk
  request_id UUID REFERENCES requests(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID REFERENCES users(id),            -- nullable for bulk
  bulk_lot_id UUID,                                -- set for bulk purchases
  distance_km NUMERIC,
  estimated_cost NUMERIC,
  status transaction_status DEFAULT 'pending',
  impact_kg_diverted NUMERIC,
  impact_co2e_kg NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_transactions_buyer ON transactions(buyer_id);
CREATE INDEX idx_transactions_seller ON transactions(seller_id);
CREATE INDEX idx_transactions_listing ON transactions(listing_id);

-- ============================================================
-- JOBS
-- ============================================================
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  logistics_company_id UUID REFERENCES users(id),
  pickup_lat DOUBLE PRECISION,
  pickup_long DOUBLE PRECISION,
  dropoff_lat DOUBLE PRECISION,
  dropoff_long DOUBLE PRECISION,
  distance_km NUMERIC,
  estimated_cost NUMERIC,
  status job_status DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_logistics ON jobs(logistics_company_id);

-- ============================================================
-- DISTANCE CACHE
-- ============================================================
CREATE TABLE distance_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_lat DOUBLE PRECISION NOT NULL,
  origin_long DOUBLE PRECISION NOT NULL,
  dest_lat DOUBLE PRECISION NOT NULL,
  dest_long DOUBLE PRECISION NOT NULL,
  distance_km NUMERIC NOT NULL,
  duration_min NUMERIC NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_distance_cache_coords ON distance_cache(origin_lat, origin_long, dest_lat, dest_long);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  type TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);

-- ============================================================
-- EMISSION FACTORS
-- ============================================================
CREATE TABLE emission_factors (
  material_type TEXT PRIMARY KEY,
  co2e_kg_per_kg NUMERIC NOT NULL,
  source_note TEXT
);

-- ============================================================
-- RATINGS
-- ============================================================
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  rater_id UUID NOT NULL REFERENCES users(id),
  ratee_id UUID NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(transaction_id, rater_id, ratee_id)
);

CREATE INDEX idx_ratings_ratee ON ratings(ratee_id);

-- ============================================================
-- BULK LOTS
-- ============================================================
CREATE TABLE bulk_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_type TEXT NOT NULL,
  sub_grade TEXT,
  status bulk_lot_status DEFAULT 'forming',
  total_quantity NUMERIC DEFAULT 0,
  bulk_rate_per_kg NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bulk_lots_status ON bulk_lots(status);
CREATE INDEX idx_bulk_lots_material ON bulk_lots(material_type, sub_grade);

-- ============================================================
-- BULK LOT ITEMS
-- ============================================================
CREATE TABLE bulk_lot_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_lot_id UUID NOT NULL REFERENCES bulk_lots(id),
  listing_id UUID NOT NULL REFERENCES listings(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  quantity NUMERIC NOT NULL,
  pickup_lat DOUBLE PRECISION,
  pickup_long DOUBLE PRECISION
);

CREATE INDEX idx_bulk_lot_items_lot ON bulk_lot_items(bulk_lot_id);
CREATE INDEX idx_bulk_lot_items_listing ON bulk_lot_items(listing_id);

-- ============================================================
-- JOB STOPS (multi-stop for bulk jobs)
-- ============================================================
CREATE TABLE job_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  listing_id UUID NOT NULL REFERENCES listings(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  pickup_lat DOUBLE PRECISION,
  pickup_long DOUBLE PRECISION,
  seq_order INTEGER
);

CREATE INDEX idx_job_stops_job ON job_stops(job_id);

-- ============================================================
-- BULK RATES (illustrative placeholder values)
-- ============================================================
CREATE TABLE bulk_rates (
  material_type TEXT PRIMARY KEY,
  bulk_rate_per_kg NUMERIC NOT NULL
);

-- Add foreign key from transactions to bulk_lots
ALTER TABLE transactions
  ADD CONSTRAINT fk_transactions_bulk_lot
  FOREIGN KEY (bulk_lot_id) REFERENCES bulk_lots(id);

-- ============================================================
-- ENABLE REALTIME on notifications table
-- (Supabase-specific: allows frontend to subscribe to changes)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
