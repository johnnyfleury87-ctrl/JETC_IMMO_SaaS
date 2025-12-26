# 🛡️ PROCÉDURE SAFE APPLY - MIGRATIONS TICKETS

**Date** : 26 décembre 2025  
**Objectif** : Appliquer migrations SANS CASSER la production  
**Principe** : Backup → Vérif → Migrate → Test → GO/NO-GO → Rollback si erreur

---

## 🎯 OBJECTIF

Ce document définit **EXACTEMENT** comment appliquer les migrations en toute sécurité, avec points de contrôle après chaque étape et procédures de rollback immédiat en cas d'erreur.

**Règle d'or** : En cas de doute → STOP → Rollback → Analyse

---

## 📋 PRÉ-REQUIS OBLIGATOIRES

### ✅ CHECKLIST AVANT DÉMARRAGE

Cocher **TOUTES** les cases avant de commencer :

#### 1. Backup base de données

- [ ] **Backup complet Supabase** effectué
  - Méthode : Dashboard Supabase → Database → Backups → Create backup
  - OU : `pg_dump` manuel avec export complet
  - Fichier sauvegardé : `jetc_immo_backup_YYYYMMDD_HHMMSS.sql`
  - Taille fichier vérifiée : > 0 bytes
  - Backup testé : Restauration test sur base locale OK

- [ ] **Backup fichiers SQL actuels** (supabase/schema/)
  - Commit Git avec message : `[BACKUP] État avant migrations tickets YYYYMMDD`
  - Tag Git créé : `pre-migration-tickets-v1`
  - Push effectué sur remote

#### 2. Environnements

- [ ] **Environnement local** prêt
  - Dev container Supabase démarré
  - Base locale accessible via `psql`
  - Variables d'environnement chargées (`.env.local`)

- [ ] **Environnement staging** disponible (optionnel mais recommandé)
  - Preview deployment Vercel créé
  - Base Supabase staging configurée
  - URL staging accessible

- [ ] **Environnement production** identifié
  - URL production connue
  - Accès Supabase SQL Editor vérifié
  - Permissions admin confirmées

#### 3. Vérifications techniques

- [ ] **RLS activées** sur toutes tables
  - Query : `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('tickets', 'missions', 'entreprises', 'regies_entreprises')`
  - Résultat attendu : `rowsecurity = true` pour toutes

- [ ] **Pas de migrations en cours**
  - Aucun fichier `.lock` dans `supabase/migrations/`
  - Aucune transaction bloquante : `SELECT * FROM pg_stat_activity WHERE state = 'active' AND query LIKE '%ALTER TABLE%'` → 0 ligne

- [ ] **Trafic utilisateurs faible** (si prod)
  - Plage horaire : entre 2h et 5h du matin (Europe)
  - OU : Mode maintenance activé

- [ ] **Plan de tests validé**
  - Document [TEST_PLAN_TICKETS.md](TEST_PLAN_TICKETS.md) lu
  - Tests P0 identifiés (18 tests critiques)

#### 4. Équipe

- [ ] **Personne responsable** identifiée
  - Nom : _______________
  - Contact : _______________
  - Disponibilité : 2h minimum

- [ ] **Support technique** joignable
  - Contact Supabase : oui/non
  - Contact développeur senior : oui/non

#### 5. Communication

- [ ] **Notification équipe** envoyée
  - Message : "Migrations tickets en cours, monitoring actif"
  - Canal : Slack / Email / Autre

- [ ] **Logs monitoring** configuré
  - Dashboard Supabase ouvert (Logs → Database)
  - Terminal logs API Vercel ouvert

---

## 🔄 ORDRE D'EXÉCUTION STRICT

### Principe général

**Appliquer migrations dans l'ordre EXACT défini ci-dessous.**

**Après CHAQUE migration** :
1. Exécuter points de contrôle
2. Décision GO / NO-GO
3. Si NO-GO → Rollback immédiat

---

## 🚀 PHASE 1 - DÉBLOQUER WORKFLOW (Priorité Critique)

**Objectif** : Corriger bugs bloquants workflow tickets

**Durée estimée** : 30 minutes

**Risque** : 🟡 Moyen (modifications RLS + RPC)

---

### M01 - Ajouter colonnes budget sur tickets

**Fichier source** : [MIGRATION_PLAN_TICKETS.md](MIGRATION_PLAN_TICKETS.md) section M01

**Script SQL** :
```sql
-- M01 - Ajouter colonnes budget sur tickets
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS plafond_intervention_chf numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS devise text NOT NULL DEFAULT 'CHF';

-- Contraintes + Index
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_plafond_positif') THEN
    ALTER TABLE tickets ADD CONSTRAINT check_plafond_positif CHECK (plafond_intervention_chf >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_devise_chf') THEN
    ALTER TABLE tickets ADD CONSTRAINT check_devise_chf CHECK (devise = 'CHF');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tickets_plafond ON tickets(plafond_intervention_chf) WHERE plafond_intervention_chf > 0;
```

**Points de contrôle** :

