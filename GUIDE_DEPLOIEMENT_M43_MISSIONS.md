# 📘 GUIDE DÉPLOIEMENT MIGRATION M43

**Date** : 6 janvier 2026  
**Objectif** : Enrichir fonctionnalités missions pour vue technicien  
**Impact** : 3 nouvelles tables, 4 nouvelles colonnes, 6 nouvelles fonctions RPC

---

## 📦 CONTENU MIGRATION M43

### Fichiers créés

| Fichier | Description | Dépendances |
|---------|-------------|-------------|
| `20260106000001_m43_mission_signalements.sql` | Table signalements + RLS | missions |
| `20260106000002_m43_mission_champs_complementaires.sql` | Colonnes absence/photos + RPCs | missions |
| `20260106000003_m43_mission_historique_statuts.sql` | Historique statuts + triggers | missions |
| `*_rollback.sql` (x3) | Scripts rollback | - |

### Modifications DB

**Nouvelles tables** :
- ✅ `mission_signalements` (problèmes signalés par techniciens)
- ✅ `mission_historique_statuts` (audit trail complet)

**Nouvelles colonnes missions** :
- ✅ `locataire_absent` (boolean)
- ✅ `absence_signalement_at` (timestamptz)
- ✅ `absence_raison` (text)
- ✅ `photos_urls` (text[])

**Nouvelles fonctions** :
- ✅ `signaler_absence_locataire(mission_id, raison)`
- ✅ `ajouter_photos_mission(mission_id, photos_urls[])`
- ✅ `log_mission_statut_change()` (trigger automatique)
- ✅ `log_mission_creation()` (trigger automatique)

**Nouvelles vues** :
- ✅ `mission_signalements_details`
- ✅ `missions_avec_absence_locataire`
- ✅ `mission_historique_details`
- ✅ `mission_transitions_stats`
- ✅ `mission_transitions_anormales`

---

## ⚙️ PRÉ-REQUIS

### Vérifications avant déploiement

```sql
-- 1. Vérifier table missions existe
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'missions'
);
-- Attendu: true

-- 2. Vérifier colonnes missions actuelles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'missions'
ORDER BY ordinal_position;

-- 3. Vérifier fonction helper existe
SELECT EXISTS (
  SELECT 1 FROM pg_proc 
  WHERE proname = 'get_user_regie_id'
);
-- Attendu: true

-- 4. Vérifier pas de conflit noms tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN (
  'mission_signalements',
  'mission_historique_statuts'
);
-- Attendu: 0 lignes (tables n'existent pas encore)
```

---

## 🚀 PROCÉDURE DÉPLOIEMENT

### Option 1 : Supabase CLI (recommandé)

```bash
# 1. Se connecter au projet
supabase link --project-ref <votre-ref>

# 2. Appliquer migrations dans l'ordre
supabase db push

# 3. Vérifier statut
supabase migration list
```

### Option 2 : SQL Editor Supabase

**Ordre d'exécution STRICT** :

1. **Migration 1** : `20260106000001_m43_mission_signalements.sql`
   - Exécuter dans SQL Editor
   - ✅ Vérifier : `SELECT count(*) FROM mission_signalements;` → 0 lignes

2. **Migration 2** : `20260106000002_m43_mission_champs_complementaires.sql`
   - Exécuter dans SQL Editor
   - ✅ Vérifier : `SELECT locataire_absent, photos_urls FROM missions LIMIT 1;` → colonnes existent

3. **Migration 3** : `20260106000003_m43_mission_historique_statuts.sql`
   - Exécuter dans SQL Editor
   - ✅ Vérifier : `SELECT count(*) FROM mission_historique_statuts;` → N lignes (historique missions existantes)

---

## ✅ VALIDATION POST-DÉPLOIEMENT

### Test 1 : Table signalements

```sql
-- Vérifier structure
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'mission_signalements'
ORDER BY ordinal_position;

-- Vérifier RLS activée
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'mission_signalements';
-- Attendu: rowsecurity = true

-- Vérifier policies
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'mission_signalements';
-- Attendu: 6 policies
```

### Test 2 : Colonnes missions

