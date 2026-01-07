# 🎯 GUIDE COMPLET : Déblocage Bouton "Démarrer Mission"

## 📋 Résumé Exécutif

**Problème** : Le bouton "Démarrer Mission" retourne une erreur 500  
**Cause Racine** : Trigger PostgreSQL défectueux référençant une colonne inexistante  
**Impact** : Workflow technicien complètement bloqué  
**Temps de correction** : 5 minutes  

---

## 🔍 Diagnostic Complet

### Problème Principal : Triggers Défectueux

```
Error Code : 42703 (PostgreSQL)
Message    : column t.reference does not exist
Trigger    : mission_status_change_notification
Fonction   : notify_mission_status_change_extended()
```

**Explication** :
- Les triggers tentent d'accéder à `NEW.reference` lors d'un UPDATE sur `missions`
- Cette colonne n'existe pas dans la table `missions`
- Résultat : TOUTE modification de mission échoue (start, complete, update, etc.)

### Problème Secondaire : Données Incohérentes

**Profile technicien** :
```
✅ ID      : 3196179e-5258-457f-b31f-c88a4760ebe0
✅ Email   : demo.technicien@test.app
✅ Role    : technicien
```

**Table techniciens** :
```
❌ Aucune entrée correspondante
```

**Impact** :
- Les notifications d'assignation ne fonctionnent pas
- La mission peut référencer un technicien_id invalide
- Risque d'erreurs sur les contraintes de clés étrangères

---

## ✅ SOLUTION COMPLÈTE

### ÉTAPE 1 : Corriger les Triggers (OBLIGATOIRE)

#### 1.1 Ouvrir le SQL Editor Supabase

🔗 **Lien direct** : https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql

#### 1.2 Supprimer les triggers défectueux

**Copiez-collez dans le SQL Editor** :

```sql
DROP TRIGGER IF EXISTS mission_status_change_notification ON missions;
DROP TRIGGER IF EXISTS trigger_mission_technicien_assignment ON missions;
```

**Cliquez sur RUN** ▶️

#### 1.3 Recréer les fonctions corrigées

**Copiez-collez ce code** :

```sql
-- Fonction 1 : Notification changement de statut
CREATE OR REPLACE FUNCTION notify_mission_status_change_extended()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor RECORD;
  v_mission_ref TEXT;
BEGIN
  IF OLD.statut IS DISTINCT FROM NEW.statut THEN
    -- Utiliser l'ID comme référence au lieu de NEW.reference
    v_mission_ref := 'MISSION-' || SUBSTRING(NEW.id::text, 1, 8);
    
    -- Message système dans la messagerie
    PERFORM create_system_message(
      NEW.id,
      'Statut changé : ' || OLD.statut || ' → ' || NEW.statut
    );
    
    -- Notifications pour tous les acteurs
    FOR v_actor IN SELECT * FROM get_mission_actors(NEW.id)
    LOOP
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        related_mission_id
      )
      VALUES (
        v_actor.user_id,
        'mission_status_change',
        'Changement de statut - ' || v_mission_ref,
        'La mission est maintenant : ' || NEW.statut,
        NEW.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recréer le trigger
CREATE TRIGGER mission_status_change_notification
  AFTER UPDATE ON missions
  FOR EACH ROW
  EXECUTE FUNCTION notify_mission_status_change_extended();

-- Fonction 2 : Notification assignation technicien
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
    -- Récupérer le user_id du technicien
    SELECT user_id, nom INTO v_tech_user_id, v_tech_nom
    FROM techniciens
    WHERE id = NEW.technicien_id;
    
    IF v_tech_user_id IS NOT NULL THEN
      -- Utiliser l'ID comme référence
      v_mission_ref := 'MISSION-' || SUBSTRING(NEW.id::text, 1, 8);
      
      -- Message système
      PERFORM create_system_message(
        NEW.id,
        'Technicien assigné : ' || v_tech_nom
      );
      
      -- Notification pour le technicien
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        related_mission_id
      )
      VALUES (
        v_tech_user_id,
        'mission_assigned',
        'Nouvelle mission assignée',
        'Vous avez été assigné à la mission ' || v_mission_ref,
        NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recréer le trigger
CREATE TRIGGER trigger_mission_technicien_assignment
  AFTER UPDATE ON missions
  FOR EACH ROW
  EXECUTE FUNCTION notify_technicien_assignment();
```

**Cliquez sur RUN** ▶️

#### 1.4 Vérifier la correction

Dans votre terminal VS Code :

```bash
cd /workspaces/JETC_IMMO_SaaS
node _test_start_mission.js
```

**Résultat attendu** :
```
✅ RPC Success: { "success": true }
📊 État après RPC:
  Statut: en_cours
  Started_at: 2025-01-XX...
```

---

### ÉTAPE 2 : Corriger les Données Technicien (RECOMMANDÉ)

Cette étape n'est pas strictement obligatoire pour débloquer le bouton, mais recommandée pour la cohérence.

#### 2.1 Vérifier l'état actuel

```bash
node _create_missing_technicien.js
```

#### 2.2 Créer l'entrée si manquante

Le script ci-dessus :
1. ✅ Vérifie le profile existant
2. ✅ Crée une entrée dans `techniciens`
3. ✅ Associe le technicien à une entreprise
4. ✅ Met à jour la mission si nécessaire

**Alternative manuelle via SQL** :

