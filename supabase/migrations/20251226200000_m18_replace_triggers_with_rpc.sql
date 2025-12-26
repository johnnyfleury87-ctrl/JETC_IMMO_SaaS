/**
 * Migration M18: Remplacer triggers BEFORE INSERT par fonction RPC
 * 
 * PROBLÈME IDENTIFIÉ:
 * Les triggers BEFORE INSERT (ensure_locataire_has_logement_before_ticket, set_ticket_regie_id_trigger)
 * tentent d'accéder à NEW.locataire_id dans un contexte PostgREST + RLS où cette colonne
 * n'est pas exposée correctement → erreur 42703 "column locataire_id does not exist"
 * 
 * SOLUTION:
 * - Supprimer les triggers BEFORE INSERT fautifs
 * - Créer une fonction RPC SECURITY DEFINER dédiée à la création de tickets
 * - L'API appellera cette RPC au lieu de faire un INSERT direct
 * 
 * SÉCURITÉ:
 * - La fonction RPC résout les IDs depuis auth.uid()
 * - SECURITY DEFINER garantit les permissions
 * - Logique métier centralisée côté SQL
 */

-- ============================================================
-- ÉTAPE 1: Supprimer les triggers fautifs
-- ============================================================

-- Supprimer le trigger qui vérifie que le locataire a un logement
DROP TRIGGER IF EXISTS ensure_locataire_has_logement_before_ticket ON tickets;
DROP FUNCTION IF EXISTS check_locataire_has_logement_for_ticket();

-- Supprimer le trigger qui calcule automatiquement regie_id
DROP TRIGGER IF EXISTS set_ticket_regie_id_trigger ON tickets;
DROP FUNCTION IF EXISTS set_ticket_regie_id();

-- ============================================================
-- ÉTAPE 2: Créer la fonction RPC SECURITY DEFINER
-- ============================================================

CREATE OR REPLACE FUNCTION create_ticket_locataire(
  p_titre TEXT,
  p_description TEXT,
  p_categorie TEXT,
  p_sous_categorie TEXT DEFAULT NULL,
  p_piece TEXT DEFAULT NULL,
  p_disponibilites JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  id UUID,
  titre TEXT,
  description TEXT,
  categorie TEXT,
  sous_categorie TEXT,
  piece TEXT,
  statut TEXT,
  locataire_id UUID,
  logement_id UUID,
  regie_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_locataire_id UUID;
  v_logement_id UUID;
  v_regie_id UUID;
  v_ticket_id UUID;
BEGIN
  -- Récupérer l'utilisateur authentifié
  v_profile_id := auth.uid();
  
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  
  -- Récupérer le locataire et son logement
  SELECT l.id, l.logement_id
  INTO v_locataire_id, v_logement_id
  FROM locataires l
  WHERE l.profile_id = v_profile_id;
  
  IF v_locataire_id IS NULL THEN
    RAISE EXCEPTION 'Fiche locataire non trouvée';
  END IF;
  
  IF v_logement_id IS NULL THEN
    RAISE EXCEPTION 'Vous devez être rattaché à un logement pour créer un ticket. Contactez votre régie.';
  END IF;
  
  -- Récupérer la regie_id depuis le logement
  SELECT lg.regie_id
  INTO v_regie_id
  FROM logements lg
  WHERE lg.id = v_logement_id;
  
  IF v_regie_id IS NULL THEN
    RAISE EXCEPTION 'Impossible de déterminer la régie pour ce logement';
  END IF;
  
  -- Insérer le ticket
  INSERT INTO tickets (
    titre,
    description,
    categorie,
    sous_categorie,
    piece,
    locataire_id,
    logement_id,
    regie_id
  ) VALUES (
    p_titre,
    p_description,
    p_categorie,
    p_sous_categorie,
    p_piece,
    v_locataire_id,
    v_logement_id,
    v_regie_id
  )
  RETURNING tickets.id INTO v_ticket_id;
  
  -- Insérer les disponibilités si fournies
  IF p_disponibilites IS NOT NULL AND jsonb_array_length(p_disponibilites) > 0 THEN
    INSERT INTO tickets_disponibilites (ticket_id, date_debut, date_fin, preference)
    SELECT 
      v_ticket_id,
      (dispo->>'date_debut')::timestamptz,
      (dispo->>'date_fin')::timestamptz,
      (dispo->>'preference')::TEXT
    FROM jsonb_array_elements(p_disponibilites) AS dispo;
  END IF;
  
  -- Retourner le ticket créé
  RETURN QUERY
  SELECT 
    t.id,
    t.titre,
    t.description,
    t.categorie,
    t.sous_categorie,
    t.piece,
    t.statut,
    t.locataire_id,
    t.logement_id,
    t.regie_id,
    t.created_at
  FROM tickets t
  WHERE t.id = v_ticket_id;
END;
$$;

COMMENT ON FUNCTION create_ticket_locataire IS
  'Fonction RPC pour créer un ticket locataire. Résout automatiquement les IDs depuis auth.uid(). SECURITY DEFINER.';

-- ============================================================
-- ÉTAPE 3: Grant permissions
-- ============================================================

-- Permettre aux locataires authentifiés d'appeler cette fonction
GRANT EXECUTE ON FUNCTION create_ticket_locataire TO authenticated;

-- ============================================================
-- VALIDATION (à exécuter après migration)
-- ============================================================

-- Test 1: Appeler la fonction RPC depuis l'API
-- SELECT * FROM create_ticket_locataire(
--   'Plomberie // Fuite',
--   'Description du problème',
--   'plomberie',
--   'Fuite d''eau',
--   'cuisine',
--   '[{"date_debut":"2025-12-27T09:00:00Z","date_fin":"2025-12-27T12:00:00Z","preference":"matin"}]'::jsonb
-- );
-- Attendu: 1 ligne avec le ticket créé

-- Test 2: Vérifier que les triggers n'existent plus
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'tickets'::regclass AND tgname LIKE '%locataire%';
-- Attendu: 0 lignes

-- Test 3: Vérifier que la fonction existe
-- SELECT proname FROM pg_proc WHERE proname = 'create_ticket_locataire';
-- Attendu: 1 ligne
