-- Migration: Création Storage bucket pour photos missions techniciens
-- Date: 2026-01-06
-- Description: Configure Supabase Storage pour upload photos missions par techniciens
-- Référence: ÉTAPE 5 REPORT_FIX_VUE_TECHNICIEN.md

-- =====================================================
-- PARTIE 1: CRÉER BUCKET STORAGE (via SQL)
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
-- PARTIE 2: POLICIES RLS STORAGE (via UI Supabase)
-- =====================================================

-- ⚠️  IMPORTANT: Les policies storage.objects NE PEUVENT PAS être créées via SQL
-- Elles doivent être configurées manuellement dans l'interface Supabase :
--
-- 1. Aller sur : https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/storage/buckets/mission-photos
-- 2. Cliquer sur "Policies" puis "New Policy"
-- 3. Créer les 3 policies suivantes :

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ POLICY 1: Techniciens can upload mission photos                    │
-- ├─────────────────────────────────────────────────────────────────────┤
-- │ Policy Name: Techniciens can upload mission photos                 │
-- │ Allowed operation: INSERT                                           │
-- │ Target roles: authenticated                                         │
-- │ WITH CHECK expression:                                              │
-- │                                                                     │
-- │ bucket_id = 'mission-photos'                                        │
-- │ AND EXISTS (                                                        │
-- │   SELECT 1                                                          │
-- │   FROM techniciens t                                                │
-- │   INNER JOIN missions m ON m.technicien_id = t.id                   │
-- │   WHERE t.profile_id = auth.uid()                                   │
-- │     AND (storage.foldername(name))[1] = 'missions'                  │
-- │     AND (storage.foldername(name))[2] = m.id::text                  │
-- │ )                                                                   │
-- └─────────────────────────────────────────────────────────────────────┘

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ POLICY 2: Anyone can view mission photos                           │
-- ├─────────────────────────────────────────────────────────────────────┤
-- │ Policy Name: Anyone can view mission photos                         │
-- │ Allowed operation: SELECT                                           │
-- │ Target roles: public                                                │
-- │ USING expression:                                                   │
-- │                                                                     │
-- │ bucket_id = 'mission-photos'                                        │
-- └─────────────────────────────────────────────────────────────────────┘

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ POLICY 3: Techniciens can delete their mission photos              │
-- ├─────────────────────────────────────────────────────────────────────┤
-- │ Policy Name: Techniciens can delete their mission photos            │
-- │ Allowed operation: DELETE                                           │
-- │ Target roles: authenticated                                         │
-- │ USING expression:                                                   │
-- │                                                                     │
-- │ bucket_id = 'mission-photos'                                        │
-- │ AND EXISTS (                                                        │
-- │   SELECT 1                                                          │
-- │   FROM techniciens t                                                │
-- │   INNER JOIN missions m ON m.technicien_id = t.id                   │
-- │   WHERE t.profile_id = auth.uid()                                   │
-- │     AND (storage.foldername(name))[1] = 'missions'                  │
-- │     AND (storage.foldername(name))[2] = m.id::text                  │
-- │ )                                                                   │
-- └─────────────────────────────────────────────────────────────────────┘

-- =====================================================
-- VALIDATION
-- =====================================================

-- Vérifier que le bucket a été créé
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'mission-photos';
