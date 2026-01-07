#!/bin/bash
# =====================================================
# APPLICATION M46 + M51 : Fix assignation technicien
# =====================================================

echo "🚀 Application des migrations pour fix assignation technicien"
echo ""

# Vérifier que .env.local existe
if [ ! -f ".env.local" ]; then
  echo "❌ Erreur: .env.local introuvable"
  exit 1
fi

# Charger les variables
source .env.local

SUPABASE_URL="${SUPABASE_URL:-$NEXT_PUBLIC_SUPABASE_URL}"
SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "❌ Erreur: Variables SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquantes"
  exit 1
fi

echo "✅ Configuration Supabase chargée"
echo ""

# Function pour exécuter SQL
apply_migration() {
  local FILE=$1
  local NAME=$2
  
  echo "📋 Application: $NAME"
  echo "   Fichier: $FILE"
  
  if [ ! -f "$FILE" ]; then
    echo "   ⚠️  Fichier introuvable, skip"
    return
  fi
  
  # Exécuter via curl (REST API Supabase)
  RESPONSE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"query\": $(cat "$FILE" | jq -Rs .)}")
  
  # Vérifier si erreur
  if echo "$RESPONSE" | grep -q "error"; then
    echo "   ❌ Erreur lors de l'application"
    echo "$RESPONSE" | jq .
    return 1
  else
    echo "   ✅ Appliquée avec succès"
  fi
}

echo "=================================================="
echo "MIGRATION M46: Fix policies RLS user_id"
echo "=================================================="
apply_migration "supabase/migrations/20260106000300_m46_fix_user_id_policies.sql" "M46"
echo ""

echo "=================================================="
echo "MIGRATION M51: Créer RPC assign_technicien_to_mission"
echo "=================================================="
apply_migration "supabase/migrations/20260107000100_m51_create_assign_technicien_rpc.sql" "M51"
echo ""

echo "=================================================="
echo "✅ MIGRATIONS TERMINÉES"
echo "=================================================="
echo ""
echo "🧪 Tests à effectuer :"
echo "   1. Dashboard Entreprise → Mes missions"
echo "   2. Cliquer 'Assigner technicien' sur une mission"
echo "   3. Vérifier que la liste des techniciens s'affiche"
echo "   4. Sélectionner un technicien et valider"
echo "   5. Vérifier succès (pas d'erreur user_id)"
echo ""
echo "   6. Cliquer 'Détails' sur une mission"
echo "   7. Vérifier que la modal s'ouvre"
echo "   8. Tester fermeture : X / Click outside / ESC"
echo ""
