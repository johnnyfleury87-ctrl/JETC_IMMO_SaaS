#!/bin/bash

###############################################################################
# SCRIPT DE TEST : Dashboard Régie Soft-Lock Fix
# 
# Ce script aide à valider la correction du soft-lock dashboard régie
# en fournissant des commandes SQL pour simuler différents scénarios.
###############################################################################

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction helper
print_header() {
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE} $1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
  echo ""
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

###############################################################################
# CONFIGURATION
###############################################################################

print_header "CONFIGURATION"

# Vérifier DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  print_error "DATABASE_URL non définie"
  echo ""
  echo "Exportez la variable d'environnement :"
  echo "  export DATABASE_URL='postgresql://user:pass@host:5432/db'"
  echo ""
  exit 1
fi

print_success "DATABASE_URL configurée"

###############################################################################
# MENU PRINCIPAL
###############################################################################

show_menu() {
  print_header "TEST DASHBOARD RÉGIE - Soft-Lock Fix"
  
  echo "Sélectionnez un scénario de test :"
  echo ""
  echo "  1) Test nominal - Créer régie valide"
  echo "  2) Test soft-lock - Créer user sans profil"
  echo "  3) Test attente - Mettre régie en attente"
  echo "  4) Test refus - Refuser régie avec commentaire"
  echo "  5) Test rôle - Changer rôle régie vers locataire"
  echo "  6) Restaurer régie en 'valide'"
  echo "  7) Lister toutes les régies"
  echo "  8) Voir logs récents (si disponibles)"
  echo "  9) Quitter"
  echo ""
  echo -n "Choix [1-9]: "
}

###############################################################################
# FONCTIONS DE TEST
###############################################################################

# Test 1 : Créer régie valide
test_create_valid_regie() {
  print_header "TEST 1 : Créer Régie Valide"
  
  echo "Email de la nouvelle régie :"
  read -p "> " email
  
  echo "Nom de l'agence :"
  read -p "> " nom_agence
  
  echo "Mot de passe :"
  read -s -p "> " password
  echo ""
  
  print_info "Création en cours via API /api/auth/register..."
  
  # Appel API (nécessite que le serveur tourne)
  curl -X POST http://localhost:3000/api/auth/register \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$email\",
      \"password\": \"$password\",
      \"language\": \"fr\",
      \"nomAgence\": \"$nom_agence\",
      \"nbCollaborateurs\": 5,
      \"nbLogements\": 50,
      \"siret\": null,
      \"plan\": null
    }"
  
  echo ""
  print_info "Régie créée avec statut 'en_attente'"
  print_info "Validez-la via /admin/dashboard.html"
}

# Test 2 : Créer user sans profil (simulation soft-lock)
test_create_user_no_profile() {
  print_header "TEST 2 : User Auth sans Profil (Soft-Lock)"
  
  print_warning "Ce test simule le bug d'origine : user auth existe mais pas de profil"
  echo ""
  echo "Email du user test :"
  read -p "> " email
  
  echo "Mot de passe :"
  read -s -p "> " password
  echo ""
  
  print_info "Création user Supabase Auth via SQL..."
  
  # Générer UUID
  user_id=$(uuidgen | tr '[:upper:]' '[:lower:]')
  
  # Créer user dans auth.users (via Supabase Admin)
  print_warning "Ce test nécessite accès Supabase Admin ou psql direct"
  print_info "Créez manuellement via Supabase Dashboard > Authentication > Add User"
  print_info "Email: $email"
  print_info "Password: (votre choix)"
  print_info "Confirm email: OUI"
  
  echo ""
  print_warning "IMPORTANT : NE PAS créer de profil dans la table 'profiles'"
  print_info "Ensuite, tentez de vous connecter avec cet email → devrait afficher message HTML (pas popup)"
}

# Test 3 : Mettre régie en attente
test_set_attente() {
  print_header "TEST 3 : Régie En Attente"
  
  echo "Email de la régie :"
  read -p "> " email
  
  print_info "Mise à jour statut vers 'en_attente'..."
  
  psql "$DATABASE_URL" <<SQL
UPDATE regies
SET statut_validation = 'en_attente',
    date_validation = NULL,
    admin_validateur_id = NULL
WHERE email = '$email';

SELECT nom, email, statut_validation 
FROM regies 
WHERE email = '$email';
SQL
  
  print_success "Statut mis à jour"
  print_info "Tentez de vous connecter → devrait afficher message 'Validation en attente'"
}

