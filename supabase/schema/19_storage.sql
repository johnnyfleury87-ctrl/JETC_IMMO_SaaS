/**
 * ÉTAPE 8 - Storage & fichiers
 * 
 * Ordre d'exécution : 19
 * 
 * Gestion sécurisée des fichiers :
 * - Photos d'immeubles et logements
 * - Signatures de locataires et entreprises
 * - Buckets privés avec RLS
 * - Accès cohérent par rôle
 * 
 * Buckets créés :
 * - photos-immeubles : photos des immeubles
 * - photos-logements : photos des logements
 * - signatures : signatures numériques
 */

-- =====================================================
-- 1. AJOUTER COLONNES POUR STOCKER LES URL DE FICHIERS
-- =====================================================

-- Ajouter photo_url aux immeubles
alter table immeubles
  add column if not exists photo_url text;

-- Ajouter photo_url aux logements
alter table logements
  add column if not exists photo_url text;

-- Ajouter signature_url aux locataires
alter table locataires
  add column if not exists signature_url text;

-- Ajouter signature_url aux entreprises
alter table entreprises
  add column if not exists signature_url text;

-- =====================================================
-- 2. CRÉER LES BUCKETS STORAGE
-- =====================================================

-- Note : Les buckets Storage doivent être créés via l'interface Supabase
-- ou via l'API REST. Le SQL ci-dessous documente la configuration attendue.

-- Bucket : photos-immeubles
-- - Privé (public = false)
-- - Types autorisés : image/jpeg, image/png, image/webp
-- - Taille max : 5MB

-- Bucket : photos-logements
-- - Privé (public = false)
-- - Types autorisés : image/jpeg, image/png, image/webp
-- - Taille max : 5MB

-- Bucket : signatures
-- - Privé (public = false)
-- - Types autorisés : image/png, image/svg+xml
-- - Taille max : 1MB

-- =====================================================
-- 3. POLICIES STORAGE POUR PHOTOS-IMMEUBLES
-- =====================================================

-- Régie peut uploader des photos pour ses immeubles
create policy "Regie can upload photos for own immeubles"
  on storage.objects for insert
  with check (
    bucket_id = 'photos-immeubles'
    and auth.uid() in (
      select regies.profile_id
      from regies
      join immeubles on immeubles.regie_id = regies.id
      where immeubles.id::text = (storage.foldername(name))[1]
    )
  );

-- Régie peut voir les photos de ses immeubles
create policy "Regie can view photos of own immeubles"
  on storage.objects for select
  using (
    bucket_id = 'photos-immeubles'
    and auth.uid() in (
      select regies.profile_id
      from regies
      join immeubles on immeubles.regie_id = regies.id
      where immeubles.id::text = (storage.foldername(name))[1]
    )
  );

-- Régie peut supprimer les photos de ses immeubles
create policy "Regie can delete photos of own immeubles"
  on storage.objects for delete
  using (
    bucket_id = 'photos-immeubles'
    and auth.uid() in (
      select regies.profile_id
      from regies
      join immeubles on immeubles.regie_id = regies.id
      where immeubles.id::text = (storage.foldername(name))[1]
    )
  );

-- Admin JTEC peut tout voir
create policy "Admin JTEC can view all photos immeubles"
  on storage.objects for select
  using (
    bucket_id = 'photos-immeubles'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin_jtec'
    )
  );

-- =====================================================
-- 4. POLICIES STORAGE POUR PHOTOS-LOGEMENTS
-- =====================================================

-- Régie peut uploader des photos pour ses logements
create policy "Regie can upload photos for own logements"
  on storage.objects for insert
  with check (
    bucket_id = 'photos-logements'
    and auth.uid() in (
      select regies.profile_id
      from regies
      join immeubles on immeubles.regie_id = regies.id
      join logements on logements.immeuble_id = immeubles.id
      where logements.id::text = (storage.foldername(name))[1]
    )
  );

