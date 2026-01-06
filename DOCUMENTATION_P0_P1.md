# Documentation P0 + P1 - Nouvelles Fonctionnalités

**Date:** 2025-01-06  
**Version:** 1.0  
**Statut:** ✅ Implémenté et prêt pour déploiement

---

## 📋 Résumé des Implémentations

### P0 : Facturation Mensuelle JETC (Priorité critique)

**Objectif:** Permettre à l'admin JETC de générer des factures mensuelles par régie pour facturer les commissions.

**Fichiers créés/modifiés:**
1. [supabase/migrations/20260106000100_m44_factures_mensuelles_jetc.sql](supabase/migrations/20260106000100_m44_factures_mensuelles_jetc.sql)
2. [api/admin/factures-mensuelles.js](api/admin/factures-mensuelles.js)
3. [api/admin/factures-mensuelles-pdf.js](api/admin/factures-mensuelles-pdf.js)
4. [public/admin/facturation-mensuelle.html](public/admin/facturation-mensuelle.html)

### P1 : Amélioration UX Régie (Priorité haute)

**Objectif:** Améliorer l'expérience utilisateur régie lors de la validation/diffusion des tickets.

**Fichiers modifiés:**
1. [public/regie/tickets.html](public/regie/tickets.html) - Modal de validation enrichi

---

## 🎯 P0 : Facturation Mensuelle JETC

### Architecture

```
┌──────────────────────────────────────────────────┐
│  Vue SQL: admin_factures_mensuelles_regies       │
│  - Agrège factures par régie + mois              │
│  - Calcule: nb missions, total HT, commission    │
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│  API: /api/admin/factures-mensuelles             │
│  - Filtre par année/mois                         │
│  - Retourne JSON: lignes + totaux                │
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│  Frontend: facturation-mensuelle.html            │
│  - Tableau interactif                            │
│  - Filtres année/mois                            │
│  - Statistiques visuelles                        │
│  - Bouton export PDF                             │
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│  API: /api/admin/factures-mensuelles-pdf         │
│  - Génère PDF avec PDFKit                        │
│  - Mise en page professionnelle                  │
│  - Download automatique                          │
└──────────────────────────────────────────────────┘
```

### Migration M44 : Vue SQL

**Fichier:** `supabase/migrations/20260106000100_m44_factures_mensuelles_jetc.sql`

**Contenu:**
- Vue `admin_factures_mensuelles_regies` qui agrège les factures payées
- Colonnes retournées :
  - `regie_id`, `regie_nom`
  - `periode` (format YYYY-MM), `annee`, `mois`
  - `nombre_factures`, `nombre_missions`
  - `total_ht`, `total_commission_jetc`
  - `date_paiement_min`, `date_paiement_max`

**Sécurité:**
- RLS activé (security_invoker = true)
- Policy : accessible uniquement par `admin_jtec`
- Index de performance sur `date_paiement` et `(regie_id, date_paiement, statut)`

**Application:**

Méthode manuelle recommandée :
1. Ouvrir SQL Editor Supabase : https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/editor
2. Copier-coller le contenu de la migration
3. Exécuter

### API GET /api/admin/factures-mensuelles

**Accès:** Réservé aux `admin_jtec` (vérification token + rôle)

**Query Parameters:**
- `annee` (optionnel) : Filtre par année (ex: `2025`)
- `mois` (optionnel) : Filtre par mois (ex: `12`)

**Réponse JSON:**
```json
{
  "lignes": [
    {
      "regie_id": "uuid",
      "regie_nom": "Régie XYZ",
      "periode": "2025-12",
      "annee": 2025,
      "mois": 12,
      "nombre_factures": 15,
      "nombre_missions": 15,
      "total_ht": 4500.00,
      "total_commission_jetc": 450.00,
      "date_paiement_min": "2025-12-05T10:00:00Z",
      "date_paiement_max": "2025-12-28T15:30:00Z"
    }
  ],
  "totaux": {
    "nombre_missions": 45,
    "total_ht": 12500.00,
    "total_commission_jetc": 1250.00
  },
  "filtres": {
    "annee": 2025,
    "mois": 12
  },
  "metadata": {
    "count": 3,
    "timestamp": "2025-01-06T10:00:00Z"
  }
}
```

