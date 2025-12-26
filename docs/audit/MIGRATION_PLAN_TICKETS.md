# 🛠️ PLAN DE MIGRATION - TICKETS JETC_IMMO

**Date** : 26 décembre 2025  
**Objectif** : Transformer l'existant vers la spec cible sans casser  
**Principe** : 1 problème = 1 migration atomique, idempotente, testable, réversible

---

## 📐 MÉTHODOLOGIE

### Règles d'or

1. **Atomicité** : 1 migration = 1 objectif précis
2. **Idempotence** : Relancer 2 fois = même résultat (IF EXISTS, IF NOT EXISTS)
3. **Ordre strict** : Numérotation séquentielle YYYYMMDDHHMMSS
4. **Rollback** : Chaque migration a son script de retour arrière
5. **Validation** : Test après chaque migration
6. **Sécurité** : Pas de destruction de données avant backup

### Structure fichiers

```
supabase/migrations/
├── 20250126140000_add_budget_columns.sql
├── 20250126140000_add_budget_columns_rollback.sql
├── 20250126141000_fix_accept_ticket_rpc.sql
├── 20250126141000_fix_accept_ticket_rpc_rollback.sql
└── ...
```

---

## 🎯 PLAN GLOBAL

### Vue d'ensemble

| Phase | Objectif | Migrations | Durée estimée | Risque |
|-------|----------|------------|---------------|--------|
| **PHASE 1** | Débloquer workflow actuel | M01-M07 | 30 min | 🟡 Moyen |
| **PHASE 2** | Enrichir fonctionnalités | M08-M11 | 45 min | 🟢 Faible |
| **PHASE 3** | Sécuriser | M12-M14 | 15 min | 🟢 Faible |
| **PHASE 4** | Polir | M15-M16 | 10 min | 🟢 Faible |

**Total** : 16 migrations | ~1h40 | Compatible Vercel zéro-downtime

---

## 🔴 PHASE 1 - DÉBLOQUER WORKFLOW (Priorité P1)

### M01 - Ajouter colonnes budget sur tickets

**Fichier** : `20250126140000_add_budget_columns.sql`

**Objectif** : Permettre définition plafond CHF

**Script** :

```sql
-- M01 - Ajouter colonnes budget sur tickets
-- ============================================

-- Ajout colonne plafond
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS plafond_intervention_chf numeric(10,2) NOT NULL DEFAULT 0;

-- Ajout colonne devise
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS devise text NOT NULL DEFAULT 'CHF';

-- Contrainte CHECK plafond >= 0
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_plafond_positif'
  ) THEN
    ALTER TABLE tickets
    ADD CONSTRAINT check_plafond_positif
    CHECK (plafond_intervention_chf >= 0);
  END IF;
END $$;

-- Contrainte CHECK devise = 'CHF'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_devise_chf'
  ) THEN
    ALTER TABLE tickets
    ADD CONSTRAINT check_devise_chf
    CHECK (devise = 'CHF');
  END IF;
END $$;

-- Index sur plafond (pour requêtes futures)
CREATE INDEX IF NOT EXISTS idx_tickets_plafond
ON tickets(plafond_intervention_chf)
WHERE plafond_intervention_chf > 0;

-- Commentaires
COMMENT ON COLUMN tickets.plafond_intervention_chf IS 'Montant maximum autorisé pour l''intervention en CHF';
COMMENT ON COLUMN tickets.devise IS 'Devise du montant, toujours CHF';
```

**Rollback** :

```sql
-- M01 ROLLBACK
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_plafond_positif;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_devise_chf;
DROP INDEX IF EXISTS idx_tickets_plafond;
ALTER TABLE tickets DROP COLUMN IF EXISTS plafond_intervention_chf;
ALTER TABLE tickets DROP COLUMN IF EXISTS devise;
```

**Validation** :

```sql
-- Vérifier colonnes créées
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'tickets'
AND column_name IN ('plafond_intervention_chf', 'devise');

-- Vérifier contraintes
SELECT conname FROM pg_constraint
WHERE conname IN ('check_plafond_positif', 'check_devise_chf');
```

**Test** :

```sql
-- Test INSERT avec plafond
INSERT INTO tickets (titre, description, categorie, priorite, locataire_id, logement_id, plafond_intervention_chf)
VALUES ('Test', 'Test', 'plomberie', 'normale', '...', '...', 150.50);

-- Test contrainte devise
INSERT INTO tickets (..., devise) VALUES (..., 'EUR'); -- Doit échouer

-- Test contrainte plafond
INSERT INTO tickets (..., plafond_intervention_chf) VALUES (..., -10); -- Doit échouer
```

**Risque** : 🟢 Faible - Ajout colonnes, pas de modification existantes

---

### M02 - Ajouter colonne mode_diffusion sur tickets

**Fichier** : `20250126140100_add_mode_diffusion.sql`

**Objectif** : Permettre distinction public/assigné

**Script** :

```sql
-- M02 - Ajouter colonne mode_diffusion
-- =====================================

ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS mode_diffusion text;

-- Contrainte CHECK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_mode_diffusion'
  ) THEN
    ALTER TABLE tickets
    ADD CONSTRAINT check_mode_diffusion
    CHECK (mode_diffusion IS NULL OR mode_diffusion IN ('public', 'assigné'));
  END IF;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_tickets_mode_diffusion
ON tickets(mode_diffusion)
WHERE mode_diffusion IS NOT NULL;

-- Commentaire
COMMENT ON COLUMN tickets.mode_diffusion IS 'Mode de diffusion du ticket : public (toutes entreprises) ou assigné (une seule). NULL = pas encore diffusé.';
```

**Rollback** :

```sql
-- M02 ROLLBACK
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_mode_diffusion;
DROP INDEX IF EXISTS idx_tickets_mode_diffusion;
ALTER TABLE tickets DROP COLUMN IF EXISTS mode_diffusion;
```