1. **Vérifier colonnes créées** :
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'tickets'
AND column_name IN ('plafond_intervention_chf', 'devise');
```
**Résultat attendu** :
```
column_name                 | data_type | is_nullable | column_default
----------------------------|-----------|-------------|---------------
plafond_intervention_chf    | numeric   | NO          | 0
devise                      | text      | NO          | 'CHF'
```

2. **Vérifier contraintes** :
```sql
SELECT conname FROM pg_constraint WHERE conname IN ('check_plafond_positif', 'check_devise_chf');
```
**Résultat attendu** : 2 lignes (les 2 contraintes)

3. **Vérifier index** :
```sql
SELECT indexname FROM pg_indexes WHERE indexname = 'idx_tickets_plafond';
```
**Résultat attendu** : 1 ligne

4. **Test INSERT** :
```sql
-- Test valeur valide
INSERT INTO tickets (titre, description, categorie, priorite, locataire_id, logement_id, plafond_intervention_chf)
VALUES ('Test M01', 'Test', 'plomberie', 'normale', 
  (SELECT id FROM locataires LIMIT 1), 
  (SELECT id FROM logements LIMIT 1), 
  100.00)
RETURNING id;

-- Vérifier insertion
SELECT plafond_intervention_chf, devise FROM tickets WHERE titre = 'Test M01';
-- Attendu : (100.00, 'CHF')

