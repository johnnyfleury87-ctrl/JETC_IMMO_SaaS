# 🧪 TESTS DASHBOARD LOCATAIRE

**Date** : 24 décembre 2025  
**Fichier** : `public/locataire/dashboard.html`  
**Objectif** : Valider l'affichage des informations locataire en lecture seule

---

## 🎯 PARTIE 1 : AUTHENTIFICATION ET ACCÈS

### ✅ Test 1.1 : Accès autorisé (locataire avec logement)

**Contexte** :
- Utilisateur avec rôle = "locataire"
- Locataire lié à un logement (logement_id NOT NULL)

**Actions** :
1. Se connecter avec un compte locataire
2. URL : `/locataire/dashboard.html`

**Résultat attendu** :
- ✅ Redirection automatique vers le dashboard
- ✅ Sidebar affichée avec email correct
- ✅ Dashboard visible avec les 3 blocs d'informations
- ✅ Console affiche : `[DASHBOARD LOCATAIRE] ✅ Dashboard affiché`

---

### ❌ Test 1.2 : Accès refusé (rôle incorrect)

**Contexte** :
- Utilisateur avec rôle = "regie" ou "admin"

**Actions** :
1. Se connecter avec un compte non-locataire
2. Tenter d'accéder à `/locataire/dashboard.html`

**Résultat attendu** :
- ❌ Alert: "Accès réservé aux locataires"
- ❌ Redirection vers `/login.html`
- ✅ Console affiche : `[DASHBOARD LOCATAIRE] Accès refusé`

---

### ❌ Test 1.3 : Accès refusé (non authentifié)

**Contexte** :
- Aucune session active

**Actions** :
1. Effacer les cookies/localStorage
2. Accéder directement à `/locataire/dashboard.html`

**Résultat attendu** :
- ❌ Redirection immédiate vers `/login.html`
- ✅ Console affiche : `[DASHBOARD LOCATAIRE] Non authentifié`

---

## 🎯 PARTIE 2 : BLOC "MON LOGEMENT"

### ✅ Test 2.1 : Logement en appartement (immeuble)

**Contexte** :
- Logement lié à un immeuble (immeuble_id NOT NULL)
- Données complètes : type, numéro, adresse, étage, superficie, pièces

**Actions** :
1. Se connecter en tant que locataire
2. Observer le bloc "🏠 Mon logement"

**Résultat attendu** :
- ✅ Type: "Studio", "T2", etc. (selon BDD)
- ✅ Référence: Numéro du logement
- ✅ Adresse: `[adresse], [NPA] [ville], Suisse`
- ✅ Immeuble: `[Nom immeuble] ([Ville])`
- ✅ Étage: "Rez-de-chaussée" (si 0) ou "Étage X"
- ✅ Superficie: "XX m²"
- ✅ Nombre de pièces: "X pièce(s)"

---

### ✅ Test 2.2 : Maison individuelle (sans immeuble)

**Contexte** :
- Logement SANS immeuble (immeuble_id = NULL)

**Actions** :
1. Se connecter avec un locataire de maison
2. Observer le champ "Immeuble"

**Résultat attendu** :
- ✅ Badge bleu : "🏡 Maison individuelle"
- ✅ Étage: "N/A" (ou valeur si renseignée)

---

### ✅ Test 2.3 : Données incomplètes

**Contexte** :
- Logement avec superficie = NULL, nombre_pieces = NULL

**Actions** :
1. Se connecter
2. Observer les champs vides

**Résultat attendu** :
- ✅ Superficie: "N/A"
- ✅ Nombre de pièces: "N/A"
- ✅ Pas de crash, interface stable

---

## 🎯 PARTIE 3 : BLOC "MON AGENCE"

### ✅ Test 3.1 : Affichage régie

**Contexte** :
- Logement lié à une régie

**Actions** :
1. Se connecter
2. Observer le bloc "🏢 Mon agence"

**Résultat attendu** :
- ✅ Nom de l'agence: Nom complet de la régie
- ✅ Ville: Ville de la régie

---

### ⚠️ Test 3.2 : Régie incomplète

**Contexte** :
- Régie avec ville = NULL

**Actions** :
1. Se connecter
2. Observer le champ ville

**Résultat attendu** :
- ✅ Ville: "N/A"
- ✅ Pas de crash

---

## 🎯 PARTIE 4 : BLOC "INFORMATIONS FINANCIÈRES"

### ✅ Test 4.1 : Informations financières complètes

**Contexte** :
- Logement avec loyer, charges, dépôt renseignés