**Validation** :

```sql
SELECT column_name, is_nullable FROM information_schema.columns
WHERE table_name = 'tickets' AND column_name = 'mode_diffusion';
```

**Test** :

```sql
-- Test valeurs autorisées
UPDATE tickets SET mode_diffusion = 'public' WHERE id = '...'; -- OK
UPDATE tickets SET mode_diffusion = 'assigné' WHERE id = '...'; -- OK
UPDATE tickets SET mode_diffusion = 'invalide' WHERE id = '...'; -- Doit échouer
```

**Risque** : 🟢 Faible

---

### M03 - Créer RPC update_ticket_statut

**Fichier** : `20250126140200_create_update_ticket_statut_rpc.sql`

**Objectif** : Valider transitions de statuts

**Script** :

```sql
-- M03 - Créer RPC update_ticket_statut
-- =====================================

CREATE OR REPLACE FUNCTION update_ticket_statut(
  p_ticket_id uuid,
  p_nouveau_statut ticket_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_statut_actuel ticket_status;
  v_user_role text;
BEGIN
  -- Récupère statut actuel
  SELECT statut INTO v_statut_actuel
  FROM tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket % non trouvé', p_ticket_id;
  END IF;

  -- Récupère rôle utilisateur
  SELECT (
    SELECT role FROM profiles WHERE id = auth.uid()
  ) INTO v_user_role;

  -- Validation transitions (simplifié - à enrichir selon spec)
  IF v_statut_actuel = p_nouveau_statut THEN
    -- Pas de changement, OK
    RETURN;
  END IF;

  -- Transitions autorisées
  IF v_statut_actuel = 'nouveau' AND p_nouveau_statut = 'ouvert' AND v_user_role = 'regie' THEN
    -- OK
  ELSIF v_statut_actuel = 'ouvert' AND p_nouveau_statut = 'en_attente' AND v_user_role = 'regie' THEN
    -- OK
  ELSIF v_statut_actuel = 'en_attente' AND p_nouveau_statut = 'en_cours' THEN
    -- OK (géré par accept_ticket_and_create_mission)
  ELSIF v_statut_actuel = 'en_cours' AND p_nouveau_statut = 'termine' THEN
    -- OK
  ELSIF v_statut_actuel = 'termine' AND p_nouveau_statut = 'clos' AND v_user_role = 'regie' THEN
    -- OK
  ELSIF p_nouveau_statut = 'annule' AND v_user_role IN ('regie', 'admin_jtec') THEN
    -- OK - Régie peut toujours annuler
  ELSE
    RAISE EXCEPTION 'Transition interdite : % → % pour rôle %',
      v_statut_actuel, p_nouveau_statut, v_user_role;
  END IF;

  -- Effectue la mise à jour
  UPDATE tickets
  SET
    statut = p_nouveau_statut,
    updated_at = now(),
    date_cloture = CASE WHEN p_nouveau_statut = 'clos' THEN now() ELSE date_cloture END
  WHERE id = p_ticket_id;
END;
$$;

-- Grant accès
GRANT EXECUTE ON FUNCTION update_ticket_statut TO authenticated;

-- Commentaire
COMMENT ON FUNCTION update_ticket_statut IS 'Met à jour le statut d''un ticket avec validation des transitions autorisées';
```

**Rollback** :

```sql
-- M03 ROLLBACK
DROP FUNCTION IF EXISTS update_ticket_statut(uuid, ticket_status);
```

**Validation** :

```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'update_ticket_statut';
```

**Test** :

```sql
-- Test transition valide
SELECT update_ticket_statut('<ticket_id>', 'ouvert');

-- Test transition invalide
SELECT update_ticket_statut('<ticket_id>', 'clos'); -- Doit échouer si pas en 'termine'
```

**Risque** : 🟡 Moyen - Fonction appelée par API

---

### M04 - Créer RPC diffuser_ticket

**Fichier** : `20250126140300_create_diffuser_ticket_rpc.sql`

**Objectif** : Remplacer UPDATE direct, valider diffusion

**Script** :

```sql
-- M04 - Créer RPC diffuser_ticket
-- ================================

CREATE OR REPLACE FUNCTION diffuser_ticket(
  p_ticket_id uuid,
  p_mode_diffusion text,
  p_entreprise_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_statut ticket_status;
  v_user_regie_id uuid;
  v_ticket_regie_id uuid;
BEGIN
  -- Récupère regie_id de l'utilisateur
  v_user_regie_id := get_user_regie_id();

  IF v_user_regie_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non associé à une régie';
  END IF;

  -- Récupère infos ticket
  SELECT statut, regie_id
  INTO v_statut, v_ticket_regie_id
  FROM tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket % non trouvé', p_ticket_id;
  END IF;

  -- Vérifie ownership
  IF v_ticket_regie_id != v_user_regie_id THEN
    RAISE EXCEPTION 'Ticket appartient à une autre régie';
  END IF;

  -- Vérifie statut = 'ouvert'
  IF v_statut != 'ouvert' THEN
    RAISE EXCEPTION 'Ticket doit être en statut "ouvert" (actuel: %)', v_statut;
  END IF;

  -- Vérifie mode_diffusion valide
  IF p_mode_diffusion NOT IN ('public', 'assigné') THEN
    RAISE EXCEPTION 'Mode diffusion invalide : %', p_mode_diffusion;
  END IF;

  -- Si mode assigné, vérifie entreprise_id fourni
  IF p_mode_diffusion = 'assigné' AND p_entreprise_id IS NULL THEN
    RAISE EXCEPTION 'Mode assigné nécessite entreprise_id';
  END IF;

  -- Si mode assigné, vérifie entreprise autorisée
  IF p_mode_diffusion = 'assigné' THEN
    IF NOT EXISTS (
      SELECT 1 FROM regies_entreprises
      WHERE regie_id = v_user_regie_id
      AND entreprise_id = p_entreprise_id
    ) THEN
      RAISE EXCEPTION 'Entreprise % non autorisée pour cette régie', p_entreprise_id;
    END IF;
  END IF;

  -- Effectue la diffusion
  UPDATE tickets
  SET
    statut = 'en_attente',
    mode_diffusion = p_mode_diffusion,
    entreprise_id = CASE WHEN p_mode_diffusion = 'assigné' THEN p_entreprise_id ELSE NULL END,
    updated_at = now()
  WHERE id = p_ticket_id;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'mode_diffusion', p_mode_diffusion,
    'entreprise_id', p_entreprise_id
  );
END;
$$;

-- Grant
GRANT EXECUTE ON FUNCTION diffuser_ticket TO authenticated;

-- Commentaire
COMMENT ON FUNCTION diffuser_ticket IS 'Diffuse un ticket aux entreprises (mode public ou assigné)';
```

