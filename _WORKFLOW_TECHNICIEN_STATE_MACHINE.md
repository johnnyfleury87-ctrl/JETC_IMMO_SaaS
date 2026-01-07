# 🎯 WORKFLOW TECHNICIEN - STATE MACHINE & RÈGLES MÉTIER

## État des Lieux

### Tables impliquées
- `missions` : Mission assignée au technicien
- `tickets` : Ticket source (problème locataire)
- `mission_signalements` : Signalements créés par technicien
- `techniciens` : Profil technicien
- `profiles` : Authentification (lié via profile_id)

---

## 📊 STATE MACHINE MISSIONS

### États (enum mission_status)

```sql
CREATE TYPE mission_status AS ENUM (
  'en_attente',    -- Mission créée, pas encore démarrée
  'en_cours',      -- Technicien a démarré
  'terminee',      -- Technicien a terminé
  'validee',       -- Régie a validé (optionnel)
  'annulee'        -- Annulée par régie/entreprise
);
```

### Transitions Autorisées

```
┌─────────────┐
│ en_attente  │ ◄── Création mission (entreprise accepte ticket)
└──────┬──────┘
       │ start_mission() [entreprise OU technicien]
       ▼
┌─────────────┐
│  en_cours   │
└──────┬──────┘
       │ complete_mission() [entreprise OU technicien]
       ▼
┌─────────────┐
│  terminee   │
└──────┬──────┘
       │ validate_mission() [régie seulement]
       ▼
┌─────────────┐
│   validee   │ ◄── État final
└─────────────┘

       ┌─────────────┐
       │   annulee   │ ◄── Possible depuis en_attente ou en_cours (régie)
       └─────────────┘
```

---

## 🔑 PERMISSIONS TECHNICIEN

### Ce qu'un technicien PEUT faire

| Action | Statuts autorisés | API/RPC | Implémentation |
|--------|-------------------|---------|----------------|
| **Voir ses missions** | Tous | `SELECT missions WHERE technicien_id` | RLS Policy ✅ |
| **Démarrer mission** | `en_attente` | `start_mission()` | RPC SECURITY DEFINER ✅ |
| **Terminer mission** | `en_cours` | `complete_mission()` | RPC SECURITY DEFINER ✅ |
| **Ajouter notes** | `en_attente`, `en_cours`, `terminee` | `UPDATE missions.notes` | RLS Policy ✅ |
| **Créer signalement** | `en_cours`, `terminee` | `INSERT mission_signalements` | RLS Policy ✅ |
| **Upload photos** | `en_cours`, `terminee` | Storage + `UPDATE missions.photos_urls` | API ✅ |
| **Voir ticket/logement/locataire** | Si mission assignée | `SELECT tickets/logements/locataires` | RLS Policy ✅ (V2 SECURITY DEFINER) |

### Ce qu'un technicien NE PEUT PAS faire

- ❌ Modifier `entreprise_id`, `technicien_id`, `ticket_id`
- ❌ Créer de nouvelles missions
- ❌ Valider une mission (réservé régie)
- ❌ Annuler une mission
- ❌ Voir missions d'autres techniciens

---

## 🛠️ IMPLÉMENTATION ACTUELLE

### Frontend ([public/technicien/dashboard.html](public/technicien/dashboard.html))

**Boutons conditionnels:**
```javascript
function getActionButtons(mission) {
  if (mission.statut === 'en_attente') {
    return `
      <button class="btn-primary" onclick="startMission('${mission.id}')">
        ▶️ Démarrer
      </button>
      <button class="btn-secondary" onclick="viewDetails('${mission.id}')">
        Détails
      </button>
    `;
  } else if (mission.statut === 'en_cours') {
    return `
      <button class="btn-success" onclick="completeMission('${mission.id}')">
        ✅ Terminer
      </button>
      <button class="btn-secondary" onclick="viewDetails('${mission.id}')">
        Détails
      </button>
    `;
  } else {
    return `
      <button class="btn-secondary" onclick="viewDetails('${mission.id}')">
        Voir détails
      </button>
    `;
  }
}
```