**Codes d'erreur:**
- `401` : Non authentifié
- `403` : Accès refusé (pas admin_jtec)
- `500` : Erreur serveur

### Frontend : facturation-mensuelle.html

**Accès:** https://votredomaine.com/admin/facturation-mensuelle.html

**Fonctionnalités:**

1. **Statistiques globales (cartes colorées):**
   - Nombre total de missions
   - Total HT agrégé
   - Commission JETC totale

2. **Filtres:**
   - Année (liste déroulante, 5 dernières années)
   - Mois (liste déroulante)
   - Bouton "Réinitialiser"

3. **Tableau détaillé:**
   - Colonnes : Période, Régie, Nb Factures, Nb Missions, Total HT, Commission JETC
   - Footer avec totaux
   - Design responsive

4. **Export PDF:**
   - Bouton "📄 Export PDF"
   - Génère PDF du tableau avec filtres appliqués
   - Download automatique

**Design:**
- Design system cohérent avec le reste de l'application
- Gradient colorés pour les cartes stats
- Hover effects sur les lignes du tableau
- Empty state si aucune donnée

### API GET /api/admin/factures-mensuelles-pdf

**Accès:** Réservé aux `admin_jtec`

**Query Parameters:**
- Identiques à l'API JSON (annee, mois)

**Réponse:**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="facturation-jetc-{annee}-{mois}.pdf"`

**Contenu du PDF (A4, paysage):**
1. En-tête : Logo JETC, titre, période, date génération
2. Statistiques globales (3 boîtes colorées)
3. Tableau détaillé avec alternance de couleurs
4. Footer avec totaux en gras
5. Copyright JETC en bas de page

**Dépendances:**
- `pdfkit` : Génération PDF (installé via `npm install pdfkit`)

---

## 🎨 P1 : Amélioration UX Régie

### Modal de Validation/Diffusion Amélioré

**Fichier modifié:** [public/regie/tickets.html](public/regie/tickets.html)

**Problème identifié:**
- Locataire peut créer ticket avec `sous_categorie` ou `piece` incorrectes
- Régie doit pouvoir corriger avant diffusion aux entreprises

**Solution implémentée:**

#### 1. Ajout de champs de correction dans le modal

Avant diffusion, le modal affiche maintenant :

```
┌─────────────────────────────────────────────────┐
│  ✅ Valider et diffuser le ticket                │
│  Vérifier/corriger les informations avant        │
│  diffusion                                        │
├─────────────────────────────────────────────────┤
│  [Sous-catégorie *] ▼                            │
│    - Fuite                                       │
│    - Robinet                                     │
│    - Chasse d'eau                                │
│    ...                                           │
│  ℹ️ Corrigez si nécessaire                       │
├─────────────────────────────────────────────────┤
│  [Pièce concernée *] ▼                           │
│    - Cuisine                                     │
│    - Salon                                       │
│    - Chambre                                     │
│    ...                                           │
│  ℹ️ Corrigez si nécessaire                       │
├─────────────────────────────────────────────────┤
│  [Priorité *] ▼                                  │
│  [Plafond CHF *] [____]                          │
│  ℹ️ Montant maximum autorisé                     │
├─────────────────────────────────────────────────┤
│  [Mode diffusion] ▼                              │
│    - Général (toutes entreprises)               │
│    - Restreint (une entreprise)                 │
├─────────────────────────────────────────────────┤
│  [Annuler]  [✅ Valider et diffuser]             │
└─────────────────────────────────────────────────┘
```

#### 2. Pré-remplissage automatique

**Fonction:** `openValidationModal(ticketId)`

Avant affichage, le modal charge le ticket depuis Supabase et pré-remplit :
- `sous_categorie` (valeur actuelle)
- `piece` (valeur actuelle)
- `priorite` (valeur actuelle ou 'normale')
- `plafond_ht` (valeur actuelle si définie)

```javascript
const { data: ticket } = await supabaseClient
  .from('tickets')
  .select('sous_categorie, piece, priorite, plafond_ht')
  .eq('id', ticketId)
  .single();

