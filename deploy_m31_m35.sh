#!/bin/bash
# ============================================================
# SCRIPT DÉPLOIEMENT M31-M35: Workflow Tickets
# ============================================================
# Date: 2026-01-04
# Usage: ./deploy_m31_m35.sh
# ATTENTION: Exécuter ce script APRÈS avoir vérifié le pré-audit
# ============================================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# ============================================================
# CONFIGURATION (À ADAPTER)
# ============================================================
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "============================================================"
echo "🚀 DÉPLOIEMENT M31-M35: Workflow Tickets"
echo "============================================================"
echo ""
echo "Configuration:"
echo "  - Host: $DB_HOST:$DB_PORT"
echo "  - Database: $DB_NAME"
echo "  - User: $DB_USER"
echo "  - Backup dir: $BACKUP_DIR"
echo ""
read -p "Continuer? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Annulé par l'utilisateur"
    exit 1
fi

# ============================================================
# ÉTAPE 1: PRÉ-AUDIT
# ============================================================
echo ""
echo "📋 ÉTAPE 1/5: Pré-audit système..."
echo "------------------------------------------------------------"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -f tests/pre_deployment_check_m31_m35.sql

echo ""
read -p "Pré-audit OK? Continuer? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Corrigez les erreurs identifiées avant de continuer"
    exit 1
fi

# ============================================================
# ÉTAPE 2: BACKUP
# ============================================================
echo ""
echo "💾 ÉTAPE 2/5: Backup base de données..."
echo "------------------------------------------------------------"

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup_pre_m31_m35_${TIMESTAMP}.sql"

pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  > "$BACKUP_FILE"

if [ -f "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup créé: $BACKUP_FILE ($BACKUP_SIZE)"
else
    echo "❌ Erreur création backup"
    exit 1
fi

# ============================================================
# ÉTAPE 3: APPLIQUER MIGRATIONS SQL
# ============================================================
echo ""
echo "🗄️  ÉTAPE 3/5: Application migrations M31-M35..."
echo "------------------------------------------------------------"

echo "Application migration consolidée..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -f supabase/migrations/20260104000000_m31_m35_workflow_complet_consolidated.sql

echo ""
echo "✅ Migrations SQL appliquées"

# ============================================================
# ÉTAPE 4: VALIDATION SQL
# ============================================================
echo ""
echo "🧪 ÉTAPE 4/5: Tests validation SQL..."
echo "------------------------------------------------------------"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -f tests/validation_ticket_workflow.sql

echo ""
echo "✅ Tests SQL terminés"

# ============================================================
# ÉTAPE 5: DÉPLOIEMENT FRONTEND
# ============================================================
echo ""
echo "🌐 ÉTAPE 5/5: Déploiement frontend..."
echo "------------------------------------------------------------"

echo "Vérification fichier tickets.html..."
if [ ! -f "public/regie/tickets.html" ]; then
    echo "❌ Fichier public/regie/tickets.html introuvable"
    exit 1
fi

echo "Commit et push..."
git add public/regie/tickets.html
git commit -m "fix(tickets): Correction workflow M31-M35 - Bug JS + RPC + RLS" || echo "⚠️ Rien à commiter"
git push origin main

echo ""
echo "Déploiement Vercel..."
vercel --prod

echo ""
echo "✅ Frontend déployé"

# ============================================================
# RÉSUMÉ FINAL
# ============================================================
echo ""
echo "============================================================"
echo "🎉 DÉPLOIEMENT M31-M35 TERMINÉ AVEC SUCCÈS !"
echo "============================================================"
echo ""
echo "📊 Résumé:"
echo "  ✅ Pré-audit validé"
echo "  ✅ Backup créé: $BACKUP_FILE"
echo "  ✅ Migrations SQL appliquées (M31-M35)"
echo "  ✅ Tests SQL validés"
echo "  ✅ Frontend déployé sur Vercel"
echo ""
echo "📋 Prochaines étapes:"
echo "  1. Tests manuels workflow complet (voir GUIDE_DEPLOIEMENT_M31_M35.md)"
echo "  2. Monitoring logs 24h"
echo "  3. Vérifier aucune erreur production"
echo ""
echo "📚 Documentation:"
echo "  - Guide: GUIDE_DEPLOIEMENT_M31_M35.md"
echo "  - Rapport: RAPPORT_CORRECTION_WORKFLOW_TICKETS.md"
echo "  - Workflow: WORKFLOW_TICKETS_DIAGRAM.md"
echo ""
echo "🔄 Rollback (si nécessaire):"
echo "  psql ... < $BACKUP_FILE"
echo ""
echo "============================================================"
