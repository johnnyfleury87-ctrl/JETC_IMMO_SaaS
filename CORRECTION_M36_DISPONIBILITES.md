# 🔧 CORRECTION M36 - Règle métier disponibilités

## 📋 Contexte

**Date**: 2026-01-04  
**Bug détecté**: Le trigger de validation M10 exige exactement 3 disponibilités  
**Impact**: Bloque la validation régie si le ticket n'a pas exactement 3 créneaux  

## 🐛 Problème

### Code actuel (M10)
```sql
IF v_count_disponibilites != 3 THEN
  RAISE EXCEPTION 'Un ticket doit avoir exactement 3 disponibilités avant diffusion (actuellement : %)', v_count_disponibilites;
END IF;
```

### Règle métier incorrecte
- ❌ Exactement 3 disponibilités obligatoires
- ❌ Bloque validation avec 1 ou 2 créneaux

### Comportement observé
```
Erreur lors validation régie:
"Un ticket doit avoir exactement 3 disponibilités avant diffusion (actuellement : 1)"
```

## ✅ Solution

### Règle métier correcte
- ✅ **Au moins 1 disponibilité** obligatoire
- ✅ Les 2 autres créneaux sont **optionnels**
- ✅ Maximum 3 créneaux au total
- ➡️ L'entreprise choisit le créneau parmi ceux proposés

### Code corrigé (M36)
```sql
IF v_count_disponibilites < 1 THEN
  RAISE EXCEPTION 'Un ticket doit avoir au moins 1 disponibilité avant diffusion (actuellement : %)', v_count_disponibilites;
END IF;
```

## 📦 Fichiers créés

### Migration M36
- ✅ `supabase/migrations/20260104001200_m36_fix_disponibilites_rule.sql`
  - Modifie fonction `check_disponibilites_before_diffusion()`
  - Change condition `!= 3` en `< 1`
  - Met à jour message d'erreur

### Rollback M36
- ✅ `supabase/migrations/20260104001200_m36_fix_disponibilites_rule_rollback.sql`
  - Restaure règle M10 originale si nécessaire

### Tests validation
- ✅ `tests/validation_m36_disponibilites.sql`
  - Test 1: 0 disponibilités → DOIT ÉCHOUER ❌
  - Test 2: 1 disponibilité → DOIT RÉUSSIR ✅
  - Test 3: 2 disponibilités → DOIT RÉUSSIR ✅
  - Test 4: 3 disponibilités → DOIT RÉUSSIR ✅
  - Test 5: Message erreur contient "au moins 1"

## 🚀 Déploiement

### Étape 1: Appliquer migration
```bash
psql "$DATABASE_URL" -f supabase/migrations/20260104001200_m36_fix_disponibilites_rule.sql
```

### Étape 2: Exécuter tests
```bash
psql "$DATABASE_URL" -f tests/validation_m36_disponibilites.sql
```

**Résultat attendu**: 5 tests passent ✅

### Étape 3: Test manuel
1. Se connecter comme **régie**
2. Aller sur `/regie/tickets.html`
3. Créer ticket avec **1 seul créneau** disponibilité
4. Cliquer "✅ Valider"
5. **Attendu**: Validation réussit (plus d'erreur "exactement 3")

## ✅ Validation

### Checklist technique
- [ ] Migration M36 appliquée sans erreur
- [ ] Fonction `check_disponibilites_before_diffusion` mise à jour
- [ ] 5 tests validation M36 réussis
- [ ] Message d'erreur contient "au moins 1"

### Checklist fonctionnelle
- [ ] Régie peut valider ticket avec 1 dispo
- [ ] Régie peut valider ticket avec 2 dispos
- [ ] Régie peut valider ticket avec 3 dispos
- [ ] Régie NE PEUT PAS valider ticket avec 0 dispo
- [ ] Message erreur clair si 0 dispo

## 🔄 Rollback (si nécessaire)

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260104001200_m36_fix_disponibilites_rule_rollback.sql
```

⚠️ Restaure règle stricte "exactement 3 disponibilités"

## 📊 Impact

### Avant M36
- ❌ 100% des tickets avec 1-2 dispos bloqués
- ❌ Régies contraintes de créer 3 créneaux (même inutiles)

### Après M36
- ✅ Validation flexible (1 à 3 créneaux)
- ✅ Régie propose 1, 2 ou 3 créneaux selon contexte
- ✅ Entreprise choisit créneau parmi ceux disponibles

## 🔗 Fichiers liés

- Migration originale: [M10](../supabase/migrations/20251226170900_m10_create_trigger_validate_disponibilites.sql)
- Trigger trigger: `check_disponibilites_before_diffusion()`
- Table: `tickets_disponibilites`
- Workflow: Voir [WORKFLOW_TICKETS_DIAGRAM.md](WORKFLOW_TICKETS_DIAGRAM.md)

## 📝 Notes

- ✅ Pas de modification frontend nécessaire (erreur affichée via trigger)
- ✅ Compatible avec workflow M31-M35 existant
- ✅ Migration M36 indépendante (peut s'appliquer après M31-M35)

---

**Auteur**: GitHub Copilot  
**Date**: 2026-01-04  
**Version**: 1.0
