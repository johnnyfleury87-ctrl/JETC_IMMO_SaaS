# Checklist Tests Responsive & Accessibilité - JETC_IMMO

**Date**: 19 décembre 2025  
**Version**: 2.0.0  
**Intervenant**: GitHub Copilot

---

## 📱 TESTS RESPONSIVE

### Breakpoints à tester

| Device | Résolution | Sidebar | Grid | Tests |
|--------|-----------|---------|------|-------|
| **Mobile S** | 320px | Cachée + burger | 1 col | [ ] |
| **Mobile M** | 375px | Cachée + burger | 1 col | [ ] |
| **Mobile L** | 414px | Cachée + burger | 1 col | [ ] |
| **Tablet** | 768px | 240px visible | 2 col | [ ] |
| **Tablet L** | 1024px | 280px visible | 3 col | [ ] |
| **Desktop** | 1366px | 280px visible | 4 col | [ ] |
| **Desktop L** | 1920px | 280px visible | 4 col | [ ] |

---

### 1. Landing Page (index.html)

#### Desktop (1366px+)
- [ ] Hero section avec gradient bleu visible
- [ ] Logo JETC_IMMO 42px visible en header
- [ ] 3 colonnes pricing cards bien alignées
- [ ] Footer avec 4 colonnes
- [ ] Animations scroll fonctionnelles
- [ ] Hover effects sur boutons "Choisir"

#### Tablet (768-1024px)
- [ ] Hero text réduit mais lisible
- [ ] 2 colonnes pricing cards
- [ ] Footer en 2 colonnes
- [ ] Animations préservées
- [ ] Touch-friendly buttons (min 44x44px)

#### Mobile (<768px)
- [ ] Hero section single column
- [ ] Logo 32px adapté
- [ ] 1 colonne pricing cards stacked
- [ ] Footer single column
- [ ] Pas de scroll horizontal
- [ ] Textes lisibles (16px min)
- [ ] Language switcher accessible

---

### 2. Dashboards (admin, regie, entreprise, technicien, locataire, proprietaire)

#### Desktop (1366px+)
- [ ] Sidebar 280px fixe à gauche
- [ ] Main content avec margin-left: 280px
- [ ] Stats cards en grid 3-4 colonnes
- [ ] Tables lisibles
- [ ] Logo 42px dans sidebar
- [ ] Avatar utilisateur visible

#### Tablet (768-1024px)
- [ ] Sidebar 240px
- [ ] Main content ajusté
- [ ] Stats cards en 2 colonnes
- [ ] Tables scrollables horizontalement si nécessaire
- [ ] Tout reste accessible

#### Mobile (<768px)
- [ ] Sidebar cachée (transform: translateX(-100%))
- [ ] **Burger button visible** en haut à gauche
- [ ] Burger button 44x44px (touch-friendly)
- [ ] Click burger → sidebar slide-in depuis la gauche
- [ ] Overlay semi-transparent apparaît
- [ ] Click overlay → sidebar se ferme
- [ ] Touche Escape → sidebar se ferme
- [ ] Click menu item → navigation + fermeture sidebar
- [ ] Main content pleine largeur (margin-left: 0)
- [ ] Stats cards en 1 colonne stacked
- [ ] Forms adaptés (input 100% width)
- [ ] Boutons pleine largeur
- [ ] Pas de scroll horizontal

---

### 3. Formulaires (register.html, login.html, install-admin.html)

#### Desktop
- [ ] Form centré max-width 500px
- [ ] Logo 48px visible
- [ ] Labels et inputs bien espacés
- [ ] Bouton submit full-width
- [ ] Messages d'erreur visibles

#### Mobile
- [ ] Form width 100% avec padding
- [ ] Logo 36px adapté
- [ ] Inputs touch-friendly (min 44px height)
- [ ] Keyboard navigation fluide
- [ ] Submit button accessible au pouce
- [ ] Pas de zoom intempestif sur focus input

---

