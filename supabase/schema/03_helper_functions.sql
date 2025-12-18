/**
 * ÉTAPE 3 – Fonctions Helper (Triggers génériques)
 * 
 * Objectif : Définir les fonctions utilitaires génériques utilisées par plusieurs tables
 * Contenu :
 *   - handle_updated_at() : Trigger automatique pour la colonne updated_at
 * 
 * Dépendances : Aucune (utilise uniquement now())
 * Utilisé par : 04_users, 05_regies, 06_immeubles, 07_logements, 08_locataires, 
 *               10_entreprises, 12_tickets, 15_facturation
 * 
 * Note : Ce fichier contient les fonctions helper sans dépendances externes.
 *        Les fonctions métier avec dépendances sont dans 09b_helper_functions_metier.sql
 */

-- =====================================================
-- Fonction : handle_updated_at
-- =====================================================

/**
 * Trigger générique pour mettre à jour automatiquement la colonne updated_at
 * Utilisé par de nombreuses tables pour tracer la dernière modification
 * 
 * @return NEW record avec updated_at = now()
 */
create or replace function handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
