# 🔍 RAPPORT AUDIT SUPABASE — État réel DB

**Date** : 06/01/2026 10:06:43  
**Supabase URL** : https://bwzyajsrmfhrxdmfpyqy.supabase.co  
**Status global** : ANOMALIE

---

## 📋 Tables (14 vérifiées)

| Table | Existe | Lignes | Notes |
|-------|--------|--------|-------|
| tickets | ✅ | 1 | - |
| missions | ✅ | 1 | - |
| factures | ✅ | 0 | - |
| tickets_disponibilites | ✅ | 1 | - |
| mission_signalements | ✅ | 0 | - |
| mission_historique_statuts | ✅ | 0 | - |
| profiles | ✅ | 7 | - |
| regies | ✅ | 1 | - |
| entreprises | ✅ | 1 | - |
| techniciens | ✅ | 2 | - |
| locataires | ✅ | 2 | - |
| logements | ✅ | 4 | - |
| immeubles | ✅ | 1 | - |
| regies_entreprises | ✅ | 1 | - |

---

## 📊 Vues (7 vérifiées)

| Vue | Existe | Lignes | Notes |
|-----|--------|--------|-------|
| factures_commissions_jtec | ✅ | 0 | - |
| factures_stats | ✅ | 1 | - |
| missions_details | ✅ | null | - |
| tickets_visibles_entreprise | ✅ | 1 | - |
| admin_stats_tickets_statuts | ✅ | null | - |
| admin_stats_tickets_categories | ✅ | 1 | - |
| admin_stats_tickets_priorites | ✅ | 1 | - |

---

## ⚙️ RPC (8 vérifiées)

| Fonction RPC | Existe | Notes |
|--------------|--------|-------|
| generate_facture_from_mission | ✅ | Erreur params attendue |
| accept_ticket_and_create_mission | ✅ | Erreur params attendue |
| assign_technicien_to_mission | ✅ | Erreur params attendue |
| create_ticket_locataire | ✅ | Erreur params attendue |
| diffuser_ticket | ✅ | Erreur params attendue |
| get_user_regie_id | ✅ | - |
| signaler_absence_locataire | ✅ | Erreur params attendue |
| ajouter_photos_mission | ✅ | Erreur params attendue |

---

## 📐 Colonnes critiques

### ⚠️ Table `tickets` : colonnes manquantes

- `valide_at`

### ⚠️ Table `missions` : colonnes manquantes

- `montant`

### ⚠️ Table `factures` : colonnes manquantes

- `id`
- `mission_id`
- `entreprise_id`
- `regie_id`
- `numero`
- `montant_ht`
- `montant_tva`
- `montant_ttc`
- `taux_tva`
- `montant_commission`
- `taux_commission`
- `statut`
- `date_emission`
- `date_echeance`


---

## ⚠️ Anomalies (3)

1. Table "tickets" colonnes manquantes : valide_at
2. Table "missions" colonnes manquantes : montant
3. Table "factures" colonnes manquantes : id, mission_id, entreprise_id, regie_id, numero, montant_ht, montant_tva, montant_ttc, taux_tva, montant_commission, taux_commission, statut, date_emission, date_echeance

---

## 🎯 Conclusion

❌ **ANOMALIES DÉTECTÉES**

Des objets manquent ou sont inaccessibles.
Correction requise AVANT implémentation P0/P1.

### Actions recommandées

1. Vérifier les migrations non appliquées dans `supabase/migrations`
2. Appliquer les migrations manquantes via Supabase CLI ou Dashboard
3. Re-exécuter cet audit