-- Nettoyer
DELETE FROM tickets WHERE titre = 'Test M01';
```

5. **Test contrainte plafond négatif** :
```sql
-- Doit échouer
INSERT INTO tickets (..., plafond_intervention_chf) VALUES (..., -10); 
-- Attendu : ERROR: new row violates check constraint "check_plafond_positif"
```

**Décision GO / NO-GO** :

| Condition | Statut | Action si NON |
|-----------|--------|---------------|
| Colonnes créées (point 1) | ☐ OUI ☐ NON | ROLLBACK M01 |
| Contraintes créées (point 2) | ☐ OUI ☐ NON | ROLLBACK M01 |
| Index créé (point 3) | ☐ OUI ☐ NON | ROLLBACK M01 |
| Test INSERT OK (point 4) | ☐ OUI ☐ NON | ROLLBACK M01 |
| Contrainte négative OK (point 5) | ☐ OUI ☐ NON | ROLLBACK M01 |

**✅ GO** : Toutes conditions OUI → Continuer M02  
**❌ NO-GO** : Au moins 1 NON → Exécuter rollback M01

**Rollback M01** :
```sql
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_plafond_positif;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_devise_chf;
DROP INDEX IF EXISTS idx_tickets_plafond;
ALTER TABLE tickets DROP COLUMN IF EXISTS plafond_intervention_chf;
ALTER TABLE tickets DROP COLUMN IF EXISTS devise;
```

**Après rollback** : Vérifier retour état initial puis STOP missions.

---

### M02 - Ajouter colonne mode_diffusion

**Script SQL** :
```sql
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS mode_diffusion text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_mode_diffusion') THEN
    ALTER TABLE tickets ADD CONSTRAINT check_mode_diffusion 
    CHECK (mode_diffusion IS NULL OR mode_diffusion IN ('public', 'assigné'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tickets_mode_diffusion ON tickets(mode_diffusion) WHERE mode_diffusion IS NOT NULL;
```

**Points de contrôle** :

1. **Vérifier colonne** :
```sql
SELECT column_name, is_nullable FROM information_schema.columns 
WHERE table_name = 'tickets' AND column_name = 'mode_diffusion';
```
**Attendu** : 1 ligne, `is_nullable = YES`

2. **Test valeurs autorisées** :
```sql
UPDATE tickets SET mode_diffusion = 'public' WHERE id = (SELECT id FROM tickets LIMIT 1); -- OK
UPDATE tickets SET mode_diffusion = 'assigné' WHERE id = (SELECT id FROM tickets LIMIT 1); -- OK
UPDATE tickets SET mode_diffusion = 'invalide' WHERE id = (SELECT id FROM tickets LIMIT 1); -- Doit échouer
```

**Décision GO / NO-GO** :

| Condition | Statut | Action si NON |
|-----------|--------|---------------|
| Colonne créée | ☐ OUI ☐ NON | ROLLBACK M02 puis M01 |
| Contrainte fonctionne | ☐ OUI ☐ NON | ROLLBACK M02 puis M01 |

**✅ GO** → Continuer M03  
**❌ NO-GO** → Rollback M02 puis M01

**Rollback M02** :
```sql
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_mode_diffusion;
DROP INDEX IF EXISTS idx_tickets_mode_diffusion;
ALTER TABLE tickets DROP COLUMN IF EXISTS mode_diffusion;
```

---

### M03 - Créer RPC update_ticket_statut

**Script SQL** :
```sql
CREATE OR REPLACE FUNCTION update_ticket_statut(
  p_ticket_id uuid,
  p_nouveau_statut ticket_status
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_statut_actuel ticket_status;
  v_user_role text;
BEGIN
  SELECT statut INTO v_statut_actuel FROM tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket % non trouvé', p_ticket_id; END IF;

  SELECT (SELECT role FROM profiles WHERE id = auth.uid()) INTO v_user_role;

  IF v_statut_actuel = p_nouveau_statut THEN RETURN; END IF;

  IF v_statut_actuel = 'nouveau' AND p_nouveau_statut = 'ouvert' AND v_user_role = 'regie' THEN
    -- OK
  ELSIF v_statut_actuel = 'ouvert' AND p_nouveau_statut = 'en_attente' AND v_user_role = 'regie' THEN
    -- OK
  ELSIF v_statut_actuel = 'en_attente' AND p_nouveau_statut = 'en_cours' THEN
    -- OK
  ELSIF v_statut_actuel = 'en_cours' AND p_nouveau_statut = 'termine' THEN
    -- OK
  ELSIF v_statut_actuel = 'termine' AND p_nouveau_statut = 'clos' AND v_user_role = 'regie' THEN
    -- OK
  ELSIF p_nouveau_statut = 'annule' AND v_user_role IN ('regie', 'admin_jtec') THEN
    -- OK
  ELSE
    RAISE EXCEPTION 'Transition interdite : % → % pour rôle %', v_statut_actuel, p_nouveau_statut, v_user_role;
  END IF;

  UPDATE tickets SET statut = p_nouveau_statut, updated_at = now(),
    date_cloture = CASE WHEN p_nouveau_statut = 'clos' THEN now() ELSE date_cloture END
  WHERE id = p_ticket_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_ticket_statut TO authenticated;
```

**Points de contrôle** :

1. **Vérifier fonction créée** :
```sql
SELECT routine_name FROM information_schema.routines WHERE routine_name = 'update_ticket_statut';
```
**Attendu** : 1 ligne

2. **Test transition valide** :
```sql
-- Créer ticket test
INSERT INTO tickets (titre, description, categorie, priorite, locataire_id, logement_id, statut)
VALUES ('Test M03', 'Test', 'plomberie', 'normale', 
  (SELECT id FROM locataires LIMIT 1), 
  (SELECT id FROM logements LIMIT 1), 
  'nouveau')
RETURNING id; -- Noter <test_ticket_id>

-- Test transition nouveau → ouvert (simuler rôle régie)
SELECT update_ticket_statut('<test_ticket_id>', 'ouvert');

-- Vérifier
SELECT statut FROM tickets WHERE id = '<test_ticket_id>';
-- Attendu : 'ouvert'
```

3. **Test transition interdite** :
```sql
-- Tenter transition directe nouveau → clos (doit échouer)
SELECT update_ticket_statut('<test_ticket_id>', 'clos');
-- Attendu : ERROR: Transition interdite
```

4. **Nettoyage** :
```sql
DELETE FROM tickets WHERE titre = 'Test M03';
```

**Décision GO / NO-GO** :

| Condition | Statut | Action si NON |
|-----------|--------|---------------|
| Fonction créée | ☐ OUI ☐ NON | ROLLBACK M03, M02, M01 |
| Transition valide OK | ☐ OUI ☐ NON | ROLLBACK M03, M02, M01 |
| Transition interdite bloquée | ☐ OUI ☐ NON | ROLLBACK M03, M02, M01 |

**✅ GO** → Continuer M04  
**❌ NO-GO** → Rollback M03, M02, M01

**Rollback M03** :
```sql
DROP FUNCTION IF EXISTS update_ticket_statut(uuid, ticket_status);
```

---

### M04 - Créer RPC diffuser_ticket

**Script SQL** : Voir [MIGRATION_PLAN_TICKETS.md](MIGRATION_PLAN_TICKETS.md) M04 (code complet)

**Points de contrôle** :

1. **Fonction créée** :
```sql
SELECT routine_name FROM information_schema.routines WHERE routine_name = 'diffuser_ticket';
```
**Attendu** : 1 ligne

2. **Test diffusion public** :
```sql
-- Préparer ticket
UPDATE tickets SET statut = 'ouvert' WHERE id = '<test_ticket_id>';

-- Diffuser
SELECT diffuser_ticket('<test_ticket_id>', 'public');

-- Vérifier
SELECT statut, mode_diffusion, entreprise_id FROM tickets WHERE id = '<test_ticket_id>';
-- Attendu : ('en_attente', 'public', NULL)
```

3. **Test diffusion assigné sans entreprise_id (doit échouer)** :
```sql
SELECT diffuser_ticket('<test_ticket_id>', 'assigné', NULL);
-- Attendu : ERROR: Mode assigné nécessite entreprise_id
```

**Décision GO / NO-GO** :

| Condition | Statut | Action si NON |
|-----------|--------|---------------|
| Fonction créée | ☐ OUI ☐ NON | ROLLBACK M04→M01 |
| Diffusion public OK | ☐ OUI ☐ NON | ROLLBACK M04→M01 |
| Validation assigné OK | ☐ OUI ☐ NON | ROLLBACK M04→M01 |

**✅ GO** → Continuer M05  
**❌ NO-GO** → Rollback M04→M01

**Rollback M04** :
```sql
DROP FUNCTION IF EXISTS diffuser_ticket(uuid, text, uuid);
```

---

### M05 - Corriger RPC accept_ticket_and_create_mission

**Script SQL** : Voir [MIGRATION_PLAN_TICKETS.md](MIGRATION_PLAN_TICKETS.md) M05 (code complet)

**Points de contrôle** :

1. **Fonction modifiée** :
```sql
SELECT p.proname, pg_catalog.pg_get_function_arguments(p.oid) AS args
FROM pg_proc p WHERE p.proname = 'accept_ticket_and_create_mission';
```
**Attendu** : 1 ligne avec 2 arguments (uuid, uuid)

2. **Test acceptation mode public** :
```sql
-- Préparer ticket diffusé public
-- (Ticket déjà en 'en_attente', mode_diffusion='public' après M04)

-- Accepter
SELECT accept_ticket_and_create_mission('<test_ticket_id>', '<entreprise_id>');

-- Vérifier
SELECT statut, entreprise_id, locked_at FROM tickets WHERE id = '<test_ticket_id>';
-- Attendu : ('en_cours', <entreprise_id>, <timestamp>)

SELECT COUNT(*) FROM missions WHERE ticket_id = '<test_ticket_id>';
-- Attendu : 1
```

3. **Test acceptation déjà verrouillé (doit échouer)** :
```sql
SELECT accept_ticket_and_create_mission('<test_ticket_id>', '<autre_entreprise_id>');
-- Attendu : ERROR: Ticket déjà verrouillé
```

**Décision GO / NO-GO** :

| Condition | Statut | Action si NON |
|-----------|--------|---------------|
| Fonction modifiée | ☐ OUI ☐ NON | ROLLBACK M05→M01 |
| Acceptation public OK | ☐ OUI ☐ NON | ROLLBACK M05→M01 |
| Anti-doublon fonctionne | ☐ OUI ☐ NON | ROLLBACK M05→M01 |

**✅ GO** → Continuer M06  
**❌ NO-GO** → Rollback M05→M01

**Rollback M05** :
```sql
DROP FUNCTION IF EXISTS accept_ticket_and_create_mission(uuid, uuid);
-- Recréer ancienne version cassée (voir backup)
```

---

### M06 - Corriger vue tickets_visibles_entreprise

**Script SQL** :
```sql
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
    re.mode_diffusion = 'general'
    AND t.mode_diffusion = 'public'
    AND t.statut = 'en_attente'
    AND t.locked_at IS NULL
  )
  OR
  (
    t.mode_diffusion = 'assigné'
    AND t.entreprise_id = re.entreprise_id
    AND t.statut IN ('en_attente', 'en_cours', 'termine')
  )
  OR
  (
    t.entreprise_id = re.entreprise_id
    AND t.statut IN ('en_cours', 'termine', 'clos')
  );

GRANT SELECT ON tickets_visibles_entreprise TO authenticated;
```

**Points de contrôle** :

1. **Vue créée** :
```sql
SELECT table_name FROM information_schema.views WHERE table_name = 'tickets_visibles_entreprise';
```
**Attendu** : 1 ligne

2. **Test visibilité entreprise** :
```sql
-- Créer ticket diffusé public (si pas déjà fait)
-- Vérifier qu'entreprise autorisée le voit
SELECT COUNT(*) FROM tickets_visibles_entreprise 
WHERE id = '<test_ticket_id>' 
AND visible_par_entreprise_id = '<entreprise_autorisee_id>';
-- Attendu : 1

-- Vérifier qu'entreprise NON autorisée ne le voit pas
SELECT COUNT(*) FROM tickets_visibles_entreprise 
WHERE id = '<test_ticket_id>' 
AND visible_par_entreprise_id = '<entreprise_non_autorisee_id>';
-- Attendu : 0
```

**Décision GO / NO-GO** :

| Condition | Statut | Action si NON |
|-----------|--------|---------------|
| Vue créée | ☐ OUI ☐ NON | ROLLBACK M06→M01 |
| Visibilité correcte | ☐ OUI ☐ NON | ROLLBACK M06→M01 |

**✅ GO** → Continuer M07  
**❌ NO-GO** → Rollback M06→M01

**Rollback M06** :
```sql
DROP VIEW IF EXISTS tickets_visibles_entreprise CASCADE;
-- Recréer ancienne version (voir backup)
```

---

### M07 - Corriger policy RLS entreprise sur tickets

**Script SQL** :
```sql
DROP POLICY IF EXISTS "Entreprise can view authorized tickets" ON tickets;

CREATE POLICY "Entreprise can view authorized tickets"
ON tickets FOR SELECT TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'entreprise'
  AND
  (
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
    (
      mode_diffusion = 'assigné'
      AND entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())
      AND statut IN ('en_attente', 'en_cours', 'termine')
    )
    OR
    (
      entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())
      AND statut IN ('en_cours', 'termine', 'clos')
    )
  )
);
```

**Points de contrôle** :

1. **Policy créée** :
```sql
SELECT policyname FROM pg_policies 
WHERE tablename = 'tickets' 
AND policyname = 'Entreprise can view authorized tickets';
```
**Attendu** : 1 ligne

2. **Test RLS isolation** :
```sql
-- Simuler entreprise autorisée (nécessite pg_set_jwt ou test via API)
-- Vérifier SELECT retourne tickets visibles uniquement
```

**Décision GO / NO-GO** :

| Condition | Statut | Action si NON |
|-----------|--------|---------------|
| Policy créée | ☐ OUI ☐ NON | ROLLBACK M07→M01 |
| RLS fonctionne (test API) | ☐ OUI ☐ NON | ROLLBACK M07→M01 |

**✅ GO** → FIN PHASE 1, passer PHASE 2  
**❌ NO-GO** → Rollback M07→M01

**Rollback M07** :
```sql
DROP POLICY IF EXISTS "Entreprise can view authorized tickets" ON tickets;
-- Recréer ancienne policy (voir backup)
```

---

## ✅ CHECKPOINT PHASE 1 COMPLÈTE

**Avant de continuer Phase 2, vérifier** :

- [ ] Toutes migrations M01-M07 appliquées avec succès
- [ ] Aucun rollback effectué
- [ ] Tests points de contrôle tous OK
- [ ] Logs Supabase sans erreur
- [ ] API endpoints répondent (si staging/prod)

**Test E2E minimal** :

1. Créer ticket via API `POST /api/tickets/create`
2. Valider ticket (régie)
3. Diffuser ticket `POST /api/tickets/diffuser`
4. Vérifier entreprises voient ticket `GET /api/tickets/entreprise`
5. Accepter ticket `POST /api/tickets/accept`

**Résultat attendu** : Workflow fonctionne sans erreur SQL.

**Si test échoue** : STOP, analyser logs, potentiellement rollback complet Phase 1.

---

## 🟢 PHASE 2 - ENRICHIR FONCTIONNALITÉS (Priorité Normale)

**Objectif** : Ajouter colonnes spec (sous_categorie, piece, disponibilités)

**Durée estimée** : 45 minutes

**Risque** : 🟢 Faible (ajouts colonnes, pas de modif existantes)

---

### M08 - Ajouter colonnes classification

**Script SQL** : Voir [MIGRATION_PLAN_TICKETS.md](MIGRATION_PLAN_TICKETS.md) M08

**Points de contrôle** :

1. **Colonnes créées** :
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'tickets' 
AND column_name IN ('sous_categorie', 'piece');
```
**Attendu** : 2 lignes

