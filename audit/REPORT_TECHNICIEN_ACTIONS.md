# 📋 RAPPORT AUDIT ACTIONS - VUE TECHNICIEN

**Date:** 2026-01-06  
**Objectif:** Vérifier l'état des actions métier disponibles pour le technicien  

---

## 🎯 ACTIONS MÉTIER ATTENDUES

Selon le rôle métier d'un technicien :

| # | Action | Statut attendu | Impact |
|---|--------|---------------|--------|
| 1 | **Voir missions assignées** | Critique | Affichage liste |
| 2 | **Démarrer mission** | Critique | started_at + statut |
| 3 | **Terminer mission** | Critique | completed_at + statut |
| 4 | **Signaler absence locataire** | Important | locataire_absent |
| 5 | **Ajouter photos** | Important | photos_urls |
| 6 | **Ajouter rapport/notes** | Important | notes |
| 7 | **Créer signalement** | Moyen | mission_signalements |
| 8 | **Voir détails mission** | Critique | Modal/page détail |

---

## 🔍 1. ACTION: Voir missions assignées

### État actuel: ❌ NON IMPLÉMENTÉ

**Fichier:** [`/public/technicien/dashboard.html`](../public/technicien/dashboard.html)  
**Ligne:** ~146 lignes (placeholder)

**Code attendu:**
```javascript
async function loadMissions() {
  const { data: missions, error } = await supabaseClient
    .from('missions')
    .select(`
      *,
      ticket:tickets(
        categorie,
        sous_categorie,
        description,
        locataire:locataires(nom, prenom, telephone),
        logement:logements(
          adresse,
          immeuble:immeubles(nom, adresse)
        )
      )
    `)
    .order('date_intervention_prevue', { ascending: true });
    
  if (error) {
    console.error('Erreur chargement missions:', error);
    return;
  }
  
  renderMissions(missions);
}
```

**Code actuel:** Aucun appel API

**Blocage:** UI placeholder, aucun code fetch

---

## 🔍 2. ACTION: Démarrer mission

### État actuel: ⚠️ API EXISTE, UI MANQUANTE

**API Backend:** ✅ [`/api/missions/start.js`](../api/missions/start.js)

**Fonctionnalités API:**
- ✅ Authentification requise
- ✅ Vérification rôle (`entreprise` OU `technicien`)
- ✅ Appelle `update_mission_statut(p_nouveau_statut: 'en_cours')`
- ✅ Transition: `en_attente` → `en_cours`
- ✅ UPDATE `missions.started_at = NOW()`

**Endpoint:**
```
POST /api/missions/start
Body: { "mission_id": "uuid" }
```

**UI Frontend:** ❌ Bouton manquant

**Code attendu:**
```javascript
async function startMission(missionId) {
  const response = await fetch('/api/missions/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mission_id: missionId })
  });
  
  if (response.ok) {
    showSuccess('Mission démarrée');
    await loadMissions();  // Refresh
  }
}
```

**Blocage:** Uniquement UI (bouton + handler)

---

## 🔍 3. ACTION: Terminer mission

### État actuel: ⚠️ API EXISTE, UI MANQUANTE

**API Backend:** ✅ [`/api/missions/complete.js`](../api/missions/complete.js)

**Fonctionnalités API:**
- ✅ Authentification requise
- ✅ Vérification rôle (`entreprise` OU `technicien`)
- ✅ Appelle `update_mission_statut(p_nouveau_statut: 'terminee')`
- ✅ Transition: `en_cours` → `terminee`
- ✅ UPDATE `missions.completed_at = NOW()`
- ✅ Optionnel: `rapport_url`

**Endpoint:**
```
POST /api/missions/complete
Body: { "mission_id": "uuid", "rapport_url": "url" }
```

**UI Frontend:** ❌ Bouton manquant

**Code attendu:**
```javascript
async function completeMission(missionId, rapportUrl = null) {
  const response = await fetch('/api/missions/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      mission_id: missionId,
      rapport_url: rapportUrl 
    })
  });
  
  if (response.ok) {
    showSuccess('Mission terminée');
    await loadMissions();
  }
}
```

**Blocage:** Uniquement UI (bouton + handler + modal confirmation)

---

## 🔍 4. ACTION: Signaler absence locataire

### État actuel: ❌ RIEN (ni API ni UI)

**API Backend:** ❌ Pas d'endpoint dédié

