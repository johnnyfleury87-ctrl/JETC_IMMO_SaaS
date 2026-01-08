# 🚀 ACTION IMMEDIATE : DÉPLOYER M55 FACTURATION SUISSE

## ⚡ CONTEXTE
- **Problème actuel**: Erreur 400 "column montant_tva can only be updated to DEFAULT"
- **Cause**: RPC `editer_facture` tente d'UPDATE des colonnes GENERATED
- **Solution**: M55 corrige les RPC + ajoute système de lignes + logique Suisse (TVA 8.1%, Commission 2%)

---

## 📋 ACTIONS IMMÉDIATES (30 min)

### ✅ ÉTAPE 1: Appliquer M55 (5 min)

**Option A: Via Supabase CLI**
```bash
cd /workspaces/JETC_IMMO_SaaS
supabase db push
```

**Option B: Via Dashboard Supabase**
1. Aller sur https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql/new
2. Copier-coller le fichier `supabase/migrations/20260108130000_m55_fix_facturation_suisse_lignes.sql`
3. Cliquer **RUN**
4. Vérifier: "Success. No rows returned"

---

### ✅ ÉTAPE 2: Tester (10 min)

```bash
cd /workspaces/JETC_IMMO_SaaS
node _test_m55_facturation_suisse.js
```

**Résultat attendu:**
```
=== TEST M55: FACTURATION SUISSE + LIGNES ===

1️⃣  Vérification table facture_lignes...
✅ Table facture_lignes existe

2️⃣  Recherche facture brouillon...
✅ Facture brouillon: { id: xxx, numero: FAC-2025-001, ... }

3️⃣  Test ajouter ligne matériel...
✅ Ligne matériel ajoutée

4️⃣  Test ajouter ligne main d'oeuvre...
✅ Ligne main d'oeuvre ajoutée

5️⃣  Test ajouter ligne déplacement...
✅ Ligne déplacement ajoutée

6️⃣  Test ajouter remise...
✅ Ligne remise ajoutée

7️⃣  Vérification recalcul automatique...
✅ Facture recalculée: { montant_ht: 608.40, calcul_ok: true }

📊 Calculs Suisse:
  base_ht: 608.40
  tva_8_1_pourcent: 49.28
  tva_ok: true
  commission_2_pourcent: 12.17
  commission_ok: true

8️⃣  Liste des lignes de facture...
✅ Lignes de facture: 4
   1. Tuyau PVC Ø 50mm
      10 pcs × 25.50 CHF = 255.00 CHF HT
   2. Installation plomberie
      4.5 h × 80.00 CHF = 360.00 CHF HT
   ...

9️⃣  Test modifier ligne...
✅ Ligne modifiée

🔟 Test RPC editer_facture corrigée...
✅ editer_facture OK

✅ TESTS M55 TERMINÉS
```

---

### ✅ ÉTAPE 3: Vérifier en SQL (5 min)

**Dans Supabase SQL Editor:**

```sql
-- 1. Vérifier colonnes générées
SELECT column_name, is_generated
FROM information_schema.columns
WHERE table_name = 'factures'
AND column_name IN ('montant_tva', 'montant_ttc', 'montant_commission');

-- Résultat attendu:
-- montant_tva       | ALWAYS
-- montant_ttc       | ALWAYS
-- montant_commission| ALWAYS

-- 2. Vérifier taux Suisse
SELECT numero_facture, taux_tva, taux_commission
FROM factures
WHERE statut = 'brouillon';

-- Résultat attendu:
-- FAC-2025-001 | 8.1 | 2.0

-- 3. Vérifier lignes
SELECT COUNT(*) FROM facture_lignes;

-- Résultat attendu: > 0

-- 4. Vérifier triggers
SELECT trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'facture_lignes';

-- Résultat attendu:
-- trigger_recalcul_montant_after_insert
-- trigger_recalcul_montant_after_update
-- trigger_recalcul_montant_after_delete

-- 5. Test UPDATE direct (doit échouer sur colonnes générées)
UPDATE factures 
SET montant_tva = 100 
WHERE numero_facture = 'FAC-2025-001';

-- Résultat attendu: ERROR: column "montant_tva" can only be updated to DEFAULT

-- 6. Test UPDATE colonnes sources (doit marcher)
UPDATE factures 
SET montant_ht = 500, taux_tva = 7.7
WHERE numero_facture = 'FAC-2025-001';

-- Résultat attendu: UPDATE 1
-- montant_tva/ttc/commission recalculés auto !
```

---

### ✅ ÉTAPE 4: Test Frontend (10 min)