```sql
-- Vérifier colonnes ajoutées
SELECT 
  column_name, 
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'missions'
  AND column_name IN (
    'locataire_absent',
    'absence_signalement_at',
    'absence_raison',
    'photos_urls'
  );
-- Attendu: 4 lignes

-- Vérifier valeurs par défaut
SELECT 
  locataire_absent,
  absence_signalement_at,
  absence_raison,
  photos_urls
FROM missions
LIMIT 5;
-- Attendu: locataire_absent = false, autres = NULL ou []
```

### Test 3 : Historique statuts

```sql
-- Vérifier trigger actif
SELECT 
  trigger_name, 
  event_manipulation 
FROM information_schema.triggers
WHERE event_object_table = 'missions'
  AND trigger_name IN (
    'mission_statut_change_log',
    'mission_creation_log'
  );
-- Attendu: 2 lignes

-- Vérifier historique créé pour missions existantes
SELECT 
  m.id as mission_id,
  COUNT(h.id) as nb_entrees_historique
FROM missions m
LEFT JOIN mission_historique_statuts h ON m.id = h.mission_id
GROUP BY m.id
ORDER BY m.created_at DESC
LIMIT 10;
-- Attendu: chaque mission a au moins 1 entrée (création)

-- Vérifier vue détaillée
SELECT * FROM mission_historique_details LIMIT 5;
```

### Test 4 : Fonctions RPC

```sql
-- Vérifier fonctions créées
SELECT 
  proname, 
  pronargs 
FROM pg_proc 
WHERE proname IN (
  'signaler_absence_locataire',
  'ajouter_photos_mission',
  'log_mission_statut_change',
  'log_mission_creation'
);
-- Attendu: 4 lignes
```

---

## 🧪 TESTS FONCTIONNELS

### Test A : Signaler absence locataire

```sql
-- En tant que technicien (via votre frontend ou RPC direct)
SELECT signaler_absence_locataire(
  '<mission_id_test>'::uuid,
  'Locataire pas présent malgré RDV confirmé'
);
-- Attendu: {"success": true, "message": "Absence locataire enregistrée"}

-- Vérifier enregistrement
SELECT 
  locataire_absent,
  absence_signalement_at,
  absence_raison
FROM missions
WHERE id = '<mission_id_test>';
-- Attendu: locataire_absent = true, absence_signalement_at = now, raison remplie
```

### Test B : Ajouter photos

```sql
SELECT ajouter_photos_mission(
  '<mission_id_test>'::uuid,
  ARRAY[
    'https://storage.supabase.co/bucket/photo1.jpg',
    'https://storage.supabase.co/bucket/photo2.jpg'
  ]::text[]
);
-- Attendu: {"success": true, "message": "Photos ajoutées", "count": 2}

-- Vérifier enregistrement
SELECT photos_urls FROM missions WHERE id = '<mission_id_test>';
-- Attendu: array avec 2 URLs
```

### Test C : Créer signalement

```sql
-- Via frontend technicien
INSERT INTO mission_signalements (
  mission_id,
  type_signalement,
  description,
  signale_par
) VALUES (
  '<mission_id_test>'::uuid,
  'piece_manquante',
  'Joint torique 32mm indisponible chez fournisseur',
  auth.uid()
);

-- Vérifier
SELECT * FROM mission_signalements_details 
WHERE mission_id = '<mission_id_test>';
```

### Test D : Historique statuts

```sql
-- Changer statut mission
UPDATE missions 
SET statut = 'en_cours' 
WHERE id = '<mission_id_test>';

-- Vérifier historique
SELECT 
  ancien_statut,
  nouveau_statut,
  change_at,
  change_par
FROM mission_historique_statuts
WHERE mission_id = '<mission_id_test>'
ORDER BY change_at DESC;
-- Attendu: au moins 2 entrées (création + transition)
```

---

## 🔄 ROLLBACK

### En cas de problème

**Ordre INVERSE** (IMPORTANT) :

