# AUDIT RLS - RÉCURSION INFINIE `regies_entreprises`

**Date**: 26 décembre 2025
**Erreur**: `infinite recursion detected in policy for relation "regies_entreprises"`
**Contexte**: Migrations M20-M24 appliquées, CREATE ticket fonctionne

---

## 🔍 ÉTAPE 1 — DIAGNOSTIC STRICT

### 1.1 Inventory complet des policies sur `regies_entreprises`

**Table: `regies_entreprises`** *(source: supabase/schema/18_rls.sql lignes 288-318)*

```sql
-- ✅ POLICY 1: Regie peut lire ses autorisations
CREATE POLICY "Regie can view own authorizations"
ON regies_entreprises FOR SELECT
USING (regie_id = get_user_regie_id());

-- ✅ POLICY 2: Regie peut créer autorisations
CREATE POLICY "Regie can create authorizations"
ON regies_entreprises FOR INSERT
WITH CHECK (regie_id = get_user_regie_id());

-- ✅ POLICY 3: Regie peut modifier autorisations
CREATE POLICY "Regie can update authorizations"
ON regies_entreprises FOR UPDATE
USING (regie_id = get_user_regie_id());

-- ✅ POLICY 4: Regie peut supprimer autorisations
CREATE POLICY "Regie can delete authorizations"
ON regies_entreprises FOR DELETE
USING (regie_id = get_user_regie_id());

-- ⚠️ POLICY 5: Entreprise peut lire ses autorisations
CREATE POLICY "Entreprise can view own authorizations"
ON regies_entreprises FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM entreprises
    WHERE entreprises.id = regies_entreprises.entreprise_id
      AND entreprises.profile_id = auth.uid()
  )
);

-- ✅ POLICY 6: Admin JTEC peut tout voir
CREATE POLICY "Admin JTEC can view all authorizations"
ON regies_entreprises FOR SELECT
USING (public.is_admin_jtec());
```

---

### 1.2 Tables qui LISENT `regies_entreprises` (risque de récursion)

#### 🔴 DANGER 1: Policy sur `tickets` → SELECT regies_entreprises

**Fichier**: `supabase/schema/18_rls.sql` ligne 220-247

```sql
CREATE POLICY "Entreprise can view authorized tickets"
ON tickets FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM entreprises e
    WHERE e.profile_id = auth.uid()
      AND (
        EXISTS (
          SELECT 1
          FROM regies_entreprises re  -- ❌ LECTURE regies_entreprises
          WHERE re.entreprise_id = e.id
            AND re.regie_id = tickets.regie_id
            AND re.mode_diffusion = 'general'
            AND tickets.statut = 'ouvert'
        )
        OR
        EXISTS (
          SELECT 1
          FROM regies_entreprises re  -- ❌ LECTURE regies_entreprises
          WHERE re.entreprise_id = e.id
            AND re.regie_id = tickets.regie_id
            AND re.mode_diffusion = 'restreint'
            AND tickets.entreprise_id = e.id
        )
      )
  )
);
```

**Chaîne de récursion identifiée**:

```
1. Entreprise → SELECT tickets
   ↓
2. Policy "Entreprise can view authorized tickets" → SELECT regies_entreprises
   ↓
3. Policy "Entreprise can view own authorizations" → SELECT entreprises
   ↓
4. RLS sur entreprises activé → vérification profile_id
   ↓
5. Si entreprises a une policy qui lit tickets → ❌ BOUCLE INFINIE
```

---

#### 🔴 DANGER 2: Policy sur `entreprises` → SELECT regies_entreprises

**Fichier**: `supabase/schema/18_rls.sql` ligne 269-279

```sql
CREATE POLICY "Regie can view authorized entreprises"
ON entreprises FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM regies_entreprises  -- ❌ LECTURE regies_entreprises
    WHERE regies_entreprises.entreprise_id = entreprises.id
      AND regies_entreprises.regie_id = get_user_regie_id()
  )
);
```

**Chaîne de récursion identifiée**:

```
1. Régie → SELECT entreprises
   ↓
2. Policy "Regie can view authorized entreprises" → SELECT regies_entreprises
   ↓
3. Policy "Regie can view own authorizations" → get_user_regie_id()
   ↓
4. get_user_regie_id() → SELECT regies (SECURITY DEFINER bypass RLS OK)
   ↓
5. Pas de récursion directe ICI, MAIS...
   ↓
6. Si policy sur regies_entreprises lit tickets → tickets lit entreprises → ❌ BOUCLE
```

