-- ============================================================
-- MIGRATION M42: Ajouter colonne disponibilite_id à missions
-- ============================================================
-- Date: 2026-01-04
-- Auteur: Ajout créneau sélectionné dans missions
-- Objectif: Enregistrer quel créneau a été choisi par l'entreprise
-- Dépendances: M09 (table tickets_disponibilites), M41 (RPC acceptation)
-- Rollback: 20260104001800_m42_add_disponibilite_id_missions_rollback.sql
-- ============================================================

-- CONTEXTE:
-- Frontend permet désormais sélection créneau avant acceptation.
-- RPC accept_ticket_and_create_mission reçoit p_disponibilite_id (M41).
-- Besoin: Enregistrer ce créneau dans la mission pour traçabilité.

-- Ajouter colonne disponibilite_id
ALTER TABLE missions
ADD COLUMN IF NOT EXISTS disponibilite_id uuid REFERENCES tickets_disponibilites(id) ON DELETE SET NULL;

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

-- ============================================================
-- FIN MIGRATION M42
-- ============================================================
