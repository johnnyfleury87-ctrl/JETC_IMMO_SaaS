# CHECKLIST DÉPLOIEMENT WORKFLOW TICKETS RÉGIE-ENTREPRISE

## 📋 Contexte
Déploiement des migrations M31-M34 implémentant la suite logique complète :
- **M31**: Colonnes traceability (plafond_valide_par/at, diffuse_par/at)
- **M32**: RPC `valider_ticket_regie()` (validation régie avec plafond + mode)
- **M33**: RPC `get_entreprises_autorisees()` (dropdown UI)
- **M34**: Policies RLS entreprise (filtrage mode_diffusion)

---

## 🔧 PHASE 1: Application migrations backend (Supabase SQL Editor)

### Étape 1.1: M31 - Colonnes traceability
```bash
# Fichier: supabase/migrations/20251227000700_m31_add_tracabilite_tickets.sql
```
- [ ] Copier contenu SQL dans Supabase SQL Editor
- [ ] Exécuter migration
- [ ] Vérifier output: `✅ M31: Colonnes traceability ajoutées`
- [ ] Vérifier colonnes créées:
  ```sql
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'tickets' 
    AND column_name IN ('plafond_valide_par', 'plafond_valide_at', 'diffuse_par', 'diffuse_at');
  ```
- [ ] Résultat attendu: 4 lignes

### Étape 1.2: M32 - RPC valider_ticket_regie
```bash
# Fichier: supabase/migrations/20251227000800_m32_rpc_valider_ticket_regie.sql
```
- [ ] Copier contenu SQL dans Supabase SQL Editor
- [ ] Exécuter migration
- [ ] Vérifier function créée:
  ```sql
  SELECT proname, pronargs 
  FROM pg_proc 
  WHERE proname = 'valider_ticket_regie';
  ```
- [ ] Résultat attendu: 1 ligne avec `pronargs = 4` (4 paramètres)

### Étape 1.3: M33 - RPC get_entreprises_autorisees
```bash
# Fichier: supabase/migrations/20251227000900_m33_rpc_get_entreprises_autorisees.sql
```
- [ ] Copier contenu SQL dans Supabase SQL Editor
- [ ] Exécuter migration
- [ ] Vérifier function créée:
  ```sql
  SELECT proname, pronargs 
  FROM pg_proc 
  WHERE proname = 'get_entreprises_autorisees';
  ```
- [ ] Résultat attendu: 1 ligne avec `pronargs = 0` (aucun paramètre)

### Étape 1.4: M34 - Policies RLS entreprise
```bash
# Fichier: supabase/migrations/20251227001000_m34_rls_entreprise_tickets.sql
```
- [ ] Copier contenu SQL dans Supabase SQL Editor
- [ ] Exécuter migration
- [ ] Vérifier output: `✅ M34: Policies RLS entreprise créées avec succès`
- [ ] Vérifier policies créées:
  ```sql
  SELECT policyname 
  FROM pg_policies 
  WHERE tablename = 'tickets' 
    AND policyname LIKE '%Entreprise can view%';
  ```
- [ ] Résultat attendu: 2 lignes (general + assigned)

---

## ✅ PHASE 2: Tests SQL (validation workflow complet)

### Étape 2.1: Exécuter suite de tests
```bash
# Fichier: tests/validation_ticket_workflow.sql
```
- [ ] Copier contenu SQL dans Supabase SQL Editor
- [ ] Exécuter tous les tests (7 tests)
- [ ] Vérifier outputs pour chaque test:

#### TEST 1: Régie voit ticket complet
- [ ] ✅ Ticket créé avec id valide
- [ ] 🔍 Tester manuellement RPC:
  ```sql
  SELECT * FROM get_ticket_detail_regie('<ticket_id_du_test>');
  ```
- [ ] Vérifier: colonnes locataire (nom, prenom, email, telephone) + logement (numero, adresse, npa, localite) présentes

#### TEST 2: Validation régie
- [ ] 🔍 Tester manuellement RPC:
  ```sql
  SELECT valider_ticket_regie(
    '<ticket_id_du_test>',
    500.00,
    'restreint',
    '<entreprise_id_valide>'
  );
  ```
- [ ] Vérifier retour JSON: `{"success": true, "statut": "en_attente", "plafond": 500.00, ...}`
- [ ] Vérifier UPDATE:
  ```sql
  SELECT statut, plafond_intervention_chf, mode_diffusion, plafond_valide_par, plafond_valide_at
  FROM tickets WHERE id = '<ticket_id_du_test>';
  ```