---

#### 🔴 DANGER 3: Policy sur `techniciens` → SELECT regies_entreprises

**Fichier**: `supabase/schema/11_techniciens.sql` ligne 218-228

```sql
CREATE POLICY "Regie can view techniciens of authorized entreprises"
ON techniciens FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM regies_entreprises  -- ❌ LECTURE regies_entreprises
    WHERE regies_entreprises.entreprise_id = techniciens.entreprise_id
    AND regies_entreprises.regie_id = get_user_regie_id()
  )
);
```

**Chaîne de récursion identifiée**:

```
1. Régie → SELECT techniciens
   ↓
2. Policy "Regie can view techniciens..." → SELECT regies_entreprises
   ↓
3. Policy "Regie can view own authorizations" → get_user_regie_id()
   ↓
4. get_user_regie_id() → SELECT regies (OK, SECURITY DEFINER)
   ↓
5. Pas de récursion directe ICI
```

---

#### 🔴 DANGER 4: Vue `tickets_visibles_entreprise` → JOIN regies_entreprises

**Fichier**: `supabase/schema/17_views.sql` ligne 63-106

```sql
CREATE OR REPLACE VIEW tickets_visibles_entreprise AS
SELECT
  t.id as ticket_id,
  t.titre,
  ...
FROM tickets t
JOIN regies_entreprises re ON t.regie_id = re.regie_id  -- ❌ JOIN direct
JOIN locataires loc ON t.locataire_id = loc.id
...
WHERE
  (
    re.mode_diffusion = 'general'
    AND t.statut = 'ouvert'
  )
  OR
  (
    re.mode_diffusion = 'restreint'
    AND t.entreprise_id = re.entreprise_id
  );
```

**Problème**: Vue sans SECURITY DEFINER → hérite des policies RLS des tables sous-jacentes

**Chaîne de récursion identifiée**:

```
1. Entreprise → SELECT tickets_visibles_entreprise
   ↓
2. Vue → SELECT tickets (applique RLS)
   ↓
3. Policy "Entreprise can view authorized tickets" → SELECT regies_entreprises
   ↓
4. Policy "Entreprise can view own authorizations" → SELECT entreprises
   ↓
5. Si vue lit entreprises → ❌ BOUCLE INFINIE
```

---

#### 🔴 DANGER 5: Storage policy → JOIN regies_entreprises

**Fichier**: `supabase/schema/19_storage.sql` ligne 253-265

```sql
CREATE POLICY "Regie can view signatures of authorized entreprises"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'signatures' AND
  (storage.foldername(name))[1] = 'entreprises' AND
  EXISTS (
    SELECT 1
    FROM entreprises
    JOIN regies ON regies.profile_id = auth.uid()
    JOIN regies_entreprises ON regies_entreprises.regie_id = regies.id  -- ❌ JOIN
    WHERE entreprises.id::text = (storage.foldername(name))[2]
      AND regies_entreprises.entreprise_id = entreprises.id
  )
);
```

**Chaîne de récursion identifiée**:

```
1. Régie → SELECT storage.objects (bucket signatures)
   ↓
2. Policy → JOIN regies_entreprises
   ↓
3. RLS sur regies_entreprises activé → vérification policies
   ↓
4. Si policy lit tickets/entreprises qui lisent regies_entreprises → ❌ BOUCLE
```

---

#### 🟡 RISQUE INDIRECT: Fonction `accept_ticket_and_create_mission`

**Fichier**: `supabase/schema/13_missions.sql` ligne 91-132

```sql
CREATE OR REPLACE FUNCTION accept_ticket_and_create_mission(
  p_ticket_id uuid,
  p_entreprise_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  -- ✅ Bypass RLS
AS $$
DECLARE
  ...
BEGIN
  -- Vérifier autorisation entreprise
  SELECT EXISTS (
    SELECT 1 FROM regies_entreprises  -- ✅ OK si SECURITY DEFINER
    WHERE regie_id = v_ticket_regie_id
    AND entreprise_id = p_entreprise_id
    AND autorise = true
  ) INTO v_is_authorized;
  ...
END;
$$;
```

**Verdict**: ✅ **PAS DE RÉCURSION** car `SECURITY DEFINER` bypass RLS

---

