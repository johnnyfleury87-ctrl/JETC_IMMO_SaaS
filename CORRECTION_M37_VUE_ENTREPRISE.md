# 🔧 CORRECTION M37 - Terminologie vue entreprise

## 📋 Contexte

**Date**: 2026-01-04  
**Bug détecté**: Vue `tickets_visibles_entreprise` utilise ancienne terminologie  
**Impact**: Entreprises ne voient AUCUN ticket (même en mode general)  

## 🐛 Problème

### Vue M24 utilise ancienne terminologie
```sql
WHERE
  -- Cas 1: Mode PUBLIC
  re.mode_diffusion = 'general'
  AND t.mode_diffusion = 'public'     -- ❌ Obsolète
  
  -- Cas 2: Mode ASSIGNÉ
  t.mode_diffusion = 'assigné'        -- ❌ Obsolète
```

### Migration M35 a changé les données
```sql
-- M35 a mis à jour:
UPDATE tickets SET mode_diffusion = 'general' WHERE mode_diffusion = 'public';
UPDATE tickets SET mode_diffusion = 'restreint' WHERE mode_diffusion = 'assigné';
```

### Résultat
- ❌ Vue filtre sur `mode_diffusion = 'public'`
- ❌ Mais données contiennent `mode_diffusion = 'general'`
- ❌ **WHERE ne match plus** → 0 tickets visibles

## ✅ Solution M37

### Code corrigé
```sql
WHERE
  -- Cas 1: Mode GENERAL (marketplace)
  re.mode_diffusion = 'general'
  AND t.mode_diffusion = 'general'     -- ✅ Corrigé
  
  -- Cas 2: Mode RESTREINT (assignation)
  t.mode_diffusion = 'restreint'       -- ✅ Corrigé
```

## 📦 Fichiers créés

### Migration M37
- ✅ `supabase/migrations/20260104001300_m37_fix_vue_entreprise_terminologie.sql`
  - DROP + CREATE VIEW avec terminologie corrigée
  - Masquage RGPD préservé
  - Permissions préservées

### Rollback M37
- ✅ `supabase/migrations/20260104001300_m37_fix_vue_entreprise_terminologie_rollback.sql`
  - Restaure vue M24 originale (si nécessaire)

## 🚀 Déploiement

### Étape 1: Appliquer migration
```bash
psql "$DATABASE_URL" -f supabase/migrations/20260104001300_m37_fix_vue_entreprise_terminologie.sql
```

### Étape 2: Test requête entreprise
```sql
-- Remplacer <entreprise_id> par ID entreprise test
SELECT COUNT(*) 
FROM tickets_visibles_entreprise 
WHERE visible_par_entreprise_id = '<entreprise_id>';
```

**Résultat attendu**: Nombre > 0 (si tickets en mode general existent)

### Étape 3: Test frontend
1. Se connecter comme **entreprise**
2. Aller sur `/entreprise/dashboard.html`
3. Cliquer "📋 Tickets disponibles"
4. **Attendu**: Liste tickets s'affiche (plus "Aucun ticket disponible")

## ✅ Validation

### Checklist technique
- [ ] Migration M37 appliquée sans erreur
- [ ] Vue `tickets_visibles_entreprise` recréée
- [ ] Définition contient 'general' et 'restreint' (pas 'public'/'assigné')
- [ ] Requête SELECT retourne tickets attendus

### Checklist fonctionnelle
- [ ] Entreprise voit tickets mode general
- [ ] Entreprise assignée voit tickets mode restreint
- [ ] Colonnes sensibles masquées (locataire_id, logement_id) en mode general
- [ ] Colonne ville visible

## 🔄 Rollback (si nécessaire)

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260104001300_m37_fix_vue_entreprise_terminologie_rollback.sql
```

⚠️ **Attention**: Restaure terminologie obsolète (vue ne fonctionnera plus avec données M35)

## 📊 Impact

### Avant M37
- ❌ Vue filtre sur `'public'`/`'assigné'` (obsolète)
- ❌ Données contiennent `'general'`/`'restreint'` (M35)
- ❌ WHERE ne match jamais → 0 tickets

### Après M37
- ✅ Vue filtre sur `'general'`/`'restreint'`
- ✅ Données contiennent `'general'`/`'restreint'`
- ✅ WHERE match correctement → tickets visibles

## 🔗 Fichiers liés

- Vue originale: [M24](../supabase/migrations/20251227000000_m24_masquage_colonnes_sensibles.sql)
- Harmonisation données: [M35](../supabase/migrations/20251227001100_m35_harmonize_mode_diffusion.sql)
- Frontend entreprise: [dashboard.html](../public/entreprise/dashboard.html)
- Table liaison: `regies_entreprises`

## 📝 Notes

- ✅ Migration M37 doit être appliquée **APRÈS M35** (dépendance)
- ✅ Compatible avec workflow M31-M35 complet
- ✅ Masquage RGPD préservé (colonnes sensibles NULL avant acceptation)
- ✅ Pas de modification frontend nécessaire (vue garde même nom)

## 🎯 Diagnostic précis

### Root cause
Vue SQL créée avant M35 → utilise ancienne terminologie

### Symptôme
Entreprises voient "Aucun ticket disponible" (frontend charge 0 tickets)

### Solution
Migration M37 met à jour vue avec terminologie M35

### Prévention
À l'avenir : harmoniser vues ET tables simultanément lors changement terminologie

---

**Auteur**: GitHub Copilot  
**Date**: 2026-01-04  
**Version**: 1.0  
**Priorité**: 🔴 CRITIQUE (bloque workflow entreprise)
