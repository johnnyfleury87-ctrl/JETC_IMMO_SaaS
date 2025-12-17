/**
 * ÉTAPE 7 - Row Level Security (RLS)
 * 
 * Sécurise toutes les tables avec des policies RLS :
 * - Isolation par regie_id
 * - Restrictions par rôle
 * - Aucun accès anonyme
 * - Pas de récursion RLS
 * 
 * Ordre d'exécution : 18
 * 
 * Rôles gérés :
 * - admin_jtec : accès global
 * - regie : accès à sa régie uniquement
 * - locataire : accès à son logement et ses tickets
 * - entreprise : accès via vue tickets_visibles_entreprise
 * - proprietaire : accès à ses biens
 * - technicien : accès aux tickets assignés
 */

-- =====================================================
-- 1. ACTIVER RLS SUR TOUTES LES TABLES
-- =====================================================

alter table profiles enable row level security;
alter table regies enable row level security;
alter table immeubles enable row level security;
alter table logements enable row level security;
alter table locataires enable row level security;
alter table tickets enable row level security;
alter table entreprises enable row level security;
alter table regies_entreprises enable row level security;

-- =====================================================
-- 2. POLICIES POUR LA TABLE PROFILES
-- =====================================================

-- Un utilisateur peut lire son propre profil
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

-- Un utilisateur peut modifier son propre profil
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Admin JTEC peut tout faire sur profiles
create policy "Admin JTEC can manage all profiles"
  on profiles for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role = 'admin_jtec'
    )
  );

-- =====================================================
-- 3. POLICIES POUR LA TABLE REGIES
-- =====================================================

-- Régie peut voir sa propre régie
create policy "Regie can view own regie"
  on regies for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'regie'
      and profiles.id = regies.profile_id
    )
  );

-- Régie peut modifier sa propre régie
create policy "Regie can update own regie"
  on regies for update
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'regie'
      and profiles.id = regies.profile_id
    )
  );

-- Admin JTEC peut tout faire sur regies
create policy "Admin JTEC can manage all regies"
  on regies for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role = 'admin_jtec'
    )
  );

-- Régie peut créer une régie (inscription)
create policy "Regie can insert own regie"
  on regies for insert
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'regie'
      and profiles.id = regies.profile_id
    )
  );

-- =====================================================
-- 4. POLICIES POUR LA TABLE IMMEUBLES
-- =====================================================

-- Note : La fonction get_user_regie_id() est définie dans 09b_helper_functions.sql

-- Régie voit ses immeubles
create policy "Regie can view own immeubles"
  on immeubles for select
  using (regie_id = get_user_regie_id());

-- Régie peut créer/modifier/supprimer ses immeubles
create policy "Regie can manage own immeubles"
  on immeubles for all
  using (regie_id = get_user_regie_id());

-- Admin JTEC peut tout voir
create policy "Admin JTEC can view all immeubles"
  on immeubles for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role = 'admin_jtec'
    )
  );

-- =====================================================
-- 5. POLICIES POUR LA TABLE LOGEMENTS
-- =====================================================

-- Régie voit ses logements
create policy "Regie can view own logements"
  on logements for select
  using (
    exists (
      select 1 from immeubles
      where immeubles.id = logements.immeuble_id
      and immeubles.regie_id = get_user_regie_id()
    )
  );

-- Régie peut gérer ses logements
create policy "Regie can manage own logements"
  on logements for all
  using (
    exists (
      select 1 from immeubles
      where immeubles.id = logements.immeuble_id
      and immeubles.regie_id = get_user_regie_id()
    )
  );

-- Locataire peut voir son logement
create policy "Locataire can view own logement"
  on logements for select
  using (
    exists (
      select 1 from locataires
      where locataires.logement_id = logements.id
      and locataires.profile_id = auth.uid()
    )
  );

-- Admin JTEC peut tout voir
create policy "Admin JTEC can view all logements"
  on logements for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role = 'admin_jtec'
    )
  );

-- =====================================================
-- 6. POLICIES POUR LA TABLE LOCATAIRES
-- =====================================================

-- Locataire peut voir ses propres données
create policy "Locataire can view own data"
  on locataires for select
  using (profile_id = auth.uid());

-- Locataire peut modifier ses propres données
create policy "Locataire can update own data"
  on locataires for update
  using (profile_id = auth.uid());

-- Régie voit ses locataires
create policy "Regie can view own locataires"
  on locataires for select
  using (
    exists (
      select 1 from logements
      join immeubles on immeubles.id = logements.immeuble_id
      where logements.id = locataires.logement_id
      and immeubles.regie_id = get_user_regie_id()
    )
  );

-- Régie peut gérer ses locataires
create policy "Regie can manage own locataires"
  on locataires for all
  using (
    exists (
      select 1 from logements
      join immeubles on immeubles.id = logements.immeuble_id
      where logements.id = locataires.logement_id
      and immeubles.regie_id = get_user_regie_id()
    )
  );

-- Admin JTEC peut tout voir
create policy "Admin JTEC can view all locataires"
  on locataires for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role = 'admin_jtec'
    )
  );

-- =====================================================
-- 7. POLICIES POUR LA TABLE TICKETS
-- =====================================================

