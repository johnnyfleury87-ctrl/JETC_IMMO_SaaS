# 🎯 COMMIT MESSAGE M36

## Message court

```bash
fix(tickets): M36 - Correction règle métier disponibilités (≥1 au lieu de =3)

- Trigger M10: change "exactement 3" vers "au moins 1" disponibilité
- Règle métier: 1 obligatoire + 2 optionnelles (max 3)
- Tests: 0 ❌ | 1-3 ✅
- Documentation: CORRECTION_M36_DISPONIBILITES.md
```

## Message détaillé

```
fix(tickets): M36 - Correction règle métier disponibilités (≥1 au lieu de =3)

PROBLÈME:
Trigger M10 exigeait exactement 3 disponibilités avant diffusion.
Bloquait validation régie si ticket avait 1 ou 2 créneaux.

Erreur observée:
"Un ticket doit avoir exactement 3 disponibilités avant diffusion (actuellement : 1)"

RÈGLE MÉTIER CORRECTE:
- Au moins 1 disponibilité OBLIGATOIRE
- 2 autres créneaux OPTIONNELS (max 3 au total)
- Entreprise choisit créneau parmi ceux proposés

SOLUTION M36:
Migration corrige fonction check_disponibilites_before_diffusion()
- Condition: != 3 → < 1
- Message: "exactement 3" → "au moins 1"

FICHIERS CRÉÉS:
- supabase/migrations/20260104001200_m36_fix_disponibilites_rule.sql
- supabase/migrations/20260104001200_m36_fix_disponibilites_rule_rollback.sql
- tests/validation_m36_disponibilites.sql (5 tests)
- CORRECTION_M36_DISPONIBILITES.md (doc complète)
- RECAP_RAPIDE_M36.md (synthèse)

FICHIERS MODIFIÉS:
- supabase/migrations/README_M31_M35.md (ajout section M36)
- GUIDE_DEPLOIEMENT_M31_M35.md (ajout option C + erreur #5)

VALIDATION:
- TEST 1: 0 dispo → ❌ Bloqué (attendu)
- TEST 2: 1 dispo → ✅ Autorisé
- TEST 3: 2 dispos → ✅ Autorisé
- TEST 4: 3 dispos → ✅ Autorisé
- TEST 5: Message erreur correct

IMPACT:
- Débloquer validation régie flexible (1-3 créneaux)
- Éviter obligation de créer créneaux inutiles
- Compatibilité totale avec M31-M35

DÉPLOIEMENT:
psql "$DATABASE_URL" -f supabase/migrations/20260104001200_m36_fix_disponibilites_rule.sql
psql "$DATABASE_URL" -f tests/validation_m36_disponibilites.sql

STATUS: ✅ PRÊT POUR PRODUCTION (migration optionnelle)
```

## Commande git

```bash
# Ajouter fichiers M36
git add supabase/migrations/20260104001200_m36_*.sql
git add tests/validation_m36_disponibilites.sql
git add CORRECTION_M36_DISPONIBILITES.md
git add RECAP_RAPIDE_M36.md
git add supabase/migrations/README_M31_M35.md
git add GUIDE_DEPLOIEMENT_M31_M35.md

# Commit
git commit -m "fix(tickets): M36 - Correction règle métier disponibilités (≥1 au lieu de =3)

- Trigger M10: change 'exactement 3' vers 'au moins 1' disponibilité
- Règle métier: 1 obligatoire + 2 optionnelles (max 3)
- Tests: 0 ❌ | 1-3 ✅
- Documentation: CORRECTION_M36_DISPONIBILITES.md"

# Push
git push origin main
```

---

**Date**: 2026-01-04  
**Type**: Correction règle métier (optionnel)