**Rollback** :

```sql
-- M04 ROLLBACK
DROP FUNCTION IF EXISTS diffuser_ticket(uuid, text, uuid);
```

**Validation** :

```sql
SELECT routine_name FROM information_schema.routines WHERE routine_name = 'diffuser_ticket';
```

**Test** :

```sql
-- Test diffusion public
SELECT diffuser_ticket('<ticket_id>', 'public');

-- Test diffusion assigné
SELECT diffuser_ticket('<ticket_id>', 'assigné', '<entreprise_id>');

-- Test diffusion assigné sans entreprise_id
SELECT diffuser_ticket('<ticket_id>', 'assigné'); -- Doit échouer
```

**Risque** : 🟡 Moyen - Remplace logique API

---

### M05 - Corriger RPC accept_ticket_and_create_mission

**Fichier** : `20250126140400_fix_accept_ticket_rpc.sql`

**Objectif** : Supprimer check colonne `autorise` inexistante, ajouter logique mode diffusion

**Script** :

```sql
-- M05 - Corriger RPC accept_ticket_and_create_mission
-- ====================================================

CREATE OR REPLACE FUNCTION accept_ticket_and_create_mission(
  p_ticket_id uuid,
  p_entreprise_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_regie_id uuid;
  v_statut ticket_status;
  v_locked_at timestamptz;
  v_mode_diffusion text;
  v_entreprise_assignee uuid;
  v_mission_id uuid;
BEGIN
  -- Récupère infos ticket
  SELECT regie_id, statut, locked_at, mode_diffusion, entreprise_id
  INTO v_regie_id, v_statut, v_locked_at, v_mode_diffusion, v_entreprise_assignee
  FROM tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket % non trouvé', p_ticket_id;
  END IF;

  -- Vérif ticket non verrouillé
  IF v_locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Ticket déjà verrouillé (accepté par une autre entreprise)';
  END IF;

  -- Vérif statut = 'en_attente'
  IF v_statut != 'en_attente' THEN
    RAISE EXCEPTION 'Ticket doit être en statut "en_attente" (actuel: %)', v_statut;
  END IF;

  -- Vérif mode diffusion
  IF v_mode_diffusion = 'public' THEN
    -- Mode public : vérifie entreprise autorisée en mode 'general'
    IF NOT EXISTS (
      SELECT 1 FROM regies_entreprises
      WHERE regie_id = v_regie_id
      AND entreprise_id = p_entreprise_id
      AND mode_diffusion = 'general'
    ) THEN
      RAISE EXCEPTION 'Entreprise non autorisée pour cette régie en mode général';
    END IF;
  ELSIF v_mode_diffusion = 'assigné' THEN
    -- Mode assigné : vérifie c'est bien l'entreprise assignée
    IF v_entreprise_assignee != p_entreprise_id THEN
      RAISE EXCEPTION 'Ticket assigné à une autre entreprise';
    END IF;
  ELSE
    RAISE EXCEPTION 'Mode diffusion invalide : %', v_mode_diffusion;
  END IF;

  -- Crée mission
  INSERT INTO missions (ticket_id, entreprise_id, statut)
  VALUES (p_ticket_id, p_entreprise_id, 'en_attente')
  RETURNING id INTO v_mission_id;

  -- Verrouille + assigne + change statut ticket
  UPDATE tickets
  SET
    locked_at = now(),
    entreprise_id = p_entreprise_id,
    statut = 'en_cours',
    updated_at = now()
  WHERE id = p_ticket_id;

  RETURN jsonb_build_object(
    'success', true,
    'mission_id', v_mission_id,
    'ticket_id', p_ticket_id
  );
END;
$$;

-- Commentaire
COMMENT ON FUNCTION accept_ticket_and_create_mission IS 'Accepte un ticket et crée la mission associée (avec vérification mode diffusion)';
```

**Rollback** :

```sql
-- M05 ROLLBACK
-- Restaurer version originale (mais elle est cassée, donc plutôt DROP)
DROP FUNCTION IF EXISTS accept_ticket_and_create_mission(uuid, uuid);
```

**Validation** :

```sql
-- Vérifier fonction existe et a bon nombre params
SELECT p.proname, pg_catalog.pg_get_function_arguments(p.oid) AS args
FROM pg_proc p
WHERE p.proname = 'accept_ticket_and_create_mission';
```

**Test** :

```sql
-- Test acceptation public
SELECT accept_ticket_and_create_mission('<ticket_id_public>', '<entreprise_id>');

-- Test acceptation assigné
SELECT accept_ticket_and_create_mission('<ticket_id_assigné>', '<entreprise_correcte>');

-- Test acceptation assigné mauvaise entreprise
SELECT accept_ticket_and_create_mission('<ticket_id_assigné>', '<mauvaise_entreprise>'); -- Doit échouer
```

**Risque** : 🟡 Moyen - Fonction critique du workflow

---

### M06 - Corriger vue tickets_visibles_entreprise