**Actions** :
1. Se connecter
2. Observer le bloc "💰 Mes informations financières"

**Résultat attendu** :
- ✅ Loyer mensuel: "CHF XXX.XX"
- ✅ Charges mensuelles: "CHF XXX.XX"
- ✅ Dépôt de garantie: "CHF XXX.XX"
- ✅ Statut du logement: Badge "Occupé" (vert)
- ✅ Prochain paiement: "1er [mois suivant] [année]"
  - Exemple si aujourd'hui = 24 décembre 2025 → "1er janvier 2026"

---

### ⚠️ Test 4.2 : Informations financières manquantes

**Contexte** :
- Logement avec loyer_mensuel = NULL

**Actions** :
1. Se connecter
2. Observer les champs

**Résultat attendu** :
- ✅ Loyer mensuel: "Non renseigné"
- ✅ Charges: "Non renseigné"
- ✅ Dépôt: "Non renseigné"

---

### ✅ Test 4.3 : Badges statut

**Contexte** :
- Logement avec statut = "occupé"

**Actions** :
1. Vérifier le badge statut

**Résultat attendu** :
- ✅ Badge vert : "Occupé"

**Variantes** :
- statut = "vacant" → Badge jaune : "Vacant"
- statut = "en_travaux" → Badge bleu : "En travaux"

---

### ✅ Test 4.4 : Calcul prochain paiement

**Actions** :
1. Se connecter n'importe quel jour du mois
2. Observer "Prochain paiement"

**Résultat attendu** :
- ✅ Affiche toujours le 1er du mois suivant
- ✅ Format français : "1er janvier 2026"

**Exemples** :
- Connexion le 15 décembre 2025 → "1er janvier 2026"
- Connexion le 31 décembre 2025 → "1er janvier 2026"
- Connexion le 1er janvier 2026 → "1er février 2026"

---

## 🎯 PARTIE 5 : CAS PARTICULIER - LOCATAIRE SANS LOGEMENT

### ⚠️ Test 5.1 : Locataire sans logement attribué

**Contexte** :
- Locataire avec logement_id = NULL

**Actions** :
1. Se connecter avec un locataire non attribué
2. Accéder au dashboard

**Résultat attendu** :
- ⚠️ Message affiché : 
  ```
  ⚠️ Logement non attribué
  Votre logement n'est pas encore attribué par la régie. 
  Veuillez contacter votre agence pour plus d'informations.
  ```
- ✅ Dashboard principal (3 blocs) MASQUÉ
- ✅ Console affiche : `[DASHBOARD LOCATAIRE] Pas de logement attribué`

---

## 🎯 PARTIE 6 : SÉCURITÉ RLS

### ✅ Test 6.1 : Isolation des données

**Contexte** :
- 2 locataires A et B
- Chacun avec un logement différent

**Actions** :
1. Se connecter en tant que Locataire A
2. Observer les données affichées
3. Se déconnecter
4. Se connecter en tant que Locataire B
5. Observer les données affichées

**Résultat attendu** :
- ✅ Locataire A voit UNIQUEMENT ses données
- ✅ Locataire B voit UNIQUEMENT ses données
- ❌ Aucune fuite de données entre locataires
- ✅ Console confirme les profile_id distincts

---

### ✅ Test 6.2 : Requête SQL avec RLS

**Vérification backend** :
```sql
SELECT 
  l.nom,
  l.prenom,
  l.logement_id,
  log.numero,
  log.adresse
FROM locataires l
LEFT JOIN logements log ON log.id = l.logement_id
WHERE l.profile_id = '<profile_id_du_locataire>';
```

**Résultat attendu** :
- ✅ Retourne 1 seule ligne (le locataire connecté)
- ✅ Pas d'accès aux données des autres locataires

---

## 🎯 PARTIE 7 : INTERFACE ET UX

### ✅ Test 7.1 : Responsive design

**Actions** :
1. Se connecter
2. Redimensionner la fenêtre (desktop → mobile)

**Résultat attendu** :
- ✅ Desktop : Sidebar visible + dashboard en 2 colonnes
- ✅ Mobile : Sidebar masquée + dashboard en 1 colonne
- ✅ Pas de déformation des cartes

---

### ✅ Test 7.2 : Navigation sidebar

**Actions** :
1. Cliquer sur "Dashboard" (menu actif)

**Résultat attendu** :
- ✅ Lien "Dashboard" : classe `active` (fond bleu)
- ⚠️ Autres liens ("Tickets", "Messagerie") : désactivés (opacity 0.5)