2. **Contraintes CHECK** :
```sql
SELECT conname FROM pg_constraint 
WHERE conname IN ('check_sous_categorie_valide', 'check_piece_valide');
```
**Attendu** : 2 lignes

**Décision GO / NO-GO** :

| Condition | Statut | Action si NON |
|-----------|--------|---------------|
| Colonnes créées | ☐ OUI ☐ NON | ROLLBACK M08 |
| Contraintes OK | ☐ OUI ☐ NON | ROLLBACK M08 |

**✅ GO** → Continuer M09  
**❌ NO-GO** → Rollback M08

---

### M09 - Créer table tickets_disponibilites

**Script SQL** : Voir [MIGRATION_PLAN_TICKETS.md](MIGRATION_PLAN_TICKETS.md) M09

**Points de contrôle** :

1. **Table créée** :
```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'tickets_disponibilites';
```
**Attendu** : 1 ligne

2. **Contraintes créées** :
```sql
SELECT conname FROM pg_constraint WHERE conrelid = 'tickets_disponibilites'::regclass;
```
**Attendu** : Au moins 5 contraintes (CHECK + UNIQUE + EXCLUDE + FK)

3. **Test insertion 3 créneaux** :
```sql
INSERT INTO tickets_disponibilites (ticket_id, date_debut, date_fin, preference)
VALUES
  ('<test_ticket_id>', now() + interval '1 day', now() + interval '1 day 3 hours', 1),
  ('<test_ticket_id>', now() + interval '2 days', now() + interval '2 days 3 hours', 2),
  ('<test_ticket_id>', now() + interval '3 days', now() + interval '3 days 3 hours', 3);

-- Vérifier
SELECT COUNT(*) FROM tickets_disponibilites WHERE ticket_id = '<test_ticket_id>';
-- Attendu : 3
```

