#!/bin/bash

# Script pour appliquer migration SQL directement via psql ou curl
# Nécessite connexion directe à PostgreSQL

# Récupérer les variables depuis .env.local
source .env.local 2>/dev/null || source ../.env.local 2>/dev/null || true

MIGRATION_FILE="./supabase/migrations/20260108000000_rpc_get_table_structure.sql"

echo "═══════════════════════════════════════════════════"
echo "  APPLICATION MIGRATION SQL DIRECTE"
echo "═══════════════════════════════════════════════════"
echo ""

if [[ ! -f "$MIGRATION_FILE" ]]; then
  echo "❌ Fichier migration introuvable: $MIGRATION_FILE"
  exit 1
fi

echo "📄 Migration à appliquer:"
echo "   $MIGRATION_FILE"
echo ""

# Solution 1 : via curl vers l'API de Supabase (POST query)
echo "Tentative via API REST de Supabase..."

SQL_CONTENT=$(cat "$MIGRATION_FILE")

# Échapper le JSON
SQL_JSON=$(jq -n --arg sql "$SQL_CONTENT" '{query: $sql}')

RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/query" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  --data "$SQL_JSON")

if echo "$RESPONSE" | grep -q '"code"'; then
  echo "❌ Échec API REST"
  echo "$RESPONSE"
  echo ""
  echo "⚠️ APPLICATION MANUELLE REQUISE:"
  echo ""
  echo "1. Ouvrir: https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/editor"
  echo "2. Cliquer sur 'SQL Editor'"
  echo "3. Copier-coller le contenu ci-dessous:"
  echo ""
  echo "─────────────────────────────────────────────────"
  cat "$MIGRATION_FILE"
  echo "─────────────────────────────────────────────────"
  echo ""
  echo "4. Cliquer 'Run'"
  echo ""
  exit 1
else
  echo "✅ Migration appliquée avec succès"
  echo ""
  exit 0
fi
