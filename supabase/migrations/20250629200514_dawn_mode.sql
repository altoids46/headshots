/*
  # Create photos table for member headshots

  1. New Tables
    - `photos`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users table)
      - `image_url` (text, Supabase storage URL)
      - `file_name` (text, original file name)
      - `file_size` (integer, file size in bytes)
      - `mime_type` (text, image MIME type)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `photos` table
    - Add policies for authenticated users to manage photos in their organization
    - Add policy for users to manage their own photos

  3. Storage
    - Photos will be stored in Supabase storage bucket 'member-photos'
    - File naming convention: {organization_id}/{user_id}/{timestamp}_{filename}
*/

-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  file_name text NOT NULL,
  file_size integer NOT NULL,
  mime_type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS photos_user_id_idx ON photos(user_id);
CREATE INDEX IF NOT EXISTS photos_created_at_idx ON photos(created_at DESC);

-- RLS Policies
-- Users can view photos of members in their organization
CREATE POLICY "Users can view organization member photos"
  ON photos
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT u.id 
      FROM users u 
      JOIN users current_user ON current_user.organization_id = u.organization_id 
      WHERE current_user.id = auth.uid()
    )
  );

-- Users can insert photos for members in their organization
CREATE POLICY "Users can upload photos for organization members"
  ON photos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT u.id 
      FROM users u 
      JOIN users current_user ON current_user.organization_id = u.organization_id 
      WHERE current_user.id = auth.uid()
    )
  );

-- Users can update their own photos or photos they uploaded
CREATE POLICY "Users can update photos they manage"
  ON photos
  FOR UPDATE
  TO authenticated
  USING (
    user_id IN (
      SELECT u.id 
      FROM users u 
      JOIN users current_user ON current_user.organization_id = u.organization_id 
      WHERE current_user.id = auth.uid()
    )
  );

-- Users can delete photos they manage
CREATE POLICY "Users can delete photos they manage"
  ON photos
  FOR DELETE
  TO authenticated
  USING (
    user_id IN (
      SELECT u.id 
      FROM users u 
      JOIN users current_user ON current_user.organization_id = u.organization_id 
      WHERE current_user.id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_photos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS photos_updated_at_trigger ON photos;
CREATE TRIGGER photos_updated_at_trigger
  BEFORE UPDATE ON photos
  FOR EACH ROW
  EXECUTE FUNCTION update_photos_updated_at();