# 🎯 FINALISATION WORKFLOW MISSION → FACTURATION

## 📊 DIAGNOSTIC COMPLET (RÉSULTATS AUDIT)

### ✅ CE QUI EXISTE DÉJÀ

1. **Tables complètes** :
   - `missions` avec colonnes : rapport_url, photos_urls, notes, montant_reel_chf, signature_locataire_url, signature_technicien_url
   - `factures` avec statuts : brouillon, envoyee, payee, annulee (mais **manque colonne IBAN**)
   - `mission_historique_statuts`, `mission_rapports`, `mission_details`, `documents_mission`
   - `photos` (existe mais RLS trop restrictif)

2. **Vue missions_details** :
   - Très complète avec toutes les jointures
   - Inclut : mission, ticket, entreprise, technicien, locataire, logement, immeuble, régie

3. **Données disponibles** :
   - Une mission terminée existe (ID: 2d84c11c-6415-4f49-ba33-8b53ae1ee22d)
   - Champs rapport : notes, rapport_url
   - Photos : photos_urls (tableau)

### ❌ CE QUI MANQUE

1. **RPC Critiques** (n'existent PAS en base) :
   - `start_mission` - Démarrer mission
   - `complete_mission` - Terminer mission
   - `generate_facture_from_mission` - Créer facture
   - `update_facture_status` - Changer statut facture avec clôture auto

2. **Colonnes manquantes** :
   - `factures.iban` - Pour le paiement entreprise
   - `missions.duree_minutes` - Durée calculée automatiquement

3. **Trigger auto-facture** :
   - Pas de création automatique quand mission passe à "terminee"

4. **Vue missions_factures_complet** :
   - Vue consolidée pour dashboards (manquante)

---

## 🚀 PLAN D'ACTION

### ÉTAPE 1 : Appliquer la migration M50

Le fichier `supabase/migrations/20260107120000_m50_workflow_facturation_complet.sql` contient TOUTES les corrections nécessaires.

**⚠️ IMPORTANT : Application manuelle requise**

La connexion directe PostgreSQL ne fonctionne pas depuis ce conteneur.  
👉 **Appliquer via Supabase Dashboard** :

1. Ouvrir : https://bwzyajsrmfhrxdmfpyqy.supabase.co/project/_/sql/new
2. Copier le contenu de `/workspaces/JETC_IMMO_SaaS/supabase/migrations/20260107120000_m50_workflow_facturation_complet.sql`
3. Cliquer sur "Run"
4. Vérifier les logs (ignorer erreurs "already exists")

---

### ÉTAPE 2 : Vérifier l'application

Exécuter le script de test :
```bash
node _test_workflow_facturation.js
```

Ce script va :
- ✅ Vérifier que tous les RPC existent
- ✅ Tester start_mission sur mission existante
- ✅ Tester complete_mission
- ✅ Vérifier que facture est générée automatiquement
- ✅ Tester update_facture_status (payee → clôture auto)

---

### ÉTAPE 3 : Adaptations Frontend

Une fois la migration appliquée, les adaptations frontend suivantes sont nécessaires :

#### 3.1 - Dashboard Entreprise : Consultation Rapport Mission

**Fichier** : `public/entreprise/dashboard.html`

**Objectif** : Afficher le rapport du technicien après fin de mission

**Données disponibles** (via `missions_details` ou `missions_factures_complet`) :
- `mission_notes` : Notes texte du technicien
- `mission_rapport_url` : URL du rapport PDF (Supabase Storage)
- `mission_photos` : URLs des photos (tableau JSON)
- `mission_duree_minutes` : Durée calculée automatiquement
- `technicien_nom`, `technicien_prenom` : Identité technicien

**Action requise** :
1. Modifier la modal `openMissionDetailsModal(missionId)` (ligne ~1638)
2. Charger via vue `missions_factures_complet` (jointure mission + facture)
3. Afficher :
   - Texte du rapport (notes)
   - Photos (si présentes)
   - Durée de la mission
   - Informations technicien

**Exemple de code à ajouter** :
```javascript
async function openMissionDetailsModal(missionId) {
  const { data: mission, error } = await window.supabaseClient
    .from('missions_factures_complet')
    .select('*')
    .eq('mission_id', missionId)
    .single();
  
  if (error) {
    alert('Erreur: ' + error.message);
    return;
  }
  
  // Construire HTML modal avec :
  // - mission_notes
  // - mission_photos (parser JSON)
  // - mission_duree_minutes
  // - technicien_nom, technicien_prenom
  // - Bouton "Créer facture" si pas de facture_id
}
```

---

#### 3.2 - Dashboard Entreprise : Création/Édition Facture

**Fichier** : `public/entreprise/dashboard.html`

**Objectif** : Permettre à l'entreprise de créer/éditer une facture

**Fonctionnalité** :
- **Après fin de mission** : bouton "📄 Créer facture" visible
- **Champs éditables** :
  - Description (texte libre)
  - Montant HT (pré-rempli avec `mission_montant_reel_chf`)
  - IBAN (à saisir par l'entreprise)
  - Adresse de facturation (auto-remplie depuis `entreprise.adresse`)

**RPC à utiliser** :
```javascript
const { data, error } = await window.supabaseClient.rpc('generate_facture_from_mission', {
  p_mission_id: missionId,
  p_montant_ht: montant,
  p_description: description,
  p_iban: iban
});
```

**Affichage automatique** :
Une fois créée, la facture apparaît automatiquement dans l'onglet "Factures" (déjà existant).

---

#### 3.3 - Dashboard Entreprise/Régie : Actions Payé/Refusé

**Fichier** : `public/entreprise/dashboard.html` (section Factures)

**Objectif** : Permettre les actions sur factures

**Boutons à ajouter** (si `facture_statut === 'brouillon'` ou `'envoyee'`) :
- 🟢 **Marquer comme payée**
- 🔴 **Refuser**

**RPC à utiliser** :
```javascript
// Payé
const { data, error } = await window.supabaseClient.rpc('update_facture_status', {
  p_facture_id: factureId,
  p_nouveau_statut: 'payee'
});
// ✅ Clôture auto : ticket + mission passent à "clos"

// Refusé
const { data, error } = await window.supabaseClient.rpc('update_facture_status', {
  p_facture_id: factureId,
  p_nouveau_statut: 'refusee'
});
// ⚠️ Pas de clôture, mission reste visible
```

**Effet automatique si "payee"** :
- Mission.statut → `validee`
- Ticket.statut → `clos`
- Ticket.date_cloture → NOW()

---

#### 3.4 - Dashboard Admin : Vue Factures

**Fichier** : `public/admin/dashboard.html`

**Objectif** : Voir toutes les missions + factures

**Données à charger** :
```javascript
const { data: missions, error } = await window.supabaseClient
  .from('missions_factures_complet')
  .select('*')
  .order('mission_created_at', { ascending: false });
```

**Colonnes à afficher** :
- Mission ID, Statut mission
- Ticket titre
- Entreprise nom
- Facture numéro (si existe)
- Facture statut (brouillon / envoyee / payee / refusee)
- Montant TTC
- Actions visibles par admin

---

## 📝 RÉSUMÉ DES FICHIERS

### ✅ Migrations SQL (à appliquer)
- `supabase/migrations/20260107120000_m50_workflow_facturation_complet.sql` ⭐ **PRINCIPAL**

### 📄 Scripts utilitaires
- `_audit_workflow_facturation.js` - Audit complet (déjà exécuté)
- `_apply_m50_direct.js` - Tentative application auto (échec connexion)
- `_test_workflow_facturation.js` - Test post-migration (**À CRÉER**)

### 🌐 Fichiers Frontend à modifier
- `public/entreprise/dashboard.html` - Rapports + Factures + Actions
- `public/admin/dashboard.html` - Vue consolidée missions/factures

---

## ✅ WORKFLOW FINAL ATTENDU

```
1. Technicien termine la mission
   ↓
2. Entreprise voit mission "terminée"
   ↓
3. Entreprise consulte rapport technicien
   - Texte notes
   - Photos
   - Durée intervention
   ↓
4. Entreprise crée facture
   - Montant HT
   - Description
   - IBAN
   - Adresse auto-remplie
   ↓
5. Facture apparaît automatiquement dans onglet "Factures"
   ↓
6. Régie ou Entreprise marque facture "Payée"
   ↓
7. 🎯 CLÔTURE AUTOMATIQUE :
   - Mission.statut → validee
   - Ticket.statut → clos
   - Visible dans dashboard admin
   ↓
8. Admin voit tout dans vue consolidée
```

---

## 🚀 PROCHAINES ACTIONS IMMÉDIATES

### Pour toi (Copilot) :
1. ✅ Créer script de test `_test_workflow_facturation.js`
2. ⏳ Attendre confirmation application migration M50
3. 🔄 Adapter frontend dashboard entreprise (rapports + factures)

### Pour l'utilisateur :
1. **Appliquer migration M50 via Supabase Dashboard** (manuel)
2. Exécuter script de test
3. Tester workflow complet
4. Valider avec vraies données

---

## 📞 SUPPORT

Si erreur lors de l'application SQL :
- Vérifier logs Supabase Dashboard
- Ignorer erreurs "already exists"
- Vérifier que tous les RPC sont créés : `SELECT proname FROM pg_proc WHERE proname LIKE '%mission%' OR proname LIKE '%facture%';`
