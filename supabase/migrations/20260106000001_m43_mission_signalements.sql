-- ============================================================
-- MIGRATION M43 - PARTIE 1 : Table signalements missions
-- ============================================================
-- Date: 2026-01-06
-- Objectif: Permettre aux techniciens de signaler problèmes pendant missions
-- Dépendances: missions (table existante)
-- Rollback: 20260106000001_m43_mission_signalements_rollback.sql
-- ============================================================

-- Table pour signalements pendant missions
CREATE TABLE IF NOT EXISTS mission_signalements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  
  -- Type de signalement
  type_signalement text NOT NULL CHECK (type_signalement IN (
    'probleme_technique',    -- Panne matérielle, outil cassé
    'piece_manquante',       -- Pièce de rechange non disponible
    'situation_dangereuse',  -- Danger pour technicien ou locataire
    'acces_impossible',      -- Impossibilité accéder au lieu intervention
    'autre'                  -- Autre problème
  )),
  
  -- Détails
  description text NOT NULL,
  photos_urls text[] DEFAULT array[]::text[],
  
  -- Traçabilité
  signale_par uuid NOT NULL REFERENCES auth.users(id),
  signale_at timestamptz NOT NULL DEFAULT now(),
  
  -- Résolution
  resolu boolean DEFAULT false,
  resolu_par uuid REFERENCES auth.users(id),
  resolu_at timestamptz,
  resolution_commentaire text,
  
  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_mission_signalements_mission_id 
  ON mission_signalements(mission_id);

CREATE INDEX IF NOT EXISTS idx_mission_signalements_type 
  ON mission_signalements(type_signalement);

CREATE INDEX IF NOT EXISTS idx_mission_signalements_resolu 
  ON mission_signalements(resolu) 
  WHERE resolu = false;

CREATE INDEX IF NOT EXISTS idx_mission_signalements_signale_at 
  ON mission_signalements(signale_at);

-- Commentaires
COMMENT ON TABLE mission_signalements IS 
  'Signalements problèmes pendant missions (techniciens)';

COMMENT ON COLUMN mission_signalements.type_signalement IS 
  'Type problème : technique, pièce manquante, danger, accès impossible, autre';

COMMENT ON COLUMN mission_signalements.description IS 
  'Description détaillée du problème rencontré';

COMMENT ON COLUMN mission_signalements.photos_urls IS 
  'URLs photos illustrant le problème (Storage)';

COMMENT ON COLUMN mission_signalements.signale_par IS 
  'Utilisateur ayant signalé (généralement technicien)';

COMMENT ON COLUMN mission_signalements.resolu IS 
  'Problème résolu ou non';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_mission_signalements_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER mission_signalements_updated_at
BEFORE UPDATE ON mission_signalements
FOR EACH ROW
EXECUTE FUNCTION update_mission_signalements_updated_at();

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE mission_signalements ENABLE ROW LEVEL SECURITY;

-- Technicien peut créer signalement pour missions assignées
CREATE POLICY "Technicien can create signalements for assigned missions"
ON mission_signalements FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM missions m
    JOIN techniciens t ON m.technicien_id = t.id
    WHERE m.id = mission_signalements.mission_id
      AND t.profile_id = auth.uid()
  )
);

-- Technicien peut voir ses signalements
CREATE POLICY "Technicien can view own signalements"
ON mission_signalements FOR SELECT
USING (
  signale_par = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM missions m
    JOIN techniciens t ON m.technicien_id = t.id
    WHERE m.id = mission_signalements.mission_id
      AND t.profile_id = auth.uid()
  )
);

-- Entreprise peut voir signalements de ses missions
CREATE POLICY "Entreprise can view signalements for own missions"
ON mission_signalements FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM missions m
    JOIN entreprises e ON m.entreprise_id = e.id
    WHERE m.id = mission_signalements.mission_id
      AND e.profile_id = auth.uid()
  )
);

-- Entreprise peut mettre à jour (résoudre) signalements
CREATE POLICY "Entreprise can update signalements for own missions"
ON mission_signalements FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM missions m
    JOIN entreprises e ON m.entreprise_id = e.id
    WHERE m.id = mission_signalements.mission_id
      AND e.profile_id = auth.uid()
  )
);

-- Régie peut voir signalements pour missions dans son territoire
CREATE POLICY "Regie can view signalements for missions in own territory"
ON mission_signalements FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM missions m
    JOIN tickets t ON m.ticket_id = t.id
    WHERE m.id = mission_signalements.mission_id
      AND t.regie_id = get_user_regie_id()
  )
);

-- Admin JTEC voit tout
CREATE POLICY "Admin JTEC can view all signalements"
ON mission_signalements FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin_jtec'
  )
);

-- ============================================================
-- Vue détaillée signalements
-- ============================================================

CREATE OR REPLACE VIEW mission_signalements_details AS
SELECT
  ms.id,
  ms.mission_id,
  ms.type_signalement,
  ms.description,
  ms.photos_urls,
  ms.signale_at,
  ms.resolu,
  ms.resolu_at,
  ms.resolution_commentaire,
  
  -- Info signalataire
  p.email as signale_par_email,
  t.nom as technicien_nom,
  t.prenom as technicien_prenom,
  
  -- Info mission
  m.statut as mission_statut,
  m.entreprise_id,
  e.nom as entreprise_nom,
  
  -- Info ticket
  tk.titre as ticket_titre,
  tk.categorie as ticket_categorie,
  tk.priorite as ticket_priorite
  
FROM mission_signalements ms
JOIN profiles p ON ms.signale_par = p.id
LEFT JOIN techniciens t ON p.id = t.profile_id
JOIN missions m ON ms.mission_id = m.id
JOIN entreprises e ON m.entreprise_id = e.id
JOIN tickets tk ON m.ticket_id = tk.id;

COMMENT ON VIEW mission_signalements_details IS 
  'Vue complète signalements avec infos mission/technicien/entreprise';
