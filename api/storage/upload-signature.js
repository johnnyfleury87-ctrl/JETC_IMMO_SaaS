/**
 * API Upload - Signature
 * 
 * Permet à un locataire ou une entreprise d'uploader sa signature numérique.
 * 
 * Sécurité :
 * - Vérifie que l'utilisateur est un locataire ou une entreprise
 * - Upload dans le bucket signatures
 * - Nom du fichier : {entity_id}/{timestamp}-signature.png
 * 
 * Usage:
 *   POST /api/storage/upload-signature
 *   Content-Type: multipart/form-data
 *   Body: { file }
 */

const { getSupabaseClient } = require('../../lib/supabase-client');
const { authenticateUser } = require('../../lib/auth');

module.exports = async (req, res) => {
  // Méthode POST uniquement
  if (req.method !== 'POST') {
    return res.writeHead(405, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Méthode non autorisée' }));
  }

  try {
    // 1. Authentifier l'utilisateur
    const user = await authenticateUser(req);
    if (!user) {
      return res.writeHead(401, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Non authentifié' }));
    }

    // 2. Vérifier le rôle
    const supabase = getSupabaseClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['locataire', 'entreprise'].includes(profile.role)) {
      return res.writeHead(403, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Accès réservé aux locataires et entreprises' }));
    }

    // 3. Parser le body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    await new Promise((resolve) => req.on('end', resolve));

    const data = JSON.parse(body);
    const { file_base64, filename } = data;

    if (!file_base64 || !filename) {
      return res.writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'file_base64 et filename requis' }));
    }

    // 4. Récupérer l'ID de l'entité (locataire ou entreprise)
    let entityId;
    let tableName;

    if (profile.role === 'locataire') {
      const { data: locataire } = await supabase
        .from('locataires')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!locataire) {
        return res.writeHead(404, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ error: 'Locataire non trouvé' }));
      }

      entityId = locataire.id;
      tableName = 'locataires';
    } else if (profile.role === 'entreprise') {
      const { data: entreprise } = await supabase
        .from('entreprises')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!entreprise) {
        return res.writeHead(404, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ error: 'Entreprise non trouvée' }));
      }

      entityId = entreprise.id;
      tableName = 'entreprises';
    }

    // 5. Upload du fichier dans Storage
    const fileBuffer = Buffer.from(file_base64, 'base64');
    const filePath = `${entityId}/${Date.now()}-signature.png`;

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('signatures')
      .upload(filePath, fileBuffer, {
        contentType: 'image/png',
        upsert: false
      });

    if (uploadError) {
      console.error('Erreur upload:', uploadError);
      return res.writeHead(500, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Erreur lors de l\'upload' }));
    }

    // 6. Récupérer l'URL publique
    const { data: urlData } = supabase
      .storage
      .from('signatures')
      .getPublicUrl(filePath);

    // 7. Mettre à jour la colonne signature_url
    const { error: updateError } = await supabase
      .from(tableName)
      .update({ signature_url: urlData.publicUrl })
      .eq('id', entityId);

    if (updateError) {
      console.error('Erreur update:', updateError);
    }

    // 8. Retourner l'URL
    return res.writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({
        success: true,
        file_path: filePath,
        url: urlData.publicUrl
      }));

  } catch (error) {
    console.error('Erreur upload signature:', error);
    return res.writeHead(500, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Erreur serveur' }));
  }
};
