-- =====================================================
-- ÉTAPE 10 : Acceptation ticket & création mission
-- =====================================================
-- Ordre d'exécution : 13
-- Objectif : Transformer un ticket en mission
-- Critères :
--   - Une seule mission par ticket
--   - Entreprise autorisée uniquement
--   - Verrouillage du ticket après acceptation

-- =====================================================
-- 1. Ajout colonne locked_at à tickets
-- =====================================================

alter table tickets
add column if not exists locked_at timestamptz default null;

comment on column tickets.locked_at is 'Date de verrouillage du ticket (quand une mission est créée)';

-- =====================================================
-- 2. Table missions
-- =====================================================

create table if not exists missions (
  id uuid primary key default gen_random_uuid(),
  
  -- Références
  ticket_id uuid not null unique references tickets(id) on delete cascade,
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  technicien_id uuid references techniciens(id) on delete set null,
  
  -- Dates d'intervention
  date_intervention_prevue timestamptz default null,
  date_intervention_realisee timestamptz default null,
  
  -- Statut de la mission
  statut text not null default 'en_attente' check (statut in (
    'en_attente',    -- Mission créée, en attente de démarrage
    'en_cours',      -- Mission en cours d'exécution
    'terminee',      -- Mission terminée par l'entreprise
    'validee',       -- Mission validée par la régie
    'annulee'        -- Mission annulée
  )),
  
  -- Dates
  created_at timestamptz not null default now(),
  started_at timestamptz default null,
  completed_at timestamptz default null,
  validated_at timestamptz default null,
  
  -- Informations complémentaires
  notes text,
  devis_url text,           -- URL du devis (optionnel)
  facture_url text,         -- URL de la facture (optionnel)
  montant decimal(10,2),    -- Montant de la mission
  
  -- Audit
  updated_at timestamptz not null default now()
);

-- Index pour performance
create index if not exists idx_missions_ticket_id on missions(ticket_id);
create index if not exists idx_missions_entreprise_id on missions(entreprise_id);
create index if not exists idx_missions_technicien_id on missions(technicien_id);
create index if not exists idx_missions_statut on missions(statut);
create index if not exists idx_missions_created_at on missions(created_at);
create index if not exists idx_missions_date_intervention_prevue on missions(date_intervention_prevue);

-- Commentaires
comment on table missions is 'Missions créées suite à l''acceptation d''un ticket par une entreprise';
comment on column missions.ticket_id is 'ID du ticket (unique : 1 seule mission par ticket)';
comment on column missions.entreprise_id is 'Entreprise qui réalise la mission';
comment on column missions.technicien_id is 'Technicien assigné à la mission (optionnel)';
comment on column missions.date_intervention_prevue is 'Date prévue de l''intervention';
comment on column missions.date_intervention_realisee is 'Date réelle de l''intervention';
comment on column missions.statut is 'Statut de la mission : en_attente, en_cours, terminee, validee, annulee';
comment on column missions.devis_url is 'URL du devis dans Supabase Storage';
comment on column missions.facture_url is 'URL de la facture dans Supabase Storage';
comment on column missions.montant is 'Montant de la mission en euros';

-- =====================================================
-- 3. Fonction pour accepter un ticket et créer mission
-- =====================================================

create or replace function accept_ticket_and_create_mission(
  p_ticket_id uuid,
  p_entreprise_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_ticket_regie_id uuid;
  v_is_authorized boolean;
  v_ticket_locked boolean;
  v_mission_id uuid;
begin
  -- 1. Vérifier que le ticket existe et récupérer sa régie
  select 
    i.regie_id,
    t.locked_at is not null
  into v_ticket_regie_id, v_ticket_locked
  from tickets t
  join logements l on t.logement_id = l.id
  join immeubles i on l.immeuble_id = i.id
  where t.id = p_ticket_id;
  
  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Ticket non trouvé'
    );
  end if;
  
  -- 2. Vérifier que le ticket n'est pas déjà verrouillé
  if v_ticket_locked then
    return jsonb_build_object(
      'success', false,
      'error', 'Ticket déjà verrouillé (mission existante)'
    );
  end if;
  
  -- 3. Vérifier que l'entreprise est autorisée pour cette régie
  select exists (
    select 1 from regies_entreprises
    where regie_id = v_ticket_regie_id
    and entreprise_id = p_entreprise_id
    and autorise = true
  ) into v_is_authorized;
  
  if not v_is_authorized then
    return jsonb_build_object(
      'success', false,
      'error', 'Entreprise non autorisée pour cette régie'
    );
  end if;
  
  -- 4. Créer la mission
  insert into missions (ticket_id, entreprise_id, statut)
  values (p_ticket_id, p_entreprise_id, 'en_attente')
  returning id into v_mission_id;
  
  -- 5. Verrouiller le ticket
  update tickets
  set locked_at = now()
  where id = p_ticket_id;
  
  -- 6. Mettre à jour le statut du ticket
  update tickets
  set statut = 'en_cours'
  where id = p_ticket_id;
  
  return jsonb_build_object(
    'success', true,
    'mission_id', v_mission_id
  );
