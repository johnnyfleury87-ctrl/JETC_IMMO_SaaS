#!/bin/bash

echo "🔍 VÉRIFICATION COMPLÈTE ET CORRECTION DÉFINITIVE"
echo "============================================================"
echo ""

# 1. Vérifier que M46 est bien dans les migrations
echo "📋 1. VÉRIFICATION M46"
echo "------------------------------------------------------------"
if [ -f "supabase/migrations/20260106000300_m46_fix_user_id_policies.sql" ]; then
  echo "✅ M46 existe dans migrations/"
  echo "   Fichier: supabase/migrations/20260106000300_m46_fix_user_id_policies.sql"
else
  echo "❌ M46 MANQUANT dans migrations/"
fi
echo ""

# 2. Vérifier que M51 est bien dans les migrations
echo "📋 2. VÉRIFICATION M51"
echo "------------------------------------------------------------"
if [ -f "supabase/migrations/20260107000100_m51_create_assign_technicien_rpc.sql" ]; then
  echo "✅ M51 existe dans migrations/"
  echo "   Fichier: supabase/migrations/20260107000100_m51_create_assign_technicien_rpc.sql"
  
  # Vérifier qu'il n'y a plus 'planifiee'
  if grep -q "planifiee" supabase/migrations/20260107000100_m51_create_assign_technicien_rpc.sql; then
    echo "❌ M51 contient encore 'planifiee' !"
    grep -n "planifiee" supabase/migrations/20260107000100_m51_create_assign_technicien_rpc.sql
  else
    echo "✅ M51 ne contient plus 'planifiee'"
  fi
else
  echo "❌ M51 MANQUANT dans migrations/"
fi
echo ""

# 3. Vérifier le code frontend
echo "📋 3. VÉRIFICATION CODE FRONTEND"
echo "------------------------------------------------------------"
if grep -q "planifiee" public/entreprise/dashboard.html; then
  echo "❌ dashboard.html contient 'planifiee' !"
  grep -n "planifiee" public/entreprise/dashboard.html | head -5
else
  echo "✅ dashboard.html ne contient pas 'planifiee'"
fi

if grep -q "assign_technicien_to_mission" public/entreprise/dashboard.html; then
  echo "✅ dashboard.html appelle bien assign_technicien_to_mission"
else
  echo "❌ dashboard.html n'appelle PAS assign_technicien_to_mission !"
fi
echo ""

# 4. Test base de données
echo "📋 4. TEST BASE DE DONNÉES"
echo "------------------------------------------------------------"
echo "Lancement test Node.js..."
node _verif_structure_db.js 2>&1 | grep -E "(ERREUR|PROBLÈME|user_id|CORRECT)" || echo "Test exécuté"
echo ""

# 5. Instructions finales
echo "============================================================"
echo "📝 INSTRUCTIONS POUR APPLIQUER LES MIGRATIONS"
echo "============================================================"
echo ""
echo "Si tu vois l'erreur dans le navigateur, voici les étapes:"
echo ""
echo "1️⃣ VIDER LE CACHE DU NAVIGATEUR:"
echo "   Chrome/Edge: Ctrl+Shift+Delete → Cocher 'Cached images and files' → Clear"
echo "   Firefox: Ctrl+Shift+Delete → Cocher 'Cache' → Clear"
echo "   Safari: Cmd+Option+E"
echo ""
echo "2️⃣ RECHARGER LA PAGE:"
echo "   Appuyer sur Ctrl+F5 (force reload sans cache)"
echo ""
echo "3️⃣ SI L'ERREUR PERSISTE, APPLIQUER M46 VIA SUPABASE DASHBOARD:"
echo "   a. Ouvrir: https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql"
echo "   b. Copier TOUT le contenu de:"
echo "      supabase/migrations/20260106000300_m46_fix_user_id_policies.sql"
echo "   c. Coller dans SQL Editor"
echo "   d. Cliquer 'Run'"
echo "   e. Vérifier message: '✅ M46: Migration réussie'"
echo ""
echo "4️⃣ APPLIQUER M51 VIA SUPABASE DASHBOARD:"
echo "   a. Même URL que ci-dessus"
echo "   b. Copier contenu de:"
echo "      supabase/migrations/20260107000100_m51_create_assign_technicien_rpc.sql"
echo "   c. Coller et Run"
echo "   d. Vérifier fonction créée"
echo ""
echo "5️⃣ TESTER À NOUVEAU L'ASSIGNATION"
echo ""
echo "============================================================"
