# ⚡ RECAP RAPIDE M37

## 🐛 Problème
Vue `tickets_visibles_entreprise` utilise terminologie obsolète :
- ❌ `mode_diffusion = 'public'` (devrait être `'general'`)
- ❌ `mode_diffusion = 'assigné'` (devrait être `'restreint'`)

**Impact**: Entreprises voient "Aucun ticket disponible" (WHERE ne match plus)

## ✅ Solution M37
Mettre à jour vue SQL avec terminologie M35 (general/restreint).

## 📦 Fichiers
- `supabase/migrations/20260104001300_m37_fix_vue_entreprise_terminologie.sql`
- `supabase/migrations/20260104001300_m37_fix_vue_entreprise_terminologie_rollback.sql`
- `CORRECTION_M37_VUE_ENTREPRISE.md`

## 🚀 Déploiement
```bash
# 1. Appliquer migration
psql "$DATABASE_URL" -f supabase/migrations/20260104001300_m37_fix_vue_entreprise_terminologie.sql

# 2. Tester (remplacer <entreprise_id>)
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM tickets_visibles_entreprise WHERE visible_par_entreprise_id = '<entreprise_id>';"
```

## ✅ Résultat
- ✅ Entreprises voient tickets mode general
- ✅ Masquage RGPD préservé
- ✅ Pas de modif frontend nécessaire

---
**Durée**: 2 min | **Priorité**: 🔴 CRITIQUE
