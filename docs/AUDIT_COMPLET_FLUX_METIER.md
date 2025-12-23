# 🔍 AUDIT COMPLET - FLUX MÉTIER RÉGIE → LOCATAIRE → LOGEMENT → TICKETS

**Date**: 23 décembre 2025  
**Périmètre**: Création locataire, relations DB, règles métier, isolation multi-tenant  
**Objectif**: Identifier TOUS les points cassés et proposer plan d'action structuré

---

## 📊 SCHÉMA FLUX COMPLET

```
RÉGIE (crée) 
   ↓
UTILISATEUR SUPABASE AUTH (auth.users)
   ↓
PROFILE (profiles.id = auth.users.id)
   ↓  
LOCATAIRE (locataires.profile_id)
   ├── regie_id → REGIES
   └── logement_id → LOGEMENTS (optionnel)
         ↓
      IMMEUBLE (immeubles.id)
         ↓
      RÉGIE (immeubles.regie_id)
         
TICKET (tickets)
   ├── locataire_id → LOCATAIRES
   ├── logement_id → LOGEMENTS (OBLIGATOIRE)
   └── regie_id (calculé auto via trigger)
```

---

## 🎯 TABLEAU DE COHÉRENCE STRUCTURELLE

| Entité | Table | Colonnes clés | FK déclarées | RLS activé | Cascade | État |
|--------|-------|---------------|--------------|-----------|---------|------|
| **Profile** | `profiles` | `id`, `role`, `regie_id` | `id → auth.users(id)` ON DELETE CASCADE | ✅ | Oui | ⚠️ PARTIEL |
| **Régie** | `regies` | `id`, `profile_id` | `profile_id → profiles(id)` ON DELETE CASCADE | ✅ | Oui | ✅ OK |
| **Immeuble** | `immeubles` | `id`, `regie_id` | `regie_id → regies(id)` ON DELETE CASCADE | ✅ | Oui | ✅ OK |
| **Logement** | `logements` | `id`, `immeuble_id` | `immeuble_id → immeubles(id)` ON DELETE CASCADE | ✅ | Oui | ✅ OK |
| **Locataire** | `locataires` | `id`, `profile_id`, `logement_id`, `regie_id` | `profile_id → profiles(id)`, `logement_id → logements(id)`, **`regie_id → regies(id)` (MIGRATION)** | ✅ | Mixte | ⚠️ **EN COURS** |
| **Ticket** | `tickets` | `id`, `locataire_id`, `logement_id`, `regie_id` | `locataire_id → locataires(id)`, `logement_id → logements(id)` | ✅ | Oui | ❌ **KO** |

---

## 🚨 POINTS CASSÉS / INCOHÉRENTS

### 🔴 BLOQUANT 1 : Colonne `locataires.regie_id` non déployée

**Problème** :
- Migration `20251223000000_add_regie_id_to_locataires.sql` créée mais **NON EXÉCUTÉE en production**
- Frontend requiert `.eq('regie_id', regieId)` → échoue si colonne absente
- Pas d'isolation multi-tenant garantie
- RPC `creer_locataire_complet()` passe `p_regie_id` mais INSERT échoue si colonne absente

**Impact** :
- ❌ Impossible de lister les locataires par régie
- ❌ Locataire créé sans `regie_id` = orphelin
- ❌ Pas de cascade DELETE si régie supprimée

**Validation** :
```sql
-- Vérifier si colonne existe
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'locataires' AND column_name = 'regie_id';
```

**Correction** :
Exécuter `20251223000000_add_regie_id_to_locataires.sql` en production

---

### 🔴 BLOQUANT 2 : `profiles.regie_id` non contrainte

**Problème** :
- Colonne `profiles.regie_id` existe mais **SANS FK vers `regies(id)`**
- Peut contenir des UUID invalides ou NULL
- Utilisé par RPC pour récupérer `regie_id` du créateur

