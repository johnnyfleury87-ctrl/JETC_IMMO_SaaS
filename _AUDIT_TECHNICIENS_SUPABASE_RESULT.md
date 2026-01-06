# 🔍 AUDIT SUPABASE - GESTION TECHNICIENS

**Date :** 06/01/2026 05:45:59
**Connexion :** ✅ connecté
**URL :** https://bwzyajsrmfhrxdmfpyqy.supabase.co

---

## 📊 RÉSUMÉ EXÉCUTIF

| Statut | Nombre |
|--------|--------|
| ✅ Conforme | 6 |
| ⚠️ Partiel | 0 |
| ❌ Manquant | 0 |

### ⚠️ Avertissements

- Table techniciens vide - relations non vérifiables

### 🎯 Statut global : ✅ **CONFORME** - Base de données prête pour implémentation

---

## 📋 TABLES

### ✅ conforme Table `entreprises`

**Colonnes détectées :**

- `id`
- `nom`
- `siret`
- `adresse`
- `code_postal`
- `ville`
- `telephone`
- `email`
- `specialites`
- `profile_id`
- `description`
- `site_web`
- `created_at`
- `updated_at`
- `signature_url`

<details>
<summary>Exemple de données</summary>

```json
{
  "id": "6ff210bc-9985-457c-8851-4185123edb07",
  "nom": "Perreti SA",
  "siret": null,
  "adresse": "Rue de l'impasse 4",
  "code_postal": "1004",
  "ville": "Lausanne",
  "telephone": "021 123 45 67",
  "email": "entreprise@test.app",
  "specialites": null,
  "profile_id": "97fb88cc-cefa-4f65-86af-27e3858eabb9",
  "description": "serrurie",
  "site_web": null,
  "created_at": "2026-01-04T04:15:13.124272+00:00",
  "updated_at": "2026-01-04T04:15:13.124272+00:00",
  "signature_url": null
}
```
</details>

### ✅ conforme Table `techniciens`

### ✅ conforme Table `profiles`

**Colonnes détectées :**

- `id`
- `email`
- `role`
- `language`
- `is_demo`
- `regie_id`
- `entreprise_id`
- `logement_id`
- `created_at`
- `updated_at`

<details>
<summary>Exemple de données</summary>

```json
{
  "id": "14c2c351-e015-46ae-95ff-bbfcd975f8e2",
  "email": "johnny.fleury87@gmail.com",
  "role": "admin_jtec",
  "language": "fr",
  "is_demo": false,
  "regie_id": null,
  "entreprise_id": null,
  "logement_id": null,
  "created_at": "2025-12-18T13:06:45.420068+00:00",
  "updated_at": "2025-12-18T13:06:45.420068+00:00"
}
```
</details>

### ✅ conforme Table `missions`

**Colonnes détectées :**

- `id`
- `ticket_id`
- `entreprise_id`
- `technicien_id`
- `date_intervention_prevue`
- `date_intervention_realisee`
- `statut`
- `created_at`
- `started_at`
- `completed_at`
- `validated_at`
- `notes`
- `devis_url`
- `facture_url`
- `montant_reel_chf`
- `updated_at`
- `rapport_url`
- `signature_locataire_url`
- `signature_technicien_url`
- `devise`
- `disponibilite_id`
- `locataire_absent`
- `absence_signalement_at`
- `absence_raison`
- `photos_urls`

<details>
<summary>Exemple de données</summary>

```json
{
  "id": "2d84c11c-6415-4f49-ba33-8b53ae1ee22d",
  "ticket_id": "2106c14a-c755-4eb1-b440-c5fd3043ab88",
  "entreprise_id": "6ff210bc-9985-457c-8851-4185123edb07",
  "technicien_id": null,
  "date_intervention_prevue": null,
  "date_intervention_realisee": null,
  "statut": "en_attente",
  "created_at": "2026-01-04T17:03:22.442838+00:00",
  "started_at": null,
  "completed_at": null,
  "validated_at": null,
  "notes": null,
  "devis_url": null,
  "facture_url": null,
  "montant_reel_chf": null,
  "updated_at": "2026-01-04T17:03:22.442838+00:00",
  "rapport_url": null,
  "signature_locataire_url": null,
  "signature_technicien_url": null,
  "devise": "CHF",
  "disponibilite_id": "a6856871-f466-41be-8593-9b2d77e62829",
  "locataire_absent": false,
  "absence_signalement_at": null,
  "absence_raison": null,
  "photos_urls": []
}
```
</details>

### ✅ conforme Table `tickets`

**Colonnes détectées :**

- `id`
- `titre`
- `description`
- `categorie`
- `priorite`
- `statut`
- `logement_id`
- `locataire_id`
- `regie_id`
- `entreprise_id`
- `technicien_id`
- `date_creation`
- `date_cloture`
- `date_limite`
- `photos`
- `urgence`
- `created_at`
- `updated_at`
- `locked_at`
- `plafond_intervention_chf`
- `devise`
- `mode_diffusion`
- `sous_categorie`
- `piece`
- `plafond_valide_par`
- `plafond_valide_at`
- `diffuse_par`
- `diffuse_at`

<details>
<summary>Exemple de données</summary>

```json
{
  "id": "2106c14a-c755-4eb1-b440-c5fd3043ab88",
  "titre": "Plomberie // Fuite d'eau",
  "description": "bonjour",
  "categorie": "plomberie",
  "priorite": "normale",
  "statut": "en_cours",
  "logement_id": "9111bff3-015b-4c35-a72a-47b8b0e03b37",
  "locataire_id": "8ae4ab22-47a4-475b-98af-eed18513b45d",
  "regie_id": "ec0ad50b-7b27-45b3-aa6c-ab31d061e38f",
  "entreprise_id": "6ff210bc-9985-457c-8851-4185123edb07",
  "technicien_id": null,
  "date_creation": "2025-12-26T13:21:34.136501+00:00",
  "date_cloture": null,
  "date_limite": null,
  "photos": null,
  "urgence": false,
  "created_at": "2025-12-26T13:21:34.136501+00:00",
  "updated_at": "2026-01-04T17:03:22.442838+00:00",
  "locked_at": "2026-01-04T17:03:22.442838+00:00",
  "plafond_intervention_chf": 800,
  "devise": "CHF",
  "mode_diffusion": "general",
  "sous_categorie": "Fuite d'eau",
  "piece": "cuisine",
  "plafond_valide_par": "098c6bee-c00d-4127-9a2d-f66415300826",
  "plafond_valide_at": "2026-01-04T13:00:48.245278+00:00",
  "diffuse_par": "098c6bee-c00d-4127-9a2d-f66415300826",
  "diffuse_at": "2026-01-04T13:00:48.245278+00:00"
}
```
</details>

---

## 🔗 RELATIONS DÉTECTÉES

### ⚠️ partiel techniciens_relations


**Note :** Aucune donnée pour vérifier

### ✅ conforme missions_relations

- `technicien_id` : ✅ présent

---

## 💡 RECOMMANDATIONS

✅ **Aucune action requise** - La base de données est prête pour l'implémentation de la gestion des techniciens.

**Prochaines étapes :**
1. Implémenter les APIs backend pour la gestion CRUD des techniciens
2. Créer l'interface frontend pour les entreprises
3. Tester les assignations de techniciens aux missions
4. Valider les règles métier et la sécurité RLS

---

*Rapport généré automatiquement le 06/01/2026 05:46:02*