/**
 * TABLE LOGEMENTS
 * 
 * Gestion des logements dans les immeubles
 * Chaque logement appartient à un immeuble
 * 
 * Ordre d'exécution : 7
 * 
 * RÈGLES :
 * - Un logement est rattaché à un immeuble (FK obligatoire)
 * - Un logement peut avoir un locataire (ou être vacant)
 * - Suppression en cascade depuis l'immeuble
 * - Numéro unique par immeuble
 */

-- Table logements
create table if not exists logements (
  id uuid primary key default uuid_generate_v4(),
  numero text not null,
  etage int,
  superficie numeric(6,2),
  nombre_pieces int,
  type_logement text, -- T1, T2, T3, etc.
  
  -- Rattachement à l'immeuble (obligatoire)
  immeuble_id uuid not null references immeubles(id) on delete cascade,
  
  -- État du logement
  statut text default 'vacant', -- vacant, occupé, en_travaux
  loyer_mensuel numeric(10,2),
  charges_mensuelles numeric(10,2),
  depot_garantie numeric(10,2),
  
  -- Équipements
  balcon boolean default false,
  parking boolean default false,
  cave boolean default false,
  meuble boolean default false,
  
  -- Métadonnées
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table logements is 'JETC_IMMO - Logements dans les immeubles';
comment on column logements.numero is 'Numéro ou référence du logement (ex: Apt 12, Porte droite)';
comment on column logements.immeuble_id is 'Immeuble auquel appartient ce logement (obligatoire)';
comment on column logements.statut is 'État du logement : vacant, occupé, en_travaux';
comment on column logements.type_logement is 'Type : T1, T2, T3, Studio, etc.';

-- Contraintes
alter table logements add constraint unique_logement_numero_immeuble unique(numero, immeuble_id);
alter table logements add constraint check_statut check (statut in ('vacant', 'occupé', 'en_travaux'));
alter table logements add constraint check_superficie check (superficie > 0 or superficie is null);
alter table logements add constraint check_nombre_pieces check (nombre_pieces > 0 or nombre_pieces is null);
alter table logements add constraint check_loyer check (loyer_mensuel >= 0 or loyer_mensuel is null);
alter table logements add constraint check_charges check (charges_mensuelles >= 0 or charges_mensuelles is null);

-- Index pour performances
create index if not exists idx_logements_immeuble_id on logements(immeuble_id);
create index if not exists idx_logements_statut on logements(statut);
create index if not exists idx_logements_numero on logements(numero);

-- Trigger de mise à jour automatique
create trigger set_updated_at_logements
  before update on logements
  for each row execute function handle_updated_at();