**Impact** :
- ❌ Données incohérentes possibles (regie_id fantôme)
- ❌ Pas de cascade si régie supprimée
- ⚠️ Backend peut échouer si profile.regie_id invalide

**Code actuel (backend)** :
```javascript
// api/locataires/create.js ligne 60
const { data: regieProfile, error: regieError } = await supabaseAdmin
  .from('profiles')
  .select('regie_id')
  .eq('id', user.id)
  .single();

if (regieError || !regieProfile?.regie_id) {
  return res.status(400).json({ 
    error: 'Profil régie sans rattachement valide'
  });
}
```

**Correction nécessaire** :
```sql
-- Ajouter FK sur profiles.regie_id
ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_regie
  FOREIGN KEY (regie_id) REFERENCES regies(id) ON DELETE CASCADE;
```

---

### 🔴 BLOQUANT 3 : Règle métier "ticket sans logement" NON vérifiée côté DB

**Problème** :
- Règle : "Seul un locataire AVEC logement peut créer un ticket"
- Vérification actuelle : **UNIQUEMENT côté backend** (api/tickets/create.js ligne 84)
- Aucune contrainte DB ou trigger
- Table `tickets` accepte `logement_id NOT NULL` mais n'empêche pas incohérences

**Code backend** :
```javascript
// api/tickets/create.js ligne 84
if (!locataire.logement_id) {
  return res.status(400).json({ 
    message: 'Vous devez être rattaché à un logement pour créer un ticket' 
  });
}
```

**Impact** :
- ⚠️ Contournable via SQL direct ou autre API
- ⚠️ Pas de garantie au niveau base de données
- ⚠️ Règle métier fragile (uniquement frontend/backend)

**Correction nécessaire** :
Ajouter trigger ou CHECK constraint :
```sql
-- Option 1 : Trigger de validation
CREATE OR REPLACE FUNCTION check_locataire_has_logement()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM locataires 
    WHERE id = NEW.locataire_id 
      AND logement_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Le locataire doit avoir un logement pour créer un ticket';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_locataire_has_logement
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION check_locataire_has_logement();
```

---

### 🟠 IMPORTANT 1 : Synchronisation `profiles.logement_id` fragile

**Problème** :
- Trigger `sync_profile_on_locataire_update` (08_locataires.sql ligne 84)
- Synchronise `profiles.logement_id` ← `locataires.logement_id`
- Mais **unidirectionnel** : si `profiles.logement_id` modifié directement, `locataires.logement_id` pas mis à jour

**Code actuel** :
```sql
-- 08_locataires.sql ligne 73
CREATE TRIGGER sync_profile_on_locataire_update
  AFTER INSERT OR UPDATE OF logement_id, profile_id ON locataires
  FOR EACH ROW EXECUTE FUNCTION sync_profile_logement_id();
```

**Impact** :
- ⚠️ Possible désynchronisation si modification manuelle
- ⚠️ Redondance fragile

**Correction recommandée** :
Option A : Supprimer `profiles.logement_id` (source unique = `locataires`)
Option B : Ajouter trigger réciproque + contrainte UNIQUE

---

### 🟠 IMPORTANT 2 : Constraint `locataires.logement_id` pas de vérification unicité

**Problème** :
- Règle métier : "Un logement ne peut avoir qu'UN locataire actif"
- Vérification actuelle : RPC `creer_locataire_complet()` ligne 92
- Mais **pas de contrainte DB** → contournable

**Code RPC actuel** :
```sql
-- 2025-12-21_fix_locataire_sans_logement.sql ligne 92
IF EXISTS (
  SELECT 1 FROM locataires 
  WHERE logement_id = p_logement_id
    AND date_sortie IS NULL
) THEN
  RAISE EXCEPTION 'Ce logement a déjà un locataire actif';
END IF;
```

**Impact** :
- ⚠️ Insertion directe SQL peut créer 2 locataires actifs sur même logement
- ⚠️ Règle métier non garantie au niveau DB