```sql
-- Récupérer une entreprise existante
SELECT id, nom FROM entreprises LIMIT 1;

-- Créer l'entrée technicien (remplacer ENTREPRISE_ID)
INSERT INTO techniciens (
  user_id,
  entreprise_id,
  nom,
  prenom,
  telephone,
  specialites,
  statut
)
VALUES (
  '3196179e-5258-457f-b31f-c88a4760ebe0',
  'ENTREPRISE_ID', -- Remplacer par l'ID récupéré ci-dessus
  'Technicien',
  'Demo',
  '+33600000000',
  ARRAY['plomberie', 'électricité'],
  'actif'
);
```

---

### ÉTAPE 3 : Tester le Workflow Complet

#### 3.1 Test Backend (RPC)

```bash
node _test_start_mission.js
```

**Attendu** :
```
✅ RPC Success
📊 Statut: en_cours
```

#### 3.2 Test API Endpoint

```bash
node -e "
const token = 'VOTRE_TOKEN_TECHNICIEN';
const missionId = '2d84c11c-6415-4f49-ba33-8b53ae1ee22d';

fetch('http://localhost:3000/api/missions/start', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ mission_id: missionId })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
"
```

**Attendu** :
```json
{
  "success": true,
  "message": "Mission démarrée"
}
```

#### 3.3 Test Frontend

1. Connectez-vous avec `demo.technicien@test.app`
2. Accédez au dashboard technicien
3. Cliquez sur une mission avec statut "En attente"
4. Cliquez sur **"Démarrer"**
5. ✅ La mission passe à "En cours"

---

## 📊 Checklist de Validation

- [ ] Triggers DROP réussi (pas d'erreur SQL)
- [ ] Triggers CREATE réussi (fonctions recreated)
- [ ] Test RPC `start_mission` → Success
- [ ] Vérification statut mission → `en_cours`
- [ ] Vérification `started_at` → timestamp présent
- [ ] Test API `/api/missions/start` → HTTP 200
- [ ] Test frontend bouton "Démarrer" → Interface mise à jour
- [ ] Entrée technicien créée (optionnel)
- [ ] Logs backend sans erreurs

---

## 🔧 Scripts de Test Disponibles

| Script | Description | Usage |
|--------|-------------|-------|
| `_test_start_mission.js` | Test RPC direct | `node _test_start_mission.js` |
| `_diagnostic_triggers.js` | Diagnostic complet triggers | `node _diagnostic_triggers.js` |
| `_create_missing_technicien.js` | Créer entrée technicien | `node _create_missing_technicien.js` |

---

## 🐛 Troubleshooting

### Erreur : "column t.reference does not exist"

**Cause** : Triggers pas encore corrigés  
**Solution** : Retourner à ÉTAPE 1.2 et vérifier que les DROP ont bien été exécutés

### Erreur : "Permission denied for table techniciens"

**Cause** : RLS policies restrictives  
**Solution** : Utiliser `service_role_key` ou désactiver temporairement RLS

### Erreur : "Foreign key violation on technicien_id"

**Cause** : Mission référence un profile_id au lieu d'un technicien_id  
**Solution** : Exécuter `_create_missing_technicien.js` qui corrige automatiquement

### Bouton "Démarrer" grisé

**Cause** : Statut mission n'est pas `en_attente`  
**Solution** : Vérifier le statut dans la base :
```sql
SELECT id, statut, technicien_id FROM missions WHERE id = 'MISSION_ID';
```

---

## 📝 Logs de Débogage

### Activer les logs détaillés API

Le fichier `/api/missions/start.js` contient déjà des logs complets :
- `[START][REQ]` - Requête entrante
- `[START][AUTH]` - Authentification
- `[START][BODY]` - Données reçues
- `[START][DB]` - Opérations base de données
- `[START][SUCCESS]` ou `[START][ERROR]` - Résultat

**Consulter les logs Vercel** :
```bash
vercel logs --follow
```

---

## 🎉 Résultat Final Attendu

```
1️⃣  Frontend : Bouton "Démarrer" cliquable ✅
2️⃣  API Call : POST /api/missions/start → 200 OK ✅
3️⃣  Database : statut = 'en_cours', started_at = timestamp ✅
4️⃣  Frontend : Mission affichée comme "En cours" ✅
5️⃣  Workflow : Bouton "Rapport" maintenant disponible ✅
```

---

## 📚 Documentation Technique

**Architecture** :
```
Frontend (technicien/dashboard.html)
  ↓ POST /api/missions/start
API Handler (api/missions/start.js)
  ↓ authenticateUser(token)
  ↓ supabase.rpc('start_mission', { p_mission_id })
RPC Function (start_mission)
  ↓ UPDATE missions SET statut='en_cours', started_at=now()
Trigger (mission_status_change_notification)
  ↓ create_system_message()
  ↓ INSERT INTO notifications
```

**Fichiers modifiés** :
- `supabase/schema/16_messagerie.sql` - Triggers corrigés
- `api/missions/start.js` - Logs enhanced (déjà fait)

**Fichiers créés** :
- `_fix_trigger_reference.sql` - Correctif SQL
- `_CORRECTIF_START_MISSION.md` - Documentation technique
- `_GUIDE_COMPLET_START_MISSION.md` - Ce guide
- `_test_start_mission.js` - Script de test
- `_create_missing_technicien.js` - Correctif données

---

**Statut** : 🟢 Prêt à être appliqué  
**Priorité** : 🔴 CRITIQUE (bloque workflow technicien)  
**Temps estimé** : ⏱️ 5 minutes  

---

**Fait avec ❤️ par GitHub Copilot**
