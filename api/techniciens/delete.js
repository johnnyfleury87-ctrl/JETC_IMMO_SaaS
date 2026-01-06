/**
 * ======================================================
 * DELETE /api/techniciens/delete
 * ======================================================
 * Supprime un technicien (cascade auth + profile + technicien)
 * SÉCURISÉ : Uniquement entreprise propriétaire
 * ======================================================
 */

const { supabaseAdmin } = require('../_supabase');

module.exports = async (req, res) => {
  // 1️⃣ Vérifier méthode HTTP
  if (req.method !== 'DELETE') {
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

    // 3️⃣ Vérifier rôle entreprise
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, entreprise_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ error: 'Profile introuvable' });
    }

    if (profile.role !== 'entreprise') {
      return res.status(403).json({ error: 'Action réservée aux entreprises' });
    }

    // 4️⃣ Récupérer technicien_id
    const { technicien_id } = req.body;

    if (!technicien_id) {
      return res.status(400).json({ error: 'technicien_id requis' });
    }

    // 5️⃣ Vérifier que le technicien appartient à l'entreprise
    const { data: technicien, error: techError } = await supabaseAdmin
      .from('techniciens')
      .select('id, entreprise_id')
      .eq('id', technicien_id)
      .single();

    if (techError || !technicien) {
      return res.status(404).json({ error: 'Technicien introuvable' });
    }

    if (technicien.entreprise_id !== profile.entreprise_id) {
      console.warn('[API /techniciens/delete] Tentative suppression non autorisée:', {
        user_entreprise: profile.entreprise_id,
        tech_entreprise: technicien.entreprise_id
      });
      return res.status(403).json({ error: 'Non autorisé à supprimer ce technicien' });
    }

    // 6️⃣ Vérifier qu'aucune mission active n'est assignée
    const { data: missions, error: missionsError } = await supabaseAdmin
      .from('missions')
      .select('id, statut')
      .eq('technicien_id', technicien_id)
      .in('statut', ['a_planifier', 'planifiee', 'en_cours']);

    if (missionsError) {
      console.error('[API /techniciens/delete] Erreur vérif missions:', missionsError);
      return res.status(500).json({ error: 'Erreur vérification missions' });
    }

    if (missions && missions.length > 0) {
      return res.status(400).json({ 
        error: 'Impossible de supprimer : missions actives assignées',
        missions_count: missions.length 
      });
    }

    // 7️⃣ Supprimer technicien (cascade via FK)
    const { error: deleteTechError } = await supabaseAdmin
      .from('techniciens')
      .delete()
      .eq('id', technicien_id);

    if (deleteTechError) {
      console.error('[API /techniciens/delete] Erreur suppression technicien:', deleteTechError);
      return res.status(500).json({ 
        error: 'Erreur suppression technicien',
        details: deleteTechError.message 
      });
    }

    console.log('[API /techniciens/delete] Technicien supprimé (table):', technicien_id);

    // 8️⃣ Supprimer profile
    const { error: deleteProfileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', technicien_id);

    if (deleteProfileError) {
      console.warn('[API /techniciens/delete] Erreur suppression profile:', deleteProfileError);
      // Continue quand même
    }

    // 9️⃣ Supprimer user Auth
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(technicien_id);

    if (deleteAuthError) {
      console.warn('[API /techniciens/delete] Erreur suppression auth:', deleteAuthError);
      // Continue quand même
    }

    console.log('[API /techniciens/delete] Suppression complète réussie:', technicien_id);

    // 🔟 Retourner succès
    res.status(200).json({
      success: true,
      message: 'Technicien supprimé avec succès',
      technicien_id
    });

  } catch (error) {
    console.error('[API /techniciens/delete] Erreur inattendue:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: error.message 
    });
  }
};
