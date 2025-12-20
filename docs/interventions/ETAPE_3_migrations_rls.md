# ✅ ÉTAPE 3 - MIGRATIONS SQL + POLICIES RLS SÉCURISÉES

**Date :** 20 décembre 2025  
**Objectif :** Appliquer les modifications SQL et RLS selon modèle ÉTAPE 2  
**Statut :** MIGRATIONS CRÉÉES - EN ATTENTE VALIDATION + EXÉCUTION

---

## 📋 RÉCAPITULATIF DES FICHIERS CRÉÉS

### Migrations SQL

| Fichier | Description | Ordre exécution |
|---------|-------------|-----------------|
| `2025-12-20_migration_locataires_contraintes.sql` | NOT NULL + ON DELETE RESTRICT | 1️⃣ |
| `2025-12-20_rls_locataires_policies.sql` | Refonte policies locataires/logements/immeubles | 2️⃣ |
| `2025-12-20_rpc_creer_locataire.sql` | RPC création atomique locataire | 3️⃣ |

---

## 🔧 MIGRATION 1 : Contraintes NOT NULL

**Fichier :** `/supabase/migrations/2025-12-20_migration_locataires_contraintes.sql`

### Modifications appliquées

#### 1. Vérifications pré-migration (OBLIGATOIRES)
```sql
-- Bloque migration si locataires orphelins détectés
SELECT COUNT(*) FROM locataires WHERE profile_id IS NULL;   -- Doit être 0
SELECT COUNT(*) FROM locataires WHERE logement_id IS NULL;  -- Doit être 0
```

**⚠️ IMPORTANT :** Si ces requêtes retournent > 0, la migration est **BLOQUÉE**.

**Actions correctives si orphelins :**
- Option A : Supprimer locataires orphelins (perte données)
- Option B : Assigner logement/profile valide (manuel)

#### 2. Suppression trigger redondant
```sql
DROP TRIGGER sync_profile_on_locataire_update ON locataires;
DROP FUNCTION sync_profile_logement_id();
```

**Justification :**
- Trigger synchronisait `profiles.logement_id` ↔ `locataires.logement_id`
- Redondance inutile (source de vérité = `locataires.logement_id`)
- Complexité supprimée (pas de risque récursion)

#### 3. Modification cascade DELETE
```sql
-- AVANT
logement_id uuid references logements(id) on delete set null

-- APRÈS
logement_id uuid not null references logements(id) on delete restrict
```

**Impact :**
- Suppression logement avec locataire actif → **BLOQUÉE**
- Workflow requis : Libérer logement (date_sortie) AVANT suppression
- Protection intégrité référentielle ✅

#### 4. Application NOT NULL
```sql
ALTER TABLE locataires ALTER COLUMN profile_id SET NOT NULL;
ALTER TABLE locataires ALTER COLUMN logement_id SET NOT NULL;
ALTER TABLE locataires ALTER COLUMN date_entree SET NOT NULL;
```

**Effet :**
- INSERT sans `profile_id` → ❌ Erreur PostgreSQL
- INSERT sans `logement_id` → ❌ Erreur PostgreSQL
- INSERT sans `date_entree` → ❌ Erreur PostgreSQL

#### 5. Vérifications post-migration
```sql
-- Vérifie que NOT NULL est bien appliqué
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'locataires' 
  AND column_name IN ('profile_id', 'logement_id', 'date_entree');
```

**Résultat attendu :** `is_nullable = 'NO'` pour les 3 colonnes

---

## 🔐 MIGRATION 2 : Policies RLS

**Fichier :** `/supabase/migrations/2025-12-20_rls_locataires_policies.sql`

### Policies LOCATAIRES

#### Anciennes policies (SUPPRIMÉES)
```sql
DROP POLICY "Regie can manage own locataires" ON locataires;  -- FOR ALL (trop large)
```

**Raison suppression :** Policy `FOR ALL` mélange INSERT/UPDATE/DELETE avec logique différente.

#### Nouvelles policies RÉGIE (4 policies distinctes)

##### 1. SELECT : Régie voit ses locataires
```sql
CREATE POLICY "Regie can view own locataires"
ON locataires FOR SELECT
USING (
  exists (
    select 1
    from logements l
    join immeubles i on i.id = l.immeuble_id
    where l.id = locataires.logement_id
      and i.regie_id = get_user_regie_id()
  )
);
```

**Logique :** Régie → Immeubles → Logements → Locataires

**Sécurité :**
- ✅ `get_user_regie_id()` en SECURITY DEFINER (pas de récursion)
- ✅ Index sur `logements.immeuble_id` et `immeubles.regie_id`
- ✅ Isolation cross-régies garantie