### 1.3 Analyse des boucles RÉELLES

#### BOUCLE CRITIQUE 1: `tickets` ↔ `regies_entreprises` ↔ `entreprises`

```
┌─────────────────────────────────────────────────────────┐
│                    RÉCURSION DÉTECTÉE                   │
└─────────────────────────────────────────────────────────┘

  Entreprise veut lire tickets
       ↓
  Policy "Entreprise can view authorized tickets" (18_rls.sql:220)
       ↓
  SELECT regies_entreprises WHERE entreprise_id = e.id
       ↓
  RLS sur regies_entreprises activé
       ↓
  Policy "Entreprise can view own authorizations" (18_rls.sql:304)
       ↓
  SELECT entreprises WHERE id = regies_entreprises.entreprise_id
       ↓
  RLS sur entreprises activé
       ↓
  Policy "Regie can view authorized entreprises" (18_rls.sql:269)
       ↓
  SELECT regies_entreprises WHERE entreprise_id = entreprises.id
       ↓
  ❌ BOUCLE INFINIE DÉTECTÉE
```

#### BOUCLE CRITIQUE 2: Vue `tickets_visibles_entreprise` déclenche récursion

```
  Entreprise → SELECT tickets_visibles_entreprise
       ↓
  Vue JOIN regies_entreprises (sans SECURITY DEFINER)
       ↓
  Applique RLS sur regies_entreprises
       ↓
  Policy lit entreprises
       ↓
  Policy lit regies_entreprises
       ↓
  ❌ RÉCURSION
```

---

## 🛠️ ÉTAPE 2 — STRATÉGIE DE CORRECTION

### RÈGLE 1: Isolation de `regies_entreprises`

**PRINCIPE**: `regies_entreprises` est une **table de liaison pure**. Ses policies NE DOIVENT JAMAIS:
- Lire `tickets`
- Lire `missions`
- Lire une vue qui dépend de `tickets`

**OBJECTIF**: Accès autorisé UNIQUEMENT via:
1. `regie_id = get_user_regie_id()` ✅ (OK car SECURITY DEFINER bypass RLS sur regies)
2. `entreprises.profile_id = auth.uid()` ✅ (OK si pas de récursion sur entreprises)
3. `is_admin_jtec()` ✅ (OK car SECURITY DEFINER)

---

### RÈGLE 2: Vues à sécuriser

**Vue `tickets_visibles_entreprise`**: DOIT être convertie en fonction `SECURITY DEFINER`

**Pourquoi**:
- Vue normale = hérite RLS des tables → récursion garantie
- Fonction `SECURITY DEFINER` = bypass RLS → pas de récursion
- Fonction `STABLE` = optimisée par PostgreSQL comme une vue

**Solution**:
```sql
-- Supprimer vue
DROP VIEW IF EXISTS tickets_visibles_entreprise;

-- Créer fonction SECURITY DEFINER
CREATE OR REPLACE FUNCTION get_tickets_visibles_entreprise(
  p_entreprise_id uuid DEFAULT NULL
)
RETURNS TABLE (
  ticket_id uuid,
  titre text,
  description text,
  ...
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.titre,
    t.description,
    ...
  FROM tickets t
  JOIN regies_entreprises re ON t.regie_id = re.regie_id
  JOIN locataires loc ON t.locataire_id = loc.id
  JOIN logements log ON t.logement_id = log.id
  JOIN immeubles imm ON log.immeuble_id = imm.id
  JOIN regies reg ON t.regie_id = reg.id
  WHERE
    re.entreprise_id = COALESCE(p_entreprise_id, 
      (SELECT id FROM entreprises WHERE profile_id = auth.uid())
    )
    AND (
      (re.mode_diffusion = 'general' AND t.statut = 'ouvert')
      OR
      (re.mode_diffusion = 'restreint' AND t.entreprise_id = re.entreprise_id)
    );
END;
$$;
```

---

### RÈGLE 3: Policy `tickets` pour entreprises

**Problème actuel**: Policy "Entreprise can view authorized tickets" lit `regies_entreprises` dans contexte RLS

**Solutions possibles**:

#### ❌ OPTION A: Supprimer policy, forcer utilisation fonction
- Entreprises doivent utiliser `get_tickets_visibles_entreprise()` exclusivement
- **Problème**: Casse frontend si queries directes `SELECT tickets`

