# 🚨 ACTION IMMÉDIATE - CORRECTION BUG ASSIGNATION TECHNICIEN

## LE BUG
```
Erreur lors de l'assignation technicien: "column user_id does not exist"
```

## LA CAUSE
La fonction `assign_technicien_to_mission` utilise **des mauvais noms de colonnes** dans l'INSERT notifications :
- ❌ `titre` au lieu de `title`
- ❌ `mission_id` au lieu de `related_mission_id`
- ❌ `ticket_id` au lieu de `related_ticket_id`

## LA SOLUTION
✅ **Migration M52 créée et prête à appliquer**

---

## 🚀 APPLIQUER LA CORRECTION (2 MINUTES)

### Étape 1 : Ouvrir le SQL Editor Supabase
👉 https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql

### Étape 2 : Copier le SQL
Ouvrir le fichier : `supabase/migrations/_APPLY_M52_MANUAL.sql`

### Étape 3 : Coller et exécuter
1. Coller tout le contenu dans l'éditeur SQL Supabase
2. Cliquer sur **"RUN"**
3. ✅ Devrait voir "Success"

---

## ✅ VÉRIFICATION

Après application, tester :
1. Se connecter en tant qu'entreprise
2. Assigner un technicien à une mission
3. ✅ Doit réussir sans erreur

---

## 📁 FICHIERS

- **Migration principale** : `supabase/migrations/20260108000000_m52_fix_assign_technicien_notifications.sql`
- **Version simplifiée (pour copier-coller)** : `supabase/migrations/_APPLY_M52_MANUAL.sql`
- **Documentation complète** : `_RESOLUTION_BUG_USER_ID.md`
- **Script vérification** : `_verify_m52_fix.js`

---

## ❓ EN CAS DE PROBLÈME

Si l'application échoue :
1. Vérifier les logs dans Dashboard > Logs > Database
2. Contacter le support

---

**Temps estimé : 2 minutes**  
**Impact : Débloque l'assignation technicien**  
**Urgence : CRITIQUE (bloquant pilote)**
