-- ============================================================
-- MIGRATION M43 - PARTIE 2 : Colonnes complémentaires missions
-- ============================================================
-- Date: 2026-01-06
-- Objectif: Ajouter colonnes absence locataire et photos intervention
-- Dépendances: missions (table existante)
-- Rollback: 20260106000002_m43_mission_champs_complementaires_rollback.sql
-- ============================================================

-- Ajout colonnes absence locataire
ALTER TABLE missions
ADD COLUMN IF NOT EXISTS locataire_absent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS absence_signalement_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS absence_raison text DEFAULT NULL;

-- Ajout colonne photos intervention
ALTER TABLE missions
ADD COLUMN IF NOT EXISTS photos_urls text[] DEFAULT array[]::text[];

-- Commentaires
COMMENT ON COLUMN missions.locataire_absent IS 
  'Locataire absent lors intervention (signalé par technicien)';

COMMENT ON COLUMN missions.absence_signalement_at IS 
  'Date/heure signalement absence locataire';

COMMENT ON COLUMN missions.absence_raison IS 
  'Raison absence si connue (ex: pas prévenu, oubli, urgence)';

COMMENT ON COLUMN missions.photos_urls IS 
  'URLs photos intervention (avant/pendant/après) stockées dans Storage';

-- Index pour recherche missions avec absence
CREATE INDEX IF NOT EXISTS idx_missions_locataire_absent 
  ON missions(locataire_absent) 
  WHERE locataire_absent = true;

-- Index pour recherche missions avec photos
CREATE INDEX IF NOT EXISTS idx_missions_with_photos
  ON missions USING GIN(photos_urls)
  WHERE array_length(photos_urls, 1) > 0;

-- ============================================================
-- Fonction helper pour signaler absence locataire
-- ============================================================

CREATE OR REPLACE FUNCTION signaler_absence_locataire(
  p_mission_id uuid,
  p_raison text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mission_exists boolean;
  v_technicien_assigned boolean;
BEGIN
  -- 1. Vérifier que mission existe et technicien est assigné
  SELECT 
    EXISTS (SELECT 1 FROM missions WHERE id = p_mission_id),
    EXISTS (
      SELECT 1 FROM missions m
      JOIN techniciens t ON m.technicien_id = t.id
      WHERE m.id = p_mission_id
        AND t.profile_id = auth.uid()
    )
  INTO v_mission_exists, v_technicien_assigned;
  
  IF NOT v_mission_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Mission non trouvée'
    );
  END IF;
  
  IF NOT v_technicien_assigned THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Vous n''êtes pas assigné à cette mission'
    );
  END IF;
  
  -- 2. Signaler absence
  UPDATE missions
  SET 
    locataire_absent = true,
    absence_signalement_at = now(),
    absence_raison = p_raison,
    notes = COALESCE(notes || E'\n\n', '') || 
            '[' || to_char(now(), 'YYYY-MM-DD HH24:MI') || '] ' ||
            'Absence locataire signalée' ||
            CASE WHEN p_raison IS NOT NULL THEN ': ' || p_raison ELSE '' END
  WHERE id = p_mission_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Absence locataire enregistrée'
  );
END;
$$;

COMMENT ON FUNCTION signaler_absence_locataire IS 
  'Permet au technicien de signaler absence locataire lors intervention';

-- ============================================================
-- Fonction helper pour ajouter photos
-- ============================================================

CREATE OR REPLACE FUNCTION ajouter_photos_mission(
  p_mission_id uuid,
  p_photos_urls text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mission_exists boolean;
  v_authorized boolean;
BEGIN
  -- 1. Vérifier autorisation (technicien assigné OU entreprise)
  SELECT 
    EXISTS (SELECT 1 FROM missions WHERE id = p_mission_id),
    EXISTS (
      SELECT 1 FROM missions m
      LEFT JOIN techniciens t ON m.technicien_id = t.id
      LEFT JOIN entreprises e ON m.entreprise_id = e.id
      WHERE m.id = p_mission_id
        AND (t.profile_id = auth.uid() OR e.profile_id = auth.uid())
    )
  INTO v_mission_exists, v_authorized;
  
  IF NOT v_mission_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Mission non trouvée'
    );
  END IF;
  
  IF NOT v_authorized THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Non autorisé'
    );
  END IF;
  
  -- 2. Ajouter photos (append à l'array existant)
  UPDATE missions
  SET photos_urls = array_cat(photos_urls, p_photos_urls)
  WHERE id = p_mission_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Photos ajoutées',
    'count', array_length(p_photos_urls, 1)
  );
END;
$$;

COMMENT ON FUNCTION ajouter_photos_mission IS 
  'Ajoute photos à une mission (technicien ou entreprise)';

-- ============================================================
-- Vue missions avec absence locataire
-- ============================================================

CREATE OR REPLACE VIEW missions_avec_absence_locataire AS
SELECT
  m.id as mission_id,
  m.statut,
  m.absence_signalement_at,
  m.absence_raison,
  m.date_intervention_prevue,
  
  -- Technicien
  t.nom as technicien_nom,
  t.prenom as technicien_prenom,
  t.telephone as technicien_telephone,
  
  -- Entreprise
  e.nom as entreprise_nom,
  e.telephone as entreprise_telephone,
  
  -- Ticket
  tk.titre as ticket_titre,
  tk.priorite as ticket_priorite,
  
  -- Locataire
  loc.nom as locataire_nom,
  loc.prenom as locataire_prenom,
  loc.telephone as locataire_telephone,
  loc.email as locataire_email,
  
  -- Logement
  log.numero as logement_numero,
  imm.adresse as immeuble_adresse,
  
  -- Régie
  r.nom as regie_nom

FROM missions m
LEFT JOIN techniciens t ON m.technicien_id = t.id
JOIN entreprises e ON m.entreprise_id = e.id
JOIN tickets tk ON m.ticket_id = tk.id
JOIN locataires loc ON tk.locataire_id = loc.id
JOIN logements log ON tk.logement_id = log.id
JOIN immeubles imm ON log.immeuble_id = imm.id
JOIN regies r ON imm.regie_id = r.id
WHERE m.locataire_absent = true
ORDER BY m.absence_signalement_at DESC;

COMMENT ON VIEW missions_avec_absence_locataire IS 
  'Missions où le locataire était absent (pour suivi et reprogrammation)';
