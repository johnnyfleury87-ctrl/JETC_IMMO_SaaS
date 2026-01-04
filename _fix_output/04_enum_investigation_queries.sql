-- ============================================================
-- ÉTAPE 4 - INVESTIGATION ENUM TICKET_STATUS
-- ============================================================
-- Date: 2026-01-04
-- Objectif: Identifier valeurs enum actuelles et décider fix blocker #3
-- Usage: Exécuter dans Supabase Studio SQL Editor
-- ============================================================

-- ============================================================
-- REQUÊTE 1: Extraire valeurs enum ticket_status
-- ============================================================
-- Résultat attendu: Liste toutes valeurs valides de l'enum
-- Rechercher: 'nouveau', 'en_attente', 'diffuse', 'diffusé', 'diffusee'

SELECT 
  t.typname AS enum_name,
  e.enumlabel AS enum_value,
  e.enumsortorder AS sort_order
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'ticket_status'
ORDER BY e.enumsortorder;

-- Exemple résultat attendu:
-- enum_name      | enum_value  | sort_order
-- ticket_status  | nouveau     | 1
-- ticket_status  | en_attente  | 2
-- ticket_status  | diffusé     | 3   <-- ou 'diffuse' ou 'diffusee'?
-- ticket_status  | en_cours    | 4
-- ticket_status  | termine     | 5


-- ============================================================
-- REQUÊTE 2: Vérifier définition type enum (DDL)
-- ============================================================
-- Affiche toutes informations sur le type enum

SELECT 
  t.typname AS enum_name,
  t.typtype AS type_kind,
  array_agg(e.enumlabel ORDER BY e.enumsortorder) AS all_values,
  COUNT(*) AS total_values
FROM pg_type t
LEFT JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'ticket_status'
GROUP BY t.typname, t.typtype;

-- Exemple résultat:
-- enum_name      | type_kind | all_values                                      | total_values
-- ticket_status  | e         | {nouveau,en_attente,diffusé,en_cours,termine}  | 5


-- ============================================================
-- REQUÊTE 3: Vérifier usages dans colonne tickets.statut
-- ============================================================
-- Liste valeurs réellement utilisées dans la table (si données présentes)

SELECT 
  statut,
  COUNT(*) as count
FROM tickets
GROUP BY statut
ORDER BY count DESC;

-- Si base vide (0 tickets), résultat sera vide
-- Si données présentes, on verra quelles valeurs sont utilisées


-- ============================================================
-- REQUÊTE 4: Vérifier définition colonne tickets.statut
-- ============================================================
-- Confirme que colonne utilise bien l'enum ticket_status

SELECT 
  table_name,
  column_name,
  data_type,
  udt_name,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tickets'
  AND column_name = 'statut';

-- Résultat attendu:
-- table_name | column_name | data_type   | udt_name       | column_default
-- tickets    | statut      | USER-DEFINED | ticket_status  | 'nouveau'::ticket_status


-- ============================================================
-- REQUÊTE 5: Chercher contraintes CHECK sur statut
-- ============================================================
-- Vérifie si contraintes additionnelles limitent les valeurs

SELECT 
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'tickets'
  AND tc.constraint_type = 'CHECK'
  AND cc.check_clause LIKE '%statut%';

-- Si aucune contrainte CHECK, résultat vide (normal)


-- ============================================================
-- ACTIONS APRÈS REQUÊTE 1 (SELON RÉSULTATS)
-- ============================================================

-- CAS A: Enum contient 'diffuse' (exact)
-- → Aucune action requise, blocker #3 est faux positif
-- → Mettre à jour documentation


-- CAS B: Enum contient 'diffusé' (avec accent) mais code utilise 'diffuse'
-- OPTION B1: Ajouter valeur 'diffuse' à l'enum (IRREVERSIBLE)
/*
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'diffuse';
-- ATTENTION: Ne peut pas être rollback!
*/

-- OPTION B2: Corriger le code pour utiliser 'diffusé'
-- Grep codebase: grep -r "'diffuse'" et remplacer par "'diffusé'"
-- Plus safe car réversible


-- CAS C: Enum contient autre variante ('diffusee', 'diffuse_publique', etc.)
-- → Analyser grep codebase pour identifier pattern exact
-- → Décider normalisation: soit enum → code, soit code → enum


-- ============================================================
-- REQUÊTES COMPLÉMENTAIRES (SI BESOIN)
-- ============================================================

-- REQUÊTE 6: Chercher migrations créant/modifiant enum
SELECT 
  migration_name,
  description,
  created_at
FROM migration_logs
WHERE migration_name LIKE '%ticket_status%'
   OR migration_name LIKE '%enum%'
   OR migration_name LIKE '%statut%'
ORDER BY created_at;

-- REQUÊTE 7: Extraire historique modifications enum (si pg_depend disponible)
SELECT 
  t.typname,
  n.nspname,
  obj_description(t.oid, 'pg_type') as description
FROM pg_type t
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE t.typname = 'ticket_status';


-- ============================================================
-- DÉCISION FIX (À DOCUMENTER APRÈS REQUÊTE 1)
-- ============================================================

-- Résultat REQUÊTE 1: [À REMPLIR]
-- enum_value détecté: _____________

-- Option choisie: [A / B1 / B2 / C]
-- Justification: _____________

-- Migration SQL (si B1):
-- ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS '______';

-- OU

-- Patch code (si B2):
-- Fichiers à modifier: _____________
-- Remplacer: 'diffuse' → 'diffusé'


-- ============================================================
-- FIN INVESTIGATION ENUM
-- ============================================================
