-- ============================================================
-- 🚀 MIGRATION RAPIDE M47 - STORAGE MISSION-PHOTOS
-- ============================================================
-- À COPIER-COLLER dans : Dashboard Supabase > SQL Editor
-- Puis cliquer "RUN" pour appliquer
-- ============================================================

-- 1️⃣ Créer bucket mission-photos (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mission-photos',
  'mission-photos',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

-- ✅ Si succès : "INSERT 0 1" ou "UPDATE 1"

-- 2️⃣ Policy INSERT : Techniciens peuvent uploader
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

-- ✅ Si succès : "CREATE POLICY"

-- 3️⃣ Policy SELECT : Lecture publique
CREATE POLICY "Anyone can view mission photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'mission-photos');

-- ✅ Si succès : "CREATE POLICY"

-- 4️⃣ Policy DELETE : Techniciens peuvent supprimer leurs photos
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

-- ✅ Si succès : "CREATE POLICY"

-- ============================================================
-- VÉRIFICATION (optionnel)
-- ============================================================

-- Vérifier bucket créé
SELECT 
  id,
  name,
  public,
  file_size_limit / 1048576 as max_size_mb,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'mission-photos';

-- Résultat attendu:
-- id: mission-photos
-- public: true
-- max_size_mb: 10
-- allowed_mime_types: {image/jpeg, image/png, image/webp, image/heic}

-- Vérifier policies créées
SELECT 
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname ILIKE '%mission%photo%'
ORDER BY policyname;

-- Résultat attendu: 3 policies
-- - Anyone can view mission photos (SELECT)
-- - Techniciens can delete their mission photos (DELETE)
-- - Techniciens can upload mission photos (INSERT)

-- ============================================================
-- ✅ MIGRATION TERMINÉE
-- ============================================================
-- Vous pouvez maintenant tester l'upload de photos dans la vue technicien
