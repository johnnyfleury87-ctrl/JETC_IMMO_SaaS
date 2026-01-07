# 🎯 ACTION IMMÉDIATE - Démarrer Mission Technicien

## ⚡ CORRECTIF EXPRESS (5 minutes)

### 🔗 ÉTAPE 1 : Ouvrir SQL Editor
https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql

### 📋 ÉTAPE 2 : Copier-Coller ce SQL COMPLET

```sql
-- =====================================================
-- CORRECTIF COMPLET : Triggers missions
-- =====================================================

-- PARTIE 1 : Corriger trigger historique (BLOQUANT)
-- =====================================================

ALTER TABLE mission_historique_statuts 
ALTER COLUMN change_par DROP NOT NULL;

CREATE OR REPLACE FUNCTION log_mission_statut_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.statut IS DISTINCT FROM NEW.statut THEN
    INSERT INTO mission_historique_statuts (mission_id, ancien_statut, nouveau_statut, change_par, created_at)
    VALUES (NEW.id, OLD.statut, NEW.statut, auth.uid(), NOW());
  END IF;
  RETURN NEW;
END;
$$;

-- PARTIE 2 : Corriger triggers notifications
-- =====================================================

DROP TRIGGER IF EXISTS mission_status_change_notification ON missions;
DROP TRIGGER IF EXISTS trigger_mission_technicien_assignment ON missions;

CREATE OR REPLACE FUNCTION notify_mission_status_change_extended()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
  AFTER UPDATE ON missions FOR EACH ROW
  EXECUTE FUNCTION notify_mission_status_change_extended();

CREATE OR REPLACE FUNCTION notify_technicien_assignment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
  AFTER UPDATE ON missions FOR EACH ROW
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

### ▶️ ÉTAPE 3 : Cliquer RUN

### ✅ ÉTAPE 4 : Tester

```bash
cd /workspaces/JETC_IMMO_SaaS
node _test_apres_correctif.js
```

**Résultat attendu** :
```
✅ UPDATE réussi!
✅ RPC start_mission réussi
🎉 SUCCESS COMPLET!
```

---

## 📊 Problèmes Corrigés

### 1. Trigger historique (BLOQUANT)

```
❌ AVANT : change_par = COALESCE(auth.uid(), '00000000-...')
           → Viole FK vers users quand auth.uid() = NULL
           
✅ APRÈS : change_par = auth.uid() (nullable)
           → Accepte NULL quand pas de contexte JWT
```

### 2. Triggers notifications

```
❌ AVANT : NEW.reference (colonne inexistante)
✅ APRÈS : 'MISSION-' || SUBSTRING(NEW.id::text, 1, 8)
```

---

## 🚀 Résultat Final

```
Technicien clique "Démarrer"
  ↓
API POST /api/missions/start
  ↓
RPC start_mission()
  ↓
UPDATE missions SET statut='en_cours' ✅
  ↓
Trigger log_mission_statut_change ✅
  → INSERT historique (change_par = NULL)
  ↓
Trigger notifications ✅
  → Messages + Notifications acteurs
  ↓
Frontend affiche "En cours" ✅
```

---

## 📁 Fichiers Créés

- `_fix_trigger_reference.sql` - **Correctif SQL complet**
- `_fix_trigger_historique.sql` - Correctif historique seul
- `_test_apres_correctif.js` - **Test complet**
- `_check_trigger_historique.js` - Diagnostic
- `_ACTION_DEMARRER_MISSION.md` - Ce guide

---

**Temps** : 5 minutes  
**Priorité** : 🔴 CRITIQUE  
**Statut** : 🟡 En attente d'application SQL
