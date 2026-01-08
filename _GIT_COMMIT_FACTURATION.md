# GIT COMMIT MESSAGE

```bash
git add -A
git commit -m "fix(facturation): Compléter workflow édition/envoi factures entreprise→régie

PROBLÈME RÉSOLU:
- L'entreprise ne pouvait pas éditer les factures brouillon
- Pas de moyen d'envoyer une facture à la régie
- Workflow interrompu après création de la facture

CORRECTIONS BACKEND (Supabase):
- Ajout RPC editer_facture(p_facture_id, p_montant_ht, p_notes, p_iban)
  * Vérifie statut brouillon
  * Recalcule auto TVA 20% et commission 10%
  * Met à jour montants HT/TTC/TVA/commission
  
- Ajout RPC envoyer_facture(p_facture_id)
  * Validation champs obligatoires (montant, IBAN)
  * Change statut brouillon → envoyee
  * Enregistre date_envoi
  
- Ajout RPC valider_paiement_facture(p_facture_id)
  * Change facture → payee
  * CASCADE: mission → clos
  * CASCADE: ticket → clos
  * Enregistre dates de clôture
  
- Ajout RPC refuser_facture(p_facture_id, p_raison)
  * Change facture → refusee
  * Ajoute raison dans notes

CORRECTIONS FRONTEND:
- Ajout bouton ✏️ Éditer (visible si statut=brouillon)
- Ajout bouton 📤 Envoyer à la régie (visible si complète)
- Ajout fonction editerFacture() avec pré-remplissage formulaire
- Ajout fonction envoyerFactureRegie() avec confirmation
- Modification confirmerCreerFacture() pour gérer création ET édition
- Ajout variable currentFactureIdForEdit pour tracking
- Modal titre dynamique (Créer/Éditer)

WORKFLOW COMPLET:
1. Mission terminée → Facture brouillon créée auto ✅
2. Entreprise édite facture (montant/IBAN/notes) ✅
3. Entreprise envoie à la régie ✅
4. Régie marque payée ✅
5. Cascade auto: mission + ticket clos ✅

FICHIERS MODIFIÉS:
- supabase/migrations/20260108120000_m54_rpc_editer_envoyer_factures.sql (NEW)
- public/entreprise/dashboard.html (édition + envoi)

TESTS:
- _TEST_WORKFLOW_FACTURATION_COMPLET.js (automatisé)
- _GUIDE_TEST_WORKFLOW_FACTURATION.md (manuel)
- Tous les tests passent ✅

DOCUMENTATION:
- _LIVRABLE_WORKFLOW_FACTURATION.md (complet)
- _DIAGNOSTIC_WORKFLOW_FACTURATION.md (analyse)
- _RESUME_EXECUTIF_FACTURATION.md (synthèse)

Breaking changes: AUCUN
Régression: AUCUNE (workflow existant conservé)
"

git push origin main
```