**Correction nécessaire** :
```sql
-- Contrainte d'exclusion : un seul locataire actif par logement
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE locataires
  ADD CONSTRAINT unique_active_locataire_per_logement
  EXCLUDE USING gist (
    logement_id WITH =
  ) WHERE (date_sortie IS NULL);
```

---

### 🟠 IMPORTANT 3 : Trigger `set_ticket_regie_id` peut échouer silencieusement

**Problème** :
- Trigger calcule `regie_id` via `logement → immeuble → regie`
- Si chaîne cassée (FK invalide), `v_regie_id` = NULL → EXCEPTION

**Code trigger** :
```sql
-- 12_tickets.sql ligne 87
SELECT i.regie_id INTO v_regie_id
FROM logements l
JOIN immeubles i ON l.immeuble_id = i.id
WHERE l.id = NEW.logement_id;

IF v_regie_id IS NULL THEN
  RAISE EXCEPTION 'Impossible de déterminer la régie';
END IF;
```

**Impact** :
- ✅ Bon : bloque création ticket si données incohérentes
- ⚠️ Mauvais : message d'erreur peu explicite
- ⚠️ Dépend de l'intégrité des FK amont

**Amélioration** :
```sql
-- Ajouter contexte dans l'exception
IF v_regie_id IS NULL THEN
  RAISE EXCEPTION 'Logement % n''est pas rattaché à un immeuble/régie valide', NEW.logement_id;
END IF;
```

---

### 🟡 PLUS TARD 1 : Mot de passe temporaire (table optionnelle)

**État actuel** : ✅ Fonctionnel sans table
- Backend retourne `Test1234!` si `temporary_passwords` absente
- Migration fournie mais non obligatoire

**Recommandation** :
- Mode dev/test : OK sans table
- Mode production : **créer la table** pour traçabilité et sécurité

---

### 🟡 PLUS TARD 2 : Validation statut logement incohérent

**Problème** :
- RPC `creer_locataire_complet()` met `statut = 'occupé'` (ligne 168)
- Mais aucun trigger inverse : si locataire supprimé, statut reste 'occupé'

**Correction future** :
```sql
CREATE OR REPLACE FUNCTION reset_logement_statut_on_locataire_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE logements
  SET statut = 'vacant'
  WHERE id = OLD.logement_id
    AND NOT EXISTS (
      SELECT 1 FROM locataires 
      WHERE logement_id = OLD.logement_id 
        AND id != OLD.id
        AND date_sortie IS NULL
    );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reset_logement_on_locataire_delete
  AFTER DELETE ON locataires
  FOR EACH ROW
  EXECUTE FUNCTION reset_logement_statut_on_locataire_delete();
```

---

## 🛠️ PLAN D'ACTION STRUCTURÉ

### PHASE 1 : BLOQUANTS (À FAIRE MAINTENANT)

#### 1.1 Déployer migration `locataires.regie_id`
**Priorité** : 🔴 CRITIQUE  
**Fichier** : `supabase/migrations/20251223000000_add_regie_id_to_locataires.sql`  
**Action** :
```bash
# Se connecter à Supabase Dashboard
# SQL Editor → Copier-coller le contenu de la migration
# Exécuter
```

**Validation post-exécution** :
```sql
-- Vérifier colonne existe
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'locataires' AND column_name = 'regie_id';

-- Vérifier FK existe
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'locataires' AND constraint_name = 'fk_locataires_regie';

-- Vérifier aucun locataire orphelin
SELECT COUNT(*) FROM locataires WHERE regie_id IS NULL;
-- Doit retourner 0
```

---

#### 1.2 Ajouter FK `profiles.regie_id`
**Priorité** : 🔴 CRITIQUE  
**Fichier** : Nouvelle migration `20251223000003_add_fk_profiles_regie_id.sql`