**Logs standardisés:**
```javascript
// Démarrer
[TECH][START][CLICK] mission_id=...
[TECH][START][PAYLOAD] {...}
[TECH][START][RESP] status=200 OK
[TECH][START][SUCCESS] {...}

// Terminer
[TECH][COMPLETE][CLICK] mission_id=...
[TECH][COMPLETE][PAYLOAD] {...}
[TECH][COMPLETE][RESP] status=200 OK
[TECH][COMPLETE][SUCCESS] {...}

// Erreurs
[TECH][START][ERROR] {...}
[TECH][START][EXCEPTION] Error: ...
```

### Backend

**API Routes:**
- [/api/missions/start.js](api/missions/start.js)
  - Authentification requise
  - Rôle: `entreprise` OU `technicien`
  - Appelle `start_mission(p_mission_id)`
  
- [/api/missions/complete.js](api/missions/complete.js)
  - Authentification requise
  - Rôle: `entreprise` OU `technicien`
  - Appelle `complete_mission(p_mission_id, p_rapport_url)`

**RPC Functions (SECURITY DEFINER = bypass RLS):**

```sql
-- supabase/schema/14_intervention.sql

-- Démarrer mission
CREATE OR REPLACE FUNCTION start_mission(p_mission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vérifie: statut = en_attente
  -- Update: statut = en_cours, started_at = now()
  -- Return: { success: true } ou { success: false, error: "..." }
END;
$$;

-- Terminer mission
CREATE OR REPLACE FUNCTION complete_mission(
  p_mission_id uuid,
  p_rapport_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vérifie: statut = en_cours
  -- Vérifie: technicien_id NOT NULL
  -- Update: statut = terminee, completed_at = now(), date_intervention_realisee = now()
  -- Return: { success: true } ou { success: false, error: "..." }
END;
$$;
```

### RLS Policies

**Missions (SELECT):**
```sql
CREATE POLICY "Technicien can view assigned missions"
ON missions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM techniciens t
    WHERE t.id = missions.technicien_id
      AND t.profile_id = auth.uid()
  )
);
```

**Missions (UPDATE):**
❌ Pas de policy UPDATE directe pour techniciens
✅ Updates passent par RPC SECURITY DEFINER (start_mission, complete_mission)

**Tickets/Locataires/Logements (SELECT):**
✅ Via fonctions SECURITY DEFINER (évite récursion RLS) - Voir [_migration_rls_techniciens_tickets_v2.sql](_migration_rls_techniciens_tickets_v2.sql)

---

## 🐛 PROBLÈMES IDENTIFIÉS & FIXES

### Problème 1: API appelle fonction inexistante ❌

**Symptôme:**
```
Error: Could not find the function public.update_mission_statut
```

**Cause:**
- API [/api/missions/start.js](api/missions/start.js) appelait `update_mission_statut()`
- Cette fonction n'existe PAS en production
- Les fonctions déployées sont `start_mission()` et `complete_mission()`

**Fix:** ✅ Corrigé
```javascript
// Avant (BUGUÉ)
await supabase.rpc('update_mission_statut', {
  p_mission_id: mission_id,
  p_nouveau_statut: 'en_cours',
  p_role: profile.role
});

// Après (OK)
await supabase.rpc('start_mission', {
  p_mission_id: mission_id
});
```

### Problème 2: Trigger utilise colonne inexistante ❌

**Symptôme:**
```
Error: record "new" has no field "reference"
```

**Cause:**
- Trigger `notify_mission_status_change_extended` essaie d'accéder `NEW.reference`
- Table `missions` n'a PAS de colonne `reference`
- La référence est dans `tickets.reference`

**Fix:** ✅ Migration M48
```sql
-- Avant (BUGUÉ)
v_mission_ref := NEW.reference;  -- ❌ missions n'a pas cette colonne

-- Après (OK)
SELECT t.reference INTO v_ticket_ref
FROM tickets t
WHERE t.id = NEW.ticket_id;

v_mission_ref := COALESCE(v_ticket_ref, 'Mission ' || LEFT(NEW.id::text, 8));
```

**Fichiers modifiés:**
- [supabase/migrations/20260107000000_m48_fix_demarrer_mission.sql](supabase/migrations/20260107000000_m48_fix_demarrer_mission.sql)
- Fonctions: `notify_mission_status_change_extended()`, `notify_technicien_assignment()`