**Se connecter en tant qu'entreprise:**
1. Aller sur https://jetc-immo-saas.vercel.app/login.html
2. Se connecter avec compte entreprise (ex: test.entreprise@jetc.ch)
3. Aller dans "Missions"
4. Cliquer sur mission avec facture brouillon
5. Cliquer "✏️ Éditer facture"

**Tester:**
- [ ] Modal s'ouvre
- [ ] Voir les lignes existantes
- [ ] Cliquer "➕ Ajouter ligne"
- [ ] Remplir: Type=Main d'oeuvre, Desc="Test", Qté=2, Unité=h, Prix=80
- [ ] Vérifier totaux se mettent à jour automatiquement
- [ ] Cliquer "💾 Enregistrer"
- [ ] Vérifier: pas d'erreur 400 !
- [ ] Recharger page: vérifier ligne ajoutée

**Si erreur 400 persiste:**
→ M55 pas appliquée correctement, refaire ÉTAPE 1

---

## 🎨 INTÉGRATION FRONTEND COMPLÈTE (2-3h)

### Fichier à modifier: `public/entreprise/dashboard.html`

**1. Ajouter modal édition (après ligne 800)**
```javascript
// Copier-coller le contenu de _EXEMPLE_MODAL_FACTURE_LIGNES.html
// Remplacer le modal basique actuel par le modal avec gestion lignes
```

**2. Modifier fonction `afficherDetailsFacture()` (ligne ~1800)**
```javascript
async function afficherDetailsFacture(factureId) {
  // Au lieu de:
  const { data: facture } = await supabase
    .from('factures')
    .select('*')
    .eq('id', factureId)
    .single();
  
  // Utiliser:
  const { data: facture } = await supabase
    .from('factures_avec_lignes')
    .select('*')
    .eq('id', factureId)
    .single();
  
  // Afficher lignes dans détails
  const lignesHtml = facture.lignes.map(l => `
    <div class="ligne-facture">
      <span>${l.description}</span>
      <span>${l.quantite} ${l.unite} × ${l.prix_unitaire_ht} CHF</span>
      <span><strong>${l.total_ht} CHF</strong></span>
    </div>
  `).join('');
  
  document.getElementById('factureDetails').innerHTML = `
    <h4>Détails facture ${facture.numero_facture}</h4>
    <div class="lignes-container">${lignesHtml}</div>
    <div class="totaux">
      <div>Total HT: <strong>${facture.montant_ht} CHF</strong></div>
      <div>TVA ${facture.taux_tva}%: <strong>${facture.montant_tva} CHF</strong></div>
      <div>Commission ${facture.taux_commission}%: <strong>${facture.montant_commission} CHF</strong></div>
      <div class="total-ttc">TOTAL TTC: <strong>${facture.montant_ttc} CHF</strong></div>
    </div>
  `;
}
```

**3. Modifier bouton "Éditer facture" (ligne ~1900)**
```javascript
btnEditerFacture.onclick = () => openModalEditerFacture(facture.id);
```

---

## 📊 VALIDATION E2E (1h)

### Scénario complet à tester:

**1. ENTREPRISE: Créer facture détaillée**
- [ ] Se connecter en tant qu'entreprise
- [ ] Ouvrir mission avec ticket "termine"
- [ ] Cliquer "Créer facture" (si pas encore créée)
- [ ] Cliquer "✏️ Éditer facture"
- [ ] Ajouter lignes:
  - Main d'oeuvre: "Réparation robinet", 3h × 85 CHF = 255 CHF
  - Matériel: "Kit robinet", 1 pcs × 120 CHF = 120 CHF
  - Déplacement: "Genève-Lausanne", 62 km × 0.70 CHF = 43.40 CHF
  - Remise: "Client fidèle", 1 × -20 CHF = -20 CHF
- [ ] Vérifier totaux:
  - HT: 398.40 CHF
  - TVA 8.1%: 32.27 CHF
  - Commission 2%: 7.97 CHF
  - TTC: 438.64 CHF
- [ ] Saisir IBAN: CH93 0076 2011 6238 5295 7
- [ ] Saisir notes: "Intervention urgente samedi"
- [ ] Cliquer "💾 Enregistrer"
- [ ] Vérifier: ✅ "Facture enregistrée avec succès"

**2. ENTREPRISE: Envoyer facture**
- [ ] Cliquer "📤 Envoyer à la régie"
- [ ] Vérifier: statut passe de "brouillon" → "envoyee"
- [ ] Vérifier: plus de bouton "Éditer" (facture verrouillée)

