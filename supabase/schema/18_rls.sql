/**
 * ÉTAPE 7 - Row Level Security (RLS)
 *
 * Objectifs :
 * - Isolation stricte par regie_id
 * - Accès par rôle métier
 * - Aucun accès anonyme
 * - Aucune référence à des colonnes inexistantes
 *
 * Ordre d'exécution : 18
 */

-- =====================================================
-- 1. ACTIVER RLS SUR LES TABLES
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
-- 2. PROFILES
-- =====================================================

create policy "Users can view own profile"
on profiles for select
using (auth.uid() = id);

create policy "Users can update own profile"
on profiles for update
using (auth.uid() = id);

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
-- 3. REGIES
-- =====================================================

create policy "Regie can view own regie"
on regies for select
using (profile_id = auth.uid());

create policy "Regie can update own regie"
on regies for update
using (profile_id = auth.uid());

create policy "Regie can insert own regie"
on regies for insert
with check (profile_id = auth.uid());

create policy "Admin JTEC can manage all regies"
on regies for all
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'admin_jtec'
  )
);

-- =====================================================
-- 4. IMMEUBLES
-- =====================================================

-- get_user_regie_id() définie dans 09b_helper_functions_metier.sql

create policy "Regie can view own immeubles"
on immeubles for select
using (regie_id = get_user_regie_id());

create policy "Regie can manage own immeubles"
on immeubles for all
using (regie_id = get_user_regie_id());

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
-- 5. LOGEMENTS
-- =====================================================

create policy "Regie can view own logements"
on logements for select
using (
  exists (
    select 1
    from immeubles
    where immeubles.id = logements.immeuble_id
      and immeubles.regie_id = get_user_regie_id()
  )
);

create policy "Regie can manage own logements"
on logements for all
using (
  exists (
    select 1
    from immeubles
    where immeubles.id = logements.immeuble_id
      and immeubles.regie_id = get_user_regie_id()
  )
);

create policy "Locataire can view own logement"
on logements for select
using (
  exists (
    select 1
    from locataires
    where locataires.logement_id = logements.id
      and locataires.profile_id = auth.uid()
  )
);

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
-- 6. LOCATAIRES
-- =====================================================

create policy "Locataire can view own data"
on locataires for select
using (profile_id = auth.uid());

create policy "Locataire can update own data"
on locataires for update
using (profile_id = auth.uid());

create policy "Regie can view own locataires"
on locataires for select
using (
  exists (
    select 1
    from logements
    join immeubles on immeubles.id = logements.immeuble_id
    where logements.id = locataires.logement_id
      and immeubles.regie_id = get_user_regie_id()
  )
);

create policy "Regie can manage own locataires"
on locataires for all
using (
  exists (
    select 1
    from logements
    join immeubles on immeubles.id = logements.immeuble_id
    where logements.id = locataires.logement_id
      and immeubles.regie_id = get_user_regie_id()
  )
);

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
-- 7. TICKETS
-- =====================================================

create policy "Locataire can view own tickets"
on tickets for select
using (
  exists (
    select 1
    from locataires
    where locataires.id = tickets.locataire_id
      and locataires.profile_id = auth.uid()
  )
);

create policy "Locataire can create own tickets"
on tickets for insert
with check (
  exists (
    select 1
    from locataires
    where locataires.id = tickets.locataire_id
      and locataires.profile_id = auth.uid()
  )
);

create policy "Regie can view own tickets"
on tickets for select
using (regie_id = get_user_regie_id());

create policy "Regie can manage own tickets"
on tickets for all
using (regie_id = get_user_regie_id());

-- ⚠️ CORRECTION MAJEURE ICI :
-- On utilise tickets.entreprise_id (colonne EXISTANTE)

create policy "Entreprise can view authorized tickets"
on tickets for select
using (
  exists (
    select 1
    from entreprises e
    where e.profile_id = auth.uid()
      and (
        exists (
          select 1
          from regies_entreprises re
          where re.entreprise_id = e.id
            and re.regie_id = tickets.regie_id
            and re.mode_diffusion = 'general'
            and tickets.statut = 'ouvert'
        )
        or
        exists (
          select 1
          from regies_entreprises re
          where re.entreprise_id = e.id
            and re.regie_id = tickets.regie_id
            and re.mode_diffusion = 'restreint'
            and tickets.entreprise_id = e.id
        )
      )
  )
);

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
-- 8. ENTREPRISES
-- =====================================================

create policy "Entreprise can view own profile"
on entreprises for select
using (profile_id = auth.uid());

create policy "Entreprise can update own profile"
on entreprises for update
using (profile_id = auth.uid());

create policy "Entreprise can insert own profile"
on entreprises for insert
with check (profile_id = auth.uid());

create policy "Regie can view authorized entreprises"
on entreprises for select
using (
  exists (
    select 1
    from regies_entreprises
    where regies_entreprises.entreprise_id = entreprises.id
      and regies_entreprises.regie_id = get_user_regie_id()
  )
);

create policy "Admin JTEC can view all entreprises"
on entreprises for select
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'admin_jtec'
  )
);

-- =====================================================
-- 9. REGIES_ENTREPRISES
-- =====================================================

create policy "Regie can view own authorizations"
on regies_entreprises for select
using (regie_id = get_user_regie_id());

create policy "Regie can create authorizations"
on regies_entreprises for insert
with check (regie_id = get_user_regie_id());

create policy "Regie can update authorizations"
on regies_entreprises for update
using (regie_id = get_user_regie_id());

create policy "Regie can delete authorizations"
on regies_entreprises for delete
using (regie_id = get_user_regie_id());

create policy "Entreprise can view own authorizations"
on regies_entreprises for select
using (
  exists (
    select 1
    from entreprises
    where entreprises.id = regies_entreprises.entreprise_id
      and entreprises.profile_id = auth.uid()
  )
);

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
-- 10. INDEX POUR PERFORMANCE RLS
-- =====================================================

create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_regies_profile_id on regies(profile_id);
create index if not exists idx_immeubles_regie_id on immeubles(regie_id);
create index if not exists idx_logements_immeuble_id on logements(immeuble_id);
create index if not exists idx_locataires_profile_id on locataires(profile_id);
create index if not exists idx_locataires_logement_id on locataires(logement_id);
create index if not exists idx_tickets_regie_id on tickets(regie_id);
create index if not exists idx_tickets_locataire_id on tickets(locataire_id);
create index if not exists idx_tickets_entreprise_id on tickets(entreprise_id);
create index if not exists idx_entreprises_profile_id on entreprises(profile_id);