-- Régie peut voir les photos de ses logements
create policy "Regie can view photos of own logements"
  on storage.objects for select
  using (
    bucket_id = 'photos-logements'
    and auth.uid() in (
      select regies.profile_id
      from regies
      join immeubles on immeubles.regie_id = regies.id
      join logements on logements.immeuble_id = immeubles.id
      where logements.id::text = (storage.foldername(name))[1]
    )
  );

-- Locataire peut voir la photo de son logement
create policy "Locataire can view photo of own logement"
  on storage.objects for select
  using (
    bucket_id = 'photos-logements'
    and auth.uid() in (
      select locataires.profile_id
      from locataires
      where locataires.logement_id::text = (storage.foldername(name))[1]
    )
  );

-- Régie peut supprimer les photos de ses logements
create policy "Regie can delete photos of own logements"
  on storage.objects for delete
  using (
    bucket_id = 'photos-logements'
    and auth.uid() in (
      select regies.profile_id
      from regies
      join immeubles on immeubles.regie_id = regies.id
      join logements on logements.immeuble_id = immeubles.id
      where logements.id::text = (storage.foldername(name))[1]
    )
  );

-- Admin JTEC peut tout voir
create policy "Admin JTEC can view all photos logements"
  on storage.objects for select
  using (
    bucket_id = 'photos-logements'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin_jtec'
    )
  );

-- =====================================================
-- 5. POLICIES STORAGE POUR SIGNATURES
-- =====================================================

-- Locataire peut uploader sa signature
create policy "Locataire can upload own signature"
  on storage.objects for insert
  with check (
    bucket_id = 'signatures'
    and auth.uid() in (
      select locataires.profile_id
      from locataires
      where locataires.id::text = (storage.foldername(name))[1]
    )
  );

-- Locataire peut voir sa signature
create policy "Locataire can view own signature"
  on storage.objects for select
  using (
    bucket_id = 'signatures'
    and auth.uid() in (
      select locataires.profile_id
      from locataires
      where locataires.id::text = (storage.foldername(name))[1]
    )
  );

-- Régie peut voir les signatures de ses locataires
create policy "Regie can view signatures of own locataires"
  on storage.objects for select
  using (
    bucket_id = 'signatures'
    and auth.uid() in (
      select regies.profile_id
      from regies
      join immeubles on immeubles.regie_id = regies.id
      join logements on logements.immeuble_id = immeubles.id
      join locataires on locataires.logement_id = logements.id
      where locataires.id::text = (storage.foldername(name))[1]
    )
  );

-- Entreprise peut uploader sa signature
create policy "Entreprise can upload own signature"
  on storage.objects for insert
  with check (
    bucket_id = 'signatures'
    and auth.uid() in (
      select entreprises.profile_id
      from entreprises
      where entreprises.id::text = (storage.foldername(name))[1]
    )
  );

-- Entreprise peut voir sa signature
create policy "Entreprise can view own signature"
  on storage.objects for select
  using (
    bucket_id = 'signatures'
    and auth.uid() in (
      select entreprises.profile_id
      from entreprises
      where entreprises.id::text = (storage.foldername(name))[1]
    )
  );

-- Régie peut voir les signatures des entreprises autorisées
create policy "Regie can view signatures of authorized entreprises"
  on storage.objects for select
  using (
    bucket_id = 'signatures'
    and auth.uid() in (
      select regies.profile_id
      from regies
      join regies_entreprises on regies_entreprises.regie_id = regies.id
      join entreprises on entreprises.id = regies_entreprises.entreprise_id
      where entreprises.id::text = (storage.foldername(name))[1]
    )
  );

-- Admin JTEC peut tout voir
create policy "Admin JTEC can view all signatures"
  on storage.objects for select
  using (
    bucket_id = 'signatures'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin_jtec'
    )
  );

-- =====================================================
-- 6. COMMENTAIRES
-- =====================================================

comment on column immeubles.photo_url is 'URL de la photo de l''immeuble (Storage)';
comment on column logements.photo_url is 'URL de la photo du logement (Storage)';
comment on column locataires.signature_url is 'URL de la signature du locataire (Storage)';
comment on column entreprises.signature_url is 'URL de la signature de l''entreprise (Storage)';