## ♿ TESTS ACCESSIBILITÉ WCAG AA

### Contraste Couleurs (4.5:1 minimum)

| Élément | Couleur texte | Couleur fond | Ratio | Test |
|---------|---------------|--------------|-------|------|
| Body text | --gray-900 #0f172a | --white #ffffff | 15.6:1 | [ ] ✅ |
| Primary button | --white | --primary-blue #2563eb | 8.6:1 | [ ] ✅ |
| Menu item | --gray-700 | --white | 10.4:1 | [ ] ✅ |
| Menu active | --primary-blue | --blue-50 | 7.2:1 | [ ] ✅ |
| Links | --primary-blue | --white | 8.6:1 | [ ] ✅ |
| Secondary text | --gray-600 | --white | 7.8:1 | [ ] ✅ |

**Outil** : https://webaim.org/resources/contrastchecker/

---

### Navigation Clavier

#### Tab Navigation
- [ ] Tab traverse tous les éléments interactifs
- [ ] Ordre logique (haut → bas, gauche → droite)
- [ ] Focus indicator visible (outline ou box-shadow)
- [ ] Skip to main content link (optionnel)

#### Burger Menu Mobile
- [ ] Tab atteint le burger button
- [ ] Enter/Space ouvre la sidebar
- [ ] Tab dans sidebar ouverte parcourt les menu items
- [ ] Escape ferme la sidebar
- [ ] Focus retourne au burger button après fermeture

#### Formulaires
- [ ] Tab entre inputs dans l'ordre logique
- [ ] Labels associés aux inputs (for="id")
- [ ] Messages d'erreur annoncés (aria-describedby)
- [ ] Submit avec Enter dans le dernier champ

---

### ARIA Attributes

#### Burger Button
```html
<button class="burger-btn" 
        aria-label="Toggle menu" 
        aria-expanded="false"
        aria-controls="sidebar">
```
- [ ] aria-label descriptif
- [ ] aria-expanded change dynamiquement (false/true)
- [ ] aria-controls référence la sidebar

#### Sidebar
```html
<aside class="sidebar" 
       id="sidebar" 
       role="navigation"
       aria-label="Main navigation">
```
- [ ] role="navigation"
- [ ] aria-label décrit la fonction

#### Overlay
```html
<div class="sidebar-overlay" 
     aria-hidden="true">
```
- [ ] aria-hidden="true" (décoratif)

#### Menu Items
```html
<a href="#" 
   class="menu-item active" 
   aria-current="page">
   Dashboard
</a>
```
- [ ] aria-current="page" sur item actif

---

### Lecteur d'Écran (Screen Reader)

#### Test avec NVDA (Windows) ou VoiceOver (Mac)
- [ ] Logo annoncé comme "JETC_IMMO Logo"
- [ ] Burger button annoncé "Toggle menu button"
- [ ] Menu items annoncés avec texte
- [ ] État expanded/collapsed annoncé
- [ ] Forms labels correctement annoncés
- [ ] Messages d'erreur lus automatiquement
- [ ] Boutons submit annoncés

#### Navigation landmarks
- [ ] `<nav>` pour menus
- [ ] `<main>` pour contenu principal
- [ ] `<aside>` pour sidebar
- [ ] `<header>` pour en-têtes
- [ ] `<footer>` pour pieds de page

---

## 🌐 CROSS-BROWSER TESTING

### Desktop

#### Chrome (latest)
- [ ] Design system CSS chargé
- [ ] Animations CSS smooth
- [ ] Gradients bleus visibles
- [ ] Sidebar fixe fonctionne
- [ ] Supabase auth fonctionne

#### Firefox (latest)
- [ ] Mêmes tests que Chrome
- [ ] CSS Grid compatible
- [ ] Flexbox compatible
- [ ] Variables CSS appliquées

#### Safari (macOS latest)
- [ ] Webkit prefixes si nécessaire
- [ ] Gradients compatibles
- [ ] Animations fluides
- [ ] Position: fixed sidebar OK

