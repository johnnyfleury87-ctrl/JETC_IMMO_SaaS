#!/bin/bash
echo "🔍 VÉRIFICATION COMPLÈTE DES PAGES PROTÉGÉES"
echo "============================================"
echo ""

PAGES=(
  "admin/dashboard.html"
  "entreprise/dashboard.html"
  "locataire/dashboard.html"
  "regie/dashboard.html"
  "regie/entreprises.html"
  "regie/tickets.html"
  "regie/locataires.html"
  "regie/immeubles.html"
  "regie/logements.html"
  "technicien/dashboard.html"
  "technicien/missions.html"
  "proprietaire/dashboard.html"
)

for page in "${PAGES[@]}"; do
  if [ ! -f "$page" ]; then
    echo "❌ $page: FICHIER INTROUVABLE"
    continue
  fi
  
  # Vérifier imports bootstrap
  if ! grep -q "bootstrapSupabase.js" "$page"; then
    echo "⚠️ $page: MANQUE bootstrapSupabase.js"
    continue
  fi
  
  # Vérifier usages incorrects
  bad_supabase=$(grep -E "supabase\.(auth|from)" "$page" | grep -v "window.supabaseClient" | grep -v "bootstrapSupabase" | wc -l)
  
  if [ $bad_supabase -gt 0 ]; then
    echo "❌ $page: $bad_supabase usages incorrects de supabase"
  else
    echo "✅ $page: OK"
  fi
done

echo ""
echo "============================================"
echo "✅ Vérification terminée"
