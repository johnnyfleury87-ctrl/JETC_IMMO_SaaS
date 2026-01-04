# CORRECTION M41+M42 — Acceptation Ticket Entreprise + Sélection Créneau

**Date:** 2026-01-04  
**Migrations:** M41 (RPC acceptation) + M42 (colonne disponibilite_id)  
**Objectif:** Corriger acceptation entreprise + permettre sélection créneau

---

## 🐛 Problèmes identifiés

### Problème 1: Erreur "Mode diffusion invalide: general"
**Symptôme:**  
```
Erreur: Mode diffusion invalide ou NULL: general
```

**Cause racine:**  
- RPC `accept_ticket_and_create_mission` (M05) attendait `'public'`/`'assigné'`
- Données harmonisées en `'general'`/`'restreint'` (M35)
- Validation RPC jamais mise à jour

**Fichier concerné:**  
[supabase/migrations/20251226170400_m05_fix_rpc_accept_ticket.sql](supabase/migrations/20251226170400_m05_fix_rpc_accept_ticket.sql#L52-L68)

---

### Problème 2: Créneaux non sélectionnables
**Symptôme:**  
- Frontend affiche "1 créneau" mais pas les dates/heures détaillées
- Pas de sélection de créneau avant acceptation
- Aucun enregistrement du créneau choisi dans la mission

**Cause racine:**  
- Modal détails affichait créneaux en lecture seule
- Pas de radios pour sélection
- RPC ne prenait pas de paramètre `disponibilite_id`
- Table `missions` sans colonne pour stocker le créneau

---

## ✅ Solutions implémentées

### Migration M41: Harmonisation RPC acceptation

**Fichier:** [supabase/migrations/20260104001700_m41_harmonize_rpc_acceptation.sql](supabase/migrations/20260104001700_m41_harmonize_rpc_acceptation.sql)

**Modifications:**
1. **Validation mode_diffusion:** `'public'` → `'general'`, `'assigné'` → `'restreint'`
2. **Paramètre créneau:** Ajout `p_disponibilite_id uuid DEFAULT NULL`
3. **Enregistrement:** INSERT missions avec colonne `disponibilite_id`

```sql
-- AVANT (M05)
IF v_mode_diffusion = 'public' THEN
  -- Check entreprise autorisée
ELSIF v_mode_diffusion = 'assigné' THEN
  -- Check entreprise assignée
ELSE
  RAISE EXCEPTION 'Mode diffusion invalide: %', v_mode_diffusion;
END IF;

-- APRÈS (M41)
IF v_mode_diffusion = 'general' THEN
  -- Mode marketplace: entreprise autorisée
ELSIF v_mode_diffusion = 'restreint' THEN
  -- Mode assignation: entreprise spécifique
ELSE
  RAISE EXCEPTION 'Mode diffusion invalide: % (attendu: general ou restreint)', v_mode_diffusion;
END IF;
```

**Signature RPC:**
```sql
accept_ticket_and_create_mission(
  p_ticket_id uuid,
  p_entreprise_id uuid,
  p_disponibilite_id uuid DEFAULT NULL  -- NOUVEAU (M41)
)
```

---

### Migration M42: Colonne disponibilite_id dans missions

**Fichier:** [supabase/migrations/20260104001800_m42_add_disponibilite_id_missions.sql](supabase/migrations/20260104001800_m42_add_disponibilite_id_missions.sql)

**Modifications:**
```sql
ALTER TABLE missions
ADD COLUMN disponibilite_id uuid 
REFERENCES tickets_disponibilites(id) ON DELETE SET NULL;

CREATE INDEX idx_missions_disponibilite_id 
ON missions(disponibilite_id) 
WHERE disponibilite_id IS NOT NULL;
```

**Traçabilité:**
- Missions créées avant M42: `disponibilite_id = NULL`
- Missions après M41+M42: Créneau choisi enregistré

---

### Frontend: Sélection créneaux dans modal

**Fichier:** [public/entreprise/dashboard.html](public/entreprise/dashboard.html)

**Modifications:**

#### 1. Affichage créneaux avec radios
```javascript
// Ligne ~1012 (fonction openTicketDetailsModal)
const dispoHtml = disponibilites.map((d, index) => {
  const checked = index === 0 ? 'checked' : ''; // Auto-sélection 1er
  
  return `
    <div class="disponibilite-item">
      <label class="disponibilite-radio-label">
        <input type="radio" name="disponibilite" value="${d.id}" ${checked} />
        <div class="disponibilite-content">
          <h5>Créneau ${d.preference}</h5>
          <p><strong>Début:</strong> ${debut}</p>
          <p><strong>Fin:</strong> ${fin}</p>
        </div>
      </label>
    </div>
  `;
}).join('');
```

#### 2. Bouton Accepter dans modal
```html
<div class="modal-footer">
  <button class="btn btn-secondary" onclick="closeTicketDetailsModal()">Fermer</button>
  <button id="modalAccepterBtn" class="btn btn-primary" style="display: none;">
    ✅ Accepter ce ticket
  </button>
</div>
```

#### 3. Fonction accepterTicketFromModal()
```javascript
async function accepterTicketFromModal(ticketId, titre) {
  const selectedRadio = document.querySelector('input[name="disponibilite"]:checked');
  
  if (!selectedRadio) {
    alert('⚠️ Veuillez sélectionner un créneau avant d\'accepter.');
    return;
  }
  
  const disponibiliteId = selectedRadio.value;
  closeTicketDetailsModal();
  await accepterTicket(ticketId, titre, disponibiliteId);
}
```

#### 4. Modification accepterTicket()
```javascript
async function accepterTicket(ticketId, titre, disponibiliteId = null) {
  const rpcParams = {
    p_ticket_id: ticketId,
    p_entreprise_id: window.currentEntreprise.id
  };
  
  if (disponibiliteId) {
    rpcParams.p_disponibilite_id = disponibiliteId; // NOUVEAU
  }
  
  const { data, error } = await supabase.rpc('accept_ticket_and_create_mission', rpcParams);
  // ...
}
```

---

## 🎨 Styles CSS ajoutés

```css
.disponibilite-radio-label {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
}

.disponibilite-radio-label input[type="radio"] {
  width: 18px;
  height: 18px;
  accent-color: var(--primary-blue);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid var(--gray-200);
}
```

---

## 📋 Déploiement

### 1. Migrations SQL
```bash
# M41: Harmonisation RPC
psql "$DATABASE_URL" -f supabase/migrations/20260104001700_m41_harmonize_rpc_acceptation.sql

# M42: Colonne disponibilite_id
psql "$DATABASE_URL" -f supabase/migrations/20260104001800_m42_add_disponibilite_id_missions.sql
```

### 2. Frontend
```bash
git add public/entreprise/dashboard.html
git commit -m "fix(entreprise): Sélection créneau + harmonisation mode_diffusion"
git push
```

---

## 🧪 Tests de validation

**Script:** [tests/validation_m41_m42_acceptation_creneau.sql](tests/validation_m41_m42_acceptation_creneau.sql)

### Tests inclus:
1. ✅ Acceptation ticket mode `general` avec créneau
2. ✅ Ticket verrouillé et masqué pour autres entreprises
3. ✅ Rejet mode_diffusion invalide
4. ✅ Acceptation sans créneau (NULL optionnel)

### Exécution:
```bash
# Remplacer variables dans le script:
# - <entreprise_profile_id>
# - <entreprise_id>
# - <ticket_id>
# - <disponibilite_id>
# - <autre_entreprise_profile_id>

psql "$DATABASE_URL" -f tests/validation_m41_m42_acceptation_creneau.sql
```

---

## 📊 Workflow utilisateur

### Avant M41+M42:
1. Entreprise voit ticket avec "1 créneau"
2. Clic "Accepter" → ❌ Erreur "Mode diffusion invalide: general"
3. Aucun moyen de choisir le créneau

### Après M41+M42:
1. Entreprise voit ticket avec "1 créneau"
2. Clic "📄 Détails" → Modal avec créneaux affichés
3. Sélection créneau via radio (1er auto-sélectionné)
4. Clic "✅ Accepter ce ticket" → ✅ Mission créée
5. Créneau enregistré dans `missions.disponibilite_id`
6. Ticket masqué pour autres entreprises

---

## 🔗 Dépendances

### Migrations requises avant M41+M42:
- **M05:** RPC `accept_ticket_and_create_mission` (version initiale)
- **M09:** Table `tickets_disponibilites` + RLS
- **M35:** Harmonisation terminologie `general`/`restreint`
- **M40:** RLS disponibilités entreprise

### Impact sur autres composants:
- ✅ RLS `tickets_disponibilites` (M40): Déjà compatible
- ✅ Vue `tickets_visibles_entreprise` (M37): Harmonisée
- ✅ Policy tickets (M39): Validée `mode_diffusion`

---

## 🔄 Rollback

### En cas d'erreur:
```bash
# Rollback M42
psql "$DATABASE_URL" -f supabase/migrations/20260104001800_m42_add_disponibilite_id_missions_rollback.sql

# Rollback M41
psql "$DATABASE_URL" -f supabase/migrations/20260104001700_m41_harmonize_rpc_acceptation_rollback.sql

# Frontend: git revert
git revert HEAD
```

---

## ✅ Checklist validation

- [x] M41: RPC accepte `general`/`restreint`
- [x] M42: Colonne `disponibilite_id` dans missions
- [x] Frontend: Modal affiche créneaux avec radios
- [x] Frontend: Bouton "Accepter" dans modal
- [x] Frontend: `accepterTicket()` passe `disponibilite_id`
- [x] CSS: Styles radios + modal footer
- [x] Tests: Script validation SQL créé
- [x] Docs: Fichier récapitulatif complet

---

## 📝 Prochaines étapes

1. **Déployer M41+M42** en base de données
2. **Tester manuellement** avec ticket réel mode `general`
3. **Valider** que créneau s'affiche et est sélectionnable
4. **Confirmer** mission créée avec `disponibilite_id` rempli
5. **Vérifier** ticket disparaît pour autres entreprises

---

**Statut:** ✅ Corrections complètes — Prêt pour déploiement
