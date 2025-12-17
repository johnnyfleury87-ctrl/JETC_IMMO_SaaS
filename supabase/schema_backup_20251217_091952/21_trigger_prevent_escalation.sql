-- =====================================================
-- TRIGGER : Empêcher l'auto-escalation de rôle
-- =====================================================
-- Date: 17 décembre 2025
-- Objectif: Bloquer toute tentative d'un utilisateur de modifier son propre rôle
-- Sécurité: Seul un admin_jtec peut modifier le rôle d'un utilisateur

-- =====================================================
-- FONCTION : Vérification avant UPDATE sur profiles
-- =====================================================

create or replace function prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
as $$
declare
  v_current_user_role text;
  v_is_admin boolean := false;
begin
  -- 1. Récupérer le rôle de l'utilisateur qui fait la modification
  select role into v_current_user_role
  from profiles
  where id = auth.uid();
  
  -- 2. Vérifier si l'utilisateur est admin_jtec
  if v_current_user_role = 'admin_jtec' then
    v_is_admin := true;
  end if;
  
  -- 3. Si le champ 'role' est modifié
  if OLD.role is distinct from NEW.role then
    -- 3a. Si l'utilisateur modifie son propre rôle
    if OLD.id = auth.uid() then
      -- Même un admin ne peut pas changer son propre rôle
      -- Cela évite qu'un admin se rétrograde par erreur
      raise exception 'SÉCURITÉ: Impossible de modifier son propre rôle. Contactez un autre administrateur.';
    end if;
    
    -- 3b. Si ce n'est pas un admin qui modifie le rôle d'un autre utilisateur
    if not v_is_admin then
      raise exception 'SÉCURITÉ: Seul un admin_jtec peut modifier le rôle d''un utilisateur.';
    end if;
    
    -- 3c. Log de la modification (audit)
    raise notice 'AUDIT: Admin % a changé le rôle de % : % → %', 
      auth.uid(), 
      NEW.id, 
      OLD.role, 
      NEW.role;
  end if;
  
  -- 4. Autoriser la modification
  return NEW;
end;
$$;

comment on function prevent_role_self_escalation is 
  'Trigger pour empêcher l''auto-escalation de rôle et contrôler les modifications de rôle';

-- =====================================================
-- TRIGGER : Appliquer sur la table profiles
-- =====================================================

drop trigger if exists trigger_prevent_role_self_escalation on profiles;

create trigger trigger_prevent_role_self_escalation
  before update on profiles
  for each row
  execute function prevent_role_self_escalation();

comment on trigger trigger_prevent_role_self_escalation on profiles is 
  'Empêche un utilisateur de modifier son propre rôle ou un non-admin de modifier le rôle d''autrui';

-- =====================================================
-- TESTS DE VALIDATION
-- =====================================================

-- Test 1: Un utilisateur normal ne peut pas modifier son rôle
-- Test 2: Un utilisateur normal ne peut pas modifier le rôle d'un autre utilisateur
-- Test 3: Un admin_jtec peut modifier le rôle d'un autre utilisateur
-- Test 4: Un admin_jtec NE PEUT PAS modifier son propre rôle (sécurité)

-- =====================================================
-- DOCUMENTATION
-- =====================================================

/*
RÈGLES DE SÉCURITÉ:

1. AUCUN utilisateur ne peut modifier son propre rôle (même admin_jtec)
   → Raison: Éviter l'auto-rétrogradation accidentelle
   → Solution: Un autre admin doit le faire

2. Seul un admin_jtec peut modifier le rôle d'un autre utilisateur
   → Raison: Contrôle strict des permissions
   → Vérification: role = 'admin_jtec' dans profiles

3. Toute modification de rôle est loggée
   → Audit trail complet
   → Visible dans les logs PostgreSQL (NOTICE level)

4. Le trigger s'exécute AVANT l'UPDATE
   → Permet de bloquer l'opération avant écriture
   → Pas de modification de la base si refusé

EXEMPLE D'USAGE:

-- ✅ OK: Admin modifie le rôle d'un utilisateur
UPDATE profiles 
SET role = 'entreprise' 
WHERE id = 'uuid-autre-utilisateur';

-- ❌ REFUSÉ: Utilisateur modifie son propre rôle
UPDATE profiles 
SET role = 'admin_jtec' 
WHERE id = auth.uid();
-- ERROR: SÉCURITÉ: Impossible de modifier son propre rôle

-- ❌ REFUSÉ: Utilisateur non-admin modifie le rôle d'autrui
UPDATE profiles 
SET role = 'admin_jtec' 
WHERE id = 'uuid-autre-utilisateur';
-- ERROR: SÉCURITÉ: Seul un admin_jtec peut modifier le rôle d'un utilisateur
*/

-- =====================================================
-- GRANTS
-- =====================================================

-- Aucun grant spécifique nécessaire
-- Le trigger s'exécute automatiquement via SECURITY DEFINER
