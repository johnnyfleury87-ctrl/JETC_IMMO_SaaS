# 📋 GUIDE OFFICIEL DES STATUTS - JETC_IMMO_SaaS

> **Source de vérité unique** : Ce document définit LA logique métier officielle des statuts.  
> **Fichier SQL** : `supabase/schema/20_statuts_realignement.sql`  
> **Date** : 16 décembre 2025  
> **Version** : 1.0

---

## 🎯 PRINCIPES FONDAMENTAUX

### Règle absolue
❌ **AUCUNE modification de statut ne doit se faire directement côté frontend ou via UPDATE SQL manuel**

✅ **TOUTE transition de statut DOIT passer par les fonctions SQL centralisées** :
- `update_ticket_statut(ticket_id, nouveau_statut, role)`
- `update_mission_statut(mission_id, nouveau_statut, role)`
- `accept_ticket_and_create_mission(ticket_id, entreprise_id)`

### Garanties du système
- ✅ **Contrôles par rôle** : Chaque transition vérifie que le rôle a le droit de l'effectuer
- ✅ **Synchronisation automatique** : Les statuts ticket ↔ mission sont toujours cohérents
- ✅ **Erreurs explicites** : Les transitions interdites renvoient des messages d'erreur clairs
- ✅ **Traçabilité** : Toutes les transitions sont horodatées (`updated_at`, `locked_at`, etc.)

---

## 🎫 STATUTS DES TICKETS

### Cycle de vie (vue locataire/régie)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CYCLE DE VIE D'UN TICKET                        │
└─────────────────────────────────────────────────────────────────────┘

    [CRÉATION]
        │
        ↓
   ┌─────────┐
   │ nouveau │ ← Ticket créé par le locataire
   └────┬────┘
        │ (régie diffuse)
        ↓
  ┌──────────────┐
  │  en_attente  │ ← Ticket diffusé aux entreprises autorisées
  └──────┬───────┘
        │ (entreprise accepte)
        ↓
   ┌──────────┐
   │ en_cours │ ← Mission créée, intervention planifiée
   └────┬─────┘
        │ (entreprise termine)
        ↓
   ┌─────────┐
   │ termine │ ← Travaux terminés, en attente validation régie
   └────┬────┘
        │ (régie valide)
        ↓
    ┌──────┐
    │ clos │ ← Ticket clôturé définitivement
    └──────┘

        │ (annulation possible à tout moment par régie/locataire)
        ↓
    ┌────────┐
    │ annule │ ← Ticket annulé
    └────────┘
