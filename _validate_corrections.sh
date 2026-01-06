#!/bin/bash
# =====================================================
# SCRIPT DE VALIDATION DES CORRECTIONS
# =====================================================
# Vérifie que les corrections sont bien appliquées

echo "🔍 VALIDATION DES CORRECTIONS - GESTION TECHNICIENS"
echo "======================================================"
echo ""

# Vérifier que les fichiers modifiés existent
echo "1️⃣ Vérification des fichiers modifiés..."
echo ""

files=(
  "public/js/supabaseClient.js"
  "public/entreprise/techniciens.html"
  "api/techniciens/create.js"
  "api/techniciens/update.js"
  "api/techniciens/delete.js"
  "_FIX_LIAISONS_ENTREPRISES_PROFILES.sql"
  "_CHECK_STRUCTURE_ENTREPRISES.sql"
  "_RAPPORT_CORRECTION_TECHNICIENS.md"
)

all_ok=true
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "   ✅ $file"
  else
    echo "   ❌ $file - MANQUANT"
    all_ok=false
  fi
done

echo ""

# Vérifier contenu clé dans supabaseClient.js
echo "2️⃣ Vérification du guard dans supabaseClient.js..."
if grep -q "auth?.getSession" public/js/supabaseClient.js; then
  echo "   ✅ Guard auth.getSession présent"
else
  echo "   ❌ Guard manquant"
  all_ok=false
fi

# Vérifier contenu clé dans techniciens.html
echo ""
echo "3️⃣ Vérification des guards dans techniciens.html..."
if grep -q "window.supabase.auth.getSession" public/entreprise/techniciens.html; then
  echo "   ✅ Guard init présent"
else
  echo "   ❌ Guard init manquant"
  all_ok=false
fi

# Vérifier fallback dans create.js
echo ""
echo "4️⃣ Vérification du fallback entreprise_id dans create.js..."
if grep -q "entreprises.profile_id" api/techniciens/create.js; then
  echo "   ✅ Fallback entreprise_id présent"
else
  echo "   ❌ Fallback manquant"
  all_ok=false
fi

# Vérifier fallback dans update.js
echo ""
echo "5️⃣ Vérification du fallback dans update.js..."
if grep -q "eq('profile_id', user.id)" api/techniciens/update.js; then
  echo "   ✅ Fallback présent"
else
  echo "   ❌ Fallback manquant"
  all_ok=false
fi

# Vérifier fallback dans delete.js
echo ""
echo "6️⃣ Vérification du fallback dans delete.js..."
if grep -q "eq('profile_id', user.id)" api/techniciens/delete.js; then
  echo "   ✅ Fallback présent"
else
  echo "   ❌ Fallback manquant"
  all_ok=false
fi

# Résumé final
echo ""
echo "======================================================"
if [ "$all_ok" = true ]; then
  echo "✅ TOUTES LES CORRECTIONS SONT EN PLACE"
  echo ""
  echo "📋 PROCHAINES ÉTAPES:"
  echo "   1. Exécuter le script SQL dans Supabase:"
  echo "      → _FIX_LIAISONS_ENTREPRISES_PROFILES.sql"
  echo ""
  echo "   2. Déployer sur Vercel:"
  echo "      git add ."
  echo "      git commit -m 'fix: Corrections gestion techniciens'"
  echo "      git push"
  echo ""
  echo "   3. Tester la page:"
  echo "      → https://jetc-immo-saas.vercel.app/entreprise/techniciens.html"
  echo ""
  exit 0
else
  echo "❌ CERTAINES CORRECTIONS SONT MANQUANTES"
  echo ""
  echo "Vérifiez les erreurs ci-dessus et réappliquez les corrections."
  echo ""
  exit 1
fi
