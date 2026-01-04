# 🔧 CORRECTION M38 - Contrôle régie mode diffusion entreprise

## 📋 Contexte

**Date**: 2026-01-04  
**Besoin métier**: Régie doit contrôler quelles entreprises accèdent au marketplace  
**Champ existant**: `regies_entreprises.mode_diffusion` (general/restreint)  
**Problème**: Aucune UI pour modifier ce paramètre  

## 🎯 Objectif

Permettre à la régie de décider, pour chaque entreprise liée :
- ✅ **Mode GÉNÉRAL** : Entreprise voit tickets marketplace + assignés
- ✅ **Mode RESTREINT** : Entreprise voit uniquement tickets assignés

## 🔍 Analyse existant

### Champ déjà présent
```sql
regies_entreprises.mode_diffusion
Type: text
Default: 'restreint'
Values: 'general' | 'restreint'
```

### Vue M37 vérifie déjà ce champ
```sql
WHERE
  re.mode_diffusion = 'general'
  AND t.mode_diffusion = 'general'
```

✅ **Mécanisme backend déjà fonctionnel !**  
❌ **Manque uniquement l'UI régie**

## ✅ Solution M38

### 1️⃣ Migration SQL - RPC update_entreprise_mode_diffusion

**Fichier**: `supabase/migrations/20260104001400_m38_rpc_update_mode_diffusion.sql`

**Signature**:
```sql
update_entreprise_mode_diffusion(
  p_entreprise_id uuid,
  p_mode_diffusion text  -- 'general' | 'restreint'
)
RETURNS jsonb
```

**Validations**:
1. ✅ Vérifier que l'appelant est une régie
2. ✅ Vérifier que `mode_diffusion` est valide ('general' ou 'restreint')
3. ✅ Vérifier que l'entreprise est liée à cette régie
4. ✅ UPDATE `regies_entreprises.mode_diffusion`
5. ✅ Traçabilité via `updated_at`

### 2️⃣ UI Régie - Toggle interactif

**Fichier**: `public/regie/entreprises.html`

**Modifications**:
1. ✅ Styles CSS pour boutons toggle
2. ✅ Remplacement badge statique par contrôle interactif
3. ✅ Fonction JavaScript `toggleModeDiffusion()`
4. ✅ Appel RPC M38 avec feedback utilisateur
5. ✅ Rechargement liste après modification

**Interface**:
```
Mode diffusion:  [🌐 Général]  [🔒 Restreint]
                    ↑ actif        inactif
```

## 📦 Fichiers créés/modifiés

### Migrations (2 fichiers)
1. `supabase/migrations/20260104001400_m38_rpc_update_mode_diffusion.sql`
2. `supabase/migrations/20260104001400_m38_rpc_update_mode_diffusion_rollback.sql`

### Frontend (1 fichier modifié)
3. `public/regie/entreprises.html`
   - Styles CSS (toggle buttons)
   - Template HTML (contrôle interactif)
   - Fonction JavaScript (toggleModeDiffusion)

## 🚀 Déploiement

### Étape 1: Appliquer migration
```bash
psql "$DATABASE_URL" -f supabase/migrations/20260104001400_m38_rpc_update_mode_diffusion.sql
```

### Étape 2: Déployer frontend
```bash
# Si Vercel auto-deploy activé
git add public/regie/entreprises.html
git add supabase/migrations/20260104001400_m38_*.sql
git commit -m "feat(regie): M38 - Contrôle mode diffusion entreprise"
git push origin main

# OU déploiement manuel
vercel --prod
```

### Étape 3: Test manuel
1. Se connecter comme **régie**
2. Ouvrir `/regie/entreprises.html`
3. Cliquer sur **🌐 Général** pour une entreprise
4. **Attendu**: 
   - Bouton devient actif (vert)
   - Message confirmation affiché
   - Liste rechargée avec nouveau mode

5. Se connecter comme **cette entreprise**
6. Ouvrir `/entreprise/dashboard.html` → **📋 Tickets disponibles**
7. **Attendu**: Tickets en mode general s'affichent

## ✅ Validation

### Checklist technique
- [ ] Migration M38 appliquée sans erreur
- [ ] RPC `update_entreprise_mode_diffusion` créée
- [ ] Frontend régie déployé
- [ ] Boutons toggle affichés et fonctionnels

### Checklist fonctionnelle

#### Scénario 1: Passage restreint → général
1. [ ] Régie clique "🌐 Général" sur entreprise
2. [ ] Message confirmation affiché
3. [ ] Bouton devient vert (actif)
4. [ ] Entreprise voit maintenant tickets marketplace

#### Scénario 2: Passage général → restreint
1. [ ] Régie clique "🔒 Restreint" sur entreprise
2. [ ] Message confirmation affiché
3. [ ] Bouton devient orange (actif)
4. [ ] Entreprise ne voit plus tickets marketplace (uniquement assignés)

### Cohérence globale
- [ ] UI régie = règle backend (regies_entreprises.mode_diffusion)
- [ ] RLS = règle backend (vue M37 filtre sur re.mode_diffusion)
- [ ] UI entreprise reflète droit (tickets visibles selon mode)

## 🔄 Rollback (si nécessaire)

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260104001400_m38_rpc_update_mode_diffusion_rollback.sql
```

⚠️ **Frontend devra être restauré manuellement via git**

## 📊 Impact

### Avant M38
- ❌ Mode diffusion non modifiable
- ❌ Régie bloquée avec default 'restreint'
- ❌ Aucun contrôle marketplace

### Après M38
- ✅ Régie contrôle mode pour chaque entreprise
- ✅ Toggle simple et intuitif
- ✅ Changement immédiat (pas de redémarrage)
- ✅ Feedback utilisateur clair

## 🎓 Règles métier finales

### Mode GÉNÉRAL (🌐 Marketplace)
- **Entreprise voit**:
  - Tous tickets `mode_diffusion = 'general'` de ses régies autorisées
  - + Tickets qui lui sont directement assignés
- **Cas d'usage**: Entreprises de confiance, marketplace compétitif

### Mode RESTREINT (🔒 Assignation uniquement)
- **Entreprise voit**:
  - UNIQUEMENT tickets où `entreprise_id = elle-même`
  - Aucun ticket marketplace
- **Cas d'usage**: Entreprises nouvelles, confiance limitée

### Sécurité
- ✅ Default = `'restreint'` (principe de moindre privilège)
- ✅ Seule la régie peut changer (RPC SECURITY DEFINER)
- ✅ Traçabilité via `updated_at`

## 🔗 Fichiers liés

- Vue entreprise: [M37](../supabase/migrations/20260104001300_m37_fix_vue_entreprise_terminologie.sql)
- Policies RLS: [M34](../supabase/migrations/20251227001000_m34_rls_entreprise_tickets.sql)
- Frontend entreprise: [dashboard.html](../public/entreprise/dashboard.html)
- Table liaison: `regies_entreprises`

## 📝 Notes techniques

- ✅ RPC utilise `SECURITY DEFINER` (bypass RLS)
- ✅ Validation côté SQL (pas uniquement frontend)
- ✅ Atomique (UPDATE unique sur regies_entreprises)
- ✅ Pas de cache à invalider (Supabase Realtime)

---

**Auteur**: GitHub Copilot  
**Date**: 2026-01-04  
**Version**: 1.0  
**Priorité**: 🟢 AMÉLIORATION (déblocage contrôle régie)
