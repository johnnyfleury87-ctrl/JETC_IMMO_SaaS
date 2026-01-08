# 📁 FICHIERS DE CORRECTION BUG M52

## 🎯 Migrations (À appliquer)

### Migration principale
- **`supabase/migrations/20260108000000_m52_fix_assign_technicien_notifications.sql`**
  - Migration complète avec documentation
  - Recrée assign_technicien_to_mission avec les bons noms de colonnes
  - Inclut validations et commentaires

### Version simplifiée (pour copier-coller)
- **`supabase/migrations/_APPLY_M52_MANUAL.sql`**
  - Version épurée sans commentaires
  - Prête à copier-coller dans Dashboard Supabase
  - **👉 UTILISER CELLE-CI pour application rapide**

## 📖 Documentation

### Guide rapide
- **`_ACTION_IMMEDIATE_FIX_M52.md`**
  - Instructions d'application en 2 minutes
  - Checklist de vérification
  - **👉 LIRE EN PREMIER**

### Documentation technique complète
- **`_RESOLUTION_BUG_USER_ID.md`**
  - Diagnostic complet du bug
  - Explication de la cause racine
  - Instructions d'application détaillées
  - Tests de validation

### Synthèse
- **`_SYNTHESE_BUG_FIX_M52.txt`**
  - Résumé complet en format texte
  - Vue d'ensemble problème → solution
  - Checklist complète

## 🔧 Scripts d'audit et application

### Audit du bug
- **`_audit_bug_user_id.js`**
  - Audit exhaustif des policies RLS
  - Audit des RPC/functions
  - Audit des triggers
  - Identification de la source du bug

### Tentatives d'application automatique
- **`_apply_m52_fix_notifications.js`**
  - Tentative application via pg direct
  - (échoue à cause IPv6 - utiliser méthode manuelle)

- **`_apply_m52_via_api.js`**
  - Tentative via API Supabase
  - Génère automatiquement _APPLY_M52_MANUAL.sql

### Vérification post-application
- **`_verify_m52_fix.js`**
  - Vérifie que la fonction existe
  - Vérifie les bons noms de colonnes
  - Checklist de validation
  - **👉 EXÉCUTER APRÈS application de M52**

## 📝 Fichiers modifiés

### Migration M51 (header mis à jour)
- **`supabase/migrations/20260107000100_m51_create_assign_technicien_rpc.sql`**
  - Header mis à jour pour indiquer qu'elle est buguée
  - Référence M52 comme correction
  - ⚠️ NE PAS réappliquer cette version

## 🎯 Workflow recommandé

1. **Lire** : `_ACTION_IMMEDIATE_FIX_M52.md`
2. **Copier** : `supabase/migrations/_APPLY_M52_MANUAL.sql`
3. **Coller et exécuter** : Dashboard Supabase SQL Editor
4. **Vérifier** : `node _verify_m52_fix.js`
5. **Tester** : Assignation technicien en production

## 📊 Résumé

| Type | Fichier | Usage |
|------|---------|-------|
| 🚀 Migration | `_APPLY_M52_MANUAL.sql` | **APPLIQUER** |
| 📖 Guide | `_ACTION_IMMEDIATE_FIX_M52.md` | **LIRE EN PREMIER** |
| ✅ Vérification | `_verify_m52_fix.js` | **EXÉCUTER APRÈS** |
| 📚 Référence | `_RESOLUTION_BUG_USER_ID.md` | Documentation complète |
| 📄 Synthèse | `_SYNTHESE_BUG_FIX_M52.txt` | Vue d'ensemble |

---

**Temps total estimé : 5 minutes**
- Lecture : 1 min
- Application : 2 min
- Vérification : 2 min