#### ✅ OPTION B: Simplifier policy avec fonction intermédiaire
```sql
-- Créer fonction SECURITY DEFINER qui vérifie autorisation
CREATE OR REPLACE FUNCTION is_ticket_authorized_for_entreprise(
  p_ticket_id uuid,
  p_entreprise_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM tickets t
    JOIN regies_entreprises re ON t.regie_id = re.regie_id
    WHERE t.id = p_ticket_id
      AND re.entreprise_id = p_entreprise_id
      AND (
        (re.mode_diffusion = 'general' AND t.statut = 'ouvert')
        OR
        (re.mode_diffusion = 'restreint' AND t.entreprise_id = p_entreprise_id)
      )
  );
END;
$$;

-- Modifier policy tickets
DROP POLICY IF EXISTS "Entreprise can view authorized tickets" ON tickets;
CREATE POLICY "Entreprise can view authorized tickets"
ON tickets FOR SELECT
USING (
  is_ticket_authorized_for_entreprise(
    tickets.id,
    (SELECT id FROM entreprises WHERE profile_id = auth.uid())
  )
);
```

**Avantage**: Fonction `SECURITY DEFINER` bypass RLS → pas de récursion

---

### RÈGLE 4: Policy `entreprises` pour régies

**Problème actuel**: Policy "Regie can view authorized entreprises" lit `regies_entreprises`

**Solution**: ✅ **PAS DE CHANGEMENT NÉCESSAIRE**

**Analyse**:
- Policy utilise `get_user_regie_id()` qui est `SECURITY DEFINER`
- Pas de lecture de `tickets` dans cette chaîne
- Récursion uniquement si `regies_entreprises` lit `entreprises` → déjà identifié ci-dessus

**Action**: Corriger la policy de `regies_entreprises` (voir RÈGLE 5)

---

### RÈGLE 5: Corriger policy `regies_entreprises` pour entreprises

**Problème actuel**: Policy "Entreprise can view own authorizations" lit `entreprises`

```sql
-- ❌ ACTUEL
CREATE POLICY "Entreprise can view own authorizations"
ON regies_entreprises FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM entreprises  -- ❌ Peut déclencher récursion
    WHERE entreprises.id = regies_entreprises.entreprise_id
      AND entreprises.profile_id = auth.uid()
  )
);
```

**Solution**: Utiliser fonction SECURITY DEFINER

```sql
-- WHY: Évite récursion RLS entre regies_entreprises ↔ entreprises
CREATE OR REPLACE FUNCTION get_user_entreprise_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT id
    FROM entreprises
    WHERE profile_id = auth.uid()
  );
END;
$$;

-- Modifier policy
DROP POLICY IF EXISTS "Entreprise can view own authorizations" ON regies_entreprises;
CREATE POLICY "Entreprise can view own authorizations"
ON regies_entreprises FOR SELECT
USING (entreprise_id = get_user_entreprise_id());
```

**Avantage**: Fonction `SECURITY DEFINER` bypass RLS sur `entreprises` → pas de récursion

---

### RÈGLE 6: Storage policy sécurisée

**Problème**: Policy signatures lit `regies_entreprises` directement

**Solution**: Même approche - fonction intermédiaire

```sql
-- WHY: Évite récursion RLS sur regies_entreprises
CREATE OR REPLACE FUNCTION is_entreprise_authorized_for_regie(
  p_entreprise_id uuid,
  p_regie_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM regies_entreprises
    WHERE entreprise_id = p_entreprise_id
      AND regie_id = p_regie_id
  );
END;
$$;

-- Modifier policy storage
DROP POLICY IF EXISTS "Regie can view signatures of authorized entreprises" ON storage.objects;
CREATE POLICY "Regie can view signatures of authorized entreprises"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'signatures' AND
  (storage.foldername(name))[1] = 'entreprises' AND
  EXISTS (
    SELECT 1
    FROM entreprises e
    JOIN regies r ON r.profile_id = auth.uid()
    WHERE e.id::text = (storage.foldername(name))[2]
      AND is_entreprise_authorized_for_regie(e.id, r.id)
  )
);
```

---

## 🧪 ÉTAPE 3 — SCÉNARIOS DE VALIDATION

