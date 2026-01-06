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
