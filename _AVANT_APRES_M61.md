# 📸 Comparaison Avant/Après - Support Multi-pays

## 🖼️ Interface utilisateur

### AVANT (Suisse uniquement)
```
┌─────────────────────────────────────────────┐
│  📍 Localisation                            │
├─────────────────────────────────────────────┤
│                                             │
│  Nom / Référence immeuble *                 │
│  [_____________________________________]    │
│                                             │
│  Adresse *                                  │
│  [_____________________________________]    │
│                                             │
│  ┌─────────────────┬─────────────────────┐ │
│  │ NPA *           │ Ville *             │ │
│  │ [1000_____]     │ [Lausanne_________] │ │
│  │ Format suisse : 4 chiffres            │ │
│  └─────────────────┴─────────────────────┘ │
│                                             │
│  Pays                                       │
│  [ Suisse                    ] 🔒 READONLY │
│                                             │
└─────────────────────────────────────────────┘
```

**Limitations :**
- ❌ Pays bloqué sur "Suisse"
- ❌ NPA forcé à 4 chiffres (HTML pattern + JS validation)
- ❌ Impossible de créer un immeuble français
- ❌ Contrainte DB : `CHECK (npa ~ '^[0-9]{4}$')`

---

### APRÈS (Suisse + France)
```
┌─────────────────────────────────────────────┐
│  📍 Localisation                            │
├─────────────────────────────────────────────┤
│                                             │
│  Nom / Référence immeuble *                 │
│  [_____________________________________]    │
│                                             │
│  Adresse *                                  │
│  [_____________________________________]    │
│                                             │
│  ┌─────────────────┬─────────────────────┐ │
│  │ NPA / Code      │ Ville *             │ │
│  │ postal *        │ [Lausanne_________] │ │
│  │ [1000_____]     │                     │ │
│  │ Format suisse : 4 chiffres            │ │
│  └─────────────────┴─────────────────────┘ │
│                                             │
│  Pays *                                     │
│  [▼ Suisse        ▼] ✅ EDITABLE           │
│     - Suisse                                │
│     - France                                │
│                                             │
└─────────────────────────────────────────────┘
```

**Cas 1 - Suisse sélectionnée (défaut) :**
```
Placeholder : "1000"
Hint        : "Format suisse : 4 chiffres"
MaxLength   : 4
Validation  : /^[0-9]{4}$/
```

**Cas 2 - France sélectionnée :**
```
Placeholder : "75001"  ⬅️ CHANGE DYNAMIQUEMENT
Hint        : "Format français : 5 chiffres"  ⬅️ CHANGE
MaxLength   : 5  ⬅️ CHANGE
Validation  : /^[0-9]{5}$/  ⬅️ CHANGE
```

---

## 🔄 Flux de validation

### AVANT (Logique statique)
```
┌──────────────────┐
│ User saisit NPA  │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────┐
│ Validation HTML          │
│ pattern="[0-9]{4}"       │
│ maxlength="4"            │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Validation JS            │
│ if (!/^[0-9]{4}$/)       │
│   → Erreur               │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Validation DB            │
│ CHECK (npa ~ '^[0-9]{4}$')│
└──────────────────────────┘
```

**Problème** : Impossible de saisir un code postal français (5 chiffres)

---

### APRÈS (Logique conditionnelle)
```
┌──────────────────┐
│ User sélectionne │
│ Pays             │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────┐
│ Event listener           │
│ paysSelect.onChange()    │
└────────┬─────────────────┘
         │
         ├──────────────────┐
         │                  │
         ▼                  ▼
┌────────────────┐  ┌────────────────┐
│ Pays = Suisse  │  │ Pays = France  │
├────────────────┤  ├────────────────┤
│ maxLength = 4  │  │ maxLength = 5  │
│ placeholder    │  │ placeholder    │
│   = "1000"     │  │   = "75001"    │
│ hint = 4 chif. │  │ hint = 5 chif. │
└────────┬───────┘  └────────┬───────┘
         │                   │
         └─────────┬─────────┘
                   │
                   ▼
         ┌──────────────────┐
         │ User saisit NPA  │
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────────────┐
         │ Validation JS            │
         │ if (pays === 'Suisse')   │
         │   → check 4 digits       │
         │ else if (pays === 'FR')  │
         │   → check 5 digits       │
         └────────┬─────────────────┘
                  │
                  ▼
         ┌──────────────────────────┐
         │ Validation DB            │
         │ CHECK (npa ~ '^[0-9]{4,5}$')│
         │ ✅ Accept 4 OR 5 digits  │
         └──────────────────────────┘
```

