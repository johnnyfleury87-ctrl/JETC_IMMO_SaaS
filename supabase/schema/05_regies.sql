/**
 * TABLE RÉGIES
 * 
 * Gestion des agences immobilières
 * Chaque régie est isolée des autres (données cloisonnées)
 * 
 * Ordre d'exécution : 5
 * 
 * RÈGLES :
 * - Une régie a un profil utilisateur de type 'regie'
 * - Une régie gère plusieurs immeubles
 * - Isolation totale : une régie ne voit que ses données
 * - Nom unique par régie
 */

-- Table régies
create table if not exists regies (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  adresse text,
  code_postal text,
  ville text,
  telephone text,
  email text,
  siret text,
  
  -- Rattachement au profil utilisateur
  profile_id uuid references profiles(id) on delete cascade,
  
  -- Métadonnées
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table regies is 'JETC_IMMO - Agences immobilières (isolation par régie)';
comment on column regies.nom is 'Nom de l\'agence immobilière';
comment on column regies.profile_id is 'Profil utilisateur responsable de la régie (role: regie)';
comment on column regies.siret is 'Numéro SIRET de l\'entreprise';

-- Contraintes
alter table regies add constraint unique_regie_nom unique(nom);
alter table regies add constraint check_telephone check (telephone ~ '^[0-9+\s\-().]+$' or telephone is null);
alter table regies add constraint check_email check (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$' or email is null);

-- Index pour performances
create index if not exists idx_regies_profile_id on regies(profile_id);
create index if not exists idx_regies_nom on regies(nom);
create index if not exists idx_regies_ville on regies(ville);

-- Fonction de mise à jour du timestamp
create or replace function handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger de mise à jour automatique
create trigger set_updated_at_regies
  before update on regies
  for each row execute function handle_updated_at();
