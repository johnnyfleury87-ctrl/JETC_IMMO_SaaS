-- =====================================================
-- Migration : Garantir règle métier "ticket = logement obligatoire"
-- =====================================================
-- Date : 23 décembre 2025
-- Objectif : Bloquer création ticket si locataire sans logement
-- Niveau : BASE DE DONNÉES (pas contournable)
-- Impact : Erreur explicite si tentative création ticket sans logement
-- =====================================================

BEGIN;

-- Fonction de validation
CREATE OR REPLACE FUNCTION check_locataire_has_logement_for_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_logement_id uuid;
BEGIN
  -- Récupérer logement_id du locataire
  SELECT logement_id INTO v_logement_id
  FROM locataires
  WHERE id = NEW.locataire_id;

  -- Vérifier que le locataire a un logement
  IF v_logement_id IS NULL THEN
    RAISE EXCEPTION 'RÈGLE MÉTIER VIOLÉE : Le locataire % doit avoir un logement assigné pour créer un ticket. Demandez à votre régie de vous attribuer un logement.', NEW.locataire_id
      USING HINT = 'Contactez votre régie pour être rattaché à un logement avant de créer un ticket';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION check_locataire_has_logement_for_ticket IS
  'RÈGLE MÉTIER CRITIQUE : Seul un locataire avec logement peut créer un ticket. Impossible de contourner.';

-- Trigger BEFORE INSERT
CREATE TRIGGER ensure_locataire_has_logement_before_ticket
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION check_locataire_has_logement_for_ticket();

COMMENT ON TRIGGER ensure_locataire_has_logement_before_ticket ON tickets IS
  'Bloque création ticket si locataire sans logement (règle métier niveau DB)';

COMMIT;

-- Validation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'ensure_locataire_has_logement_before_ticket'
  ) THEN
    RAISE NOTICE '✅ Trigger validation tickets créé avec succès';
    RAISE NOTICE '   → Locataire SANS logement ne pourra plus créer de ticket';
    RAISE NOTICE '   → Règle métier garantie au niveau DB (pas contournable)';
  ELSE
    RAISE EXCEPTION '❌ Échec création trigger';
  END IF;
END $$;