4. **Test contrainte chevauchement (doit échouer)** :
```sql
INSERT INTO tickets_disponibilites (ticket_id, date_debut, date_fin, preference)
VALUES ('<test_ticket_id>', now() + interval '1 day 1 hour', now() + interval '1 day 4 hours', 4);
-- Attendu : ERROR: conflicting key value violates exclusion constraint
```

**Décision GO / NO-GO** :

| Condition | Statut | Action si NON |
|-----------|--------|---------------|
| Table créée | ☐ OUI ☐ NON | ROLLBACK M09, M08 |
| Contraintes fonctionnent | ☐ OUI ☐ NON | ROLLBACK M09, M08 |
| Test insertion OK | ☐ OUI ☐ NON | ROLLBACK M09, M08 |
| Contrainte exclusion OK | ☐ OUI ☐ NON | ROLLBACK M09, M08 |

**✅ GO** → Continuer M10  
**❌ NO-GO** → Rollback M09, M08

---

### M10 - Créer trigger validation 3 disponibilités

**Script SQL** : Voir [MIGRATION_PLAN_TICKETS.md](MIGRATION_PLAN_TICKETS.md) M10

**Points de contrôle** :

1. **Trigger créé** :
```sql
SELECT tgname FROM pg_trigger WHERE tgname = 'check_disponibilites_before_diffusion';
```
**Attendu** : 1 ligne

