# 🧪 PLAN DE TESTS - TICKETS JETC_IMMO

**Date** : 26 décembre 2025  
**Objectif** : Valider le workflow tickets AVANT application migrations  
**Principe** : Tests exhaustifs, exécutables mentalement, sans SQL exécutable

---

## 🎯 OBJECTIF

Ce document définit **TOUS** les tests à effectuer pour valider que les corrections ne cassent rien et que le workflow fonctionne conformément à la spec.

**Aucun SQL exécutable ici** : uniquement des scénarios, entrées/sorties attendues, points de contrôle.

---

## 📐 MÉTHODOLOGIE

### Structure des tests

Chaque test suit ce format :

```
TEST #XX - Titre explicite

Pré-requis :
- État initial requis
- Données existantes

Acteur : Rôle de l'utilisateur (Locataire / Régie / Entreprise / Admin)

Actions :
1. Action détaillée
2. Action suivante
3. ...

Résultats attendus :
✅ Ce qui DOIT se passer
❌ Ce qui NE DOIT PAS se passer

Points de contrôle :
- Vérifications BDD
- Vérifications RLS
- Vérifications logs
```

### Classification

| Symbole | Type de test |
|---------|--------------|
| ✅ | Test positif (comportement normal) |
| ❌ | Test négatif (erreur attendue) |
| 🔒 | Test RLS (isolation / sécurité) |
| 🔄 | Test rollback (annulation migration) |

---

## 🧪 TESTS PAR CATÉGORIE

### CATÉGORIE A - WORKFLOW NOMINAL (Happy Path)

---

#### TEST #A01 - Création ticket par locataire

**Pré-requis** :
- Locataire existant avec logement_id NOT NULL
- 3 créneaux de disponibilité choisis

**Acteur** : Locataire (role='locataire')

**Actions** :
1. Locataire se connecte via dashboard
2. Clique "Créer un ticket"
3. Remplit formulaire :
   - Titre : "Fuite d'eau sous évier"
   - Description : "Fuite importante, eau s'accumule dans placard"
   - Catégorie : "plomberie"
   - Sous-catégorie : "Fuite d'eau"
   - Pièce : "cuisine"
   - Priorité : "haute"
   - Urgence : false
   - Photos : [url1, url2]
   - Disponibilités :
     - Créneau 1 (préférence=1) : 2025-12-27 09:00 → 12:00
     - Créneau 2 (préférence=2) : 2025-12-28 14:00 → 17:00
     - Créneau 3 (préférence=3) : 2025-12-29 10:00 → 13:00
4. Soumet le formulaire

**Résultats attendus** :
✅ Ticket créé avec statut = 'nouveau'
✅ regie_id calculé automatiquement via trigger (depuis logement → immeuble)
✅ 3 lignes insérées dans tickets_disponibilites
✅ plafond_intervention_chf = 0 (par défaut, régie le remplira)
✅ mode_diffusion = NULL (pas encore diffusé)
✅ entreprise_id = NULL
✅ locked_at = NULL
✅ Locataire voit son ticket dans sa liste

❌ Statut ne doit PAS être 'ouvert' (correction API create appliquée)
❌ Ticket ne doit PAS être visible par entreprises
❌ Ticket ne doit PAS être visible par autres régies

**Points de contrôle** :
- BDD : `SELECT statut, regie_id, plafond_intervention_chf, mode_diffusion FROM tickets WHERE id = <new_ticket_id>`
- BDD : `SELECT COUNT(*) FROM tickets_disponibilites WHERE ticket_id = <new_ticket_id>` → doit retourner 3
- RLS : En tant qu'entreprise, `SELECT * FROM tickets WHERE id = <new_ticket_id>` → 0 ligne
- RLS : En tant que régie du ticket, `SELECT * FROM tickets WHERE id = <new_ticket_id>` → 1 ligne

---

#### TEST #A02 - Validation ticket par régie

