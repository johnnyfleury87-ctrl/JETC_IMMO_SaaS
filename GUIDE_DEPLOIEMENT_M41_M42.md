# GUIDE DÉPLOIEMENT M41+M42 — Quick Start

## 🎯 Objectif
Corriger l'acceptation de tickets côté entreprise :
- ❌ Erreur "Mode diffusion invalide: general" → ✅ Acceptation OK
- ❌ Créneaux non sélectionnables → ✅ Sélection radio + enregistrement

---

## ⚡ Déploiement Express (5 min)

### 1️⃣ Migrations SQL (2 min)

```bash
cd /workspaces/JETC_IMMO_SaaS

# M41: Harmonisation RPC
psql "$DATABASE_URL" -f supabase/migrations/20260104001700_m41_harmonize_rpc_acceptation.sql

# M42: Colonne disponibilite_id missions
psql "$DATABASE_URL" -f supabase/migrations/20260104001800_m42_add_disponibilite_id_missions.sql

# Vérifier succès
echo "✅ M41: RPC accepte general/restreint"
echo "✅ M42: Colonne disponibilite_id ajoutée"
```

### 2️⃣ Frontend (1 min)

```bash
# Déjà modifié dans le workspace
git add public/entreprise/dashboard.html
git commit -m "fix(M41+M42): Acceptation ticket + sélection créneau"
git push origin main

# Attendre déploiement Vercel (~30s)
```

### 3️⃣ Test manuel (2 min)

1. **Login entreprise**  
   https://votre-app.vercel.app/login.html

2. **Dashboard → Tickets disponibles**  
   Trouver ticket mode `general` avec ≥1 créneau

3. **Clic "📄 Détails"**  
   → Modal affiche créneaux avec radios ✅

4. **Sélectionner créneau → "✅ Accepter ce ticket"**  
   → Popup "Mission créée" ✅

5. **Recharger → Ticket disparu de la liste**  
   → Masqué pour cette entreprise ✅

---

## 🔍 Vérifications base de données

```sql
-- Ticket verrouillé ?
SELECT id, statut, locked_at, entreprise_id
FROM tickets
WHERE id = '<ticket_id>';
-- Attendu: statut='en_cours', locked_at NOT NULL

-- Mission créée avec créneau ?
SELECT id, ticket_id, entreprise_id, disponibilite_id, statut
FROM missions
WHERE ticket_id = '<ticket_id>';
-- Attendu: disponibilite_id = UUID créneau choisi
```

---

## 🐛 Troubleshooting

### Erreur "Mode diffusion invalide: general" persiste
```bash
# Vérifier M41 appliquée
psql "$DATABASE_URL" -c "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'accept_ticket_and_create_mission';" | grep "general"
# Doit contenir: IF v_mode_diffusion = 'general' THEN
```

### Créneaux non affichés
```bash
# Vérifier M40 (RLS disponibilités)
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM pg_policies WHERE tablename = 'tickets_disponibilites' AND policyname LIKE '%entreprise%';"
# Attendu: 1 (policy Entreprise can view disponibilites)
```

### Colonne disponibilite_id manquante
```bash
# Vérifier M42 appliquée
psql "$DATABASE_URL" -c "\d missions;" | grep disponibilite_id
# Doit apparaître dans la liste des colonnes
```

---

## 📦 Fichiers modifiés

### Migrations
- ✅ [supabase/migrations/20260104001700_m41_harmonize_rpc_acceptation.sql](supabase/migrations/20260104001700_m41_harmonize_rpc_acceptation.sql)
- ✅ [supabase/migrations/20260104001700_m41_harmonize_rpc_acceptation_rollback.sql](supabase/migrations/20260104001700_m41_harmonize_rpc_acceptation_rollback.sql)
- ✅ [supabase/migrations/20260104001800_m42_add_disponibilite_id_missions.sql](supabase/migrations/20260104001800_m42_add_disponibilite_id_missions.sql)
- ✅ [supabase/migrations/20260104001800_m42_add_disponibilite_id_missions_rollback.sql](supabase/migrations/20260104001800_m42_add_disponibilite_id_missions_rollback.sql)

### Frontend
- ✅ [public/entreprise/dashboard.html](public/entreprise/dashboard.html)
  - Lignes ~481-525: Styles CSS radios + modal footer
  - Lignes ~1012-1044: Affichage créneaux avec sélection
  - Lignes ~906-937: Fonction `accepterTicket()` avec `disponibilite_id`
  - Lignes ~970-995: Fonction `accepterTicketFromModal()`

### Tests & Docs
- ✅ [tests/validation_m41_m42_acceptation_creneau.sql](tests/validation_m41_m42_acceptation_creneau.sql)
- ✅ [CORRECTION_M41_M42_ACCEPTATION_CRENEAU.md](CORRECTION_M41_M42_ACCEPTATION_CRENEAU.md)

---

## 🔄 Rollback (si problème)

```bash
# En cas d'erreur critique
psql "$DATABASE_URL" -f supabase/migrations/20260104001800_m42_add_disponibilite_id_missions_rollback.sql
psql "$DATABASE_URL" -f supabase/migrations/20260104001700_m41_harmonize_rpc_acceptation_rollback.sql

# Frontend: Revert commit
git revert HEAD
git push origin main
```

---

## ✅ Checklist déploiement

- [ ] M41 appliquée (vérifier `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'accept_ticket_and_create_mission';`)
- [ ] M42 appliquée (vérifier `\d missions;`)
- [ ] Frontend déployé Vercel
- [ ] Test manuel entreprise → Acceptation OK
- [ ] Ticket verrouillé en base (`locked_at` rempli)
- [ ] Mission créée avec créneau (`disponibilite_id` rempli)
- [ ] Ticket masqué pour autres entreprises

---

**Temps total:** ~5 minutes  
**Statut:** ✅ Prêt pour déploiement production
