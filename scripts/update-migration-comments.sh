#!/bin/bash
# update-migration-comments.sh
# Met à jour les commentaires "Ordre d'exécution : X" dans les fichiers SQL renommés

set -e

SCHEMA_DIR="supabase/schema"

echo "📝 Mise à jour des commentaires 'Ordre d'exécution' dans les fichiers SQL..."
echo ""

# Vérifier que nous sommes dans le bon répertoire
if [ ! -d "$SCHEMA_DIR" ]; then
  echo "❌ ERREUR : Répertoire $SCHEMA_DIR introuvable"
  exit 1
fi

# Tableau associatif : fichier → nouveau numéro
declare -A NEW_ORDERS=(
  ["09_entreprises.sql"]="9"
  ["10_techniciens.sql"]="10"
  ["11_tickets.sql"]="11"
  ["12_missions.sql"]="12"
  ["13_intervention.sql"]="13"
  ["14_facturation.sql"]="14"
  ["15_messagerie.sql"]="15"
  ["16_rls.sql"]="16"
  ["17_storage.sql"]="17"
  ["18_admin.sql"]="18"
)

echo "🔧 Fichiers à mettre à jour :"

for file in "${!NEW_ORDERS[@]}"; do
  new_order="${NEW_ORDERS[$file]}"
  filepath="$SCHEMA_DIR/$file"
  
  if [ ! -f "$filepath" ]; then
    echo "   ⚠️  Fichier introuvable : $file (ignoré)"
    continue
  fi
  
  # Vérifier si le fichier contient "Ordre d'exécution"
  if ! grep -q "Ordre d.exécution" "$filepath"; then
    echo "   ⚠️  Pas de commentaire 'Ordre d'exécution' dans $file (ignoré)"
    continue
  fi
  
  # Créer un fichier temporaire avec le remplacement
  # Remplace "Ordre d'exécution : XX" par "Ordre d'exécution : YY"
  sed -E "s/(Ordre d.exécution[[:space:]]*:[[:space:]]*)[0-9]+/\1$new_order/" "$filepath" > "$filepath.tmp"
  
  # Remplacer le fichier original
  mv "$filepath.tmp" "$filepath"
  
  echo "   ✅ $file → Ordre d'exécution : $new_order"
done

echo ""
echo "✅ Mise à jour terminée !"
echo ""

# Vérification
echo "🔍 VÉRIFICATION :"
echo ""
for file in "${!NEW_ORDERS[@]}"; do
  filepath="$SCHEMA_DIR/$file"
  if [ -f "$filepath" ]; then
    order_line=$(grep -E "Ordre d.exécution[[:space:]]*:" "$filepath" | head -1 || echo "Non trouvé")
    printf "   %-25s : %s\n" "$file" "$order_line"
  fi
done

echo ""
echo "🎯 PROCHAINES ÉTAPES :"
echo "   1. Vérifier manuellement : cat supabase/schema/11_tickets.sql | head -15"
echo "   2. Commit Git : git add supabase/schema/*.sql docs/*.md scripts/*.sh"
echo "   3. Exécuter migrations : 01 → 21 dans Supabase SQL Editor"
echo ""
echo "✨ Prêt pour l'exécution !"
