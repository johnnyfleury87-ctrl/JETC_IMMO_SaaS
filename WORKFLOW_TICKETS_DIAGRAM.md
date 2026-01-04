# 🔄 WORKFLOW TICKETS: Vue d'ensemble M26-M35

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         WORKFLOW COMPLET TICKETS                          │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────┐
│  LOCATAIRE  │  Connecté (auth.uid)
└──────┬──────┘
       │
       │ 1. CRÉATION TICKET
       │    RPC: create_ticket_locataire()
       │    Params: titre, description, categorie, etc.
       │
       ▼
┌─────────────────────────────┐
│  📝 TICKET CRÉÉ             │
│  Statut: nouveau            │
│  locataire_id: ✅           │
│  logement_id: ✅            │
│  regie_id: ✅               │
│  entreprise_id: NULL        │
│  mode_diffusion: NULL       │
│  plafond_*: NULL            │
└──────────────┬──────────────┘
               │
               │ RLS Policy: "Regie can view own tickets"
               ▼
┌──────────────────────────────┐
│  RÉGIE                       │  Connecté (auth.uid)
│  Dashboard: tickets.html     │
└──────────────┬───────────────┘
               │
               │ 2. VALIDATION TICKET
               │    Interface: Modal validation
               │    Champs:
               │    - Priorité (basse/normale/haute/urgente)
               │    - Plafond CHF (obligatoire, > 0)
               │    - Mode diffusion:
               │      • GENERAL: Toutes entreprises autorisées
               │      • RESTREINT: Une entreprise spécifique
               │    - ID Entreprise (si restreint)
               │
               │    Action: onclick="confirmValidation()"
               │    ↓
               │    RPC: valider_ticket_regie()
               │    Params:
               │      p_ticket_id: uuid
               │      p_plafond_chf: numeric
               │      p_mode_diffusion: 'general' | 'restreint'
               │      p_entreprise_id: uuid | null
               │
               ▼
┌───────────────────────────────────────────────────────┐
│  🔄 UPDATE ATOMIQUE (RPC M32)                         │
│  ────────────────────────────────────────────────     │
│  SET:                                                  │
│    statut = 'en_attente'                              │
│    mode_diffusion = p_mode_diffusion                  │
│    entreprise_id = CASE mode restreint THEN uuid END  │
│    plafond_intervention_chf = p_plafond_chf           │
│    plafond_valide_par = auth.uid()  ◀── M31          │
│    plafond_valide_at = NOW()        ◀── M31          │
│    diffuse_par = auth.uid()         ◀── M31          │
│    diffuse_at = NOW()               ◀── M31          │
│    updated_at = NOW()                                 │
└───────────────────────────────────────────────────────┘
               │
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
   MODE GENERAL   MODE RESTREINT
        │             │
        │             │
        ▼             ▼
┌───────────────┐  ┌────────────────────────┐
│ 📢 MARKETPLACE│  │ 🎯 ASSIGNATION DIRECTE │
│               │  │                        │
│ Visible par:  │  │ Visible par:           │
│ - TOUTES      │  │ - SEULE entreprise     │
│   entreprises │  │   assignée             │
│   autorisées  │  │   (entreprise_id)      │
│   (RLS)       │  │   (RLS)                │
│               │  │                        │
│ Policy M34:   │  │ Policy M34:            │
│ "...general   │  │ "...assigned           │
│  tickets"     │  │  tickets"              │
└───────┬───────┘  └──────┬─────────────────┘
        │                 │
        ▼                 ▼
   ┌─────────────────────────────┐
   │  ENTREPRISE(S)              │  Connecté (auth.uid)
   │  Dashboard entreprise       │
   └─────────────┬───────────────┘
                 │
                 │ 3. VOIR TICKETS DISPONIBLES
                 │    SELECT tickets
                 │    WHERE ... (filtré par policies RLS M34-M35)
                 │
                 ▼
   ┌─────────────────────────────────────────────┐
   │  📋 LISTE TICKETS VISIBLES                  │
   │  ──────────────────────────────────────     │
   │  Mode GENERAL:                              │
   │    ✅ Voir titre, description, plafond      │
   │    ✅ Voir lieu (immeuble/logement)         │
   │    ❌ PAS voir données sensibles locataire  │
   │                                             │
   │  Mode RESTREINT:                            │
   │    ✅ Voir informations complètes           │
   │    ✅ Accès aux détails locataire (si RLS)  │
   └─────────────────────────────────────────────┘
                 │
                 │ 4. ACCEPTER MISSION
                 │    (workflow futur M36+)
                 │
                 ▼
   ┌─────────────────────────────┐
   │  🔧 MISSION EN COURS        │
   │  (hors scope M31-M35)       │
   └─────────────────────────────┘