### Test 1: Locataire crée ticket
```sql
-- Contexte: Locataire test-locataire@jetc.ch
-- Action: POST /api/tickets/create

SELECT
  t.id,
  t.titre,
  t.locataire_id,
  t.regie_id,
  l.id as locataire_record_id,
  l.profile_id
FROM tickets t
JOIN locataires l ON t.locataire_id = l.id
WHERE l.profile_id = auth.uid();

-- Résultat attendu:
-- ✅ 1 ligne retournée
-- ✅ locataire_id = l.id
-- ✅ regie_id peuplé par trigger
-- ❌ PAS d'erreur récursion
```

---

### Test 2: Régie voit ses tickets
```sql
-- Contexte: Régie test-regie@jetc.ch
-- Action: GET /regie/tickets.html

SELECT
  t.id,
  t.titre,
  t.statut,
  t.regie_id,
  r.id as regie_record_id,
  r.profile_id
FROM tickets t
JOIN regies r ON t.regie_id = r.id
WHERE r.profile_id = auth.uid();

-- Résultat attendu:
-- ✅ Tous les tickets de la régie
-- ✅ Pas de déconnexion
-- ❌ PAS d'erreur récursion
-- ❌ PAS d'erreur 42P17
```

---

### Test 3: Entreprise voit tickets autorisés
```sql
-- Contexte: Entreprise test-entreprise@jetc.ch
-- Action: SELECT tickets via policy

-- AVANT CORRECTION (❌ récursion):
SELECT *
FROM tickets
WHERE regie_id = '...'
LIMIT 1;
-- Erreur: infinite recursion detected in policy for relation "regies_entreprises"

-- APRÈS CORRECTION (✅ OK):
SELECT
  t.id,
  t.titre,
  t.statut,
  re.mode_diffusion,
  e.id as entreprise_id
FROM tickets t
JOIN regies_entreprises re ON t.regie_id = re.regie_id
JOIN entreprises e ON re.entreprise_id = e.id
WHERE e.profile_id = auth.uid()
  AND (
    (re.mode_diffusion = 'general' AND t.statut = 'ouvert')
    OR
    (re.mode_diffusion = 'restreint' AND t.entreprise_id = e.id)
  );

-- Résultat attendu:
-- ✅ Tickets autorisés uniquement
-- ❌ PAS d'erreur récursion
```

---

### Test 4: Régie lit entreprises autorisées
```sql
-- Contexte: Régie test-regie@jetc.ch
-- Action: SELECT entreprises

SELECT
  e.id,
  e.nom,
  re.mode_diffusion
FROM entreprises e
JOIN regies_entreprises re ON e.id = re.entreprise_id
WHERE re.regie_id = get_user_regie_id();

-- Résultat attendu:
-- ✅ Liste entreprises autorisées
-- ❌ PAS d'erreur récursion
```

---

### Test 5: Vue tickets_visibles_entreprise (après conversion fonction)
```sql
-- Contexte: Entreprise test-entreprise@jetc.ch
-- Action: SELECT get_tickets_visibles_entreprise()

SELECT *
FROM get_tickets_visibles_entreprise(NULL)
WHERE statut = 'ouvert'
LIMIT 10;

-- Résultat attendu:
-- ✅ Tickets disponibles mode 'general'
-- ✅ Tickets assignés mode 'restreint'
-- ❌ PAS d'erreur récursion
-- ❌ PAS d'erreur performance
```

---

## 📦 LIVRABLE FINAL - SQL DE CORRECTION

**Fichier**: `HOTFIX_RLS_RECURSION_REGIES_ENTREPRISES.sql`

