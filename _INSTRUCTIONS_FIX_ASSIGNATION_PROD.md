# 🚨 FIX URGENT - ASSIGNATION TECHNICIEN EN PROD

## Symptôme actuel

```
Could not find the function
public.assign_technicien_to_mission(p_mission_id, p_technicien_id)
in the schema cache
```

## Diagnostic

1. **La RPC n'existe pas** en PROD, ou
2. **Le trigger casse l'UPDATE** à cause de colonnes inexistantes (user_id)

## Solution - Migration unique et complète

**Fichier:** `supabase/migrations/20260108120000_fix_assignation_prod_urgent.sql`

Cette migration fait:
- ✅ Nettoie toutes les anciennes versions
- ✅ Recrée la RPC `assign_technicien_to_mission(p_mission_id, p_technicien_id)` 
- ✅ Corrige le trigger `notify_technicien_assignment` (profile_id au lieu de user_id)
- ✅ Ajoute gestion d'erreurs robuste
- ✅ Valide que tout est créé

## Étapes d'application en PROD

### 1. Ouvrir l'éditeur SQL Supabase

```
https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql/new
```

### 2. Copier le contenu de la migration

```bash
cat supabase/migrations/20260108120000_fix_assignation_prod_urgent.sql
```

### 3. Coller dans l'éditeur et cliquer "RUN"

### 4. Vérifier les logs

Vous devriez voir:
```
✅ RPC assign_technicien_to_mission(p_mission_id uuid, p_technicien_id uuid) existe
✅ Trigger technicien_assignment_notification existe sur missions
✅ Migration 20260108120000 - Fix assignation PROD terminée
```

## Test immédiat après application

### 1. Se connecter au dashboard entreprise

```
https://[votre-domaine]/entreprise/dashboard.html
```

### 2. Test d'assignation

1. Cliquer sur une mission "En attente"
2. Cliquer sur "Assigner technicien"
3. Sélectionner un technicien
4. Cliquer "Assigner"

**Résultat attendu:**
```
✅ Technicien assigné avec succès !
```

**Si erreur:**
- Ouvrir la console navigateur (F12)
- Noter l'erreur exacte
- Vérifier les logs Supabase

## Validation approfondie (SQL Editor)

Après application, vérifier dans l'éditeur SQL:

```sql
-- 1. Vérifier la RPC existe
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'assign_technicien_to_mission';

-- Attendu: 1 ligne avec args = "p_mission_id uuid, p_technicien_id uuid"

-- 2. Vérifier le trigger existe
SELECT 
  t.tgname as trigger_name,
  c.relname as table_name,
  p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'missions'
  AND t.tgname = 'technicien_assignment_notification';

-- Attendu: 1 ligne avec trigger sur missions → notify_technicien_assignment

-- 3. Test d'appel RPC (avec IDs fictifs, attendu: erreur Mission introuvable)
SELECT assign_technicien_to_mission(
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid
);

-- Attendu: {"success": false, "error": "Vous devez être connecté..."}
-- ou {"success": false, "error": "Mission introuvable"}
```

## Rollback (si nécessaire)

Si la migration cause des problèmes:

```sql
-- Supprimer le trigger
DROP TRIGGER IF EXISTS technicien_assignment_notification ON missions CASCADE;
DROP FUNCTION IF EXISTS notify_technicien_assignment() CASCADE;

-- Garder la RPC pour l'assignation de base
-- (le frontend en a besoin)
```

## Commit et push

Une fois validé en PROD:

```bash
git add supabase/migrations/20260108120000_fix_assignation_prod_urgent.sql
git commit -m "fix(prod): Correction urgente assignation technicien - RPC + trigger"
git push origin main
```

## Points clés de la correction

1. **RPC assign_technicien_to_mission**
   - Signature: `(p_mission_id uuid, p_technicien_id uuid)`
   - Retour: `JSONB {success, error, message}`
   - Vérifie: entreprise, mission, technicien
   - Fait: UPDATE missions SET technicien_id = ...

2. **Trigger notify_technicien_assignment**
   - Correction: `techniciens.profile_id` (pas `user_id`)
   - Gestion d'erreurs robuste (try/catch)
   - N'empêche pas l'assignation si notification échoue

3. **Frontend** (dashboard.html ligne 1710)
   - Appelle: `.rpc('assign_technicien_to_mission', {p_mission_id, p_technicien_id})`
   - Matche exactement la nouvelle signature ✅

## Support

Si problème après application:
1. Noter l'erreur exacte (console + logs Supabase)
2. Vérifier que M51, M52, M53 ne sont pas appliquées en double
3. Au besoin, DROP CASCADE toutes les fonctions et réappliquer uniquement cette migration
