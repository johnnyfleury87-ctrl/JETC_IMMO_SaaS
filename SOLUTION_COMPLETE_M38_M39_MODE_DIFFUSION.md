# 🎯 SOLUTION COMPLÈTE - Contrôle régie mode diffusion entreprise

Date : 2026-01-04  
Migrations : M38 + M39  
Status : ✅ **SOLUTION COMPLÈTE PRÊTE**

---

## 📊 Besoin métier

La régie doit pouvoir décider, pour chaque entreprise liée :
- ✅ **Autoriser marketplace** (mode general) : Entreprise voit tous tickets publics + assignés
- ✅ **Limiter assignations** (mode restreint) : Entreprise voit uniquement tickets assignés

**Problèmes identifiés** :
1. ❌ Aucune UI régie pour modifier ce paramètre
2. ❌ Policy RLS M34 ne vérifie pas `regies_entreprises.mode_diffusion`

---

## ✅ Solution complète (M38 + M39)

### M38: RPC + UI régie

**RPC SQL** : `update_entreprise_mode_diffusion(entreprise_id, mode)`
- Validations : régie autorisée, entreprise liée, mode valide
- UPDATE `regies_entreprises.mode_diffusion`
- Traçabilité via `updated_at`

**UI régie** : Boutons toggle interactifs
```
Mode diffusion:  [🌐 Général]  [🔒 Restreint]
```

### M39: Correction Policy RLS

**Policy corrigée** : Ajout vérification `re.mode_diffusion = 'general'`

**Avant M39** :
```sql
AND EXISTS (
  SELECT 1 FROM regies_entreprises re
  WHERE re.regie_id = tickets.regie_id
    AND e.profile_id = auth.uid()
  -- ❌ Ne vérifie PAS re.mode_diffusion
)
```

**Après M39** :
```sql
AND EXISTS (
  SELECT 1 FROM regies_entreprises re
  WHERE re.regie_id = tickets.regie_id
    AND e.profile_id = auth.uid()
    AND re.mode_diffusion = 'general'  -- ✅ Vérification ajoutée
)
```

---

## 📦 Livrables

### Migrations SQL (4 fichiers)
1. `20260104001400_m38_rpc_update_mode_diffusion.sql`
2. `20260104001400_m38_rpc_update_mode_diffusion_rollback.sql`
3. `20260104001500_m39_fix_rls_mode_diffusion.sql`
4. `20260104001500_m39_fix_rls_mode_diffusion_rollback.sql`

### Frontend (1 fichier modifié)
5. `public/regie/entreprises.html`

### Documentation (3 fichiers)
6. `CORRECTION_M38_CONTROLE_MODE_DIFFUSION.md`
7. `ACTIONS_M38.md`
8. `RECAP_RAPIDE_M38.md`

---

## 🚀 Déploiement (ordre strict)

```bash
# ÉTAPE 1: Migration M38 (RPC)
psql "$DATABASE_URL" -f supabase/migrations/20260104001400_m38_rpc_update_mode_diffusion.sql

# ÉTAPE 2: Migration M39 (Policy RLS)  🔴 CRITIQUE
psql "$DATABASE_URL" -f supabase/migrations/20260104001500_m39_fix_rls_mode_diffusion.sql

# ÉTAPE 3: Frontend (auto-deploy Vercel)
git add .
git commit -m "feat(regie): M38+M39 - Contrôle mode diffusion entreprise

- M38: RPC + UI toggle pour modifier mode
- M39: Policy RLS vérifie maintenant re.mode_diffusion
- Fix: Entreprises restreintes ne voient plus marketplace"
git push origin main
```

**⚠️ M39 est CRITIQUE** : Sans elle, toutes les entreprises voient le marketplace (même si mode=restreint)

---

## ✅ Tests validation

### Test 1: Modifier mode via UI régie
1. Se connecter comme **régie**
2. Ouvrir `/regie/entreprises.html`
3. Entreprise affichée "🔒 Restreint" par défaut
4. Cliquer **🌐 Général**
5. **Attendu**: Bouton devient vert, message confirmation

### Test 2: Vérifier accès marketplace (mode général)
1. Se connecter comme **cette entreprise**
2. Ouvrir `/entreprise/dashboard.html` → **📋 Tickets disponibles**
3. **Attendu**: Tickets marketplace s'affichent