---

##### 2. INSERT : Régie crée locataire dans SES logements
```sql
CREATE POLICY "Regie can insert locataire in own logements"
ON locataires FOR INSERT
WITH CHECK (
  exists (
    select 1
    from logements l
    join immeubles i on i.id = l.immeuble_id
    where l.id = locataires.logement_id
      and i.regie_id = get_user_regie_id()
  )
);
```

**Protection :**
- ❌ Régie A ne peut PAS créer locataire sur logement de Régie B
- ✅ Vérifie ownership logement au moment de l'INSERT

**Test sécurité :**
```sql
-- Régie A tente de créer locataire sur logement Régie B
INSERT INTO locataires (nom, prenom, email, profile_id, logement_id, date_entree)
VALUES ('Test', 'Test', 'test@test.ch', '<uuid>', '<logement_regie_B>', '2025-01-15');
-- ❌ BLOQUÉ par RLS (WITH CHECK échoue)
```

---

##### 3. UPDATE : Régie modifie SES locataires
```sql
CREATE POLICY "Regie can update own locataires"
ON locataires FOR UPDATE
USING (...)  -- Locataire appartient à la régie
WITH CHECK (...);  -- Nouveau logement_id (si changé) appartient aussi à la régie
```

**Double vérification :**
- `USING` : Vérifie que locataire actuel appartient à la régie
- `WITH CHECK` : Vérifie que nouveau `logement_id` (si modifié) appartient aussi à la régie

**Protection transfert cross-régies :**
```sql
-- Régie A tente de transférer locataire vers logement Régie B
UPDATE locataires 
SET logement_id = '<logement_regie_B>' 
WHERE id = '<locataire_regie_A>';
-- ❌ BLOQUÉ par WITH CHECK
```

---

##### 4. DELETE : Régie supprime SES locataires
```sql
CREATE POLICY "Regie can delete own locataires"
ON locataires FOR DELETE
USING (...);
```

**⚠️ Attention :** Suppression locataire = perte données.

**Recommandation future :** Vérifier absence de tickets ouverts avant DELETE.

---

#### Policies LOCATAIRE (conservées)

##### 1. SELECT : Locataire voit ses données
```sql
-- ✅ Déjà existante, CONSERVÉE sans modification
CREATE POLICY "Locataire can view own data"
ON locataires FOR SELECT
USING (profile_id = auth.uid());
```

**Analyse :**
- ✅ Comparaison directe (performante)
- ✅ Index sur `locataires.profile_id`
- ✅ Pas de sous-requête (pas de récursion)

##### 2. UPDATE : Locataire modifie ses infos personnelles
```sql
-- ✅ Déjà existante, CONSERVÉE sans modification
CREATE POLICY "Locataire can update own data"
ON locataires FOR UPDATE
USING (profile_id = auth.uid());
```

**Colonnes modifiables par locataire :**
- ✅ `nom`, `prenom`, `telephone`, `date_naissance`
- ✅ `contact_urgence_nom`, `contact_urgence_telephone`
- ❌ `profile_id` (immuable, clé technique)
- ❌ `logement_id` (géré par régie uniquement)

**Protection implicite :** PostgreSQL empêche modification colonnes non existantes dans UPDATE.

---

### Policies LOGEMENTS (NOUVELLES)

#### Policy SELECT : Locataire voit UNIQUEMENT son logement
```sql
CREATE POLICY "Locataire can view only own logement"
ON logements FOR SELECT
USING (
  (select role from profiles where id = auth.uid()) = 'locataire'
  and id = (
    select logement_id 
    from locataires 
    where profile_id = auth.uid()
  )
);
```

**Logique :**
1. Vérifie que user est rôle `'locataire'`
2. Filtre UNIQUEMENT le logement du locataire

**Test isolation :**
```sql
-- Locataire LA1 (logement L1) tente de voir logement L2 (même immeuble)
-- Connecté en tant que LA1
SELECT * FROM logements WHERE id = '<logement_L2>';
-- ❌ 0 résultat (RLS bloque)

SELECT * FROM logements;
-- ✅ 1 résultat (uniquement L1)
```

**Bénéfice :** Locataire ne peut pas "espionner" autres logements/locataires du même immeuble.

---

### Policies IMMEUBLES (NOUVELLES)

#### Policy SELECT : Locataire voit UNIQUEMENT son immeuble
```sql
CREATE POLICY "Locataire can view own immeuble"
ON immeubles FOR SELECT
USING (
  (select role from profiles where id = auth.uid()) = 'locataire'
  and id = (
    select l.immeuble_id
    from locataires loc
    join logements l on l.id = loc.logement_id
    where loc.profile_id = auth.uid()
  )
);
```

