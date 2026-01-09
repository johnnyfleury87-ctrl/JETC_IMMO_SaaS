/**
 * FONCTIONS HELPER
 * 
 * Fonctions utilitaires utilisées par les policies RLS
 * À exécuter APRÈS la création des tables de base (regies, immeubles, logements, locataires)
 * 
 * Ordre d'exécution : 09b
 * 
 * Dépendances :
 * - 05_regies.sql (table regies)
 * - 06_immeubles.sql (table immeubles)
 * - 07_logements.sql (table logements)
 * - 08_locataires.sql (table locataires)
 */

-- =====================================================
-- Fonction : Récupérer la regie_id de l'utilisateur
-- =====================================================

/**
 * get_user_regie_id()
 * 
 * Retourne la regie_id de l'utilisateur connecté.
 * 
 * Fonctionne pour deux rôles :
 * - 'regie' : Récupère directement depuis regies.profile_id
 * - 'locataire' : Remonte via locataires → logements → immeubles → regie_id
 * 
 * Utilisée dans les policies RLS pour filtrer les données par régie.
 */
create or replace function get_user_regie_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select regie_id from (
    -- Pour le rôle 'regie', prendre directement depuis regies
    select r.id as regie_id
    from regies r
    where r.profile_id = auth.uid()
    
    union
    
    -- Pour le rôle 'locataire', remonter via logements → immeubles
    select i.regie_id
    from locataires l
    join logements lg on lg.id = l.logement_id
    join immeubles i on i.id = lg.immeuble_id
    where l.profile_id = auth.uid()
    
    limit 1
  ) as user_regie;
$$;

comment on function get_user_regie_id is 'Retourne la regie_id de l''utilisateur connecté (pour rôles regie et locataire). SECURITY DEFINER avec search_path fixe.';
