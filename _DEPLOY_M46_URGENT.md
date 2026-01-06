# 🚀 GUIDE DÉPLOIEMENT URGENT - Migration M46

**Date**: 2026-01-06  
**Priorité**: 🔴 CRITIQUE  
**Temps estimé**: 2 minutes  
**Pré-requis**: Accès Dashboard Supabase  

---

## ⚠️ CONTEXTE

**Bug bloquant** : Erreur `column "user_id" does not exist` lors de l'assignation d'un technicien.

**Solution** : Migration M46 corrige les policies RLS incorrectes en production.

---

## 📋 ÉTAPES DE DÉPLOIEMENT

### 1. Ouvrir Dashboard Supabase

🔗 **URL** : https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy

- Cliquer sur "SQL Editor" dans le menu de gauche
- Cliquer sur "+ New query"

### 2. Copier le SQL de Migration

Ouvrir le fichier local :
```
/workspaces/JETC_IMMO_SaaS/supabase/migrations/20260106000300_m46_fix_user_id_policies.sql
```

**OU** copier depuis GitHub :
```
https://github.com/johnnyfleury87-ctrl/JETC_IMMO_SaaS/blob/main/supabase/migrations/20260106000300_m46_fix_user_id_policies.sql
```

### 3. Coller et Exécuter

1. Coller tout le contenu du fichier SQL dans l'éditeur Supabase
2. Cliquer sur **"Run"** (ou Ctrl+Enter)
3. Attendre l'exécution (~2-3 secondes)

### 4. Vérifier les Logs

La migration affiche des logs de diagnostic et validation.

**Logs attendus** :
```
🔍 DIAGNOSTIC POLICIES RLS
===========================================

Table: public.missions
Policy: Entreprise can view own missions
Command: SELECT
USING: ...

✅ VALIDATION M46
===========================================
Policies techniciens: 7
Policies missions: 8
✅ Aucune policy n'utilise "user_id"
✅ M46: Migration réussie
===========================================
```

**Si erreur** :
- Lire le message d'erreur PostgreSQL
- Vérifier si policies existent déjà avec `DROP POLICY IF EXISTS` manuel
- Contacter support si blocage

### 5. Tester en Production

#### Test 1 : Assignation Technicien

1. Ouvrir application : https://jetc-immo-saas.vercel.app
2. Login entreprise : `entreprise1@test.com` / `Test1234!`
3. Dashboard → Section "Mes missions"
4. Cliquer sur "👤 Assigner technicien" sur une mission en_attente
5. Sélectionner un technicien
6. Cliquer "✅ Assigner"

**Résultat attendu** :
- ✅ Message succès : "Technicien assigné avec succès !"
- ✅ Mission refresh automatiquement
- ✅ Bouton change en "▶️ Démarrer"

**Si erreur** :
- Ouvrir DevTools Console (F12)
- Noter le message d'erreur
- Vérifier que la migration s'est bien exécutée

#### Test 2 : Workflow Complet

1. Assigner technicien (comme ci-dessus)
2. Cliquer "▶️ Démarrer"
   - ✅ Mission passe à statut "en_cours"
   - ✅ Bouton change en "✅ Terminer"
3. Cliquer "✅ Terminer"
   - ✅ Mission passe à statut "terminee"
   - ✅ Message succès
   - ✅ Attente validation régie

---

## 🔄 ROLLBACK (si problème)

**Si la migration cause des problèmes** :

### Étape 1 : Exécuter Rollback

1. Dashboard Supabase → SQL Editor
2. Ouvrir fichier :
   ```
   /workspaces/JETC_IMMO_SaaS/supabase/migrations/20260106000300_m46_fix_user_id_policies_rollback.sql
   ```
3. Copier contenu
4. Coller dans éditeur Supabase
5. Exécuter

**Logs attendus** :
```
✅ ROLLBACK M46: Policies supprimées
⚠️  Les policies précédentes doivent être restaurées manuellement si nécessaire
```

### Étape 2 : Restaurer État Précédent (manuel)

⚠️ **ATTENTION** : Le rollback supprime les nouvelles policies mais ne restaure pas les anciennes.