```bash
# 1. Rollback historique statuts
psql < 20260106000003_m43_mission_historique_statuts_rollback.sql

# 2. Rollback colonnes
psql < 20260106000002_m43_mission_champs_complementaires_rollback.sql

# 3. Rollback signalements
psql < 20260106000001_m43_mission_signalements_rollback.sql
```

**Vérification post-rollback** :
```sql
-- Vérifier tables supprimées
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN (
  'mission_signalements',
  'mission_historique_statuts'
);
-- Attendu: 0 lignes

-- Vérifier colonnes supprimées
SELECT column_name 
FROM information_schema.columns
WHERE table_name = 'missions'
  AND column_name IN (
    'locataire_absent',
    'absence_signalement_at',
    'absence_raison',
    'photos_urls'
  );
-- Attendu: 0 lignes
```

---

## 📊 MONITORING POST-DÉPLOIEMENT

### Métriques à surveiller

```sql
-- 1. Nombre signalements créés (par jour)
SELECT 
  DATE(signale_at) as jour,
  COUNT(*) as nb_signalements,
  COUNT(*) FILTER (WHERE resolu = false) as non_resolus
FROM mission_signalements
GROUP BY jour
ORDER BY jour DESC;

-- 2. Missions avec absence locataire (par semaine)
SELECT 
  DATE_TRUNC('week', absence_signalement_at) as semaine,
  COUNT(*) as nb_absences
FROM missions
WHERE locataire_absent = true
GROUP BY semaine
ORDER BY semaine DESC;

-- 3. Transitions statuts les plus fréquentes
SELECT * FROM mission_transitions_stats
ORDER BY nombre_transitions DESC
LIMIT 10;

-- 4. Missions avec photos
SELECT 
  COUNT(*) as total_missions,
  COUNT(*) FILTER (WHERE array_length(photos_urls, 1) > 0) as missions_avec_photos,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE array_length(photos_urls, 1) > 0) / COUNT(*),
    2
  ) as pourcentage
FROM missions;
```

---

## 🔧 DÉPANNAGE

### Problème 1 : Trigger ne se déclenche pas

**Symptôme** : Pas d'entrée dans `mission_historique_statuts` après changement statut

**Vérification** :
```sql
SELECT * FROM pg_trigger WHERE tgname LIKE 'mission_%';
```

**Solution** :
```sql
-- Recréer trigger
DROP TRIGGER IF EXISTS mission_statut_change_log ON missions;
CREATE TRIGGER mission_statut_change_log
AFTER UPDATE ON missions
FOR EACH ROW
WHEN (OLD.statut IS DISTINCT FROM NEW.statut)
EXECUTE FUNCTION log_mission_statut_change();
```

### Problème 2 : RLS bloque technicien

**Symptôme** : Technicien ne peut pas créer signalement

**Vérification** :
```sql
-- En tant que technicien
SELECT * FROM missions WHERE technicien_id = (
  SELECT id FROM techniciens WHERE profile_id = auth.uid()
);
-- Si vide → technicien pas assigné à missions
```

**Solution** : Assigner technicien à mission d'abord via `assign_technicien_to_mission()`

### Problème 3 : Photos ne s'enregistrent pas

**Symptôme** : `photos_urls` reste vide après appel RPC

**Vérification** :
```sql
-- Tester directement
UPDATE missions 
SET photos_urls = ARRAY['test.jpg']::text[]
WHERE id = '<mission_id>';

SELECT photos_urls FROM missions WHERE id = '<mission_id>';
```

**Solution** : Vérifier format URLs et permissions Storage

---

## 📝 CHECKLIST FINALE

- [ ] 3 migrations appliquées avec succès
- [ ] 2 nouvelles tables créées
- [ ] 4 nouvelles colonnes ajoutées à `missions`
- [ ] 6 nouvelles fonctions RPC disponibles
- [ ] 5 nouvelles vues créées
- [ ] RLS policies actives sur nouvelles tables
- [ ] Triggers actifs (historique statuts)
- [ ] Tests fonctionnels A, B, C, D validés
- [ ] Documentation frontend mise à jour
- [ ] Équipe technique informée

---

**Prochaine étape** : Intégrer fonctionnalités dans interface technicien (frontend)
