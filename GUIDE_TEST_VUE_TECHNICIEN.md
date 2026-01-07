# 🧪 GUIDE DE TEST - VUE TECHNICIEN

**Date:** 2026-01-07  
**Objectif:** Valider la vue technicien complètement connectée à Supabase

---

## 🟥 ÉTAPE 0 – VÉRIFIER CONNEXION SUPABASE

### Console navigateur (F12)
Au chargement de `/public/technicien/dashboard.html` avec un compte technicien :

**Logs attendus:**
```
[TECH][STEP 0] Vérification authentification...
[TECH][STEP 0] Supabase client init OK
[TECH][STEP 0] Auth session OK / uid=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[TECH][STEP 0] ✅ Authentification OK
```

**✅ Critère de succès:** Pas de redirection vers `/login.html`, logs complets visibles

---

## 🟥 ÉTAPE 1 – VÉRIFIER CHARGEMENT MISSIONS

### Console navigateur
Après authentification réussie :

**Logs attendus:**
```
[TECH][MISSIONS] Début chargement missions...
[TECH][MISSIONS] Loaded X missions
[TECH][MISSIONS] Render OK
```

### Interface
- Statistiques affichées (Missions assignées, En cours, Terminées aujourd'hui)
- Liste de missions visible (ou message "Aucune mission assignée")
- Filtres fonctionnels (Toutes / À faire / En cours / Terminées)

**✅ Critère de succès:** Missions affichées avec détails (type, adresse, date, statut)

---

## 🟥 ÉTAPE 2 – TEST START MISSION

### Pré-requis
1. Avoir au moins une mission avec `statut = 'en_attente'`
2. La mission doit être assignée au technicien connecté (`technicien_id` correspond)

### Actions
1. Cliquer sur bouton **"▶️ Démarrer"** sur une mission
2. Confirmer dans popup
3. Observer console et interface

**Logs attendus:**
```
[TECH][START] mission_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[TECH][START] mission_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx OK
[TECH][MISSIONS] Début chargement missions...
[TECH][MISSIONS] Loaded X missions
[TECH][MISSIONS] Render OK
```

### Vérification DB
```sql
-- Dashboard Supabase > SQL Editor
SELECT id, statut, started_at 
FROM missions 
WHERE id = 'ID_MISSION_TESTÉE';
```

**Résultat attendu:**
- `statut = 'en_cours'`
- `started_at` NOT NULL (timestamp actuel)

**✅ Critère de succès:** Mission passe de "À faire" à "En cours" dans l'interface

---

## 🟥 ÉTAPE 3 – TEST COMPLETE MISSION

### Pré-requis
Mission avec `statut = 'en_cours'`

### Actions
1. Cliquer sur **"✅ Terminer"**
2. Confirmer
3. Observer console

**Logs attendus:**
```
[TECH][COMPLETE] mission_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[TECH][COMPLETE] mission_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx OK
```

### Vérification DB
```sql
SELECT id, statut, started_at, completed_at 
FROM missions 
WHERE id = 'ID_MISSION_TESTÉE';
```

**Résultat attendu:**
- `statut = 'terminee'`
- `completed_at` NOT NULL

**✅ Critère de succès:** Mission passe de "En cours" à "Terminée"

---

## 🟡 ÉTAPE 4A – TEST NOTES / RAPPORT

### Actions
1. Cliquer sur **"Détails"** d'une mission en_cours
2. Saisir texte dans textarea "Rapport d'intervention"
3. Cliquer **"💾 Sauvegarder notes"**

**Logs attendus:**
```
[TECH][NOTES] Sauvegarde mission_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[TECH][NOTES] Saved OK mission_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Vérification DB
```sql
SELECT id, notes 
FROM missions 
WHERE id = 'ID_MISSION_TESTÉE';
```

**Résultat attendu:** Colonne `notes` contient le texte saisi

**✅ Critère de succès:** Toast "✅ Notes sauvegardées" affiché

---

## 🟡 ÉTAPE 4B – TEST ABSENCE LOCATAIRE

### Actions
1. Modal détails ouvert sur mission `en_cours` (sans absence déjà signalée)
2. Cliquer **"⚠️ Signaler absence locataire"**
3. Saisir motif dans prompt
4. Valider

**Logs attendus:**
```
[TECH][ABSENCE] mission_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[TECH][ABSENCE] Flagged OK mission_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Vérification DB
```sql
SELECT id, locataire_absent, absence_raison, absence_signalement_at 
FROM missions 
WHERE id = 'ID_MISSION_TESTÉE';
```

**Résultat attendu:**
- `locataire_absent = true`
- `absence_raison` contient le motif
- `absence_signalement_at` NOT NULL

**✅ Critère de succès:** Badge d'alerte affiché dans modal si réouvert

---

## 🟡 ÉTAPE 4C – TEST SIGNALEMENT INCIDENT

### Actions
1. Modal détails ouvert sur mission `en_cours` ou `en_attente`
2. Sélectionner type dans dropdown (ex: "Problème technique")
3. Saisir description dans textarea
4. Cliquer **"📢 Créer signalement"**

**Logs attendus:**
```
[TECH][SIGNALEMENT] Creating type=probleme_technique mission_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[TECH][SIGNALEMENT] Created OK id=yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
```

### Vérification DB
```sql
SELECT id, mission_id, type_signalement, description, signale_par, resolu 
FROM mission_signalements 
WHERE mission_id = 'ID_MISSION_TESTÉE'
ORDER BY signale_at DESC 
LIMIT 1;
```

**Résultat attendu:**
- Nouvelle ligne créée
- `type_signalement` correspond
- `description` correspond
- `signale_par` = user ID technicien
- `resolu = false`

**✅ Critère de succès:** Toast "✅ Signalement créé avec succès"

---

## 🟡 ÉTAPE 5 – TEST UPLOAD PHOTOS

### Pré-requis
1. Bucket `mission-photos` créé (migration M47)
2. Policies RLS Storage actives

### Actions
1. Modal détails ouvert sur mission `en_cours`
2. Cliquer **"📸 Ajouter des photos"**
3. Sélectionner 1-3 fichiers images (JPG/PNG)
4. Observer upload

**Logs attendus:**
```
[TECH][UPLOAD] Uploading 2 file(s) mission_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[TECH][UPLOAD] File: missions/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/1736279400000_photo1.jpg
[TECH][UPLOAD] URL: https://bwzyajsrmfhrxdmfpyqy.supabase.co/storage/v1/object/public/mission-photos/missions/...
[TECH][UPLOAD] File: missions/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/1736279401000_photo2.jpg
[TECH][UPLOAD] URL: https://bwzyajsrmfhrxdmfpyqy.supabase.co/storage/v1/object/public/mission-photos/missions/...
[TECH][UPLOAD] Uploaded 2 files mission_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[TECH][UPLOAD] photos_urls updated OK
```

### Vérification Storage
Dashboard Supabase → Storage → `mission-photos` → vérifier présence fichiers dans dossier `missions/{mission_id}/`

### Vérification DB
```sql
SELECT id, photos_urls 
FROM missions 
WHERE id = 'ID_MISSION_TESTÉE';
```

**Résultat attendu:** Array `photos_urls` contient URLs publiques

**✅ Critère de succès:** Photos affichées dans galerie du modal

---

## 🟢 ÉTAPE 6 – TEST ISOLATION RLS (SÉCURITÉ)

### Objectif
Vérifier qu'un technicien NE VOIT PAS les missions des autres techniciens

### Setup
1. Créer 2 comptes techniciens (tech1@test.app, tech2@test.app)
2. Assigner mission M1 à tech1
3. Assigner mission M2 à tech2

### Test
1. Se connecter avec tech1 → voir uniquement M1
2. Se connecter avec tech2 → voir uniquement M2
3. Vérifier console : pas d'erreur RLS

**✅ Critère de succès:** Chaque technicien voit UNIQUEMENT ses missions assignées

---

## 📊 RÉSUMÉ VALIDATIONS

| Étape | Feature | Logs clés | DB check |
|-------|---------|-----------|----------|
| 0 | Connexion Supabase | `[TECH][STEP 0] Supabase client init OK` | - |
| 1 | Chargement missions | `[TECH][MISSIONS] Loaded X missions` | SELECT COUNT(*) FROM missions WHERE technicien_id = ... |
| 2 | Start mission | `[TECH][START] mission_id=... OK` | started_at NOT NULL |
| 3 | Complete mission | `[TECH][COMPLETE] mission_id=... OK` | completed_at NOT NULL |
| 4A | Notes | `[TECH][NOTES] Saved OK` | notes NOT NULL |
| 4B | Absence | `[TECH][ABSENCE] Flagged OK` | locataire_absent = true |
| 4C | Signalement | `[TECH][SIGNALEMENT] Created OK` | SELECT * FROM mission_signalements |
| 5 | Photos | `[TECH][UPLOAD] photos_urls updated OK` | photos_urls array NOT empty |
| 6 | RLS isolation | Aucune erreur 403 | - |

---

## 🚨 TROUBLESHOOTING

### Problème : Aucune mission affichée
**Causes possibles:**
- Aucune mission assignée au technicien connecté
- RLS policy bloque l'accès
- Migration M46 non appliquée

**Debug:**
```sql
-- Vérifier missions assignées
SELECT m.id, m.statut, t.profile_id 
FROM missions m 
JOIN techniciens t ON m.technicien_id = t.id
WHERE t.profile_id = 'USER_ID_TECHNICIEN';

-- Vérifier policies RLS
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'missions' AND policyname LIKE '%technicien%';
```

### Problème : Upload photos échoue
**Causes possibles:**
- Bucket `mission-photos` non créé
- Policies Storage manquantes

**Debug:**
```sql
-- Vérifier bucket
SELECT * FROM storage.buckets WHERE id = 'mission-photos';

-- Vérifier policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects';
```

### Problème : Signalements non créés
**Cause:** Table `mission_signalements` manquante (migration M43)

**Fix:**
```bash
# Appliquer migration
psql $DATABASE_URL -f supabase/migrations/20260106000001_m43_mission_signalements.sql
```

---

## ✅ CHECKLIST FINALE

- [ ] Connexion Supabase OK (logs STEP 0)
- [ ] Missions chargées et affichées
- [ ] Start mission fonctionne (started_at rempli)
- [ ] Complete mission fonctionne (completed_at rempli)
- [ ] Notes sauvegardées en DB
- [ ] Absence locataire signalable
- [ ] Signalements incidents créés dans table
- [ ] Photos uploadées et affichées
- [ ] Isolation RLS fonctionnelle (technicien A ≠ technicien B)
- [ ] Aucune erreur console critique

---

**Tests validés par:** _________________  
**Date:** _________________  
**Environnement:** Local / Production
