# 🚀 GUIDE DÉPLOIEMENT WORKFLOW TICKETS M31-M35

## 📋 Contexte

Ce guide explique comment déployer les corrections du workflow tickets régie-entreprise (M31 à M35) suite à l'audit complet du système.

## 🐛 Problèmes corrigés

### 1. **Bug JavaScript bloquant (CRITIQUE)**
- **Erreur**: `Uncaught SyntaxError: missing ) after argument list` dans `tickets.html` ligne 792
- **Cause**: Appel de `escapeHtml()` à l'intérieur d'un attribut `onclick` causait un double échappement
- **Solution**: Utilisation de `data-attributes` au lieu de passer les valeurs directement dans onclick

### 2. **Incohérence terminologie mode_diffusion**
- **Problème**: Migrations M32/M34 utilisaient `'general'` et `'restreint'`, mais policy RLS utilisait `'public'` et `'assigné'`
- **Impact**: Les policies RLS ne filtraient AUCUN ticket pour les entreprises !
- **Solution**: Migration M35 harmonise tout sur `'general'` et `'restreint'`

### 3. **Workflow non optimisé**
- **Problème**: Frontend appelait 2 RPC séparées (`update_ticket_regie` + `update_ticket_statut`)
- **Solution**: RPC unique `valider_ticket_regie` (M32) qui fait validation + diffusion en 1 appel

### 4. **Colonnes traçabilité manquantes**
- **Problème**: Colonnes M31 n'existaient pas dans la base (audit CSV)
- **Solution**: Migration M31 ajoute `plafond_valide_par/at` et `diffuse_par/at`

## 📦 Fichiers modifiés/créés

### Frontend
- ✅ `/public/regie/tickets.html` - Corrections JS + utilisation RPC M32

### Migrations SQL
- ✅ `20251227000700_m31_add_tracabilite_tickets.sql` - Colonnes traçabilité
- ✅ `20251227000800_m32_rpc_valider_ticket_regie.sql` - RPC validation unique
- ✅ `20251227000900_m33_rpc_get_entreprises_autorisees.sql` - Helper pour régie
- ✅ `20251227001000_m34_rls_entreprise_tickets.sql` - Policies RLS entreprise
- ✅ `20251227001100_m35_harmonize_mode_diffusion.sql` - Harmonisation terminologie
- ✅ `20260104000000_m31_m35_workflow_complet_consolidated.sql` - **Migration consolidée**

### Tests
- ✅ `/tests/validation_ticket_workflow.sql` - Script de validation mis à jour

## 🔧 Procédure de déploiement

### ÉTAPE 1: Sauvegarde base de données

```bash
# Backup complet avant déploiement
pg_dump -h <host> -U postgres -d postgres > backup_pre_m31_m35_$(date +%Y%m%d_%H%M%S).sql
```

### ÉTAPE 2: Appliquer les migrations SQL

**Option A: Migration consolidée (recommandé)**

```bash
# Appliquer toutes les migrations M31-M35 en une seule fois
psql -h <host> -U postgres -d postgres -f supabase/migrations/20260104000000_m31_m35_workflow_complet_consolidated.sql
```

**Option B: Migrations individuelles**

```bash
# Appliquer dans l'ordre
psql -h <host> -U postgres -d postgres -f supabase/migrations/20251227000700_m31_add_tracabilite_tickets.sql
psql -h <host> -U postgres -d postgres -f supabase/migrations/20251227000800_m32_rpc_valider_ticket_regie.sql
psql -h <host> -U postgres -d postgres -f supabase/migrations/20251227000900_m33_rpc_get_entreprises_autorisees.sql
psql -h <host> -U postgres -d postgres -f supabase/migrations/20251227001000_m34_rls_entreprise_tickets.sql
psql -h <host> -U postgres -d postgres -f supabase/migrations/20251227001100_m35_harmonize_mode_diffusion.sql
```

### ÉTAPE 3: Déployer le frontend

```bash
# 1. Commit des changements
git add public/regie/tickets.html
git commit -m "fix(tickets): Correction bug JS validation + intégration RPC M32"

# 2. Push vers Vercel
git push origin main

# 3. Vérifier déploiement Vercel
vercel --prod
```

### ÉTAPE 4: Tests de validation

```bash
# Exécuter le script de validation
psql -h <host> -U postgres -d postgres -f tests/validation_ticket_workflow.sql
```

### ÉTAPE 5: Tests manuels

#### Test 1: Régie valide un ticket nouveau

1. Se connecter en tant que **régie**
2. Aller sur `/regie/tickets.html`
3. Cliquer sur "✅ Valider" sur un ticket nouveau
4. Vérifier que le modal affiche:
   - Priorité
   - Plafond (obligatoire)
   - Mode de diffusion (général/restreint)
   - Champ entreprise (si restreint)
