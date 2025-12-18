-- =====================================================
-- FICHIER DE VÉRIFICATION AUTOMATIQUE
-- =====================================================
-- Objectif : Valider que le schéma PostgreSQL est complet et cohérent
-- Usage : Exécuter après migrations 01→23
-- Résultat : Erreurs si objets manquants/invalides
-- Compatible : Supabase SQL Editor (sans \echo)
-- =====================================================

do $$
begin
  raise notice '🔍 VÉRIFICATION SCHÉMA JETC_IMMO_SaaS';
  raise notice '';
end $$;

-- =====================================================
-- 1. VÉRIFICATION EXTENSIONS
-- =====================================================

do $$
begin
  raise notice '=== 1. Extensions PostgreSQL ===';
  
  if not exists (select 1 from pg_extension where extname = 'uuid-ossp') then
    raise exception '❌ Extension uuid-ossp manquante';
  end if;
  raise notice '✅ Extension uuid-ossp présente';
  
  if not exists (select 1 from pg_extension where extname = 'pgcrypto') then
    raise exception '❌ Extension pgcrypto manquante';
  end if;
  raise notice '✅ Extension pgcrypto présente';
  raise notice '';
end $$;

-- =====================================================
-- 2. VÉRIFICATION TYPES ENUM
-- =====================================================

do $$
declare
  v_count int;
begin
  raise notice '=== 2. Types ENUM ===';
  
  -- user_role
  select count(*) into v_count
  from pg_type
  where typname = 'user_role' and typtype = 'e';
  
  if v_count = 0 then
    raise exception '❌ ENUM user_role manquant';
  end if;
  raise notice '✅ ENUM user_role présent (% valeurs attendues: admin_jtec, regie, entreprise, locataire)', 
    (select count(*) from pg_enum where enumtypid = 'user_role'::regtype);
  
  -- ticket_status
  select count(*) into v_count
  from pg_type
  where typname = 'ticket_status' and typtype = 'e';
  
  if v_count = 0 then
    raise exception '❌ ENUM ticket_status manquant';
  end if;
  raise notice '✅ ENUM ticket_status présent (% valeurs)', 
    (select count(*) from pg_enum where enumtypid = 'ticket_status'::regtype);
  
  -- mission_status
  select count(*) into v_count
  from pg_type
  where typname = 'mission_status' and typtype = 'e';
  
  if v_count = 0 then
    raise exception '❌ ENUM mission_status manquant';
  end if;
  raise notice '✅ ENUM mission_status présent (% valeurs)', 
    (select count(*) from pg_enum where enumtypid = 'mission_status'::regtype);
    
  -- plan_type
  select count(*) into v_count
  from pg_type
  where typname = 'plan_type' and typtype = 'e';
  
  if v_count = 0 then
    raise exception '❌ ENUM plan_type manquant';
  end if;
  raise notice '✅ ENUM plan_type présent';
  raise notice '';
end $$;

-- =====================================================
-- 3. VÉRIFICATION TABLES PRINCIPALES
-- =====================================================

do $$
declare
  v_tables text[] := array[
    'profiles',
    'regies',
    'immeubles',
    'logements',
    'locataires',
    'entreprises',
    'regies_entreprises',
    'techniciens',
    'tickets',
    'missions',
    'factures',
    'messages',
    'notifications',
    'plans',
    'abonnements'
  ];
  v_table text;
begin
  foreach v_table in array v_tables
  loop
    if to_regclass('public.' || v_table) is null then
      raise exception '❌ Table % manquante', v_table;
    end if;
    raise notice '✅ Table % présente', v_table;
  end loop;
  raise notice '';
end $$;

-- =====================================================
-- 4. VÉRIFICATION COLONNES CRITIQUES
-- =====================================================

