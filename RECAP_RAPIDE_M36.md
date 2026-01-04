# ⚡ RECAP RAPIDE M36

## 🐛 Problème
Trigger M10 exige **exactement 3 disponibilités** avant validation régie.

Erreur observée:
```
Un ticket doit avoir exactement 3 disponibilités avant diffusion (actuellement : 1)
```

## ✅ Solution M36
Change règle métier: **au moins 1 disponibilité** (les 2 autres optionnelles).

## 📦 Fichiers
- `supabase/migrations/20260104001200_m36_fix_disponibilites_rule.sql`
- `supabase/migrations/20260104001200_m36_fix_disponibilites_rule_rollback.sql`
- `tests/validation_m36_disponibilites.sql`
- `CORRECTION_M36_DISPONIBILITES.md`

## 🚀 Déploiement
```bash
# 1. Appliquer migration
psql "$DATABASE_URL" -f supabase/migrations/20260104001200_m36_fix_disponibilites_rule.sql

# 2. Tester (5 tests)
psql "$DATABASE_URL" -f tests/validation_m36_disponibilites.sql
```

## ✅ Résultat
- 0 dispo → ❌ Bloqué
- 1 dispo → ✅ Autorisé
- 2 dispos → ✅ Autorisé
- 3 dispos → ✅ Autorisé

---
**Durée**: 2 min | **Impact**: ✅ Faible (correction trigger)