5. Valider le ticket
6. **Attendu**: 
   - Ticket passe en statut `en_attente` (plus `ouvert`!)
   - Toast de succès
   - Ticket disparaît de la section "Nouveaux"
   - Ticket apparaît dans "En attente"

#### Test 2: Entreprise voit tickets mode GENERAL

1. Se connecter en tant qu'**entreprise**
2. Vérifier que les tickets en mode `general` sont visibles
3. **Attendu**: Voir tous les tickets diffusés en mode general par les régies autorisées

#### Test 3: Entreprise voit tickets mode RESTREINT

1. Se connecter en tant qu'**entreprise assignée**
2. Vérifier que le ticket en mode `restreint` est visible
3. Se connecter en tant qu'**autre entreprise**
4. **Attendu**: Ticket restreint non visible

## ✅ Validation post-déploiement

### Checklist technique

- [ ] Colonnes M31 existent (`plafond_valide_par`, `plafond_valide_at`, `diffuse_par`, `diffuse_at`)
- [ ] RPC M32 `valider_ticket_regie` créée et exécutable
- [ ] RPC M33 `get_entreprises_autorisees` créée et exécutable
- [ ] Policies RLS M34-M35 créées avec bons noms
- [ ] Aucune valeur obsolète (`public`, `assigné`) dans `tickets.mode_diffusion`
- [ ] Frontend charge sans erreur JS console
- [ ] Bouton "Valider" fonctionne sans erreur syntax

### Checklist fonctionnelle

- [ ] Régie peut valider un ticket avec plafond et mode
- [ ] Ticket validé passe directement en `en_attente` (pas `ouvert`)
- [ ] Colonnes traçabilité remplies après validation
- [ ] Entreprise voit tickets mode `general` de ses régies
- [ ] Entreprise assignée voit tickets mode `restreint`
- [ ] Autre entreprise ne voit PAS tickets mode `restreint`

## 🔄 Rollback (si nécessaire)

```bash
# Restaurer backup
psql -h <host> -U postgres -d postgres < backup_pre_m31_m35_<timestamp>.sql

# Ou rollback individuel
psql -h <host> -U postgres -d postgres -f supabase/migrations/20251227001100_m35_harmonize_mode_diffusion_rollback.sql
psql -h <host> -U postgres -d postgres -f supabase/migrations/20251227001000_m34_rls_entreprise_tickets_rollback.sql
psql -h <host> -U postgres -d postgres -f supabase/migrations/20251227000900_m33_rpc_get_entreprises_autorisees_rollback.sql
psql -h <host> -U postgres -d postgres -f supabase/migrations/20251227000800_m32_rpc_valider_ticket_regie_rollback.sql
psql -h <host> -U postgres -d postgres -f supabase/migrations/20251227000700_m31_add_tracabilite_tickets_rollback.sql
```

## 📊 Monitoring post-déploiement

### Requêtes SQL utiles

```sql
-- Vérifier tickets validés récemment
SELECT 
  id, titre, statut, mode_diffusion,
  plafond_valide_par, plafond_valide_at,
  diffuse_par, diffuse_at
FROM tickets
WHERE plafond_valide_at > NOW() - INTERVAL '24 hours'
ORDER BY plafond_valide_at DESC;

-- Vérifier distribution mode_diffusion
SELECT 
  mode_diffusion, 
  statut,
  COUNT(*) as nb_tickets
FROM tickets
GROUP BY mode_diffusion, statut
ORDER BY mode_diffusion, statut;

-- Vérifier policies RLS actives
SELECT 
  schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'tickets'
  AND policyname LIKE '%Entreprise%'
ORDER BY policyname;
```

## 🆘 Support

### Erreurs courantes

#### 1. "missing ) after argument list"
- **Cause**: Version ancienne de `tickets.html` déployée
- **Solution**: Forcer redéploiement Vercel

#### 2. "function valider_ticket_regie does not exist"
- **Cause**: Migration M32 pas appliquée
- **Solution**: Exécuter migration consolidée

#### 3. Entreprise ne voit aucun ticket
- **Cause**: Terminologie obsolète (`public`/`assigné`) dans la base
- **Solution**: Exécuter migration M35

#### 4. Ticket reste en statut `nouveau` après validation
- **Cause**: Frontend utilise encore anciennes RPC
- **Solution**: Vérifier que le nouveau `tickets.html` est déployé

## 📚 Références

- Audit complet: `AUDIT_COMPLET_TICKETS_SYSTEME.md`
- Migrations M31-M34: Dossier `supabase/migrations/`
- Tests: `tests/validation_ticket_workflow.sql`
- CSV audit: `supabase/Audit_supabase/*.csv`

---

**Date de création**: 2026-01-04  
**Auteur**: GitHub Copilot  
**Version**: 1.0