do $$
begin
  raise notice '=== 4. Colonnes critiques ===';
  
  -- profiles.id (FK vers auth.users)
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'profiles' and column_name = 'id'
  ) then
    raise exception '❌ Colonne profiles.id manquante';
  end if;
  raise notice '✅ profiles.id présente';
  
  -- profiles.role
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'profiles' and column_name = 'role'
  ) then
    raise exception '❌ Colonne profiles.role manquante';
  end if;
  raise notice '✅ profiles.role présente';
  
  -- tickets.statut (PAS status !)
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'tickets' and column_name = 'statut'
  ) then
    raise exception '❌ Colonne tickets.statut manquante';
  end if;
  raise notice '✅ tickets.statut présente';
  
  if exists (
    select 1 from information_schema.columns
    where table_name = 'tickets' and column_name = 'status'
  ) then
    raise exception '❌ Colonne tickets.status existe (doit être statut)';
  end if;
  raise notice '✅ tickets.status absente (correct, c''est statut)';
  
  -- missions.statut (PAS status !)
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'missions' and column_name = 'statut'
  ) then
    raise exception '❌ Colonne missions.statut manquante';
  end if;
  raise notice '✅ missions.statut présente';
  
  if exists (
    select 1 from information_schema.columns
    where table_name = 'missions' and column_name = 'status'
  ) then
    raise exception '❌ Colonne missions.status existe (doit être statut)';
  end if;
  raise notice '✅ missions.status absente (correct, c''est statut)';
  
  -- tickets.entreprise_id
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'tickets' and column_name = 'entreprise_id'
  ) then
    raise exception '❌ Colonne tickets.entreprise_id manquante';
  end if;
  raise notice '✅ tickets.entreprise_id présente';
  
  -- missions.ticket_id
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'missions' and column_name = 'ticket_id'
  ) then
    raise exception '❌ Colonne missions.ticket_id manquante';
  end if;
  raise notice '✅ missions.ticket_id présente';
  raise notice '';
end $$;

-- =====================================================
-- 5. VÉRIFICATION FOREIGN KEYS
-- =====================================================

do $$
begin
  raise notice '=== 5. Foreign Keys critiques ===';
  
  -- profiles.id → auth.users(id)
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'profiles' and constraint_type = 'FOREIGN KEY'
    and constraint_name like '%auth_users%'
  ) then
    raise exception '❌ FK profiles → auth.users manquante';
  end if;
  raise notice '✅ FK profiles → auth.users présente';
  
  -- tickets.logement_id → logements
  if not exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name
    where tc.table_name = 'tickets' 
    and kcu.column_name = 'logement_id'
    and tc.constraint_type = 'FOREIGN KEY'
  ) then
    raise exception '❌ FK tickets.logement_id → logements manquante';
  end if;
  raise notice '✅ FK tickets → logements présente';
  
  -- missions.ticket_id → tickets
  if not exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name
    where tc.table_name = 'missions' 
    and kcu.column_name = 'ticket_id'
    and tc.constraint_type = 'FOREIGN KEY'
  ) then
    raise exception '❌ FK missions.ticket_id → tickets manquante';
  end if;
  raise notice '✅ FK missions → tickets présente';
  raise notice '';
end $$;

-- =====================================================
-- 6. VÉRIFICATION FONCTIONS
-- =====================================================

do $$
declare
  v_functions text[] := array[
    'handle_updated_at',
    'get_user_regie_id',
    'set_ticket_regie_id',
    'update_ticket_status',
    'update_mission_status'
  ];
  v_func text;
begin
  raise notice '=== 6. Fonctions helper ===';
  
  foreach v_func in array v_functions
  loop
    if not exists (
      select 1 from pg_proc
      where proname = v_func
    ) then
      raise exception '❌ Fonction %() manquante', v_func;
    end if;
    raise notice '✅ Fonction %() présente', v_func;
  end loop;
  raise notice '';
end $$;

-- =====================================================
-- 7. VÉRIFICATION VUES
-- =====================================================

do $$
declare
  v_views text[] := array[
    'tickets_complets',
    'tickets_visibles_entreprise',
    'planning_technicien',
    'missions_non_assignees'
  ];
  v_view text;
begin
  raise notice '=== 7. Vues métier ===';
  
  foreach v_view in array v_views
  loop
    if not exists (
      select 1 from information_schema.views
      where table_name = v_view
    ) then
      raise exception '❌ Vue % manquante', v_view;
    end if;
    raise notice '✅ Vue % présente', v_view;
  end loop;
  raise notice '';
end $$;

-- =====================================================
-- 8. VÉRIFICATION RLS (Row Level Security)
-- =====================================================

do $$
declare
  v_count int;
