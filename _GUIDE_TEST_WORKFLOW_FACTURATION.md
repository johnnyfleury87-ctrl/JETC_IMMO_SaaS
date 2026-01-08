# 🧪 TEST WORKFLOW FACTURATION COMPLET

## 📋 GUIDE D'APPLICATION ET TEST

### ÉTAPE 1: APPLICATION SQL (OBLIGATOIRE)

1. **Ouvrir Supabase SQL Editor:**
   ```
   https://supabase.com/project/bwzyajsrmfhrxdmfpyqy/sql/new
   ```

2. **Copier-coller le fichier:**
   ```
   supabase/migrations/20260108120000_m54_rpc_editer_envoyer_factures.sql
   ```

3. **Exécuter** et vérifier qu'il n'y a pas d'erreur

4. **Vérifier que les RPC sont créées:**
   Dans l'interface Supabase → Database → Functions, vous devriez voir:
   - ✅ `editer_facture`
   - ✅ `envoyer_facture`
   - ✅ `valider_paiement_facture`
   - ✅ `refuser_facture`

---

### ÉTAPE 2: TEST BACKEND (Script)

Exécuter le script de test:
```bash
node _TEST_WORKFLOW_FACTURATION_COMPLET.js
```

Ce script va:
1. ✅ Vérifier que les RPC existent
2. ✅ Tester l'édition d'une facture brouillon
3. ✅ Tester l'envoi d'une facture à la régie
4. ✅ Afficher les statuts avant/après

---

### ÉTAPE 3: TEST FRONTEND (Manuel)

#### A. Connexion Entreprise

1. **Se connecter** en tant qu'entreprise:
   ```
   https://jetc-immo-saas.vercel.app/
   Email: test-entreprise@jetc.ch (ou votre entreprise de test)
   ```

2. **Aller dans "Mes Missions"**
   - Vérifier qu'il y a au moins une mission terminée

3. **Cliquer sur "💳 Créer la facture"** (si pas de facture)
   - Remplir montant HT, IBAN, description
   - Cliquer "Créer"
   - ✅ PREUVE: Capture d'écran de la confirmation

4. **Aller dans "Factures"**
   - Vérifier que la facture apparaît en statut "Brouillon"
   - ✅ PREUVE: Capture d'écran de la liste

5. **Cliquer sur "✏️ Éditer"**
   - Modifier le montant HT (ex: passer de 100 à 150)
   - Modifier l'IBAN ou la description
   - Cliquer "Mettre à jour"
   - ✅ PREUVE: Capture d'écran du formulaire d'édition
   - ✅ PREUVE: Capture après sauvegarde montrant le nouveau montant

6. **Cliquer sur "📤 Envoyer à la régie"**
   - Confirmer l'envoi
   - Vérifier que le statut passe à "Envoyée"
   - Vérifier que le bouton "Éditer" disparaît
   - ✅ PREUVE: Capture d'écran statut "Envoyée"

#### B. Connexion Régie

7. **Se connecter** en tant que régie:
   ```
   Email: test-regie@jetc.ch (ou votre régie de test)
   ```

8. **Aller dans Dashboard Régie**
   - Vérifier qu'on voit les factures envoyées
   - ✅ PREUVE: Capture d'écran de la liste côté régie

9. **Cliquer sur "🟢 Marquer payée"** (pour une facture envoyée)
   - Confirmer le paiement
   - Vérifier que le statut passe à "Payée"
   - ✅ PREUVE: Capture d'écran statut "Payée"

10. **Vérifier l'effet cascade:**
    - Aller dans les tickets
    - Vérifier que le ticket lié est maintenant "Clos"
    - ✅ PREUVE: Capture d'écran du ticket clos

#### C. Vérification Admin

11. **Se connecter** en tant qu'admin:
    ```
    https://jetc-immo-saas.vercel.app/admin/
    ```

12. **Vérifier les statuts synchronisés:**
    - Ticket: "Clos"
    - Mission: "Clos"
    - Facture: "Payée"
    - ✅ PREUVE: Capture d'écran du dashboard admin