**Fichier** : `20250126140500_fix_tickets_visibles_entreprise_view.sql`

**Objectif** : Corriger filtre statut + ajouter logique mode diffusion

**Script** :

```sql
-- M06 - Corriger vue tickets_visibles_entreprise
-- ===============================================

DROP VIEW IF EXISTS tickets_visibles_entreprise CASCADE;

CREATE VIEW tickets_visibles_entreprise AS
SELECT
  t.*,
  re.entreprise_id AS visible_par_entreprise_id,
  re.mode_diffusion AS autorisation_mode
FROM tickets t
INNER JOIN regies_entreprises re ON re.regie_id = t.regie_id
WHERE
  (
    -- CAS 1 : Mode PUBLIC (diffusion générale)
    re.mode_diffusion = 'general'
    AND t.mode_diffusion = 'public'
    AND t.statut = 'en_attente'
    AND t.locked_at IS NULL
  )
  OR
  (
    -- CAS 2 : Mode ASSIGNÉ (diffusion ciblée)
    t.mode_diffusion = 'assigné'
    AND t.entreprise_id = re.entreprise_id
    AND t.statut IN ('en_attente', 'en_cours', 'termine')
  )
  OR
  (
    -- CAS 3 : Tickets déjà acceptés par cette entreprise
    t.entreprise_id = re.entreprise_id
    AND t.statut IN ('en_cours', 'termine', 'clos')
  );

-- Grant
GRANT SELECT ON tickets_visibles_entreprise TO authenticated;

-- Commentaire
COMMENT ON VIEW tickets_visibles_entreprise IS 'Tickets visibles par chaque entreprise selon mode diffusion (public ou assigné)';
```

**Rollback** :

```sql
-- M06 ROLLBACK
DROP VIEW IF EXISTS tickets_visibles_entreprise CASCADE;

-- Recréer ancienne version (cassée)
CREATE VIEW tickets_visibles_entreprise AS
SELECT t.*, re.entreprise_id
FROM tickets t
INNER JOIN regies_entreprises re ON re.regie_id = t.regie_id
WHERE (
  re.mode_diffusion = 'general' AND t.statut = 'ouvert'
) OR (
  re.mode_diffusion = 'restreint' AND t.entreprise_id = re.entreprise_id
);
```

**Validation** :

```sql
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_name = 'tickets_visibles_entreprise';
```

**Test** :

```sql
-- Tester en tant qu'entreprise
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '<profile_id_entreprise>';

SELECT * FROM tickets_visibles_entreprise; -- Doit retourner tickets diffusés
```

**Risque** : 🟡 Moyen - Vue utilisée par API entreprise

---

### M07 - Corriger policy RLS entreprise sur tickets

**Fichier** : `20250126140600_fix_rls_entreprise_tickets.sql`

**Objectif** : Aligner policy RLS avec vue corrigée

**Script** :

```sql
-- M07 - Corriger policy RLS entreprise sur tickets
-- =================================================

-- Supprime ancienne policy
DROP POLICY IF EXISTS "Entreprise can view authorized tickets" ON tickets;

-- Crée nouvelle policy
CREATE POLICY "Entreprise can view authorized tickets"
ON tickets FOR SELECT
TO authenticated
USING (
  (
    SELECT role FROM profiles WHERE id = auth.uid()
  ) = 'entreprise'
  AND
  (
    -- CAS 1 : Mode PUBLIC
    (
      mode_diffusion = 'public'
      AND statut = 'en_attente'
      AND locked_at IS NULL
      AND EXISTS (
        SELECT 1 FROM regies_entreprises re
        JOIN entreprises e ON e.id = re.entreprise_id
        WHERE re.regie_id = tickets.regie_id
        AND e.profile_id = auth.uid()
        AND re.mode_diffusion = 'general'
      )
    )
    OR
    -- CAS 2 : Mode ASSIGNÉ
    (
      mode_diffusion = 'assigné'
      AND entreprise_id = (
        SELECT id FROM entreprises WHERE profile_id = auth.uid()
      )
      AND statut IN ('en_attente', 'en_cours', 'termine')
    )
    OR
    -- CAS 3 : Déjà accepté
    (
      entreprise_id = (
        SELECT id FROM entreprises WHERE profile_id = auth.uid()
      )
      AND statut IN ('en_cours', 'termine', 'clos')
    )
  )
);

-- Commentaire
COMMENT ON POLICY "Entreprise can view authorized tickets" ON tickets
IS 'Permet aux entreprises de voir : 1) tickets publics en_attente non lockés, 2) tickets assignés à elles, 3) tickets qu''elles ont acceptés';
```

**Rollback** :

```sql
-- M07 ROLLBACK
DROP POLICY IF EXISTS "Entreprise can view authorized tickets" ON tickets;

-- Recréer ancienne policy (cassée)
CREATE POLICY "Entreprise can view authorized tickets"
ON tickets FOR SELECT TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'entreprise'
  AND (
    tickets.entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())
    OR (
      tickets.statut = 'ouvert'
      AND EXISTS (
        SELECT 1 FROM regies_entreprises
        WHERE regie_id = tickets.regie_id
        AND entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())
      )
    )
  )
);
```

**Validation** :

```sql
SELECT policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'tickets'
AND policyname = 'Entreprise can view authorized tickets';
```

**Test** :

```sql
-- Simuler utilisateur entreprise
SET ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '<profile_id_entreprise>';

-- Doit voir tickets diffusés
SELECT id, titre, statut, mode_diffusion FROM tickets;
```

**Risque** : 🟡 Moyen - Policy critique pour sécurité

---

## 🟢 PHASE 2 - ENRICHIR FONCTIONNALITÉS (Priorité P2)

### M08 - Ajouter colonnes classification (sous_categorie, piece)

**Fichier** : `20250126150000_add_classification_columns.sql`

**Objectif** : Permettre classification fine des tickets

