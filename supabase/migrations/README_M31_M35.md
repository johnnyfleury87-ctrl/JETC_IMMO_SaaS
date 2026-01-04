# 📋 MIGRATIONS M31-M35: Workflow Tickets Régie-Entreprise

## 🎯 Objectif

Corriger et compléter le workflow de tickets de bout en bout:
- **Locataire** crée ticket
- **Régie** valide avec plafond et mode de diffusion
- **Entreprise(s)** voient tickets selon mode (general ou restreint)

## 🐛 Problèmes corrigés

1. ❌ **Bug JS bloquant** validation régie (ligne 792 `tickets.html`)
2. ❌ **Incohérence terminologie** `mode_diffusion` bloquait RLS entreprises
3. ❌ **Workflow non optimisé** (2 RPC au lieu d'1)
4. ❌ **Colonnes traçabilité manquantes** (QUI/QUAND a validé)

## 📦 Migrations

### M31: Colonnes traçabilité
**Fichier**: `20251227000700_m31_add_tracabilite_tickets.sql`

Ajoute 4 colonnes pour tracer QUI et QUAND:
- `plafond_valide_par` (uuid FK profiles)
- `plafond_valide_at` (timestamptz)
- `diffuse_par` (uuid FK profiles)
- `diffuse_at` (timestamptz)

### M32: RPC valider_ticket_regie
**Fichier**: `20251227000800_m32_rpc_valider_ticket_regie.sql`

Crée RPC unique qui fait validation + diffusion en 1 appel:
```sql
valider_ticket_regie(
  p_ticket_id uuid,
  p_plafond_chf numeric(10,2),
  p_mode_diffusion text,  -- 'general' ou 'restreint'
  p_entreprise_id uuid DEFAULT NULL
)
```

**Logique**:
- Vérifie auth régie
- Vérifie ticket appartient à cette régie
- Vérifie statut = 'nouveau'
- Valide plafond > 0
- Si mode restreint: vérifie entreprise_id fournie ET autorisée
- UPDATE atomique: statut → en_attente + traçabilité M31

### M33: RPC get_entreprises_autorisees
**Fichier**: `20251227000900_m33_rpc_get_entreprises_autorisees.sql`

Helper pour régie: liste entreprises autorisées (pour dropdown modal).

### M34: Policies RLS entreprise
**Fichier**: `20251227001000_m34_rls_entreprise_tickets.sql`

Crée 2 policies RLS:

1. **"Entreprise can view general tickets"**: Mode marketplace
   - Entreprise voit tickets `mode_diffusion='general'`
   - De ses régies autorisées
   - Statut `en_attente`, non verrouillés

2. **"Entreprise can view assigned tickets"**: Mode assignation
   - Entreprise voit tickets où `entreprise_id = elle-même`
   - Mode `restreint` uniquement
   - Tous statuts mission (`en_attente`, `en_cours`, `termine`)

### M35: Harmonisation terminologie
**Fichier**: `20251227001100_m35_harmonize_mode_diffusion.sql`

Corrige incohérence terminologique:
- Migre données: `'public'` → `'general'`, `'assigné'` → `'restreint'`
- Recrée policies avec terminologie correcte

## 🚀 Déploiement

### Option A: Migration consolidée (RECOMMANDÉ)

```bash
psql -h <host> -U postgres -d postgres \
  -f supabase/migrations/20260104000000_m31_m35_workflow_complet_consolidated.sql
```

Cette migration applique M31 à M35 en un seul fichier avec validation automatique.

### Option B: Migrations individuelles

```bash
# Dans l'ordre!
psql ... -f supabase/migrations/20251227000700_m31_add_tracabilite_tickets.sql
psql ... -f supabase/migrations/20251227000800_m32_rpc_valider_ticket_regie.sql
psql ... -f supabase/migrations/20251227000900_m33_rpc_get_entreprises_autorisees.sql
psql ... -f supabase/migrations/20251227001000_m34_rls_entreprise_tickets.sql
psql ... -f supabase/migrations/20251227001100_m35_harmonize_mode_diffusion.sql
```

## ✅ Validation

### Script pré-déploiement
```bash
psql ... -f tests/pre_deployment_check_m31_m35.sql
```

Vérifie:
- Migrations M26-M30 appliquées
- Colonnes existantes
- Valeurs mode_diffusion
- Policies RLS
- RPC existantes

### Script post-déploiement
```bash
psql ... -f tests/validation_ticket_workflow.sql
```

Tests:
1. Régie voit ticket complet (locataire + logement)
2. Régie valide ticket (RPC M32)
3. Entreprise voit tickets mode general (policy)
4. Entreprise assignée voit tickets mode restreint (policy)
5. Colonnes traçabilité M31 remplies
6. Policies RLS fonctionnent

## 📚 Documentation

- **Guide déploiement complet**: `../GUIDE_DEPLOIEMENT_M31_M35.md`
- **Rapport corrections**: `../RAPPORT_CORRECTION_WORKFLOW_TICKETS.md`
- **Récap rapide**: `../RECAP_RAPIDE_M31_M35.md`

## ➕ Migration complémentaire

### M36: Correction règle métier disponibilités (OPTIONNEL)
**Fichier**: `20260104001200_m36_fix_disponibilites_rule.sql`

**Problème détecté**: Trigger M10 exige exactement 3 disponibilités  
**Règle métier correcte**: Au moins 1 disponibilité (les 2 autres optionnelles)

**Correction**:
- Change condition trigger: `!= 3` → `< 1`
- Message: "exactement 3" → "au moins 1"
- Tests: 0 dispo ❌ | 1-3 dispos ✅

**Déploiement**:
```bash
psql ... -f supabase/migrations/20260104001200_m36_fix_disponibilites_rule.sql
psql ... -f tests/validation_m36_disponibilites.sql  # 5 tests
```

**Documentation**: `../CORRECTION_M36_DISPONIBILITES.md`

## 🔄 Rollback

Chaque migration a son fichier `_rollback.sql`:
```bash
psql ... -f supabase/migrations/20251227001100_m35_harmonize_mode_diffusion_rollback.sql
# Puis M34, M33, M32, M31 dans l'ordre inverse
```

**ATTENTION**: Rollback M35 remet terminologie obsolète (déconseillé).

## 📞 Support

| Erreur | Solution |
|--------|----------|
| `function valider_ticket_regie does not exist` | Appliquer M32 |
| Entreprise ne voit rien | Appliquer M35 |
| Colonnes traçabilité manquantes | Appliquer M31 |

---

**Status**: ✅ Prêt pour production  
**Date**: 2026-01-04  
**Version**: 1.0
