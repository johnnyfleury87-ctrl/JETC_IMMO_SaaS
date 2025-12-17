-- =====================================================
-- ÉTAPE 11 : Techniciens & planning
-- =====================================================
-- Ordre d'exécution : 11
-- Objectif : Organiser l'exécution terrain
-- Critères :
--   - Gestion techniciens (rattachés à entreprises)
--   - Assignation technicien à mission
--   - Dates d'intervention
--   - Technicien voit uniquement ses missions

-- =====================================================
-- 1. Table techniciens
-- =====================================================

create table if not exists techniciens (
  id uuid primary key default gen_random_uuid(),
  
  -- Profil utilisateur
  profile_id uuid not null unique references auth.users(id) on delete cascade,
  
  -- Entreprise
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  
  -- Informations personnelles
  nom text not null,
  prenom text not null,
  telephone text,
  email text,
  
  -- Spécialités (array)
  specialites text[] default array[]::text[],
  
  -- Statut
  actif boolean not null default true,
  
  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index pour performance
create index if not exists idx_techniciens_profile_id on techniciens(profile_id);
create index if not exists idx_techniciens_entreprise_id on techniciens(entreprise_id);
create index if not exists idx_techniciens_actif on techniciens(actif);

-- Commentaires
comment on table techniciens is 'Techniciens rattachés aux entreprises pour réaliser les missions';
comment on column techniciens.profile_id is 'Référence au profil utilisateur (role = technicien)';
comment on column techniciens.entreprise_id is 'Entreprise à laquelle appartient le technicien';
comment on column techniciens.specialites is 'Liste des spécialités du technicien (plomberie, électricité, etc.)';
comment on column techniciens.actif is 'Technicien actif ou désactivé';

-- NOTE : Les colonnes technicien_id, date_intervention_prevue, date_intervention_realisee
-- sont définies directement dans 12_missions.sql (pas d'ALTER TABLE après coup)

-- =====================================================
-- 2. Trigger pour mettre à jour updated_at
-- =====================================================

create or replace function update_techniciens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger techniciens_updated_at
before update on techniciens
for each row
execute function update_techniciens_updated_at();

-- =====================================================
-- 3. Fonction helper pour obtenir l'ID du technicien
-- =====================================================

create or replace function get_user_technicien_id()
returns uuid
language sql
security definer
stable
as $$
  select id from techniciens
  where profile_id = auth.uid()
  limit 1;
$$;

comment on function get_user_technicien_id is 'Retourne l''ID du technicien pour l''utilisateur connecté';

-- =====================================================
-- 4. Fonction pour assigner technicien à mission
-- =====================================================

-- NOTE : Cette fonction manipule la table missions qui sera créée dans 12_missions.sql.
-- C'est autorisé car c'est une définition de fonction (exécutée plus tard),
-- pas une manipulation immédiate de la table.

create or replace function assign_technicien_to_mission(
  p_mission_id uuid,
  p_technicien_id uuid,
  p_date_intervention_prevue timestamptz default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_mission_entreprise_id uuid;
  v_technicien_entreprise_id uuid;
begin
  -- 1. Vérifier que la mission existe et récupérer son entreprise
  select entreprise_id into v_mission_entreprise_id
  from missions
  where id = p_mission_id;
  
  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Mission non trouvée'
    );
  end if;
  
  -- 2. Vérifier que le technicien existe et récupérer son entreprise
  select entreprise_id into v_technicien_entreprise_id
  from techniciens
  where id = p_technicien_id
  and actif = true;
  
  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Technicien non trouvé ou inactif'
    );
  end if;
  
  -- 3. Vérifier que le technicien appartient à la même entreprise
  if v_mission_entreprise_id != v_technicien_entreprise_id then
    return jsonb_build_object(
      'success', false,
      'error', 'Le technicien n''appartient pas à l''entreprise de la mission'
    );
  end if;
  
  -- 4. Assigner le technicien à la mission
  update missions
  set 
    technicien_id = p_technicien_id,
    date_intervention_prevue = coalesce(p_date_intervention_prevue, date_intervention_prevue)
  where id = p_mission_id;
  
  return jsonb_build_object(
    'success', true
  );
end;
$$;

comment on function assign_technicien_to_mission is 'Assigne un technicien à une mission (vérifie qu''ils appartiennent à la même entreprise)';

-- =====================================================
-- 5. Row Level Security (RLS)
-- =====================================================

alter table techniciens enable row level security;

-- Policy : Entreprise voit ses techniciens
create policy "Entreprise can view own techniciens"
on techniciens
for select
using (
  entreprise_id = (
    select id from entreprises
    where profile_id = auth.uid()
  )
);

-- Policy : Entreprise peut créer ses techniciens
create policy "Entreprise can insert own techniciens"
on techniciens
for insert
with check (
  entreprise_id = (
    select id from entreprises
    where profile_id = auth.uid()
  )
);

-- Policy : Entreprise peut mettre à jour ses techniciens
create policy "Entreprise can update own techniciens"
on techniciens
for update
using (
  entreprise_id = (
    select id from entreprises
    where profile_id = auth.uid()
  )
);

-- Policy : Technicien voit son propre profil
create policy "Technicien can view own profile"
on techniciens
for select
using (
  profile_id = auth.uid()
);

-- Policy : Technicien peut mettre à jour son profil
create policy "Technicien can update own profile"
on techniciens
for update
using (
  profile_id = auth.uid()
);

-- Policy : Régie voit les techniciens des entreprises autorisées
create policy "Regie can view techniciens of authorized entreprises"
on techniciens
for select
using (
  exists (
    select 1 from regies_entreprises
    where regies_entreprises.entreprise_id = techniciens.entreprise_id
    and regies_entreprises.regie_id = get_user_regie_id()
  )
);

-- Policy : Admin JTEC voit tous les techniciens
create policy "Admin JTEC can view all techniciens"
on techniciens
for select
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin_jtec'
  )
);

-- NOTE : Les policies RLS pour missions liées aux techniciens sont définies dans 12_missions.sql
-- NOTE : Les vues 'planning_technicien' et 'missions_non_assignees' sont dans 16_views.sql