```

### Matrice des transitions autorisées

| Statut actuel | Statut cible | Rôle(s) autorisé(s) | Fonction SQL | API |
|--------------|--------------|---------------------|--------------|-----|
| `nouveau` | `en_attente` | `regie`, `admin_jtec` | `update_ticket_statut()` | `POST /api/tickets/diffuser` |
| `nouveau` | `annule` | `regie`, `locataire`, `admin_jtec` | `update_ticket_statut()` | *(à créer)* |
| `en_attente` | `en_cours` | `entreprise`, `admin_jtec` | `accept_ticket_and_create_mission()` | `POST /api/tickets/accept` |
| `en_attente` | `annule` | `regie`, `admin_jtec` | `update_ticket_statut()` | *(à créer)* |
| `en_cours` | `termine` | `entreprise`, `admin_jtec` | Synchronisé via `update_mission_statut()` | `POST /api/missions/complete` |
| `en_cours` | `annule` | `regie`, `admin_jtec` | `update_ticket_statut()` | *(à créer)* |
| `termine` | `clos` | `regie`, `admin_jtec` | `update_ticket_statut()` | `POST /api/missions/validate` |
| `clos` | *(aucune)* | *(aucun)* | Statut final | - |
| `annule` | *(aucune)* | *(aucun)* | Statut final | - |

### Visibilité par rôle

| Rôle | Statuts visibles | Vue SQL | Description |
|------|------------------|---------|-------------|
| **Locataire** | `nouveau`, `en_attente`, `en_cours`, `termine`, `clos`, `annule` | `tickets_locataire` | Voit uniquement SES propres tickets |
| **Régie** | Tous les statuts de son périmètre | `tickets_regie` | Voit tous les tickets de ses immeubles |
| **Entreprise** | `en_attente` (pool), `en_cours`, `termine`, `clos` (ses missions) | `tickets_entreprise` | Voit les tickets diffusés + ses missions acceptées |
| **Technicien** | `en_cours`, `termine` (ses missions) | *(via missions)* | Voit uniquement les missions où il est assigné |
| **Admin JTEC** | Tous les statuts, tous les tickets | `tickets` | Accès complet pour supervision |

---

## 🎯 STATUTS DES MISSIONS

### Cycle de vie (exécution opérationnelle)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CYCLE DE VIE D'UNE MISSION                       │
└─────────────────────────────────────────────────────────────────────┘

    [ACCEPTATION TICKET]
        │
        ↓
  ┌──────────────┐
  │  en_attente  │ ← Mission créée, en attente de démarrage
  └──────┬───────┘
        │ (entreprise/technicien démarre)
        ↓
   ┌──────────┐
   │ en_cours │ ← Intervention en cours d'exécution
   └────┬─────┘
        │ (entreprise/technicien termine)
        ↓
  ┌──────────┐
  │ terminee │ ← Travaux terminés, en attente validation
  └────┬─────┘
        │ (régie valide)
        ↓
  ┌─────────┐
  │ validee │ ← Mission validée définitivement
  └─────────┘

        │ (annulation possible par régie/entreprise)
        ↓
   ┌────────┐
   │ annulee│ ← Mission annulée
   └────────┘
```

### Matrice des transitions autorisées

| Statut actuel | Statut cible | Rôle(s) autorisé(s) | Fonction SQL | API |
|--------------|--------------|---------------------|--------------|-----|
| `en_attente` | `en_cours` | `entreprise`, `technicien`, `admin_jtec` | `update_mission_statut()` | `POST /api/missions/start` |
| `en_attente` | `annulee` | `regie`, `entreprise`, `admin_jtec` | `update_mission_statut()` | *(à créer)* |
| `en_cours` | `terminee` | `entreprise`, `technicien`, `admin_jtec` | `update_mission_statut()` | `POST /api/missions/complete` |
| `en_cours` | `annulee` | `regie`, `admin_jtec` | `update_mission_statut()` | *(à créer)* |
| `terminee` | `validee` | `regie`, `admin_jtec` | `update_mission_statut()` | `POST /api/missions/validate` |
| `validee` | *(aucune)* | *(aucun)* | Statut final | - |
| `annulee` | *(aucune)* | *(aucun)* | Statut final | - |

---

## 🔁 SYNCHRONISATION AUTOMATIQUE TICKET ↔ MISSION

### Règle de cohérence
**Une mission est toujours rattachée à UN ticket unique (relation 1:1)**

La fonction `update_mission_statut()` synchronise automatiquement le ticket associé :

| Changement mission | Synchronisation ticket automatique |
|-------------------|-----------------------------------|
| `en_attente` → `en_cours` | Ticket passe en `en_cours` |
| `en_cours` → `terminee` | Ticket passe en `termine` |
| `terminee` → `validee` | Ticket passe en `clos` + `date_cloture` |
| `*` → `annulee` | Ticket passe en `annule` + `date_cloture` |

### Verrouillage du ticket
Lors de l'acceptation d'un ticket (création mission), le ticket est **verrouillé** :
```sql
locked_at = now()  -- Empêche une seconde entreprise d'accepter le même ticket
```

---

## 📊 EXEMPLES DE PARCOURS MÉTIER

### Parcours nominal (succès)

