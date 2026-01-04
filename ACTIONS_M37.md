# 📋 ACTIONS M37 - Vue entreprise

## 🎯 En bref
**Problème**: Vue utilise terminologie obsolète ('public'/'assigné')  
**Solution**: Migration M37 corrige vers 'general'/'restreint'  
**Status**: ✅ Prêt pour déploiement  
**Priorité**: 🔴 CRITIQUE (bloque workflow entreprise)

---

## ⚡ Action immédiate

```bash
# Déployer M37
psql "$DATABASE_URL" -f supabase/migrations/20260104001300_m37_fix_vue_entreprise_terminologie.sql
```

**Résultat attendu**: Vue recréée avec bonne terminologie

---

## 🧪 Tests

### Test SQL rapide
```bash
# Remplacer <entreprise_id>
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM tickets_visibles_entreprise WHERE visible_par_entreprise_id = '<entreprise_id>';"
```
**Attendu**: Nombre > 0 (si tickets existent)

### Test frontend
1. Se connecter comme **entreprise**
2. Ouvrir `/entreprise/dashboard.html`
3. Cliquer "📋 Tickets disponibles"
4. **Attendu**: Liste tickets s'affiche

---

## 📖 Documentation

| Besoin | Fichier | Temps |
|--------|---------|-------|
| **Actions immédiates** | Ce fichier | 1 min |
| **Détails complets** | [CORRECTION_M37_VUE_ENTREPRISE.md](CORRECTION_M37_VUE_ENTREPRISE.md) | 5 min |
| **Résumé rapide** | [RECAP_RAPIDE_M37.md](RECAP_RAPIDE_M37.md) | 1 min |

---

## 🔍 Diagnostic

### Root cause identifiée
Vue `tickets_visibles_entreprise` (M24) créée AVANT harmonisation M35.

**WHERE clause obsolète**:
```sql
-- ❌ Ancien (M24)
WHERE t.mode_diffusion = 'public'   -- Ne match plus

-- ✅ Nouveau (M37)
WHERE t.mode_diffusion = 'general'  -- Match données M35
```

### Symptôme
Frontend charge 0 tickets → affiche "Aucun ticket disponible"

### Solution
Migration M37 recrée vue avec terminologie correcte

---

## ✅ Checklist déploiement

- [ ] Lire [CORRECTION_M37_VUE_ENTREPRISE.md](CORRECTION_M37_VUE_ENTREPRISE.md)
- [ ] Appliquer migration M37
- [ ] Tester requête SQL (COUNT > 0)
- [ ] Test manuel frontend entreprise
- [ ] Vérifier masquage RGPD (colonnes sensibles NULL)

---

## 📦 Fichiers créés (3 au total)

### Migration (2 fichiers)
- ✅ `supabase/migrations/20260104001300_m37_fix_vue_entreprise_terminologie.sql`
- ✅ `supabase/migrations/20260104001300_m37_fix_vue_entreprise_terminologie_rollback.sql`

### Documentation (3 fichiers)
- ✅ `CORRECTION_M37_VUE_ENTREPRISE.md`
- ✅ `RECAP_RAPIDE_M37.md`
- ✅ `ACTIONS_M37.md` (ce fichier)

---

## 🔗 Liens utiles

- Vue originale: [M24](supabase/migrations/20251227000000_m24_masquage_colonnes_sensibles.sql)
- Harmonisation: [M35](supabase/migrations/20251227001100_m35_harmonize_mode_diffusion.sql)
- Frontend: [dashboard.html](public/entreprise/dashboard.html) (ligne 770)

---

## 🚀 Status final

**Migration M37**: ✅ PRÊTE  
**Tests**: ✅ DÉFINIS  
**Documentation**: ✅ COMPLÈTE  
**Déploiement**: ⏳ EN ATTENTE

---

## ⚠️ Important

- **Dépendance**: M37 doit être appliquée APRÈS M35
- **Impact**: Critique (débloque workflow entreprise)
- **Durée**: 2 minutes
- **Risque**: Faible (pas de modif données, juste vue SQL)

---

*Priorité: 🔴 CRITIQUE - À déployer immédiatement après M35*
