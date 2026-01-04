# 📋 ACTIONS M36 - Règle disponibilités

## 🎯 En bref
**Problème**: Trigger exige exactement 3 disponibilités  
**Solution**: Migration M36 change règle à "au moins 1"  
**Status**: ✅ Prêt pour déploiement

---

## ⚡ Action immédiate

```bash
# Déployer M36
psql "$DATABASE_URL" -f supabase/migrations/20260104001200_m36_fix_disponibilites_rule.sql

# Tester M36
psql "$DATABASE_URL" -f tests/validation_m36_disponibilites.sql
```

---

## 📖 Documentation

| Besoin | Fichier | Temps |
|--------|---------|-------|
| Détails complets | [CORRECTION_M36_DISPONIBILITES.md](CORRECTION_M36_DISPONIBILITES.md) | 5 min |
| Résumé rapide | [RECAP_RAPIDE_M36.md](RECAP_RAPIDE_M36.md) | 1 min |
| Message commit | [GIT_COMMIT_MESSAGE_M36.md](GIT_COMMIT_MESSAGE_M36.md) | 1 min |
| Guide déploiement | [GUIDE_DEPLOIEMENT_M31_M35.md](GUIDE_DEPLOIEMENT_M31_M35.md) (section M36) | 2 min |

---

## 🧪 Tests créés

1. **0 disponibilités** → ❌ DOIT ÉCHOUER
2. **1 disponibilité** → ✅ DOIT RÉUSSIR
3. **2 disponibilités** → ✅ DOIT RÉUSSIR
4. **3 disponibilités** → ✅ DOIT RÉUSSIR
5. **Message erreur** → Contient "au moins 1"

Script: [tests/validation_m36_disponibilites.sql](tests/validation_m36_disponibilites.sql)

---

## 📦 Fichiers créés (6 au total)

### Migrations SQL (2 fichiers)
- ✅ `supabase/migrations/20260104001200_m36_fix_disponibilites_rule.sql`
- ✅ `supabase/migrations/20260104001200_m36_fix_disponibilites_rule_rollback.sql`

### Tests (1 fichier)
- ✅ `tests/validation_m36_disponibilites.sql`

### Documentation (3 fichiers)
- ✅ `CORRECTION_M36_DISPONIBILITES.md`
- ✅ `RECAP_RAPIDE_M36.md`
- ✅ `GIT_COMMIT_MESSAGE_M36.md`

### Mises à jour (2 fichiers)
- ✅ `supabase/migrations/README_M31_M35.md` (section M36 ajoutée)
- ✅ `GUIDE_DEPLOIEMENT_M31_M35.md` (option C + erreur #5)

---

## ✅ Checklist déploiement

- [ ] Lire [CORRECTION_M36_DISPONIBILITES.md](CORRECTION_M36_DISPONIBILITES.md)
- [ ] Backup base de données
- [ ] Appliquer migration M36
- [ ] Exécuter tests validation M36 (5 tests)
- [ ] Test manuel: valider ticket avec 1 créneau
- [ ] Commit + push (voir [GIT_COMMIT_MESSAGE_M36.md](GIT_COMMIT_MESSAGE_M36.md))

---

## 🔗 Liens utiles

- Migration origine: [M10](supabase/migrations/20251226170900_m10_create_trigger_validate_disponibilites.sql)
- Workflow complet: [WORKFLOW_TICKETS_DIAGRAM.md](WORKFLOW_TICKETS_DIAGRAM.md)
- Migrations M31-M35: [README_M31_M35.md](supabase/migrations/README_M31_M35.md)

---

## 🚀 Status final

**Migration M36**: ✅ PRÊTE  
**Tests**: ✅ PRÊTS  
**Documentation**: ✅ COMPLÈTE  
**Déploiement**: ⏳ EN ATTENTE

---

*Durée estimée: 5 minutes*