```
┌──────────────┬─────────────────┬──────────────────┬─────────────────────┐
│   ACTEUR     │   ACTION        │   TICKET         │   MISSION           │
├──────────────┼─────────────────┼──────────────────┼─────────────────────┤
│ Locataire    │ Crée ticket     │ nouveau          │ (aucune)            │
├──────────────┼─────────────────┼──────────────────┼─────────────────────┤
│ Régie        │ Diffuse         │ en_attente       │ (aucune)            │
├──────────────┼─────────────────┼──────────────────┼─────────────────────┤
│ Entreprise   │ Accepte         │ en_cours         │ en_attente          │
├──────────────┼─────────────────┼──────────────────┼─────────────────────┤
│ Technicien   │ Démarre         │ en_cours         │ en_cours            │
├──────────────┼─────────────────┼──────────────────┼─────────────────────┤
│ Technicien   │ Termine         │ termine          │ terminee            │
├──────────────┼─────────────────┼──────────────────┼─────────────────────┤
│ Régie        │ Valide          │ clos             │ validee             │
└──────────────┴─────────────────┴──────────────────┴─────────────────────┘
```

### Parcours avec annulation (régie)

```
┌──────────────┬─────────────────┬──────────────────┬─────────────────────┐
│   ACTEUR     │   ACTION        │   TICKET         │   MISSION           │
├──────────────┼─────────────────┼──────────────────┼─────────────────────┤
│ Locataire    │ Crée ticket     │ nouveau          │ (aucune)            │
├──────────────┼─────────────────┼──────────────────┼─────────────────────┤
│ Régie        │ Diffuse         │ en_attente       │ (aucune)            │
├──────────────┼─────────────────┼──────────────────┼─────────────────────┤
│ Entreprise   │ Accepte         │ en_cours         │ en_attente          │
├──────────────┼─────────────────┼──────────────────┼─────────────────────┤
│ Régie        │ Annule mission  │ annule           │ annulee             │
└──────────────┴─────────────────┴──────────────────┴─────────────────────┘
```

---

## 🛑 TRANSITIONS INTERDITES (avec messages d'erreur)

### Exemples de transitions bloquées

| Tentative | Erreur retournée | Raison |
|-----------|------------------|--------|
| `nouveau` → `termine` | `"Transition nouveau → termine non autorisée pour le rôle regie"` | Il faut passer par en_attente et en_cours |
| `clos` → `en_cours` | `"Un ticket clos ne peut plus changer de statut"` | Statut final |
| Locataire diffuse ticket | `"Transition nouveau → en_attente non autorisée pour le rôle locataire"` | Seule la régie peut diffuser |
| Entreprise valide mission | `"Transition terminee → validee non autorisée pour le rôle entreprise"` | Seule la régie peut valider |

---

## 🔐 CONTRÔLES DE SÉCURITÉ

### Vérifications automatiques

Chaque fonction de transition effectue les vérifications suivantes :

1. **Existence de l'entité** : Le ticket/mission existe-t-il ?
2. **Statut actuel** : Quel est le statut actuel ?
3. **Rôle autorisé** : Le rôle a-t-il le droit de faire cette transition ?
4. **Logique métier** : La transition respecte-t-elle les règles métier ?

### Sécurité des fonctions SQL

Toutes les fonctions sont `SECURITY DEFINER` et contrôlent explicitement le rôle passé en paramètre :

```sql
create or replace function update_ticket_statut(
  p_ticket_id uuid,
  p_nouveau_statut ticket_status,
  p_role user_role  -- ⚠️ Le rôle doit être vérifié par l'API avant appel
)
returns jsonb
language plpgsql
security definer  -- S'exécute avec les droits du créateur
```

**Important** : Les APIs doivent récupérer le rôle depuis le profil authentifié, PAS depuis le body de la requête.

---

## 📝 UTILISATION DES APIS

### 1. Diffuser un ticket (Régie)

**Endpoint** : `POST /api/tickets/diffuser`

```json
{
  "ticket_id": "uuid"
}
```

**Headers** :
```
Authorization: Bearer <token_regie>
```

