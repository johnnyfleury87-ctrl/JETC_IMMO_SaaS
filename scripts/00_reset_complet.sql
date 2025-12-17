-- =====================================================
-- RESET COMPLET - Nettoyage total base Supabase
-- =====================================================
-- Date: 2025-12-17
-- Objectif: Supprimer TOUS les objets du schéma public
-- Usage: Exécuter dans Supabase SQL Editor
-- 
-- ⚠️ ATTENTION: OPÉRATION DESTRUCTIVE
-- - Supprime toutes tables, vues, fonctions, types
-- - Aucune donnée ne sera conservée
-- - Pas de rollback possible
-- 
-- Pré-requis: Base de développement/test uniquement
-- =====================================================

-- Désactiver les vérifications temporairement
set client_min_messages to warning;

-- =====================================================
-- 1. SUPPRIMER LES POLICIES RLS
-- =====================================================
-- Les policies doivent être supprimées avant les tables

do $$
declare
    r record;
begin
    for r in (
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
    ) loop
        execute format('drop policy if exists %I on %I.%I', 
            r.policyname, r.schemaname, r.tablename);
    end loop;
end $$;

-- =====================================================
-- 2. SUPPRIMER LES TRIGGERS
-- =====================================================

do $$
declare
    r record;
begin
    for r in (
        select trigger_schema, trigger_name, event_object_table
        from information_schema.triggers
        where trigger_schema = 'public'
    ) loop
        execute format('drop trigger if exists %I on %I.%I cascade', 
            r.trigger_name, r.trigger_schema, r.event_object_table);
    end loop;
end $$;

-- =====================================================
-- 3. SUPPRIMER LES VUES
-- =====================================================
-- Les vues doivent être supprimées avant les tables

do $$
declare
    r record;
begin
    for r in (
        select schemaname, viewname
        from pg_views
        where schemaname = 'public'
    ) loop
        execute format('drop view if exists %I.%I cascade', 
            r.schemaname, r.viewname);
    end loop;
end $$;

-- =====================================================
-- 4. SUPPRIMER LES TABLES
-- =====================================================
-- CASCADE supprime automatiquement les dépendances

do $$
declare
    r record;
begin
    for r in (
        select schemaname, tablename
        from pg_tables
        where schemaname = 'public'
    ) loop
        execute format('drop table if exists %I.%I cascade', 
            r.schemaname, r.tablename);
    end loop;
end $$;

-- =====================================================
-- 5. SUPPRIMER LES FONCTIONS
-- =====================================================

do $$
declare
    r record;
begin
    for r in (
        select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
        from pg_proc p
        join pg_namespace n on p.pronamespace = n.oid
        where n.nspname = 'public'
    ) loop
        execute format('drop function if exists %I.%I(%s) cascade', 
            r.nspname, r.proname, r.args);
    end loop;
end $$;

-- =====================================================
-- 6. SUPPRIMER LES TYPES ENUM
-- =====================================================

do $$
declare
    r record;
begin
    for r in (
        select n.nspname, t.typname
        from pg_type t
        join pg_namespace n on t.typnamespace = n.oid
        where n.nspname = 'public'
        and t.typtype = 'e'  -- 'e' = enum type
    ) loop
        execute format('drop type if exists %I.%I cascade', 
            r.nspname, r.typname);
    end loop;
end $$;

-- =====================================================
-- 7. SUPPRIMER LES SEQUENCES
-- =====================================================

do $$
declare
    r record;
begin
    for r in (
        select sequence_schema, sequence_name
        from information_schema.sequences
        where sequence_schema = 'public'
    ) loop
        execute format('drop sequence if exists %I.%I cascade', 
            r.sequence_schema, r.sequence_name);
    end loop;
end $$;

-- =====================================================
-- 8. SUPPRIMER LES STORAGE BUCKETS
-- =====================================================
-- Note: Nécessite extension storage (Supabase)

do $$
declare
    r record;
begin
    for r in (
        select id, name
        from storage.buckets
    ) loop
        -- Vider le bucket d'abord
        delete from storage.objects where bucket_id = r.id;
        -- Supprimer le bucket
        delete from storage.buckets where id = r.id;
    end loop;
exception
    when others then
        raise notice 'Storage cleanup skipped (extension may not be available)';
end $$;

-- =====================================================
-- 9. VÉRIFICATION FINALE
-- =====================================================

do $$
declare
    v_tables int;
    v_views int;
    v_functions int;
    v_enums int;
begin
    select count(*) into v_tables from pg_tables where schemaname = 'public';
    select count(*) into v_views from pg_views where schemaname = 'public';
    select count(*) into v_functions 
        from pg_proc p 
        join pg_namespace n on p.pronamespace = n.oid 
        where n.nspname = 'public';
    select count(distinct t.typname) into v_enums
        from pg_type t
        join pg_namespace n on t.typnamespace = n.oid
        where n.nspname = 'public' and t.typtype = 'e';
    
    raise notice '========================================';
    raise notice 'RESET COMPLET TERMINÉ';
    raise notice '========================================';
    raise notice 'Tables restantes   : %', v_tables;
    raise notice 'Vues restantes     : %', v_views;
    raise notice 'Fonctions restantes: %', v_functions;
    raise notice 'Enums restants     : %', v_enums;
    raise notice '========================================';
    
    if v_tables > 0 or v_views > 0 or v_functions > 0 or v_enums > 0 then
        raise warning 'Certains objets n''ont pas pu être supprimés. Vérifiez les dépendances.';
    else
        raise notice '✅ Base complètement nettoyée';
    end if;
end $$;

-- Restaurer les messages
set client_min_messages to notice;
