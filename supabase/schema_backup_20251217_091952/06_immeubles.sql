/**
 * TABLE IMMEUBLES
 * 
 * Gestion des immeubles gérés par les régies
 * Chaque immeuble appartient à une régie
 * 
 * Ordre d'exécution : 6
 * 
 * RÈGLES :
 * - Un immeuble est rattaché à une régie (FK obligatoire)
 * - Un immeuble contient plusieurs logements
 * - Suppression en cascade depuis la régie
 * - Isolation : accès uniquement via la régie
 */

-- Table immeubles
create table if not exists immeubles (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  adresse text not null,
  code_postal text not null,
  ville text not null,
  nombre_etages int default 0,
  annee_construction int,
  
  -- Rattachement à la régie (obligatoire)
  regie_id uuid not null references regies(id) on delete cascade,
  
  -- Informations complémentaires
  type_chauffage text,
  ascenseur boolean default false,
  digicode text,
  interphone boolean default false,
  
  -- Métadonnées
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table immeubles is 'JETC_IMMO - Immeubles gérés par les régies';
comment on column immeubles.nom is $$Nom ou référence de l'immeuble$$;
comment on column immeubles.regie_id is 'Régie qui gère cet immeuble (obligatoire)';
comment on column immeubles.nombre_etages is $$Nombre d'étages de l'immeuble$$;
comment on column immeubles.type_chauffage is 'Type de chauffage (individuel, collectif, etc.)';

-- Contraintes
alter table immeubles add constraint check_nombre_etages check (nombre_etages >= 0);
alter table immeubles add constraint check_annee_construction check (annee_construction >= 1800 and annee_construction <= extract(year from now()) or annee_construction is null);
alter table immeubles add constraint check_code_postal check (code_postal ~ '^[0-9]{5}$');

-- Index pour performances
create index if not exists idx_immeubles_regie_id on immeubles(regie_id);
create index if not exists idx_immeubles_ville on immeubles(ville);
create index if not exists idx_immeubles_code_postal on immeubles(code_postal);
create index if not exists idx_immeubles_nom on immeubles(nom);

-- Trigger de mise à jour automatique
create trigger set_updated_at_immeubles
  before update on immeubles
  for each row execute function handle_updated_at();
