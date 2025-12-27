# 🔧 PLAN DE CORRECTIONS SYSTÈME TICKETS

**Date**: 27 décembre 2025  
**Référence**: AUDIT_COMPLET_TICKETS_SYSTEME.md  
**Mode**: Hotfix stable → Pas de refacto global  
**Validation**: Obligatoire à chaque étape

---

## 📋 ÉTAPES DE CORRECTION

### ÉTAPE 0 : Plan et préparation ✅
**Statut** : EN COURS  
**Durée** : 10 min

#### Actions
- [x] Analyser audit complet
- [x] Créer plan structuré
- [x] Préparer structure migrations

---

### ÉTAPE 1 : 🔴 CRITIQUE - Hotfix déconnexion régie
**Problème** : Récursion RLS infinie → déconnexion automatique  
**Priorité** : ABSOLUE  
**Durée estimée** : 30 min  
**Statut** : PRÊT À DÉMARRER

#### 1.1 Migration SQL : M22
**Fichier** : `supabase/migrations/M22_rpc_regie_dashboard_tickets.sql`

```sql
-- M22: RPC dashboard régie (bypass RLS récursion)
-- Date: 2025-12-27
-- Issue: Récursion RLS tickets → regies_entreprises → entreprises
-- Solution: SECURITY DEFINER fonction qui lit tickets directement

CREATE OR REPLACE FUNCTION public.get_tickets_dashboard_regie()
RETURNS TABLE(
  count_nouveau integer,
  count_en_attente integer,
  count_en_cours integer,
  count_termine integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regie_id uuid;
BEGIN
  -- Récupérer regie_id de l'utilisateur courant
  SELECT r.id INTO v_regie_id
  FROM public.regies r
  WHERE r.profile_id = auth.uid();

  IF v_regie_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non associé à une régie';
  END IF;

  -- Compter tickets par statut (DIRECT, sans RLS)
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE statut = 'nouveau')::integer AS count_nouveau,
    COUNT(*) FILTER (WHERE statut = 'en_attente')::integer AS count_en_attente,
    COUNT(*) FILTER (WHERE statut = 'en_cours')::integer AS count_en_cours,
    COUNT(*) FILTER (WHERE statut = 'termine')::integer AS count_termine
  FROM public.tickets
  WHERE regie_id = v_regie_id;
END;
$$;

-- Sécurité : restreindre accès
REVOKE ALL ON FUNCTION public.get_tickets_dashboard_regie() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tickets_dashboard_regie() TO authenticated;

-- Commentaire
COMMENT ON FUNCTION public.get_tickets_dashboard_regie() IS 
'Retourne compteurs tickets pour dashboard régie. SECURITY DEFINER bypass RLS pour éviter récursion.';
```

#### 1.2 Modification Frontend
**Fichier** : `public/regie/dashboard.html`  
**Fonction** : `loadDashboard()` (ligne ~848)

**AVANT** :
```javascript
async function loadDashboard() {
  const { count, error } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('statut', 'nouveau')
    .eq('regie_id', window.currentRegieId);
  
  if (error) {
    console.error('[DASHBOARD] Erreur:', error);
    return;
  }
  
  if (count > 0) {
    // ...
  }
}
```

**APRÈS** :
```javascript
async function loadDashboard() {
  console.log('[REGIE][TICKETS] Chargement dashboard via RPC...');
  
  try {
    // ✅ M22: Utiliser RPC au lieu de SELECT direct (évite récursion RLS)
    const { data, error } = await supabase.rpc('get_tickets_dashboard_regie');
    
    if (error) {
      console.error('[REGIE][TICKETS] Erreur RPC:', error);
      document.getElementById('dashboardLoading').style.display = 'none';
      return;
    }
    
    if (!data || data.length === 0) {
      console.warn('[REGIE][TICKETS] Aucune donnée retournée');
      document.getElementById('dashboardLoading').style.display = 'none';
      document.getElementById('messageAucunTicket').style.display = 'block';
      return;
    }
    
    const counts = data[0];
    console.log('[REGIE][TICKETS] Compteurs reçus:', counts);
    
    document.getElementById('dashboardLoading').style.display = 'none';
    
    if (counts.count_nouveau > 0) {
      document.getElementById('alerteTexte').textContent = 
        `${counts.count_nouveau} ticket${counts.count_nouveau > 1 ? 's' : ''} en attente de validation`;
      document.getElementById('alerteNouveauxTickets').style.display = 'block';
    } else {
      document.getElementById('messageAucunTicket').style.display = 'block';
    }
    
  } catch (error) {
    console.error('[REGIE][TICKETS] Exception:', error);
    document.getElementById('dashboardLoading').style.display = 'none';
  }
}
```