**Script** :

```sql
-- M08 - Ajouter colonnes classification
-- ======================================

-- Ajout colonne sous_categorie
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS sous_categorie text;

-- Ajout colonne piece
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS piece text;

-- Contrainte CHECK sous_categorie (liste complète selon spec)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_sous_categorie_valide'
  ) THEN
    ALTER TABLE tickets
    ADD CONSTRAINT check_sous_categorie_valide
    CHECK (sous_categorie IN (
      -- Plomberie
      'Fuite d''eau', 'WC bouché', 'Robinetterie défectueuse', 'Chauffe-eau', 'Autre plomberie',
      -- Électricité
      'Panne de courant', 'Disjoncteur qui saute', 'Prise défectueuse', 'Interrupteur cassé', 'Luminaire', 'Autre électricité',
      -- Chauffage
      'Radiateur ne chauffe pas', 'Fuite radiateur', 'Thermostat défectueux', 'Chaudière', 'Autre chauffage',
      -- Serrurerie
      'Clé cassée', 'Serrure bloquée', 'Porte claquée', 'Autre serrurerie',
      -- Vitrerie
      'Vitre cassée', 'Fenêtre bloquée', 'Double vitrage', 'Autre vitrerie',
      -- Menuiserie
      'Porte abîmée', 'Placard', 'Parquet', 'Autre menuiserie',
      -- Peinture
      'Mur abîmé', 'Plafond', 'Boiserie', 'Autre peinture',
      -- Autre
      'Divers', 'À définir'
    ));
  END IF;
END $$;

-- Contrainte CHECK piece
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_piece_valide'
  ) THEN
    ALTER TABLE tickets
    ADD CONSTRAINT check_piece_valide
    CHECK (piece IN ('cuisine', 'sdb', 'salon', 'chambre', 'couloir', 'cave', 'autre'));
  END IF;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_tickets_sous_categorie ON tickets(sous_categorie);
CREATE INDEX IF NOT EXISTS idx_tickets_piece ON tickets(piece);

-- Commentaires
COMMENT ON COLUMN tickets.sous_categorie IS 'Sous-catégorie précise du ticket (dépend de catégorie)';
COMMENT ON COLUMN tickets.piece IS 'Pièce concernée par l''intervention';
```

**⚠️ Note migration données** :

Tickets existants auront `sous_categorie` et `piece` = NULL. Il faut décider :

**Option A** : Laisser NULL temporairement, forcer remplissage à la prochaine modification

**Option B** : Remplir avec valeurs par défaut (ex: 'À définir' pour sous_categorie, 'autre' pour piece)

**Recommandation** : Option A pour éviter polluer données.

**Migration données** (à exécuter APRÈS si besoin) :

```sql
-- Optionnel : Remplir valeurs par défaut pour tickets existants
UPDATE tickets
SET
  sous_categorie = 'À définir',
  piece = 'autre'
WHERE sous_categorie IS NULL OR piece IS NULL;

-- Puis rendre NOT NULL
ALTER TABLE tickets ALTER COLUMN sous_categorie SET NOT NULL;
ALTER TABLE tickets ALTER COLUMN piece SET NOT NULL;
```

**Rollback** :

```sql
-- M08 ROLLBACK
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_sous_categorie_valide;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_piece_valide;
DROP INDEX IF EXISTS idx_tickets_sous_categorie;
DROP INDEX IF EXISTS idx_tickets_piece;
ALTER TABLE tickets DROP COLUMN IF EXISTS sous_categorie;
ALTER TABLE tickets DROP COLUMN IF EXISTS piece;
```

**Risque** : 🟢 Faible - Colonnes nouvelles

---

### M09 - Créer table tickets_disponibilites

**Fichier** : `20250126150100_create_tickets_disponibilites.sql`

**Objectif** : Stocker 3 créneaux de disponibilité

**Script** :

```sql
-- M09 - Créer table tickets_disponibilites
-- =========================================

-- Extension pour contraintes EXCLUDE (si pas déjà installée)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Création table
CREATE TABLE IF NOT EXISTS tickets_disponibilites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  date_debut timestamptz NOT NULL,
  date_fin timestamptz NOT NULL,
  preference int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Contrainte durée
  CONSTRAINT check_date_fin_apres_debut
  CHECK (date_fin > date_debut),
  
  -- Contrainte preference (1, 2, 3)
  CONSTRAINT check_preference_valide
  CHECK (preference IN (1, 2, 3)),
  
  -- Contrainte dates dans le futur
  CONSTRAINT check_dates_futures
  CHECK (date_debut > now()),
  
  -- Contrainte durée minimale 2h
  CONSTRAINT check_duree_min_2h
  CHECK (date_fin >= date_debut + interval '2 hours'),
  
  -- Contrainte unicité (ticket_id, preference)
  CONSTRAINT unique_ticket_preference
  UNIQUE (ticket_id, preference)
);

-- Contrainte EXCLUDE : Pas de chevauchement créneaux pour un même ticket
ALTER TABLE tickets_disponibilites
ADD CONSTRAINT exclude_overlap_disponibilites
EXCLUDE USING gist (
  ticket_id WITH =,
  tstzrange(date_debut, date_fin) WITH &&
);

-- Index
CREATE INDEX IF NOT EXISTS idx_disponibilites_ticket_id
ON tickets_disponibilites(ticket_id);

CREATE INDEX IF NOT EXISTS idx_disponibilites_preference
ON tickets_disponibilites(ticket_id, preference);

-- Commentaire
COMMENT ON TABLE tickets_disponibilites IS 'Créneaux de disponibilité du locataire pour intervention (3 par ticket)';
COMMENT ON COLUMN tickets_disponibilites.preference IS 'Ordre de préférence : 1 = premier choix, 2 = second choix, 3 = dernier recours';
```

**Rollback** :