- [ ] Résultat attendu: statut=en_attente, plafond=500.00, plafond_valide_par NOT NULL

#### TEST 3: Entreprise voit ticket mode GENERAL
- [ ] ✅ Ticket GENERAL créé
- [ ] Compter tickets visibles:
  ```sql
  SELECT COUNT(*) FROM tickets WHERE mode_diffusion='general' AND statut='en_attente';
  ```
- [ ] Résultat attendu: >= 1

#### TEST 4: Entreprise assignée voit ticket RESTREINT
- [ ] ✅ Ticket RESTREINT créé
- [ ] Vérifier assignation:
  ```sql
  SELECT id, mode_diffusion, entreprise_id 
  FROM tickets 
  WHERE mode_diffusion='restreint' AND entreprise_id IS NOT NULL;
  ```
- [ ] Résultat attendu: >= 1 ligne avec entreprise_id valide

#### TEST 5: Colonnes traceability
- [ ] Vérifier output SQL (colonnes plafond_valide_par/at présentes)
- [ ] Statut: ✅ Traceability OK ou ⚠️ Pas encore validé (normal pour tickets nouveaux)

#### TEST 6-7: RLS Policies
- [ ] TEST 6: COUNT tickets mode=general > 0
- [ ] TEST 7: COUNT tickets mode=restreint > 0
- [ ] Vérifier policies actives:
  ```sql
  SELECT schemaname, tablename, policyname, cmd, roles
  FROM pg_policies
  WHERE tablename = 'tickets' AND policyname LIKE '%Entreprise%';
  ```

### Étape 2.2: Cleanup (optionnel)
- [ ] Décommenter ligne `DELETE FROM tickets WHERE titre LIKE 'TEST M%';` dans validation_ticket_workflow.sql
- [ ] Ré-exécuter pour supprimer tickets de test

---

## 🎨 PHASE 3: Modifications frontend (tickets.html)

### Étape 3.1: Ajouter modal "Valider ticket"
**Fichier**: `public/regie/tickets.html`

- [ ] Ajouter HTML modal après `<div id="ticketDetailContainer">`:
  ```html
  <div id="modalValidation" class="modal" style="display:none;">
    <div class="modal-content">
      <span class="close" onclick="closeModalValidation()">&times;</span>
      <h2>Valider le ticket</h2>
      <form id="formValidation">
        <label>Plafond CHF:</label>
        <input type="number" id="inputPlafond" min="0" step="0.01" required>
        
        <label>Mode de diffusion:</label>
        <input type="radio" name="mode" value="general" id="modeGeneral" checked>
        <label for="modeGeneral">Général (toutes entreprises autorisées)</label>
        <input type="radio" name="mode" value="restreint" id="modeRestreint">
        <label for="modeRestreint">Restreint (1 entreprise)</label>
        
        <div id="selectEntrepriseContainer" style="display:none;">
          <label>Entreprise:</label>
          <select id="selectEntreprise" required></select>
        </div>
        
        <button type="submit">Valider</button>
      </form>
    </div>
  </div>
  ```

### Étape 3.2: Ajouter JavaScript modal
**Fichier**: `public/regie/tickets.html` (section `<script>`)

- [ ] Ajouter fonction `openModalValidation(ticketId)`:
  ```javascript
  async function openModalValidation(ticketId) {
    currentTicketId = ticketId;
    
    // Charger entreprises autorisées
    const { data: entreprises, error } = await supabase
      .rpc('get_entreprises_autorisees');
    
    if (error) {
      console.error('Erreur chargement entreprises:', error);
      return;
    }
    
    // Peupler dropdown
    const select = document.getElementById('selectEntreprise');
    select.innerHTML = entreprises.map(e => 
      `<option value="${e.id}">${e.nom}</option>`
    ).join('');
    
    document.getElementById('modalValidation').style.display = 'block';
  }
  ```

- [ ] Ajouter listener radio button mode:
  ```javascript
  document.getElementById('modeRestreint').addEventListener('change', (e) => {
    document.getElementById('selectEntrepriseContainer').style.display = 
      e.target.checked ? 'block' : 'none';
  });
  ```

