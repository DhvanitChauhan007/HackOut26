-- ENUMS
CREATE TYPE user_role AS ENUM ('manufacturer', 'retailer', 'recycler', 'logistics');
CREATE TYPE listing_status AS ENUM ('open', 'claimed', 'completed');
CREATE TYPE request_status AS ENUM ('pending', 'accepted', 'declined');
CREATE TYPE transaction_status AS ENUM ('pending', 'estimated', 'committed', 'completed');
CREATE TYPE job_status AS ENUM ('open', 'assigned', 'delivered');
CREATE TYPE bulk_lot_status AS ENUM ('forming', 'open', 'claimed', 'completed', 'dissolved');

-- TABLES
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    name TEXT NOT NULL,
    role user_role NOT NULL,
    address TEXT,
    lat FLOAT,
    long FLOAT,
    is_fixed_recycler BOOLEAN DEFAULT FALSE,
    is_seed BOOLEAN DEFAULT FALSE,
    auto_accept BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID REFERENCES users(id) NOT NULL,
    material_type TEXT NOT NULL,
    sub_grade TEXT,
    contamination_pct NUMERIC,
    quantity NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    condition TEXT,
    photo_url TEXT,
    list_price NUMERIC NOT NULL,
    price_floor NUMERIC NOT NULL,
    decay_window_seconds INT NOT NULL,
    pickup_lat FLOAT NOT NULL,
    pickup_long FLOAT NOT NULL,
    status listing_status DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID REFERENCES listings(id) NOT NULL,
    buyer_id UUID REFERENCES users(id) NOT NULL,
    status request_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bulk_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_type TEXT NOT NULL,
    sub_grade TEXT,
    status bulk_lot_status DEFAULT 'forming',
    total_quantity NUMERIC DEFAULT 0,
    bulk_rate_per_kg NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bulk_lot_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bulk_lot_id UUID REFERENCES bulk_lots(id) NOT NULL,
    listing_id UUID REFERENCES listings(id) NOT NULL,
    seller_id UUID REFERENCES users(id) NOT NULL,
    quantity NUMERIC NOT NULL,
    pickup_lat FLOAT NOT NULL,
    pickup_long FLOAT NOT NULL
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID REFERENCES listings(id),
    bulk_lot_id UUID REFERENCES bulk_lots(id),
    request_id UUID REFERENCES requests(id),
    buyer_id UUID REFERENCES users(id) NOT NULL,
    seller_id UUID REFERENCES users(id),
    distance_km NUMERIC,
    estimated_cost NUMERIC,
    status transaction_status DEFAULT 'pending',
    impact_kg_diverted NUMERIC,
    impact_co2e_kg NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT transaction_target_check CHECK (
        (listing_id IS NOT NULL AND seller_id IS NOT NULL AND bulk_lot_id IS NULL) OR
        (bulk_lot_id IS NOT NULL AND listing_id IS NULL AND seller_id IS NULL)
    )
);

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id) NOT NULL,
    logistics_company_id UUID REFERENCES users(id),
    pickup_lat FLOAT,
    pickup_long FLOAT,
    dropoff_lat FLOAT NOT NULL,
    dropoff_long FLOAT NOT NULL,
    distance_km NUMERIC,
    estimated_cost NUMERIC,
    status job_status DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ
);

CREATE TABLE job_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) NOT NULL,
    listing_id UUID REFERENCES listings(id) NOT NULL,
    seller_id UUID REFERENCES users(id) NOT NULL,
    pickup_lat FLOAT NOT NULL,
    pickup_long FLOAT NOT NULL,
    seq_order INT NOT NULL
);

CREATE TABLE distance_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_lat FLOAT NOT NULL,
    origin_long FLOAT NOT NULL,
    dest_lat FLOAT NOT NULL,
    dest_long FLOAT NOT NULL,
    distance_km NUMERIC NOT NULL,
    duration_min NUMERIC NOT NULL,
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(origin_lat, origin_long, dest_lat, dest_long)
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    message TEXT NOT NULL,
    type TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE emission_factors (
    material_type TEXT PRIMARY KEY,
    co2e_kg_per_kg NUMERIC NOT NULL,
    source_note TEXT
);

CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id) NOT NULL,
    rater_id UUID REFERENCES users(id) NOT NULL,
    ratee_id UUID REFERENCES users(id) NOT NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(transaction_id, rater_id, ratee_id)
);

CREATE TABLE bulk_rates (
    material_type TEXT PRIMARY KEY,
    bulk_rate_per_kg NUMERIC NOT NULL
);

-- RLS / Security
-- (Note: If using standard Supabase keys from the frontend directly, enable RLS. 
-- However, since this API is designed with an Express backend holding the service_role key,
-- we do not strictly need RLS for the backend requests, but it is best practice).
