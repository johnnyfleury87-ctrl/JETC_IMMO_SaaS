# ÉTAPE 2 — LOG APPLICATION MIGRATION M42

**Date:** 2026-01-04  
**Migration:** M42 - Ajouter colonne missions.disponibilite_id  
**Fichier:** `supabase/migrations/20260104001800_m42_add_disponibilite_id_missions.sql`

---

## PHASE 1: VÉRIFICATIONS AVANT APPLICATION

### Check 1: Colonne missions.disponibilite_id

**Commande:**
```javascript
supabase.from('missions').select('disponibilite_id', { head: true })
```

**Résultat:**
```
Error: (erreur vide - limitation RLS anon, statut UNKNOWN)
```

**Confirmation via CSV audit:**
```
Source: supabase/Audit_supabase/4_Colonnes détaillées.csv
Colonnes missions: 20 total
Colonne disponibilite_id: ❌ ABSENTE
```

**✅ PREUVE: Colonne missions.disponibilite_id ABSENTE**

### Check 2: Table tickets_disponibilites (FK target)

**Commande:**
```javascript
supabase.from('tickets_disponibilites').select('id', { head: true })
```

**Résultat:**
```
✅ SUCCESS - Table accessible
```

**✅ PREUVE: Table tickets_disponibilites EXISTE (pré-requis FK satisfait)**

---

## PHASE 2: APPLICATION MIGRATION M42

### Limitation technique identifiée

**Problème:** Supabase JS SDK (client-side) ne peut pas exécuter DDL (Data Definition Language).

**Opérations DDL requises par M42:**
- `ALTER TABLE missions ADD COLUMN ...`
- `CREATE INDEX ...`
- `COMMENT ON COLUMN ...`

**Solutions disponibles:**

#### ✅ MÉTHODE 1 (RECOMMANDÉE): Supabase Studio SQL Editor

**Étapes:**
1. Ouvrir Supabase Studio: https://bwzyajsrmfhrxdmfpyqy.supabase.co/project/_/sql
2. Créer nouveau query
3. Copier contenu fichier: `_fix_output/02_migration_m42_to_apply.sql` (ou original)
4. Exécuter (bouton RUN)
5. Vérifier message de validation: `✅ M42: Colonne disponibilite_id ajoutée à missions`

**Avantages:**
- Interface web simple
- Logs SQL en temps réel
- Validation intégrée
- Pas de configuration locale requise

#### ⚠️ MÉTHODE 2: psql CLI (fallback)

**Pré-requis:** psql installé localement

**Commande:**
```bash
psql "$DATABASE_URL" -f supabase/migrations/20260104001800_m42_add_disponibilite_id_missions.sql
```

**Statut:** ❌ psql NON DISPONIBLE dans environnement actuel

#### ⚠️ MÉTHODE 3: Supabase CLI

**Pré-requis:** Supabase CLI installé

**Commandes:**
```bash
supabase link --project-ref bwzyajsrmfhrxdmfpyqy
supabase db push
```

**Statut:** ❌ Supabase CLI NON DISPONIBLE dans environnement actuel

### Migration préparée

**Fichier source:** `supabase/migrations/20260104001800_m42_add_disponibilite_id_missions.sql`  
**Fichier copie:** `_fix_output/02_migration_m42_to_apply.sql`

**Contenu migration M42:**

```sql
-- Ajouter colonne disponibilite_id
ALTER TABLE missions
ADD COLUMN IF NOT EXISTS disponibilite_id uuid 
REFERENCES tickets_disponibilites(id) ON DELETE SET NULL;

-- Commentaire
COMMENT ON COLUMN missions.disponibilite_id IS
'Créneau de disponibilité sélectionné par l''entreprise lors de l''acceptation du ticket.
NULL si ticket accepté avant M42 ou si pas de disponibilités.';

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_missions_disponibilite_id 
ON missions(disponibilite_id) 
WHERE disponibilite_id IS NOT NULL;

-- Validation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'missions'
    AND column_name = 'disponibilite_id'
  ) THEN
    RAISE NOTICE '✅ M42: Colonne disponibilite_id ajoutée à missions';
  ELSE
    RAISE EXCEPTION '❌ M42: Erreur lors de l''ajout de la colonne';
  END IF;
END $$;
```