```sql
-- M09 ROLLBACK
DROP TABLE IF EXISTS tickets_disponibilites CASCADE;
```

**Validation** :

```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'tickets_disponibilites';

-- Vérifier contraintes
SELECT conname FROM pg_constraint WHERE conrelid = 'tickets_disponibilites'::regclass;
```

**Test** :

```sql
-- Test insertion 3 créneaux
INSERT INTO tickets_disponibilites (ticket_id, date_debut, date_fin, preference)
VALUES
  ('<ticket_id>', now() + interval '1 day', now() + interval '1 day 3 hours', 1),
  ('<ticket_id>', now() + interval '2 days', now() + interval '2 days 3 hours', 2),
  ('<ticket_id>', now() + interval '3 days', now() + interval '3 days 3 hours', 3);

-- Test doublon preference
INSERT INTO tickets_disponibilites (ticket_id, date_debut, date_fin, preference)
VALUES ('<ticket_id>', now() + interval '4 days', now() + interval '4 days 3 hours', 1); -- Doit échouer

-- Test chevauchement
INSERT INTO tickets_disponibilites (ticket_id, date_debut, date_fin, preference)
VALUES ('<ticket_id>', now() + interval '1 day 1 hour', now() + interval '1 day 4 hours', 4); -- Doit échouer (chevauchement avec créneau 1)
```

**Risque** : 🟢 Faible - Nouvelle table

---

### M10 - Créer trigger validation 3 disponibilités

**Fichier** : `20250126150200_create_trigger_validate_disponibilites.sql`

**Objectif** : Empêcher diffusion ticket sans 3 créneaux

**Script** :

```sql
-- M10 - Créer trigger validation 3 disponibilités
-- ================================================

CREATE OR REPLACE FUNCTION validate_ticket_disponibilites()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int;
BEGIN
  -- Compte nombre de disponibilités
  SELECT COUNT(*) INTO v_count
  FROM tickets_disponibilites
  WHERE ticket_id = NEW.id;

  -- Si passage en statut 'en_attente', vérifie 3 créneaux
  IF NEW.statut = 'en_attente' AND OLD.statut = 'ouvert' THEN
    IF v_count < 3 THEN
      RAISE EXCEPTION 'Un ticket doit avoir exactement 3 disponibilités avant diffusion (actuellement : %)', v_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger BEFORE UPDATE statut
DROP TRIGGER IF EXISTS check_disponibilites_before_diffusion ON tickets;
CREATE TRIGGER check_disponibilites_before_diffusion
BEFORE UPDATE OF statut ON tickets
FOR EACH ROW
WHEN (OLD.statut = 'ouvert' AND NEW.statut = 'en_attente')
EXECUTE FUNCTION validate_ticket_disponibilites();

-- Commentaire
COMMENT ON FUNCTION validate_ticket_disponibilites IS 'Valide qu''un ticket a 3 créneaux de disponibilité avant diffusion';
```

**Rollback** :

```sql
-- M10 ROLLBACK
DROP TRIGGER IF EXISTS check_disponibilites_before_diffusion ON tickets;
DROP FUNCTION IF EXISTS validate_ticket_disponibilites();
```

**Validation** :

```sql
SELECT tgname, tgrelid::regclass, tgfoid::regproc
FROM pg_trigger
WHERE tgname = 'check_disponibilites_before_diffusion';
```

**Test** :

```sql
-- Créer ticket sans disponibilités
INSERT INTO tickets (...) VALUES (...) RETURNING id; -- <ticket_id>

-- Tenter diffusion
SELECT diffuser_ticket('<ticket_id>', 'public'); -- Doit échouer

-- Ajouter 3 disponibilités
INSERT INTO tickets_disponibilites (...) VALUES (...), (...), (...);

-- Tenter diffusion
SELECT diffuser_ticket('<ticket_id>', 'public'); -- Doit réussir
```

**Risque** : 🟢 Faible

---

### M11 - Ajouter colonne devise sur missions + renommer montant

**Fichier** : `20250126150300_add_devise_missions.sql`

**Objectif** : Clarifier montants missions

**Script** :

```sql
-- M11 - Ajouter devise missions + renommer montant
-- =================================================

-- Renommer colonne montant → montant_reel_chf
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'missions' AND column_name = 'montant'
  ) THEN
    ALTER TABLE missions RENAME COLUMN montant TO montant_reel_chf;
  END IF;
END $$;

-- Ajouter colonne devise
ALTER TABLE missions
ADD COLUMN IF NOT EXISTS devise text NOT NULL DEFAULT 'CHF';

-- Contrainte CHECK devise = 'CHF'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_devise_mission_chf'
  ) THEN
    ALTER TABLE missions
    ADD CONSTRAINT check_devise_mission_chf
    CHECK (devise = 'CHF');
  END IF;
END $$;

-- Contrainte montant >= 0
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_montant_positif'
  ) THEN
    ALTER TABLE missions
    ADD CONSTRAINT check_montant_positif
    CHECK (montant_reel_chf IS NULL OR montant_reel_chf >= 0);
  END IF;
END $$;

-- Commentaires
COMMENT ON COLUMN missions.montant_reel_chf IS 'Montant réel de l''intervention facturé (en CHF)';
COMMENT ON COLUMN missions.devise IS 'Devise du montant, toujours CHF';
```

**Rollback** :

```sql
-- M11 ROLLBACK
ALTER TABLE missions DROP CONSTRAINT IF EXISTS check_devise_mission_chf;
ALTER TABLE missions DROP CONSTRAINT IF EXISTS check_montant_positif;
ALTER TABLE missions DROP COLUMN IF EXISTS devise;
ALTER TABLE missions RENAME COLUMN IF EXISTS montant_reel_chf TO montant;
```

