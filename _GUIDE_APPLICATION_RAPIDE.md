# 🚀 GUIDE D'APPLICATION RAPIDE - GESTION TECHNICIENS

## ✅ CE QUI EST FAIT

- ✅ Audit complet Supabase
- ✅ Corrections APIs backend
- ✅ Interface frontend complète
- ✅ Documentation complète

## ⚠️ ACTION REQUISE AVANT PRODUCTION

### Étape unique : Appliquer les policies RLS

**Durée estimée :** 2 minutes

**Fichier à utiliser :** [`_APPLY_RLS_TECHNICIENS.sql`](file:///workspaces/JETC_IMMO_SaaS/_APPLY_RLS_TECHNICIENS.sql)

---

## 📋 PROCÉDURE D'APPLICATION

### 1️⃣ Se connecter à Supabase

1. Ouvrir https://supabase.com/dashboard
2. Sélectionner le projet `bwzyajsrmfhrxdmfpyqy`
3. Aller dans **SQL Editor** (menu gauche)

### 2️⃣ Appliquer le script SQL

1. Cliquer sur **New Query**
2. Copier le contenu complet du fichier `_APPLY_RLS_TECHNICIENS.sql`
3. Coller dans l'éditeur
4. Cliquer sur **Run** (ou Ctrl+Enter)

### 3️⃣ Vérifier l'application

Le script affiche automatiquement :
- ✅ Nombre de policies créées (11 attendues)
- ✅ Répartition par type (SELECT/INSERT/UPDATE/DELETE)
- ✅ Statut RLS activé

### 4️⃣ Tester l'isolation

**Test 1 : Entreprise ne voit que SES techniciens**

```sql
-- Se connecter avec un compte entreprise (via Dashboard)
-- Exécuter cette requête :
SELECT * FROM techniciens;
-- Résultat attendu : Uniquement les techniciens de l'entreprise connectée
```

**Test 2 : Accès direct refusé sans auth**

```sql
-- Se déconnecter (ou utiliser client REST sans token)
-- Tenter d'accéder :
SELECT * FROM techniciens;
-- Résultat attendu : 0 rows (accès refusé)
```

---

## 🧪 TESTS FONCTIONNELS POST-DÉPLOIEMENT

### Test 1 : Création technicien

1. Se connecter avec un compte entreprise
2. Aller sur `/entreprise/techniciens.html`
3. Cliquer "+ Créer un technicien"
4. Remplir :
   - Nom : Test
   - Prénom : Technicien
   - Email : test.tech@example.com
   - Téléphone : 0612345678
   - Spécialités : Plomberie, Électricité
5. Cliquer "Créer"
6. ✅ Vérifier : Message de succès + technicien dans la liste

### Test 2 : Isolation entreprises

1. Créer 2 comptes entreprise différents
2. Entreprise A : Créer un technicien "Tech A"
3. Entreprise B : Créer un technicien "Tech B"
4. Entreprise A : Vérifier qu'elle voit UNIQUEMENT "Tech A"
5. Entreprise B : Vérifier qu'elle voit UNIQUEMENT "Tech B"
6. ✅ Vérifier : Aucun cross-access

### Test 3 : Modification

1. Cliquer "Modifier" sur un technicien
2. Changer le téléphone
3. Enregistrer
4. ✅ Vérifier : Modification enregistrée

### Test 4 : Désactivation

1. Cliquer "Désactiver" sur un technicien actif
2. Confirmer
3. ✅ Vérifier : Badge passe à "Inactif"
4. Cliquer "Activer"
5. ✅ Vérifier : Badge repasse à "Actif"

### Test 5 : Suppression

1. Créer un technicien sans missions
2. Cliquer "Supprimer"
3. Confirmer
4. ✅ Vérifier : Technicien supprimé de la liste

### Test 6 : Blocage suppression avec missions

1. Assigner un technicien à une mission active
2. Tenter de supprimer ce technicien
3. ✅ Vérifier : Message d'erreur "missions actives assignées"

---

## 📊 VÉRIFICATION ÉTAT ACTUEL

### Backend APIs

| API | Statut | Corrections appliquées |
|-----|--------|------------------------|
| POST /api/techniciens/create | ✅ Prêt | Rôle, structure profile, structure technicien |
| GET /api/techniciens/list | ✅ Prêt | Rôle admin_entreprise |
| PATCH /api/techniciens/update | ✅ Prêt | Rôle, colonne actif |
| DELETE /api/techniciens/delete | ✅ Prêt | Rôle admin_entreprise |

### Frontend

| Page | Statut | Fonctionnalités |
|------|--------|-----------------|
| /entreprise/techniciens.html | ✅ Créée | CRUD complet, stats, liste |
| /entreprise/dashboard.html | ✅ Modifiée | Lien menu activé |

### Base de données

| Élément | Statut | Détails |
|---------|--------|---------|
| Table techniciens | ✅ Conforme | 11 colonnes, relations OK |
| RPC assign_technicien_to_mission | ✅ Existe | Fonctionnelle |
| RLS techniciens | ⚠️ **À APPLIQUER** | Script prêt |

---

## 🎯 CHECKLIST PRE-PRODUCTION

- [ ] Script RLS appliqué dans Supabase
- [ ] Tests d'isolation effectués et validés
- [ ] 2 entreprises de test créées
- [ ] Création technicien testée
- [ ] Modification technicien testée
- [ ] Désactivation/activation testées
- [ ] Suppression testée (sans missions)
- [ ] Blocage suppression testé (avec missions)
- [ ] Variables d'environnement vérifiées
- [ ] Logs backend vérifiés
- [ ] Performance liste techniciens vérifiée

---

## 📞 SUPPORT

### En cas de problème

**Problème 1 : RLS bloque tout**

```sql
-- Temporairement désactiver RLS
ALTER TABLE techniciens DISABLE ROW LEVEL SECURITY;

-- Vérifier les données
SELECT * FROM techniciens;

-- Vérifier les policies
SELECT * FROM pg_policies WHERE tablename = 'techniciens';

-- Réactiver RLS
ALTER TABLE techniciens ENABLE ROW LEVEL SECURITY;
```

**Problème 2 : API retourne 401/403**

- Vérifier que le token JWT est valide
- Vérifier que l'utilisateur a le rôle `admin_entreprise`
- Vérifier les logs backend

**Problème 3 : Liste techniciens vide**

- Vérifier que l'entreprise a bien des techniciens
- Vérifier le `entreprise_id` dans la table profiles
- Vérifier les RLS avec SERVICE_ROLE_KEY (bypass)

---

## 📚 DOCUMENTATION COMPLÈTE

- **Rapport d'audit :** [`_RAPPORT_AUDIT_COMPLET_TECHNICIENS.md`](file:///workspaces/JETC_IMMO_SaaS/_RAPPORT_AUDIT_COMPLET_TECHNICIENS.md)
- **Livrable final :** [`_LIVRABLE_GESTION_TECHNICIENS.md`](file:///workspaces/JETC_IMMO_SaaS/_LIVRABLE_GESTION_TECHNICIENS.md)
- **Script RLS :** [`_APPLY_RLS_TECHNICIENS.sql`](file:///workspaces/JETC_IMMO_SaaS/_APPLY_RLS_TECHNICIENS.sql)

---

**Dernière mise à jour :** 06/01/2026  
**Temps d'application estimé :** 10 minutes (incluant tests)