**Avantages :**
- ✅ Validation stricte selon le pays
- ✅ Impossible de mélanger les formats
- ✅ UX guidée (placeholder + hint adaptatifs)
- ✅ Contrainte DB flexible mais sécurisée

---

## 📊 Exemples de validation

### ✅ CAS VALIDES

| Pays    | NPA saisi | Validation | Résultat |
|---------|-----------|------------|----------|
| Suisse  | `1000`    | 4 chiffres | ✅ OK    |
| Suisse  | `8001`    | 4 chiffres | ✅ OK    |
| France  | `75001`   | 5 chiffres | ✅ OK    |
| France  | `69001`   | 5 chiffres | ✅ OK    |

---

### ❌ CAS INVALIDES

| Pays    | NPA saisi | Validation           | Résultat | Message erreur                                   |
|---------|-----------|----------------------|----------|--------------------------------------------------|
| Suisse  | `75001`   | 5 chiffres ≠ 4       | ❌ Erreur| "Le NPA suisse doit contenir exactement 4 chiffres" |
| France  | `1000`    | 4 chiffres ≠ 5       | ❌ Erreur| "Le code postal français doit contenir exactement 5 chiffres" |
| Suisse  | `10A0`    | Lettres non autorisées| ❌ Erreur| "Le NPA suisse doit contenir exactement 4 chiffres" |
| France  | `7500X`   | Lettres non autorisées| ❌ Erreur| "Le code postal français doit contenir exactement 5 chiffres" |
| Suisse  | `100`     | Trop court           | ❌ Erreur| "Le NPA suisse doit contenir exactement 4 chiffres" |
| France  | `7500`    | Trop court           | ❌ Erreur| "Le code postal français doit contenir exactement 5 chiffres" |

---

## 🗄️ Impact base de données

### AVANT - Contrainte stricte
```sql
-- Table immeubles
ALTER TABLE immeubles
ADD CONSTRAINT check_npa_format 
CHECK (npa ~ '^[0-9]{4}$');
-- ❌ Bloque les codes postaux français

-- Table logements
-- Pas de contrainte (ou similaire si existante)
```

**Problème** : 
```sql
-- ❌ IMPOSSIBLE
INSERT INTO immeubles (npa, pays) 
VALUES ('75001', 'France');
-- ERROR: new row violates check constraint "check_npa_format"
```

---

### APRÈS - Contrainte flexible
```sql
-- Table immeubles
ALTER TABLE immeubles
DROP CONSTRAINT check_npa_format;

ALTER TABLE immeubles
ADD CONSTRAINT check_npa_multi_pays 
CHECK (npa ~ '^[0-9]{4,5}$');
-- ✅ Accepte 4 OU 5 chiffres

-- Table logements
ALTER TABLE logements
ADD CONSTRAINT check_logement_npa_multi_pays 
CHECK (npa ~ '^[0-9]{4,5}$');
-- ✅ Idem pour cohérence
```

**Avantages** :
```sql
-- ✅ SUISSE - OK
INSERT INTO immeubles (npa, pays) 
VALUES ('1000', 'Suisse');

-- ✅ FRANCE - OK
INSERT INTO immeubles (npa, pays) 
VALUES ('75001', 'France');

-- ❌ INVALIDE - KO
INSERT INTO immeubles (npa, pays) 
VALUES ('ABCD', 'Suisse');
-- ERROR: check constraint violation

-- ❌ TROP COURT - KO
INSERT INTO immeubles (npa, pays) 
VALUES ('100', 'Suisse');
-- ERROR: check constraint violation

-- ❌ TROP LONG - KO
INSERT INTO immeubles (npa, pays) 
VALUES ('750012', 'France');
-- ERROR: check constraint violation
```

---

## 📈 Diagramme de séquence - Création immeuble

### Scénario : Création immeuble français