begin
  raise notice '=== 8. Row Level Security ===';
  
  -- Vérifier que RLS est activé sur tables critiques
  select count(*) into v_count
  from pg_tables
  where schemaname = 'public'
  and tablename in ('profiles', 'tickets', 'missions', 'factures')
  and rowsecurity = true;
  
  if v_count < 4 then
    raise exception '❌ RLS non activé sur toutes les tables critiques (% / 4)', v_count;
  end if;
  raise notice '✅ RLS activé sur % tables critiques', v_count;
  
  -- Vérifier nombre de policies
  select count(*) into v_count
  from pg_policies
  where schemaname = 'public';
  
  if v_count = 0 then
    raise exception '❌ Aucune policy RLS détectée';
  end if;
  raise notice '✅ % policies RLS détectées', v_count;
  raise notice '';
end $$;

-- =====================================================
-- 9. VÉRIFICATION TRIGGERS
-- =====================================================

do $$
declare
  v_count int;
begin
  raise notice '=== 9. Triggers ===';
  
  select count(*) into v_count
  from information_schema.triggers
  where trigger_schema = 'public';
  
  if v_count = 0 then
    raise exception '❌ Aucun trigger détecté';
  end if;
  raise notice '✅ % triggers détectés', v_count;
  
  -- Vérifier trigger handle_updated_at sur profiles
  if not exists (
    select 1 from information_schema.triggers
    where event_object_table = 'profiles'
    and trigger_name like '%updated_at%'
  ) then
    raise exception '❌ Trigger updated_at manquant sur profiles';
  end if;
  raise notice '✅ Trigger updated_at présent sur profiles';
  raise notice '';
end $$;

-- =====================================================
-- 10. VÉRIFICATION COHÉRENCE DONNÉES
-- =====================================================

do $$
declare
  v_count int;
begin
  raise notice '=== 10. Cohérence données ===';
  
  -- Vérifier qu''il n''y a pas de tickets orphelins (sans regie_id)
  select count(*) into v_count
  from tickets
  where regie_id is null;
  
  if v_count > 0 then
    raise exception '❌ % tickets sans regie_id', v_count;
  end if;
  raise notice '✅ Pas de tickets orphelins';
  
  -- Vérifier qu''il n''y a pas de missions sans ticket
  select count(*) into v_count
  from missions m
  where not exists (select 1 from tickets t where t.id = m.ticket_id);
  
  if v_count > 0 then
    raise exception '❌ % missions sans ticket', v_count;
  end if;
  raise notice '✅ Pas de missions orphelines';
  
  -- Vérifier qu''il n''y a pas de profiles sans role
  select count(*) into v_count
  from profiles
  where role is null;
  
  if v_count > 0 then
    raise exception '❌ % profiles sans role', v_count;
  end if;
  raise notice '✅ Pas de profiles sans role';
  raise notice '';
end $$;

-- =====================================================
-- 11. RÉSUMÉ FINAL
-- =====================================================

do $$
declare
  v_tables int;
  v_views int;
  v_functions int;
  v_triggers int;
  v_policies int;
  v_enums int;
begin
  raise notice '=== RÉSUMÉ FINAL ===';
  raise notice '';
  
  select count(*) into v_tables from pg_tables where schemaname = 'public';
  select count(*) into v_views from information_schema.views where table_schema = 'public';
  select count(*) into v_functions from pg_proc join pg_namespace on pg_proc.pronamespace = pg_namespace.oid where pg_namespace.nspname = 'public';
  select count(*) into v_triggers from information_schema.triggers where trigger_schema = 'public';
  select count(*) into v_policies from pg_policies where schemaname = 'public';
  select count(*) into v_enums from pg_type where typtype = 'e';
  
  raise notice '📊 STATISTIQUES SCHÉMA:';
  raise notice '  - Tables: %', v_tables;
  raise notice '  - Vues: %', v_views;
  raise notice '  - Fonctions: %', v_functions;
  raise notice '  - Triggers: %', v_triggers;
  raise notice '  - Policies RLS: %', v_policies;
  raise notice '  - Types ENUM: %', v_enums;
  raise notice '';
  raise notice '✅ SCHÉMA VALIDE - Toutes les vérifications ont réussi';
  raise notice '';
  raise notice '🎯 Vérification terminée avec succès';
end $$;