```

---

## 🔑 Légende états tickets

| Statut | Signification | Acteurs |
|--------|---------------|---------|
| `nouveau` | Ticket créé par locataire, pas encore validé | Locataire (créé), Régie (voit) |
| `en_attente` | Validé régie, diffusé aux entreprises | Régie (a validé), Entreprise(s) (voient) |
| `en_cours` | Entreprise a accepté, mission en cours | Régie, Entreprise assignée, Technicien |
| `termine` | Travaux terminés, validation en attente | Régie, Entreprise |
| `clos` | Ticket clôturé définitivement | Régie (archive) |

---

## 🔒 Sécurité RLS (Row Level Security)

### Régie
```sql
-- Policy: "Regie can view own tickets"
WHERE EXISTS (
  SELECT 1 FROM regies r
  WHERE r.id = tickets.regie_id
    AND r.profile_id = auth.uid()
)
```

### Entreprise - Mode GENERAL (M34-M35)
```sql
-- Policy: "Entreprise can view general tickets"
WHERE mode_diffusion = 'general'
  AND statut = 'en_attente'
  AND locked_at IS NULL
  AND EXISTS (
    SELECT 1 FROM regies_entreprises re
    JOIN entreprises e ON e.id = re.entreprise_id
    WHERE re.regie_id = tickets.regie_id
      AND e.profile_id = auth.uid()
  )
```

### Entreprise - Mode RESTREINT (M34-M35)
```sql
-- Policy: "Entreprise can view assigned tickets"
WHERE mode_diffusion = 'restreint'
  AND entreprise_id = (
    SELECT id FROM entreprises 
    WHERE profile_id = auth.uid()
  )
  AND statut IN ('en_attente', 'en_cours', 'termine')
```

---

## 📊 Colonnes traçabilité (M31)

| Colonne | Remplie par | Quand | Valeur |
|---------|-------------|-------|--------|
| `plafond_valide_par` | RPC M32 | Validation régie | auth.uid() (profile_id régie) |
| `plafond_valide_at` | RPC M32 | Validation régie | NOW() |
| `diffuse_par` | RPC M32 | Validation régie | auth.uid() (profile_id régie) |
| `diffuse_at` | RPC M32 | Validation régie | NOW() |

**Usage**: Audit, reporting, conformité RGPD.

---

## 🚀 Différence avant/après M31-M35

### ❌ AVANT (problématique)

```javascript
// Frontend: 2 appels RPC séparés
await supabase.rpc('update_ticket_regie', {...});
await supabase.rpc('update_ticket_statut', {...});

// Terminologie incohérente
mode_diffusion: 'public' | 'assigné'  // Dans code
WHERE mode_diffusion = 'general'       // Dans policies RLS → AUCUN MATCH !

// Pas de traçabilité
// Qui a validé ? Quand ? Impossible à savoir
```

### ✅ APRÈS (solution M31-M35)

```javascript
// Frontend: 1 seul appel RPC
const { data } = await supabase.rpc('valider_ticket_regie', {
  p_ticket_id: uuid,
  p_plafond_chf: 500.00,
  p_mode_diffusion: 'general',  // ✅ Harmonisé
  p_entreprise_id: null
});

// Terminologie cohérente partout
mode_diffusion: 'general' | 'restreint'  // Code + DB + Policies

// Traçabilité complète
SELECT 
  plafond_valide_par,  -- UUID profile régie
  plafond_valide_at,   -- Timestamp
  diffuse_par,
  diffuse_at
FROM tickets
WHERE id = '...';
```

---

## 📚 Documentation

- **Guide déploiement**: `GUIDE_DEPLOIEMENT_M31_M35.md`
- **Rapport complet**: `RAPPORT_CORRECTION_WORKFLOW_TICKETS.md`
- **Récap rapide**: `RECAP_RAPIDE_M31_M35.md`
- **Migrations**: `supabase/migrations/README_M31_M35.md`

---

**Auteur**: GitHub Copilot  
**Date**: 2026-01-04  
**Version**: 1.0