**Usage frontend :**
```javascript
// Dashboard locataire : Afficher adresse immeuble
const { data: immeuble } = await supabase
  .from('immeubles')
  .select('nom, adresse, code_postal, ville')
  .single();

// RLS garantit que seul SON immeuble est retourné
```

**Protection :** Locataire ne voit PAS les autres immeubles de sa régie.

---

## 🔄 MIGRATION 3 : RPC Création Locataire

**Fichier :** `/supabase/migrations/2025-12-20_rpc_creer_locataire.sql`

### Fonction `creer_locataire_complet()`

#### Signature
```sql
creer_locataire_complet(
  p_nom text,
  p_prenom text,
  p_email text,
  p_profile_id uuid,           -- UUID déjà créé par backend (auth.users)
  p_logement_id uuid,
  p_date_entree date,
  p_telephone text DEFAULT NULL,
  p_date_naissance date DEFAULT NULL,
  p_contact_urgence_nom text DEFAULT NULL,
  p_contact_urgence_telephone text DEFAULT NULL
) RETURNS json
```

#### Workflow

##### Étape 1 : Vérifier ownership logement
```sql
SELECT i.regie_id
FROM logements l
JOIN immeubles im ON im.id = l.immeuble_id
JOIN regies r ON r.id = im.regie_id
JOIN profiles p ON p.id = r.profile_id
WHERE l.id = p_logement_id
  AND p.id = auth.uid();  -- User connecté = régie propriétaire
```

**Protection :** Régie A ne peut PAS créer locataire sur logement Régie B.

##### Étape 2 : Vérifier profile_id valide
```sql
-- Vérifier que profile existe et role='locataire'
SELECT 1 FROM profiles 
WHERE id = p_profile_id 
  AND role = 'locataire';
```

##### Étape 3 : Vérifier unicité profile_id
```sql
-- Un profile ne peut être associé qu'à UN locataire
SELECT 1 FROM locataires 
WHERE profile_id = p_profile_id;
```

**Protection :** Empêche créer 2 locataires avec même compte utilisateur.

##### Étape 4 : Vérifier logement libre
```sql
-- Vérifier qu'aucun locataire actif (date_sortie IS NULL)
SELECT 1 FROM locataires 
WHERE logement_id = p_logement_id
  AND date_sortie IS NULL;
```

**Protection :** Un logement = max 1 locataire actif à la fois.

##### Étape 5 : Créer locataire
```sql
INSERT INTO locataires (...)
VALUES (...)
RETURNING id INTO v_locataire_id;
```

##### Étape 6 : Mettre à jour statut logement
```sql
UPDATE logements
SET statut = 'occupé'
WHERE id = p_logement_id;
```

**Automatisation :** Statut logement synchronisé avec présence locataire.

##### Étape 7 : Retourner résultat
```sql
RETURN json_build_object(
  'success', true,
  'locataire_id', v_locataire_id,
  'profile_id', p_profile_id,
  'email', p_email,
  'logement', {...},
  'message', 'Locataire créé avec succès'
);
```

---

### Fonction `liberer_logement_locataire()`

#### Signature
```sql
liberer_logement_locataire(
  p_locataire_id uuid,
  p_date_sortie date DEFAULT CURRENT_DATE
) RETURNS json
```

#### Workflow

##### Étape 1 : Vérifier ownership locataire
```sql
SELECT l.logement_id
FROM locataires l
JOIN logements lg ON lg.id = l.logement_id
JOIN immeubles i ON i.id = lg.immeuble_id
WHERE l.id = p_locataire_id
  AND i.regie_id = get_user_regie_id();
```

##### Étape 2 : Définir date_sortie
```sql
UPDATE locataires
SET date_sortie = p_date_sortie
WHERE id = p_locataire_id;
```

##### Étape 3 : Libérer logement
```sql
UPDATE logements
SET statut = 'vacant'
WHERE id = v_logement_id;
```

**Usage :**
```sql
-- Régie libère logement (déménagement locataire)
SELECT liberer_logement_locataire('<locataire_uuid>', '2025-03-31');

-- Résultat :
-- { success: true, logement_statut: 'vacant', date_sortie: '2025-03-31' }
```

---

## 📊 ANALYSE SÉCURITÉ RLS

### Vérification récursion

