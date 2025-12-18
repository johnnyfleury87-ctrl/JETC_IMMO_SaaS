/**
 * ✅ CORRECTION AUTH GLOBALE
 * Module d'authentification standardisé pour tous les dashboards
 * Source de vérité unique : supabase.auth.getSession()
 */

/**
 * Vérifie l'authentification et redirige si nécessaire
 * @param {string} expectedRole - Rôle attendu (locataire, regie, admin_jtec, etc.)
 * @param {Object} options - Options de configuration
 * @returns {Promise<Object>} - {session, profile, userData}
 */
async function checkAuthStandard(expectedRole, options = {}) {
  console.log(`[AUTH][${expectedRole.toUpperCase()}] Vérification authentification...`);
  
  // Vérifier que Supabase est chargé
  if (typeof supabase === 'undefined') {
    console.error('[AUTH][FATAL] Supabase client non chargé');
    alert('Erreur technique: Client Supabase non chargé. Rechargez la page.');
    return null;
  }
  
  try {
    // ✅ SOURCE DE VÉRITÉ : Session Supabase
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    console.log('[AUTH][SESSION]', {
      hasSession: !!session,
      error: sessionError,
      userId: session?.user?.id
    });
    
    if (sessionError || !session) {
      console.log('[AUTH][REDIRECT] Raison: Pas de session Supabase');
      window.location.href = '/login.html';
      return null;
    }
    
    // Récupérer le profil depuis Supabase
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', session.user.id)
      .single();
    
    console.log('[AUTH][PROFILE]', {
      data: profile,
      error: profileError
    });
    
    if (profileError || !profile) {
      console.log('[AUTH][REDIRECT] Raison: Profil introuvable');
      alert('Erreur: Profil introuvable. Reconnexion requise.');
      window.location.href = '/login.html';
      return null;
    }
    
    // Vérifier le rôle
    console.log('[AUTH][ROLE]', {
      actual: profile.role,
      expected: expectedRole
    });
    
    if (profile.role !== expectedRole) {
      console.log('[AUTH][REDIRECT] Raison: Rôle incorrect');
      alert(`Accès interdit : ce dashboard est réservé aux ${expectedRole}`);
      window.location.href = '/login.html';
      return null;
    }
    
    console.log('[AUTH] ✅ Authentification validée');
    
    return {
      session,
      profile,
      userData: {
        id: profile.id,
        email: profile.email,
        role: profile.role
      }
    };
    
  } catch (error) {
    console.error('[AUTH][ERROR]', error);
    console.log('[AUTH][REDIRECT] Raison: Exception', error.message);
    alert('Erreur technique. Reconnexion requise.');
    window.location.href = '/login.html';
    return null;
  }
}

/**
 * Déconnexion standardisée
 */
async function logoutStandard() {
  console.log('[AUTH] Déconnexion en cours...');
  
  if (typeof supabase !== 'undefined') {
    await supabase.auth.signOut();
    console.log('[AUTH] ✅ Déconnexion Supabase effectuée');
  }
  
  window.location.href = '/index.html';
}

/**
 * Vérification spécifique pour les régies (statut_validation)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Object|null>} - Données de la régie ou null si bloqué
 */
async function checkRegieValidation(userId) {
  console.log('[AUTH][REGIE] Vérification statut validation...');
  
  const { data: regie, error: regieError } = await supabase
    .from('regies')
    .select('id, nom, statut_validation')
    .eq('profile_id', userId)
    .single();
  
  if (regieError) {
    console.error('[AUTH][REGIE][ERROR]', regieError);
    alert('Erreur lors de la vérification de votre agence');
    await supabase.auth.signOut();
    window.location.href = '/login.html';
    return null;
  }
  
  if (!regie) {
    alert('Aucune régie associée à ce compte');
    await supabase.auth.signOut();
    window.location.href = '/login.html';
    return null;
  }
  
  // Vérifier statut
  if (regie.statut_validation === 'en_attente') {
    alert('⏳ Votre agence est en attente de validation par l\'équipe JETC_IMMO.');
    await supabase.auth.signOut();
    window.location.href = '/login.html';
    return null;
  }
  
  if (regie.statut_validation === 'refuse') {
    alert('❌ Votre inscription a été refusée.');
    await supabase.auth.signOut();
    window.location.href = '/login.html';
    return null;
  }
  
  if (regie.statut_validation !== 'valide') {
    alert('Statut de validation invalide');
    await supabase.auth.signOut();
    window.location.href = '/login.html';
    return null;
  }
  
  console.log('[AUTH][REGIE] ✅ Statut valide');
  return regie;
}