# Test 4 : Refuser régie
test_set_refuse() {
  print_header "TEST 4 : Régie Refusée"
  
  echo "Email de la régie :"
  read -p "> " email
  
  echo "Commentaire de refus :"
  read -p "> " commentaire
  
  print_info "Mise à jour statut vers 'refuse'..."
  
  psql "$DATABASE_URL" <<SQL
UPDATE regies
SET statut_validation = 'refuse',
    commentaire_refus = '$commentaire',
    date_refus = NOW()
WHERE email = '$email';

SELECT nom, email, statut_validation, commentaire_refus 
FROM regies 
WHERE email = '$email';
SQL
  
  print_success "Statut mis à jour"
  print_info "Tentez de vous connecter → devrait afficher message 'Inscription refusée' + commentaire"
}

# Test 5 : Changer rôle
test_change_role() {
  print_header "TEST 5 : Changer Rôle (Regie → Locataire)"
  
  echo "Email du compte régie :"
  read -p "> " email
  
  print_info "Recherche profile_id..."
  
  profile_id=$(psql "$DATABASE_URL" -t -c "SELECT id FROM profiles WHERE email = '$email';")
  
  if [ -z "$profile_id" ]; then
    print_error "Profil introuvable pour email: $email"
    return
  fi
  
  print_info "Changement rôle vers 'locataire'..."
  
  psql "$DATABASE_URL" <<SQL
UPDATE profiles
SET role = 'locataire'
WHERE email = '$email';

SELECT email, role 
FROM profiles 
WHERE email = '$email';
SQL
  
  print_success "Rôle mis à jour"
  print_info "Accédez manuellement à /regie/dashboard.html → devrait afficher 'Accès interdit'"
  print_warning "RESTAUREZ le rôle après test : UPDATE profiles SET role = 'regie' WHERE email = '$email';"
}

# Test 6 : Restaurer valide
test_restore_valid() {
  print_header "TEST 6 : Restaurer Régie Valide"
  
  echo "Email de la régie :"
  read -p "> " email
  
  print_info "Restauration statut 'valide'..."
  
  psql "$DATABASE_URL" <<SQL
UPDATE regies
SET statut_validation = 'valide',
    date_validation = NOW(),
    commentaire_refus = NULL
WHERE email = '$email';

SELECT nom, email, statut_validation 
FROM regies 
WHERE email = '$email';
SQL
  
  print_success "Statut restauré"
  print_info "Vous pouvez maintenant vous connecter normalement"
}

# Test 7 : Lister régies
test_list_regies() {
  print_header "LISTE DES RÉGIES"
  
  psql "$DATABASE_URL" <<SQL
SELECT 
  r.nom AS "Nom Agence",
  r.email AS "Email",
  r.statut_validation AS "Statut",
  p.role AS "Rôle Profil",
  r.created_at AS "Créée le"
FROM regies r
LEFT JOIN profiles p ON p.id = r.profile_id
ORDER BY r.created_at DESC
LIMIT 10;
SQL
}

# Test 8 : Voir logs (si fichier existe)
test_view_logs() {
  print_header "LOGS RÉCENTS"
  
  if [ -f "logs/server.log" ]; then
    print_info "Dernières 50 lignes (filtré [REGIE]):"
    tail -n 50 logs/server.log | grep "\[REGIE\]" || echo "(aucun log [REGIE] trouvé)"
  else
    print_warning "Fichier logs/server.log introuvable"
    print_info "Les logs s'affichent dans la console du serveur (npm start)"
  fi
}

###############################################################################
# BOUCLE PRINCIPALE
###############################################################################

while true; do
  show_menu
  read choice
  
  case $choice in
    1)
      test_create_valid_regie
      ;;
    2)
      test_create_user_no_profile
      ;;
    3)
      test_set_attente
      ;;
    4)
      test_set_refuse
      ;;
    5)
      test_change_role
      ;;
    6)
      test_restore_valid
      ;;
    7)
      test_list_regies
      ;;
    8)
      test_view_logs
      ;;
    9)
      print_success "Bye!"
      exit 0
      ;;
    *)
      print_error "Choix invalide"
      ;;
  esac
  
  echo ""
  echo -n "Appuyez sur Entrée pour continuer..."
  read
done