document.getElementById('validation-sous-categorie').value = ticket.sous_categorie || '';
document.getElementById('validation-piece').value = ticket.piece || '';
// ...
```

#### 3. Validation client-side stricte

**Fonction:** `confirmValidation()`

Avant envoi, validation obligatoire de :
- ✅ `sous_categorie` : ne doit pas être vide
- ✅ `piece` : ne doit pas être vide
- ✅ `priorite` : sélectionné
- ✅ `plafond_ht` : > 0
- ✅ `entreprise_id` : obligatoire si mode "restreint"

Messages d'erreur avec `.focus()` sur le champ concerné.

#### 4. Mise à jour avant diffusion

Si la régie a corrigé des valeurs, un `UPDATE` est effectué **AVANT** l'appel RPC `valider_ticket_regie` :

```javascript
await supabaseClient
  .from('tickets')
  .update({
    sous_categorie: sousCategorie,
    piece: piece,
    priorite: priorite,
    plafond_ht: plafond
  })
  .eq('id', currentTicketIdForValidation);
```

Ensuite seulement, appel à `valider_ticket_regie()` pour changer le statut.

#### 5. Options de sous-catégories par catégorie

Dropdowns organisés par `<optgroup>` :

- **Plomberie** : fuite, robinet, chasse_eau, sanitaire
- **Électricité** : panne, interrupteur, prise, lumiere
- **Chauffage** : radiateur, chaudiere, regulation
- **Serrurerie** : porte, fenetre, serrure
- **Vitrerie** : vitre_cassee, double_vitrage
- **Peinture** : mur, plafond, menuiserie
- **Maçonnerie** : facade, cloison
- **Toiture** : tuile, gouttiere
- **Autre** : autre

#### 6. Options de pièces

Liste exhaustive :
- cuisine, salon, chambre, salle_de_bain, wc
- entree, couloir, cave, garage, balcon
- parties_communes, exterieur, autre

---

## 🚀 Déploiement

### Étapes Recommandées

#### 1. Appliquer la migration M44

**Méthode manuelle (recommandée):**

```bash
# Ouvrir SQL Editor Supabase
https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/editor

# Copier-coller le contenu de:
supabase/migrations/20260106000100_m44_factures_mensuelles_jetc.sql

