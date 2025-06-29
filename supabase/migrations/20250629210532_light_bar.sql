/*
  # Create photos table for member headshots

  1. New Tables
    - `photos`
      - `id` (uuid, primary key)
      - `takenbyuserId` (uuid, foreign key to users table)
      - `imageurl` (text, Supabase storage URL)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `photos` table
    - Add policies for authenticated users to manage photos in their organization

  3. Notes
    - Column names match existing schema: takenbyuserId, imageurl
    - Simplified structure to match current application usage
*/

-- Create photos table with correct column names to match existing schema
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "takenbyuserId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  imageurl text NOT NULL,
  created_at timestamptz DEFAULT (now() AT TIME ZONE 'utc'::text)
);

-- Enable RLS
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS photos_takenbyuserid_idx ON photos("takenbyuserId");
CREATE INDEX IF NOT EXISTS photos_created_at_idx ON photos(created_at DESC);

-- RLS Policies
-- Users can view photos of members in their organization
CREATE POLICY "Users can view organization member photos"
  ON photos
  FOR SELECT
  TO authenticated
  USING (
    "takenbyuserId" IN (
      SELECT u.id 
      FROM users u 
      JOIN users requesting_user ON requesting_user.organization_id = u.organization_id 
      WHERE requesting_user.id = auth.uid()
    )
  );

-- Users can insert photos for members in their organization
CREATE POLICY "Users can upload photos for organization members"
  ON photos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    "takenbyuserId" IN (
      SELECT u.id 
      FROM users u 
      JOIN users requesting_user ON requesting_user.organization_id = u.organization_id 
      WHERE requesting_user.id = auth.uid()
    )
  );

-- Users can update photos they manage
CREATE POLICY "Users can update photos they manage"
  ON photos
  FOR UPDATE
  TO authenticated
  USING (
    "takenbyuserId" IN (
      SELECT u.id 
      FROM users u 
      JOIN users requesting_user ON requesting_user.organization_id = u.organization_id 
      WHERE requesting_user.id = auth.uid()
    )
  );

-- Users can delete photos they manage
CREATE POLICY "Users can delete photos they manage"
  ON photos
  FOR DELETE
  TO authenticated
  USING (
    "takenbyuserId" IN (
      SELECT u.id 
      FROM users u 
      JOIN users requesting_user ON requesting_user.organization_id = u.organization_id 
      WHERE requesting_user.id = auth.uid()
    )
  );