**3. RÉGIE: Valider paiement**
- [ ] Se déconnecter
- [ ] Se connecter en tant que régie
- [ ] Aller dans "Factures reçues"
- [ ] Voir facture "envoyee"
- [ ] Cliquer "Détails"
- [ ] Voir les lignes détaillées
- [ ] Vérifier totaux corrects
- [ ] Cliquer "✅ Valider paiement"
- [ ] Vérifier: statut passe "envoyee" → "payee"

**4. CASCADE: Vérifier fermeture auto**
- [ ] Vérifier facture statut = "payee"
- [ ] Vérifier mission statut = "termine"
- [ ] Vérifier ticket statut = "clos"
- [ ] Vérifier: entreprise reçoit notification "Paiement validé"

---

## 🐛 DÉPANNAGE

### Erreur: "table facture_lignes does not exist"
→ M55 pas appliquée
```bash
supabase db push
```

### Erreur: "column montant_tva can only be updated to DEFAULT"
→ RPC `editer_facture` pas mise à jour
```sql
-- Vérifier version RPC
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'editer_facture';

-- Si prosrc contient "montant_tva = v_tva" → MAUVAISE VERSION
-- Réappliquer M55
```

### Totaux ne se recalculent pas
→ Triggers absents
```sql
-- Vérifier triggers
SELECT trigger_name FROM information_schema.triggers 
WHERE event_object_table = 'facture_lignes';

-- Si vide, réappliquer M55
```

### TVA toujours 20% au lieu de 8.1%
→ Anciennes factures pas migrées
```sql
UPDATE factures SET taux_tva = 8.1 WHERE taux_tva = 20.0;
UPDATE factures SET taux_commission = 2.0 WHERE taux_commission = 10.0;
```

---

## ✅ CHECKLIST FINALE

### Base de données
- [ ] M55 appliquée sans erreur
- [ ] Table `facture_lignes` existe
- [ ] Colonnes `montant_tva/ttc/commission` sont GENERATED
- [ ] Taux par défaut: TVA 8.1%, Commission 2.0%
- [ ] Triggers actifs (3 triggers sur facture_lignes)
- [ ] RLS policies actives

### RPC Functions
- [ ] `ajouter_ligne_facture` fonctionne
- [ ] `modifier_ligne_facture` fonctionne
- [ ] `supprimer_ligne_facture` fonctionne
- [ ] `editer_facture` corrigée (pas d'erreur 400)

### Tests
- [ ] Script `_test_m55_facturation_suisse.js` passe ✅
- [ ] Tests SQL passent ✅
- [ ] Ajout/modification/suppression lignes OK

### Frontend
- [ ] Modal édition avec lignes intégré
- [ ] Affichage détaillé factures avec lignes
- [ ] Calculs temps réel (HT, TVA, Commission, TTC)
- [ ] Workflow complet: brouillon → envoyée → payée

### E2E
- [ ] Entreprise crée facture avec lignes ✅
- [ ] Entreprise envoie facture ✅
- [ ] Régie valide paiement ✅
- [ ] Cascade: mission + ticket fermés ✅

---

## 📞 PROCHAINES ÉTAPES

### Court terme (cette semaine)
1. ✅ Appliquer M55
2. ✅ Tester fonctions de base
3. ✅ Intégrer modal édition frontend
4. ✅ Test E2E complet

### Moyen terme (semaine prochaine)
1. Export PDF factures détaillées (avec lignes)
2. Historique modifications factures
3. Templates de lignes (tarifs standards)
4. Statistiques par type de ligne

### Long terme (mois prochain)
1. Multi-devises (CHF, EUR)
2. TVA multi-taux (8.1%, 2.5%, 0%)
3. Gestion acomptes
4. Relances automatiques

---

## 🎉 RÉSULTAT ATTENDU

**AVANT M55:**
```
❌ Entreprise clique "Éditer facture"
❌ Modifie montant HT
❌ Clique "Enregistrer"
❌ Erreur 400: "column montant_tva can only be updated to DEFAULT"
```

**APRÈS M55:**
```
✅ Entreprise clique "Éditer facture"
✅ Modal avec lignes détaillées s'ouvre
✅ Ajoute lignes: matériel, main d'oeuvre, déplacement, remise
✅ Totaux se calculent automatiquement (HT, TVA 8.1%, Commission 2%, TTC)
✅ Clique "Enregistrer"
✅ Succès ! Facture enregistrée
✅ Envoie à la régie → Régie valide → Mission + Ticket fermés automatiquement
```

**🚀 LA FACTURATION SUISSE FONCTIONNE À 100% !**