**Solution 1 - UPDATE direct:**
```javascript
async function signalerAbsence(missionId, raison) {
  const { error } = await supabaseClient
    .from('missions')
    .update({
      locataire_absent: true,
      absence_signalement_at: new Date().toISOString(),
      absence_raison: raison
    })
    .eq('id', missionId);
    
  if (error) {
    console.error('Erreur signalement absence:', error);
    return false;
  }
  
  return true;
}
```

**Solution 2 - RPC dédiée (recommandée):**
```sql
CREATE OR REPLACE FUNCTION signaler_absence_locataire(
  p_mission_id uuid,
  p_raison text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vérifier que mission assignée au technicien
  IF NOT EXISTS (
    SELECT 1 FROM missions
    WHERE id = p_mission_id
      AND technicien_id = (SELECT id FROM techniciens WHERE profile_id = auth.uid())
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission non assignée');
  END IF;
  
  -- UPDATE
  UPDATE missions
  SET 
    locataire_absent = true,
    absence_signalement_at = NOW(),
    absence_raison = p_raison
  WHERE id = p_mission_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;
```

**UI Frontend:** ❌ Bouton + modal manquants

**Blocage:** API + UI à créer

---

## 🔍 5. ACTION: Ajouter photos

### État actuel: ❌ RIEN (ni API ni UI)

**Architecture attendue:**

1. **Upload Supabase Storage:**
```javascript
async function uploadPhotos(missionId, files) {
  const urls = [];
  
  for (const file of files) {
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `missions/${missionId}/${fileName}`;
    
    // Upload vers storage
    const { data, error } = await supabaseClient.storage
      .from('mission-photos')
      .upload(filePath, file);
    
    if (error) {
      console.error('Erreur upload:', error);
      continue;
    }
    
    // Récupérer URL publique
    const { data: { publicUrl } } = supabaseClient.storage
      .from('mission-photos')
      .getPublicUrl(filePath);
    
    urls.push(publicUrl);
  }
  
  return urls;
}
```

2. **Sauvegarder URLs en DB:**
```javascript
async function savePhotosToMission(missionId, newPhotos) {
  // Récupérer photos existantes
  const { data: mission } = await supabaseClient
    .from('missions')
    .select('photos_urls')
    .eq('id', missionId)
    .single();
  
  const existingPhotos = mission?.photos_urls || [];
  
  // Ajouter nouvelles photos
  const { error } = await supabaseClient
    .from('missions')
    .update({
      photos_urls: [...existingPhotos, ...newPhotos]
    })
    .eq('id', missionId);
    
  return !error;
}
```

**Prérequis:**
- ✅ Colonne `missions.photos_urls` existe (type: jsonb)
- ❌ Bucket Storage `mission-photos` à créer
- ❌ Policies storage à configurer

**Blocage:** Storage + API + UI à créer

---

## 🔍 6. ACTION: Ajouter rapport/notes

### État actuel: ⚠️ COLONNE EXISTE, UI MANQUANTE

**DB:** ✅ Colonne `missions.notes` (type: text)

**Solution simple - UPDATE direct:**
```javascript
async function saveNotes(missionId, notes) {
  const { error } = await supabaseClient
    .from('missions')
    .update({ notes })
    .eq('id', missionId);
    
  if (error) {
    console.error('Erreur sauvegarde notes:', error);
    return false;
  }
  
  return true;
}
```

**UI Frontend:** ❌ Textarea manquante

**Code attendu:**
```html
<div class="modal-section">
  <label>Rapport d'intervention</label>
  <textarea 
    id="missionNotes" 
    rows="6"
    placeholder="Décrire les travaux réalisés, pièces utilisées, observations..."
    onchange="saveNotes(currentMissionId, this.value)"
  ></textarea>
  <small>Sauvegarde automatique</small>
</div>
```

**Blocage:** Uniquement UI (textarea + autosave)

---

## 🔍 7. ACTION: Créer signalement

### État actuel: ❌ RIEN (ni API ni UI)

**DB:** ✅ Table `mission_signalements` existe

**Solution - INSERT direct:**
```javascript
async function createSignalement(missionId, type, description) {
  const { error } = await supabaseClient
    .from('mission_signalements')
    .insert({
      mission_id: missionId,
      type,  // 'retard', 'absence', 'probleme', 'danger'
      description,
      created_by: (await supabaseClient.auth.getUser()).data.user.id
    });
    
  if (error) {
    console.error('Erreur création signalement:', error);
    return false;
  }
  
  return true;
}
```

**UI Frontend:** ❌ Formulaire manquant

**Types signalements attendus:**
- 🕐 Retard
- 🚫 Absence locataire
- ⚠️ Problème technique
- 🔧 Pièce manquante
- ⛔ Situation dangereuse

