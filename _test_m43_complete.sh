#!/bin/bash

# ======================================================
# SCRIPT TEST M43 - VÉRIFICATION COMPLÈTE
# ======================================================
# Teste toutes les fonctionnalités M43 après application
# Usage: bash _test_m43_complete.sh
# ======================================================

set -e  # Arrêter en cas d'erreur

echo "🧪 DÉBUT TESTS M43"
echo "=================="
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ======================================================
# 1. VÉRIFICATION STRUCTURE BASE DE DONNÉES
# ======================================================

echo "📋 1. VÉRIFICATION STRUCTURE"
echo "----------------------------"

node _check_m43.js

echo ""

# ======================================================
# 2. TEST FONCTIONS RPC (via psql si disponible)
# ======================================================

echo "📋 2. TEST FONCTIONS RPC"
echo "------------------------"

# Vérifier si psql est disponible
if command -v psql &> /dev/null; then
    echo "✅ psql disponible"
    
    # Test 1 : Vérifier existence fonction signaler_absence_locataire
    echo "Test: signaler_absence_locataire existe ?"
    psql "$DATABASE_URL" -c "\df signaler_absence_locataire" | grep -q "signaler_absence_locataire" && \
        echo -e "${GREEN}✅ signaler_absence_locataire trouvée${NC}" || \
        echo -e "${RED}❌ signaler_absence_locataire MANQUANTE${NC}"
    
    # Test 2 : Vérifier fonction ajouter_photos_mission
    echo "Test: ajouter_photos_mission existe ?"
    psql "$DATABASE_URL" -c "\df ajouter_photos_mission" | grep -q "ajouter_photos_mission" && \
        echo -e "${GREEN}✅ ajouter_photos_mission trouvée${NC}" || \
        echo -e "${RED}❌ ajouter_photos_mission MANQUANTE${NC}"
    
else
    echo -e "${YELLOW}⚠️  psql non disponible, tests RPC ignorés${NC}"
fi

echo ""

# ======================================================
# 3. TEST API BACKEND (si serveur lancé)
# ======================================================

echo "📋 3. TEST API BACKEND"
echo "----------------------"

# Tester API config
echo "Test: GET /api/config"
if curl -s http://localhost:3000/api/config > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API /api/config accessible${NC}"
    curl -s http://localhost:3000/api/config | jq '.' 2>/dev/null || echo "(Réponse brute non JSON)"
else
    echo -e "${YELLOW}⚠️  Serveur non lancé ou API inaccessible${NC}"
    echo "   Démarrer avec: npm run dev"
fi

echo ""

# ======================================================
# 4. VÉRIFICATION VUES SQL
# ======================================================

echo "📋 4. VÉRIFICATION VUES"
echo "-----------------------"

if command -v psql &> /dev/null; then
    echo "Test: Vues M43 créées ?"
    
    VUES=$(psql "$DATABASE_URL" -t -c "
        SELECT table_name 
        FROM information_schema.views 
        WHERE table_schema = 'public' 
          AND table_name LIKE 'mission_%'
        ORDER BY table_name;
    ")
    
    if [ -n "$VUES" ]; then
        echo -e "${GREEN}✅ Vues trouvées :${NC}"
        echo "$VUES" | sed 's/^/   - /'
    else
        echo -e "${RED}❌ Aucune vue mission_* trouvée${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  psql non disponible, tests vues ignorés${NC}"
fi

echo ""

# ======================================================
# 5. VÉRIFICATION TRIGGERS
# ======================================================

echo "📋 5. VÉRIFICATION TRIGGERS"
echo "---------------------------"

if command -v psql &> /dev/null; then
    echo "Test: Triggers M43 créés ?"
    
    TRIGGERS=$(psql "$DATABASE_URL" -t -c "
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE trigger_schema = 'public' 
          AND event_object_table = 'missions'
        ORDER BY trigger_name;
    ")
    
    if echo "$TRIGGERS" | grep -q "mission_statut_change_log"; then
        echo -e "${GREEN}✅ Trigger mission_statut_change_log trouvé${NC}"
    else
        echo -e "${RED}❌ Trigger mission_statut_change_log MANQUANT${NC}"
    fi
    
    if echo "$TRIGGERS" | grep -q "mission_creation_log"; then
        echo -e "${GREEN}✅ Trigger mission_creation_log trouvé${NC}"
    else
        echo -e "${RED}❌ Trigger mission_creation_log MANQUANT${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  psql non disponible, tests triggers ignorés${NC}"
fi

echo ""

# ======================================================
# 6. RÉSUMÉ FINAL
# ======================================================

echo "📊 RÉSUMÉ"
echo "========="
echo ""
echo "✅ Éléments vérifiés :"
echo "   - Structure base de données (colonnes, tables)"
echo "   - Fonctions RPC (si psql disponible)"
echo "   - API Backend (si serveur lancé)"
echo "   - Vues SQL (si psql disponible)"
echo "   - Triggers (si psql disponible)"
echo ""
echo "⚠️  NOTES :"
echo "   - Si ❌ persistent, relancer: node _apply_m43.js"
echo "   - Puis copier SQL dans Supabase SQL Editor"
echo "   - Vérifier avec: node _check_m43.js"
echo ""
echo "🧪 FIN TESTS M43"
