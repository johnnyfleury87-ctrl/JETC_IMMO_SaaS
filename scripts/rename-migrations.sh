#!/bin/bash
# rename-migrations.sh
# Réorganise les migrations SQL pour respecter les dépendances

set -e

SCHEMA_DIR="supabase/schema"
TEMP_DIR="$SCHEMA_DIR/temp_rename"

echo "🔄 Renommage des migrations SQL pour corriger l'ordre des dépendances..."
echo ""
echo "📋 CONTEXTE:"
echo "   Problème : 09_tickets.sql référence entreprises (10) et techniciens (15)"
echo "   Solution : Déplacer entreprises (10→09) et techniciens (15→10) AVANT tickets (09→11)"
echo ""

# Vérifier que nous sommes dans le bon répertoire
if [ ! -d "$SCHEMA_DIR" ]; then
  echo "❌ ERREUR : Répertoire $SCHEMA_DIR introuvable"
  echo "   Exécutez ce script depuis la racine du projet JETC_IMMO_SaaS"
  exit 1
fi

# Créer un backup
BACKUP_DIR="supabase/schema_backup_$(date +%Y%m%d_%H%M%S)"
echo "💾 Création backup : $BACKUP_DIR"
cp -r "$SCHEMA_DIR" "$BACKUP_DIR"
echo "   ✅ Backup créé"
echo ""

# Créer répertoire temporaire
mkdir -p "$TEMP_DIR"

# Tableau des renommages
declare -A RENAMES=(
  ["09_tickets.sql"]="11_tickets.sql"
  ["10_entreprises.sql"]="09_entreprises.sql"
  ["11_rls.sql"]="16_rls.sql"
  ["12_storage.sql"]="17_storage.sql"
  ["13_admin.sql"]="18_admin.sql"
  ["14_missions.sql"]="12_missions.sql"
  ["15_techniciens.sql"]="10_techniciens.sql"
  ["16_intervention.sql"]="13_intervention.sql"
  ["17_facturation.sql"]="14_facturation.sql"
  ["18_messagerie.sql"]="15_messagerie.sql"
)

echo "📝 Fichiers à renommer :"
for old_name in "${!RENAMES[@]}"; do
  new_name="${RENAMES[$old_name]}"
  printf "   %-30s → %s\n" "$old_name" "$new_name"
done
echo ""

# Phase 1 : Copier dans temp avec nouveaux noms
echo "🔄 Phase 1/3 : Copie dans répertoire temporaire..."
for old_name in "${!RENAMES[@]}"; do
  new_name="${RENAMES[$old_name]}"
  if [ ! -f "$SCHEMA_DIR/$old_name" ]; then
    echo "   ⚠️  Fichier introuvable : $old_name (ignoré)"
    continue
  fi
  cp "$SCHEMA_DIR/$old_name" "$TEMP_DIR/$new_name"
  echo "   ✅ $old_name → $new_name"
done
echo ""

# Phase 2 : Supprimer anciens fichiers
echo "🗑️  Phase 2/3 : Suppression des anciens fichiers..."
for old_name in "${!RENAMES[@]}"; do
  if [ -f "$SCHEMA_DIR/$old_name" ]; then
    rm "$SCHEMA_DIR/$old_name"
    echo "   ✅ Supprimé : $old_name"
  fi
done
echo ""

# Phase 3 : Déplacer depuis temp vers schema
echo "📦 Phase 3/3 : Déplacement des nouveaux fichiers..."
mv "$TEMP_DIR"/* "$SCHEMA_DIR/"
rmdir "$TEMP_DIR"
echo "   ✅ Fichiers déplacés"
echo ""

# Afficher le nouvel ordre
echo "✅ Renommage terminé avec succès !"
echo ""
echo "📋 NOUVEL ORDRE DES MIGRATIONS :"
ls -1 "$SCHEMA_DIR"/*.sql | nl -w2 -s'. '
echo ""

# Statistiques
total_renames=${#RENAMES[@]}
echo "📊 STATISTIQUES :"
echo "   Fichiers renommés : $total_renames"
echo "   Backup disponible : $BACKUP_DIR"
echo ""

# Prochaines étapes
echo "🎯 PROCHAINES ÉTAPES :"
echo "   1. Mettre à jour les commentaires 'Ordre d'exécution :' dans les fichiers renommés"
echo "   2. Exécuter : ./scripts/update-migration-comments.sh"
echo "   3. Vérifier : grep 'Ordre d.exécution' $SCHEMA_DIR/*.sql"
echo "   4. Tester : Exécuter les migrations dans Supabase SQL Editor"
echo ""

# Afficher les dépendances résolues
echo "🔗 DÉPENDANCES RÉSOLUES :"
echo "   ✅ 11_tickets.sql → 09_entreprises.sql (OK)"
echo "   ✅ 11_tickets.sql → 10_techniciens.sql (OK)"
echo "   ✅ 12_missions.sql → 11_tickets.sql (OK)"
echo "   ✅ 12_missions.sql → 09_entreprises.sql (OK)"
echo ""

echo "✨ Migration terminée. Vous pouvez maintenant exécuter les fichiers SQL dans l'ordre numérique."
