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
  
  -- NOUVEAU : Informations métier (adhésion)
  nb_collaborateurs integer not null default 1,
  nb_logements_geres integer not null default 0,
  
  -- NOUVEAU : Validation par admin JTEC
  statut_validation text not null default 'en_attente' 
    check (statut_validation in ('en_attente', 'valide', 'refuse')),
  date_validation timestamptz,
  admin_validateur_id uuid references profiles(id),
  commentaire_refus text,
  
  -- Rattachement au profil utilisateur
  profile_id uuid references profiles(id) on delete cascade,
  
  -- Métadonnées
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table regies is 'JETC_IMMO - Agences immobilières (isolation par régie)';
comment on column regies.nom is $$Nom de l'agence immobilière$$;
comment on column regies.profile_id is 'Profil utilisateur responsable de la régie (role: regie)';
comment on column regies.siret is $$Numéro SIRET de l'entreprise$$;
comment on column regies.nb_collaborateurs is $$Nombre de collaborateurs dans l'agence (requis à l'inscription)$$;
comment on column regies.nb_logements_geres is $$Nombre de logements actuellement gérés par l'agence$$;
comment on column regies.statut_validation is 'Statut de validation par admin JTEC : en_attente (défaut), valide, refuse';
comment on column regies.date_validation is 'Date de validation ou refus par admin JTEC';
comment on column regies.admin_validateur_id is $$ID de l'admin JTEC qui a validé ou refusé$$;
comment on column regies.commentaire_refus is 'Raison du refus si statut_validation = refuse';

-- Contraintes
alter table regies add constraint unique_regie_nom unique(nom);
alter table regies add constraint check_telephone check (telephone ~ '^[0-9+\s\-().]+$' or telephone is null);
alter table regies add constraint check_email check (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$' or email is null);
alter table regies add constraint check_nb_collaborateurs check (nb_collaborateurs >= 1);
alter table regies add constraint check_nb_logements check (nb_logements_geres >= 0);

-- Index pour performances
create index if not exists idx_regies_profile_id on regies(profile_id);
create index if not exists idx_regies_nom on regies(nom);
create index if not exists idx_regies_ville on regies(ville);

-- Trigger de mise à jour automatique
create trigger set_updated_at_regies
  before update on regies
  for each row execute function handle_updated_at();
