/**
 * ======================================================
 * PATCH /api/techniciens/update
 * ======================================================
 * Modifie un technicien existant
 * SÉCURISÉ : 
 * - Entreprise peut modifier ses techniciens
 * - Technicien peut modifier son propre profil (limité)
 * ======================================================
 */

const { supabaseAdmin } = require('../_supabase');

module.exports = async (req, res) => {
  // 1️⃣ Vérifier méthode HTTP
  if (req.method !== 'PATCH' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 2️⃣ Vérifier authentification
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    // 3️⃣ Récupérer profile utilisateur
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, entreprise_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ error: 'Profile introuvable' });
    }

    // 4️⃣ Récupérer données du body
    const { technicien_id, telephone, specialites, disponible } = req.body;

    if (!technicien_id) {
      return res.status(400).json({ error: 'technicien_id requis' });
    }

    // 5️⃣ Vérifier permission
    const { data: technicien, error: techError } = await supabaseAdmin
      .from('techniciens')
      .select('id, entreprise_id')
      .eq('id', technicien_id)
      .single();

    if (techError || !technicien) {
      return res.status(404).json({ error: 'Technicien introuvable' });
    }

    // Vérification permission
    const canUpdate = (
      profile.role === 'entreprise' && profile.entreprise_id === technicien.entreprise_id
    ) || (
      profile.role === 'technicien' && user.id === technicien_id
    );

    if (!canUpdate) {
      console.warn('[API /techniciens/update] Permission refusée:', {
        user_role: profile.role,
        user_entreprise: profile.entreprise_id,
        tech_entreprise: technicien.entreprise_id
      });
      return res.status(403).json({ error: 'Non autorisé à modifier ce technicien' });
    }

    // 6️⃣ Préparer données à mettre à jour
    const updateData = {};
    
    if (telephone !== undefined) updateData.telephone = telephone;
    if (specialites !== undefined) updateData.specialites = specialites;
    if (disponible !== undefined) updateData.disponible = disponible;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }

    // 7️⃣ Mettre à jour
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('techniciens')
      .update(updateData)
      .eq('id', technicien_id)
      .select()
      .single();

    if (updateError) {
      console.error('[API /techniciens/update] Erreur update:', updateError);
      return res.status(500).json({ 
        error: 'Erreur mise à jour',
        details: updateError.message 
      });
    }

    console.log('[API /techniciens/update] Technicien mis à jour:', technicien_id);

    // 8️⃣ Retourner succès
    res.status(200).json({
      success: true,
      technicien: updated
    });

  } catch (error) {
    console.error('[API /techniciens/update] Erreur inattendue:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: error.message 
    });
  }
};