**Réponse succès** :
```json
{
  "success": true,
  "ancien_statut": "nouveau",
  "nouveau_statut": "en_attente",
  "message": "Ticket diffusé aux entreprises"
}
```

**Réponse erreur** :
```json
{
  "success": false,
  "error": "Transition nouveau → en_attente non autorisée pour le rôle locataire",
  "statut_actuel": "nouveau",
  "statut_demande": "en_attente",
  "role": "locataire"
}
```

### 2. Accepter un ticket (Entreprise)

**Endpoint** : `POST /api/tickets/accept`

```json
{
  "ticket_id": "uuid",
  "entreprise_id": "uuid"
}
```

**Effet** :
- Vérifie que le ticket est `en_attente`
- Vérifie que l'entreprise est autorisée
- Crée une mission avec statut `en_attente`
- Passe le ticket en `en_cours`
- Verrouille le ticket (`locked_at = now()`)

### 3. Démarrer une mission (Entreprise/Technicien)

**Endpoint** : `POST /api/missions/start`

```json
{
  "mission_id": "uuid"
}
```

**Effet** :
- Mission `en_attente` → `en_cours`
- Ticket reste `en_cours` (synchronisé)
- `started_at = now()`

### 4. Terminer une mission (Entreprise/Technicien)

**Endpoint** : `POST /api/missions/complete`

```json
{
  "mission_id": "uuid",
  "rapport_url": "https://storage.supabase.co/..." // optionnel
}
```

**Effet** :
- Mission `en_cours` → `terminee`
- Ticket `en_cours` → `termine` (synchronisé automatiquement)
- `completed_at = now()`

### 5. Valider une mission (Régie)

**Endpoint** : `POST /api/missions/validate`

```json
{
  "mission_id": "uuid"
}
```

**Effet** :
- Mission `terminee` → `validee`
- Ticket `termine` → `clos` (synchronisé automatiquement)
- `validated_at = now()`
- `date_cloture = now()` (sur le ticket)

---

## 🧪 TESTS DE VALIDATION

Fichier : `tests/statuts.test.js`

### Tests implémentés

✅ **Schéma SQL** (5 tests)
- Existence du fichier 20_statuts_realignement.sql
- Définition des enums ticket_status et mission_status
- Création des vues tickets_regie/entreprise/locataire
- Existence de l'API diffuser
- Utilisation de update_mission_statut dans les APIs

✅ **Transitions valides** (7 tests)
- nouveau → en_attente (régie)
- en_attente → en_cours (entreprise)
- en_cours → termine (entreprise)
- termine → clos (régie)
- Mission : en_attente → en_cours
- Mission : en_cours → terminee
- Mission : terminee → validee

✅ **Transitions interdites** (5 tests)
- Ticket clos bloqué
- Mission validée bloquée
- Locataire ne peut pas diffuser
- Entreprise ne peut pas valider
- Impossible de sauter des étapes

✅ **Synchronisation** (5 tests)
- Mission en_cours → Ticket en_cours
- Mission terminee → Ticket termine
- Mission validee → Ticket clos
- Mission annulee → Ticket annule
- accept_ticket verrouille le ticket

✅ **Cohérence** (3 tests)
- Aucune divergence possible
- Documentation des transitions
- Grants définis

✅ **Documentation** (2 tests)
- Commentaires explicites sur fonctions
- Commentaires métier sur enums

**Total : 27 tests**

### Exécution des tests

```bash
cd /workspaces/JETC_IMMO_SaaS
node tests/statuts.test.js
```

---

## 📋 CHECKLIST DE CONFORMITÉ

### Pour un développeur

- [ ] Je n'utilise JAMAIS `UPDATE tickets SET statut = ...` directement
- [ ] Je n'utilise JAMAIS `UPDATE missions SET statut = ...` directement
- [ ] J'appelle toujours `update_ticket_statut()` ou `update_mission_statut()`
- [ ] Je récupère le rôle depuis `profiles.role` (pas depuis le body)
- [ ] Je gère les erreurs retournées par les fonctions SQL
- [ ] Je teste les transitions interdites (pas seulement les valides)

