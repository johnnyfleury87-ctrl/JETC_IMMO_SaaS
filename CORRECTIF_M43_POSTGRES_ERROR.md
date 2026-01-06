# 🔧 CORRECTIF M43 - Erreur PostgreSQL Window Functions

**Date** : 6 janvier 2026  
**Migration** : `20260106000003_m43_mission_historique_statuts.sql`  
**Erreur** : `ERROR: 42803: aggregate function calls cannot contain window function calls`

---

## 🐛 PROBLÈME IDENTIFIÉ

**Vue fautive** : `mission_transitions_stats` (ligne 243)

**Code erroné** :
```sql
CREATE OR REPLACE VIEW mission_transitions_stats AS
SELECT
  ancien_statut,
  nouveau_statut,
  COUNT(*) as nombre_transitions,
  AVG(EXTRACT(EPOCH FROM (
    LEAD(change_at) OVER (PARTITION BY mission_id ORDER BY change_at) - change_at
  ))/3600) as duree_moyenne_heures,  -- ❌ ERREUR ICI
  MIN(change_at) as premiere_transition,
  MAX(change_at) as derniere_transition
FROM mission_historique_statuts
WHERE ancien_statut IS NOT NULL
GROUP BY ancien_statut, nouveau_statut
ORDER BY nombre_transitions DESC;
```

**Cause** :
- `AVG()` = fonction d'agrégation (niveau GROUP BY)
- `LEAD()` = fonction window (niveau post-agrégation)
- PostgreSQL interdit de mélanger les deux niveaux dans une même expression

---

## ✅ SOLUTION APPLIQUÉE

**Utilisation d'une CTE (Common Table Expression)** :

```sql
CREATE OR REPLACE VIEW mission_transitions_stats AS
WITH transitions_avec_duree AS (
  -- 1️⃣ Sous-requête : calculer LEAD() d'abord
  SELECT
    mission_id,
    ancien_statut,
    nouveau_statut,
    change_at,
    LEAD(change_at) OVER (PARTITION BY mission_id ORDER BY change_at) - change_at AS duree_dans_statut
  FROM mission_historique_statuts
  WHERE ancien_statut IS NOT NULL
)
-- 2️⃣ Requête externe : agréger les résultats
SELECT
  ancien_statut,
  nouveau_statut,
  COUNT(*) as nombre_transitions,
  AVG(EXTRACT(EPOCH FROM duree_dans_statut) / 3600) as duree_moyenne_heures,
  MIN(change_at) as premiere_transition,
  MAX(change_at) as derniere_transition
FROM transitions_avec_duree
GROUP BY ancien_statut, nouveau_statut
ORDER BY nombre_transitions DESC;
```

**Pourquoi ça fonctionne** :
1. La CTE `transitions_avec_duree` calcule `LEAD()` sans agrégation
2. La requête externe agrège les résultats précalculés
3. Pas de conflit entre niveaux window/aggregate

---

## 📦 FICHIERS MIS À JOUR

### Fichier migration corrigé
✅ `supabase/migrations/20260106000003_m43_mission_historique_statuts.sql`
- Taille : 8589 caractères (+181 caractères)
- Ligne modifiée : 243-262

### Fichier SQL consolidé régénéré
✅ `_apply_m43_consolidated.sql`
- Prêt à copier/coller dans SQL Editor
- Contient la correction

---

## 🚀 APPLICATION

### Option A : Appliquer uniquement la correction (si migration déjà partiellement appliquée)

Si vous avez déjà créé la table `mission_historique_statuts` mais que la vue `mission_transitions_stats` a échoué :

```sql
-- Supprimer l'ancienne vue (si existe)
DROP VIEW IF EXISTS mission_transitions_stats;

-- Créer la version corrigée
CREATE OR REPLACE VIEW mission_transitions_stats AS
WITH transitions_avec_duree AS (
  SELECT
    mission_id,
    ancien_statut,
    nouveau_statut,
    change_at,
    LEAD(change_at) OVER (PARTITION BY mission_id ORDER BY change_at) - change_at AS duree_dans_statut
  FROM mission_historique_statuts
  WHERE ancien_statut IS NOT NULL
)
SELECT
  ancien_statut,
  nouveau_statut,
  COUNT(*) as nombre_transitions,
  AVG(EXTRACT(EPOCH FROM duree_dans_statut) / 3600) as duree_moyenne_heures,
  MIN(change_at) as premiere_transition,
  MAX(change_at) as derniere_transition
FROM transitions_avec_duree
GROUP BY ancien_statut, nouveau_statut
ORDER BY nombre_transitions DESC;

COMMENT ON VIEW mission_transitions_stats IS 
  'Statistiques transitions statuts missions (analyse workflow)';
```

### Option B : Appliquer la migration complète (recommandé)

Si vous n'avez pas encore appliqué la migration partie 3 :

1. Copier le contenu complet de `_apply_m43_consolidated.sql`
2. Coller dans https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql
3. Exécuter

---

## ✅ VÉRIFICATION

Après application, vérifier que la vue fonctionne :

```sql
-- Test 1 : Vue créée
SELECT table_name 
FROM information_schema.views 
WHERE table_name = 'mission_transitions_stats';
-- Attendu : 1 ligne

-- Test 2 : Vue requêtable (même si vide)
SELECT * FROM mission_transitions_stats LIMIT 1;
-- Attendu : 0 lignes (normal si aucune mission) ou résultats
```

Puis lancer le script de vérification :

```bash
node _check_m43.js
```

**Attendu** : Toutes les vues M43 ✅

---

## 📊 IMPACT

**Aucun changement fonctionnel** :
- ✅ Même résultat que la version erronée
- ✅ Performances identiques (CTE optimisée par PostgreSQL)
- ✅ Compatibilité totale avec le reste de la migration

**Ce qui reste identique** :
- Table `mission_historique_statuts` : inchangée
- Triggers : inchangés
- Vue `mission_historique_details` : inchangée
- Vue `mission_transitions_anormales` : inchangée
- RLS policies : inchangées

---

## 🎯 RÉSUMÉ

| Élément | Avant | Après |
|---------|-------|-------|
| **Erreur PostgreSQL** | ❌ Bloquante | ✅ Résolue |
| **Vue mission_transitions_stats** | ❌ Syntaxe invalide | ✅ CTE valide |
| **Fonctionnalité** | N/A | ✅ Identique |
| **Fichier migration** | 8408 octets | 8589 octets (+2%) |

**Status** : ✅ Migration M43 partie 3 prête à être appliquée sans erreur

---

**Fin du correctif**  
La migration peut maintenant être exécutée dans le SQL Editor Supabase.
