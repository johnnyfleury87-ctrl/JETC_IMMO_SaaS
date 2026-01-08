# 🚨 FIX URGENT - ASSIGNATION TECHNICIEN PROD

## ✅ LIVRABLE PRÊT

### Fichiers créés

1. **Migration SQL principale** ✅
   - `supabase/migrations/20260108120000_fix_assignation_prod_urgent.sql`
   - Recrée proprement la RPC + trigger
   - Corrige tous les bugs identifiés
   - Idempotente (peut être réexécutée sans danger)

2. **Instructions détaillées** ✅
   - `_INSTRUCTIONS_FIX_ASSIGNATION_PROD.md`
   - Guide étape par étape pour appliquer en PROD
   - Tests de validation inclus

3. **Script de vérification** ✅
   - `_verify_assignation_prod.js`
   - Vérifie si la RPC existe en PROD
   - Usage: `SUPABASE_URL=... SUPABASE_ANON_KEY=... node _verify_assignation_prod.js`

4. **Analyse Git** ✅
   - `_analyse_git_assignation.sh`
   - Identifie l'historique des commits liés à l'assignation

5. **Vérifications SQL** ✅
   - `supabase/migrations/_VERIFICATION_PROD.sql`
   - Requêtes AVANT/APRÈS pour valider la migration

---

## 🎯 DIAGNOSTIC COMPLET

### Symptôme
```
Could not find the function
public.assign_technicien_to_mission(p_mission_id, p_technicien_id)
in the schema cache
```

### Root Cause
**La RPC n'existe pas en PROD** (ou existe avec mauvaise signature/bugs)

### Analyse Git
- **Dernier commit fonctionnel:** `502cb34` (7 Jan 2026)
- **Migration M51:** Créée le 7 Jan, contient bugs notifications
- **Migration M52:** Créée le 8 Jan, corrige bugs notifications
- **Migration M53:** Créée le 8 Jan, corrige trigger
- **État actuel:** Migrations pas appliquées en PROD

### Frontend
Le dashboard entreprise (`public/entreprise/dashboard.html` ligne 1710) appelle:
```javascript
await window.supabaseClient.rpc('assign_technicien_to_mission', {
  p_mission_id: missionId,
  p_technicien_id: technicienId
});
```

**Conclusion:** Le frontend est CORRECT. Le problème est 100% backend (migration manquante).

---

## ⚡ ACTION IMMÉDIATE (5 minutes)

### Étape 1: Ouvrir SQL Editor Supabase
```
https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql/new
```

### Étape 2: Copier la migration
```bash
cat supabase/migrations/20260108120000_fix_assignation_prod_urgent.sql
```

### Étape 3: Coller et exécuter
- Coller le SQL dans l'éditeur
- Cliquer **"RUN"**
- Attendre "Success" (< 1 seconde)

### Étape 4: Vérifier les logs
Vous devriez voir:
```
✅ RPC assign_technicien_to_mission(p_mission_id uuid, p_technicien_id uuid) existe
✅ Trigger technicien_assignment_notification existe sur missions
✅ Migration 20260108120000 - Fix assignation PROD terminée
```

---

## 🧪 TEST APRÈS APPLICATION

### 1. Test depuis dashboard entreprise

1. Se connecter: `https://[domaine]/entreprise/dashboard.html`
2. Ouvrir une mission "En attente"
3. Cliquer "Assigner technicien"
4. Sélectionner un technicien
5. Cliquer "Assigner"

**Résultat attendu:**
```
✅ Technicien assigné avec succès !
```

Mission mise à jour avec `technicien_id` rempli.

### 2. Test SQL (optionnel)

Dans SQL Editor:
```sql
-- Vérifier la RPC existe
SELECT proname, pg_get_function_identity_arguments(oid)
FROM pg_proc 
WHERE proname = 'assign_technicien_to_mission';

-- Attendu: 1 ligne
-- assign_technicien_to_mission | p_mission_id uuid, p_technicien_id uuid
```

---

## 📊 CE QUI A ÉTÉ CORRIGÉ

