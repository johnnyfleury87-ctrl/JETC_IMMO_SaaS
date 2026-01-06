-- Migration: Création Storage bucket pour photos missions techniciens
-- Date: 2026-01-06
-- Description: Configure Supabase Storage pour upload photos missions par techniciens
-- Référence: ÉTAPE 5 REPORT_FIX_VUE_TECHNICIEN.md

-- =====================================================
-- CRÉER BUCKET STORAGE
-- =====================================================

-- Créer bucket mission-photos (public pour affichage direct)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mission-photos',
  'mission-photos',
  true,
  10485760, -- 10 MB max par fichier
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

-- =====================================================
-- POLICIES RLS STORAGE
-- =====================================================

-- Policy 1: Techniciens peuvent uploader photos dans leurs missions
-- Path format: missions/{mission_id}/{filename}
CREATE POLICY "Techniciens can upload mission photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'mission-photos'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 
    FROM techniciens t
    INNER JOIN missions m ON m.technicien_id = t.id
    WHERE t.profile_id = auth.uid()
      AND (storage.foldername(name))[1] = 'missions'
      AND (storage.foldername(name))[2] = m.id::text
  )
);

-- Policy 2: Lecture publique des photos (pour affichage dans dashboard)
CREATE POLICY "Anyone can view mission photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'mission-photos');

-- Policy 3: Techniciens peuvent supprimer leurs propres photos
CREATE POLICY "Techniciens can delete their mission photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'mission-photos'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 
    FROM techniciens t
    INNER JOIN missions m ON m.technicien_id = t.id
    WHERE t.profile_id = auth.uid()
      AND (storage.foldername(name))[1] = 'missions'
      AND (storage.foldername(name))[2] = m.id::text
  )
);

-- =====================================================
-- COMMENTAIRES
-- =====================================================

COMMENT ON POLICY "Techniciens can upload mission photos" ON storage.objects IS 
'Permet aux techniciens d''uploader des photos uniquement dans les dossiers de leurs missions assignées';

COMMENT ON POLICY "Anyone can view mission photos" ON storage.objects IS 
'Lecture publique des photos pour affichage dans les dashboards (bucket public)';

COMMENT ON POLICY "Techniciens can delete their mission photos" ON storage.objects IS 
'Permet aux techniciens de supprimer leurs propres photos si erreur';
