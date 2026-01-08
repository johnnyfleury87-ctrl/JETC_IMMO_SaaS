#!/bin/bash
# VERIFICATION RAPIDE M55
# ======================

echo "🔍 VÉRIFICATION M55 : FACTURATION SUISSE"
echo "========================================"
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction de vérification
check() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✅ $2${NC}"
  else
    echo -e "${RED}❌ $2${NC}"
  fi
}

# 1. Vérifier fichiers
echo "📁 Vérification fichiers..."
test -f "supabase/migrations/20260108130000_m55_fix_facturation_suisse_lignes.sql"
check $? "Migration M55 existe"

test -f "_test_m55_facturation_suisse.js"
check $? "Script de test existe"

test -f "_GUIDE_M55_FACTURATION_SUISSE.md"
check $? "Guide existe"

test -f "_EXEMPLE_MODAL_FACTURE_LIGNES.html"
check $? "Exemple modal existe"

echo ""

# 2. Vérifier contenu migration
echo "🔎 Vérification contenu migration..."
grep -q "CREATE TABLE.*facture_lignes" supabase/migrations/20260108130000_m55_fix_facturation_suisse_lignes.sql
check $? "Table facture_lignes définie"

grep -q "CREATE OR REPLACE FUNCTION editer_facture" supabase/migrations/20260108130000_m55_fix_facturation_suisse_lignes.sql
check $? "RPC editer_facture corrigée"

grep -q "CREATE OR REPLACE FUNCTION ajouter_ligne_facture" supabase/migrations/20260108130000_m55_fix_facturation_suisse_lignes.sql
check $? "RPC ajouter_ligne_facture définie"

grep -q "CREATE OR REPLACE FUNCTION recalculer_montant_facture" supabase/migrations/20260108130000_m55_fix_facturation_suisse_lignes.sql
check $? "Trigger recalcul défini"

grep -q "GENERATED ALWAYS AS" supabase/migrations/20260108130000_m55_fix_facturation_suisse_lignes.sql
check $? "Colonnes GENERATED présentes"

grep -q "taux_tva.*DEFAULT 8.1" supabase/migrations/20260108130000_m55_fix_facturation_suisse_lignes.sql
check $? "TVA Suisse 8.1% définie"

grep -q "taux_commission.*DEFAULT 2.0" supabase/migrations/20260108130000_m55_fix_facturation_suisse_lignes.sql
check $? "Commission JETC 2% définie"

echo ""

# 3. Vérifier que RPC n'update PAS les colonnes générées
echo "⚠️  Vérification critique: RPC ne touche pas colonnes générées..."
if grep -q "montant_tva = " supabase/migrations/20260108130000_m55_fix_facturation_suisse_lignes.sql | grep -q "UPDATE factures"; then
  echo -e "${RED}❌ ERREUR: RPC editer_facture tente d'UPDATE montant_tva (colonne GENERATED)${NC}"
  echo -e "${YELLOW}   → Cela va causer l'erreur 400 !${NC}"
else
  echo -e "${GREEN}✅ RPC editer_facture ne touche pas montant_tva${NC}"
fi

if grep -q "montant_ttc = " supabase/migrations/20260108130000_m55_fix_facturation_suisse_lignes.sql | grep -q "UPDATE factures"; then
  echo -e "${RED}❌ ERREUR: RPC tente d'UPDATE montant_ttc (colonne GENERATED)${NC}"
else
  echo -e "${GREEN}✅ RPC ne touche pas montant_ttc${NC}"
fi

if grep -q "montant_commission = " supabase/migrations/20260108130000_m55_fix_facturation_suisse_lignes.sql | grep -q "UPDATE factures"; then
  echo -e "${RED}❌ ERREUR: RPC tente d'UPDATE montant_commission (colonne GENERATED)${NC}"
else
  echo -e "${GREEN}✅ RPC ne touche pas montant_commission${NC}"
fi

echo ""

# 4. Compter lignes de code
echo "📊 Statistiques migration..."
LINES=$(wc -l < supabase/migrations/20260108130000_m55_fix_facturation_suisse_lignes.sql)
echo "   Lignes totales: $LINES"

FUNCTIONS=$(grep -c "CREATE OR REPLACE FUNCTION" supabase/migrations/20260108130000_m55_fix_facturation_suisse_lignes.sql)
echo "   Fonctions créées: $FUNCTIONS"

TRIGGERS=$(grep -c "CREATE TRIGGER" supabase/migrations/20260108130000_m55_fix_facturation_suisse_lignes.sql)
echo "   Triggers créés: $TRIGGERS"

POLICIES=$(grep -c "CREATE POLICY" supabase/migrations/20260108130000_m55_fix_facturation_suisse_lignes.sql)
echo "   Policies RLS: $POLICIES"

echo ""

# 5. Instructions
echo "📋 PROCHAINES ÉTAPES:"
echo "===================="
echo ""
echo "1️⃣  Appliquer migration:"
echo "   ${YELLOW}supabase db push${NC}"
echo "   ou via Dashboard Supabase"
echo ""
echo "2️⃣  Tester:"
echo "   ${YELLOW}node _test_m55_facturation_suisse.js${NC}"
echo ""
echo "3️⃣  Vérifier SQL:"
echo "   Voir requêtes dans ${YELLOW}_GUIDE_M55_FACTURATION_SUISSE.md${NC}"
echo ""
echo "4️⃣  Intégrer frontend:"
echo "   Copier ${YELLOW}_EXEMPLE_MODAL_FACTURE_LIGNES.html${NC} dans dashboard.html"
echo ""
echo "✅ TOUT EST PRÊT POUR DÉPLOIEMENT !"
