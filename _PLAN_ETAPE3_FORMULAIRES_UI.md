# ÉTAPE 3 - MISE À JOUR FORMULAIRES UI MULTI-DEVISE

## 🎯 OBJECTIF
Adapter l'interface utilisateur pour afficher et gérer les devises EUR/CHF

## 📋 MODIFICATIONS À EFFECTUER

### 1️⃣ FORMULAIRE INSCRIPTION RÉGIE (**register.html**)
**Localisation:** Après le champ SIRET, avant le champ mot de passe

**Ajout:**
```html
<div class="form-group">
  <label for="currency" data-i18n="currency">Devise de facturation *</label>
  <select id="currency" name="currency" required>
    <option value="CHF" selected>🇨🇭 Franc suisse (CHF)</option>
    <option value="EUR">🇪🇺 Euro (EUR)</option>
  </select>
  <div class="help-text" data-i18n="currencyHelp">
    Cette devise sera utilisée pour toutes les factures de votre régie
  </div>
</div>
```

**Backend (api/auth/register.js):**
- Ajouter `currency` dans destructuring (ligne ~47)
- Ajouter validation: `if (!['EUR', 'CHF'].includes(currency))`
- Ajouter `currency` dans l'INSERT regies (ligne ~185)

---

### 2️⃣ DASHBOARD ADMIN (**public/admin/dashboard.html**)
**Localisation:** Fonction `loadRegiesEnAttente()` - ligne ~1120

**Modification affichage carte régie:**
```html
<h3>${regie.nom}</h3>
<p><strong>Devise:</strong> ${regie.currency === 'EUR' ? '🇪🇺 EUR' : '🇨🇭 CHF'}</p>
<p><strong>Email:</strong> ${regie.email}</p>
```

**Requête SQL:**
```js
.select('id, nom, email, nb_collaborateurs, nb_logements_geres, siret, created_at, statut_validation, currency')
```

---

### 3️⃣ FORMULAIRE ENTREPRISES (**public/regie/entreprises.html**)
**Localisation:** Modal création entreprise - ligne ~618-677

**Ajout après champ "Description" (ligne ~660):**
```html
<div class="form-group" style="padding: 15px; background: var(--gray-50); border-radius: 8px; border-left: 4px solid var(--gray-400);">
  <label style="font-weight: 600;">💰 Devise héritée de la régie</label>
  <div style="font-size: 20px; margin: 10px 0;">
    <span id="currencyDisplay">-</span>
  </div>
  <div class="form-help">
    Les entreprises utilisent automatiquement la devise de votre régie. 
    Cette valeur ne peut pas être modifiée.
  </div>
</div>
```

**JavaScript - fonction openCreateModal() (ligne ~750):**
```js
// Afficher la devise de la régie dans le formulaire
if (currentRegie?.currency) {
  const currencyDisplay = document.getElementById('currencyDisplay');
  currencyDisplay.textContent = currentRegie.currency === 'EUR' ? '🇪🇺 Euro (EUR)' : '🇨🇭 Franc suisse (CHF)';
}
```

**Requête currentRegie (ligne ~700):**
```js
.select('id, nom, email, currency')
```

---

### 4️⃣ FORMULAIRE LOCATAIRES (**public/regie/locataires.html**)
**Localisation:** Modal création locataire - ligne ~680-710

**Ajout avant champ "Date d'entrée":**
```html
<div class="form-group" style="padding: 15px; background: var(--gray-50); border-radius: 8px; border-left: 4px solid var(--gray-400);">
  <label style="font-weight: 600;">💰 Devise</label>
  <div style="font-size: 18px; margin: 8px 0;">
    <span id="currencyDisplayLocataire">-</span>
  </div>
  <div class="form-help" style="font-size: 12px;">
    Héritée de la régie
  </div>
</div>
```

**JavaScript - fonction openCreateModal() (ligne ~1115):**
```js
// Afficher la devise de la régie
if (regieId) {
  const { data: regie } = await window.supabaseClient
    .from('regies')
    .select('currency')
    .eq('id', regieId)
    .single();
    
  if (regie?.currency) {
    document.getElementById('currencyDisplayLocataire').textContent = 
      regie.currency === 'EUR' ? '🇪🇺 EUR' : '🇨🇭 CHF';
  }
}
```

---

### 5️⃣ DASHBOARD RÉGIE - LISTE ENTREPRISES
**Fichier:** public/regie/entreprises.html
**Localisation:** Fonction renderEntreprises() - ligne ~785

**Ajout dans carte entreprise:**
```html
<div class="entreprise-card">
  <h3>${e.nom}</h3>
  <div style="display: flex; gap: 10px; margin-bottom: 8px;">
    <span class="badge" style="background: ${e.currency === 'EUR' ? '#3b82f6' : '#10b981'};">
      ${e.currency === 'EUR' ? '🇪🇺 EUR' : '🇨🇭 CHF'}
    </span>
  </div>
  <p>📧 ${e.email}</p>
  ...
</div>
```

**Requête loadEntreprises() (ligne ~720):**
```js
.select('id, nom, email, telephone, adresse, ville, siret, description, created_at, currency')
```

---

## 🔧 ORDRE D'IMPLÉMENTATION

1. ✅ **register.html** + **api/auth/register.js** (inscription avec devise)
2. **public/admin/dashboard.html** (affichage devise dans validation)
3. **public/regie/entreprises.html** (devise héritée lecture seule)
4. **public/regie/locataires.html** (devise héritée lecture seule)
5. Tests fonctionnels

---

## ✅ CRITÈRES DE SUCCÈS

- [ ] Régie peut choisir EUR ou CHF à l'inscription
- [ ] Admin voit la devise dans la liste de validation
- [ ] Formulaire entreprise affiche devise héritée (lecture seule)
- [ ] Formulaire locataire affiche devise héritée (lecture seule)
- [ ] Liste entreprises affiche badges EUR/CHF
- [ ] Aucune régression sur code existant

---

## 📌 NOTES IMPORTANTES

- **Devise régie** = Source de vérité
- **Toutes les entités liées** héritent automatiquement via triggers DB
- **Affichage uniquement** dans formulaires (sauf régie)
- **Pas de modification manuelle** après création régie (verrouillé par trigger)
