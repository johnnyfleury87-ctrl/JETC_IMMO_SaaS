# 🔄 PLAN DE ROLLBACK - Migrations M43

**Date:** 06/01/2026  
**Contexte:** Migrations M43 ajoutées sans validation P0 préalable

---

## 🚨 OPTION 1 : Rollback SQL uniquement (RECOMMANDÉ)

### Étape 1 : Vérifier si les migrations sont appliquées

```bash
# Connexion à Supabase
supabase db remote status

# Vérifier les tables
psql -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'mission_signalements');"
```

### Étape 2 : Appliquer les rollbacks si nécessaire

```bash
# Dans l'ordre inverse
psql < supabase/migrations/20260106000003_m43_mission_historique_statuts_rollback.sql
psql < supabase/migrations/20260106000002_m43_mission_champs_complementaires_rollback.sql
psql < supabase/migrations/20260106000001_m43_mission_signalements_rollback.sql
```

**OU** via interface Supabase :
1. Aller dans SQL Editor
2. Copier/coller chaque fichier `*_rollback.sql`
3. Exécuter dans l'ordre inverse (003 → 002 → 001)

### Étape 3 : Vérifier le rollback

```bash
# Vérifier que les tables/colonnes n'existent plus
psql -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'missions' AND column_name IN ('date_reception_materiel', 'entreprise_id', 'technicien_assigne_id');"
```

✅ **Avantage:** Garde toutes les corrections de wiring (bootstrap, auth)  
✅ **Impact:** Minimal - Supprime uniquement les ajouts M43  
✅ **Durée:** 5-10 minutes

---

## 🔄 OPTION 2 : Rollback Git complet (SI PROBLÈMES PERSISTENT)

### Étape 1 : Créer une branche de sauvegarde

```bash
git checkout -b backup-pre-rollback
git push origin backup-pre-rollback
```

### Étape 2 : Rollback vers le commit de référence

```bash
# Retour au commit 05.01.2026 (AVANT migrations M43)
git checkout main
git reset --hard e9777d5a094b25e08882874ef1fb9f84839a7e4c

# Force push (ATTENTION : écrase l'historique)
git push origin main --force
```

### Étape 3 : Réappliquer uniquement les corrections critiques

```bash
# Cherry-pick le commit de fix
git cherry-pick 1b00e3e

# Push
git push origin main
```

❌ **Inconvénient:** Perd tous les changements depuis le 05.01  
⚠️ **Risque:** Écrase l'historique Git (nécessite --force)  
⏱️ **Durée:** 15-30 minutes + revalidation complète

---

## 🎯 OPTION 3 : Revert ciblé (COMPROMIS)

### Étape 1 : Identifier les commits M43

```bash
git log --oneline --since="2026-01-06" --grep="M43\|mission"
```

### Étape 2 : Revert un par un

```bash
# Exemple (adapter les SHA)
git revert <SHA_migration_003>
git revert <SHA_migration_002>
git revert <SHA_migration_001>

# Push
git push origin main
```

✅ **Avantage:** Garde l'historique propre  
✅ **Impact:** Moyen - Créé des commits de revert  
⏱️ **Durée:** 10-15 minutes

---

## 📋 CHECKLIST POST-ROLLBACK

Après avoir appliqué un rollback, vérifier :

### Base de données
- [ ] Table `mission_signalements` n'existe pas
- [ ] Colonnes ajoutées dans `missions` sont supprimées
- [ ] Table `mission_historique_statuts` n'existe pas
- [ ] RPC/fonctions liées aux missions sont supprimées

### Application
- [ ] Login Admin fonctionne
- [ ] Login Régie fonctionne
- [ ] Dashboard Régie accessible
- [ ] Pages Immeubles/Logements/Locataires/Tickets OK
- [ ] 0 erreur console (sauf warnings)

### Git
- [ ] Branch `backup-pre-rollback` créée (si option 2)
- [ ] Commit de rollback/revert visible dans l'historique
- [ ] Production Vercel redéployée

---

## 🚦 RECOMMANDATION FINALE

### SI les pages Régie/Admin fonctionnent maintenant (après le fix 1b00e3e) :

➡️ **Option 1** (Rollback SQL uniquement) **RECOMMANDÉE**

**Raison:** Les corrections de wiring (bootstrap, window.supabaseClient) sont bonnes et doivent être conservées. Seules les migrations M43 posent problème.

### SI les erreurs persistent même après le fix :

➡️ **Option 2** (Rollback Git complet) + **réappliquer le fix 1b00e3e**

**Raison:** Problème plus profond nécessitant un retour à un état stable.

---

## 📞 SUPPORT

Si rollback nécessaire mais problèmes rencontrés :
1. Créer backup : `git checkout -b backup-$(date +%Y%m%d-%H%M%S)`
2. Fournir les logs : `git log --oneline -20`
3. Consulter ce plan avant toute action destructive

---

**Document créé le:** 06/01/2026  
**Dernière mise à jour:** 06/01/2026  
**Auteur:** GitHub Copilot  
**Status:** ✅ Prêt à l'emploi
