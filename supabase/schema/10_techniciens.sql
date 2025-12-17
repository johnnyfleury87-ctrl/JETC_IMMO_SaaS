-- =====================================================
-- ÉTAPE 11 : Techniciens & planning
-- =====================================================
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

-- =====================================================
-- 2. Ajout colonnes à missions
-- =====================================================

alter table missions
add column if not exists technicien_id uuid references techniciens(id) on delete set null;

alter table missions
add column if not exists date_intervention_prevue timestamptz default null;

alter table missions
add column if not exists date_intervention_realisee timestamptz default null;

-- Index pour performance
create index if not exists idx_missions_technicien_id on missions(technicien_id);
create index if not exists idx_missions_date_intervention_prevue on missions(date_intervention_prevue);

-- Commentaires
comment on column missions.technicien_id is 'Technicien assigné à la mission (optionnel)';
comment on column missions.date_intervention_prevue is 'Date prévue de l''intervention';
comment on column missions.date_intervention_realisee is 'Date réelle de l''intervention';

-- =====================================================
-- 3. Trigger pour mettre à jour updated_at
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
-- 4. Fonction helper pour obtenir l'ID du technicien
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
-- 5. Fonction pour assigner technicien à mission
-- =====================================================

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
-- 6. Row Level Security (RLS)
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
    and regies_entreprises.autorise = true
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

-- =====================================================
-- 7. Policies RLS supplémentaires pour missions
-- =====================================================

-- Policy : Technicien peut voir SES missions assignées
create policy "Technicien can view assigned missions"
on missions
for select
using (
  technicien_id = get_user_technicien_id()
);

-- Policy : Technicien peut mettre à jour SES missions
create policy "Technicien can update assigned missions"
on missions
for update
using (
  technicien_id = get_user_technicien_id()
);

-- NOTE : Les vues 'planning_technicien' et 'missions_non_assignees' ont été déplacées vers 16_views.sql
-- pour respecter l'ordre des dépendances (elles nécessitent la table tickets créée en 11)