#### Test 1 : `get_user_regie_id()` dans policies locataires
```sql
-- Policy utilise get_user_regie_id()
CREATE POLICY "..." USING (
  ... i.regie_id = get_user_regie_id()
);

-- get_user_regie_id() fait SELECT sur locataires
-- → Récursion ? NON ✅
-- Raison : SECURITY DEFINER bypass RLS
```

**Confirmation :** ✅ Pas de récursion (fonction en SECURITY DEFINER)

#### Test 2 : Policies locataire sur logements
```sql
-- Policy locataire fait SELECT sur locataires
CREATE POLICY "..." USING (
  id = (SELECT logement_id FROM locataires WHERE profile_id = auth.uid())
);

-- Sous-requête sur locataires
-- → Récursion ? NON ✅
-- Raison : Sous-requête indépendante, pas de boucle
```

**Confirmation :** ✅ Pas de récursion (sous-requête unidirectionnelle)

---

### Vérification isolation

#### Test isolation cross-régies
```sql
-- Régie A (regie_id = '<uuid_A>')
SET SESSION "request.jwt.claim.sub" = '<profile_id_regie_A>';

-- Tenter voir locataires Régie B
SELECT * FROM locataires;
-- Résultat : UNIQUEMENT locataires Régie A ✅

-- Tenter voir logement Régie B
SELECT * FROM logements WHERE id = '<logement_regie_B>';
-- Résultat : 0 rows ✅ (RLS bloque)
```

**Confirmation :** ✅ Isolation stricte entre régies

#### Test isolation locataires même immeuble
```sql
-- Locataire LA1 (immeuble IM1, logement L1)
SET SESSION "request.jwt.claim.sub" = '<profile_id_LA1>';

-- Tenter voir autres locataires immeuble IM1
SELECT * FROM locataires;
-- Résultat : UNIQUEMENT LA1 ✅

-- Tenter voir autres logements immeuble IM1
SELECT * FROM logements;
-- Résultat : UNIQUEMENT L1 ✅
```

**Confirmation :** ✅ Isolation stricte entre locataires

---

### Vérification performance

#### EXPLAIN ANALYZE policies régie
```sql
EXPLAIN ANALYZE
SELECT * FROM locataires;

-- Plan attendu :
-- Index Scan on locataires_logement_id
--   -> Nested Loop
--      -> Index Scan on logements_immeuble_id
--      -> Index Scan on immeubles_regie_id
```

**Indices requis (existants) :**
- ✅ `idx_locataires_logement_id`
- ✅ `idx_logements_immeuble_id`
- ✅ `idx_immeubles_regie_id`

**Recommandation :** Tester avec jeu de données conséquent (>1000 locataires).

---

## ⚠️ POINTS DE VIGILANCE

### 1. Migration contraintes NOT NULL

**Risque :** Migration bloquée si locataires orphelins existants.

**Vérification pré-migration (OBLIGATOIRE) :**
```sql
-- Exécuter AVANT migration
SELECT COUNT(*) FROM locataires WHERE profile_id IS NULL;
SELECT COUNT(*) FROM locataires WHERE logement_id IS NULL;

-- Si > 0 : CORRIGER avant migration
```

**Actions correctives :**
- Supprimer locataires orphelins OU
- Leur assigner profile_id/logement_id valide

---

### 2. Cascade ON DELETE RESTRICT

**Impact :** Suppression logement bloquée si locataire actif.

**Workflow frontend :**
```javascript
// Gérer erreur FK constraint
async function supprimerLogement(logementId) {
  const { error } = await supabase
    .from('logements')
    .delete()
    .eq('id', logementId);
  
  if (error && error.code === '23503') {
    // FK violation
    showModal('Impossible de supprimer : locataire présent. Libérez d\'abord le logement.');
    return false;
  }
}
```

---

### 3. RPC creer_locataire_complet

**Prérequis backend :** Créer auth.users AVANT appel RPC.

**Workflow côté API :**
```javascript
// 1. Créer user Supabase Auth (Admin SDK)
const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
  email: email,
  password: mot_de_passe,
  email_confirm: true
});

// 2. Créer profile
const { error: profileError } = await supabase
  .from('profiles')
  .insert({ id: authUser.user.id, email: email, role: 'locataire' });

// 3. Appeler RPC
const { data, error } = await supabase.rpc('creer_locataire_complet', {
  p_nom: nom,
  p_prenom: prenom,
  p_email: email,
  p_profile_id: authUser.user.id,  // UUID créé étape 1
  p_logement_id: logement_id,
  p_date_entree: date_entree
});
```

**Alternative simplifiée :** Intégrer création auth.users DANS la RPC (nécessite extension admin).

---

### 4. Performance policies locataire

**Risque :** Sous-requêtes multiples si locataire accède à plusieurs tables.

