# 🐛 BUGFIX - "Profil régie introuvable" affiché à tort

**Date** : 24 décembre 2025  
**Gravité** : 🔴 Bloquant  
**Statut** : ✅ Corrigé

---

## 📋 Problème

### Symptômes
- Message bloquant : **"Profil régie introuvable"**
- Apparaît pour un compte régie **valide et connecté**
- Se produit quand :
  - ✅ Session valide
  - ✅ Menu régie affiché
  - ✅ Profil régie existe en BDD
  - ❌ MAIS aucun immeuble/logement créé (état initial normal)

### Impact utilisateur
- Impossibilité d'accéder aux pages Immeubles / Logements
- Blocage à la création du premier immeuble
- Confusion : message d'erreur pour un état **NORMAL**

---

## 🔍 Cause racine

### Logique défectueuse

```javascript
// ❌ AVANT (immeubles.html, logements.html)
const { data: regie, error: regieError } = await supabase
  .from('regies')
  .select('id, nom_agence')
  .eq('profile_id', session.user.id)
  .single();  // ⚠️ Lance une erreur si aucune ligne

if (regieError || !regie) {
  alert('Profil régie introuvable');  // ❌ Confusion entre erreur DB et absence de données
  window.location.href = '/login.html';
  return;
}
```

### Problème technique
- `.single()` retourne une **erreur** si aucune ligne n'existe
- La condition `regieError || !regie` confond :
  - ❌ **Erreur DB** (problème technique réel)
  - ✅ **Pas de résultat** (peut être normal)

---

## ✅ Solution appliquée

### 1. Utiliser `.maybeSingle()` au lieu de `.single()`

```javascript
// ✅ APRÈS
const { data: regie, error: regieError } = await supabase
  .from('regies')
  .select('id, nom_agence')
  .eq('profile_id', session.user.id)
  .maybeSingle();  // ✅ Accepte l'absence de résultat
```

### 2. Distinguer clairement les deux cas

```javascript
// ✅ Cas 1 : Erreur DB (problème technique)
if (regieError) {
  console.error('Erreur DB lors récupération régie:', regieError);
  alert('Erreur technique lors de la récupération du profil régie');
  window.location.href = '/login.html';
  return;
}

// ✅ Cas 2 : Profil réellement introuvable (rare, nécessite action admin)
if (!regie) {
  console.error('Profil régie non trouvé pour profile_id:', session.user.id);
  alert('Profil régie introuvable. Veuillez contacter un administrateur.');
  window.location.href = '/login.html';
  return;
}

// ✅ Cas 3 : Profil trouvé, continuer normalement
// → Si aucun immeuble/logement : afficher empty state (géré par displayImmeubles/displayLogements)
```

---

## 📁 Fichiers corrigés

| Fichier | Ligne | Correction |
|---------|-------|------------|
| [immeubles.html](../public/regie/immeubles.html) | 658 | `.single()` → `.maybeSingle()` + séparation erreurs |
| [logements.html](../public/regie/logements.html) | 765 | `.single()` → `.maybeSingle()` + séparation erreurs |
| [dashboard.html](../public/regie/dashboard.html) | 395 | `.single()` → `.maybeSingle()` + séparation erreurs |

---

## 🎯 Résultat attendu

### ✅ Comportement correct

| Scénario | Avant (bug) | Après (corrigé) |
|----------|-------------|-----------------|
| **Régie valide SANS immeubles** | ❌ Erreur bloquante | ✅ Empty state "Aucun immeuble" + bouton création |
| **Régie valide AVEC immeubles** | ✅ Fonctionne | ✅ Fonctionne (inchangé) |
| **Profil régie manquant (rare)** | ❌ Erreur confuse | ✅ Message clair "Contacter admin" |
| **Erreur DB technique** | ❌ Erreur confuse | ✅ Message "Erreur technique" |

### UX améliorée

**État vide (immeubles.html)** :
```html
<div id="emptyState">
  🏢
  <h3>Aucun immeuble</h3>
  <p>Commencez par créer votre premier immeuble</p>
</div>
```

**État vide (logements.html)** :
```html
<div id="emptyState">
  🏠
  <h3>Aucun logement</h3>
  <p>Commencez par créer votre premier logement</p>
</div>
```

---

## ✅ Tests de validation

### Scénario 1 : Régie sans immeubles (CAS NORMAL)
1. Se connecter avec un compte régie valide
2. Aller sur `/regie/immeubles.html`
3. ✅ **Résultat attendu** : Empty state "Aucun immeuble" (pas d'erreur)

### Scénario 2 : Régie sans logements (CAS NORMAL)
1. Se connecter avec un compte régie valide
2. Aller sur `/regie/logements.html`
3. ✅ **Résultat attendu** : Empty state "Aucun logement" (pas d'erreur)

### Scénario 3 : Profil régie réellement manquant (CAS ANORMAL)
1. Créer un utilisateur avec role='regie' MAIS sans ligne dans table `regies`
2. Se connecter avec ce compte
3. ✅ **Résultat attendu** : Message clair "Profil régie introuvable. Contactez admin"

---

## 📊 Impact métier

| Avant | Après |
|-------|-------|
| ❌ Blocage à la première utilisation | ✅ Expérience fluide |
| ❌ Support sollicité inutilement | ✅ Autonomie de l'utilisateur |
| ❌ Confusion erreur / état vide | ✅ Messages clairs et contextuels |

---

## 🔄 Pattern appliqué

### Principe général

Toujours distinguer :
1. **Erreur technique** (DB, réseau, permissions) → Alerter utilisateur + logs
2. **Absence de données** (résultat vide) → Empty state si normal, erreur si anormal
3. **Données présentes** → Affichage normal

### Règle Supabase

```javascript
// ✅ Utiliser .maybeSingle() quand l'absence de résultat est possible
.maybeSingle()  // Retourne null si aucun résultat, pas d'erreur

// ❌ Éviter .single() sauf si une ligne DOIT exister
.single()  // Lance une erreur si 0 ou >1 résultat
```

---

## 🛡️ Prévention future

### Checklist code review

- [ ] Utiliser `.maybeSingle()` par défaut
- [ ] Séparer `if (error)` de `if (!data)`
- [ ] Distinguer erreur technique / absence de données
- [ ] Prévoir empty state pour états normaux
- [ ] Messages utilisateur contextuels (pas de "erreur" pour état normal)

---

**✅ Correctif validé**  
**📅 Déployable immédiatement**