**Blocage:** UI formulaire + handler

---

## 🔍 8. ACTION: Voir détails mission

### État actuel: ❌ NON IMPLÉMENTÉ

**UI attendue:** Modal ou page dédiée affichant:

- 📋 Informations mission:
  - Référence ticket
  - Catégorie / sous-catégorie
  - Description problème
  - Statut actuel
  - Dates (prévue, démarrage, fin)

- 🏠 Localisation:
  - Adresse complète
  - Immeuble
  - Logement

- 👤 Contact:
  - Nom locataire
  - Téléphone
  - Email

- 📸 Photos:
  - Gallery photos uploadées
  - Bouton upload

- 📝 Rapport:
  - Notes technicien
  - Signalements
  - Historique

- 🔘 Actions:
  - Démarrer mission (si en_attente)
  - Terminer mission (si en_cours)
  - Signaler absence
  - Ajouter photo
  - Créer signalement

**Blocage:** UI complète à créer

---

## 📊 SYNTHÈSE ÉTAT ACTIONS

| Action | API | UI | Blocage | Priorité |
|--------|-----|-----|---------|----------|
| **Voir missions** | ✅ RLS | ❌ | Fetch + render | 🔴 P0 |
| **Démarrer mission** | ✅ | ❌ | Bouton + handler | 🔴 P0 |
| **Terminer mission** | ✅ | ❌ | Bouton + handler | 🔴 P0 |
| **Absence locataire** | ⚠️ | ❌ | RPC + UI | 🟡 P1 |
| **Ajouter photos** | ❌ | ❌ | Storage + UI | 🟡 P1 |
| **Notes/rapport** | ✅ | ❌ | Textarea | 🟡 P1 |
| **Signalements** | ⚠️ | ❌ | Form + INSERT | 🟢 P2 |
| **Détails mission** | ✅ | ❌ | Modal complète | 🔴 P0 |

---

## 🎯 PLAN D'IMPLÉMENTATION RECOMMANDÉ

### Phase 1 - MVP Critique (P0)
**Objectif:** Technicien peut voir et changer statut missions

1. ✅ Fetch missions assignées
2. ✅ Afficher liste missions (cards)
3. ✅ Bouton "Démarrer" → API `/api/missions/start`
4. ✅ Bouton "Terminer" → API `/api/missions/complete`
5. ✅ Modal détails mission (lecture seule)

**Temps estimé:** 3-4h

### Phase 2 - Actions complémentaires (P1)
**Objectif:** Technicien peut documenter intervention

6. ✅ Textarea notes (autosave)
7. ✅ Signalement absence locataire (UPDATE direct)
8. ✅ Upload photos (Storage + UI)

**Temps estimé:** 2-3h

### Phase 3 - Signalements avancés (P2)
**Objectif:** Technicien peut signaler problèmes

9. ✅ Formulaire signalements
10. ✅ Liste signalements mission
11. ✅ Types signalements (retard, danger, etc.)

**Temps estimé:** 1-2h

---

## 🚧 PRÉREQUIS TECHNIQUES

### Storage Supabase
```sql
-- Créer bucket mission-photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('mission-photos', 'mission-photos', true);

-- Policy upload pour techniciens
CREATE POLICY "Techniciens can upload photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'mission-photos'
  AND auth.role() = 'authenticated'
);

-- Policy lecture publique
CREATE POLICY "Public can view photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'mission-photos');
```

### RPC Signalement absence (optionnel, amélioration)
Voir section 4 ci-dessus.

---

## 📁 Fichiers à créer/modifier

### Modifications requises:
1. **`/public/technicien/dashboard.html`** 
   - Refonte complète (~800 lignes)
   
2. **`/public/js/technicien-missions.js`** (nouveau, recommandé)
   - Logique métier missions
   - Séparation concerns

3. **`/public/css/technicien.css`** (optionnel)
   - Styles spécifiques

### Migrations SQL (optionnelles):
1. **`supabase/migrations/XXXXXX_create_storage_mission_photos.sql`**
   - Bucket + policies storage

2. **`supabase/migrations/XXXXXX_add_rpc_signalements_technicien.sql`**
   - RPC signalement absence
   - RPC autres signalements

---

**Conclusion:** Les APIs backend critiques existent (start/complete mission). Le blocage principal est l'absence totale d'UI. L'implémentation doit se concentrer sur le frontend.

**Prochaine étape:** Implémentation vue technicien fonctionnelle (Phase 1 MVP)