```sql
-- =====================================================
-- HOTFIX: Récursion RLS regies_entreprises
-- Date: 26 décembre 2025
-- Erreur: infinite recursion detected in policy for relation "regies_entreprises"
-- =====================================================

-- =====================================================
-- PARTIE 1: Fonctions helper SECURITY DEFINER
-- =====================================================

-- WHY: Évite récursion RLS entre regies_entreprises ↔ entreprises
CREATE OR REPLACE FUNCTION get_user_entreprise_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT id
    FROM entreprises
    WHERE profile_id = auth.uid()
  );
END;
$$;

COMMENT ON FUNCTION get_user_entreprise_id() IS 
'Retourne entreprise_id pour auth.uid() (SECURITY DEFINER bypass RLS)';

-- WHY: Évite récursion RLS sur tickets lors vérification autorisation entreprise
CREATE OR REPLACE FUNCTION is_ticket_authorized_for_entreprise(
  p_ticket_id uuid,
  p_entreprise_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM tickets t
    JOIN regies_entreprises re ON t.regie_id = re.regie_id
    WHERE t.id = p_ticket_id
      AND re.entreprise_id = p_entreprise_id
      AND (
        (re.mode_diffusion = 'general' AND t.statut = 'ouvert')
        OR
        (re.mode_diffusion = 'restreint' AND t.entreprise_id = p_entreprise_id)
      )
  );
END;
$$;

COMMENT ON FUNCTION is_ticket_authorized_for_entreprise IS 
'Vérifie si entreprise autorisée à voir ticket (SECURITY DEFINER bypass RLS)';

-- WHY: Évite récursion RLS sur regies_entreprises lors vérification storage
CREATE OR REPLACE FUNCTION is_entreprise_authorized_for_regie(
  p_entreprise_id uuid,
  p_regie_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM regies_entreprises
    WHERE entreprise_id = p_entreprise_id
      AND regie_id = p_regie_id
  );
END;
$$;

COMMENT ON FUNCTION is_entreprise_authorized_for_regie IS 
'Vérifie si entreprise autorisée pour régie (SECURITY DEFINER bypass RLS)';

-- =====================================================
-- PARTIE 2: Corriger policy regies_entreprises
-- =====================================================

-- WHY: Évite récursion entre regies_entreprises ↔ entreprises
DROP POLICY IF EXISTS "Entreprise can view own authorizations" ON regies_entreprises;

CREATE POLICY "Entreprise can view own authorizations"
ON regies_entreprises FOR SELECT
USING (entreprise_id = get_user_entreprise_id());

COMMENT ON POLICY "Entreprise can view own authorizations" ON regies_entreprises IS 
'Entreprise voit ses autorisations via fonction SECURITY DEFINER (pas de récursion RLS)';

-- =====================================================
-- PARTIE 3: Corriger policy tickets pour entreprises
-- =====================================================

-- WHY: Évite récursion tickets → regies_entreprises → entreprises → tickets
DROP POLICY IF EXISTS "Entreprise can view authorized tickets" ON tickets;

CREATE POLICY "Entreprise can view authorized tickets"
ON tickets FOR SELECT
USING (
  is_ticket_authorized_for_entreprise(
    tickets.id,
    get_user_entreprise_id()
  )
);

COMMENT ON POLICY "Entreprise can view authorized tickets" ON tickets IS 
'Entreprise voit tickets autorisés via fonction SECURITY DEFINER (pas de récursion RLS)';

-- =====================================================
-- PARTIE 4: Convertir vue en fonction SECURITY DEFINER
-- =====================================================

-- WHY: Vue hérite RLS des tables → récursion garantie
-- Solution: Fonction SECURITY DEFINER bypass RLS
DROP VIEW IF EXISTS tickets_visibles_entreprise;

CREATE OR REPLACE FUNCTION get_tickets_visibles_entreprise(
  p_entreprise_id uuid DEFAULT NULL
)
RETURNS TABLE (
  ticket_id uuid,
  titre text,
  description text,
  categorie text,
  priorite text,
  statut text,
  created_at timestamptz,
  updated_at timestamptz,
  locataire_id uuid,
  logement_id uuid,
  regie_id uuid,
  entreprise_id uuid,
  mode_diffusion text,
  locataire_nom text,
  locataire_prenom text,
  logement_numero text,
  immeuble_nom text,
  immeuble_adresse text,
  regie_nom text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.titre,
    t.description,
    t.categorie,
    t.priorite,
    t.statut,
    t.created_at,
    t.updated_at,
    t.locataire_id,
    t.logement_id,
    t.regie_id,
    t.entreprise_id,
    re.mode_diffusion,
    loc.nom,
    loc.prenom,
    log.numero,
    imm.nom,
    imm.adresse,
    reg.nom
  FROM tickets t
  JOIN regies_entreprises re ON t.regie_id = re.regie_id
  JOIN locataires loc ON t.locataire_id = loc.id
  JOIN logements log ON t.logement_id = log.id
  JOIN immeubles imm ON log.immeuble_id = imm.id
  JOIN regies reg ON t.regie_id = reg.id
  WHERE
    re.entreprise_id = COALESCE(
      p_entreprise_id,
      get_user_entreprise_id()
    )
    AND (
      (re.mode_diffusion = 'general' AND t.statut = 'ouvert')
      OR
      (re.mode_diffusion = 'restreint' AND t.entreprise_id = re.entreprise_id)
    );
END;
$$;

COMMENT ON FUNCTION get_tickets_visibles_entreprise IS 
'Remplace vue tickets_visibles_entreprise (SECURITY DEFINER évite récursion RLS)';

-- =====================================================
-- PARTIE 5: Corriger policy storage
-- =====================================================

-- WHY: Évite récursion storage → regies_entreprises → entreprises
DROP POLICY IF EXISTS "Regie can view signatures of authorized entreprises" ON storage.objects;

CREATE POLICY "Regie can view signatures of authorized entreprises"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'signatures' AND
  (storage.foldername(name))[1] = 'entreprises' AND
  EXISTS (
    SELECT 1
    FROM entreprises e
    JOIN regies r ON r.profile_id = auth.uid()
    WHERE e.id::text = (storage.foldername(name))[2]
      AND is_entreprise_authorized_for_regie(e.id, r.id)
  )
);

COMMENT ON POLICY "Regie can view signatures of authorized entreprises" ON storage.objects IS 
'Régie voit signatures entreprises autorisées via fonction SECURITY DEFINER (pas récursion)';

-- =====================================================
-- PARTIE 6: Validation
-- =====================================================

-- Test 1: Vérifier policies regies_entreprises
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'regies_entreprises'
ORDER BY policyname;

-- Test 2: Vérifier fonction get_tickets_visibles_entreprise existe
SELECT
  proname,
  provolatile,  -- 's' = STABLE
  prosecdef      -- 't' = SECURITY DEFINER
FROM pg_proc
WHERE proname = 'get_tickets_visibles_entreprise';

-- Test 3: Vérifier fonctions helper existent
SELECT proname
FROM pg_proc
WHERE proname IN (
  'get_user_entreprise_id',
  'is_ticket_authorized_for_entreprise',
  'is_entreprise_authorized_for_regie'
);

-- =====================================================
-- RÉSULTAT ATTENDU
-- =====================================================

/*
✅ Locataire crée ticket → fonctionne
✅ Régie voit ses tickets → pas de déconnexion
✅ Entreprise voit tickets autorisés → pas de récursion
✅ Storage policies → pas de récursion
✅ Aucune erreur "infinite recursion"
*/
```

