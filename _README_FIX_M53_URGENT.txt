================================================================================
🚨 FIX CRITIQUE - ASSIGNATION TECHNICIEN BLOQUÉE EN PROD
================================================================================

BUG: column "user_id" does not exist
SOURCE: Fonction trigger notify_technicien_assignment
ACTION: Appliquer M53 IMMÉDIATEMENT

================================================================================
🎯 LE PROBLÈME (DIAGNOSTIC FINAL)
================================================================================

L'erreur ne vient PAS de la RPC assign_technicien_to_mission.

Elle vient du TRIGGER qui se déclenche automatiquement lors de l'UPDATE
de missions.technicien_id.

FONCTION BUGUÉE: public.notify_technicien_assignment

BUGS:
  1. Utilise techniciens.user_id (n'existe pas, c'est profile_id)
  2. Utilise missions.reference (n'existe pas, doit récupérer tickets.reference)

TRIGGERS IMPACTÉS:
  - technicien_assignment_notification (sur missions)
  - trigger_mission_technicien_assignment (sur missions)

================================================================================
✅ LA SOLUTION (30 SECONDES)
================================================================================

FICHIER À APPLIQUER:
📄 supabase/migrations/_APPLY_M53_PROD_URGENT.sql

INSTRUCTIONS:
1. Ouvrir: https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql
2. Copier le contenu de _APPLY_M53_PROD_URGENT.sql
3. Coller dans l'éditeur SQL
4. Cliquer "RUN"
5. ✅ Voir "Success"

================================================================================
🧪 TEST APRÈS APPLICATION
================================================================================

1. Se connecter en tant qu'entreprise
2. Assigner un technicien à une mission
3. ✅ DOIT RÉUSSIR sans erreur "user_id"

================================================================================
📁 FICHIERS
================================================================================

CRITIQUE (À APPLIQUER):
✅ _APPLY_M53_PROD_URGENT.sql          (version simplifiée pour PROD)
✅ 20260108000100_m53_fix_notify_technicien_assignment.sql  (migration complète)

OPTIONNEL (M52 - RPC):
⚪ _APPLY_M52_MANUAL.sql                (si vous voulez aussi corriger la RPC)

DOCUMENTATION:
📖 _FIX_URGENT_M53_PROD.txt            (guide complet)
📖 _RESOLUTION_BUG_USER_ID.md          (documentation technique)

SCRIPTS:
🔧 _check_m48_prod.js                  (vérifier si M48 déjà appliquée)

================================================================================
⚠️ IMPORTANT
================================================================================

M53 corrige le TRIGGER (critique)
M52 corrige la RPC (optionnel)

Appliquer M53 EN PREMIER pour débloquer l'assignation.
M52 peut être appliquée après (ou pas si M48 déjà en PROD).

================================================================================
✅ RÉSULTAT ATTENDU
================================================================================

AVANT M53:
Dashboard Entreprise > Assigner technicien
❌ Erreur: column "user_id" does not exist
❌ Workflow bloqué

APRÈS M53:
Dashboard Entreprise > Assigner technicien
✅ Assignation réussie
✅ Notification créée
✅ Workflow débloqué

================================================================================
📞 VÉRIFICATION
================================================================================

Si vous voulez vérifier que M48 n'est pas déjà appliquée:
node _check_m48_prod.js

Si M48 est déjà en PROD, la fonction devrait être correcte.
Sinon, appliquer M53 immédiatement.

================================================================================