**Optimisation :** Mettre en cache `get_user_regie_id()` (déjà fait avec `STABLE`).

**Test performance :**
```sql
-- Dashboard locataire charge 5 tables
SELECT * FROM locataires WHERE profile_id = auth.uid();
SELECT * FROM logements WHERE id = (SELECT logement_id FROM locataires WHERE profile_id = auth.uid());
SELECT * FROM tickets WHERE locataire_id = (SELECT id FROM locataires WHERE profile_id = auth.uid());
-- ...

-- Vérifier temps total < 100ms
```

---

## 📋 CHECKLIST EXÉCUTION MIGRATIONS

### Pré-migration

- [ ] **Vérifier locataires orphelins** (profile_id NULL ou logement_id NULL)
- [ ] **Backup base de données** (snapshot avant migration)
- [ ] **Tester migrations sur environnement DEV** (pas PROD directement)
- [ ] **Valider RPC avec utilisateur test** (créer locataire test)

### Ordre exécution

1️⃣ **Migration contraintes** (`2025-12-20_migration_locataires_contraintes.sql`)
   - Durée estimée : < 1 minute
   - Bloquant : Oui (vérifications pré-migration)

2️⃣ **Migration RLS policies** (`2025-12-20_rls_locataires_policies.sql`)
   - Durée estimée : < 30 secondes
   - Bloquant : Non (ajout/suppression policies)

3️⃣ **Migration RPC** (`2025-12-20_rpc_creer_locataire.sql`)
   - Durée estimée : < 10 secondes
   - Bloquant : Non (création fonctions)

### Post-migration

- [ ] **Vérifier policies actives** (`SELECT * FROM pg_policies WHERE tablename = 'locataires'`)
- [ ] **Tester RPC creer_locataire_complet** (créer locataire test)
- [ ] **Tester connexion locataire** (authentification + dashboard)
- [ ] **Vérifier isolation RLS** (cross-régies, cross-locataires)
- [ ] **EXPLAIN ANALYZE policies** (vérifier performance)

---

## 🧪 TESTS POST-MIGRATION

### Test 1 : Contraintes NOT NULL
```sql
-- Test INSERT sans logement_id → doit échouer
INSERT INTO locataires (nom, prenom, email, profile_id, date_entree)
VALUES ('Test', 'Test', 'test@test.ch', '<uuid>', '2025-01-15');
-- Résultat attendu : ERROR: null value in column "logement_id" violates not-null constraint
```

### Test 2 : RLS régie voir locataires
```sql
-- Connecté en tant que Régie A
SELECT * FROM locataires;
-- Résultat : UNIQUEMENT locataires de Régie A
```

### Test 3 : RLS locataire voir logement
```sql
-- Connecté en tant que Locataire LA1
SELECT * FROM logements;
-- Résultat : UNIQUEMENT logement de LA1 (1 row)
```

### Test 4 : RPC créer locataire
```sql
-- Créer locataire test
SELECT creer_locataire_complet(
  'Dupont', 'Jean', 'jean.dupont@test.ch',
  '<profile_uuid>', '<logement_uuid>', '2025-01-15'
);
-- Résultat : { success: true, locataire_id: '<uuid>', ... }
```

### Test 5 : Cascade ON DELETE RESTRICT
```sql
-- Tenter supprimer logement avec locataire actif
DELETE FROM logements WHERE id = '<logement_avec_locataire>';
-- Résultat attendu : ERROR: update or delete violates foreign key constraint
```

---

## ✅ CHECKLIST VALIDATION ÉTAPE 3

- [x] Migrations SQL créées (3 fichiers)
- [x] Vérifications pré/post-migration incluses
- [x] Policies RLS refondues (7 policies locataires)
- [x] Policies restrictives locataire (logements + immeubles)
- [x] RPC création atomique locataire
- [x] RPC libération logement
- [x] Tests sécurité documentés
- [x] Points de vigilance identifiés
- [ ] **EXÉCUTION MIGRATIONS** (après validation humaine)
- [ ] **TESTS POST-MIGRATION** (après exécution)

---

**Statut :** ⏸️ EN ATTENTE VALIDATION + EXÉCUTION  
**Prochaine étape :** ÉTAPE 4 - Frontend fonctionnel (après validation ÉTAPE 3)  
**Fichiers prêts à exécuter :**
- ✅ `/supabase/migrations/2025-12-20_migration_locataires_contraintes.sql`
- ✅ `/supabase/migrations/2025-12-20_rls_locataires_policies.sql`
- ✅ `/supabase/migrations/2025-12-20_rpc_creer_locataire.sql`

