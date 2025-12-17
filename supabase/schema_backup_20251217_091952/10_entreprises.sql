/**
 * TABLE ENTREPRISES
 * 
 * Gestion des entreprises de maintenance/intervention
 * Les entreprises peuvent voir et accepter des tickets
 * 
 * Ordre d'exécution : 10
 * 
 * RÈGLES :
 * - Une entreprise a un profil utilisateur de type 'entreprise'
 * - Une entreprise peut être autorisée par plusieurs régies
 * - Isolation : une entreprise ne voit QUE les tickets des régies qui l'autorisent
 */

-- Table entreprises
create table if not exists entreprises (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  siret text unique,
  adresse text,
  code_postal text,
  ville text,
  telephone text,
  email text not null,
  
  -- Spécialités
  specialites text[], -- ['plomberie', 'électricité', ...]
  
  -- Rattachement au profil utilisateur
  profile_id uuid references profiles(id) on delete cascade,
  
  -- Informations complémentaires
  description text,
  site_web text,
  
  -- Métadonnées
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table entreprises is 'JETC_IMMO - Entreprises de maintenance et intervention';
comment on column entreprises.nom is $$Nom de l'entreprise$$;
comment on column entreprises.profile_id is $$Profil utilisateur de l'entreprise (role: entreprise)$$;
comment on column entreprises.specialites is $$Domaines d'intervention (plomberie, électricité, etc.)$$;

-- Contraintes
alter table entreprises add constraint unique_entreprise_nom unique(nom);
alter table entreprises add constraint check_email_entreprise check (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$');
alter table entreprises add constraint check_telephone_entreprise check (telephone ~ '^[0-9+\s\-().]+$' or telephone is null);

-- Index pour performances
create index if not exists idx_entreprises_profile_id on entreprises(profile_id);
create index if not exists idx_entreprises_nom on entreprises(nom);
create index if not exists idx_entreprises_specialites on entreprises using gin(specialites);

-- Trigger de mise à jour automatique
create trigger set_updated_at_entreprises
  before update on entreprises
  for each row execute function handle_updated_at();

-- ============================================================
-- TABLE RÉGIES_ENTREPRISES (Autorisations)
-- ============================================================

create table if not exists regies_entreprises (
  id uuid primary key default uuid_generate_v4(),
  regie_id uuid not null references regies(id) on delete cascade,
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  
  -- Mode de diffusion
  mode_diffusion text not null default 'restreint', -- 'general' ou 'restreint'
  
  -- Métadonnées
  date_autorisation timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table regies_entreprises is 'JETC_IMMO - Autorisations des entreprises par régie';
comment on column regies_entreprises.mode_diffusion is 'Mode de diffusion : general (tous les tickets) ou restreint (sur assignation)';
comment on column regies_entreprises.regie_id is $$Régie qui autorise l'entreprise$$;
comment on column regies_entreprises.entreprise_id is 'Entreprise autorisée';

-- Contraintes
alter table regies_entreprises add constraint unique_regie_entreprise unique(regie_id, entreprise_id);
alter table regies_entreprises add constraint check_mode_diffusion check (mode_diffusion in ('general', 'restreint'));

-- Index pour performances
create index if not exists idx_regies_entreprises_regie_id on regies_entreprises(regie_id);
create index if not exists idx_regies_entreprises_entreprise_id on regies_entreprises(entreprise_id);
create index if not exists idx_regies_entreprises_mode on regies_entreprises(mode_diffusion);

-- Trigger de mise à jour automatique
create trigger set_updated_at_regies_entreprises
  before update on regies_entreprises
  for each row execute function handle_updated_at();

-- ============================================================
-- VUE : Tickets visibles par entreprise
-- ============================================================

create or replace view tickets_visibles_entreprise as
select 
  t.*,
  re.entreprise_id,
  re.mode_diffusion,
  loc.nom as locataire_nom,
  loc.prenom as locataire_prenom,
  log.numero as logement_numero,
  imm.nom as immeuble_nom,
  imm.adresse as immeuble_adresse,
  reg.nom as regie_nom
from tickets t
join regies_entreprises re on t.regie_id = re.regie_id
join locataires loc on t.locataire_id = loc.id
join logements log on t.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
join regies reg on t.regie_id = reg.id
where 
  -- Mode général : tous les tickets ouverts de la régie
  (re.mode_diffusion = 'general' and t.statut = 'ouvert')
  or
  -- Mode restreint : seulement les tickets assignés à cette entreprise
  (re.mode_diffusion = 'restreint' and t.entreprise_id = re.entreprise_id);

comment on view tickets_visibles_entreprise is 'JETC_IMMO - Tickets visibles par chaque entreprise selon les autorisations';