**Validation** :

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'missions'
AND column_name IN ('montant_reel_chf', 'devise');
```

**Risque** : 🟢 Faible - Colonne peu utilisée

---

## 🛡️ PHASE 3 - SÉCURISER (Priorité P3)

### M12 - Corriger statut initial dans API (documentation)

**⚠️ CETTE MIGRATION NE MODIFIE PAS LA BASE, MAIS L'API**

**Fichier** : `docs/audit/M12_API_CREATE_STATUT_FIX.md`

**Objectif** : Corriger API `/api/tickets/create` pour utiliser default SQL 'nouveau'

**Changement dans** : `api/tickets/create.js`

**Avant** :

```javascript
const { data, error } = await supabaseAdmin
  .from('tickets')
  .insert({
    statut: 'ouvert',  // ❌
    // ...
  });
```

**Après** :

```javascript
const { data, error } = await supabaseAdmin
  .from('tickets')
  .insert({
    // statut: 'nouveau',  // ✅ Laisser default SQL
    // ...
  });
```

**Validation** :

```bash
# Vérifier code API
grep -n "statut.*ouvert" api/tickets/create.js
# Résultat attendu : Aucune ligne

# Tester création ticket
curl -X POST /api/tickets/create -d '{"titre":"Test", ...}'
# Vérifier statut = 'nouveau'
```

**Risque** : 🟢 Faible - Changement API simple

---

### M13 - Restreindre policy DELETE régie

**Fichier** : `20250126160000_fix_rls_regie_delete.sql`

**Objectif** : Empêcher suppression tickets avec missions

**Script** :

```sql
-- M13 - Restreindre policy DELETE régie
-- ======================================

-- Supprime policy FOR ALL (trop permissive)
DROP POLICY IF EXISTS "Regie can manage own tickets" ON tickets;

-- Recrée policies séparées SELECT, INSERT, UPDATE
CREATE POLICY "Regie can view own tickets"
ON tickets FOR SELECT TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('regie', 'admin_jtec')
  AND regie_id = get_user_regie_id()
);

CREATE POLICY "Regie can create tickets"
ON tickets FOR INSERT TO authenticated
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('regie', 'admin_jtec')
  AND regie_id = get_user_regie_id()
);

CREATE POLICY "Regie can update own tickets"
ON tickets FOR UPDATE TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('regie', 'admin_jtec')
  AND regie_id = get_user_regie_id()
);

-- Policy DELETE sécurisée
CREATE POLICY "Regie can delete tickets without missions"
ON tickets FOR DELETE TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('regie', 'admin_jtec')
  AND regie_id = get_user_regie_id()
  AND NOT EXISTS (SELECT 1 FROM missions WHERE ticket_id = tickets.id)
);

-- Commentaire
COMMENT ON POLICY "Regie can delete tickets without missions" ON tickets
IS 'Permet à la régie de supprimer uniquement les tickets sans mission active';
```

**Rollback** :

```sql
-- M13 ROLLBACK
DROP POLICY IF EXISTS "Regie can view own tickets" ON tickets;
DROP POLICY IF EXISTS "Regie can create tickets" ON tickets;
DROP POLICY IF EXISTS "Regie can update own tickets" ON tickets;
DROP POLICY IF EXISTS "Regie can delete tickets without missions" ON tickets;

-- Recréer policy FOR ALL
CREATE POLICY "Regie can manage own tickets"
ON tickets FOR ALL TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('regie', 'admin_jtec')
  AND regie_id = get_user_regie_id()
);
```

**Validation** :

```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'tickets' AND policyname LIKE 'Regie%';
```

**Test** :

```sql
-- En tant que régie
-- Tenter supprimer ticket sans mission
DELETE FROM tickets WHERE id = '<ticket_sans_mission>'; -- Doit réussir

-- Tenter supprimer ticket avec mission
DELETE FROM tickets WHERE id = '<ticket_avec_mission>'; -- Doit échouer
```

**Risque** : 🟢 Faible

---

### M14 - Créer trigger sync mission ↔ ticket statut

**Fichier** : `20250126160100_create_trigger_sync_mission_statut.sql`

**Objectif** : Synchroniser automatiquement statuts mission → ticket

**Script** :

```sql
-- M14 - Créer trigger sync mission ↔ ticket
-- ==========================================

CREATE OR REPLACE FUNCTION sync_mission_statut_to_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si mission passe en 'terminee' → ticket 'termine'
  IF NEW.statut = 'terminee' AND OLD.statut != 'terminee' THEN
    UPDATE tickets
    SET statut = 'termine', updated_at = now()
    WHERE id = NEW.ticket_id;
  END IF;

  -- Si mission passe en 'validee' → ticket 'clos'
  IF NEW.statut = 'validee' AND OLD.statut != 'validee' THEN
    UPDATE tickets
    SET statut = 'clos', date_cloture = now(), updated_at = now()
    WHERE id = NEW.ticket_id;
  END IF;

  -- Si mission passe en 'annulee' → ticket 'annule'
  IF NEW.statut = 'annulee' AND OLD.statut != 'annulee' THEN
    UPDATE tickets
    SET statut = 'annule', updated_at = now()
    WHERE id = NEW.ticket_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger AFTER UPDATE
DROP TRIGGER IF EXISTS sync_mission_to_ticket ON missions;
CREATE TRIGGER sync_mission_to_ticket
AFTER UPDATE OF statut ON missions
FOR EACH ROW
EXECUTE FUNCTION sync_mission_statut_to_ticket();

-- Commentaire
COMMENT ON FUNCTION sync_mission_statut_to_ticket IS 'Synchronise automatiquement statut mission → ticket';
```

**Rollback** :

```sql
-- M14 ROLLBACK
DROP TRIGGER IF EXISTS sync_mission_to_ticket ON missions;
DROP FUNCTION IF EXISTS sync_mission_statut_to_ticket();
```

**Validation** :

```sql
SELECT tgname FROM pg_trigger WHERE tgname = 'sync_mission_to_ticket';
```

**Test** :

```sql
-- Créer mission
INSERT INTO missions (ticket_id, entreprise_id, statut) VALUES (..., ..., 'en_cours');

