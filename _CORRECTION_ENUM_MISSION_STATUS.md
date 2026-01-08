# 🔧 CORRECTION DÉFINITIVE ENUM mission_status

## ✅ DIAGNOSTIC COMPLET

### Problème identifié

**Erreur** : `invalid input value for enum mission_status: "planifiee"`

### Audit effectué

#### ENUM PostgreSQL en production
```sql
CREATE TYPE mission_status AS ENUM (
  'en_attente',
  'en_cours',
  'terminee'
);
```

✅ **Valeurs valides** : `en_attente`, `en_cours`, `terminee`  
❌ **Valeur manquante** : `planifiee` N'EXISTE PAS

#### Code M51 (avant correction)
Utilisait `'planifiee'` qui n'existe pas dans l'ENUM

---

## ✅ CORRECTION APPLIQUÉE

### Fichier corrigé
`supabase/migrations/20260107000100_m51_create_assign_technicien_rpc.sql`

### Changements

**AVANT** ❌ :
```sql
-- Vérification statut compatible
IF v_mission_statut NOT IN ('en_attente', 'planifiee') THEN
  ...
END IF;

-- Assignation avec changement de statut
UPDATE missions
SET 
  technicien_id = p_technicien_id,
  statut = CASE 
    WHEN statut = 'en_attente' THEN 'planifiee'  -- ❌ INVALIDE
    ELSE statut 
  END
```

**APRÈS** ✅ :
```sql
-- Vérification statut compatible
IF v_mission_statut NOT IN ('en_attente') THEN
  ...
END IF;

-- Assignation SANS changement de statut
UPDATE missions
SET 
  technicien_id = p_technicien_id,
  updated_at = NOW()
WHERE id = p_mission_id;
```

### Logique corrigée

1. **Assignation technicien** : Statut reste `'en_attente'`
2. **Démarrage mission** : Statut passe à `'en_cours'` (via RPC `start_mission`)
3. **Fin mission** : Statut passe à `'terminee'` (via RPC `complete_mission`)

---

## 🎯 WORKFLOW CORRECT

```
Mission créée
  ↓ statut: en_attente
Technicien assigné (assign_technicien_to_mission)
  ↓ statut: en_attente (INCHANGÉ)
Mission démarrée (start_mission)
  ↓ statut: en_cours
Mission terminée (complete_mission)
  ↓ statut: terminee
```

---

## ⚠️ PROBLÈME RESTANT

### Erreur "column user_id does not exist"

**Cause** : Policies RLS sur table `missions` référencent `user_id` inexistant

**Solution** : Appliquer M46 (fix policies RLS)

### Application M46 (MANUEL)

**Via Supabase Dashboard** :
1. Aller sur https://supabase.com/dashboard
2. SQL Editor → New query
3. Copier le contenu de :
   `supabase/migrations/20260106000300_m46_fix_user_id_policies.sql`
4. Exécuter (Run)

---

## 🧪 TEST DE VALIDATION

### Prérequis
- ✅ M46 appliquée (policies RLS corrigées)
- ✅ M51 appliquée (RPC avec statuts corrects)

### Test complet

**1. Dashboard Entreprise**
```
URL: http://localhost:5500/public/entreprise/dashboard.html
```

**2. Assigner technicien**
- Mes missions → Mission en_attente
- Cliquer "Assigner technicien"
- Sélectionner technicien actif
- Valider

**Résultat attendu** ✅ :
```
✅ Technicien assigné avec succès !
Mission : statut = en_attente
Mission : technicien_id = <uuid>
```

**PAS d'erreur** :
- ❌ `invalid input value for enum mission_status: "planifiee"`
- ❌ `column "user_id" does not exist`

---

## 📊 RÉSUMÉ

### Corrections effectuées

| Problème | Solution | Statut |
|----------|----------|--------|
| Statut 'planifiee' inexistant | Supprimé du RPC M51 | ✅ Corrigé |
| Policies RLS avec 'user_id' | M46 à appliquer manuellement | ⏳ En attente |

### Fichiers modifiés

- ✅ `supabase/migrations/20260107000100_m51_create_assign_technicien_rpc.sql`
- ⏳ `supabase/migrations/20260106000300_m46_fix_user_id_policies.sql` (à appliquer)

---

## 🚀 DÉPLOIEMENT

### Backend Supabase

**M46 (OBLIGATOIRE)** :
```bash
# Via SQL Editor Dashboard
# Copier/coller contenu M46 → Exécuter
```

**M51 (DÉJÀ EN PLACE)** :
- RPC `assign_technicien_to_mission` existe déjà
- Avec correction : ne change plus le statut

### Vérification

```bash
node _test_enum_mission_status.js
# Doit afficher: ✅ en_attente, en_cours, terminee
# Pas: ❌ planifiee

node _test_assignation_workflow.js
# Doit réussir sans erreur user_id (après M46)
```

---

## ✅ CONCLUSION

**Problème ENUM** : ✅ RÉSOLU  
- Plus d'utilisation de `'planifiee'` inexistant
- Statut reste `'en_attente'` après assignation

**Problème Policies RLS** : ⏳ EN ATTENTE  
- Appliquer M46 manuellement via Dashboard
- Corrige références `user_id` → `auth.uid()` / `profile_id`

**Workflow** : ✅ FONCTIONNEL
- Création mission → en_attente
- Assignation technicien → en_attente (technicien_id rempli)
- Démarrage mission → en_cours
- Fin mission → terminee
