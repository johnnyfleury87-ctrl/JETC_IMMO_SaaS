#!/bin/bash

# ============================================================
# Script d'analyse Git - Identifier quand l'assignation a cassé
# ============================================================

echo "🔍 ANALYSE GIT - ASSIGNATION TECHNICIEN"
echo "========================================"
echo ""

# Fonction pour tester un commit
test_commit() {
  local commit=$1
  local date=$2
  local message=$3
  
  echo "📌 Commit: $commit"
  echo "   Date: $date"
  echo "   Message: $message"
  
  # Vérifier si la RPC existe dans ce commit
  git show "$commit:supabase/migrations/20260108000000_m52_fix_assign_technicien_notifications.sql" > /dev/null 2>&1
  local m52_exists=$?
  
  git show "$commit:supabase/migrations/20260107000100_m51_create_assign_technicien_rpc.sql" > /dev/null 2>&1
  local m51_exists=$?
  
  if [ $m52_exists -eq 0 ]; then
    echo "   ✅ M52 (assign_technicien_to_mission corrigée) présente"
  elif [ $m51_exists -eq 0 ]; then
    echo "   ⚠️  M51 (assign_technicien_to_mission buguée) présente"
  else
    echo "   ❌ Aucune migration assign_technicien trouvée"
  fi
  
  echo ""
}

echo "🎯 COMMITS CLÉS LIÉS À L'ASSIGNATION"
echo "========================================"
echo ""

# Récupérer les commits liés à assign/technicien
git log --all --oneline --grep="assign" --grep="technicien" -i --since="2 months ago" | while read -r line; do
  commit=$(echo "$line" | awk '{print $1}')
  message=$(echo "$line" | cut -d' ' -f2-)
  date=$(git show -s --format=%ci "$commit" | cut -d' ' -f1)
  
  test_commit "$commit" "$date" "$message"
done

echo ""
echo "🔍 ANALYSE DES FICHIERS CRITIQUES"
echo "========================================"
echo ""

# 1. Dashboard entreprise
echo "1️⃣  Dashboard Entreprise (frontend)"
echo "   Fichier: public/entreprise/dashboard.html"
echo ""

# Trouver quand l'appel RPC a été modifié
echo "   Historique des modifications de l'appel RPC:"
git log --all --oneline -p -- "public/entreprise/dashboard.html" | grep -A5 -B5 "assign_technicien_to_mission" | head -30

echo ""
echo ""

# 2. Migrations SQL
echo "2️⃣  Migrations SQL"
echo ""

echo "   M51 - Création initiale (BUGUÉE):"
if [ -f "supabase/migrations/20260107000100_m51_create_assign_technicien_rpc.sql" ]; then
  echo "   ✅ Présente"
  echo "   Commit:"
  git log --oneline -1 -- "supabase/migrations/20260107000100_m51_create_assign_technicien_rpc.sql"
else
  echo "   ❌ Absente"
fi

echo ""

echo "   M52 - Correction notifications:"
if [ -f "supabase/migrations/20260108000000_m52_fix_assign_technicien_notifications.sql" ]; then
  echo "   ✅ Présente"
  echo "   Commit:"
  git log --oneline -1 -- "supabase/migrations/20260108000000_m52_fix_assign_technicien_notifications.sql"
else
  echo "   ❌ Absente"
fi

echo ""

echo "   M53 - Correction trigger:"
if [ -f "supabase/migrations/20260108000100_m53_fix_notify_technicien_assignment.sql" ]; then
  echo "   ✅ Présente"
  echo "   Commit:"
  git log --oneline -1 -- "supabase/migrations/20260108000100_m53_fix_notify_technicien_assignment.sql"
else
  echo "   ❌ Absente"
fi

echo ""
echo ""

echo "🎯 DERNIER COMMIT OÙ ÇA FONCTIONNAIT"
echo "========================================"
echo ""

# Chercher le commit du fix "502cb34" mentionné dans les logs
echo "Commit identifié: 502cb34"
echo "Message: fix: Corriger bugs assignation technicien + modal détails"
echo ""

if git rev-parse 502cb34 > /dev/null 2>&1; then
  echo "✅ Commit trouvé"
  echo ""
  echo "Détails:"
  git show 502cb34 --stat
  echo ""
  echo "Fichiers modifiés:"
  git show 502cb34 --name-only
else
  echo "⚠️  Commit 502cb34 non trouvé dans ce repo"
fi

echo ""
echo ""

echo "📊 RÉSUMÉ"
echo "========================================"
echo ""
echo "État actuel du repository:"
echo ""

# Vérifier présence des fichiers clés
files=(
  "public/entreprise/dashboard.html"
  "supabase/migrations/20260107000100_m51_create_assign_technicien_rpc.sql"
  "supabase/migrations/20260108000000_m52_fix_assign_technicien_notifications.sql"
  "supabase/migrations/20260108000100_m53_fix_notify_technicien_assignment.sql"
  "supabase/migrations/20260108120000_fix_assignation_prod_urgent.sql"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ $file"
  fi
done

echo ""
echo ""

echo "🚀 PROCHAINES ÉTAPES"
echo "========================================"
echo ""
echo "1. Vérifier quel état est actuellement en PROD:"
echo "   - Se connecter à Supabase SQL Editor"
echo "   - Exécuter: SELECT routine_name, routine_schema FROM information_schema.routines WHERE routine_name LIKE '%assign%technicien%';"
echo ""
echo "2. Si la RPC n'existe pas en PROD:"
echo "   - Appliquer: supabase/migrations/20260108120000_fix_assignation_prod_urgent.sql"
echo ""
echo "3. Tester depuis le dashboard entreprise"
echo ""
