/**
 * TABLE LOCATAIRES
 * 
 * Gestion des locataires et leur rattachement aux logements
 * Liaison avec les profils utilisateurs de type 'locataire'
 * 
 * Ordre d'exécution : 8
 * 
 * RÈGLES :
 * - Un locataire est rattaché à un profil utilisateur (role: locataire)
 * - Un locataire peut occuper un logement (ou aucun si en recherche)
 * - Lien bidirectionnel : locataire -> logement et profile -> logement
 * - Mise à jour automatique de profile.logement_id
 */

-- Table locataires
create table if not exists locataires (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  prenom text not null,
  telephone text,
  email text not null,
  date_naissance date,
  
  -- Rattachement au profil utilisateur
  profile_id uuid unique references profiles(id) on delete cascade,
  
  -- Rattachement au logement (optionnel, null si sans logement)
  logement_id uuid references logements(id) on delete set null,
  
  -- Informations locatives
  date_entree date,
  date_sortie date,
  
  -- Contact d'urgence
  contact_urgence_nom text,
  contact_urgence_telephone text,
  
  -- Métadonnées
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table locataires is 'JETC_IMMO - Locataires et leur rattachement aux logements';
comment on column locataires.profile_id is 'Profil utilisateur du locataire (role: locataire)';
comment on column locataires.logement_id is 'Logement actuellement occupé (null si sans logement)';
comment on column locataires.date_entree is $$Date d'entrée dans le logement actuel$$;
comment on column locataires.date_sortie is 'Date de sortie prévue ou réelle';

-- Contraintes
alter table locataires add constraint check_email_locataire check (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$');
alter table locataires add constraint check_telephone_locataire check (telephone ~ '^[0-9+\s\-().]+$' or telephone is null);
alter table locataires add constraint check_dates check (date_sortie is null or date_entree is null or date_sortie >= date_entree);

-- Index pour performances
create index if not exists idx_locataires_profile_id on locataires(profile_id);
create index if not exists idx_locataires_logement_id on locataires(logement_id);
create index if not exists idx_locataires_email on locataires(email);
create index if not exists idx_locataires_nom on locataires(nom);

-- Trigger de mise à jour automatique
create trigger set_updated_at_locataires
  before update on locataires
  for each row execute function handle_updated_at();

-- Fonction pour synchroniser profile.logement_id avec locataires.logement_id
create or replace function sync_profile_logement_id()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Si un locataire est assigné à un logement, mettre à jour le profil
  if new.profile_id is not null then
    update profiles
    set logement_id = new.logement_id
    where id = new.profile_id;
  end if;
  
  return new;
end;
$$;

-- Trigger pour synchroniser automatiquement
create trigger sync_profile_on_locataire_update
  after insert or update of logement_id, profile_id on locataires
  for each row execute function sync_profile_logement_id();

comment on function sync_profile_logement_id is 'Synchronise automatiquement logement_id dans profiles quand un locataire est assigné';