---

### ✅ Test 7.3 : Déconnexion

**Actions** :
1. Cliquer sur "Déconnexion"

**Résultat attendu** :
- ✅ Session Supabase supprimée
- ✅ localStorage nettoyé
- ✅ Redirection vers `/index.html`
- ✅ Console affiche : `[DASHBOARD LOCATAIRE] Déconnexion réussie`

---

## 🎯 PARTIE 8 : MESSAGES D'INFORMATION

### ✅ Test 8.1 : Message "Fonctionnalités à venir"

**Actions** :
1. Observer le dernier bloc du dashboard

**Résultat attendu** :
- ✅ Liste affichée :
  - 🎫 Tickets d'intervention
  - 💬 Messagerie
  - 💳 Paiement en ligne
- ✅ Aucun lien cliquable (informatif seulement)

---

### ✅ Test 8.2 : Message info paiement

**Actions** :
1. Observer le bloc "💰 Mes informations financières"

**Résultat attendu** :
- ✅ Bandeau bleu affiché :
  ```
  📋 Information : Ces montants sont à titre informatif uniquement. 
  Aucune action de paiement n'est disponible pour le moment.
  ```

---

## 📊 RÉSUMÉ DES TESTS

| Test | Objectif | Statut attendu |
|------|----------|----------------|
| 1.1 | Accès autorisé (locataire) | ✅ Dashboard affiché |
| 1.2 | Accès refusé (rôle incorrect) | ❌ Redirection login |
| 1.3 | Accès refusé (non authentifié) | ❌ Redirection login |
| 2.1 | Logement en appartement | ✅ Toutes infos affichées |
| 2.2 | Maison individuelle | ✅ Badge "Maison individuelle" |
| 2.3 | Données incomplètes | ✅ "N/A" affiché |
| 3.1 | Affichage régie | ✅ Nom + ville |
| 3.2 | Régie incomplète | ✅ "N/A" |
| 4.1 | Infos financières complètes | ✅ CHF XXX.XX |
| 4.2 | Infos financières manquantes | ✅ "Non renseigné" |
| 4.3 | Badges statut | ✅ Couleur adaptée |
| 4.4 | Calcul prochain paiement | ✅ 1er du mois suivant |
| 5.1 | Locataire sans logement | ⚠️ Message + dashboard masqué |
| 6.1 | Isolation des données | ✅ Chaque locataire voit ses données |
| 6.2 | RLS Supabase | ✅ 1 seule ligne retournée |
| 7.1 | Responsive design | ✅ Mobile + desktop OK |
| 7.2 | Navigation sidebar | ✅ Menu actif correct |
| 7.3 | Déconnexion | ✅ Session supprimée |
| 8.1 | Fonctionnalités à venir | ✅ Liste informative |
| 8.2 | Message info paiement | ✅ Bandeau bleu |

---

## 🚀 VÉRIFICATIONS POST-TESTS

### ✅ Checklist finale

- [ ] Aucune erreur JavaScript dans la console
- [ ] Tous les champs affichent des valeurs valides (ou "N/A")
- [ ] Les montants CHF sont formatés correctement (2 décimales)
- [ ] Les badges de statut ont les bonnes couleurs
- [ ] Le calcul du prochain paiement est correct
- [ ] Un locataire ne voit que ses propres données
- [ ] Le message "sans logement" s'affiche correctement
- [ ] La déconnexion fonctionne sans erreur
- [ ] Le design responsive ne déforme pas l'interface
- [ ] Les fonctionnalités futures sont clairement indiquées

---

## 🔧 CORRECTION SI ERREURS

### Si données non affichées :
1. Vérifier `profile_id` dans table `locataires`
2. Vérifier `logement_id` NOT NULL
3. Vérifier jointures `logements → immeubles → regies`
4. Console : `[DASHBOARD LOCATAIRE] Données chargées` doit afficher l'objet complet

### Si erreur RLS :
1. Vérifier RLS activé sur `locataires`
2. Policy : `SELECT locataires WHERE profile_id = auth.uid()`
3. Policy : `SELECT logements` (pas de restriction si foreign key sécurisée)

### Si crash JavaScript :
1. Ouvrir console (F12)
2. Identifier la ligne d'erreur
3. Vérifier que supabaseClient.js est chargé AVANT le script principal
4. Vérifier que les IDs HTML correspondent (`logementType`, `regieNom`, etc.)

---

**Testeur** : ___________________________  
**Date** : ___________________________  
**Résultat** : ___________________________