**Caractéristiques:**
- `IF NOT EXISTS`: Sécurisé (pas d'erreur si déjà appliqué)
- `ON DELETE SET NULL`: FK non bloquante (permet suppression disponibilité)
- Index partiel: Optimisé (seulement lignes avec disponibilite_id NOT NULL)
- Validation intégrée: Lève EXCEPTION si échec

---

## PHASE 3: STATUT ACTUEL

### État migration M42

| Attribut | Valeur |
|----------|--------|
| **Fichier migration** | ✅ Créé (20260104001800_m42_add_disponibilite_id_missions.sql) |
| **Fichier rollback** | ✅ Créé (20260104001800_m42_add_disponibilite_id_missions_rollback.sql) |
| **Application DB** | ⏳ **EN ATTENTE** (application manuelle requise) |
| **Enregistrement migration_logs** | ⏳ EN ATTENTE (après application DB) |
| **Validation post-application** | ⏳ EN ATTENTE |

### Résultat vérification post-application (test)

**Commande:**
```javascript
supabase.from('missions').select('disponibilite_id', { head: true })
```

**Résultat:**
```
Error: (erreur vide - colonne toujours absente)
```

**✅ CONFIRMATION: Migration M42 NON ENCORE APPLIQUÉE**

---

## ACTIONS REQUISES (UTILISATEUR)

### 1. Appliquer migration M42 dans Supabase Studio

**Instructions détaillées:**

1. **Ouvrir SQL Editor:**
   - URL: https://bwzyajsrmfhrxdmfpyqy.supabase.co/project/_/sql
   - Ou: Dashboard → SQL Editor (menu gauche)

2. **Créer nouvelle requête:**
   - Cliquer "New query"
   - Ou: Bouton "+ New query"

3. **Copier migration SQL:**
   - Ouvrir fichier: `_fix_output/02_migration_m42_to_apply.sql`
   - Copier TOUT le contenu (47 lignes)
   - Coller dans SQL Editor

4. **Exécuter migration:**
   - Cliquer bouton "RUN" (ou Ctrl+Enter)
   - Attendre exécution complète

5. **Vérifier résultat:**
   - Onglet "Results" doit afficher:
     ```
     NOTICE: ✅ M42: Colonne disponibilite_id ajoutée à missions
     ```
   - Si erreur: copier message complet pour debugging

6. **Vérifier colonne créée:**
   - Dans SQL Editor, exécuter:
     ```sql
     SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name='missions' AND column_name='disponibilite_id';
     ```
   - Résultat attendu: 1 ligne `disponibilite_id | uuid | YES`

### 2. Enregistrer migration dans migration_logs

**Après application réussie, exécuter dans SQL Editor:**

```sql
INSERT INTO public.migration_logs (
  migration_name,
  description
) VALUES (
  '20260104001800_m42_add_disponibilite_id_missions',
  'Ajout colonne disponibilite_id à missions pour enregistrer créneau sélectionné (M42)'
);
```

**Vérification enregistrement:**
```sql
SELECT migration_name, executed_at, description
FROM migration_logs
WHERE migration_name LIKE '%m42%';
```

### 3. Relancer vérification post-application

**Commande:**
```bash
node _fix_step2_apply_m42.js
```

**Résultat attendu:**
```
✅ MIGRATION M42 APPLIQUÉE AVEC SUCCÈS!
```

---

## ROLLBACK (SI NÉCESSAIRE)

**⚠️ Utiliser UNIQUEMENT si migration M42 cause des problèmes**

**Fichier:** `supabase/migrations/20260104001800_m42_add_disponibilite_id_missions_rollback.sql`

**Contenu:**
```sql
-- Supprimer index
DROP INDEX IF EXISTS idx_missions_disponibilite_id;

-- Supprimer colonne
ALTER TABLE missions DROP COLUMN IF EXISTS disponibilite_id;
```

**Application rollback:**
1. Copier contenu fichier rollback
2. Exécuter dans Supabase Studio SQL Editor
3. Supprimer enregistrement migration_logs:
   ```sql
   DELETE FROM migration_logs 
   WHERE migration_name = '20260104001800_m42_add_disponibilite_id_missions';
   ```

---

## FICHIERS GÉNÉRÉS

| Fichier | Description |
|---------|-------------|
| `_fix_output/02_apply_m42_log.md` | Ce fichier - log complet ÉTAPE 2 |
| `_fix_output/02_before_after_checks.sql` | Requêtes SQL vérification avant/après |
| `_fix_output/02_migration_m42_to_apply.sql` | Copie migration M42 prête à exécuter |
| `_fix_output/02_apply_m42_results.json` | Résultats bruts script Node.js |

---

## RÉSUMÉ ÉTAPE 2

| Phase | Statut | Détails |
|-------|--------|---------|
| **Vérifications avant** | ✅ TERMINÉ | Colonne absente confirmée, FK target existe |
| **Préparation migration** | ✅ TERMINÉ | Fichier SQL prêt, instructions fournies |
| **Application DB** | ⏳ **EN ATTENTE** | Utilisateur doit exécuter dans Supabase Studio |
| **Validation post** | ⏳ EN ATTENTE | Après application DB |
| **Enregistrement logs** | ⏳ EN ATTENTE | Après application DB |

---

## PROCHAINES ÉTAPES

**Après application M42 réussie:**

1. ✅ ÉTAPE 2 complète (blocker #1 résolu)
2. ⏳ ÉTAPE 3: Application migration M41 (blocker #2 - RPC mode_diffusion)
3. ⏳ ÉTAPE 4: Investigation enum ticket_status (blocker #3)
4. ⏳ ÉTAPE 5: Tests automatisés workflow complet
5. ⏳ ÉTAPE 6: Recap final + archivage

---

**FIN LOG ÉTAPE 2 — ATTENTE ACTION UTILISATEUR**

**Action immédiate requise:** Appliquer migration M42 dans Supabase Studio SQL Editor (voir instructions section "ACTIONS REQUISES").

Après application: Relancer `node _fix_step2_apply_m42.js` pour validation.