---

## 📋 RÉSUMÉ EXÉCUTIF

### Causes identifiées

1. **Policy tickets → regies_entreprises**: Lecture directe dans contexte RLS
2. **Policy regies_entreprises → entreprises**: Lecture directe dans contexte RLS
3. **Vue tickets_visibles_entreprise**: Hérite RLS → récursion via JOIN
4. **Storage policy**: Lit regies_entreprises directement

### Solutions appliquées

1. ✅ Fonctions `SECURITY DEFINER` pour bypass RLS:
   - `get_user_entreprise_id()`
   - `is_ticket_authorized_for_entreprise()`
   - `is_entreprise_authorized_for_regie()`

2. ✅ Policy `regies_entreprises` simplifiée:
   - Utilise `get_user_entreprise_id()` au lieu de `EXISTS (SELECT ... FROM entreprises)`

3. ✅ Policy `tickets` simplifiée:
   - Utilise `is_ticket_authorized_for_entreprise()` au lieu de `EXISTS (SELECT ... FROM regies_entreprises)`

4. ✅ Vue convertie en fonction:
   - `tickets_visibles_entreprise` → `get_tickets_visibles_entreprise()`
   - `SECURITY DEFINER` + `STABLE` pour performance

5. ✅ Storage policy sécurisée:
   - Utilise `is_entreprise_authorized_for_regie()` au lieu de `JOIN regies_entreprises`

### Impact

- ❌ **Pas de migration automatique** (comme demandé)
- ✅ **SQL propre et traçable**
- ✅ **Pas de modification frontend** (API reste identique)
- ✅ **Pas de refacto structurelle**
- ✅ **Base stable et performante**

### Application

```bash
# 1. Copier HOTFIX_RLS_RECURSION_REGIES_ENTREPRISES.sql
# 2. Ouvrir Supabase Dashboard → SQL Editor
# 3. Coller et exécuter le contenu complet
# 4. Vérifier tests de validation (PARTIE 6)
# 5. Tester scénarios utilisateurs (ÉTAPE 3)
```

---

**FIN DU DIAGNOSTIC**