2. **Test déclenchement trigger** :
```sql
-- Créer ticket sans disponibilités
INSERT INTO tickets (...) VALUES (...) RETURNING id; -- <new_ticket_id>
UPDATE tickets SET statut = 'ouvert' WHERE id = '<new_ticket_id>';

-- Tenter diffusion (doit échouer)
UPDATE tickets SET statut = 'en_attente' WHERE id = '<new_ticket_id>';
-- Attendu : ERROR: Un ticket doit avoir exactement 3 disponibilités
```

**Décision GO / NO-GO** :

| Condition | Statut | Action si NON |
|-----------|--------|---------------|
| Trigger créé | ☐ OUI ☐ NON | ROLLBACK M10→M08 |
| Validation fonctionne | ☐ OUI ☐ NON | ROLLBACK M10→M08 |

**✅ GO** → Continuer M11  
**❌ NO-GO** → Rollback M10→M08

---

### M11 - Ajouter devise missions + renommer montant

**Script SQL** : Voir [MIGRATION_PLAN_TICKETS.md](MIGRATION_PLAN_TICKETS.md) M11

**Points de contrôle** :

1. **Colonne renommée** :
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'missions' 
AND column_name = 'montant_reel_chf';
```
**Attendu** : 1 ligne

2. **Colonne devise créée** :
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'missions' 
AND column_name = 'devise';
```
**Attendu** : 1 ligne

**Décision GO / NO-GO** :

| Condition | Statut | Action si NON |
|-----------|--------|---------------|
| Renommage OK | ☐ OUI ☐ NON | ROLLBACK M11→M08 |
| Devise créée | ☐ OUI ☐ NON | ROLLBACK M11→M08 |

**✅ GO** → FIN PHASE 2, passer PHASE 3  
**❌ NO-GO** → Rollback M11→M08

---

## 🛡️ PHASE 3 - SÉCURISER (Priorité Sécurité)

**Objectif** : Restreindre RLS DELETE, synchroniser statuts

**Durée estimée** : 15 minutes

**Risque** : 🟢 Faible

---

### M12 - Corriger API create (documentation uniquement)

**⚠️ MODIFICATION CODE API, PAS SQL**

**Fichier** : `api/tickets/create.js`

**Changement** :
```javascript
// AVANT
const { data, error } = await supabaseAdmin.from('tickets').insert({
  statut: 'ouvert', // ❌ À supprimer
  ...
});

// APRÈS
const { data, error } = await supabaseAdmin.from('tickets').insert({
  // statut non spécifié → utilise default SQL 'nouveau' ✅
  ...
});
```

**Points de contrôle** :

1. **Code modifié** :
```bash
grep -n "statut.*ouvert" api/tickets/create.js
# Attendu : Aucune ligne
```

2. **Test création ticket** :
```bash
curl -X POST https://<staging_url>/api/tickets/create \
  -H "Content-Type: application/json" \
  -d '{"titre":"Test statut", ...}'

# Vérifier BDD
SELECT statut FROM tickets WHERE titre = 'Test statut';
# Attendu : 'nouveau'
```

**Décision GO / NO-GO** :

| Condition | Statut | Action si NON |
|-----------|--------|---------------|
| Code modifié | ☐ OUI ☐ NON | Revenir code précédent |
| Test API OK | ☐ OUI ☐ NON | Revenir code précédent |

**✅ GO** → Continuer M13  
**❌ NO-GO** → Git revert

---

### M13 - Restreindre policy DELETE régie

**Script SQL** : Voir [MIGRATION_PLAN_TICKETS.md](MIGRATION_PLAN_TICKETS.md) M13

**Points de contrôle** :

1. **Policies créées** :
```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'tickets' AND policyname LIKE 'Regie%';
```
**Attendu** : 4 lignes (SELECT, INSERT, UPDATE, DELETE)

2. **Test DELETE avec mission (doit échouer)** :
```sql
-- Ticket avec mission
DELETE FROM tickets WHERE id = '<ticket_with_mission>';
-- Attendu : ERROR: policy violation
```

3. **Test DELETE sans mission (doit réussir)** :
```sql
-- Ticket sans mission
DELETE FROM tickets WHERE id = '<ticket_without_mission>';
-- Attendu : 1 row deleted
```

**Décision GO / NO-GO** :

| Condition | Statut | Action si NON |
|-----------|--------|---------------|
| 4 policies créées | ☐ OUI ☐ NON | ROLLBACK M13 |
| DELETE bloqué avec mission | ☐ OUI ☐ NON | ROLLBACK M13 |
| DELETE autorisé sans mission | ☐ OUI ☐ NON | ROLLBACK M13 |

