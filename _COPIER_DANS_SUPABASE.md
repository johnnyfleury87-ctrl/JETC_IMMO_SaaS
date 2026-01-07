# ⚡ CORRECTIF PRÊT - Copier dans Supabase SQL Editor

## 🎯 Le problème identifié :
- Le trigger `log_mission_statut_change()` insère un UUID fake `00000000-...` 
- Cet UUID viole la FK vers la table `users`
- Résultat : **Impossible de démarrer une mission** (erreur 500)

## ✅ La solution (3 minutes) :

### ÉTAPE 1 : Copier TOUT le code ci-dessous

```sql
-- =====================================================
-- CORRECTIF COMPLET : Triggers missions
-- =====================================================

-- PARTIE 1 : Corriger trigger historique
ALTER TABLE mission_historique_statuts 
ALTER COLUMN change_par DROP NOT NULL;

CREATE OR REPLACE FUNCTION log_mission_statut_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.statut IS DISTINCT FROM NEW.statut THEN
    INSERT INTO mission_historique_statuts (
      mission_id,
      ancien_statut,
      nouveau_statut,
      change_par,
      created_at
    )
    VALUES (
      NEW.id,
      OLD.statut,
      NEW.statut,
      auth.uid(),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- PARTIE 2 : DROP puis recréer triggers notifications
DROP TRIGGER IF EXISTS mission_status_change_notification ON missions;
DROP TRIGGER IF EXISTS trigger_mission_technicien_assignment ON missions;

CREATE OR REPLACE FUNCTION notify_mission_status_change_extended()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor RECORD;
  v_mission_ref TEXT;
BEGIN
  IF OLD.statut IS DISTINCT FROM NEW.statut THEN
    v_mission_ref := 'MISSION-' || SUBSTRING(NEW.id::text, 1, 8);
    PERFORM create_system_message(NEW.id, 'Statut changé : ' || OLD.statut || ' → ' || NEW.statut);
    FOR v_actor IN SELECT * FROM get_mission_actors(NEW.id) LOOP
      INSERT INTO notifications (user_id, type, title, message, related_mission_id)
      VALUES (v_actor.user_id, 'mission_status_change', 'Changement de statut - ' || v_mission_ref, 'La mission est maintenant : ' || NEW.statut, NEW.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mission_status_change_notification
  AFTER UPDATE ON missions
  FOR EACH ROW
  EXECUTE FUNCTION notify_mission_status_change_extended();

CREATE OR REPLACE FUNCTION notify_technicien_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tech_user_id UUID;
  v_mission_ref TEXT;
  v_tech_nom TEXT;
BEGIN
  IF OLD.technicien_id IS NULL AND NEW.technicien_id IS NOT NULL THEN
    SELECT user_id, nom INTO v_tech_user_id, v_tech_nom FROM techniciens WHERE id = NEW.technicien_id;
    IF v_tech_user_id IS NOT NULL THEN
      v_mission_ref := 'MISSION-' || SUBSTRING(NEW.id::text, 1, 8);
      PERFORM create_system_message(NEW.id, 'Technicien assigné : ' || v_tech_nom);
      INSERT INTO notifications (user_id, type, title, message, related_mission_id)
      VALUES (v_tech_user_id, 'mission_assigned', 'Nouvelle mission assignée', 'Vous avez été assigné à la mission ' || v_mission_ref, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_mission_technicien_assignment
  AFTER UPDATE ON missions
  FOR EACH ROW
  EXECUTE FUNCTION notify_technicien_assignment();

-- Vérifier trigger historique
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_log_mission_statut_change') THEN
    CREATE TRIGGER trigger_log_mission_statut_change
      AFTER UPDATE ON missions FOR EACH ROW
      EXECUTE FUNCTION log_mission_statut_change();
  END IF;
END $$;
```

### ÉTAPE 2 : Aller sur Supabase
🔗 https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql

### ÉTAPE 3 : Coller et RUN ▶️

### ÉTAPE 4 : Tester
```bash
node _test_apres_correctif.js
```

**Résultat attendu** : ✅ SUCCESS COMPLET!

---

## 🔍 Ce qui a changé :

| Avant | Après |
|-------|-------|
| `change_par NOT NULL` | `change_par NULL` ✅ |
| `COALESCE(auth.uid(), '0000...')` | `auth.uid()` ✅ |
| `NEW.reference` | `'MISSION-' + ID` ✅ |
| Erreur 23503 FK violation | ✅ Fonctionne |

---

**Fichier complet** : `_fix_trigger_reference.sql`  
**Diagnostic** : Erreur 23503 confirmée par `_diag_simple.js`