### Test 3: Retour mode restreint
1. Revenir comme **régie**
2. Cliquer **🔒 Restreint** pour cette entreprise
3. Se reconnecter comme **entreprise**
4. **Attendu**: Plus de tickets marketplace (seulement assignés)

### Test 4: Vérifier Policy RLS (M39)
```sql
-- Connecté comme entreprise avec mode_diffusion='restreint'
SELECT COUNT(*) 
FROM tickets
WHERE mode_diffusion = 'general'
  AND statut = 'en_attente';
-- Attendu: 0 (policy bloque si re.mode_diffusion != 'general')
```

---

## 🎯 Cohérence globale validée

### Champ source unique : `regies_entreprises.mode_diffusion`

| Couche | Vérifie mode_diffusion | Status |
|--------|------------------------|--------|
| **Table** | `regies_entreprises.mode_diffusion` | ✅ Source vérité |
| **RPC M38** | UPDATE ce champ | ✅ Modifie source |
| **Vue M37** | `WHERE re.mode_diffusion = 'general'` | ✅ Vérifie source |
| **Policy M39** | `AND re.mode_diffusion = 'general'` | ✅ Vérifie source |
| **UI régie** | Toggle modifie via RPC M38 | ✅ Contrôle source |
| **UI entreprise** | Affiche tickets selon policies | ✅ Reflète source |

**✅ Cohérence parfaite : 1 source, 6 couches alignées**

---

## 📊 Règles métier finales

### Mode 🌐 GÉNÉRAL (Marketplace)

**Entreprise voit** :
- Tous tickets `t.mode_diffusion = 'general'` (marketplace)
- De ses régies autorisées (`regies_entreprises` existe)
- Où `re.mode_diffusion = 'general'` ✅ **Vérifié par M39**
- + Tickets assignés directement

**Cas d'usage** : Entreprises de confiance, marketplace compétitif

**Activation** : Régie clique **🌐 Général** dans `/regie/entreprises.html`

### Mode 🔒 RESTREINT (Assignation uniquement)

**Entreprise voit** :
- UNIQUEMENT tickets où `entreprise_id = elle-même`
- Aucun ticket marketplace (policy M39 bloque)

**Cas d'usage** : Entreprises nouvelles, confiance limitée, mode par défaut

**Default** : `regies_entreprises.mode_diffusion = 'restreint'`

---

## 🔐 Sécurité

### Niveau 1: Default sécurisé
- ✅ `regies_entreprises.mode_diffusion` default = `'restreint'`
- ✅ Principe de moindre privilège

### Niveau 2: Contrôle régie
- ✅ Seule la régie peut changer (RPC SECURITY DEFINER)
- ✅ Validation entreprise liée avant UPDATE

### Niveau 3: RLS PostgreSQL
- ✅ Policy M39 vérifie `re.mode_diffusion = 'general'`
- ✅ Double protection (vue M37 + policy M39)

### Niveau 4: Traçabilité
- ✅ `regies_entreprises.updated_at` trace changements
- ✅ Logs Supabase enregistrent QUI/QUAND

---

## 🎓 Impact et bénéfices

### Avant M38+M39
- ❌ Mode diffusion non modifiable
- ❌ Toutes entreprises liées voient marketplace (bug M34)
- ❌ Aucun contrôle régie

### Après M38+M39
- ✅ Régie contrôle finement l'accès marketplace
- ✅ Policy RLS respecte le mode défini
- ✅ UI simple (2 boutons)
- ✅ Changement immédiat (pas de cache)
- ✅ Feedback utilisateur clair

---

## 🔗 Dépendances

| Migration | Dépend de | Raison |
|-----------|-----------|--------|
| M38 | M37 | Vue entreprise vérifie mode_diffusion |
| M39 | M34, M38 | Corrige policy M34, complète M38 |

**Ordre déploiement** : M37 → M38 → M39

---

## 📝 Checklist finale

- [ ] M38 appliquée (RPC créée)
- [ ] M39 appliquée (Policy corrigée) 🔴 CRITIQUE
- [ ] Frontend déployé (toggle UI)
- [ ] Test: Toggle fonctionne
- [ ] Test: Entreprise général voit marketplace
- [ ] Test: Entreprise restreint ne voit PAS marketplace
- [ ] Test: Policy RLS bloque correctement

---

**Auteur**: GitHub Copilot  
**Date**: 2026-01-04  
**Version**: 1.0  
**Status**: ✅ SOLUTION COMPLÈTE ET COHÉRENTE
