-- ===== 20260106000001_m43_mission_signalements.sql =====

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


-- ===== 20260106000002_m43_mission_champs_complementaires.sql =====

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


-- ===== 20260106000003_m43_mission_historique_statuts.sql =====

-- ============================================================
-- MIGRATION M43 - PARTIE 3 : Historique statuts missions
-- ============================================================
-- Date: 2026-01-06
-- Objectif: Traçabilité complète changements statuts missions (audit trail)
-- Dépendances: missions (table existante)
-- Rollback: 20260106000003_m43_mission_historique_statuts_rollback.sql
-- ============================================================

-- Table historique changements statuts missions
CREATE TABLE IF NOT EXISTS mission_historique_statuts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  
  -- Transition
  ancien_statut text,  -- NULL pour création initiale
  nouveau_statut text NOT NULL,
  
  -- Traçabilité
  change_par uuid NOT NULL REFERENCES auth.users(id),
  change_at timestamptz NOT NULL DEFAULT now(),
  
  -- Contexte
  commentaire text,
  adresse_ip inet,  -- IP utilisateur ayant effectué changement
  user_agent text,  -- User agent navigateur
  
  -- Audit
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_historique_statuts_mission_id 
  ON mission_historique_statuts(mission_id);

CREATE INDEX IF NOT EXISTS idx_historique_statuts_change_at 
  ON mission_historique_statuts(change_at);

CREATE INDEX IF NOT EXISTS idx_historique_statuts_change_par 
  ON mission_historique_statuts(change_par);

CREATE INDEX IF NOT EXISTS idx_historique_statuts_nouveau_statut 
  ON mission_historique_statuts(nouveau_statut);

-- Index composite pour recherche transition spécifique
CREATE INDEX IF NOT EXISTS idx_historique_transition
  ON mission_historique_statuts(ancien_statut, nouveau_statut);

-- Commentaires
COMMENT ON TABLE mission_historique_statuts IS 
  'Historique complet changements statuts missions (audit trail)';

COMMENT ON COLUMN mission_historique_statuts.ancien_statut IS 
  'Statut avant changement (NULL si création mission)';

COMMENT ON COLUMN mission_historique_statuts.nouveau_statut IS 
  'Statut après changement';

COMMENT ON COLUMN mission_historique_statuts.change_par IS 
  'Utilisateur ayant effectué le changement';

COMMENT ON COLUMN mission_historique_statuts.commentaire IS 
  'Commentaire optionnel expliquant le changement';

COMMENT ON COLUMN mission_historique_statuts.adresse_ip IS 
  'Adresse IP utilisateur (pour audit de sécurité)';

-- ============================================================
-- Trigger pour enregistrer automatiquement les changements
-- ============================================================

CREATE OR REPLACE FUNCTION log_mission_statut_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Enregistrer uniquement si statut a changé
  IF OLD.statut IS DISTINCT FROM NEW.statut THEN
    INSERT INTO mission_historique_statuts (
      mission_id,
      ancien_statut,
      nouveau_statut,
      change_par,
      change_at
    ) VALUES (
      NEW.id,
      OLD.statut,
      NEW.statut,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      now()
    );
    
    -- Log pour debug
    RAISE NOTICE 'Historique statut: mission % : % → %', 
      NEW.id, 
      COALESCE(OLD.statut, 'NULL'), 
      NEW.statut;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION log_mission_statut_change IS 
  'Enregistre automatiquement changements statuts missions dans historique';

-- Trigger sur UPDATE
CREATE TRIGGER mission_statut_change_log
AFTER UPDATE ON missions
FOR EACH ROW
WHEN (OLD.statut IS DISTINCT FROM NEW.statut)
EXECUTE FUNCTION log_mission_statut_change();

-- Trigger sur INSERT (statut initial)
CREATE OR REPLACE FUNCTION log_mission_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO mission_historique_statuts (
    mission_id,
    ancien_statut,
    nouveau_statut,
    change_par,
    change_at,
    commentaire
  ) VALUES (
    NEW.id,
    NULL,  -- Pas d'ancien statut (création)
    NEW.statut,
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    now(),
    'Création mission'
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER mission_creation_log
AFTER INSERT ON missions
FOR EACH ROW
EXECUTE FUNCTION log_mission_creation();

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE mission_historique_statuts ENABLE ROW LEVEL SECURITY;

-- Entreprise voit historique de ses missions
CREATE POLICY "Entreprise can view historique for own missions"
ON mission_historique_statuts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM missions m
    JOIN entreprises e ON m.entreprise_id = e.id
    WHERE m.id = mission_historique_statuts.mission_id
      AND e.profile_id = auth.uid()
  )
);

