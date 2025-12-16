/**
 * TABLE PROFILES & TRIGGER
 * 
 * Création de la table profiles et du trigger automatique
 * Chaque utilisateur Supabase Auth DOIT avoir un profil
 * 
 * Ordre d'exécution : 4
 * 
 * RÈGLES :
 * - Le trigger crée automatiquement un profil à l'inscription
 * - Le rôle par défaut est 'regie' (point d'entrée métier PRO)
 * - La langue par défaut est 'fr'
 * - Le profil est lié à auth.users via FK cascade
 */

-- Table profiles (référence auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role user_role not null default 'regie',
  language text not null default 'fr',
  is_demo boolean not null default false,
  
  -- Rattachements optionnels (selon le rôle)
  regie_id uuid,
  entreprise_id uuid,
  logement_id uuid,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table profiles is 'JETC_IMMO - Profils utilisateurs (obligatoire pour chaque compte)';
comment on column profiles.role is 'Rôle utilisateur : détermine les permissions et le dashboard';
comment on column profiles.language is 'Langue préférée : fr, en, de';
comment on column profiles.is_demo is 'Flag pour distinguer données DEMO/PRO (false = PRO)';

-- Index pour performances
create index if not exists idx_profiles_email on profiles(email);
create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_profiles_regie_id on profiles(regie_id);
create index if not exists idx_profiles_entreprise_id on profiles(entreprise_id);

-- Fonction de création automatique du profil
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, language, is_demo)
  values (
    new.id,
    new.email,
    'regie',  -- Rôle par défaut (point d'entrée métier PRO)
    coalesce(new.raw_user_meta_data->>'language', 'fr'),  -- Langue depuis metadata ou 'fr'
    false  -- Toujours false pour les inscriptions réelles
  );
  return new;
end;
$$;

comment on function public.handle_new_user() is 'JETC_IMMO - Crée automatiquement un profil lors de l''inscription';

-- Trigger sur auth.users
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on trigger on_auth_user_created on auth.users is 'JETC_IMMO - Déclenche la création du profil';

-- Fonction de mise à jour du timestamp
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger de mise à jour automatique
create trigger on_profile_updated
  before update on profiles
  for each row execute function public.handle_updated_at();

-- Vérification de cohérence (contraintes)
alter table profiles
  add constraint check_language check (language in ('fr', 'en', 'de'));

comment on constraint check_language on profiles is 'JETC_IMMO - Limite les langues supportées';