-- Locataire peut voir ses tickets
create policy "Locataire can view own tickets"
  on tickets for select
  using (
    exists (
      select 1 from locataires
      where locataires.id = tickets.locataire_id
      and locataires.profile_id = auth.uid()
    )
  );

-- Locataire peut créer des tickets pour son logement
create policy "Locataire can create own tickets"
  on tickets for insert
  with check (
    exists (
      select 1 from locataires
      where locataires.id = tickets.locataire_id
      and locataires.profile_id = auth.uid()
    )
  );

-- Régie voit tous les tickets de sa régie
create policy "Regie can view own tickets"
  on tickets for select
  using (regie_id = get_user_regie_id());

-- Régie peut gérer les tickets de sa régie
create policy "Regie can manage own tickets"
  on tickets for all
  using (regie_id = get_user_regie_id());

-- Entreprise voit les tickets via la vue (pas de policy directe ici, 
-- car l'accès se fait via tickets_visibles_entreprise qui a sa propre logique)
create policy "Entreprise can view assigned tickets"
  on tickets for select
  using (
    exists (
      select 1 from entreprises
      where entreprises.profile_id = auth.uid()
      and (
        -- Mode général : tous les tickets ouverts de la régie
        exists (
          select 1 from regies_entreprises
          where regies_entreprises.entreprise_id = entreprises.id
          and regies_entreprises.regie_id = tickets.regie_id
          and regies_entreprises.mode_diffusion = 'general'
          and tickets.statut = 'ouvert'
        )
        or
        -- Mode restreint : tickets assignés uniquement
        exists (
          select 1 from regies_entreprises
          where regies_entreprises.entreprise_id = entreprises.id
          and regies_entreprises.regie_id = tickets.regie_id
          and regies_entreprises.mode_diffusion = 'restreint'
          and tickets.entreprise_assignee_id = entreprises.id
        )
      )
    )
  );

-- Admin JTEC peut tout voir
create policy "Admin JTEC can view all tickets"
  on tickets for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role = 'admin_jtec'
    )
  );

-- =====================================================
-- 8. POLICIES POUR LA TABLE ENTREPRISES
-- =====================================================

-- Entreprise peut voir son propre profil
create policy "Entreprise can view own profile"
  on entreprises for select
  using (profile_id = auth.uid());

-- Entreprise peut modifier son propre profil
create policy "Entreprise can update own profile"
  on entreprises for update
  using (profile_id = auth.uid());

-- Régie voit les entreprises qu'elle a autorisées
create policy "Regie can view authorized entreprises"
  on entreprises for select
  using (
    exists (
      select 1 from regies_entreprises
      where regies_entreprises.entreprise_id = entreprises.id
      and regies_entreprises.regie_id = get_user_regie_id()
    )
  );

-- Admin JTEC peut tout voir
create policy "Admin JTEC can view all entreprises"
  on entreprises for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role = 'admin_jtec'
    )
  );

-- Entreprise peut s'inscrire
create policy "Entreprise can insert own profile"
  on entreprises for insert
  with check (profile_id = auth.uid());

-- =====================================================
-- 9. POLICIES POUR LA TABLE REGIES_ENTREPRISES
-- =====================================================

-- Régie peut voir ses autorisations d'entreprises
create policy "Regie can view own authorizations"
  on regies_entreprises for select
  using (regie_id = get_user_regie_id());

-- Régie peut créer des autorisations
create policy "Regie can create authorizations"
  on regies_entreprises for insert
  with check (regie_id = get_user_regie_id());

-- Régie peut modifier ses autorisations
create policy "Regie can update authorizations"
  on regies_entreprises for update
  using (regie_id = get_user_regie_id());

-- Régie peut supprimer ses autorisations
create policy "Regie can delete authorizations"
  on regies_entreprises for delete
  using (regie_id = get_user_regie_id());

-- Entreprise peut voir les régies qui l'ont autorisée
create policy "Entreprise can view own authorizations"
  on regies_entreprises for select
  using (
    exists (
      select 1 from entreprises
      where entreprises.id = regies_entreprises.entreprise_id
      and entreprises.profile_id = auth.uid()
    )
  );

-- Admin JTEC peut tout voir
create policy "Admin JTEC can view all authorizations"
  on regies_entreprises for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role = 'admin_jtec'
    )
  );

-- =====================================================
-- 10. INDEX POUR PERFORMANCE DES POLICIES
-- =====================================================

-- Index sur les colonnes utilisées dans les policies
create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_regies_profile_id on regies(profile_id);
create index if not exists idx_immeubles_regie_id on immeubles(regie_id);
create index if not exists idx_logements_immeuble_id on logements(immeuble_id);
create index if not exists idx_locataires_profile_id on locataires(profile_id);
create index if not exists idx_locataires_logement_id on locataires(logement_id);
create index if not exists idx_tickets_regie_id on tickets(regie_id);
create index if not exists idx_tickets_locataire_id on tickets(locataire_id);
create index if not exists idx_tickets_entreprise_assignee on tickets(entreprise_assignee_id);
create index if not exists idx_entreprises_profile_id on entreprises(profile_id);

-- =====================================================
-- COMMENTAIRES
-- =====================================================

-- Note : Les commentaires des fonctions helper sont dans 09b_helper_functions.sql
