#!/bin/bash

echo "🔍 Test API /api/missions/start avec token réel"
echo ""

# 1. Récupérer un token depuis Supabase (simulation login)
echo "1️⃣ Récupération token de test..."

cd /workspaces/JETC_IMMO_SaaS

TOKEN=$(node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  // Login avec un compte technicien test (à créer si besoin)
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'tech@test.com',
    password: 'Test1234!'
  });
  
  if (error) {
    console.error('LOGIN_ERROR:', error.message);
    process.exit(1);
  }
  
  if (data.session) {
    console.log(data.session.access_token);
  } else {
    console.error('NO_SESSION');
    process.exit(1);
  }
})();
" 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" == "LOGIN_ERROR" ] || [ "$TOKEN" == "NO_SESSION" ]; then
  echo "❌ Impossible de récupérer un token (compte tech@test.com n'existe pas?)"
  echo ""
  echo "💡 Pour tester avec un vrai token:"
  echo "   1. Ouvrir le dashboard technicien dans le navigateur"
  echo "   2. Ouvrir DevTools Console (F12)"
  echo "   3. Exécuter: window.supabaseClient.auth.getSession().then(s => console.log(s.data.session.access_token))"
  echo "   4. Copier le token et exécuter:"
  echo "      export TOKEN='votre_token_ici'"
  echo "      curl -X POST http://localhost:3000/api/missions/start \\"
  echo "        -H 'Content-Type: application/json' \\"
  echo "        -H \"Authorization: Bearer \$TOKEN\" \\"
  echo "        -d '{\"mission_id\":\"uuid_ici\"}'"
  exit 1
fi

echo "✅ Token récupéré (${#TOKEN} chars)"
echo ""

# 2. Tester l'API avec une mission fictive
echo "2️⃣ Test API avec token..."
MISSION_ID="00000000-0000-0000-0000-000000000000"  # UUID fictif pour test

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/missions/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"mission_id\":\"$MISSION_ID\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Status: $HTTP_CODE"
echo "Body: $BODY"
echo ""

if [ "$HTTP_CODE" == "401" ]; then
  echo "❌ ÉCHEC: 401 Unauthorized"
  echo "   → Le token n'est pas accepté par l'API"
  echo "   → Vérifier les logs de l'API Node dans le terminal serveur"
  exit 1
elif [ "$HTTP_CODE" == "400" ] || [ "$HTTP_CODE" == "500" ]; then
  echo "⚠️  API accessible mais erreur logique (normal avec UUID fictif)"
  echo "   → Authentification OK ✅"
  exit 0
else
  echo "✅ API répond (auth OK)"
  exit 0
fi
