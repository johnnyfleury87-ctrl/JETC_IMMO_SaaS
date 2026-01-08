# M55 : FIX FACTURATION SUISSE + LIGNES DE FACTURES

## 🎯 OBJECTIF
Corriger l'erreur 400 "column montant_tva can only be updated to DEFAULT" + Système de lignes de factures Suisse (TVA 8.1%, Commission JETC 2%)

---

## 📋 CE QUI EST CORRIGÉ

### 1. **Colonnes générées**
- ❌ AVANT: RPC `editer_facture` tentait d'UPDATE `montant_tva`, `montant_ttc`, `montant_commission` → **400 error**
- ✅ APRÈS: RPC n'update que `montant_ht`, `taux_tva`, `taux_commission` → colonnes générées se calculent auto

### 2. **Système de lignes**
- ✅ Table `facture_lignes` créée avec types: `main_oeuvre`, `materiel`, `deplacement`, `forfait`, `frais_divers`, `remise`
- ✅ Calcul automatique: `total_ht = quantite × prix_unitaire_ht` (GENERATED)
- ✅ Trigger: quand on ajoute/modifie/supprime une ligne → `factures.montant_ht` recalculé automatiquement
- ✅ TVA + Commission calculées automatiquement depuis `montant_ht`

### 3. **Logique Suisse**
- ✅ TVA par défaut: **8.1%** (modifiable)
- ✅ Commission JETC: **2.0%** du HT
- ✅ Formules:
  - `montant_tva = montant_ht × 8.1%`
  - `montant_commission = montant_ht × 2.0%`
  - `montant_ttc = montant_ht + montant_tva + montant_commission`

### 4. **Nouvelles RPC**
- ✅ `ajouter_ligne_facture(facture_id, type, description, quantite, unite, prix_unitaire_ht, tva_taux)`
- ✅ `modifier_ligne_facture(ligne_id, description, quantite, prix_unitaire_ht)`
- ✅ `supprimer_ligne_facture(ligne_id)`
- ✅ `editer_facture` CORRIGÉE (ne touche plus aux colonnes générées)

### 5. **RLS + Permissions**
- ✅ Entreprise: CRUD sur lignes si facture = brouillon
- ✅ Régie: lecture seule lignes si facture envoyée/payée
- ✅ Vue `factures_avec_lignes` pour récupérer facture + lignes en 1 requête

---

## 🚀 APPLICATION

### Étape 1: Appliquer la migration

```bash
cd /workspaces/JETC_IMMO_SaaS
supabase db push
```

**OU via dashboard Supabase:**
1. Aller sur https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql/new
2. Copier-coller le contenu de `supabase/migrations/20260108130000_m55_fix_facturation_suisse_lignes.sql`
3. Cliquer **RUN**

### Étape 2: Tester

```bash
node _test_m55_facturation_suisse.js
```

**Ce que le test fait:**
1. ✅ Vérifie table `facture_lignes` existe
2. ✅ Trouve une facture brouillon
3. ✅ Ajoute 4 lignes: matériel, main d'oeuvre, déplacement, remise
4. ✅ Vérifie recalcul auto de `montant_ht`
5. ✅ Vérifie TVA 8.1% + Commission 2.0%
6. ✅ Modifie une ligne
7. ✅ Teste RPC `editer_facture` corrigée (SANS erreur 400)

### Étape 3: Vérifier dans le dashboard

```sql
-- 1. Voir structure factures
SELECT id, numero_facture, montant_ht, taux_tva, montant_tva, 
       taux_commission, montant_commission, montant_ttc, statut
FROM factures
WHERE statut = 'brouillon'
LIMIT 5;

-- 2. Voir les lignes
SELECT f.numero_facture, fl.*
FROM facture_lignes fl
JOIN factures f ON fl.facture_id = f.id
ORDER BY f.numero_facture, fl.ordre;

-- 3. Vérifier calculs
SELECT 
  numero_facture,
  montant_ht,
  taux_tva,
  montant_tva,
  ROUND(montant_ht * (taux_tva / 100), 2) AS montant_tva_attendu,
  montant_tva = ROUND(montant_ht * (taux_tva / 100), 2) AS tva_ok,
  montant_commission,
  ROUND(montant_ht * (taux_commission / 100), 2) AS commission_attendue,
  montant_commission = ROUND(montant_ht * (taux_commission / 100), 2) AS commission_ok
FROM factures
WHERE statut = 'brouillon';
```

---

## 🎨 ADAPTATION FRONTEND

### Exemple: Éditer facture avec lignes

