# Supabase - Structure SQL

## 📁 Organisation

Tous les fichiers SQL sont organisés par ordre d'exécution strict.

### /schema - Schéma de base de données

Ordre d'exécution **obligatoire** :

1. **01_extensions.sql** - Extensions PostgreSQL (uuid-ossp, pgcrypto)
2. **02_enums.sql** - Types énumérés (rôles, statuts, plans)
3. **03_core.sql** - Tables core (à créer)
4. **04_users.sql** - Table profiles et triggers (à créer)
5. **05_immo.sql** - Structure immobilière (à créer)
6. **06_tickets.sql** - Tickets d'intervention (à créer)
7. **07_missions.sql** - Missions techniques (à créer)
8. **08_billing.sql** - Abonnements et facturation (à créer)
9. **09_demo.sql** - Données DEMO (optionnel, à créer)

### /policies - Row Level Security

Les policies RLS seront créées à l'**ÉTAPE 7**.

Un fichier par table :
- 10_policies_profiles.sql
- 11_policies_regies.sql
- etc.

### /demo - Données de démonstration

Données fictives pour le MODE DEMO (optionnel).

---

## 🔒 Règles importantes

1. **Ne jamais sauter une étape**
2. **Exécuter dans l'ordre numérique**
3. **Vérifier l'absence d'erreurs avant de continuer**
4. **Les RLS sont créées APRÈS les tables**

---

## ⚙️ Exécution

Les fichiers peuvent être exécutés :
- Via l'interface Supabase (SQL Editor)
- Via le CLI Supabase
- Via des migrations (recommandé en production)

---

**ÉTAPE 0 - Structure préparée**  
Les fichiers complets seront créés aux étapes suivantes.