-- Technicien voit historique de ses missions assignées
CREATE POLICY "Technicien can view historique for assigned missions"
ON mission_historique_statuts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM missions m
    JOIN techniciens t ON m.technicien_id = t.id
    WHERE m.id = mission_historique_statuts.mission_id
      AND t.profile_id = auth.uid()
  )
);

-- Régie voit historique missions dans son territoire
CREATE POLICY "Regie can view historique for missions in own territory"
ON mission_historique_statuts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM missions m
    JOIN tickets tk ON m.ticket_id = tk.id
    WHERE m.id = mission_historique_statuts.mission_id
      AND tk.regie_id = get_user_regie_id()
  )
);

-- Admin JTEC voit tout
CREATE POLICY "Admin JTEC can view all historique"
ON mission_historique_statuts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin_jtec'
  )
);

-- ============================================================
-- Vues pour analyses
-- ============================================================

-- Vue détaillée historique avec infos utilisateur
CREATE OR REPLACE VIEW mission_historique_details AS
SELECT
  h.id,
  h.mission_id,
  h.ancien_statut,
  h.nouveau_statut,
  h.change_at,
  h.commentaire,
  
  -- Info utilisateur ayant effectué changement
  p.email as change_par_email,
  p.role as change_par_role,
  
  -- Info mission
  m.entreprise_id,
  e.nom as entreprise_nom,
  m.technicien_id,
  t.nom as technicien_nom,
  t.prenom as technicien_prenom,
  
  -- Info ticket
  tk.titre as ticket_titre,
  tk.priorite as ticket_priorite,
  
  -- Calcul durée dans chaque statut
  LEAD(h.change_at) OVER (PARTITION BY h.mission_id ORDER BY h.change_at) - h.change_at AS duree_dans_statut

FROM mission_historique_statuts h
JOIN profiles p ON h.change_par = p.id
JOIN missions m ON h.mission_id = m.id
JOIN entreprises e ON m.entreprise_id = e.id
LEFT JOIN techniciens t ON m.technicien_id = t.id
JOIN tickets tk ON m.ticket_id = tk.id
ORDER BY h.mission_id, h.change_at;

COMMENT ON VIEW mission_historique_details IS 
  'Historique statuts missions avec détails complets (utilisateur, durée, contexte)';

-- Vue statistiques transitions
CREATE OR REPLACE VIEW mission_transitions_stats AS
WITH transitions_avec_duree AS (
  SELECT
    mission_id,
    ancien_statut,
    nouveau_statut,
    change_at,
    LEAD(change_at) OVER (PARTITION BY mission_id ORDER BY change_at) - change_at AS duree_dans_statut
  FROM mission_historique_statuts
  WHERE ancien_statut IS NOT NULL  -- Exclure créations
)
SELECT
  ancien_statut,
  nouveau_statut,
  COUNT(*) as nombre_transitions,
  AVG(EXTRACT(EPOCH FROM duree_dans_statut) / 3600) as duree_moyenne_heures,
  MIN(change_at) as premiere_transition,
  MAX(change_at) as derniere_transition
FROM transitions_avec_duree
GROUP BY ancien_statut, nouveau_statut
ORDER BY nombre_transitions DESC;

COMMENT ON VIEW mission_transitions_stats IS 
  'Statistiques transitions statuts missions (analyse workflow)';

-- Vue missions avec retour arrière (suspect)
CREATE OR REPLACE VIEW mission_transitions_anormales AS
SELECT DISTINCT
  h1.mission_id,
  h1.ancien_statut,
  h1.nouveau_statut,
  h1.change_at,
  h1.change_par,
  p.email as change_par_email,
  'Retour arrière détecté' as raison
FROM mission_historique_statuts h1
JOIN profiles p ON h1.change_par = p.id
WHERE EXISTS (
  SELECT 1 FROM mission_historique_statuts h2
  WHERE h2.mission_id = h1.mission_id
    AND h2.change_at > h1.change_at
    AND h2.nouveau_statut = h1.ancien_statut
)
ORDER BY h1.change_at DESC;

COMMENT ON VIEW mission_transitions_anormales IS 
  'Missions avec transitions suspectes (retour arrière statut)';
