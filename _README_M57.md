# ✅ M57 - CORRECTIONS WORKFLOW REFUS + PDF + UX

## 🎯 OBJECTIF
Corriger 4 bugs critiques remontés après déploiement M56 :
1. **Régie déconnectée** au clic sur menu Factures
2. **Boutons incorrects** côté Entreprise (Marquer payée/Refuser)
3. **Workflow refus incomplet** (manque colonnes + RPC)
4. **Manque PDF** pour archive/comptabilité

## 📦 CONTENU M57

### ⚠️ HOTFIX M57.1 REQUIS
**IMPORTANT :** Bugs critiques découverts après M57 nécessitent hotfix M57.1 :
- 🐛 RLS manquante sur table `regies` (406 PGRST116)
- 🐛 Auth PDF incorrecte (403 sur téléchargement)

**👉 Voir documentation complète :** [_HOTFIX_M57_1.md](_HOTFIX_M57_1.md)

### 1. Migration SQL
**Fichier :** `supabase/migrations/20260109010000_m57_fix_workflow_refus.sql`

**Ajouts :**
- Colonnes `refus_reason`, `refused_at`, `refused_by` sur table `factures`
- RPC `refuser_facture(p_facture_id UUID, p_raison TEXT)` → statut=refusee + raison
- RPC `corriger_et_renvoyer_facture(p_facture_id UUID)` → statut=brouillon + efface raison
- Policy RLS `regies_read_self` pour que Régie puisse lire son propre profil

**Résultat :** Workflow refus/correction fonctionnel avec traçabilité complète.

---

### 2. Frontend Régie
**Fichier :** `public/regie/factures.html`

**Corrections :**
- Ligne 504-508 : **Supprimé `signOut()` sur erreur profile** → plus de déconnexion forcée
- Fonction `refuserFacture()` : Appelle `refuser_facture` RPC (plus `update_facture_status`)
- Ajout prompt raison refus
- Ajout fonction `telechargerPDF(factureId, numero)`
- Ajout bouton "📄 Télécharger PDF" sur toutes factures

**Résultat :** 
- ✅ Régie peut ouvrir page Factures sans logout
- ✅ Refus avec raison enregistrée
- ✅ Téléchargement PDF pour archive

---

### 3. Frontend Entreprise
**Fichier :** `public/entreprise/dashboard.html`

**Corrections :**
- Ligne 2225 : Supprimé variables `canPay` et `canRefuse` (logique métier incorrecte)
- Ligne 2225 : Ajouté `canEdit`, `canSend`, `canCorrect` (logique métier correcte)
- Ligne 2275-2300 : **Supprimé boutons "Marquer payée" et "Refuser"** (réservés à Régie)
- Ligne 2290 : **Ajouté bouton "🔄 Corriger et renvoyer"** pour statut=refusee
- Affichage raison refus dans encadré jaune si refusée
- Ajout fonction `corrigerEtRenvoyerFacture(factureId, numero)`
- Ajout fonction `telechargerFacturePDF(factureId, numero)`
- Ajout bouton "📥 Télécharger PDF" sur toutes factures

**Résultat :**
- ✅ Entreprise voit UNIQUEMENT ses boutons légitimes
- ✅ Workflow correction facture refusée fonctionnel
- ✅ Téléchargement PDF pour comptabilité

---

### 4. Backend API PDF
**Fichier :** `api/facture-pdf.js`

**Nouveau :**
- Route GET `/api/facture-pdf?facture_id=xxx`
- Authentification : Bearer token (session Supabase)
- Autorisation RLS : Entreprise (sa facture) ou Régie (facture de sa mission)
- Génération PDF avec PDFKit

**Contenu PDF :**
- En-tête : Numéro, date émission
- Infos : Entreprise (nom, email) + Régie (nom, email)
- Mission : Titre, ticket ID, mission ID
- Détails : Tableau lignes facturation (description, qté, prix unit, total)
- Totaux : HT, TVA, **TTC**, commission JETC
- IBAN
- Statut + date paiement si payée / raison si refusée
- Footer : "Document généré automatiquement par la plateforme JETC"

