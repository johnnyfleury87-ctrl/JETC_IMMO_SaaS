#!/bin/bash
# Application de la migration M50 - Workflow facturation complet

echo "🚀 Application migration M50 - Workflow facturation complet"
echo "============================================================"

# Charger les variables d'environnement
source .env.local

# Vérifier que DATABASE_URL existe
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERREUR: DATABASE_URL non définie"
  exit 1
fi

echo "✅ DATABASE_URL chargée"
echo ""

# Appliquer la migration via docker
echo "📥 Application de la migration..."
docker exec -i $(docker ps -q -f name=supabase-db) \
  psql "$DATABASE_URL" < supabase/migrations/20260107120000_m50_workflow_facturation_complet.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration M50 appliquée avec succès!"
  echo ""
  echo "🎯 Prochaines étapes :"
  echo "  1. Tester RPC : node _test_workflow_facturation.js"
  echo "  2. Adapter frontend pour afficher rapport + factures"
else
  echo ""
  echo "❌ Erreur lors de l'application de la migration"
  exit 1
fi