### Pour un product owner

- [ ] Chaque transition est documentée dans ce guide
- [ ] Chaque rôle a des permissions claires
- [ ] Les règles métier sont cohérentes avec le terrain
- [ ] Les messages d'erreur sont explicites

### Pour une régie

- [ ] Je sais que je dois diffuser un ticket avant qu'une entreprise puisse l'accepter
- [ ] Je sais que seule moi peut valider une mission terminée
- [ ] Je sais que je peux annuler une mission à tout moment
- [ ] Je vois tous les tickets de mon périmètre dans la vue tickets_regie

### Pour un juriste

- [ ] Chaque action est traçable (created_at, updated_at, locked_at, etc.)
- [ ] Les transitions respectent une chaîne de responsabilité claire
- [ ] Les statuts finaux (clos, validee) ne peuvent plus être modifiés
- [ ] La synchronisation automatique garantit la cohérence des données

---

## 🚀 ROADMAP

### ✅ Déjà implémenté (v1.0)

- Fonctions centralisées de transition
- Synchronisation automatique ticket ↔ mission
- Contrôles par rôle
- Vues par rôle
- Tests de validation (27 tests)
- API diffuser
- APIs missions (start/complete/validate)

### 📝 À implémenter (v1.1)

- [ ] API pour annuler un ticket (`POST /api/tickets/annuler`)
- [ ] API pour annuler une mission (`POST /api/missions/annuler`)
- [ ] Trigger pour empêcher UPDATE direct (désactivé par défaut)
- [ ] Dashboard de monitoring des transitions
- [ ] Logs d'audit détaillés (qui a fait quelle transition quand)

### 🔮 Évolutions futures (v2.0)

- [ ] Workflow configurable par régie (étapes optionnelles)
- [ ] Notifications automatiques à chaque transition
- [ ] Historique des transitions (table `transitions_log`)
- [ ] Métriques de temps par étape (SLA monitoring)

---

## 📚 RÉFÉRENCES

### Fichiers sources

- **SQL** : `supabase/schema/20_statuts_realignement.sql` (source de vérité)
- **Tests** : `tests/statuts.test.js` (27 tests)
- **APIs** :
  - `api/tickets/diffuser.js`
  - `api/missions/start.js`
  - `api/missions/complete.js`
  - `api/missions/validate.js`

### Documentation liée

- `VALIDATION_ETAPE_7.md` : Documentation ÉTAPE 7 (tickets)
- `VALIDATION_ETAPE_10.md` : Documentation ÉTAPE 10 (missions)
- `README.md` : Architecture générale du projet

---

## ❓ FAQ

**Q : Pourquoi ne pas laisser le frontend modifier les statuts directement ?**  
R : Pour garantir la cohérence des données, les contrôles de sécurité par rôle, et la synchronisation automatique. Toute la logique métier est centralisée côté SQL.

**Q : Que se passe-t-il si j'essaie de faire une transition interdite ?**  
R : La fonction SQL retourne `{ success: false, error: "message explicite" }` sans modifier les données.

**Q : Comment tester les transitions en développement ?**  
R : Lancez `node tests/statuts.test.js` pour valider les 27 tests de validation.

**Q : Peut-on ajouter de nouveaux statuts ?**  
R : Oui, mais il faut :
1. Modifier les enums dans `20_statuts_realignement.sql`
2. Mettre à jour `update_ticket_statut()` et `update_mission_statut()`
3. Ajouter les transitions dans ce guide
4. Ajouter les tests correspondants

**Q : Qui peut voir quels statuts ?**  
R : Consultez la section "Visibilité par rôle" de ce guide (tableaux détaillés).

---

**Document maintenu par** : Équipe Dev JETC_IMMO  
**Dernière mise à jour** : 16 décembre 2025  
**Version** : 1.0 (Production Ready)