---

### ÉTAPE 4: TEST SQL (Preuve technique)

Exécuter dans Supabase SQL Editor:
```sql
-- Afficher l'état complet d'une facture et sa cascade
SELECT 
  f.numero AS facture,
  f.statut AS facture_statut,
  f.date_envoi,
  f.date_paiement,
  f.montant_ttc,
  m.id AS mission_id,
  m.statut AS mission_statut,
  t.id AS ticket_id,
  t.statut AS ticket_statut,
  t.date_cloture
FROM factures f
JOIN missions m ON f.mission_id = m.id
JOIN tickets t ON m.ticket_id = t.id
WHERE f.statut = 'payee'
ORDER BY f.date_paiement DESC
LIMIT 5;
```

✅ PREUVE: Capture d'écran des résultats SQL

---

## 📊 CHECKLIST DE VALIDATION

### Backend
- [ ] Migration M54 appliquée sans erreur
- [ ] RPC `editer_facture` existe et fonctionne
- [ ] RPC `envoyer_facture` existe et fonctionne
- [ ] RPC `valider_paiement_facture` existe et fonctionne
- [ ] RPC `refuser_facture` existe et fonctionne

### UI Entreprise
- [ ] Bouton "Éditer" visible sur factures brouillon
- [ ] Modal d'édition se remplit avec les données existantes
- [ ] Sauvegarde d'édition fonctionne
- [ ] Bouton "Envoyer à la régie" visible (si facture complète)
- [ ] Envoi change le statut à "envoyée"
- [ ] Bouton "Éditer" disparaît après envoi

### UI Régie
- [ ] Factures envoyées visibles dans le dashboard
- [ ] Bouton "Marquer payée" fonctionnel
- [ ] Bouton "Refuser" fonctionnel

### Cascade Automatique
- [ ] Facture payée → Mission clos
- [ ] Facture payée → Ticket clos
- [ ] Date de clôture renseignée
- [ ] Date de paiement renseignée

---

## 🎯 RÉSULTAT ATTENDU

✅ **WORKFLOW COMPLET OPÉRATIONNEL:**

1. Mission terminée → Facture brouillon créée automatiquement
2. Entreprise édite la facture (montant, IBAN, description)
3. Entreprise envoie la facture à la régie
4. Régie voit la facture et clique "Payé"
5. Ticket + Mission + Facture passent tous en "Clos/Payé"
6. Tout est visible et cohérent dans l'admin

---

## 📸 PREUVES REQUISES

1. Screenshot: Liste factures côté entreprise avec bouton "Éditer"
2. Screenshot: Formulaire d'édition pré-rempli
3. Screenshot: Facture avec nouveau montant après édition
4. Screenshot: Facture en statut "Envoyée" (bouton éditer disparu)
5. Screenshot: Liste factures côté régie
6. Screenshot: Facture marquée "Payée"
7. Screenshot: Ticket en statut "Clos"
8. Screenshot: Résultat requête SQL montrant la cascade

---

## 🔧 EN CAS DE PROBLÈME

### Erreur "Function does not exist"
→ La migration M54 n'a pas été appliquée. Retour à l'Étape 1.

### Bouton "Éditer" ne s'affiche pas
→ Vérifier le cache du navigateur (Ctrl+Shift+R pour rafraîchir)
→ Vérifier que la facture est bien en statut "brouillon"

### "Permission denied"
→ Vérifier les RLS policies avec le script `_audit_rls_factures.js`

### Cascade ne fonctionne pas (ticket reste ouvert)
→ Vérifier la RPC `valider_paiement_facture` dans Supabase

---

## ✅ VALIDATION FINALE

Une fois TOUS les tests passés avec preuves screenshots + SQL:
```bash
node _GENERER_RAPPORT_FINAL_FACTURATION.js
```

Ce script génèrera un rapport complet avec toutes les vérifications.