-- Passer mission en 'terminee'
UPDATE missions SET statut = 'terminee' WHERE id = '...';

-- Vérifier ticket passé en 'termine'
SELECT statut FROM tickets WHERE id = '...'; -- Doit être 'termine'
```

**Risque** : 🟢 Faible

---

## 🎨 PHASE 4 - POLIR (Priorité P4)

### M15 - Utiliser ENUM mission_status

**Fichier** : `20250126170000_use_enum_mission_status.sql`

**Objectif** : Remplacer `text` par ENUM pour cohérence

**Script** :

```sql
-- M15 - Utiliser ENUM mission_status
-- ===================================

-- Modifier colonne statut : text → mission_status
ALTER TABLE missions
ALTER COLUMN statut TYPE mission_status
USING statut::mission_status;

-- Supprimer contrainte CHECK devenue inutile
ALTER TABLE missions
DROP CONSTRAINT IF EXISTS missions_statut_check;

-- Commentaire
COMMENT ON COLUMN missions.statut IS 'Statut de la mission (ENUM mission_status)';
```

**Rollback** :

```sql
-- M15 ROLLBACK
ALTER TABLE missions
ALTER COLUMN statut TYPE text
USING statut::text;

-- Recréer contrainte CHECK
ALTER TABLE missions
ADD CONSTRAINT missions_statut_check
CHECK (statut IN ('en_attente', 'en_cours', 'terminee', 'validee', 'annulee'));
```

**Validation** :

```sql
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'missions' AND column_name = 'statut';
```

**Test** :

```sql
-- Tester valeurs ENUM
UPDATE missions SET statut = 'en_cours' WHERE id = '...'; -- OK
UPDATE missions SET statut = 'invalide' WHERE id = '...'; -- Doit échouer
```

**Risque** : 🟢 Faible

---

### M16 - Ajouter contrainte longueur titre

**Fichier** : `20250126170100_add_titre_length_constraint.sql`

**Objectif** : Limiter titre à 255 caractères

**Script** :

```sql
-- M16 - Ajouter contrainte longueur titre
-- ========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_titre_max_length'
  ) THEN
    ALTER TABLE tickets
    ADD CONSTRAINT check_titre_max_length
    CHECK (char_length(titre) <= 255);
  END IF;
END $$;

-- Commentaire
COMMENT ON CONSTRAINT check_titre_max_length ON tickets
IS 'Limite le titre à 255 caractères maximum';
```

**Rollback** :

```sql
-- M16 ROLLBACK
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_titre_max_length;
```

**Validation** :

```sql
SELECT conname FROM pg_constraint WHERE conname = 'check_titre_max_length';
```

**Test** :

```sql
-- Test titre long
INSERT INTO tickets (titre, ...) VALUES (repeat('a', 256), ...); -- Doit échouer
INSERT INTO tickets (titre, ...) VALUES (repeat('a', 255), ...); -- Doit réussir
```

**Risque** : 🟢 Faible

---

## 📊 RÉCAPITULATIF MIGRATIONS

### Vue d'ensemble

| # | Migration | Phase | Risque | Durée | Réversible |
|---|-----------|-------|--------|-------|------------|
| M01 | Ajouter colonnes budget | 1 | 🟢 | 2 min | ✅ |
| M02 | Ajouter mode_diffusion | 1 | 🟢 | 2 min | ✅ |
| M03 | Créer RPC update_ticket_statut | 1 | 🟡 | 3 min | ✅ |
| M04 | Créer RPC diffuser_ticket | 1 | 🟡 | 3 min | ✅ |
| M05 | Corriger RPC accept | 1 | 🟡 | 3 min | ✅ |
| M06 | Corriger vue | 1 | 🟡 | 2 min | ✅ |
| M07 | Corriger policy RLS | 1 | 🟡 | 2 min | ✅ |
| M08 | Ajouter classification | 2 | 🟢 | 3 min | ✅ |
| M09 | Créer table disponibilités | 2 | 🟢 | 3 min | ✅ |
| M10 | Trigger validation 3 créneaux | 2 | 🟢 | 2 min | ✅ |
| M11 | Devise missions | 2 | 🟢 | 2 min | ✅ |
| M12 | Corriger API (doc) | 3 | 🟢 | 5 min | ✅ |
| M13 | Restreindre DELETE | 3 | 🟢 | 2 min | ✅ |
| M14 | Trigger sync mission | 3 | 🟢 | 2 min | ✅ |
| M15 | ENUM mission_status | 4 | 🟢 | 2 min | ✅ |
| M16 | Longueur titre | 4 | 🟢 | 1 min | ✅ |

**Total** : 16 migrations | ~40 min | Toutes réversibles ✅

---

## ✅ CHECKLIST AVANT APPLICATION

### Pré-requis

- [ ] Backup complet base de données
- [ ] Tests locaux passés (dev container)
- [ ] Branches Git séparées par phase
- [ ] Vercel Preview Deployment activé
- [ ] Notifications équipe préparées

### Validation après chaque migration

- [ ] Migration appliquée sans erreur SQL
- [ ] Rollback testé (dry-run)
- [ ] Tests API endpoints OK
- [ ] RLS policies fonctionnent (tests multi-rôles)
- [ ] Logs Supabase sans erreur
- [ ] Performances acceptables (EXPLAIN ANALYZE)

### Validation finale

- [ ] Workflow complet E2E fonctionne
- [ ] 19 gaps résolus (voir GAP_ANALYSIS)
- [ ] Audit conformité passé (checklist spec)
- [ ] Documentation à jour
- [ ] Monitoring activé

---

**FIN DU PLAN DE MIGRATION**

**Prochaine étape** : Générer fichiers SQL exécutables dans `supabase/migrations/`
