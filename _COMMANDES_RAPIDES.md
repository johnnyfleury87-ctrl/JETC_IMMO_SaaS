# 🚀 COMMANDES RAPIDES - AUDIT & FIX TECHNICIENS

## ✅ DÉJÀ EXÉCUTÉ

```bash
# Fix code API
# Fichier: api/techniciens/create.js
# Modification: Ajout id: authUser.user.id

# Migration données
node _apply_migration_fix_techniciens.js
# ✅ Résultat: 3/3 techniciens cohérents

# Tests validation
node _test_complet_entreprise_technicien.js
# ✅ Résultat: Tous les tests PASS

# Preuve finale
node _preuve_finale_technicien.js
# ✅ Résultat: Login technicien → Missions visibles
```

---

## ⚠️ À EXÉCUTER (SQL)

### Via Supabase SQL Editor

**Copier/coller le contenu de:** `_DEPLOIEMENT_SQL_FINAL.sql`

**OU copier directement ces commandes:**

```sql
-- 1. VÉRIFIER ÉTAT
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE id = profile_id) as coherents,
  COUNT(*) FILTER (WHERE id <> profile_id) as incoherents
FROM techniciens;
-- Attendu: total=3, coherents=3, incoherents=0

-- 2. AJOUTER CONTRAINTE CHECK
ALTER TABLE techniciens 
  DROP CONSTRAINT IF EXISTS techniciens_id_equals_profile_id;

ALTER TABLE techniciens 
  ADD CONSTRAINT techniciens_id_equals_profile_id
  CHECK (id = profile_id);
-- ✅ Message: ALTER TABLE

-- 3. DÉPLOYER RPC AMÉLIORÉ
-- Copier tout le contenu de _DEPLOIEMENT_SQL_FINAL.sql
-- à partir de "CREATE OR REPLACE FUNCTION assign_technicien_to_mission"

-- 4. VÉRIFIER
-- Le script inclut des tests automatiques
```

---

## 🧪 COMMANDES DE VÉRIFICATION

### Vérifier cohérence techniciens
```bash
node _test_complet_entreprise_technicien.js
```

**Résultat attendu:**
```
✅ Techniciens cohérents: 3/3
✅ Missions assignables: OUI
✅ RLS OK
```

### Prouver que technicien voit ses missions
```bash
node _preuve_finale_technicien.js
```

**Résultat attendu:**
```
✅ Login réussi
✅ Technicien cohérent (id = profile_id)
✅ Missions visibles: 1+
🎉 PROBLÈME RÉSOLU
```

### Audit complet (diagnostic)
```bash
node _audit_complet_entreprise_technicien.js
```

**Utiliser pour:**
- Diagnostiquer un nouveau problème
- Vérifier l'état global du système
- Détecter missions orphelines

---

## 📋 COMMANDES DE NETTOYAGE (si nécessaire)

### Réappliquer la migration
```bash
# Si des techniciens incohérents réapparaissent
node _apply_migration_fix_techniciens.js
```

### Nettoyer missions orphelines
```bash
node _fix_mission_orpheline.js
```

---

## 🔍 COMMANDES DE DEBUG

### Vérifier RLS policies
```bash
node _audit_rls_missions_technicien.js
```

### Analyser code frontend
```bash
node _audit_frontend_assignation.js
```

---

## 📊 COMMANDE ONE-LINER COMPLÈTE

```bash
# Audit + Fix + Test en une seule commande
cd /workspaces/JETC_IMMO_SaaS && \
  echo "=== AUDIT ===" && \
  node _test_complet_entreprise_technicien.js && \
  echo "" && \
  echo "=== PREUVE ===" && \
  node _preuve_finale_technicien.js
```

**Résultat attendu (si tout OK):**
```
=== AUDIT ===
✅ Techniciens cohérents: 3/3
✅ Missions assignables: OUI
✅ RLS OK

=== PREUVE ===
✅ Login réussi
✅ 1 mission visible
🎉 PROBLÈME RÉSOLU
```

---

## 🎯 CHECKLIST DÉPLOIEMENT

```bash
# 1. ✅ Fix code (FAIT)
# api/techniciens/create.js modifié

# 2. ✅ Migration données (FAIT)
node _apply_migration_fix_techniciens.js

# 3. ✅ Tests (FAIT)
node _test_complet_entreprise_technicien.js
node _preuve_finale_technicien.js

# 4. ⚠️ Déploiement SQL (À FAIRE)
# Via Supabase SQL Editor:
#   - Copier _DEPLOIEMENT_SQL_FINAL.sql
#   - Exécuter

# 5. 🧪 Tests manuels UI (À FAIRE)
#   - Créer nouveau technicien
#   - Assigner mission
#   - Login technicien
#   - Vérifier visibilité
```

---

## 📚 DOCUMENTATION

```bash
# Lire résumé exécutif
cat _RESUME_EXECUTIF_FIX.md

# Lire rapport complet
cat _RAPPORT_AUDIT_FINAL_ENTREPRISE_TECHNICIEN.md

# Lire guide utilisateur
cat _GUIDE_RAPIDE_CORRECTION.md

# Voir schémas visuels
cat _SCHEMA_VISUEL_BUG_FIX.md

# Index complet
cat _INDEX_AUDIT_FIX_COMPLETE.md
```

---

## 🆘 EN CAS D'ERREUR

### "Technicien incohérent détecté"
```bash
node _apply_migration_fix_techniciens.js
```

### "Mission orpheline détectée"
```bash
node _fix_mission_orpheline.js
```

### "RLS ne fonctionne pas"
```bash
# 1. Vérifier policies
node _audit_rls_missions_technicien.js

# 2. Vérifier cohérence techniciens
node _test_complet_entreprise_technicien.js
```

### "Erreur assignation mission"
```bash
# Vérifier logs Supabase pour voir détails RPC
# Les logs incluent maintenant [ASSIGN] avec détails
```

---

**🎉 TOUS LES OUTILS SONT PRÊTS !**

Le système est fonctionnel. Il ne reste qu'à déployer les contraintes SQL via Supabase SQL Editor pour le rendre complètement robuste.