- [ ] Ajouter handler submit:
  ```javascript
  document.getElementById('formValidation').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const plafond = parseFloat(document.getElementById('inputPlafond').value);
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const entrepriseId = mode === 'restreint' 
      ? document.getElementById('selectEntreprise').value 
      : null;
    
    const { data, error } = await supabase.rpc('valider_ticket_regie', {
      p_ticket_id: currentTicketId,
      p_plafond_chf: plafond,
      p_mode_diffusion: mode,
      p_entreprise_id: entrepriseId
    });
    
    if (error) {
      alert('Erreur validation: ' + error.message);
      return;
    }
    
    if (data.success) {
      alert('✅ Ticket validé avec succès');
      closeModalValidation();
      loadTickets(); // Recharger liste
    } else {
      alert('❌ ' + data.message);
    }
  });
  ```

### Étape 3.3: Ajouter bouton "Valider" dans detail ticket
**Fichier**: `public/regie/tickets.html` (fonction `showTicketDetail`)

- [ ] Ajouter bouton après affichage description:
  ```javascript
  if (ticket.statut === 'nouveau') {
    detailHtml += `<button onclick="openModalValidation('${ticket.id}')">Valider ticket</button>`;
  }
  ```

### Étape 3.4: Afficher infos locataire complètes
**Fichier**: `public/regie/tickets.html` (fonction `showTicketDetail`)

- [ ] Ajouter après section logement:
  ```javascript
  detailHtml += `
    <h3>Locataire</h3>
    <p><strong>Nom:</strong> ${ticket.locataire_nom} ${ticket.locataire_prenom}</p>
    <p><strong>Email:</strong> ${ticket.locataire_email || 'Non renseigné'}</p>
    <p><strong>Téléphone:</strong> ${ticket.locataire_telephone || 'Non renseigné'}</p>
  `;
  ```

### Étape 3.5: Afficher adresse logement complète
**Fichier**: `public/regie/tickets.html` (fonction `showTicketDetail`)

- [ ] Modifier section logement:
  ```javascript
  detailHtml += `
    <h3>Logement</h3>
    <p><strong>Numéro:</strong> ${ticket.logement_numero}</p>
    <p><strong>Adresse:</strong> ${ticket.logement_adresse}</p>
    <p><strong>NPA/Localité:</strong> ${ticket.logement_npa} ${ticket.logement_localite}</p>
  `;
  ```

---

## 🚀 PHASE 4: Déploiement et tests end-to-end

### Étape 4.1: Commit + Push modifications
```bash
git add .
git commit -m "feat(tickets): Implement workflow validation régie-entreprise (M31-M34)"
git push origin main
```

### Étape 4.2: Déploiement Vercel (si auto-deploy activé)
- [ ] Vérifier build Vercel réussi
- [ ] Vérifier déploiement sur environnement production

### Étape 4.3: Tests end-to-end manuels

#### Test E2E 1: Création ticket locataire
- [ ] Se connecter comme **locataire** (email locataire existant)
- [ ] Aller sur `/locataire/tickets.html`
- [ ] Créer nouveau ticket (titre, description, catégorie, priorité)
- [ ] Vérifier: ticket créé avec statut=`nouveau`

#### Test E2E 2: Validation régie
- [ ] Se connecter comme **régie** (email régie existant)
- [ ] Aller sur `/regie/tickets.html`
- [ ] Cliquer sur ticket créé au Test E2E 1
- [ ] Vérifier affichage:
  - [ ] Nom + prénom + email + téléphone locataire
  - [ ] Adresse complète logement (adresse + NPA + localité)
  - [ ] Bouton "Valider ticket" visible (statut=nouveau)
- [ ] Cliquer "Valider ticket"
- [ ] Modal s'ouvre avec:
  - [ ] Input plafond CHF
  - [ ] Radio buttons mode (general/restreint)
  - [ ] Dropdown entreprises (masqué par défaut)
- [ ] **Scénario A - Mode GENERAL:**
  - [ ] Saisir plafond: `500.00`
  - [ ] Cocher radio "Général"
  - [ ] Soumettre formulaire
  - [ ] Vérifier: message `✅ Ticket validé avec succès`
  - [ ] Vérifier: ticket passe à statut=`en_attente`
  - [ ] Vérifier dans DB:
    ```sql
    SELECT plafond_intervention_chf, mode_diffusion, plafond_valide_par, plafond_valide_at
    FROM tickets WHERE id = '<ticket_id>';
    ```
  - [ ] Résultat attendu: plafond=500.00, mode=general, plafond_valide_par NOT NULL
