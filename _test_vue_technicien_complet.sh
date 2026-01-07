#!/bin/bash
# TEST RAPIDE VUE TECHNICIEN AMÉLIORÉE

echo "🧪 TEST VUE TECHNICIEN - AFFICHAGE COMPLET"
echo "=========================================="
echo ""

# 1. Test schéma
echo "1️⃣ Test schéma Supabase..."
node _audit_schema_technicien.js
if [ $? -eq 0 ]; then
  echo "✅ Schéma OK"
else
  echo "❌ Erreur schéma"
  exit 1
fi

echo ""
echo "2️⃣ Test accès & créneaux..."
node _audit_acces_creneaux.js
if [ $? -eq 0 ]; then
  echo "✅ Accès OK"
else
  echo "❌ Erreur accès"
  exit 1
fi

echo ""
echo "3️⃣ Test complet vue technicien..."
node _test_vue_technicien.js
if [ $? -eq 0 ]; then
  echo "✅ Vue technicien OK"
else
  echo "❌ Erreur vue technicien"
  exit 1
fi

echo ""
echo "=========================================="
echo "✅ TOUS LES TESTS PASSÉS"
echo ""
echo "📌 Pour tester visuellement:"
echo "   1. Démarrer le serveur: node server.js"
echo "   2. Ouvrir: http://localhost:3001/technicien/dashboard.html"
echo "   3. Login: demo.technicien@jetc-immo.local"
echo "   4. Vérifier que les cards affichent:"
echo "      - Nom/prénom + téléphone locataire"
echo "      - Adresse complète (NPA/ville)"
echo "      - Code d'accès (si dispo)"
echo "      - Date intervention"
echo "   5. Cliquer 'Détails' et vérifier:"
echo "      - Section Locataire (nom, tél, email)"
echo "      - Section Adresse (complète, étage, numéro)"
echo "      - Section Accès (code avec bouton Copier)"
echo "      - Section Créneaux (date + badge validé)"
echo ""
