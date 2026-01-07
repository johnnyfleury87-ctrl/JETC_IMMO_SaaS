# 🧪 GUIDE TEST RAPIDE - FIX ASSIGNATION + MODAL

## ✅ Objectif
Vérifier que les bugs d'assignation technicien et modal sont résolus

## ⏱️ Durée : 3 minutes

---

## 🔧 PRÉREQUIS

### 1. Appliquer la migration M51

**Option A : Via Supabase Dashboard**
```
1. Aller sur https://supabase.com/dashboard
2. Sélectionner votre projet
3. SQL Editor → New query
4. Copier le contenu de :
   supabase/migrations/20260107000100_m51_create_assign_technicien_rpc.sql
5. Exécuter (Run)
```

**Option B : Via script Node.js**
```bash
node _apply_m46_m51_fix_assignation.js
```

**Résultat attendu** :
```
✅ RPC existe et retourne: { error: 'Mission non trouvée', success: false }
```

---

## 📋 TEST 1 : ASSIGNATION TECHNICIEN

### Contexte requis
- ✅ Entreprise créée et connectée
- ✅ Au moins 1 technicien actif dans l'entreprise
- ✅ Au moins 1 mission en statut `en_attente` ou `planifiee`

### Étapes

**1. Se connecter comme entreprise**
```
URL: http://localhost:5500/public/entreprise/dashboard.html
```

**2. Naviguer vers "Mes missions"**
- Cliquer sur l'onglet "Missions"
- Repérer une mission en statut "En attente"

**3. Ouvrir modal assignation**
- Cliquer sur "👤 Assigner technicien"

**Vérifier** :
- ✅ Modal s'ouvre
- ✅ Liste des techniciens s'affiche
- ✅ Nom, téléphone, spécialité visibles

**4. Sélectionner un technicien**
- Cocher le radio button d'un technicien
- Cliquer "✅ Assigner"

**Résultat AVANT fix** ❌ :
```
Error: column "user_id" does not exist
Code: 400
```

**Résultat APRÈS fix** ✅ :
```
✅ Technicien assigné avec succès !
```

**5. Vérifier le résultat**
- ✅ Modal se ferme automatiquement
- ✅ Mission affiche le nom du technicien assigné
- ✅ Statut mission passe à "Planifiée"

---

## 📋 TEST 2 : FERMETURE MODAL DÉTAILS

### Étapes

**1. Ouvrir modal détails**
- Depuis "Mes missions"
- Cliquer "📄 Détails" sur n'importe quelle mission

**Vérifier** :
- ✅ Modal s'ouvre avec les détails

**2. Test fermeture : Bouton X**
- Cliquer sur le X en haut à droite

**Résultat AVANT fix** ❌ :
```
Modal reste ouverte
Page bloquée
```

**Résultat APRÈS fix** ✅ :
```
✅ Modal se ferme
✅ Page redevient utilisable
```

**3. Test fermeture : Click outside**
- Rouvrir la modal "Détails"
- Cliquer en dehors (sur l'overlay gris)

**Résultat APRÈS fix** ✅ :
```
✅ Modal se ferme
```

**4. Test fermeture : Touche ESC**
- Rouvrir la modal "Détails"
- Appuyer sur la touche `Escape` (ESC)

**Résultat AVANT fix** ❌ :
```
Aucun effet
```

**Résultat APRÈS fix** ✅ :
```
✅ Modal se ferme immédiatement
```

---

## 🎯 CHECKLIST VALIDATION

### Assignation technicien
- [ ] Modal liste techniciens s'ouvre
- [ ] Techniciens actifs affichés avec infos
- [ ] Sélection + validation fonctionne
- [ ] **Pas d'erreur "user_id does not exist"**
- [ ] Message succès affiché
- [ ] Mission mise à jour (technicien + statut)

### Modal détails
- [ ] Modal s'ouvre correctement
- [ ] Fermeture avec bouton X ✅
- [ ] Fermeture avec click outside ✅
- [ ] Fermeture avec touche ESC ✅
- [ ] **Pas de modal fantôme ou page bloquée**

---

## 🐛 SI PROBLÈME PERSISTE

### Assignation technicien

**Erreur "function does not exist"**
```bash
# Vérifier que M51 est appliquée
psql $DATABASE_URL -c "SELECT routine_name FROM information_schema.routines WHERE routine_name = 'assign_technicien_to_mission';"

# Doit retourner 1 ligne
```

**Erreur "user_id does not exist"**
```bash
# Vérifier policies RLS
psql $DATABASE_URL -c "SELECT policyname, qual::text FROM pg_policies WHERE tablename IN ('missions', 'techniciens') AND qual::text LIKE '%user_id%';"

# Ne doit retourner AUCUNE ligne
```

**Erreur "Entreprise non trouvée"**
- Vérifier que vous êtes connecté en tant qu'entreprise
- Vérifier table `entreprises` a bien un profil lié

### Modal détails

**Modal ne se ferme toujours pas**
```javascript
// Vider cache navigateur
Ctrl + Shift + R (Chrome/Firefox)

// Vérifier console (F12)
// Doit voir:
// - closeMissionDetailsModal (définie 1 fois)
// - Listener ESC ajouté
```

**Doublon de fonction**
```bash
# Vérifier dashboard.html
grep -n "function closeMissionDetailsModal" public/entreprise/dashboard.html

# Doit retourner 1 seule ligne (vers ligne 1923)
```

---

## 🔍 DEBUG CONSOLE

### Logs attendus (F12 → Console)

**Assignation technicien** :
```
[MISSION] Ouverture modal assigner technicien: <uuid>
[MISSION] Technicien sélectionné: <uuid>
[MISSION] Assignation réussie: {success: true, ...}
```

**Pas d'erreur** :
```
❌ 400 Bad Request
❌ column "user_id" does not exist
❌ function "assign_technicien_to_mission" does not exist
```

---

## 📞 CONTACT

Si problème persiste après tous ces tests :

1. **Consulter** : `_RAPPORT_FIX_ASSIGNATION_MODAL.md`
2. **Exécuter** : `node _apply_m46_m51_fix_assignation.js`
3. **Vérifier** : Logs console + Network tab (F12)
4. **Fournir** : Screenshots erreur + logs console

---

**Guide créé le** : 7 janvier 2026  
**Bugs corrigés** : Assignation technicien + Modal détails  
**Priorité** : HAUTE (workflow entreprise bloqué)