#### 1.3 Validation OBLIGATOIRE

**Test SQL (Supabase SQL Editor)** :
```sql
-- Se connecter avec un utilisateur régie, puis :
SELECT * FROM public.get_tickets_dashboard_regie();

-- Résultat attendu :
-- count_nouveau | count_en_attente | count_en_cours | count_termine
-- --------------|------------------|----------------|---------------
--            2  |        1         |      3         |       5
```

**Test UI** :
1. Login avec utilisateur régie
2. Aller sur dashboard
3. Observer onglet "Tickets" ou zone tickets
4. ✅ **Critère réussite** : AUCUNE déconnexion
5. ✅ **Critère réussite** : Compteurs affichés correctement
6. Vérifier console browser : logs `[REGIE][TICKETS]` présents, pas d'erreur

**Test Logs Supabase** :
```bash
# Vérifier aucune erreur récursion
SELECT * FROM auth.audit_log_entries
WHERE payload::text LIKE '%infinite%recursion%'
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**⛔ BLOQUANT** : On ne passe PAS à l'étape 2 tant que validation non OK.

---

### ÉTAPE 2 : 🔴 HAUTE - Diagnostic + Fix tickets locataire invisibles
**Problème** : Tickets ne s'affichent pas côté locataire  
**Priorité** : HAUTE  
**Durée estimée** : 1h (diagnostic) + 30min (fix si confirmé)  
**Statut** : EN ATTENTE validation ÉTAPE 1

#### 2.1 Instrumentation Frontend (Diagnostic)
**Fichier** : `public/locataire/dashboard.html`  
**Fonction** : `loadMesTickets()` (ligne ~1703)

**Ajout AVANT la query** :
```javascript
async function loadMesTickets() {
  console.log('[LOCATAIRE][TICKETS] Chargement liste...');
  
  const container = document.getElementById('ticketsListContainer');
  container.innerHTML = '<div class="loading-state">Chargement des tickets...</div>';
  
  try {
    // ✅ DIAGNOSTIC : Vérifier auth.uid()
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    console.log('[LOCATAIRE][DEBUG] user.id=', user?.id, 'userErr=', userErr);
    console.log('[LOCATAIRE][DEBUG] window.currentLocataire=', window.currentLocataire);
    
    if (!user?.id) {
      console.error('[LOCATAIRE][DEBUG] ❌ auth.uid() est NULL !');
      container.innerHTML = '<div class="empty-state">Session expirée. Reconnectez-vous.</div>';
      return;
    }
    
    if (!window.currentLocataire?.id) {
      console.error('[LOCATAIRE][DEBUG] ❌ currentLocataire.id manquant !');
      container.innerHTML = '<div class="empty-state">Erreur: locataire non trouvé.</div>';
      return;
    }
    
    // ✅ DIAGNOSTIC : Tester SELECT sans filtre
    const { data: testAll, error: testAllErr } = await supabase
      .from('tickets')
      .select('id, locataire_id, titre, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    console.log('[LOCATAIRE][DEBUG] testAll tickets (sans filtre):', testAll);
    console.log('[LOCATAIRE][DEBUG] testAll error:', testAllErr);
    
    // Query normale (avec filtre)
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('locataire_id', window.currentLocataire.id)
      .order('created_at', { ascending: false });
    
    // ✅ DIAGNOSTIC : Logs query filtrée
    console.log('[LOCATAIRE][DEBUG] filtered tickets:', tickets);
    console.log('[LOCATAIRE][DEBUG] filtered error:', error);
    
    if (error) {
      console.error('[LOCATAIRE][TICKETS] Erreur RLS:', error);
      container.innerHTML = `<div class="empty-state">Erreur: ${error.message}</div>`;
      return;
    }
    
    console.log('[LOCATAIRE][TICKETS] Tickets chargés:', tickets?.length || 0);
    
    allTickets = tickets || [];
    renderTicketsList(allTickets);
    
  } catch (error) {
    console.error('[LOCATAIRE][TICKETS] Exception:', error);
    container.innerHTML = `<div class="empty-state">Erreur: ${error.message}</div>`;
  }
}
```

#### 2.2 Requête SQL Diagnostic
**À exécuter dans Supabase SQL Editor** (connecté avec user locataire) :

```sql
-- DIAGNOSTIC 1 : Vérifier tickets liés au locataire
SELECT 
  t.id,
  t.titre,
  t.locataire_id,
  t.created_at,
  l.profile_id AS locataire_profile_id,
  auth.uid() AS current_user_id,
  (l.profile_id = auth.uid()) AS match_profile
FROM public.tickets t
JOIN public.locataires l ON l.id = t.locataire_id
WHERE l.profile_id = auth.uid()
ORDER BY t.created_at DESC;

-- DIAGNOSTIC 2 : Vérifier policy SELECT sur locataires
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'locataires' AND cmd IN ('SELECT', 'ALL')
ORDER BY policyname;

-- DIAGNOSTIC 3 : Vérifier policy SELECT sur tickets
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'tickets' AND cmd IN ('SELECT', 'ALL')
ORDER BY policyname;
```

#### 2.3 Migration SQL (SI RLS confirmée cause) : M23
**Fichier** : `supabase/migrations/M23_fix_locataire_select_tickets.sql`

```sql
-- M23: Fix policy SELECT tickets locataire
-- Date: 2025-12-27
-- Issue: Policy SELECT trop restrictive ou EXISTS échoue silencieusement
-- Solution: Simplifier avec IN subquery

DROP POLICY IF EXISTS "Locataire can view own tickets" ON public.tickets;

CREATE POLICY "Locataire can view own tickets"
ON public.tickets
FOR SELECT
USING (
  locataire_id IN (
    SELECT id 
    FROM public.locataires
    WHERE profile_id = auth.uid()
  )
);

-- Commentaire
COMMENT ON POLICY "Locataire can view own tickets" ON public.tickets IS 
'Locataire voit uniquement ses propres tickets via IN subquery (plus robuste que EXISTS)';
```

#### 2.4 Validation OBLIGATOIRE

**Test SQL** :
```sql
-- Résultat attendu : tickets du locataire connecté
SELECT id, titre, locataire_id, created_at
FROM public.tickets
WHERE locataire_id IN (
  SELECT id FROM public.locataires WHERE profile_id = auth.uid()
)
ORDER BY created_at DESC;
```

**Test UI** :
1. Login locataire
2. Aller sur onglet "Mes tickets"
3. ✅ **Critère réussite** : Tickets visibles (liste non vide si tickets existent)
4. ✅ **Critère réussite** : Pas d'erreur RLS dans console
5. Vérifier logs `[LOCATAIRE][DEBUG]` : user.id présent, filtered tickets non vide

**⛔ BLOQUANT** : On ne passe PAS à l'étape 3 tant que validation non OK.

---

### ÉTAPE 3 : 🟡 MOYENNE - Sécurisation entreprise (préventif)
**Problème** : Risque latent récursion RLS sur vue tickets_visibles_entreprise  
**Priorité** : MOYENNE (préventif)  
**Durée estimée** : 1h  
**Statut** : EN ATTENTE validation ÉTAPE 2

#### 3.1 Migration SQL : M24
**Fichier** : `supabase/migrations/M24_rpc_entreprise_tickets_disponibles.sql`

```sql
-- M24: RPC tickets disponibles entreprise (bypass RLS récursion préventif)
-- Date: 2025-12-27
-- Issue: Vue tickets_visibles_entreprise JOIN regies_entreprises risque récursion
-- Solution: SECURITY DEFINER fonction lecture directe

CREATE OR REPLACE FUNCTION public.get_tickets_disponibles_entreprise()
RETURNS TABLE(
  id uuid,
  titre text,
  description text,
  categorie text,
  sous_categorie text,
  piece text,
  statut ticket_status,
  priorite text,
  regie_id uuid,
  logement_id uuid,
  date_creation timestamptz,
  mode_diffusion text,
  locked_at timestamptz,
  plafond_intervention_chf numeric,
  devise text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entreprise_id uuid;
BEGIN
  -- Récupérer entreprise_id de l'utilisateur courant
  SELECT e.id INTO v_entreprise_id
  FROM public.entreprises e
  WHERE e.profile_id = auth.uid();

  IF v_entreprise_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non associé à une entreprise';
  END IF;

  -- Retourner tickets visibles selon mode_diffusion
  RETURN QUERY
  SELECT 
    t.id,
    t.titre,
    t.description,
    t.categorie,
    t.sous_categorie,
    t.piece,
    t.statut,
    t.priorite,
    t.regie_id,
    t.logement_id,
    t.date_creation,
    t.mode_diffusion,
    t.locked_at,
    t.plafond_intervention_chf,
    t.devise
  FROM public.tickets t
  WHERE EXISTS (
    SELECT 1 
    FROM public.regies_entreprises re
    WHERE re.regie_id = t.regie_id
      AND re.entreprise_id = v_entreprise_id
      AND (
        -- Mode GENERAL (public, ouvert, non verrouillé)
        (
          re.mode_diffusion = 'general'
          AND t.statut = 'en_attente'
          AND t.locked_at IS NULL
        )
        OR
        -- Mode RESTREINT (assigné à cette entreprise)
        (
          re.mode_diffusion = 'restreint'
          AND t.entreprise_id = v_entreprise_id
          AND t.statut IN ('en_attente', 'en_cours', 'termine')
        )
      )
  )
  OR
  -- Tickets déjà acceptés par cette entreprise
  (
    t.entreprise_id = v_entreprise_id
    AND t.statut IN ('en_cours', 'termine', 'clos')
  )
  ORDER BY t.date_creation DESC;
END;
$$;

-- Sécurité : restreindre accès
REVOKE ALL ON FUNCTION public.get_tickets_disponibles_entreprise() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tickets_disponibles_entreprise() TO authenticated;

-- Commentaire
COMMENT ON FUNCTION public.get_tickets_disponibles_entreprise() IS 
'Retourne tickets disponibles/acceptés pour entreprise. SECURITY DEFINER évite récursion RLS.';
```

#### 3.2 Modification Frontend
**Fichier** : `public/entreprise/dashboard.html`  
**Fonction** : À identifier (recherche loadTicketsDisponibles ou similaire)

**AVANT** :
```javascript
const { data: tickets, error } = await supabase
  .from('tickets_visibles_entreprise')
  .select('*')
  .eq('visible_par_entreprise_id', window.currentEntreprise.id);
```

**APRÈS** :
```javascript
console.log('[ENTREPRISE][TICKETS] Chargement via RPC...');

// ✅ M24: Utiliser RPC au lieu de VIEW (évite récursion RLS latente)
const { data: tickets, error } = await supabase.rpc('get_tickets_disponibles_entreprise');

console.log('[ENTREPRISE][TICKETS] Tickets reçus:', tickets?.length || 0);
```

#### 3.3 Validation OBLIGATOIRE

**Test SQL** :
```sql
-- Connecté avec user entreprise
SELECT * FROM public.get_tickets_disponibles_entreprise();

-- Résultat attendu : liste tickets disponibles pour cette entreprise
```

**Test UI** :
1. Login entreprise
2. Aller sur "Tickets disponibles"
3. ✅ **Critère réussite** : Tickets visibles
4. ✅ **Critère réussite** : Accepter un ticket fonctionne (RPC existante)
5. ✅ **Critère réussite** : Pas d'erreur récursion dans logs Supabase

**⛔ BLOQUANT** : On ne passe PAS à l'étape 4 tant que validation non OK.

---

### ÉTAPE 4 : 📄 Rapport final
**Durée estimée** : 20 min  
**Statut** : EN ATTENTE validation ÉTAPE 3

Générer `AUDIT_FIX_REPORT.md` avec :
- Résumé des 3 migrations (M22, M23, M24)
- Changements frontend (3 dashboards)
- Résultats validations
- Risques restants
- Recommandations refacto future (Option 2 table cache)

---

## 📊 TABLEAU DE BORD

| Étape | Migration | Fichiers modifiés | Statut | Durée |
|-------|-----------|-------------------|--------|-------|
| 0     | -         | Plan              | ✅ EN COURS | 10min |
| 1     | M22       | regie/dashboard.html | ⏳ PRÊT | 30min |
| 2     | M23 (si RLS) | locataire/dashboard.html | ⏳ ATTENTE | 1h30 |
| 3     | M24       | entreprise/dashboard.html | ⏳ ATTENTE | 1h |
| 4     | -         | AUDIT_FIX_REPORT.md | ⏳ ATTENTE | 20min |

**Durée totale estimée** : 3h30 (si tout nominal)

---

## ⚠️ RÈGLES STRICTES

### ✅ AUTORISÉ
- Créer fonctions RPC SECURITY DEFINER
- Modifier dashboards HTML (3 fichiers max)
- Ajouter logs console
- Créer migrations M22-M24
- Simplifier policies SELECT existantes

### ❌ INTERDIT
- Modifier triggers existants
- Refacto global policies
- Changer schéma table tickets
- Modifier flow création tickets (M20-M21 OK)
- Toucher à plus de 3 dashboards

---

## 🎯 CRITÈRES DE SUCCÈS GLOBAUX

- [ ] Régie : 0 déconnexion sur onglet Tickets
- [ ] Locataire : tickets visibles (ou diagnostic prouvant blocage)
- [ ] Entreprise : tickets disponibles via RPC stable
- [ ] Rapport AUDIT_FIX_REPORT.md complet
- [ ] 0 erreur "infinite recursion" dans logs Supabase
- [ ] Performance queries < 500ms

---

**Plan créé le** : 27 décembre 2025  
**Prêt à exécution** : OUI ✅  
**Prochaine action** : Démarrer ÉTAPE 1 (M22 + frontend régie)