**✅ GO** → Continuer M14  
**❌ NO-GO** → Rollback M13

---

### M14 - Créer trigger sync mission ↔ ticket

**Script SQL** : Voir [MIGRATION_PLAN_TICKETS.md](MIGRATION_PLAN_TICKETS.md) M14

**Points de contrôle** :

1. **Trigger créé** :
```sql
SELECT tgname FROM pg_trigger WHERE tgname = 'sync_mission_to_ticket';
```
**Attendu** : 1 ligne

2. **Test synchronisation** :
```sql
-- Créer mission en 'en_cours'
INSERT INTO missions (ticket_id, entreprise_id, statut) VALUES (..., ..., 'en_cours');

-- Passer en 'terminee'
UPDATE missions SET statut = 'terminee' WHERE id = '<mission_id>';

-- Vérifier ticket synchronisé
SELECT statut FROM tickets WHERE id = '<ticket_id>';
-- Attendu : 'termine'
```

**Décision GO / NO-GO** :

| Condition | Statut | Action si NON |
|-----------|--------|---------------|
| Trigger créé | ☐ OUI ☐ NON | ROLLBACK M14→M13 |
| Sync fonctionne | ☐ OUI ☐ NON | ROLLBACK M14→M13 |

**✅ GO** → FIN PHASE 3, passer PHASE 4  
**❌ NO-GO** → Rollback M14→M13

---

## 🎨 PHASE 4 - POLIR (Priorité Faible - Optionnel)

**Objectif** : Utiliser ENUM mission_status, contrainte longueur titre

**Durée estimée** : 10 minutes

**Risque** : 🟢 Très faible

---

### M15 - Utiliser ENUM mission_status

**Script SQL** : Voir [MIGRATION_PLAN_TICKETS.md](MIGRATION_PLAN_TICKETS.md) M15

**Points de contrôle** :

1. **Colonne modifiée** :
```sql
SELECT data_type, udt_name FROM information_schema.columns 
WHERE table_name = 'missions' AND column_name = 'statut';
```
**Attendu** : `data_type = USER-DEFINED`, `udt_name = mission_status`

**Décision GO / NO-GO** :

| Condition | Statut | Action si NON |
|-----------|--------|---------------|
| Type ENUM appliqué | ☐ OUI ☐ NON | ROLLBACK M15 |

**✅ GO** → Continuer M16  
**❌ NO-GO** → Rollback M15

---

### M16 - Ajouter contrainte longueur titre

**Script SQL** : Voir [MIGRATION_PLAN_TICKETS.md](MIGRATION_PLAN_TICKETS.md) M16

**Points de contrôle** :

1. **Contrainte créée** :
```sql
SELECT conname FROM pg_constraint WHERE conname = 'check_titre_max_length';
```
**Attendu** : 1 ligne

2. **Test contrainte** :
```sql
INSERT INTO tickets (titre, ...) VALUES (repeat('a', 256), ...);
-- Attendu : ERROR: check constraint violated
```

**Décision GO / NO-GO** :

| Condition | Statut | Action si NON |
|-----------|--------|---------------|
| Contrainte créée | ☐ OUI ☐ NON | ROLLBACK M16 |
| Test OK | ☐ OUI ☐ NON | ROLLBACK M16 |

**✅ GO** → FIN TOUTES MIGRATIONS  
**❌ NO-GO** → Rollback M16

---

## ✅ VALIDATION FINALE

**Après toutes migrations appliquées** :

### 1. Exécuter tests P0 (TEST_PLAN_TICKETS.md)

Minimum obligatoire :
- [ ] TEST A01 - Création ticket locataire
- [ ] TEST A03 - Diffusion public
- [ ] TEST A04 - Acceptation entreprise
- [ ] TEST C02 - Anti-doublon acceptation
- [ ] TEST D03 - RLS entreprise modes diffusion

### 2. Vérifier logs Supabase

```sql
-- Pas d'erreurs récentes
SELECT * FROM pg_stat_statements WHERE query LIKE '%ERROR%' AND calls > 0;
-- Attendu : 0 ligne
```

### 3. Smoke test API endpoints

```bash
# Test création
curl -X POST /api/tickets/create -d '{...}'

# Test diffusion
curl -X POST /api/tickets/diffuser -d '{...}'

# Test acceptation
curl -X POST /api/tickets/accept -d '{...}'

# Test liste entreprise
curl -X GET /api/tickets/entreprise
```

**Tous endpoints doivent retourner 200 OK sans erreur SQL.**

### 4. Monitoring 1h post-déploiement

- [ ] Logs Supabase surveillés (Database logs)
- [ ] Logs Vercel Functions surveillés
- [ ] Aucune erreur RLS bloquante
- [ ] Aucune régression signalée

---

## 🚨 SIGNAUX D'ALERTE CRITIQUES

### Erreurs STOP immédiat (rollback obligatoire)

