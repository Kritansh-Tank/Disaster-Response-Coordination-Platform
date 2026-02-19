-- ============================================
-- Disaster Response Coordination Platform
-- Supabase PostgreSQL Schema
-- ============================================

-- Enable PostGIS extension for geospatial support
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- 1. DISASTERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS disasters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  location_name TEXT,
  location GEOGRAPHY(POINT, 4326),
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  owner_id TEXT NOT NULL,
  audit_trail JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geospatial index for fast location queries
CREATE INDEX IF NOT EXISTS disasters_location_idx ON disasters USING GIST (location);

-- GIN index for tag filtering
CREATE INDEX IF NOT EXISTS disasters_tags_idx ON disasters USING GIN (tags);

-- Index for owner-based filtering
CREATE INDEX IF NOT EXISTS disasters_owner_idx ON disasters (owner_id);

-- ============================================
-- 2. REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  disaster_id UUID NOT NULL REFERENCES disasters(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'fake', 'unverifiable')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reports_disaster_idx ON reports (disaster_id);

-- ============================================
-- 3. RESOURCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  disaster_id UUID NOT NULL REFERENCES disasters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_name TEXT,
  location GEOGRAPHY(POINT, 4326),
  type TEXT NOT NULL CHECK (type IN ('shelter', 'hospital', 'food', 'water', 'supplies', 'evacuation', 'other')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geospatial index for fast resource lookups
CREATE INDEX IF NOT EXISTS resources_location_idx ON resources USING GIST (location);

CREATE INDEX IF NOT EXISTS resources_disaster_idx ON resources (disaster_id);

-- ============================================
-- 4. CACHE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS cache_expires_idx ON cache (expires_at);

-- ============================================
-- 5. RPC FUNCTION: Find nearby resources
-- ============================================
CREATE OR REPLACE FUNCTION find_nearby_resources(
  p_lat DOUBLE PRECISION,
  p_lon DOUBLE PRECISION,
  p_radius_meters DOUBLE PRECISION DEFAULT 10000,
  p_disaster_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  disaster_id UUID,
  name TEXT,
  location_name TEXT,
  type TEXT,
  distance_meters DOUBLE PRECISION,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.disaster_id,
    r.name,
    r.location_name,
    r.type,
    ST_Distance(r.location, ST_SetSRID(ST_Point(p_lon, p_lat), 4326)::geography) AS distance_meters,
    r.created_at
  FROM resources r
  WHERE ST_DWithin(
    r.location,
    ST_SetSRID(ST_Point(p_lon, p_lat), 4326)::geography,
    p_radius_meters
  )
  AND (p_disaster_id IS NULL OR r.disaster_id = p_disaster_id)
  ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. RPC FUNCTION: Clean expired cache
-- ============================================
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