### 1. RPC assign_technicien_to_mission
- ✅ Signature exacte: `(p_mission_id uuid, p_technicien_id uuid)`
- ✅ Retour: `JSONB {success, error, message}`
- ✅ Vérifications de sécurité:
  - Entreprise connectée (auth.uid())
  - Mission appartient à l'entreprise
  - Technicien appartient à l'entreprise
  - Statut mission compatible (en_attente, planifiee)
- ✅ UPDATE direct: `missions.technicien_id = p_technicien_id`
- ✅ Gestion d'erreurs robuste (try/catch sur notifications)

### 2. Trigger notify_technicien_assignment
- ✅ Correction: `techniciens.profile_id` (pas `user_id`)
- ✅ Gestion sécurisée (try/catch, ON CONFLICT DO NOTHING)
- ✅ N'empêche pas l'assignation si notification échoue

### 3. Permissions
- ✅ GRANT EXECUTE à `authenticated`
- ✅ GRANT EXECUTE à `anon`
- ✅ SECURITY DEFINER pour vérifications métier

---

## 🔄 COMMIT ET PUSH

Une fois validé en PROD:

```bash
cd /workspaces/JETC_IMMO_SaaS

# Les fichiers sont déjà en staging
git status

# Commit
git commit -m "fix(prod): Correction urgente assignation technicien

- Recrée RPC assign_technicien_to_mission avec signature correcte
- Corrige trigger notify_technicien_assignment (profile_id)
- Gestion d'erreurs robuste
- Documentation + scripts de vérification inclus

Résout: Could not find function assign_technicien_to_mission
Testé: Dashboard entreprise ✅"

# Push
git push origin main
```

---

## 📝 FICHIERS MODIFIÉS/CRÉÉS

```
A  supabase/migrations/20260108120000_fix_assignation_prod_urgent.sql
A  supabase/migrations/_VERIFICATION_PROD.sql
A  _INSTRUCTIONS_FIX_ASSIGNATION_PROD.md
A  _verify_assignation_prod.js
A  _analyse_git_assignation.sh
A  _LIVRABLE_FIX_ASSIGNATION.md (ce fichier)
```

Aucune modification du code frontend (dashboard.html) nécessaire.

---

## ⚠️ IMPORTANT

**NE PAS APPLIQUER:**
- `_FIX_FINAL_SUPPRESSION.sql` (supprime la RPC, MAUVAISE SOLUTION)
- M51, M52, M53 séparément (bugs dans ces versions)

**APPLIQUER UNIQUEMENT:**
- `20260108120000_fix_assignation_prod_urgent.sql` (version consolidée et corrigée)

---

## 🆘 ROLLBACK (si problème)

Si la migration cause des problèmes (peu probable):

```sql
-- Supprimer le trigger (assignation via RPC fonctionnera toujours)
DROP TRIGGER IF EXISTS technicien_assignment_notification ON missions CASCADE;
DROP FUNCTION IF EXISTS notify_technicien_assignment() CASCADE;

-- Garder la RPC (nécessaire pour le frontend)
-- NE PAS supprimer assign_technicien_to_mission
```

---

## ✅ CHECKLIST FINALE

Avant de considérer le fix validé:

- [ ] Migration appliquée en PROD (SQL Editor)
- [ ] Logs de migration affichent ✅ (pas d'erreurs)
- [ ] Requêtes de vérification (_VERIFICATION_PROD.sql) passent
- [ ] Test assignation depuis dashboard entreprise réussit
- [ ] Pas d'erreur dans console navigateur (F12)
- [ ] Commit + push effectué
- [ ] Documentation à jour

---

## 🎉 RÉSULTAT ATTENDU

**Avant:**
```
❌ Could not find the function assign_technicien_to_mission
```

**Après:**
```
✅ Technicien assigné avec succès !
```

Mission mise à jour, notification envoyée au technicien.

---

**Durée totale du fix:** ~5 minutes
**Complexité:** Faible (1 migration SQL)
**Risque:** Très faible (migration idempotente, rollback facile)
**Impact:** Critique (débloque workflow entreprise)