# Exécuter
```

**Vérification:**
```sql
SELECT * FROM admin_factures_mensuelles_regies LIMIT 5;
```

Si résultat vide : normal si aucune facture payée en base.

#### 2. Déployer les fichiers API

Les fichiers suivants doivent être déployés sur Vercel :

```
api/admin/factures-mensuelles.js
api/admin/factures-mensuelles-pdf.js
```

**Variables d'environnement requises:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

#### 3. Déployer le frontend

Fichiers à déployer :

```
public/admin/facturation-mensuelle.html
public/regie/tickets.html (modifié)
```

**Vérifier que `pdfkit` est installé:**
```bash
npm install pdfkit
```

#### 4. Tester en production

**Test P0 (Facturation):**

1. Se connecter en tant que `admin_jtec`
2. Accéder à `/admin/facturation-mensuelle.html`
3. Vérifier l'affichage du tableau (peut être vide)
4. Tester les filtres année/mois
5. Tester l'export PDF

**Test P1 (UX Régie):**

1. Se connecter en tant que `regie`
2. Accéder à `/regie/tickets.html`
3. Créer un ticket test (ou utiliser existant)
4. Cliquer "✅ Valider" sur un ticket "nouveau"
5. Vérifier que le modal affiche bien :
   - Sous-catégorie (pré-remplie)
   - Pièce (pré-remplie)
   - Priorité
   - Plafond
6. Modifier une valeur
7. Valider et vérifier que le ticket est bien mis à jour

---

## 🧪 Tests Fonctionnels

### Scénario P0.1 : Consultation factures mensuelles

**Acteur:** Admin JETC  
**Pré-requis:** Au moins 1 facture payée en base

**Étapes:**
1. Login admin JETC
2. Naviguer vers `/admin/facturation-mensuelle.html`
3. Vérifier affichage des stats globales
4. Vérifier tableau avec colonnes correctes
5. Vérifier footer avec totaux

**Résultat attendu:**
- ✅ Stats visuelles correctes
- ✅ Tableau affiche toutes les factures payées
- ✅ Totaux cohérents avec somme des lignes

### Scénario P0.2 : Filtrage par période

**Acteur:** Admin JETC

**Étapes:**
1. Sur `/admin/facturation-mensuelle.html`
2. Sélectionner année = 2025
3. Vérifier rechargement automatique
4. Sélectionner mois = 12
5. Vérifier rechargement automatique
6. Cliquer "Réinitialiser"

**Résultat attendu:**
- ✅ Filtrage année : affiche uniquement 2025
- ✅ Filtrage mois : affiche uniquement décembre 2025
- ✅ Réinitialisation : retour à année courante

### Scénario P0.3 : Export PDF

**Acteur:** Admin JETC

**Étapes:**
1. Sur `/admin/facturation-mensuelle.html`
2. Appliquer filtre (ex: année 2025)
3. Cliquer "📄 Export PDF"
4. Attendre download
5. Ouvrir PDF

**Résultat attendu:**
- ✅ Bouton devient "Génération..." pendant traitement
- ✅ PDF téléchargé avec nom `facturation-jetc-2025-tous.pdf`
- ✅ PDF contient : en-tête, stats, tableau, totaux, footer
- ✅ Mise en page professionnelle

### Scénario P1.1 : Correction ticket avant diffusion

**Acteur:** Régie

**Étapes:**
1. Login régie
2. Naviguer vers `/regie/tickets.html`
3. Cliquer "✅ Valider" sur ticket statut "nouveau"
4. Vérifier pré-remplissage modal
5. Modifier `sous_categorie` (ex: fuite → robinet)
6. Modifier `piece` (ex: salon → cuisine)
7. Remplir priorité + plafond
8. Cliquer "✅ Valider et diffuser"

**Résultat attendu:**
- ✅ Modal affiche valeurs actuelles du ticket
- ✅ Modification enregistrée en base
- ✅ Ticket passe en statut "en_attente"
- ✅ Alert confirmation affichée
- ✅ Rechargement automatique listes

### Scénario P1.2 : Validation client-side

**Acteur:** Régie

**Étapes:**
1. Ouvrir modal validation ticket
2. Laisser `sous_categorie` vide
3. Cliquer "✅ Valider et diffuser"

**Résultat attendu:**
- ✅ Alert "❌ La sous-catégorie est obligatoire"
- ✅ Focus sur le champ sous_categorie
- ✅ Modal reste ouverte

**Variante:**
- Idem pour `piece` vide
- Idem pour `plafond` <= 0
- Idem pour `entreprise_id` vide en mode restreint

---

## 📊 Métriques de Succès

### P0 : Facturation Mensuelle

- ✅ Vue SQL retourne données agrégées correctement
- ✅ API JSON retourne résultats en < 500ms
- ✅ Frontend affiche tableau responsive
- ✅ Export PDF génère fichier valide < 5s
- ✅ Accessible uniquement par admin_jtec

### P1 : UX Régie

- ✅ Modal pré-remplit valeurs actuelles
- ✅ Validation client-side bloque soumission si erreur
- ✅ Mise à jour ticket avant diffusion fonctionne
- ✅ Aucune régression sur workflow existant

---

## 🔒 Sécurité

### P0 : Facturation Mensuelle

**Authentification:**
- Token JWT vérifié via `supabaseAdmin.auth.getUser(token)`
- Rôle vérifié : `profile.role === 'admin_jtec'`

**Autorisation:**
- Vue SQL : RLS policy limite accès aux admin_jtec
- API : vérification explicite rôle
- PDF : idem API JSON

**Données sensibles:**
- Montants financiers : visible uniquement admin
- Commissions JETC : calcul côté serveur (pas manipulable client)

### P1 : UX Régie

**Validation:**
- Client-side : champs obligatoires
- Server-side : RLS sur table `tickets` (régie peut update uniquement ses tickets)
- RPC `valider_ticket_regie` : vérifications métier intégrées

**Données:**
- `sous_categorie` et `piece` : valeurs contrôlées par dropdown (pas d'injection)
- `plafond_ht` : validation numérique stricte

---

## 🐛 Troubleshooting

### Problème : Vue vide sur facturation-mensuelle.html

**Cause probable:** Aucune facture avec `statut = 'payee'` et `date_paiement NOT NULL`

**Solution:**
```sql
-- Vérifier factures existantes
SELECT COUNT(*) FROM factures WHERE statut = 'payee' AND date_paiement IS NOT NULL;

