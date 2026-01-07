# 🔧 CORRECTIF URGENT : Bouton "Démarrer Mission" (Erreur 500)

## 🎯 Cause Racine Identifiée

Le bouton "Démarrer Mission" retourne une **erreur 500** à cause d'un **trigger PostgreSQL défectueux** qui référence une colonne `reference` inexistante dans la table `missions`.

### Détails techniques

**Erreur PostgreSQL** :
```
code: '42703'
message: 'column t.reference does not exist'
```

**Triggers problématiques** :
1. `mission_status_change_notification` → fonction `notify_mission_status_change_extended()`
2. `trigger_mission_technicien_assignment` → fonction `notify_technicien_assignment()`

Ces triggers se déclenchent lors de l'UPDATE de la table `missions` et tentent d'accéder à `NEW.reference`, mais cette colonne n'existe pas.

---

## ✅ Solution en 3 Étapes

### ÉTAPE 1 : Ouvrir le SQL Editor Supabase

🔗 **Lien direct** : https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql

### ÉTAPE 2 : Supprimer les triggers défectueux

**Copiez-collez ce code dans le SQL Editor** :

```sql
-- Supprimer les triggers défectueux
DROP TRIGGER IF EXISTS mission_status_change_notification ON missions;
DROP TRIGGER IF EXISTS trigger_mission_technicien_assignment ON missions;
```

Cliquez sur **RUN** (ou Ctrl+Enter).

### ÉTAPE 3 : Recréer les triggers corrigés

**Copiez-collez le contenu du fichier `_fix_trigger_reference.sql`** (107 lignes).

Ou copiez directement ce code :

```sql
-- =====================================================
-- CORRECTIF : Triggers utilisant colonne 'reference' inexistante
-- =====================================================

create or replace function notify_mission_status_change_extended()
returns trigger
language plpgsql
as $$
declare
  v_actor record;
  v_mission_ref text;
begin
  if OLD.statut is distinct from NEW.statut then
    -- Utiliser l'ID comme référence (premiers 8 caractères)
    v_mission_ref := 'MISSION-' || substring(NEW.id::text, 1, 8);
    
    -- Message système dans la messagerie
    perform create_system_message(
      NEW.id,
      'Statut changé : ' || OLD.statut || ' → ' || NEW.statut
    );
    
    -- Notifications pour tous les acteurs
    for v_actor in select * from get_mission_actors(NEW.id)
    loop
      insert into notifications (
        user_id,
        type,
        title,
        message,
        related_mission_id
      )
      values (
        v_actor.user_id,
        'mission_status_change',
        'Changement de statut - ' || v_mission_ref,
        'La mission est maintenant : ' || NEW.statut,
        NEW.id
      );
    end loop;
  end if;
  
  return NEW;
end;
$$;

create trigger mission_status_change_notification
  after update on missions
  for each row
  execute function notify_mission_status_change_extended();

-- =====================================================

create or replace function notify_technicien_assignment()
returns trigger
language plpgsql
as $$
declare
  v_tech_user_id uuid;
  v_mission_ref text;
  v_tech_nom text;
begin
  if OLD.technicien_id is null and NEW.technicien_id is not null then
    select user_id, nom into v_tech_user_id, v_tech_nom
    from techniciens
    where id = NEW.technicien_id;
    
    if v_tech_user_id is not null then
      v_mission_ref := 'MISSION-' || substring(NEW.id::text, 1, 8);
      
      perform create_system_message(
        NEW.id,
        'Technicien assigné : ' || v_tech_nom
      );
      
      insert into notifications (
        user_id,
        type,
        title,
        message,
        related_mission_id
      )
      values (
        v_tech_user_id,
        'mission_assigned',
        'Nouvelle mission assignée',
        'Vous avez été assigné à la mission ' || v_mission_ref,
        NEW.id
      );
    end if;
  end if;
  
  return NEW;
end;
$$;

create trigger trigger_mission_technicien_assignment
  after update on missions
  for each row
  execute function notify_technicien_assignment();
```

Cliquez sur **RUN**.

---

## 🧪 Validation

Une fois les triggers corrigés, exécutez ce test :

```bash
cd /workspaces/JETC_IMMO_SaaS
node _test_start_mission.js
```

**Résultat attendu** :
```
✅ RPC Success: { "success": true }
📊 État après RPC:
  Statut: en_cours
  Started_at: 2025-01-XX...
```

---

## 📋 Problème Secondaire Identifié

⚠️ **Le technicien n'existe pas dans la table `techniciens`**

```
Profile trouvé : demo.technicien@test.app (role: technicien)
Technicien table : NON TROUVÉ ❌
```

**Symptôme** : Le profile existe avec `role='technicien'` mais il n'y a pas d'entrée correspondante dans `techniciens(user_id=...)`.

**Impact** : Les notifications d'assignation ne fonctionneront pas pour ce technicien.

**Solution** : Créer l'entrée manquante après avoir corrigé les triggers.

---

## 📊 État Actuel

| Élément | État | Détails |
|---------|------|---------|
| Profile `demo.technicien@test.app` | ✅ Existe | ID: `3196179e-5258-457f-b31f-c88a4760ebe0` |
| Entrée dans `techniciens` | ❌ Manquante | Empêche notifications |
| Mission en attente | ✅ Existe | ID: `2d84c11c-6415-4f49-ba33-8b53ae1ee22d` |
| Triggers missions | ❌ Défectueux | Référence `NEW.reference` inexistant |
| RPC `start_mission()` | ⏳ Bloqué | Attend correction triggers |
| API `/api/missions/start` | ⏳ Non testé | Dépend du RPC |

---

## 🚀 Prochaines Actions

1. **VOUS** → Appliquer le correctif SQL (Étapes 1-3 ci-dessus)
2. **VOUS** → Confirmer que le correctif est appliqué
3. **MOI** → Créer l'entrée technicien manquante
4. **MOI** → Tester le workflow complet
5. **VALIDATION** → Tester depuis le frontend

---

## 📁 Fichiers Créés

- `_fix_trigger_reference.sql` - Correctif SQL complet
- `_test_start_mission.js` - Script de test RPC
- `_diagnostic_triggers.js` - Diagnostic complet
- `_CORRECTIF_START_MISSION.md` - Ce document

---

## ℹ️ Contexte Technique

**Endpoint API** : `/api/missions/start`
- Méthode : POST
- Body : `{ mission_id: "uuid" }`
- Auth : Bearer token (technicien ou entreprise)
- Appelle : `supabase.rpc('start_mission', { p_mission_id })`

**RPC `start_mission()`** :
- Vérifie statut = `en_attente`
- Update : `statut = 'en_cours'`, `started_at = now()`
- Retourne : `{ success: true/false, error?: string }`

**Trigger déclenché** :
- `mission_status_change_notification` (AFTER UPDATE)
- Tente d'envoyer notifications aux acteurs
- **BUG** : Accède à `NEW.reference` → ERREUR 42703

---

**Statut** : 🟡 En attente d'application manuelle du correctif SQL