| Erreur | Signification | Action |
|--------|---------------|--------|
| `ERROR: column "X" does not exist` | Migration incomplète | ROLLBACK migration concernée |
| `ERROR: relation "X" does not exist` | Table/vue manquante | ROLLBACK migration concernée |
| `ERROR: function "X" does not exist` | RPC manquante | ROLLBACK migration concernée |
| `ERROR: duplicate key value violates unique constraint` | Doublon non géré | Analyser données, potentiellement rollback |
| `ERROR: permission denied for relation X` | RLS bloquante | ROLLBACK migration RLS concernée |

### Erreurs surveillance (analyse requise)

| Erreur | Signification | Action |
|--------|---------------|--------|
| `EXCEPTION: Transition interdite` | Workflow bloqué | Vérifier RPC update_ticket_statut |
| `EXCEPTION: Ticket déjà verrouillé` | Concurrence normale | Aucune (comportement attendu) |
| `EXCEPTION: Entreprise non autorisée` | Tentative accès illégitime | Vérifier RLS |
| `ERROR: new row violates check constraint` | Données invalides | Vérifier formulaires frontend |

### Seuils performance

| Métrique | Seuil alerte | Seuil critique | Action |
|----------|--------------|----------------|--------|
| Temps réponse vue `tickets_visibles_entreprise` | > 500ms | > 1s | Vérifier index, potentiellement EXPLAIN ANALYZE |
| Nombre erreurs SQL / minute | > 5 | > 20 | ROLLBACK si erreurs liées migrations |
| Taux erreur API endpoints | > 1% | > 5% | Vérifier logs, potentiellement ROLLBACK |

---

## 📊 MATRICE DÉCISION ROLLBACK

| Situation | Rollback Phase 1 | Rollback Phase 2 | Rollback Phase 3 | Rollback Phase 4 |
|-----------|------------------|------------------|------------------|------------------|
| **Erreur M01-M07** | ✅ OUI | ❌ NON (pas appliquée) | ❌ NON | ❌ NON |
| **Erreur M08-M11** | ❌ NON (déjà OK) | ✅ OUI | ❌ NON | ❌ NON |
| **Erreur M13-M14** | ❌ NON | ❌ NON | ✅ OUI | ❌ NON |
| **Erreur M15-M16** | ❌ NON | ❌ NON | ❌ NON | ✅ OUI |
| **Tests P0 échouent après tout** | ✅ OUI (complet) | ✅ OUI (complet) | ✅ OUI (complet) | ✅ OUI (complet) |

---

## 🔄 PROCÉDURE ROLLBACK COMPLET

**En cas d'échec critique après toutes migrations** :

### Étape 1 - STOP immédiat

1. Activer mode maintenance (si prod)
2. Noter dernière migration appliquée : M__
3. Capturer logs erreurs

### Étape 2 - Rollback dans ordre inverse

**Ordre STRICT** : M16 → M15 → M14 → M13 → M11 → M10 → M09 → M08 → M07 → M06 → M05 → M04 → M03 → M02 → M01

Pour chaque migration :
```sql
-- Exécuter script rollback correspondant
-- Vérifier retour état précédent
-- Passer migration suivante
```

### Étape 3 - Restauration backup (dernier recours)

```sql
-- Restaurer dump complet
psql -U postgres -d jetc_immo < jetc_immo_backup_YYYYMMDD_HHMMSS.sql
```

### Étape 4 - Vérification post-rollback

1. Tests P0 doivent passer (avec comportement ancien/cassé attendu)
2. API fonctionnelle (même si bugs connus)
3. Aucune perte données utilisateurs

### Étape 5 - Post-mortem

1. Analyser cause échec
2. Documenter dans incident report
3. Corriger migrations avant nouvelle tentative

---

## 📝 CHECKLIST POST-DÉPLOIEMENT

**24h après déploiement prod** :

- [ ] Aucune erreur SQL critique en logs
- [ ] Workflow tickets fonctionne (au moins 1 ticket E2E complet)
- [ ] Aucune plainte utilisateurs
- [ ] Performances acceptables (< 1s API responses)
- [ ] Monitoring dashboard vert

**Si toutes cases cochées** : ✅ Déploiement VALIDÉ

**Sinon** : Analyser, potentiellement rollback si régression majeure.

---

## 🎯 RÉSUMÉ PROCÉDURE

### Ordre général

1. **Pré-requis** : Backup + Vérifications + Équipe prête
2. **Phase 1** : M01→M07 (workflow critique)
3. **Checkpoint Phase 1** : Tests E2E minimal
4. **Phase 2** : M08→M11 (enrichissements)
5. **Phase 3** : M12→M14 (sécurité)
6. **Phase 4** : M15→M16 (polissage, optionnel)
7. **Validation finale** : Tests P0 complets
8. **Monitoring** : 1h puis 24h

### Règles d'or

- ✅ **GO** uniquement si TOUS points de contrôle OK
- ❌ **NO-GO** si AU MOINS 1 point échoue → Rollback immédiat
- 🛑 **STOP** si erreur critique → Rollback complet + Analyse

---

**FIN DE LA PROCÉDURE SAFE APPLY**

**Prochaine étape (SI VALIDÉE)** : Génération fichiers SQL exécutables (ÉTAPE 5)
