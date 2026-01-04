# 📋 ACTIONS M38 - Contrôle mode diffusion

## 🎯 En bref
**Besoin**: Régie contrôle accès entreprises au marketplace  
**Solution**: RPC M38 + UI toggle  
**Status**: ✅ Prêt pour déploiement  

---

## ⚡ Déploiement immédiat

```bash
# 1. Migration SQL
psql "$DATABASE_URL" -f supabase/migrations/20260104001400_m38_rpc_update_mode_diffusion.sql

# 2. Frontend (Vercel auto-deploy)
git add public/regie/entreprises.html supabase/migrations/20260104001400_m38_*.sql
git commit -m "feat(regie): M38 - Contrôle mode diffusion entreprise"
git push origin main
```

---

## 🧪 Tests manuels

### Test 1: Modifier mode via UI régie
1. Se connecter comme **régie**
2. Ouvrir `/regie/entreprises.html`
3. Cliquer **🌐 Général** pour une entreprise restreinte
4. **Attendu**: 
   - Message confirmation
   - Bouton devient vert (actif)
   - Liste rechargée

### Test 2: Vérifier impact côté entreprise
1. Se connecter comme **cette entreprise**
2. Ouvrir `/entreprise/dashboard.html`
3. Cliquer **📋 Tickets disponibles**
4. **Attendu**: 
   - Tickets marketplace s'affichent
   - Plus "Aucun ticket disponible"

### Test 3: Retour en mode restreint
1. Revenir comme **régie**
2. Cliquer **🔒 Restreint** pour cette entreprise
3. **Attendu**: 
   - Bouton devient orange
   - Entreprise perd accès marketplace

---

## 📖 Documentation

| Fichier | Usage |
|---------|-------|
| [CORRECTION_M38_CONTROLE_MODE_DIFFUSION.md](CORRECTION_M38_CONTROLE_MODE_DIFFUSION.md) | Documentation complète |
| [RECAP_RAPIDE_M38.md](RECAP_RAPIDE_M38.md) | Synthèse 1 page |
| Ce fichier | Guide actions |

---

## 🎯 Règles métier

### Mode 🌐 GÉNÉRAL (Marketplace)
**Entreprise voit**:
- Tous tickets `mode_diffusion = 'general'` de ses régies
- + Tickets assignés directement

**Cas d'usage**: Entreprises de confiance, marketplace compétitif

### Mode 🔒 RESTREINT (Assignation uniquement)
**Entreprise voit**:
- UNIQUEMENT tickets assignés (`entreprise_id = elle`)
- Aucun ticket marketplace

**Cas d'usage**: Entreprises nouvelles, confiance limitée

---

## ✅ Checklist

- [ ] Migration M38 appliquée
- [ ] Frontend régie déployé
- [ ] Test: Toggle fonctionne (UI régie)
- [ ] Test: Entreprise voit/ne voit plus marketplace
- [ ] Cohérence: UI régie = Backend = UI entreprise

---

## 🔍 Diagnostic rapide

### Entreprise ne voit pas tickets malgré mode général ?

**Vérifier**:
```sql
-- 1. Mode diffusion correct ?
SELECT re.mode_diffusion 
FROM regies_entreprises re
JOIN entreprises e ON e.id = re.entreprise_id
WHERE e.profile_id = '<user_id>';
-- Attendu: 'general'

-- 2. Tickets existent ?
SELECT COUNT(*) 
FROM tickets_visibles_entreprise
WHERE visible_par_entreprise_id = '<entreprise_id>';
-- Attendu: > 0
```

---

## 📦 Fichiers créés/modifiés

### Migrations (2 fichiers)
- ✅ `20260104001400_m38_rpc_update_mode_diffusion.sql`
- ✅ `20260104001400_m38_rpc_update_mode_diffusion_rollback.sql`

### Frontend (1 fichier modifié)
- ✅ `public/regie/entreprises.html`
  - Styles CSS toggle buttons
  - Template HTML contrôle interactif
  - Fonction `toggleModeDiffusion()`

### Documentation (3 fichiers)
- ✅ `CORRECTION_M38_CONTROLE_MODE_DIFFUSION.md`
- ✅ `RECAP_RAPIDE_M38.md`
- ✅ `ACTIONS_M38.md` (ce fichier)

---

## 🚀 Status final

**Migration M38**: ✅ PRÊTE  
**Frontend UI**: ✅ PRÊT  
**Tests**: ✅ DÉFINIS  
**Documentation**: ✅ COMPLÈTE  
**Déploiement**: ⏳ EN ATTENTE

---

*Priorité: 🟢 AMÉLIORATION - Déblocage contrôle régie*
