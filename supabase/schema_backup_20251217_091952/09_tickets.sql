/**
 * TABLE TICKETS
 * 
 * Gestion des tickets d'intervention (déclarations de problèmes)
 * Créés par les locataires pour signaler des problèmes dans leur logement
 * 
 * Ordre d'exécution : 9
 * 
 * RÈGLES :
 * - Un ticket est créé par un locataire pour son logement
 * - Un ticket est automatiquement lié à la régie (via logement → immeuble → régie)
 * - Statut initial : 'ouvert'
 * - Un locataire ne peut créer que des tickets pour SON logement
 */

-- Table tickets
create table if not exists tickets (
  id uuid primary key default uuid_generate_v4(),
  titre text not null,
  description text not null,
  categorie text not null,
  priorite text not null default 'normale',
  statut ticket_status not null default 'ouvert',
  
  -- Relations
  logement_id uuid not null references logements(id) on delete cascade,
  locataire_id uuid not null references locataires(id) on delete cascade,
  regie_id uuid not null, -- Calculé automatiquement via trigger
  
  -- Assignation (nullable tant que pas assigné)
  entreprise_id uuid references entreprises(id) on delete set null,
  technicien_id uuid references techniciens(id) on delete set null,
  
  -- Dates importantes
  date_creation timestamptz default now(),
  date_cloture timestamptz,
  date_limite timestamptz,
  
  -- Informations complémentaires
  photos text[], -- URLs des photos
  urgence boolean default false,
  
  -- Métadonnées
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table tickets is $$JETC_IMMO - Tickets d'intervention créés par les locataires$$;
comment on column tickets.titre is 'Titre court du problème';
comment on column tickets.description is 'Description détaillée du problème';
comment on column tickets.categorie is 'Type de problème (plomberie, électricité, etc.)';
comment on column tickets.priorite is 'Priorité : faible, normale, haute, urgente';
comment on column tickets.statut is 'État du ticket (ouvert, en_cours, termine, annule)';
comment on column tickets.regie_id is 'Régie concernée (calculé automatiquement via trigger)';
comment on column tickets.logement_id is 'Logement concerné par le problème';
comment on column tickets.locataire_id is 'Locataire qui a créé le ticket';

-- Contraintes
alter table tickets add constraint check_priorite check (priorite in ('faible', 'normale', 'haute', 'urgente'));
alter table tickets add constraint check_categorie check (categorie in (
  'plomberie', 'électricité', 'chauffage', 'serrurerie', 
  'vitrerie', 'menuiserie', 'peinture', 'autre'
));
alter table tickets add constraint check_dates check (
  date_cloture is null or date_cloture >= date_creation
);

-- Index pour performances
create index if not exists idx_tickets_logement_id on tickets(logement_id);
create index if not exists idx_tickets_locataire_id on tickets(locataire_id);
create index if not exists idx_tickets_regie_id on tickets(regie_id);
create index if not exists idx_tickets_statut on tickets(statut);
create index if not exists idx_tickets_priorite on tickets(priorite);
create index if not exists idx_tickets_entreprise_id on tickets(entreprise_id);
create index if not exists idx_tickets_technicien_id on tickets(technicien_id);
create index if not exists idx_tickets_date_creation on tickets(date_creation);

-- Trigger de mise à jour automatique
create trigger set_updated_at_tickets
  before update on tickets
  for each row execute function handle_updated_at();

-- Fonction pour calculer automatiquement la regie_id
create or replace function set_ticket_regie_id()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_regie_id uuid;
begin
  -- Récupérer la regie_id via logement → immeuble → regie
  select i.regie_id into v_regie_id
  from logements l
  join immeubles i on l.immeuble_id = i.id
  where l.id = new.logement_id;
  
  if v_regie_id is null then
    raise exception 'Impossible de déterminer la régie pour le logement %', new.logement_id;
  end if;
  
  new.regie_id := v_regie_id;
  return new;
end;
$$;

-- Trigger pour calculer regie_id automatiquement
create trigger set_ticket_regie_id_trigger
  before insert on tickets
  for each row execute function set_ticket_regie_id();

comment on function set_ticket_regie_id is $$Calcule automatiquement la regie_id d'un ticket via logement → immeuble → regie$$;

-- Vue pour faciliter les requêtes
create or replace view tickets_complets as
select 
  t.*,
  loc.nom as locataire_nom,
  loc.prenom as locataire_prenom,
  loc.email as locataire_email,
  log.numero as logement_numero,
  log.etage as logement_etage,
  imm.nom as immeuble_nom,
  imm.adresse as immeuble_adresse,
  reg.nom as regie_nom
from tickets t
join locataires loc on t.locataire_id = loc.id
join logements log on t.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
join regies reg on t.regie_id = reg.id;

comment on view tickets_complets is 'Vue enrichie des tickets avec toutes les informations liées';
