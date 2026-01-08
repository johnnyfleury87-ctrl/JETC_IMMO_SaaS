# 🎯 SOLUTION IMMÉDIATE - ÉDITION FACTURES

## LE PROBLÈME IDENTIFIÉ

Votre facture **FAC-2026-0002** est **incomplète**:
- ❌ Montant HT: NULL
- ❌ Montant TTC: NULL  
- ❌ IBAN: NULL

C'est normal si elle a été générée automatiquement sans montant.

## LA SOLUTION

### 1️⃣ RAFRAÎCHIR LA PAGE (IMPORTANT)

Le code a été mis à jour. Vous devez vider le cache:

**Windows/Linux:**
```
Ctrl + Shift + R
```

**Mac:**
```
Cmd + Shift + R
```

### 2️⃣ OÙ TROUVER LES BOUTONS

Deux endroits possibles:

#### A. Dans la modal "Détails de la mission"
- Cliquer sur une mission terminée
- Section "💳 Facture"
- Vous devriez voir: **✏️ Éditer la facture**

#### B. Dans l'onglet "Factures"
- Menu gauche → "Factures"
- Chaque facture brouillon a: **✏️ Éditer**

### 3️⃣ WORKFLOW COMPLET

```
1. Cliquer "✏️ Éditer la facture"
   ↓
2. Formulaire se pré-remplit (ou est vide si aucun montant)
   ↓
3. Remplir:
   - Montant HT: ex: 150
   - IBAN: ex: CH93 0076 2011 6238 5295 7
   - Description (optionnel)
   ↓
4. Cliquer "Mettre à jour"
   ↓
5. ✅ Facture mise à jour avec calcul auto (TVA 20%, Commission 10%)
   ↓
6. Maintenant le bouton "📤 Envoyer à la régie" apparaît
   ↓
7. Cliquer "📤 Envoyer à la régie"
   ↓
8. ✅ Statut passe à "Envoyée" (plus éditable)
```

## SI VOUS NE VOYEZ TOUJOURS PAS LES BOUTONS

### Vérification 1: Code déployé ?
```bash
cd /workspaces/JETC_IMMO_SaaS
git status
# Vérifier que public/entreprise/dashboard.html a été modifié
```

### Vérification 2: Forcer le déploiement
```bash
cd /workspaces/JETC_IMMO_SaaS
git add public/entreprise/dashboard.html
git commit -m "fix: Ajout boutons éditer/envoyer dans modal mission"
git push
```

Attendre 2-3 minutes que Vercel redéploie, puis:
1. Vider le cache (Ctrl+Shift+R)
2. Recharger la page
3. Se reconnecter

### Vérification 3: Console navigateur
Ouvrir la console (F12):
- Onglet "Console"
- Vérifier qu'il n'y a pas d'erreurs JavaScript en rouge

## TEST RAPIDE

Pour tester avec la facture qui a déjà un montant (FAC-2026-0001):

1. Se connecter entreprise
2. Aller dans "Mes missions"
3. Chercher la mission avec FAC-2026-0001
4. Ouvrir les détails
5. Dans la section Facture:
   - ✅ Montant TTC: CHF 120.00
   - ✅ IBAN: CH93...
   - ✅ Statut: Brouillon
   - ✅ **Bouton "✏️ Éditer la facture"** devrait être visible
   - ✅ **Bouton "📤 Envoyer à la régie"** devrait être visible

## EN CAS DE PROBLÈME PERSISTANT

Testez en local:
```bash
cd /workspaces/JETC_IMMO_SaaS
npm run dev
# Ouvrir http://localhost:3000
# Se connecter entreprise
```

Si ça marche en local mais pas en prod:
→ Le déploiement Vercel n'a pas pris le nouveau code
→ Forcer un nouveau déploiement

---

## 📸 CE QUE VOUS DEVRIEZ VOIR

### AVANT (ce que vous voyez actuellement):
```
💳 Facture
Numéro: FAC-2026-0002
Montant TTC: N/A
Statut: brouillon

[Fermer]
```

### APRÈS (après rafraîchissement):
```
💳 Facture
Numéro: FAC-2026-0002
Montant TTC: Non renseigné
Statut: brouillon

[✏️ Éditer la facture]

[Fermer]
```

### APRÈS ÉDITION:
```
💳 Facture
Numéro: FAC-2026-0002
Montant TTC: CHF 180.00
Statut: brouillon

[✏️ Éditer la facture] [📤 Envoyer à la régie]

[Fermer]
```

---

**Si après rafraîchissement vous ne voyez toujours pas les boutons, faites-moi un screenshot de la console (F12) et de la modal de mission.**
