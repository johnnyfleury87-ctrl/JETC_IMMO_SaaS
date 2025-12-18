/**
 * HOTFIX - Correction récursion RLS profiles
 * 
 * Date: 2024-12-18
 * Issue: infinite recursion detected in policy for relation "profiles"
 * Cause: Policy admin_jtec fait SELECT sur profiles pour vérifier le rôle
 * Solution: Fonction SECURITY DEFINER qui bypass RLS temporairement
 * 
 * À exécuter: Immédiatement (CRITIQUE)
 */

-- =====================================================
-- 1. CRÉER FONCTION HELPER SANS RÉCURSION
-- =====================================================

create or replace function public.is_admin_jtec()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from profiles
    where id = auth.uid()
      and role = 'admin_jtec'
  );
end;
$$;

comment on function public.is_admin_jtec is 
  'Vérifie si l''utilisateur est admin_jtec sans déclencher de récursion RLS (SECURITY DEFINER bypass RLS)';

-- =====================================================
-- 2. RECRÉER POLICIES PROFILES
-- =====================================================

drop policy if exists "Admin JTEC can manage all profiles" on profiles;

create policy "Admin JTEC can manage all profiles"
on profiles for all
using (public.is_admin_jtec());

-- =====================================================
-- 3. RECRÉER POLICIES REGIES
-- =====================================================

drop policy if exists "Admin JTEC can manage all regies" on regies;

create policy "Admin JTEC can manage all regies"
on regies for all
using (public.is_admin_jtec());

-- =====================================================
-- 4. RECRÉER POLICIES IMMEUBLES
-- =====================================================

drop policy if exists "Admin JTEC can view all immeubles" on immeubles;

create policy "Admin JTEC can view all immeubles"
on immeubles for select
using (public.is_admin_jtec());

-- =====================================================
-- 5. RECRÉER POLICIES LOGEMENTS
-- =====================================================

drop policy if exists "Admin JTEC can view all logements" on logements;

create policy "Admin JTEC can view all logements"
on logements for select
using (public.is_admin_jtec());

-- =====================================================
-- 6. RECRÉER POLICIES LOCATAIRES
-- =====================================================

drop policy if exists "Admin JTEC can view all locataires" on locataires;

create policy "Admin JTEC can view all locataires"
on locataires for select
using (public.is_admin_jtec());

-- =====================================================
-- 7. RECRÉER POLICIES TICKETS
-- =====================================================

drop policy if exists "Admin JTEC can view all tickets" on tickets;

create policy "Admin JTEC can view all tickets"
on tickets for select
using (public.is_admin_jtec());

-- =====================================================
-- 8. RECRÉER POLICIES ENTREPRISES
-- =====================================================

drop policy if exists "Admin JTEC can view all entreprises" on entreprises;

create policy "Admin JTEC can view all entreprises"
on entreprises for select
using (public.is_admin_jtec());

-- =====================================================
-- 9. RECRÉER POLICIES REGIES_ENTREPRISES
-- =====================================================

drop policy if exists "Admin JTEC can view all authorizations" on regies_entreprises;

create policy "Admin JTEC can view all authorizations"
on regies_entreprises for select
using (public.is_admin_jtec());

-- =====================================================
-- 10. VÉRIFICATION
-- =====================================================

-- Tester la fonction
select public.is_admin_jtec() as is_admin;

-- Lister les policies
select schemaname, tablename, policyname 
from pg_policies 
where tablename in ('profiles', 'regies', 'immeubles', 'logements', 'locataires', 'tickets', 'entreprises', 'regies_entreprises')
  and policyname like '%Admin JTEC%'
order by tablename, policyname;