**Pré-requis** :
- Ticket créé (TEST #A01) avec statut = 'nouveau'
- Utilisateur régie connecté

**Acteur** : Régie (role='regie')

**Actions** :
1. Régie consulte liste tickets nouveaux
2. Ouvre détail du ticket "Fuite d'eau sous évier"
3. Vérifie informations (photos, description, disponibilités)
4. Définit plafond d'intervention : 350.00 CHF
5. Clique "Valider le ticket"
6. API appelle RPC `update_ticket_statut(<ticket_id>, 'ouvert')`

**Résultats attendus** :
✅ Ticket passe de 'nouveau' → 'ouvert'
✅ plafond_intervention_chf = 350.00
✅ updated_at mis à jour
✅ Ticket visible dans liste "Tickets validés, à diffuser"

❌ Ticket ne doit PAS être diffusé automatiquement
❌ Entreprises ne doivent toujours PAS voir le ticket

**Points de contrôle** :
- BDD : `SELECT statut, plafond_intervention_chf FROM tickets WHERE id = <ticket_id>` → ('ouvert', 350.00)
- RLS : En tant qu'entreprise, `SELECT * FROM tickets WHERE id = <ticket_id>` → 0 ligne
- Logs : Aucune erreur SQL "transition interdite"

---

#### TEST #A03 - Diffusion ticket en mode PUBLIC

**Pré-requis** :
- Ticket validé (TEST #A02) avec statut = 'ouvert'
- Au moins 2 entreprises autorisées par régie avec mode_diffusion='general'

**Acteur** : Régie (role='regie')

**Actions** :
1. Régie consulte tickets validés
2. Sélectionne ticket "Fuite d'eau sous évier"
3. Choisit "Diffusion publique" (toutes entreprises)
4. Clique "Diffuser"
5. API appelle RPC `diffuser_ticket(<ticket_id>, 'public')`

**Résultats attendus** :
✅ Ticket passe de 'ouvert' → 'en_attente'
✅ mode_diffusion = 'public'
✅ entreprise_id = NULL (pas d'assignation)
✅ updated_at mis à jour
✅ **Ticket visible par TOUTES entreprises autorisées** (mode_diffusion='general' dans regies_entreprises)
✅ Ticket apparaît dans vue `tickets_visibles_entreprise` pour ces entreprises

❌ Ticket ne doit PAS être visible par entreprises NON autorisées
❌ Ticket ne doit PAS être visible par entreprises en mode 'restreint'
❌ locked_at doit rester NULL

**Points de contrôle** :
- BDD : `SELECT statut, mode_diffusion, entreprise_id, locked_at FROM tickets WHERE id = <ticket_id>` → ('en_attente', 'public', NULL, NULL)
- RLS : En tant qu'entreprise A autorisée (general), `SELECT * FROM tickets WHERE id = <ticket_id>` → 1 ligne
- RLS : En tant qu'entreprise B autorisée (general), `SELECT * FROM tickets WHERE id = <ticket_id>` → 1 ligne
- RLS : En tant qu'entreprise C NON autorisée, `SELECT * FROM tickets WHERE id = <ticket_id>` → 0 ligne
- Vue : `SELECT COUNT(*) FROM tickets_visibles_entreprise WHERE id = <ticket_id>` → nombre = nombre d'entreprises autorisées en mode 'general'

---

#### TEST #A04 - Acceptation ticket par entreprise (mode public)

**Pré-requis** :
- Ticket diffusé (TEST #A03) avec statut = 'en_attente', mode_diffusion='public'
- Entreprise autorisée connectée
- Aucune mission existante sur ce ticket

**Acteur** : Entreprise A (role='entreprise')

**Actions** :
1. Entreprise consulte liste tickets disponibles
2. Voit ticket "Fuite d'eau sous évier"
3. Consulte détails (plafond : 350 CHF, disponibilités)
4. Clique "Accepter ce ticket"
5. API appelle RPC `accept_ticket_and_create_mission(<ticket_id>, <entreprise_A_id>)`

**Résultats attendus** :
✅ Fonction vérifie que mode_diffusion='public' ✅
✅ Fonction vérifie que entreprise A est autorisée en mode 'general' ✅
✅ Fonction vérifie locked_at IS NULL ✅
✅ Mission créée avec statut='en_attente', ticket_id UNIQUE
✅ Ticket passe de 'en_attente' → 'en_cours'
✅ Ticket.entreprise_id = <entreprise_A_id>
✅ Ticket.locked_at = now()
✅ Ticket DISPARAÎT de la liste des autres entreprises (locked)
✅ Entreprise A voit le ticket dans "Mes missions"

❌ Entreprise B ne doit PLUS voir le ticket dans liste disponibles
❌ Mission avec ticket_id déjà existant doit échouer (contrainte UNIQUE)

**Points de contrôle** :
- BDD : `SELECT statut, entreprise_id, locked_at FROM tickets WHERE id = <ticket_id>` → ('en_cours', <entreprise_A_id>, <timestamp>)
- BDD : `SELECT COUNT(*) FROM missions WHERE ticket_id = <ticket_id>` → 1
- RLS : En tant qu'entreprise B (autre), `SELECT * FROM tickets WHERE id = <ticket_id>` → 0 ligne (locked + pas assignée)
- RLS : En tant qu'entreprise A, `SELECT * FROM tickets WHERE id = <ticket_id>` → 1 ligne (acceptée par elle)
- Vue : `SELECT COUNT(*) FROM tickets_visibles_entreprise WHERE id = <ticket_id> AND entreprise_id = <entreprise_B_id>` → 0

---

#### TEST #A05 - Terminaison intervention par entreprise

**Pré-requis** :
- Mission acceptée (TEST #A04) avec statut mission='en_attente', ticket statut='en_cours'
- Entreprise a effectué intervention

**Acteur** : Entreprise A (role='entreprise')

**Actions** :
1. Entreprise consulte mission dans "Mes missions"
2. Clique "Marquer comme terminée"
3. Remplit montant réel : 320.00 CHF
4. Upload facture (facture_url)
5. Ajoute notes : "Remplacement joint + robinet"
6. Soumet
7. API UPDATE missions SET statut='terminee', montant_reel_chf=320.00, completed_at=now()

**Résultats attendus** :
✅ Mission passe en statut='terminee'
✅ Trigger `sync_mission_to_ticket` s'exécute
✅ Ticket passe automatiquement de 'en_cours' → 'termine'
✅ Montant réel (320 CHF) < plafond (350 CHF) → OK
✅ Entreprise ne peut plus modifier mission (sauf rollback régie)
✅ Régie voit mission dans "À valider"

❌ Montant négatif doit être rejeté (contrainte CHECK)
❌ Mission déjà terminée ne doit pas repasser 'en_cours'

**Points de contrôle** :
- BDD : `SELECT statut FROM missions WHERE ticket_id = <ticket_id>` → 'terminee'
- BDD : `SELECT statut FROM tickets WHERE id = <ticket_id>` → 'termine' (synchronisé automatiquement)
- BDD : `SELECT montant_reel_chf FROM missions WHERE ticket_id = <ticket_id>` → 320.00
- Trigger : Vérifier que trigger sync a bien fonctionné (pas d'erreur logs)

---

#### TEST #A06 - Validation et clôture par régie

**Pré-requis** :
- Mission terminée (TEST #A05) avec statut='terminee', ticket='termine'
- Régie a vérifié travaux

**Acteur** : Régie (role='regie')

**Actions** :
1. Régie consulte missions terminées
2. Ouvre détail mission "Fuite d'eau sous évier"
3. Vérifie facture, montant (320 CHF < 350 CHF plafond)
4. Clique "Valider et clôturer"
5. API UPDATE missions SET statut='validee', validated_at=now()

**Résultats attendus** :
✅ Mission passe en statut='validee'
✅ Trigger `sync_mission_to_ticket` s'exécute
✅ Ticket passe automatiquement de 'termine' → 'clos'
✅ Ticket.date_cloture = now()
✅ Workflow terminé, ticket archivé

❌ Ticket ne peut plus changer de statut (terminal)
❌ Mission ne peut plus être modifiée

**Points de contrôle** :
- BDD : `SELECT statut, date_cloture FROM tickets WHERE id = <ticket_id>` → ('clos', <timestamp>)
- BDD : `SELECT statut, validated_at FROM missions WHERE ticket_id = <ticket_id>` → ('validee', <timestamp>)
- RLS : Ticket reste visible par locataire, régie, entreprise A (historique)

---

### CATÉGORIE B - WORKFLOW MODE ASSIGNÉ

---

#### TEST #B01 - Diffusion ticket en mode ASSIGNÉ

**Pré-requis** :
- Ticket validé avec statut='ouvert', plafond_intervention_chf=500.00
- 3 entreprises autorisées par régie (E1, E2, E3)
- Régie veut assigner directement à E2

**Acteur** : Régie (role='regie')

**Actions** :
1. Régie sélectionne ticket
2. Choisit "Diffusion assignée"
3. Sélectionne entreprise E2 dans liste déroulante
4. Clique "Diffuser à E2"
5. API appelle RPC `diffuser_ticket(<ticket_id>, 'assigné', <entreprise_E2_id>)`

**Résultats attendus** :
✅ Ticket passe de 'ouvert' → 'en_attente'
✅ mode_diffusion = 'assigné'
✅ entreprise_id = <entreprise_E2_id>
✅ **Ticket visible UNIQUEMENT par E2**
✅ Ticket invisible pour E1 et E3

❌ Entreprises E1 et E3 ne doivent PAS voir le ticket
❌ locked_at doit rester NULL (pas encore accepté)

**Points de contrôle** :
- BDD : `SELECT statut, mode_diffusion, entreprise_id FROM tickets WHERE id = <ticket_id>` → ('en_attente', 'assigné', <entreprise_E2_id>)
- RLS : En tant qu'entreprise E1, `SELECT * FROM tickets WHERE id = <ticket_id>` → 0 ligne
- RLS : En tant qu'entreprise E2, `SELECT * FROM tickets WHERE id = <ticket_id>` → 1 ligne
- RLS : En tant qu'entreprise E3, `SELECT * FROM tickets WHERE id = <ticket_id>` → 0 ligne
- Vue : `SELECT COUNT(*) FROM tickets_visibles_entreprise WHERE id = <ticket_id>` → 1 (uniquement E2)

---

#### TEST #B02 - Acceptation ticket assigné par bonne entreprise

**Pré-requis** :
- Ticket assigné (TEST #B01) mode_diffusion='assigné', entreprise_id=E2

**Acteur** : Entreprise E2 (role='entreprise')

**Actions** :
1. E2 consulte tickets disponibles
2. Voit ticket assigné à elle
3. Clique "Accepter"
4. API appelle RPC `accept_ticket_and_create_mission(<ticket_id>, <entreprise_E2_id>)`

**Résultats attendus** :
✅ Fonction vérifie que mode_diffusion='assigné' ✅
✅ Fonction vérifie que entreprise_id du ticket == E2 ✅
✅ Mission créée
✅ Ticket passe 'en_attente' → 'en_cours'
✅ locked_at = now()

❌ Autre entreprise ne doit PAS pouvoir accepter (voir TEST #B03)

**Points de contrôle** :
- BDD : `SELECT statut, locked_at FROM tickets WHERE id = <ticket_id>` → ('en_cours', <timestamp>)
- BDD : `SELECT COUNT(*) FROM missions WHERE ticket_id = <ticket_id> AND entreprise_id = <entreprise_E2_id>` → 1

---

#### TEST #B03 - ❌ Tentative acceptation par mauvaise entreprise (mode assigné)

**Pré-requis** :
- Ticket assigné (TEST #B01) mode_diffusion='assigné', entreprise_id=E2
- Entreprise E1 tente d'accepter (piratage URL ou bug)

**Acteur** : Entreprise E1 (role='entreprise')

**Actions** :
1. E1 appelle directement API `accept_ticket_and_create_mission(<ticket_id>, <entreprise_E1_id>)`

**Résultats attendus** :
❌ RPC doit échouer avec RAISE EXCEPTION 'Ticket assigné à une autre entreprise'
❌ Aucune mission créée
❌ Ticket reste inchangé
❌ Logs : Erreur SQL capturée

**Points de contrôle** :
- BDD : `SELECT COUNT(*) FROM missions WHERE ticket_id = <ticket_id>` → 0
- BDD : `SELECT statut, locked_at FROM tickets WHERE id = <ticket_id>` → ('en_attente', NULL) (inchangé)
- Logs : Erreur contenant "Ticket assigné à une autre entreprise"

---

### CATÉGORIE C - TESTS NÉGATIFS (ANTI-DOUBLON, ERREURS)

---

#### TEST #C01 - ❌ Création ticket sans 3 disponibilités puis tentative diffusion

**Pré-requis** :
- Ticket validé avec statut='ouvert'
- AUCUNE disponibilité insérée (ou seulement 1 ou 2)

**Acteur** : Régie (role='regie')

**Actions** :
1. Régie tente de diffuser ticket
2. API appelle RPC `diffuser_ticket(<ticket_id>, 'public')`
3. RPC tente UPDATE tickets SET statut='en_attente'
4. Trigger `check_disponibilites_before_diffusion` s'exécute

**Résultats attendus** :
❌ Trigger doit échouer avec RAISE EXCEPTION 'Un ticket doit avoir exactement 3 disponibilités avant diffusion (actuellement : X)'
❌ Statut reste 'ouvert'
❌ mode_diffusion reste NULL
❌ Régie voit message d'erreur

**Points de contrôle** :
- BDD : `SELECT statut, mode_diffusion FROM tickets WHERE id = <ticket_id>` → ('ouvert', NULL) (inchangé)
- BDD : `SELECT COUNT(*) FROM tickets_disponibilites WHERE ticket_id = <ticket_id>` → < 3
- Logs : Erreur trigger avec message explicite

---

#### TEST #C02 - ❌ Acceptation ticket déjà verrouillé (double-clic / concurrence)

**Pré-requis** :
- Ticket diffusé mode='public', statut='en_attente'
- Entreprise E1 accepte (locked_at rempli)
- Entreprise E2 tente d'accepter 1 seconde après

**Acteur** : Entreprise E2 (role='entreprise')

**Actions** :
1. E2 appelle API `accept_ticket_and_create_mission(<ticket_id>, <entreprise_E2_id>)`

**Résultats attendus** :
❌ RPC doit échouer avec RAISE EXCEPTION 'Ticket déjà verrouillé (accepté par une autre entreprise)'
❌ Aucune mission créée pour E2
❌ Ticket reste assigné à E1
❌ E2 voit message "Ticket déjà pris"

**Points de contrôle** :
- BDD : `SELECT entreprise_id FROM tickets WHERE id = <ticket_id>` → <entreprise_E1_id> (inchangé)
- BDD : `SELECT COUNT(*) FROM missions WHERE ticket_id = <ticket_id>` → 1 (celle de E1)
- BDD : `SELECT entreprise_id FROM missions WHERE ticket_id = <ticket_id>` → <entreprise_E1_id>

---

#### TEST #C03 - ❌ Tentative création 2ème mission sur même ticket

**Pré-requis** :
- Ticket avec mission existante (constraint UNIQUE sur ticket_id)

**Acteur** : Admin tente bypass (SQL direct ou bug)

**Actions** :
1. Tentative `INSERT INTO missions (ticket_id, entreprise_id, statut) VALUES (<ticket_id>, <autre_entreprise>, 'en_attente')`

**Résultats attendus** :
❌ Contrainte UNIQUE doit échouer
❌ Erreur PostgreSQL : duplicate key value violates unique constraint
❌ Aucune 2ème mission créée

**Points de contrôle** :
- BDD : `SELECT COUNT(*) FROM missions WHERE ticket_id = <ticket_id>` → 1 (reste 1)
- Logs : Erreur contrainte UNIQUE

---

#### TEST #C04 - ❌ Transition statut interdite (saut d'étape)

**Pré-requis** :
- Ticket avec statut='nouveau'

**Acteur** : Régie tente forcer clôture

**Actions** :
1. Régie appelle RPC `update_ticket_statut(<ticket_id>, 'clos')`

**Résultats attendus** :
❌ RPC doit échouer avec RAISE EXCEPTION 'Transition interdite : nouveau → clos pour rôle regie'
❌ Statut reste 'nouveau'

**Points de contrôle** :
- BDD : `SELECT statut FROM tickets WHERE id = <ticket_id>` → 'nouveau' (inchangé)
- Logs : Erreur "Transition interdite"

---

#### TEST #C05 - ❌ Montant mission négatif

**Pré-requis** :
- Mission en cours

**Acteur** : Entreprise tente remplir montant

**Actions** :
1. API UPDATE missions SET montant_reel_chf=-50.00 WHERE id=<mission_id>

**Résultats attendus** :
❌ Contrainte CHECK `check_montant_positif` doit échouer
❌ Montant reste NULL ou valeur précédente
❌ Erreur : "new row violates check constraint"

**Points de contrôle** :
- BDD : `SELECT montant_reel_chf FROM missions WHERE id = <mission_id>` → NULL ou valeur > 0
- Logs : Erreur contrainte CHECK

---

#### TEST #C06 - ❌ Diffusion mode assigné sans entreprise_id

**Pré-requis** :
- Ticket validé statut='ouvert'

**Acteur** : Régie (bug frontend)

**Actions** :
1. API appelle RPC `diffuser_ticket(<ticket_id>, 'assigné', NULL)`

**Résultats attendus** :
❌ RPC doit échouer avec RAISE EXCEPTION 'Mode assigné nécessite entreprise_id'
❌ Ticket reste 'ouvert'
❌ mode_diffusion reste NULL

**Points de contrôle** :
- BDD : `SELECT statut, mode_diffusion FROM tickets WHERE id = <ticket_id>` → ('ouvert', NULL)
- Logs : Erreur "Mode assigné nécessite entreprise_id"

---

#### TEST #C07 - ❌ Entreprise tente diffuser ticket (usurpation rôle)

**Pré-requis** :
- Ticket validé
- Entreprise tente appeler RPC diffuser

**Acteur** : Entreprise (piratage)

**Actions** :
1. Entreprise appelle `diffuser_ticket(<ticket_id>, 'public')`

**Résultats attendus** :
❌ RPC vérifie `get_user_regie_id()` → NULL pour entreprise
❌ RAISE EXCEPTION 'Utilisateur non associé à une régie'
❌ Ticket inchangé

**Points de contrôle** :
- BDD : Ticket inchangé
- Logs : Erreur "Utilisateur non associé à une régie"

---

### CATÉGORIE D - TESTS RLS (ROW LEVEL SECURITY)

---

#### TEST #D01 - 🔒 Locataire voit uniquement SES tickets

**Pré-requis** :
- 3 locataires (L1, L2, L3)
- L1 a créé ticket T1
- L2 a créé ticket T2
- L3 a créé ticket T3

**Acteur** : Locataire L1

**Actions** :
1. L1 se connecte
2. Consulte liste tickets via `SELECT * FROM tickets WHERE locataire_id = (SELECT id FROM locataires WHERE profile_id = auth.uid())`

**Résultats attendus** :
✅ L1 voit T1
❌ L1 ne voit PAS T2
❌ L1 ne voit PAS T3

**Points de contrôle** :
- RLS : Simuler auth.uid() = profile_id de L1
- BDD : `SELECT COUNT(*) FROM tickets` en tant que L1 → 1 (uniquement T1)

---

#### TEST #D02 - 🔒 Régie voit uniquement tickets de SES immeubles

**Pré-requis** :
- 2 régies (R1, R2)
- R1 gère immeubles I1, I2
- R2 gère immeuble I3
- Tickets : T1 (immeuble I1 → régie R1), T2 (immeuble I3 → régie R2)

**Acteur** : Régie R1

**Actions** :
1. R1 consulte tickets via `SELECT * FROM tickets WHERE regie_id = get_user_regie_id()`

**Résultats attendus** :
✅ R1 voit T1
❌ R1 ne voit PAS T2 (appartient à R2)

**Points de contrôle** :
- RLS : Simuler auth.uid() = profile_id de R1
- BDD : `SELECT COUNT(*) FROM tickets` en tant que R1 → 1
- BDD : Vérifier `get_user_regie_id()` retourne bien id de R1

---

#### TEST #D03 - 🔒 Entreprise voit tickets selon mode diffusion

**Pré-requis** :
- Régie R1 avec 3 entreprises autorisées :
  - E1 : mode_diffusion='general'
  - E2 : mode_diffusion='general'
  - E3 : mode_diffusion='restreint'
- Tickets :
  - T1 : diffusé 'public', statut='en_attente', regie_id=R1
  - T2 : diffusé 'assigné', entreprise_id=E2, statut='en_attente'
  - T3 : statut='nouveau' (pas diffusé)

**Acteur** : Entreprise E1

**Actions** :
1. E1 consulte `SELECT * FROM tickets` (RLS appliquée)

**Résultats attendus** :
✅ E1 voit T1 (mode public, E1 autorisée en 'general')
❌ E1 ne voit PAS T2 (assigné à E2)
❌ E1 ne voit PAS T3 (pas diffusé)

**Acteur** : Entreprise E2

**Actions** :
1. E2 consulte tickets

**Résultats attendus** :
✅ E2 voit T1 (mode public)
✅ E2 voit T2 (assigné à elle)
❌ E2 ne voit PAS T3

**Acteur** : Entreprise E3

**Actions** :
1. E3 consulte tickets

**Résultats attendus** :
❌ E3 ne voit PAS T1 (mode_diffusion E3='restreint', donc pas éligible pour tickets publics)
❌ E3 ne voit PAS T2 (assigné à E2)
❌ E3 ne voit PAS T3

**Points de contrôle** :
- RLS : Policy `Entreprise can view authorized tickets` filtre correctement
- Vue : `tickets_visibles_entreprise` retourne mêmes résultats que RLS

---

#### TEST #D04 - 🔒 Entreprise ne voit plus ticket une fois verrouillé (public)

**Pré-requis** :
- Ticket T1 diffusé 'public', statut='en_attente', locked_at=NULL
- Entreprise E1 accepte → locked_at=now()

**Acteur** : Entreprise E2 (autre entreprise)

**Actions** :
1. E2 consulte tickets disponibles

**Résultats attendus** :
❌ E2 ne voit PLUS T1 (locked_at IS NOT NULL)
✅ RLS/vue filtre `locked_at IS NULL`

**Points de contrôle** :
- RLS : `SELECT COUNT(*) FROM tickets WHERE id = T1` en tant que E2 → 0
- Vue : `SELECT COUNT(*) FROM tickets_visibles_entreprise WHERE id = T1 AND entreprise_id = E2` → 0

---

#### TEST #D05 - 🔒 Régie ne peut PAS supprimer ticket avec mission

**Pré-requis** :
- Ticket T1 avec mission M1 existante

**Acteur** : Régie (role='regie')

**Actions** :
1. Régie tente `DELETE FROM tickets WHERE id = T1`

**Résultats attendus** :
❌ Policy DELETE doit échouer
❌ Contrainte RLS : `NOT EXISTS (SELECT 1 FROM missions WHERE ticket_id = tickets.id)`
❌ Ticket reste en base

**Points de contrôle** :
- BDD : `SELECT COUNT(*) FROM tickets WHERE id = T1` → 1 (toujours présent)
- Logs : Erreur policy RLS "permission denied for relation tickets"

---

#### TEST #D06 - 🔒 Régie peut supprimer ticket sans mission

**Pré-requis** :
- Ticket T2 créé, statut='nouveau', AUCUNE mission

**Acteur** : Régie

**Actions** :
1. Régie `DELETE FROM tickets WHERE id = T2`

**Résultats attendus** :
✅ Ticket supprimé (pas de mission bloquante)
✅ Policy DELETE autorise (condition NOT EXISTS OK)

**Points de contrôle** :
- BDD : `SELECT COUNT(*) FROM tickets WHERE id = T2` → 0
- BDD : Aucune erreur RLS

---

### CATÉGORIE E - TESTS ROLLBACK (ANNULATION MIGRATIONS)

---

#### TEST #E01 - 🔄 Rollback M01 (colonnes budget)

**Pré-requis** :
- Migration M01 appliquée (colonnes plafond_intervention_chf, devise ajoutées)
- Quelques tickets avec plafond rempli

**Actions** :
1. Exécuter rollback M01 : `ALTER TABLE tickets DROP COLUMN plafond_intervention_chf; DROP COLUMN devise;`

**Résultats attendus** :
✅ Colonnes supprimées
✅ Contraintes CHECK supprimées
⚠️ Données plafond perdues (acceptable, migration annulée)
❌ Tickets restent intacts (autre colonnes)
❌ Aucune erreur FK ou autre

**Points de contrôle** :
- BDD : `SELECT column_name FROM information_schema.columns WHERE table_name='tickets' AND column_name IN ('plafond_intervention_chf', 'devise')` → 0 ligne
- BDD : `SELECT COUNT(*) FROM tickets` → nombre inchangé

---

#### TEST #E02 - 🔄 Rollback M03 (RPC update_ticket_statut)

**Pré-requis** :
- Migration M03 appliquée (fonction créée)

**Actions** :
1. Exécuter rollback M03 : `DROP FUNCTION IF EXISTS update_ticket_statut`

**Résultats attendus** :
✅ Fonction supprimée
❌ Appels API vers cette fonction échoueront (normal, rollback)

**Points de contrôle** :
- BDD : `SELECT routine_name FROM information_schema.routines WHERE routine_name='update_ticket_statut'` → 0 ligne

---

#### TEST #E03 - 🔄 Rollback M06 (vue tickets_visibles_entreprise)

**Pré-requis** :
- Migration M06 appliquée (vue corrigée)

**Actions** :
1. Exécuter rollback M06 : `DROP VIEW tickets_visibles_entreprise; CREATE VIEW tickets_visibles_entreprise AS <ancienne_version>`

**Résultats attendus** :
✅ Vue recréée avec ancienne logique (cassée)
⚠️ Tickets redeviennent invisibles (régression attendue)

**Points de contrôle** :
- BDD : `SELECT COUNT(*) FROM tickets_visibles_entreprise` → résultats différents (anciennes conditions)
- Validation : Relancer TEST #A03 → doit échouer (tickets invisibles)

---

#### TEST #E04 - 🔄 Rollback M09 (table tickets_disponibilites)

**Pré-requis** :
- Migration M09 appliquée (table créée)
- Quelques disponibilités insérées

**Actions** :
1. Exécuter rollback M09 : `DROP TABLE tickets_disponibilites CASCADE`

**Résultats attendus** :
✅ Table supprimée
⚠️ Données disponibilités perdues (acceptable, rollback)
✅ Trigger validation 3 créneaux (M10) automatiquement supprimé (CASCADE)

**Points de contrôle** :
- BDD : `SELECT table_name FROM information_schema.tables WHERE table_name='tickets_disponibilites'` → 0 ligne
- BDD : Trigger sur tickets doit échouer si référence tickets_disponibilites

---

#### TEST #E05 - 🔄 Rollback COMPLET (toutes migrations Phase 1)

**Pré-requis** :
- Migrations M01-M07 appliquées

**Actions** :
1. Exécuter rollbacks dans ordre inverse : M07, M06, M05, M04, M03, M02, M01

**Résultats attendus** :
✅ Base revenue état AVANT migrations
✅ Colonnes mode_diffusion, plafond_intervention_chf, devise supprimées
✅ RPC diffuser_ticket, update_ticket_statut supprimées
✅ RPC accept_ticket_and_create_mission revenue version cassée (colonne autorise)
✅ Vue et policy RLS revenues versions cassées
❌ Workflow tickets cassé (état initial avant corrections)

**Points de contrôle** :
- BDD : Vérifier schéma identique à état pré-migration (comparer avec dump)
- Validation : Relancer TEST #A01 → doit échouer ou donner résultats incorrects

---

### CATÉGORIE F - TESTS PERFORMANCE & COHÉRENCE

---

#### TEST #F01 - Performance vue tickets_visibles_entreprise (1000 tickets)

**Pré-requis** :
- Base avec 1000 tickets diffusés
- 50 entreprises autorisées

**Acteur** : Entreprise E1

**Actions** :
1. Consulter `SELECT * FROM tickets_visibles_entreprise WHERE entreprise_id = <E1_id>`

**Résultats attendus** :
✅ Requête termine en < 500ms
✅ Plan d'exécution utilise index `idx_tickets_mode_diffusion`, `idx_tickets_statut`, `idx_regies_entreprises_entreprise_id`

**Points de contrôle** :
- Performance : `EXPLAIN ANALYZE SELECT ...` → vérifier Seq Scan absent
- Index : Confirmer index utilisés

---

#### TEST #F02 - Cohérence disponibilités (chevauchement impossible)

**Pré-requis** :
- Ticket T1 avec 3 disponibilités insérées

**Actions** :
1. Tenter insérer 4ème créneau qui chevauche créneau 1

**Résultats attendus** :
❌ Contrainte EXCLUDE doit échouer
❌ Erreur : "conflicting key value violates exclusion constraint"

**Points de contrôle** :
- BDD : `SELECT COUNT(*) FROM tickets_disponibilites WHERE ticket_id = T1` → 3 (inchangé)

---

#### TEST #F03 - Cohérence statut mission ↔ ticket (sync trigger)

**Pré-requis** :
- Mission M1 avec statut='en_cours'
- Ticket T1 correspondant avec statut='en_cours'

**Actions** :
1. `UPDATE missions SET statut='terminee' WHERE id = M1`

**Résultats attendus** :
✅ Trigger s'exécute automatiquement
✅ Ticket T1 passe en 'termine' sans action manuelle

**Points de contrôle** :
- BDD : `SELECT statut FROM tickets WHERE id = T1` → 'termine' (mise à jour automatique)
- Logs : Aucune erreur trigger

---

### CATÉGORIE G - TESTS INTER-RÔLES (SCÉNARIOS COMPLETS)

---

#### TEST #G01 - 🎭 Workflow complet multi-acteurs

**Scénario** : Locataire → Régie → Entreprise → Régie (boucle complète)

**Acteurs** : Locataire L1, Régie R1, Entreprise E1

**Actions chronologiques** :
1. **L1** : Crée ticket "Panne chauffage" (TEST #A01)
2. **R1** : Valide ticket, définit plafond 800 CHF (TEST #A02)
3. **R1** : Diffuse en mode public (TEST #A03)
4. **E1** : Consulte tickets disponibles, voit "Panne chauffage"
5. **E1** : Accepte ticket (TEST #A04)
6. **L1** : Voit statut passer "nouveau" → "ouvert" → "en attente" → "en cours"
7. **E1** : Effectue intervention, marque terminée, montant 750 CHF (TEST #A05)
8. **R1** : Vérifie facture, valide mission (TEST #A06)
9. **L1** : Voit ticket "clos" dans historique

**Résultats attendus** :
✅ Toutes transitions réussies
✅ Chaque acteur voit uniquement ce qu'il doit voir (RLS)
✅ Statuts synchronisés mission ↔ ticket
✅ Montant respecte plafond
✅ Ticket clos avec date_cloture

**Points de contrôle** :
- Tracer toutes actions BDD en séquence
- Vérifier RLS à chaque étape (qui voit quoi)
- Confirmer triggers exécutés (sync statuts)

---

#### TEST #G02 - 🎭 Concurrence : 2 entreprises tentent accepter même ticket

**Scénario** : Ticket diffusé public, E1 et E2 cliquent "Accepter" simultanément

**Acteurs** : Entreprise E1, Entreprise E2

**Actions** :
1. Ticket T1 diffusé mode='public', statut='en_attente', locked_at=NULL
2. **E1** : Appelle `accept_ticket_and_create_mission(T1, E1)` à t=0
3. **E2** : Appelle `accept_ticket_and_create_mission(T1, E2)` à t=0.5s

**Résultats attendus** :
✅ Transaction E1 réussit (première arrivée)
✅ locked_at rempli par E1
❌ Transaction E2 échoue (locked_at IS NOT NULL)
✅ Aucune double-mission créée
✅ E2 voit message "Ticket déjà pris"

**Points de contrôle** :
- BDD : `SELECT COUNT(*) FROM missions WHERE ticket_id = T1` → 1
- BDD : `SELECT entreprise_id FROM tickets WHERE id = T1` → E1 (pas E2)

---

#### TEST #G03 - 🎭 Locataire crée ticket pendant maintenance (rollback en cours)

**Scénario** : Migration M08 (colonnes classification) en cours de rollback

**Actions** :
1. Admin exécute rollback M08 (supprime colonnes sous_categorie, piece)
2. Locataire L1 tente créer ticket pendant rollback

**Résultats attendus** :
❌ Formulaire frontend référence colonnes supprimées → erreur SQL
✅ Transaction rollback annulée proprement
❌ Ticket non créé (normal, maintenance)

**Points de contrôle** :
- BDD : Transaction en erreur, pas de ticket orphelin
- Frontend : Affiche message maintenance

---

---

## 📊 MATRICE DE TESTS (RÉSUMÉ)

### Tests par catégorie

| Catégorie | Nombre tests | Tests positifs | Tests négatifs | Tests RLS | Tests rollback |
|-----------|--------------|----------------|----------------|-----------|----------------|
| **A - Workflow nominal** | 6 | 6 | 0 | 0 | 0 |
| **B - Mode assigné** | 3 | 2 | 1 | 0 | 0 |
| **C - Tests négatifs** | 7 | 0 | 7 | 0 | 0 |
| **D - Tests RLS** | 6 | 2 | 4 | 6 | 0 |
| **E - Tests rollback** | 5 | 0 | 0 | 0 | 5 |
| **F - Performance** | 3 | 3 | 0 | 0 | 0 |
| **G - Inter-rôles** | 3 | 2 | 1 | 1 | 0 |
| **TOTAL** | **33** | **15** | **13** | **7** | **5** |

---

### Tests par rôle

| Rôle | Tests impliqués |
|------|-----------------|
| **Locataire** | A01, D01, G01, G03 |
| **Régie** | A02, A03, A06, B01, C01, C04, C06, C07, D02, D05, D06, G01 |
| **Entreprise** | A04, A05, B02, B03, C02, C05, D03, D04, G01, G02 |
| **Admin** | C03, E01-E05 |

---

### Tests par priorité

| Priorité | Tests | Objectif |
|----------|-------|----------|
| **P0 - Critique** | A01-A06, B01-B03, C01-C03, D01-D06 | Workflow DOIT fonctionner |
| **P1 - Important** | C04-C07, E01-E05 | Sécurité et réversibilité |
| **P2 - Souhaitable** | F01-F03, G01-G03 | Performance et edge cases |

---

## ✅ CHECKLIST VALIDATION FINALE

Avant déploiement prod, tous ces tests doivent passer :

### Tests obligatoires (P0)

- [ ] A01 - Création ticket locataire
- [ ] A02 - Validation régie
- [ ] A03 - Diffusion public
- [ ] A04 - Acceptation entreprise
- [ ] A05 - Terminaison intervention
- [ ] A06 - Clôture régie
- [ ] B01 - Diffusion assigné
- [ ] B02 - Acceptation ticket assigné
- [ ] B03 - Rejet acceptation mauvaise entreprise
- [ ] C01 - Erreur diffusion sans disponibilités
- [ ] C02 - Anti-doublon acceptation
- [ ] C03 - Anti-doublon mission
- [ ] D01 - RLS locataire
- [ ] D02 - RLS régie
- [ ] D03 - RLS entreprise modes diffusion
- [ ] D04 - RLS locked_at
- [ ] D05 - RLS DELETE avec mission bloqué
- [ ] D06 - RLS DELETE sans mission autorisé

### Tests sécurité (P1)

- [ ] C04 - Transition interdite
- [ ] C05 - Montant négatif rejeté
- [ ] C06 - Mode assigné sans entreprise_id
- [ ] C07 - Usurpation rôle
- [ ] E01 - Rollback M01
- [ ] E03 - Rollback M06 (vue)
- [ ] E05 - Rollback complet Phase 1

### Tests performance (P2)

- [ ] F01 - Performance vue < 500ms
- [ ] F02 - Cohérence disponibilités
- [ ] F03 - Sync trigger mission ↔ ticket

### Tests inter-rôles (P2)

- [ ] G01 - Workflow complet multi-acteurs
- [ ] G02 - Concurrence acceptation

---

## 🎯 SCÉNARIOS VALIDATION POST-MIGRATION

### Scénario 1 : Premier ticket en prod après migration

**Objectif** : Vérifier workflow E2E en conditions réelles

**Acteurs** : Vrai locataire, vraie régie, vraie entreprise

**Actions** :
1. Locataire crée ticket réel (pas de données test)
2. Suivre workflow complet jusqu'à clôture
3. Vérifier logs, RLS, performances

**Critères succès** :
✅ Aucune erreur SQL
✅ Statuts synchronisés
✅ Tous acteurs voient bonnes données
✅ Performance acceptable

---

### Scénario 2 : Smoke test API endpoints

**Endpoints à tester** :
- `POST /api/tickets/create`
- `POST /api/tickets/diffuser`
- `POST /api/tickets/accept`
- `GET /api/tickets/entreprise`

**Pour chaque endpoint** :
✅ Répond 200 OK
✅ Pas d'erreur SQL logs
✅ RLS appliquée correctement

---

### Scénario 3 : Test charge (optionnel)

**Objectif** : Vérifier tenue en charge

**Actions** :
1. Créer 100 tickets simultanément
2. 10 entreprises consultent liste simultanément

**Critères succès** :
✅ Temps réponse < 1s
✅ Pas de deadlock BDD
✅ RLS performante

---

## 📝 PROCÉDURE EXÉCUTION TESTS

### Phase 1 - Tests unitaires (dev local)

1. Environnement : Dev container Supabase local
2. Données : Jeu de données test (10 locataires, 5 régies, 20 entreprises)
3. Ordre : Catégories A → B → C → D → F → G
4. Durée estimée : 2h

### Phase 2 - Tests rollback (dev local)

1. Appliquer migrations M01-M07
2. Exécuter tests catégorie E
3. Valider retour état initial
4. Durée estimée : 1h

### Phase 3 - Tests staging (preview Vercel)

1. Déployer sur environnement staging
2. Données : Clone anonymisé prod
3. Exécuter tests P0 + P1
4. Durée estimée : 1h

### Phase 4 - Tests prod (post-déploiement)

1. Déployer migrations
2. Exécuter scénarios validation (S1, S2)
3. Monitoring logs 24h
4. Durée : 24h surveillance

---

## 🚨 CRITÈRES BLOCAGE DÉPLOIEMENT

Le déploiement est **BLOQUÉ** si :

❌ Au moins 1 test P0 échoue
❌ Tests RLS (D01-D06) ne passent pas tous
❌ Rollback M06 ou M07 échoue
❌ Performance vue > 1s sur 1000 tickets
❌ Erreur SQL dans logs après 5 min d'utilisation

---

**FIN DU PLAN DE TESTS**

**Prochaine étape (APRÈS VALIDATION)** : [SAFE_APPLY_PROCEDURE.md](SAFE_APPLY_PROCEDURE.md)