```
User                Frontend               Backend/DB
 │                     │                      │
 │ 1. Ouvre formulaire│                      │
 │─────────────────────▶                      │
 │                     │                      │
 │ 2. Sélectionne "France"                   │
 │─────────────────────▶                      │
 │                     │                      │
 │                     │ 3. Event onChange    │
 │                     │───────┐              │
 │                     │       │              │
 │                     │ ◄─────┘              │
 │                     │ - placeholder = 75001│
 │                     │ - maxLength = 5      │
 │                     │ - hint = 5 chiffres  │
 │                     │                      │
 │ 4. Saisit 75116    │                      │
 │─────────────────────▶                      │
 │                     │                      │
 │ 5. Clique "Créer"  │                      │
 │─────────────────────▶                      │
 │                     │                      │
 │                     │ 6. Validation JS     │
 │                     │───────┐              │
 │                     │       │ pays='France'│
 │                     │       │ /^[0-9]{5}$/ │
 │                     │ ◄─────┘ ✅ OK        │
 │                     │                      │
 │                     │ 7. INSERT immeubles  │
 │                     │──────────────────────▶
 │                     │                      │
 │                     │                      │ 8. CHECK constraint
 │                     │                      │───────┐
 │                     │                      │       │ npa ~ '^[0-9]{4,5}$'
 │                     │                      │ ◄─────┘ ✅ OK
 │                     │                      │
 │                     │ 9. Success response  │
 │                     │◀──────────────────────
 │                     │                      │
 │ 10. Message succès │                      │
 │◀─────────────────────                      │
 │ "Immeuble créé"    │                      │
 │                     │                      │
```

---

## 🎯 Compatibilité rétroactive

### Données existantes (toutes suisses - 4 chiffres)

```sql
-- ÉTAT AVANT MIGRATION
SELECT id, nom, npa, pays FROM immeubles;

┌─────┬──────────────────────┬──────┬────────┐
│ id  │ nom                  │ npa  │ pays   │
├─────┼──────────────────────┼──────┼────────┤
│ 1   │ Résidence Les Pins   │ 1000 │ Suisse │
│ 2   │ Immeuble Central     │ 1003 │ Suisse │
│ 3   │ Tour Bleue           │ 8001 │ Suisse │
└─────┴──────────────────────┴──────┴────────┘

-- ✅ TOUTES LES DONNÉES RESTENT VALIDES
-- Contrainte check_npa_multi_pays : ^[0-9]{4,5}$
--                                    ✅ 4 chiffres OK
```

### Après ajout immeubles français

```sql
SELECT id, nom, npa, pays FROM immeubles;

┌─────┬──────────────────────┬──────┬────────┐
│ id  │ nom                  │ npa  │ pays   │
├─────┼──────────────────────┼──────┼────────┤
│ 1   │ Résidence Les Pins   │ 1000 │ Suisse │ ← ANCIEN
│ 2   │ Immeuble Central     │ 1003 │ Suisse │ ← ANCIEN
│ 3   │ Tour Bleue           │ 8001 │ Suisse │ ← ANCIEN
│ 4   │ Résidence Victor Hugo│75116 │ France │ ← NOUVEAU
│ 5   │ Immeuble Marais      │75003 │ France │ ← NOUVEAU
└─────┴──────────────────────┴──────┴────────┘

-- ✅ COHABITATION PARFAITE
```

---

## 🏁 Résumé des gains

| Aspect | Avant | Après | Gain |
|--------|-------|-------|------|
| **Pays supportés** | 🇨🇭 Suisse uniquement | 🇨🇭 Suisse + 🇫🇷 France | +1 pays |
| **Formats NPA** | 4 chiffres seulement | 4 ou 5 chiffres | +Flexibilité |
| **UX** | Statique | Dynamique (placeholder/hint) | +Guidage |
| **Validation** | Monolithique | Conditionnelle par pays | +Précision |
| **Contrainte DB** | Stricte (4 digits) | Flexible (4-5 digits) | +Souplesse |
| **Rétrocompatibilité** | - | ✅ 100% | +Sécurité |
| **Breaking changes** | - | ❌ Aucun | +Fiabilité |

---

**Conclusion** : Extension propre, sans régression, avec UX améliorée et validation stricte maintenue.
