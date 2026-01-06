# 🚨 BUG REPRODUCTION : Mission Entreprise Non Actionnable

**Date** : 2026-01-06  
**Gravité** : 🔴 CRITIQUE  
**Statut** : ✅ CAUSE IDENTIFIÉE

---

## 📋 Étapes de Reproduction

### 1. Connexion Entreprise
- Rôle : Entreprise (Perreti SA)
- Compte : `6ff210bc-...`

### 2. Acceptation Ticket
- Ticket accepté : "Plomberie // Fuite d'eau"
- Ticket ID : (référencé via mission)
- Action : Clic "Accepter" depuis "Tickets disponibles"

### 3. Mission Créée
```json
{
  "id": "2d84c11c-6415-4f49-ba33-8b53ae1ee22d",
  "ticket_id": "...",
  "entreprise_id": "6ff210bc-...",
  "technicien_id": null,
  "statut": "en_attente",
  "created_at": "2026-01-04T17:03:22"
}
```

### 4. État DB Confirmé
```sql
SELECT * FROM missions WHERE id = '2d84c11c-6415-4f49-ba33-8b53ae1ee22d';

Résultat:
- ✅ Mission existe
- ✅ entreprise_id = Perreti SA
- ✅ technicien_id = NULL (pas encore assigné)
- ✅ statut = 'en_attente'
- ✅ Ticket associé = statut 'en_cours'
```

---

## 🔍 Constat UI

### Section "Mes missions" (Dashboard Entreprise)

**Ce qui s'affiche** :
- ✅ Mission apparaît dans la liste
- ✅ Titre ticket affiché
- ✅ Description affichée
- ✅ Statut mission affiché ("En attente")
- ✅ Date création affichée
- ✅ Plafond intervention affiché

**Ce qui MANQUE** :
- ❌ **AUCUN BOUTON d'action**
- ❌ Pas de "Assigner technicien"
- ❌ Pas de "Définir date intervention"
- ❌ Pas de "Ajouter notes"
- ❌ Pas de "Voir détails"
- ❌ Pas de "Générer facture"

### Code Source
**Fichier** : `public/entreprise/dashboard.html`  
**Fonction** : `renderMissionCard()` (ligne 959)

```javascript
function renderMissionCard(mission) {
  // ... affichage infos ...
  
  return `
    <div class="ticket-card">
      <h3>${escapeHtml(ticket?.titre || 'Mission sans titre')}</h3>
      <!-- ... infos read-only ... -->
      
      <!-- ❌ AUCUN BOUTON ICI -->
    </div>
  `;
}
```

**Comparaison avec `renderTicketCard()`** :
```javascript
function renderTicketCard(ticket) {
  // ... affichage infos ...
  
  return `
    <div class="ticket-card">
      <!-- ... -->
      <div class="ticket-card-footer">
        <div class="ticket-card-actions">
          <button onclick="openTicketDetailsModal()">📄 Détails</button>
          <button onclick="accepterTicket()">✅ Accepter</button>
        </div>
      </div>
    </div>
  `;
}
```

---

## 🧪 Tests Backend

### 1. RPC assign_technicien_to_mission

**Test** :
```bash
node audit/_check_missions_entreprise.js
```

**Résultat** :
```
✅ RPC assign_technicien_to_mission existe
✅ Appel test réussi (erreur params attendue)
```

### 2. Policies RLS

**Test SELECT** :
```javascript
const { data: missions } = await supabase
  .from('missions')
  .select('*')
  .eq('entreprise_id', '<entreprise_id>');
```

**Résultat** : ✅ OK (1 mission retournée)

**Test UPDATE** :
```javascript
const { data, error } = await supabase
  .from('missions')
  .update({ notes: 'Test update' })
  .eq('id', '<mission_id>');
```

**Résultat** : ✅ OK (notes mises à jour)

### 3. Techniciens Disponibles

**Test** :
```javascript
const { data: techniciens } = await supabase
  .from('techniciens')
  .select('*')
  .eq('entreprise_id', '<entreprise_id>')
  .eq('actif', true);
```

**Résultat** : ✅ 2 techniciens actifs
- TEchn Teste ✅
- Jean Dupont ✅

---

## 🎯 Cause Racine

**CAUSE IDENTIFIÉE** : **Frontend incomplet**

### Backend : ✅ Fonctionnel
- ✅ RPC `assign_technicien_to_mission` existe
- ✅ RPC `start_mission`, `complete_mission` existent
- ✅ Policies RLS missions OK (SELECT + UPDATE entreprise)
- ✅ Techniciens disponibles

### Frontend : ❌ Non Implémenté
- ❌ Fonction `renderMissionCard()` **n'affiche AUCUN bouton**
- ❌ Aucune fonction `assignerTechnicien()` dans le code
- ❌ Aucune fonction `demarrerMission()` dans le code
- ❌ Aucune fonction `terminerMission()` dans le code
- ❌ Aucune modal "Détails mission" avec actions

---

## 📊 Erreurs Console/Réseau

**Aucune erreur** car **aucun appel API n'est tenté** (boutons absents).

Console navigateur :
```
[MISSIONS] Missions chargées: 1  ← OK
```

Pas d'appel réseau à `/rpc/assign_technicien_to_mission` car UI ne le déclenche jamais.

---

## ✅ Conclusion

### Bloqueur
**L'entreprise ne peut RIEN faire avec la mission** car l'UI ne propose **aucune action**.

### Causes
1. ❌ `renderMissionCard()` affiche uniquement des infos read-only
2. ❌ Pas de boutons "Assigner", "Détails", "Notes"
3. ❌ Pas de modale pour sélectionner technicien
4. ❌ Pas de fonctions JavaScript pour appeler les RPC

### Backend
✅ Complètement fonctionnel (RPC + RLS OK)

### Solution Nécessaire
Implémenter UI actions missions dans `public/entreprise/dashboard.html` :
1. Ajouter boutons dans `renderMissionCard()`
2. Créer fonction `assignerTechnicien(missionId)`
3. Créer modale sélection technicien
4. Appeler RPC `assign_technicien_to_mission`
5. Refresh liste missions après action

---

**Fin du rapport** | 2026-01-06