- [ ] **Scénario B - Mode RESTREINT (créer 2ème ticket):**
  - [ ] Créer nouveau ticket (via locataire)
  - [ ] Se reconnecter régie
  - [ ] Ouvrir ticket
  - [ ] Cliquer "Valider ticket"
  - [ ] Saisir plafond: `300.00`
  - [ ] Cocher radio "Restreint"
  - [ ] Dropdown entreprises apparaît
  - [ ] Sélectionner entreprise dans liste
  - [ ] Soumettre formulaire
  - [ ] Vérifier: message `✅ Ticket validé avec succès`
  - [ ] Vérifier dans DB:
    ```sql
    SELECT plafond_intervention_chf, mode_diffusion, entreprise_id
    FROM tickets WHERE id = '<ticket_id>';
    ```
  - [ ] Résultat attendu: plafond=300.00, mode=restreint, entreprise_id NOT NULL

#### Test E2E 3: Visibilité entreprise (mode GENERAL)
- [ ] Se connecter comme **entreprise** (email entreprise autorisée)
- [ ] Aller sur `/entreprise/dashboard.html`
- [ ] Vérifier: ticket validé en mode GENERAL (Test E2E 2 Scénario A) visible dans liste
- [ ] Détails attendus:
  - [ ] Titre + description ticket
  - [ ] Plafond: 500.00 CHF
  - [ ] Bouton "Accepter ticket" ou équivalent

#### Test E2E 4: Visibilité entreprise (mode RESTREINT)
- [ ] Se connecter comme **entreprise ASSIGNÉE** (celle sélectionnée en Scénario B)
- [ ] Aller sur `/entreprise/dashboard.html`
- [ ] Vérifier: ticket validé en mode RESTREINT (Test E2E 2 Scénario B) visible
- [ ] Se déconnecter
- [ ] Se connecter comme **autre entreprise** (non assignée)
- [ ] Aller sur `/entreprise/dashboard.html`
- [ ] Vérifier: ticket mode RESTREINT **NON VISIBLE** (RLS bloque)

#### Test E2E 5: Acceptation entreprise + création mission
- [ ] Se connecter comme entreprise (qui voit ticket mode GENERAL ou RESTREINT)
- [ ] Cliquer "Accepter ticket"
- [ ] Vérifier: mission créée (table `missions`)
- [ ] Vérifier: ticket passe à statut=`en_cours`
- [ ] Vérifier: ticket.locked_at NOT NULL (verrouillé)
- [ ] Vérifier dans DB:
  ```sql
  SELECT m.id, m.ticket_id, m.entreprise_id, t.statut, t.locked_at
  FROM missions m
  JOIN tickets t ON t.id = m.ticket_id
  WHERE m.ticket_id = '<ticket_id>';
  ```

---

## 🔄 ROLLBACK (en cas d'erreur)

### Rollback M34
```bash
# Fichier: supabase/migrations/20251227001000_m34_rls_entreprise_tickets_rollback.sql
```
- [ ] Exécuter dans Supabase SQL Editor
- [ ] Vérifier: 2 policies supprimées

### Rollback M33
```bash
# Fichier: supabase/migrations/20251227000900_m33_rpc_get_entreprises_autorisees_rollback.sql
```
- [ ] Exécuter dans Supabase SQL Editor
- [ ] Vérifier: function `get_entreprises_autorisees` supprimée

### Rollback M32
```bash
# Fichier: supabase/migrations/20251227000800_m32_rpc_valider_ticket_regie_rollback.sql
```
- [ ] Exécuter dans Supabase SQL Editor
- [ ] Vérifier: function `valider_ticket_regie` supprimée

### Rollback M31
```bash
# Fichier: supabase/migrations/20251227000700_m31_add_tracabilite_tickets_rollback.sql
```
- [ ] Exécuter dans Supabase SQL Editor
- [ ] Vérifier: 4 colonnes + 2 indexes supprimés de table `tickets`

---

## ✅ VALIDATION FINALE

- [ ] Migrations M31-M34 appliquées sans erreur
- [ ] Tests SQL (7 tests) passent avec succès
- [ ] Frontend modal validation fonctionne
- [ ] Dropdown entreprises populated
- [ ] RLS policies filtrent correctement selon mode_diffusion
- [ ] Workflow complet: locataire → régie → entreprise fonctionnel
- [ ] Colonnes traceability remplies après validation régie
- [ ] Acceptation entreprise crée mission correctement

**Déploiement considéré RÉUSSI si tous checkboxes cochés ✅**