#### Edge (latest - Chromium)
- [ ] Comportement identique à Chrome
- [ ] Pas de problèmes spécifiques

---

### Mobile

#### Chrome Mobile (Android)
- [ ] Burger menu fonctionne
- [ ] Touch events réactifs
- [ ] Pas de zoom intempestif
- [ ] Sidebar slide-in smooth

#### Safari Mobile (iOS)
- [ ] Position: fixed sidebar OK
- [ ] Touch events fonctionnels
- [ ] Pas de bounce effect gênant
- [ ] Viewport meta tag correct

#### Firefox Mobile
- [ ] Tests identiques Chrome Mobile
- [ ] Compatibilité CSS vérifiée

---

## 🔧 OUTILS DE TEST

### Responsive Design
```bash
# Chrome DevTools
F12 → Toggle Device Toolbar (Ctrl+Shift+M)
# Tester tous les presets + custom widths
```

### Accessibilité
- **axe DevTools** : https://www.deque.com/axe/devtools/
- **WAVE** : https://wave.webaim.org/
- **Lighthouse** : Chrome DevTools → Lighthouse → Accessibility

### Contrast Checker
- https://webaim.org/resources/contrastchecker/
- https://coolors.co/contrast-checker

### Screen Readers
- **Windows** : NVDA (gratuit) https://www.nvaccess.org/download/
- **macOS** : VoiceOver (intégré, Cmd+F5)
- **Linux** : Orca

---

## 📋 CHECKLIST RAPIDE

### Avant déploiement
- [ ] Tous les dashboards testés sur mobile 375px
- [ ] Burger menu fonctionne sur les 6 dashboards
- [ ] Overlay ferme correctement la sidebar
- [ ] Escape key ferme la sidebar
- [ ] Tab navigation fluide
- [ ] Contraste texte/fond ≥ 4.5:1
- [ ] aria-labels sur burger button
- [ ] Logo visible sur toutes résolutions
- [ ] Pas de scroll horizontal sur mobile
- [ ] Forms utilisables au doigt (touch-friendly)

### Tests critiques mobile
```
Device : iPhone SE (375x667)
- [ ] index.html charge en <3s
- [ ] Burger menu s'ouvre au tap
- [ ] register.html keyboard accessible
- [ ] login.html formulaire soumis OK
- [ ] admin/dashboard.html stats visibles
```

### Tests critiques desktop
```
Device : 1366x768 (laptop standard)
- [ ] Sidebar visible sans scroll
- [ ] Main content pas coupé
- [ ] Toutes les cartes visibles
- [ ] Hover effects fonctionnent
```

---

## 🚀 COMMANDES UTILES

### Serveur local pour tests
```bash
# Depuis /workspaces/JETC_IMMO_SaaS
npm run dev
# Ouvrir http://localhost:3000
```

### Tests responsive automatisés (optionnel)
```bash
npm install -g puppeteer
# Créer script test-responsive.js
```

### Lighthouse CLI
```bash
npm install -g lighthouse
lighthouse http://localhost:3000 --view
# Score accessibilité doit être >90
```

---

## ✅ CRITÈRES DE SUCCÈS

| Critère | Objectif | Status |
|---------|----------|--------|
| **Responsive** | Aucun scroll horizontal mobile | [ ] |
| **Burger menu** | Fonctionne sur 6 dashboards | [ ] |
| **Contraste** | Tous éléments ≥ 4.5:1 | [ ] |
| **Keyboard** | Navigation complète au clavier | [ ] |
| **Screen reader** | Contenu compréhensible | [ ] |
| **Cross-browser** | Chrome, Firefox, Safari OK | [ ] |
| **Performance** | Lighthouse score >90 | [ ] |

---

**Document créé le** : 19 décembre 2025  
**À compléter par** : L'équipe QA ou le développeur  
**Durée estimée** : 3-4h de tests complets