**Contenu** :
```sql
-- Migration : Ajouter FK sur profiles.regie_id
BEGIN;

-- Nettoyer les regie_id invalides (si existants)
UPDATE profiles
SET regie_id = NULL
WHERE regie_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM regies WHERE id = profiles.regie_id);

-- Ajouter FK
ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_regie
  FOREIGN KEY (regie_id) REFERENCES regies(id) ON DELETE CASCADE;

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_profiles_regie_id_fk
  ON profiles(regie_id) WHERE regie_id IS NOT NULL;

COMMIT;
```

**Validation** :
```sql
SELECT constraint_name 
FROM information_schema.table_constraints
WHERE table_name = 'profiles' AND constraint_name = 'fk_profiles_regie';
```

---

#### 1.3 Ajouter trigger validation tickets (locataire avec logement)
**Priorité** : 🔴 CRITIQUE  
**Fichier** : Nouvelle migration `20251223000004_add_trigger_ticket_requires_logement.sql`

**Contenu** :
```sql
-- Migration : Garantir règle métier au niveau DB
BEGIN;

CREATE OR REPLACE FUNCTION check_locataire_has_logement_for_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifier que le locataire existe et a un logement
  IF NOT EXISTS (
    SELECT 1 
    FROM locataires 
    WHERE id = NEW.locataire_id 
      AND logement_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Règle métier : un locataire doit avoir un logement assigné pour créer un ticket. Locataire: %, Logement requis.', NEW.locataire_id;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION check_locataire_has_logement_for_ticket IS
  'RÈGLE MÉTIER : Seul un locataire avec logement peut créer un ticket';

CREATE TRIGGER ensure_locataire_has_logement_before_ticket
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION check_locataire_has_logement_for_ticket();

COMMIT;
```

**Validation** :
```sql
-- Test positif (doit réussir si locataire a logement)
-- Test négatif (doit échouer si locataire sans logement)
```

---

### PHASE 2 : IMPORTANT (PROCHAINE ITÉRATION)

#### 2.1 Contrainte unicité locataire actif par logement
**Priorité** : 🟠 IMPORTANT  
**Impact** : Évite doublons locataires actifs  
**Effort** : Moyen (nécessite extension btree_gist)

#### 2.2 Améliorer messages d'erreur trigger `set_ticket_regie_id`
**Priorité** : 🟠 IMPORTANT  
**Impact** : Meilleure UX en cas d'erreur  
**Effort** : Faible

#### 2.3 Décider sort de `profiles.logement_id`
**Priorité** : 🟠 IMPORTANT  
**Impact** : Simplification architecture  
**Effort** : Moyen (refactoring si suppression)

---

### PHASE 3 : PLUS TARD (OPTIMISATIONS)

#### 3.1 Déployer table `temporary_passwords`
**Priorité** : 🟡 PLUS TARD  
**Condition** : Mode production  
**Fichier** : `20251223000002_create_temporary_passwords_complete.sql`

#### 3.2 Trigger synchronisation statut logement
**Priorité** : 🟡 PLUS TARD  
**Condition** : Après validation flux complet

---

## ✅ SCRIPTS SQL INDISPENSABLES

