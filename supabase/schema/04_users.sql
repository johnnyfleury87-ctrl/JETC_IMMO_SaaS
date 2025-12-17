/**
 * TABLE PROFILES
 * 
 * Table des profils utilisateurs
 * Chaque utilisateur Supabase Auth DOIT avoir un profil
 * 
 * Ordre d'exécution : 4
 * 
 * RÈGLES :
 * - Le profil est créé par le code métier (api/auth/register.js, api/install/create-admin.js)
 * - Le rôle par défaut est 'regie' (point d'entrée métier PRO)
 * - La langue par défaut est 'fr'
 * - Le profil est lié à auth.users via FK cascade
 * 
 * ⚠️ ARCHITECTURE :
 * La création du profil est une responsabilité du code métier, PAS du SQL.
 * Cela garantit l'atomicité (rollback en cas d'erreur) et la testabilité.
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