**Option A** : Laisser sans policies (RLS désactivée temporairement)
```sql
ALTER TABLE missions DISABLE ROW LEVEL SECURITY;
ALTER TABLE techniciens DISABLE ROW LEVEL SECURITY;
```

**Option B** : Réactiver RLS manuellement avec policies de base
```sql
-- Politique minimale (entreprise only)
CREATE POLICY "temp_entreprise_missions"
ON missions FOR ALL
USING (
  entreprise_id IN (
    SELECT id FROM entreprises WHERE profile_id = auth.uid()
  )
);
```

---

## 📊 RÉSUMÉ

### Avant Migration M46
| Fonctionnalité | Statut | Impact |
|----------------|--------|--------|
| Assigner technicien | ❌ Bloqué | Erreur user_id |
| Démarrer mission | ⚠️ Non testable | Blocage assignation |
| Terminer mission | ⚠️ Non testable | Blocage assignation |
| Dashboard entreprise | ❌ Non fonctionnel | Workflow incomplet |

### Après Migration M46
| Fonctionnalité | Statut | Impact |
|----------------|--------|--------|
| Assigner technicien | ✅ Fonctionnel | RPC OK |
| Démarrer mission | ✅ Fonctionnel | Workflow complet |
| Terminer mission | ✅ Fonctionnel | Workflow complet |
| Dashboard entreprise | ✅ 100% opérationnel | Toutes actions disponibles |

---

## 📚 RÉFÉRENCES

### Fichiers Modifiés
- ✅ `supabase/migrations/20260106000300_m46_fix_user_id_policies.sql` (migration principale)
- ✅ `supabase/migrations/20260106000300_m46_fix_user_id_policies_rollback.sql` (rollback)
- 📄 `audit/REPORT_BUG_USER_ID_POLICIES.md` (rapport complet)

### Commits Git
- **30fd4ca** : fix(rls): Corriger policies RLS avec user_id - CRITIQUE 🔴

### Documentation
- Rapport complet : `audit/REPORT_BUG_USER_ID_POLICIES.md`
- Schema référence : `supabase/schema/11_techniciens.sql` + `supabase/schema/13_missions.sql`

---

## ✅ CHECKLIST DÉPLOIEMENT

- [ ] Dashboard Supabase ouvert
- [ ] Migration M46 copiée
- [ ] Migration exécutée avec succès
- [ ] Logs validation vérifiés (✅ M46: Migration réussie)
- [ ] Test assignation technicien OK
- [ ] Test workflow complet OK (assign → start → complete)
- [ ] Aucune erreur console
- [ ] Dashboard entreprise 100% fonctionnel

---

## 🆘 SUPPORT

### Si Problème Pendant Migration

1. **Erreur "policy already exists"** :
   ```sql
   -- Supprimer manuellement toutes les policies
   DROP POLICY IF EXISTS "Entreprise can view own techniciens" ON techniciens;
   DROP POLICY IF EXISTS "Entreprise can view own missions" ON missions;
   -- Puis réexécuter migration M46
   ```

2. **Erreur "permission denied"** :
   - Vérifier que vous êtes connecté avec le compte owner
   - Utiliser "Service Role Key" si nécessaire

3. **Erreur timeout** :
   - Exécuter migration en plusieurs parties
   - D'abord section TECHNICIENS
   - Puis section MISSIONS
   - Enfin section VALIDATION

### Si Problème Après Migration

1. **Assignation ne fonctionne toujours pas** :
   - Vérifier logs SQL Editor : policies bien créées ?
   - Tester requête manuelle :
     ```sql
     SELECT * FROM missions WHERE entreprise_id IN (
       SELECT id FROM entreprises WHERE profile_id = auth.uid()
     );
     ```

2. **Autre erreur survient** :
   - Exécuter rollback immédiatement
   - Noter l'erreur exacte
   - Consulter `audit/REPORT_BUG_USER_ID_POLICIES.md`

---

**Temps total estimé** : 2-5 minutes  
**Risque** : 🟡 Moyen (rollback disponible)  
**Bénéfice** : 🟢 Critique (déblocage workflow missions)