```javascript
// 1. Récupérer facture + lignes
const { data: facture } = await supabase
  .from('factures_avec_lignes')
  .select('*')
  .eq('id', factureId)
  .single();

console.log(facture.lignes); // Array de lignes

// 2. Ajouter ligne
const { data, error } = await supabase.rpc('ajouter_ligne_facture', {
  p_facture_id: factureId,
  p_type: 'main_oeuvre',
  p_description: 'Réparation robinet',
  p_quantite: 2.5,
  p_unite: 'h',
  p_prix_unitaire_ht: 80.00
});

// montant_ht de la facture est recalculé automatiquement !

// 3. Modifier ligne
await supabase.rpc('modifier_ligne_facture', {
  p_ligne_id: ligneId,
  p_quantite: 3.0
});

// 4. Supprimer ligne
await supabase.rpc('supprimer_ligne_facture', {
  p_ligne_id: ligneId
});

// 5. Éditer facture (sans erreur 400 maintenant)
await supabase.rpc('editer_facture', {
  p_facture_id: factureId,
  p_notes: 'Facture mise à jour',
  p_iban: 'CH93 0076 2011 6238 5295 7',
  p_taux_tva: 8.1,
  p_taux_commission: 2.0
});
// Ne met à jour QUE les colonnes sources, pas les calculées
```

### Types de lignes disponibles

| Type | Description | Exemple |
|------|-------------|---------|
| `main_oeuvre` | Heures de travail | 4h × 80 CHF/h |
| `materiel` | Matériaux utilisés | 10 tuyaux × 25.50 CHF |
| `deplacement` | Frais de déplacement | 62 km × 0.70 CHF/km |
| `forfait` | Forfait global | 1 × 500 CHF |
| `frais_divers` | Frais parking, péage | 1 × 15 CHF |
| `remise` | Réduction (négatif) | 1 × -50 CHF |
| `autre` | Autre type | À définir |

---

## 📊 EXEMPLE CONCRET

### Facture Suisse typique

```
Entreprise: Plomberie SA
Mission: Réparation fuite #2025-001

LIGNES:
1. Main d'oeuvre - Diagnostic et réparation    4.5h × 80.00 CHF   = 360.00 CHF
2. Matériel - Tuyau PVC Ø 50mm                 10 pcs × 25.50 CHF = 255.00 CHF
3. Déplacement - Genève-Lausanne               62 km × 0.70 CHF   =  43.40 CHF
4. Remise client fidèle                        1 forfait × -50 CHF = -50.00 CHF
                                                        ─────────────────────
                                                        TOTAL HT: 608.40 CHF
                                                        TVA 8.1%:  49.28 CHF
                                                        COMMISSION JETC 2%: 12.17 CHF
                                                        ─────────────────────
                                                        TOTAL TTC: 669.85 CHF
```

**Calculs automatiques:**
- `montant_ht = 360 + 255 + 43.40 - 50 = 608.40 CHF` (calculé par trigger)
- `montant_tva = 608.40 × 8.1% = 49.28 CHF` (colonne GENERATED)
- `montant_commission = 608.40 × 2% = 12.17 CHF` (colonne GENERATED)
- `montant_ttc = 608.40 + 49.28 + 12.17 = 669.85 CHF` (colonne GENERATED)

---

## ✅ CHECKLIST VALIDATION

### Base de données
- [ ] Migration M55 appliquée sans erreur
- [ ] Table `facture_lignes` existe
- [ ] Colonnes `montant_tva`, `montant_ttc`, `montant_commission` sont GENERATED
- [ ] Taux par défaut: TVA 8.1%, Commission 2.0%
- [ ] Triggers de recalcul actifs
- [ ] RLS policies actives

### RPC
- [ ] `ajouter_ligne_facture` fonctionne
- [ ] `modifier_ligne_facture` fonctionne
- [ ] `supprimer_ligne_facture` fonctionne
- [ ] `editer_facture` corrigée (PAS d'erreur 400)

### Tests
- [ ] Script `_test_m55_facturation_suisse.js` passe
- [ ] Ajout de 4 lignes OK
- [ ] Recalcul auto `montant_ht` OK
- [ ] TVA 8.1% calculée correctement
- [ ] Commission 2% calculée correctement

### Frontend (à faire)
- [ ] UI pour ajouter/modifier/supprimer lignes
- [ ] Affichage détaillé des lignes dans facture
- [ ] Totaux affichés: HT, TVA, Commission, TTC
- [ ] Workflow brouillon → envoyée → payée/refusée

---

## 🔧 DÉPANNAGE

### Erreur: "column montant_tva can only be updated to DEFAULT"
→ La RPC `editer_facture` tente encore d'updater des colonnes générées
→ Vérifier que M55 est bien appliquée: `SELECT proname FROM pg_proc WHERE proname = 'editer_facture';`

### Montant_ht ne se recalcule pas
→ Vérifier triggers: 
```sql
SELECT trigger_name, event_manipulation 
FROM information_schema.triggers 
WHERE event_object_table = 'facture_lignes';
```
→ Doit afficher: `trigger_recalcul_montant_after_insert`, `_after_update`, `_after_delete`

### TVA pas 8.1%
→ Vérifier: `SELECT taux_tva FROM factures WHERE statut = 'brouillon';`
→ Si 20%, c'est l'ancien taux français. Exécuter:
```sql
UPDATE factures SET taux_tva = 8.1 WHERE taux_tva = 20.0;
```

---

## 📞 SUPPORT

En cas de problème:
1. Lancer `node _test_m55_facturation_suisse.js`
2. Vérifier logs Supabase Dashboard → Logs → Postgres
3. Tester manuellement les RPC dans SQL Editor

**LA MIGRATION M55 CORRIGE DÉFINITIVEMENT L'ERREUR 400 !** 🎉
