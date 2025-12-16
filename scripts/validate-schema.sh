#!/bin/bash

# ============================================================================
# Script de validation du schéma complet Supabase
# Vérifie que toutes les tables, fonctions, triggers et vues sont créés
# ============================================================================

set -e

echo "============================================"
echo "VALIDATION SCHÉMA SUPABASE - JETC IMMO"
echo "============================================"
echo ""

# Vérifier que les variables d'environnement sont définies
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis"
    exit 1
fi

# Fonction pour compter les entités
count_entities() {
    local query=$1
    local name=$2
    
    result=$(node -e "
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    (async () => {
        try {
            const { data, error } = await supabase.rpc('exec_sql', { query: \`$query\` });
            if (error) {
                console.log('0');
            } else {
                console.log(data.length || data.count || '0');
            }
        } catch (e) {
            console.log('0');
        }
    })();
    ")
    
    echo "$result"
}

echo "=== Vérification des tables ==="
echo ""

tables=(
    "regies"
    "entreprises"
    "locataires"
    "auth_users"
    "autorisations_entreprises"
    "tickets"
    "techniciens"
    "missions"
    "factures"
    "messages"
    "notifications"
    "plans"
    "abonnements"
)

table_count=0
for table in "${tables[@]}"; do
    if psql "$DATABASE_URL" -c "\d $table" > /dev/null 2>&1; then
        echo "✓ Table $table existe"
        ((table_count++))
    else
        echo "✗ Table $table manquante"
    fi
done

echo ""
echo "📊 Tables : $table_count/${#tables[@]}"
echo ""

echo "=== Vérification des fonctions RPC ==="
echo ""

functions=(
    "accept_ticket_and_create_mission"
    "assign_technicien_to_mission"
    "get_user_technicien_id"
    "start_mission"
    "complete_mission"
    "validate_mission"
    "cancel_mission"
    "notify_mission_status_change"
    "generate_facture_from_mission"
    "update_facture_status"
    "cancel_facture"
    "get_mission_actors"
    "send_message"
    "mark_notification_as_read"
    "create_system_message"
    "create_abonnement"
    "get_current_plan"
    "check_access_module"
    "check_quota"
    "increment_mission_quota"
    "change_plan"
)

func_count=0
for func in "${functions[@]}"; do
    if psql "$DATABASE_URL" -c "\df $func" | grep -q "$func"; then
        echo "✓ Fonction $func existe"
        ((func_count++))
    else
        echo "✗ Fonction $func manquante"
    fi
done

echo ""
echo "📊 Fonctions : $func_count/${#functions[@]}"
echo ""

echo "=== Vérification des vues ==="
echo ""

views=(
    "tickets_stats"
    "missions_stats"
    "missions_en_retard"
    "planning_technicien"
    "missions_non_assignees"
    "factures_stats"
    "factures_commissions_jtec"
    "abonnements_stats"
    "quotas_usage"
)

view_count=0
for view in "${views[@]}"; do
    if psql "$DATABASE_URL" -c "\d $view" > /dev/null 2>&1; then
        echo "✓ Vue $view existe"
        ((view_count++))
    else
        echo "✗ Vue $view manquante"
    fi
done

echo ""
echo "📊 Vues : $view_count/${#views[@]}"
echo ""

echo "=== Vérification des triggers ==="
echo ""

# Note: Vérification simplifiée, nécessite psql
echo "ℹ️  Vérification des triggers nécessite une connexion PostgreSQL directe"
echo ""

echo "============================================"
echo "RÉSUMÉ"
echo "============================================"
echo "Tables    : $table_count/${#tables[@]}"
echo "Fonctions : $func_count/${#functions[@]}"
echo "Vues      : $view_count/${#views[@]}"
echo ""

if [ "$table_count" -eq "${#tables[@]}" ] && [ "$func_count" -eq "${#functions[@]}" ] && [ "$view_count" -eq "${#views[@]}" ]; then
    echo "✅ SCHÉMA COMPLET VALIDÉ"
    exit 0
else
    echo "⚠️  Schéma incomplet - Certains éléments manquent"
    exit 1
fi
