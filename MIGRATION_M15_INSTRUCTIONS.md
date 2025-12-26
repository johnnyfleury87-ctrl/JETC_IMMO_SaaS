# 🔧 MIGRATION M15 - INSTRUCTIONS D'APPLICATION

**Date** : 2025-12-26  
**Fichier** : `supabase/migrations/20251226180000_m15_allow_null_priorite_plafond.sql`

---

## 📋 CONTEXTE

**Bug actuel** :
```
"null value in column priorite violates not-null constraint"
```

**Décision métier** :
- ✅ Le locataire NE choisit PAS la priorité
- ✅ Le locataire NE choisit PAS le plafond
- ✅ Ces champs sont définis par la RÉGIE lors de la validation du ticket

**Solution** :
- DROP NOT NULL sur `tickets.priorite`
- DROP NOT NULL sur `tickets.plafond_intervention_chf`

---

## 🚀 APPLICATION DE LA MIGRATION

### Option 1 : Via Supabase Dashboard (RECOMMANDÉ)

1. **Se connecter à Supabase Dashboard**
   - Aller sur https://supabase.com
   - Sélectionner votre projet JETC_IMMO_SaaS

2. **Ouvrir SQL Editor**
   - Menu latéral → "SQL Editor"
   - Cliquer "New query"

3. **Copier-coller la migration**
   ```sql
   -- ============================================
   -- MIGRATION M15 : Autoriser NULL pour priorite et plafond_intervention_chf
   -- ============================================
   
   BEGIN;
   
   -- DROP NOT NULL sur priorite
   ALTER TABLE public.tickets 
     ALTER COLUMN priorite DROP NOT NULL;
   
   -- DROP NOT NULL sur plafond_intervention_chf
   ALTER TABLE public.tickets 
     ALTER COLUMN plafond_intervention_chf DROP NOT NULL;
   
   -- Commentaire explicatif
   COMMENT ON COLUMN public.tickets.priorite IS 
     'Priorité du ticket (basse, normale, haute, urgente). NULL si non défini par la régie. Défini par la régie lors de la validation du ticket.';
   
   COMMENT ON COLUMN public.tickets.plafond_intervention_chf IS 
     'Plafond d''intervention en CHF autorisé sans validation. NULL si non défini. Défini par la régie.';
   
   COMMIT;
   ```

4. **Exécuter la requête**
   - Cliquer "Run" (Ctrl+Enter)
   - Attendre confirmation "Success"

5. **Vérifier l'application**
   ```sql
   -- Vérifier que les colonnes acceptent NULL
   SELECT 
     column_name, 
     is_nullable
   FROM information_schema.columns
   WHERE table_name = 'tickets'
     AND column_name IN ('priorite', 'plafond_intervention_chf');
   ```
   
   **Résultat attendu** :
   ```
   column_name                  | is_nullable
   ----------------------------+-------------
   priorite                    | YES
   plafond_intervention_chf    | YES
   ```

---

### Option 2 : Via CLI Supabase (si installé localement)

```bash
cd /workspaces/JETC_IMMO_SaaS
supabase db push --include-all
```

---

## ✅ VALIDATION POST-MIGRATION

### Test 1 : Création ticket locataire sans priorité

1. Se connecter en tant que locataire
2. Menu → "Créer un ticket"
3. Remplir :
   - Catégorie : "Plomberie"
   - Sous-catégorie : "Fuite d'eau"
   - Pièce : "Salle de bain"
   - Description : "Test migration M15"
   - 1 créneau de disponibilité
4. Soumettre

**Résultat attendu** :
- ✅ Ticket créé avec succès
- ✅ Pas d'erreur "null value in column priorite"
- ✅ `priorite` = NULL
- ✅ `plafond_intervention_chf` = NULL

### Test 2 : Vérifier en base

```sql
-- Voir les derniers tickets créés
SELECT 
  id,
  titre,
  statut,
  priorite,
  plafond_intervention_chf,
  created_at
FROM public.tickets
ORDER BY created_at DESC
LIMIT 5;
```

**Colonnes `priorite` et `plafond_intervention_chf` peuvent être NULL** ✅

---

## 🔄 ROLLBACK (si nécessaire)

**Fichier** : `supabase/migrations/20251226180000_m15_allow_null_priorite_plafond_rollback.sql`

⚠️ **Attention** : Ce rollback :
1. Met `priorite = 'normale'` pour tous les tickets avec NULL
2. Met `plafond_intervention_chf = 0` pour tous les tickets avec NULL
3. Rétablit les contraintes NOT NULL

**Exécuter seulement si vous voulez annuler la migration** :

```sql
BEGIN;

UPDATE public.tickets SET priorite = 'normale' WHERE priorite IS NULL;
ALTER TABLE public.tickets ALTER COLUMN priorite SET NOT NULL;

UPDATE public.tickets SET plafond_intervention_chf = 0 WHERE plafond_intervention_chf IS NULL;
ALTER TABLE public.tickets ALTER COLUMN plafond_intervention_chf SET NOT NULL;

COMMIT;
```

---

## 📊 IMPACT

**Tables modifiées** : `public.tickets`

**Colonnes modifiées** :
- `priorite` : NOT NULL → **NULL autorisé**
- `plafond_intervention_chf` : NOT NULL → **NULL autorisé**

**Compatibilité** :
- ✅ Code frontend locataire : OK (ne passe plus priorité/plafond)
- ✅ API `/api/tickets/create.js` : OK (accepte NULL depuis commit bde1940)
- ✅ Dashboard régie : OK (peut définir priorité/plafond lors de validation)
- ✅ Tickets existants : Non impactés

**Aucune perte de données** ✅

---

## 🎯 APRÈS MIGRATION

**Workflow complet** :

1. **Locataire crée ticket** :
   - Sans priorité (NULL)
   - Sans plafond (NULL)
   - Statut = 'nouveau'

2. **Régie valide ticket** :
   - Définit `priorite` (basse, normale, haute, urgente)
   - Définit `plafond_intervention_chf` (optionnel)
   - Change statut → 'ouvert'

3. **Régie diffuse ticket** :
   - Mode diffusion (public/assigné)
   - Change statut → 'en_attente'

4. **Entreprise accepte ticket** :
   - RPC `accept_ticket_and_create_mission`
   - Crée mission
   - Change statut → 'en_cours'

---

**Migration M15 prête à être appliquée !** 🚀