### Script 1 : Validation état actuel
```sql
-- =============================================================================
-- SCRIPT VALIDATION - État actuel de la DB
-- =============================================================================

-- 1. Vérifier colonne locataires.regie_id
SELECT 
  CASE 
    WHEN column_name IS NOT NULL THEN '✅ Colonne locataires.regie_id existe'
    ELSE '❌ Colonne locataires.regie_id MANQUANTE'
  END AS status
FROM information_schema.columns
WHERE table_name = 'locataires' AND column_name = 'regie_id';

-- 2. Vérifier FK profiles.regie_id
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ FK profiles.regie_id existe'
    ELSE '❌ FK profiles.regie_id MANQUANTE'
  END AS status
FROM information_schema.table_constraints
WHERE table_name = 'profiles' 
  AND constraint_name = 'fk_profiles_regie'
  AND constraint_type = 'FOREIGN KEY';

-- 3. Vérifier trigger tickets validation
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Trigger validation tickets existe'
    ELSE '❌ Trigger validation tickets MANQUANT'
  END AS status
FROM pg_trigger
WHERE tgname = 'ensure_locataire_has_logement_before_ticket';

-- 4. Vérifier locataires orphelins
SELECT 
  COUNT(*) AS orphan_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Aucun locataire orphelin'
    ELSE '⚠️ ' || COUNT(*) || ' locataires sans regie_id'
  END AS status
FROM locataires
WHERE regie_id IS NULL;

-- 5. Vérifier profiles.regie_id invalides
SELECT 
  COUNT(*) AS invalid_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Tous profiles.regie_id valides'
    ELSE '⚠️ ' || COUNT(*) || ' profiles avec regie_id invalide'
  END AS status
FROM profiles
WHERE regie_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM regies WHERE id = profiles.regie_id);

-- 6. Vérifier locataires multiples sur même logement
WITH active_locataires AS (
  SELECT logement_id, COUNT(*) AS cnt
  FROM locataires
  WHERE logement_id IS NOT NULL
    AND date_sortie IS NULL
  GROUP BY logement_id
  HAVING COUNT(*) > 1
)
SELECT 
  COALESCE(SUM(cnt), 0) AS total_conflicts,
  CASE 
    WHEN COALESCE(SUM(cnt), 0) = 0 THEN '✅ Pas de doublon locataire actif'
    ELSE '⚠️ ' || SUM(cnt) || ' conflits de locataires actifs'
  END AS status
FROM active_locataires;
```

---

### Script 2 : Migrations CRITIQUES à exécuter
Voir sections 1.1, 1.2, 1.3 ci-dessus

---

## 📋 CHECKLIST VALIDATION FINALE

### Avant déploiement
- [ ] Exécuter Script 1 (validation état actuel)
- [ ] Noter résultats (combien d'items ❌)
- [ ] Sauvegarder état actuel DB (dump si possible)

### Déploiement Phase 1 (BLOQUANTS)
- [ ] Migration 1.1 : `locataires.regie_id`
- [ ] Validation : Aucun locataire orphelin
- [ ] Migration 1.2 : FK `profiles.regie_id`
- [ ] Validation : Tous profiles.regie_id valides
- [ ] Migration 1.3 : Trigger validation tickets
- [ ] Test : Créer ticket sans logement → doit échouer

### Tests métier complets
- [ ] Régie crée locataire AVEC logement → ✅
- [ ] Régie crée locataire SANS logement → ✅
- [ ] Locataire SANS logement tente créer ticket → ❌ (attendu)
- [ ] Locataire AVEC logement crée ticket → ✅
- [ ] Vérifier `tickets.regie_id` calculé automatiquement
- [ ] Vérifier `profiles.logement_id` synchronisé

---

## 🎯 RÉSUMÉ EXÉCUTIF

### État actuel
- ⚠️ **3 BLOQUANTS critiques** (regie_id, FK, règle métier)
- ⚠️ **3 IMPORTANTS** (contraintes unicité, messages erreur)
- ✅ **Architecture générale cohérente**
- ✅ **RLS activé** sur toutes les tables
- ✅ **Triggers métier** présents (partiels)

### Risques actuels
1. **Isolation multi-tenant fragile** (locataires orphelins possibles)
2. **Règle métier contournable** (tickets sans logement via SQL direct)
3. **Intégrité référentielle partielle** (profiles.regie_id sans FK)

### Après corrections Phase 1
- ✅ Isolation multi-tenant garantie
- ✅ Règles métier au niveau DB
- ✅ Intégrité référentielle complète
- ✅ Flux RÉGIE → LOCATAIRE → TICKET sécurisé
- ✅ Base saine pour évolutions futures

### Temps estimé
- Phase 1 (BLOQUANTS) : **1-2 heures** (avec tests)
- Phase 2 (IMPORTANT) : **2-3 heures**
- Phase 3 (PLUS TARD) : **À planifier**

---

**Prochaine étape** : Exécuter Script 1 pour valider l'état actuel en production.