-- Si 0, créer données test
UPDATE factures 
SET statut = 'payee', date_paiement = NOW()
WHERE id = 'uuid-test';
```

### Problème : Export PDF échoue

**Cause probable:** Module `pdfkit` non installé

**Solution:**
```bash
npm install pdfkit
```

### Problème : Modal validation ne pré-remplit pas

**Cause probable:** RLS policy bloque lecture ticket

**Solution:**
Vérifier policy RLS sur `tickets` pour role `regie` :
```sql
CREATE POLICY tickets_select_regie ON tickets
FOR SELECT TO authenticated
USING (regie_id = (SELECT regie_id FROM profiles WHERE id = auth.uid()));
```

### Problème : Erreur 403 sur API factures-mensuelles

**Cause probable:** Utilisateur pas `admin_jtec`

**Solution:**
```sql
UPDATE profiles SET role = 'admin_jtec' WHERE email = 'admin@jetc.ch';
```

---

## 📝 Notes de Version

**Version 1.0 - 2025-01-06**

**Ajouts:**
- ✅ P0 : Facturation mensuelle JETC (vue SQL + API + frontend + PDF)
- ✅ P1 : Modal correction régie (sous_categorie + piece)
- ✅ P1 : Validation client-side stricte

**Dépendances:**
- `pdfkit` ^0.15.0 (nouveau)

**Migrations:**
- M44 : `20260106000100_m44_factures_mensuelles_jetc.sql`

**Breaking Changes:**
- Aucun

**Rollback:**
- Exécuter `20260106000100_m44_factures_mensuelles_jetc_rollback.sql` si nécessaire

---

## 🎓 Formation Admin JETC

### Accéder à la facturation mensuelle

1. Se connecter avec compte admin JETC
2. Aller dans le menu Admin
3. Cliquer "Facturation Mensuelle" (ou accéder directement `/admin/facturation-mensuelle.html`)

### Consulter les commissions d'un mois

1. Sélectionner l'année dans le filtre
2. Sélectionner le mois
3. Consulter le tableau

### Générer un PDF pour la comptabilité

1. Appliquer les filtres souhaités (année, mois)
2. Cliquer "📄 Export PDF"
3. Enregistrer le fichier (automatique)
4. Envoyer à la comptabilité

### Comprendre les données

- **Nombre de Missions** : Total de missions facturées et payées
- **Total HT** : Somme des montants HT de toutes les factures
- **Commission JETC** : 10% du total HT (configuré dans table `factures.taux_commission`)

---

## 📞 Support

**En cas de problème:**

1. Vérifier les logs navigateur (F12 → Console)
2. Vérifier les logs serveur Vercel
3. Vérifier les logs Supabase
4. Contacter support technique avec :
   - Capture d'écran de l'erreur
   - Rôle de l'utilisateur
   - Étapes de reproduction

---

**Document maintenu par:** Équipe Technique JETC  
**Dernière mise à jour:** 2025-01-06