---

## 📋 CHECKLIST DÉPLOIEMENT

### ✅ Correctifs Backend
- [x] API `/api/missions/start.js` → Appelle `start_mission()`
- [x] API `/api/missions/complete.js` → Appelle `complete_mission()`
- [x] Trigger `notify_mission_status_change_extended` → Utilise `tickets.reference`
- [x] Trigger `notify_technicien_assignment` → Utilise `tickets.reference` + `profile_id`

### ✅ Correctifs Frontend
- [x] Logs renforcés (CLICK, PAYLOAD, RESP, SUCCESS, ERROR, EXCEPTION)
- [x] Guards: Boutons conditionnels selon statut
- [x] Messages d'erreur détaillés

### 🔧 Déploiement SQL Requis
1. Exécuter [_deploy_m48_func1.sql](_deploy_m48_func1.sql) (fonction notify_mission_status_change_extended)
2. Exécuter [_deploy_m48_func2.sql](_deploy_m48_func2.sql) (fonction notify_technicien_assignment)

### 🧪 Tests
Après déploiement, exécuter:
```bash
node _test_fix_demarrer_mission.js
```

---

## 🎯 WORKFLOW UTILISATEUR FINAL

### Scénario nominal

1. **Régie crée ticket** → `ticket.statut = 'ouvert'`

2. **Entreprise accepte ticket** → Crée mission
   - `mission.statut = 'en_attente'`
   - `mission.entreprise_id` = entreprise
   - `mission.technicien_id` = NULL (pas encore assigné)

3. **Entreprise assigne technicien**
   - `mission.technicien_id` = UUID technicien
   - Trigger: Notification envoyée au technicien

4. **Technicien voit mission dans dashboard**
   - Login: `demo.technicien@test.app`
   - Dashboard: Liste missions assignées
   - Bouton "▶️ Démarrer" visible

5. **Technicien clique "Démarrer"**
   ```
   [TECH][START][CLICK] mission_id=...
   → POST /api/missions/start
   → RPC start_mission()
   → mission.statut = 'en_cours'
   → mission.started_at = now()
   ```

6. **Technicien intervient**
   - Ajoute notes dans modal détails
   - Upload photos (Storage Supabase)
   - Crée signalements si besoin

7. **Technicien clique "Terminer"**
   ```
   [TECH][COMPLETE][CLICK] mission_id=...
   → POST /api/missions/complete
   → RPC complete_mission()
   → mission.statut = 'terminee'
   → mission.completed_at = now()
   → mission.date_intervention_realisee = now()
   ```

8. **Régie valide (optionnel)**
   - `mission.statut = 'validee'`
   - `ticket.statut = 'clos'`

---

## 🔐 SÉCURITÉ

### Authentification
- JWT Supabase (auth.uid())
- Session vérifiée avant chaque requête

### Autorisation
- RLS activé sur toutes les tables
- Policies isolent données par profil
- RPC SECURITY DEFINER pour actions métier (bypass RLS contrôlé)

### Validation
- API vérifie rôle utilisateur
- RPC vérifie transitions statut
- Frontend disable boutons selon état

### Audit
- Logs console détaillés
- Timestamps sur toutes mutations
- Triggers notifient changements

---

## 🚀 ÉVOLUTIONS FUTURES

### Court terme
- [ ] Ajouter contrainte FK `missions.technicien_id → techniciens.id` ON DELETE RESTRICT
- [ ] Index sur `missions.technicien_id` pour performance
- [ ] Gestion incident (nouveau statut?)

### Moyen terme
- [ ] Workflow validation photos obligatoires
- [ ] Signature électronique locataire
- [ ] Temps d'intervention (calcul auto)
- [ ] Historique statuts (audit trail)

### Long terme
- [ ] App mobile technicien (React Native)
- [ ] Mode hors-ligne (sync)
- [ ] Géolocalisation interventions
- [ ] Planning / calendrier intégré

---

**Dernière mise à jour:** 7 janvier 2026
**Version:** 1.0 (Post-fix M48)
