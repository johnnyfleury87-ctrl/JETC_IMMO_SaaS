# 🎯 COMMIT MESSAGE M37

## Message court

```bash
fix(entreprise): M37 - Correction terminologie vue tickets_visibles_entreprise

- Vue M24 utilisait 'public'/'assigné' (obsolète depuis M35)
- Mise à jour vers 'general'/'restreint' (harmonisation)
- Fix: Entreprises voient maintenant tickets mode general
- Documentation: CORRECTION_M37_VUE_ENTREPRISE.md
```

## Message détaillé

```
fix(entreprise): M37 - Correction terminologie vue tickets_visibles_entreprise

PROBLÈME CRITIQUE:
Vue SQL tickets_visibles_entreprise (M24) utilise ancienne terminologie.
Migration M35 a harmonisé les données (public → general, assigné → restreint).
MAIS la vue n'a pas été mise à jour → WHERE ne match plus.

Impact observé:
- Entreprises voient "Aucun ticket disponible"
- Frontend charge 0 tickets depuis vue
- Query SQL: SELECT FROM tickets_visibles_entreprise WHERE ... retourne 0 rows

ROOT CAUSE:
Vue M24 créée AVANT harmonisation M35.

WHERE clause obsolète:
  ❌ t.mode_diffusion = 'public'   -- Ne match plus (données = 'general')
  ❌ t.mode_diffusion = 'assigné'  -- Ne match plus (données = 'restreint')

SOLUTION M37:
Recréer vue avec terminologie M35:
  ✅ t.mode_diffusion = 'general'   -- Match données actuelles
  ✅ t.mode_diffusion = 'restreint' -- Match données actuelles

FICHIERS CRÉÉS:
- supabase/migrations/20260104001300_m37_fix_vue_entreprise_terminologie.sql
- supabase/migrations/20260104001300_m37_fix_vue_entreprise_terminologie_rollback.sql
- CORRECTION_M37_VUE_ENTREPRISE.md (doc complète)
- RECAP_RAPIDE_M37.md (synthèse)
- ACTIONS_M37.md (guide actions)

CHANGEMENTS MIGRATION M37:
- DROP VIEW tickets_visibles_entreprise CASCADE
- CREATE VIEW avec terminologie corrigée:
  • Cas 1: mode_diffusion='general' (marketplace)
  • Cas 2: mode_diffusion='restreint' (assignation)
  • Cas 3: Tickets acceptés (historique)
- Masquage RGPD préservé (locataire_id, logement_id)
- Permissions préservées (GRANT SELECT authenticated)

VALIDATION:
- TEST 1: Vue recréée sans erreur
- TEST 2: Définition contient 'general'/'restreint'
- TEST 3: Query entreprise retourne tickets (COUNT > 0)
- TEST 4: Frontend affiche liste tickets

IMPACT:
- Débloquer workflow entreprise (tickets visibles)
- Compatibilité totale M31-M35
- Masquage RGPD fonctionnel
- Pas de modification frontend (vue garde même nom)

DÉPENDANCES:
- M24: Création vue originale
- M35: Harmonisation données (public → general)
- Frontend: dashboard.html ligne 770 (.from('tickets_visibles_entreprise'))

DÉPLOIEMENT:
psql "$DATABASE_URL" -f supabase/migrations/20260104001300_m37_fix_vue_entreprise_terminologie.sql

STATUS: ✅ PRÊT POUR PRODUCTION (critique - débloque entreprises)
```

## Commande git

```bash
# Ajouter fichiers M37
git add supabase/migrations/20260104001300_m37_*.sql
git add CORRECTION_M37_VUE_ENTREPRISE.md
git add RECAP_RAPIDE_M37.md
git add ACTIONS_M37.md

# Commit
git commit -m "fix(entreprise): M37 - Correction terminologie vue tickets_visibles_entreprise

- Vue M24 utilisait 'public'/'assigné' (obsolète depuis M35)
- Mise à jour vers 'general'/'restreint' (harmonisation)
- Fix: Entreprises voient maintenant tickets mode general
- Documentation: CORRECTION_M37_VUE_ENTREPRISE.md

Root cause: Vue créée avant M35, WHERE ne match plus données harmonisées.
Impact: Critique (débloque workflow entreprise)."

# Push
git push origin main
```

---

**Date**: 2026-01-04  
**Type**: Correction critique (vue SQL)  
**Priorité**: 🔴 CRITIQUE (débloque workflow entreprise)