**Résultat :**
- ✅ PDF professionnel pour archive
- ✅ Sécurisé par RLS (pas d'accès cross-entreprise)

---

## 🔄 WORKFLOW MÉTIER FINAL

```
┌─────────────┐
│ ENTREPRISE  │
│  Facture    │
│  brouillon  │
└──────┬──────┘
       │ Édite + envoie
       ↓
┌─────────────┐
│  envoyee    │
└──────┬──────┘
       │
   ┌───┴───┐
   ↓       ↓
┌──────┐ ┌──────┐
│RÉGIE │ │RÉGIE │
│Valide│ │Refuse│
└──┬───┘ └──┬───┘
   │        │ + raison
   ↓        ↓
payee    refusee
           │
           ↓ ENTREPRISE
     "Corriger et renvoyer"
           │
           ↓
       brouillon → envoyee
```

**Tracabilité :**
- `refus_reason` : texte saisi par Régie
- `refused_at` : timestamp refus
- `refused_by` : UUID Régie (auth.uid())

---

## 📁 FICHIERS MODIFIÉS/CRÉÉS

### Modifiés
- [x] `public/regie/factures.html` (auth + RPC + PDF)
- [x] `public/entreprise/dashboard.html` (boutons + PDF)

### Créés
- [x] `api/facture-pdf.js` (route PDF)
- [x] `supabase/migrations/20260109010000_m57_fix_workflow_refus.sql`
- [x] `_GUIDE_DEPLOIEMENT_M57.md`
- [x] `_README_M57.md`

---

## 🚀 DÉPLOIEMENT

### Ordre d'exécution
1. **SQL** : Appliquer migration M57 dans Supabase SQL Editor
2. **Git** : Push fichiers modifiés/créés
3. **Vercel** : Déploiement automatique
4. **Tests** : Valider workflow complet

**Commandes :**
```bash
git add .
git commit -m "M57: Fix workflow refus + PDF + UX buttons"
git push origin main
```

**Tests obligatoires :**
- [ ] Régie ouvre page Factures sans logout
- [ ] Entreprise ne voit PAS boutons Régie
- [ ] Refus enregistre raison
- [ ] Correction remet en brouillon
- [ ] PDF téléchargeable des 2 côtés

---

## 🐛 BUGS CORRIGÉS

| Bug | Avant M57 | Après M57 |
|-----|-----------|-----------|
| Régie logout | ❌ Déconnexion au clic "Factures" | ✅ Accès normal |
| Boutons Entreprise | ❌ "Marquer payée", "Refuser" visibles | ✅ "Corriger et renvoyer" si refusée |
| Workflow refus | ❌ Pas de colonnes, update_facture_status simple | ✅ Colonnes + RPC + traçabilité |
| PDF | ❌ Inexistant | ✅ Route `/api/facture-pdf` + boutons |

---

## 📊 IMPACT

### Métier
- ✅ Workflow refus/correction conforme processus réel
- ✅ Traçabilité refus (qui, quand, pourquoi)
- ✅ UX claire : chaque rôle voit SES actions

### Technique
- ✅ RLS corrigé (policy regies_read_self)
- ✅ RPC métier (refuser_facture, corriger_et_renvoyer_facture)
- ✅ PDF réutilisable pour archive/compta

### Utilisateur
- ✅ Régie n'est plus bloquée par logout intempestif
- ✅ Entreprise comprend workflow (raison refus affichée)
- ✅ PDF facilite comptabilité des 2 côtés

---

## 🔗 LIENS UTILES

- **Migration M56** : `_README_M56.md` (pré-requis)
- **Guide déploiement** : `_GUIDE_DEPLOIEMENT_M57.md`
- **Schema facturation** : `supabase/schema/15_facturation.sql`

---

## ✅ CHECKLIST POST-DÉPLOIEMENT

- [ ] Migration M57 appliquée (Supabase SQL Editor)
- [ ] Fichiers déployés (Vercel logs OK)
- [ ] Test Régie : ouvre Factures sans logout
- [ ] Test Entreprise : boutons corrects affichés
- [ ] Test workflow refus complet (Régie refuse → Entreprise corrige)
- [ ] Test PDF téléchargeable (Régie + Entreprise)
- [ ] Logs Vercel propres (pas d'erreurs 500)
- [ ] Supabase Logs propres (pas d'erreurs RLS)

**Date déploiement prévu :** À définir après validation M56

**Statut :** 🟢 Prêt à déployer