end;
$$;

comment on function accept_ticket_and_create_mission is 'Accepte un ticket et crée une mission (vérifie autorisation entreprise)';

-- =====================================================
-- 4. Trigger pour mettre à jour updated_at
-- =====================================================

create or replace function update_missions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger missions_updated_at
before update on missions
for each row
execute function update_missions_updated_at();

-- =====================================================
-- 5. Row Level Security (RLS)
-- =====================================================

alter table missions enable row level security;

-- Policy : Régie voit les missions de ses tickets
create policy "Regie can view missions for own tickets"
on missions
for select
using (
  exists (
    select 1 from tickets t
    join logements l on t.logement_id = l.id
    join immeubles i on l.immeuble_id = i.id
    where missions.ticket_id = t.id
    and i.regie_id = get_user_regie_id()
  )
);

-- Policy : Entreprise voit ses propres missions
create policy "Entreprise can view own missions"
on missions
for select
using (
  entreprise_id = (
    select id from entreprises
    where profile_id = auth.uid()
  )
);

-- Policy : Locataire voit les missions de ses tickets
create policy "Locataire can view missions for own tickets"
on missions
for select
using (
  exists (
    select 1 from tickets t
    join locataires loc on t.locataire_id = loc.id
    where missions.ticket_id = t.id
    and loc.profile_id = auth.uid()
  )
);

-- Policy : Entreprise peut mettre à jour ses missions
create policy "Entreprise can update own missions"
on missions
for update
using (
  entreprise_id = (
    select id from entreprises
    where profile_id = auth.uid()
  )
);

-- Policy : Régie peut mettre à jour (valider) les missions de ses tickets
create policy "Regie can update missions for own tickets"
on missions
for update
using (
  exists (
    select 1 from tickets t
    join logements l on t.logement_id = l.id
    join immeubles i on l.immeuble_id = i.id
    where missions.ticket_id = t.id
    and i.regie_id = get_user_regie_id()
  )
);

-- Policy : Admin JTEC voit toutes les missions
create policy "Admin JTEC can view all missions"
on missions
for select
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin_jtec'
  )
);

-- Policy : Technicien peut voir SES missions assignées
create policy "Technicien can view assigned missions"
on missions
for select
using (
  technicien_id = (
    select id from techniciens
    where profile_id = auth.uid()
  )
);

-- Policy : Technicien peut mettre à jour SES missions assignées
create policy "Technicien can update assigned missions"
on missions
for update
using (
  technicien_id = (
    select id from techniciens
    where profile_id = auth.uid()
  )
);

-- =====================================================
-- 6. Vue pour informations complètes des missions
-- =====================================================

create or replace view missions_details as
select
  m.id as mission_id,
  m.ticket_id,
  m.entreprise_id,
  m.statut as mission_statut,
  m.created_at as mission_created_at,
  m.started_at,
  m.completed_at,
  m.validated_at,
  m.notes,
  m.devis_url,
  m.facture_url,
  m.montant,
  
  -- Informations ticket
  t.titre as ticket_titre,
  t.description as ticket_description,
  t.categorie as ticket_categorie,
  t.priorite as ticket_priorite,
  t.statut as ticket_statut,
  t.locked_at as ticket_locked_at,
  
  -- Informations entreprise
  e.nom as entreprise_nom,
  e.siret as entreprise_siret,
  
  -- Informations locataire
  loc.nom as locataire_nom,
  loc.prenom as locataire_prenom,
  
  -- Informations logement
  log.numero as logement_numero,
  
  -- Informations immeuble
  imm.nom as immeuble_nom,
  imm.adresse as immeuble_adresse,
  
  -- Informations régie
  r.nom as regie_nom
  
from missions m
join tickets t on m.ticket_id = t.id
join entreprises e on m.entreprise_id = e.id
join locataires loc on t.locataire_id = loc.id
join logements log on t.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
join regies r on imm.regie_id = r.id;

comment on view missions_details is 'Vue complète des missions avec toutes les informations associées';
