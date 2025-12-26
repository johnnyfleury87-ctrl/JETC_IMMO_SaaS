-- ============================================================
-- MIGRATION M09 - Créer table tickets_disponibilites
-- ============================================================
-- Date: 2025-12-26
-- Phase: 2 (Enrichissement fonctionnel)
-- Objectif: Créer table pour gérer 3 créneaux disponibilité locataire par ticket
-- Dépendances: PHASE 1 complète (M01-M07)
-- Rollback: 20251226170800_m09_create_tickets_disponibilites_rollback.sql
-- ============================================================

-- Activer extension btree_gist pour contrainte EXCLUDE temporelle
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Créer table tickets_disponibilites
CREATE TABLE IF NOT EXISTS tickets_disponibilites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  date_debut timestamptz NOT NULL,
  date_fin timestamptz NOT NULL,
  preference integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Contrainte : date_fin > date_debut
  CONSTRAINT check_date_fin_apres_debut CHECK (date_fin > date_debut),
  
  -- Contrainte : preference entre 1 et 3
  CONSTRAINT check_preference_valide CHECK (preference BETWEEN 1 AND 3),
  
  -- Contrainte : Un seul créneau par (ticket_id, preference)
  CONSTRAINT unique_ticket_preference UNIQUE (ticket_id, preference),
  
  -- Contrainte EXCLUDE : Empêcher chevauchement temporel pour même ticket
  CONSTRAINT exclude_chevauchement_disponibilites 
  EXCLUDE USING gist (
    ticket_id WITH =, 
    tstzrange(date_debut, date_fin) WITH &&
  )
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_disponibilites_ticket_id 
ON tickets_disponibilites(ticket_id);

CREATE INDEX IF NOT EXISTS idx_disponibilites_dates 
ON tickets_disponibilites(date_debut, date_fin);

-- RLS : Activer Row Level Security
ALTER TABLE tickets_disponibilites ENABLE ROW LEVEL SECURITY;

-- Policy : Locataire voit uniquement créneaux de SES tickets
CREATE POLICY "Locataire can view own disponibilites"
ON tickets_disponibilites FOR SELECT TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'locataire'
  AND ticket_id IN (
    SELECT id FROM tickets 
    WHERE locataire_id = (SELECT id FROM locataires WHERE profile_id = auth.uid())
  )
);

-- Policy : Régie voit créneaux tickets de SES immeubles
CREATE POLICY "Regie can view disponibilites"
ON tickets_disponibilites FOR SELECT TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('regie', 'admin_jtec')
  AND ticket_id IN (
    SELECT id FROM tickets 
    WHERE regie_id = (
      SELECT regie_id FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'regie'
    )
  )
);

-- Policy : Entreprise voit créneaux tickets visibles (diffusés)
CREATE POLICY "Entreprise can view disponibilites for visible tickets"
ON tickets_disponibilites FOR SELECT TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'entreprise'
  AND ticket_id IN (
    SELECT id FROM tickets_visibles_entreprise 
    WHERE visible_par_entreprise_id = (
      SELECT id FROM entreprises WHERE profile_id = auth.uid()
    )
  )
);

-- Policy : Locataire peut créer créneaux pour SES tickets
CREATE POLICY "Locataire can insert disponibilites"
ON tickets_disponibilites FOR INSERT TO authenticated
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'locataire'
  AND ticket_id IN (
    SELECT id FROM tickets 
    WHERE locataire_id = (SELECT id FROM locataires WHERE profile_id = auth.uid())
  )
);

-- Policy : Locataire peut modifier créneaux de SES tickets
CREATE POLICY "Locataire can update disponibilites"
ON tickets_disponibilites FOR UPDATE TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'locataire'
  AND ticket_id IN (
    SELECT id FROM tickets 
    WHERE locataire_id = (SELECT id FROM locataires WHERE profile_id = auth.uid())
  )
);

-- Policy : Locataire peut supprimer créneaux de SES tickets
CREATE POLICY "Locataire can delete disponibilites"
ON tickets_disponibilites FOR DELETE TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'locataire'
  AND ticket_id IN (
    SELECT id FROM tickets 
    WHERE locataire_id = (SELECT id FROM locataires WHERE profile_id = auth.uid())
  )
);

-- ============================================================
-- VALIDATION QUERIES (à exécuter après migration)
-- ============================================================

-- VALIDATION 1: Vérifier table créée
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name = 'tickets_disponibilites';
-- Attendu: 1 ligne

-- VALIDATION 2: Vérifier colonnes
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'tickets_disponibilites';
-- Attendu: 6 colonnes (id, ticket_id, date_debut, date_fin, preference, created_at)

-- VALIDATION 3: Vérifier contraintes
-- SELECT conname FROM pg_constraint 
-- WHERE conrelid = 'tickets_disponibilites'::regclass;
-- Attendu: Au moins 5 contraintes (PK, FK, 2 CHECK, UNIQUE, EXCLUDE)

-- VALIDATION 4: Test insertion 3 créneaux valides (staging uniquement)
-- INSERT INTO tickets_disponibilites (ticket_id, date_debut, date_fin, preference) VALUES
--   ('<ticket_id_test>', now() + interval '1 day', now() + interval '1 day 3 hours', 1),
--   ('<ticket_id_test>', now() + interval '2 days', now() + interval '2 days 3 hours', 2),
--   ('<ticket_id_test>', now() + interval '3 days', now() + interval '3 days 3 hours', 3);
-- Attendu: 3 lignes insérées
-- VALIDATION: SELECT COUNT(*) FROM tickets_disponibilites WHERE ticket_id = '<ticket_id_test>';
-- Attendu: 3
-- CLEANUP: DELETE FROM tickets_disponibilites WHERE ticket_id = '<ticket_id_test>';

-- VALIDATION 5: Test contrainte chevauchement temporel (doit échouer - staging uniquement)
-- Pré-requis: 1 créneau existant (09:00-12:00)
-- INSERT INTO tickets_disponibilites (ticket_id, date_debut, date_fin, preference) 
-- VALUES ('<ticket_id_test>', now() + interval '1 day 1 hour', now() + interval '1 day 4 hours', 1);
-- Attendu: ERROR - conflicting key value violates exclusion constraint "exclude_chevauchement_disponibilites"

-- VALIDATION 6: Test contrainte preference unique (doit échouer - staging uniquement)
-- Pré-requis: preference=1 déjà existante
-- INSERT INTO tickets_disponibilites (ticket_id, date_debut, date_fin, preference) 
-- VALUES ('<ticket_id_test>', now() + interval '5 days', now() + interval '5 days 3 hours', 1);
-- Attendu: ERROR - duplicate key value violates unique constraint "unique_ticket_preference"

-- VALIDATION 7: Test contrainte date_fin > date_debut (doit échouer - staging uniquement)
-- INSERT INTO tickets_disponibilites (ticket_id, date_debut, date_fin, preference) 
-- VALUES ('<ticket_id_test>', now() + interval '1 day', now() + interval '1 day' - interval '1 hour', 1);
-- Attendu: ERROR - new row violates check constraint "check_date_fin_apres_debut"

-- VALIDATION 8: Vérifier RLS activée
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE tablename = 'tickets_disponibilites';
-- Attendu: 1 ligne avec rowsecurity = true

-- VALIDATION 9: Vérifier policies créées
-- SELECT policyname FROM pg_policies 
-- WHERE tablename = 'tickets_disponibilites';
-- Attendu: 6 policies (SELECT locataire/regie/entreprise, INSERT/UPDATE/DELETE locataire)

-- ============================================================
-- FIN MIGRATION M09
-- ============================================================
