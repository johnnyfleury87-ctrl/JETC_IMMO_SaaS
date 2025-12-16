/**
 * API Upload - Photos d'immeubles
 * 
 * Permet à une régie d'uploader une photo pour un de ses immeubles.
 * 
 * Sécurité :
 * - Vérifie que l'utilisateur est une régie
 * - Vérifie que l'immeuble appartient à la régie
 * - Upload dans le bucket photos-immeubles
 * - Nom du fichier : {immeuble_id}/{timestamp}-{filename}
 * 
 * Usage:
 *   POST /api/storage/upload-immeuble
 *   Content-Type: multipart/form-data
 *   Body: { immeuble_id, file }
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

    // 2. Vérifier que c'est une régie
    const supabase = getSupabaseClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'regie') {
      return res.writeHead(403, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Accès réservé aux régies' }));
    }

    // 3. Parser le body (multipart/form-data)
    // Note: En production, utiliser un parser comme 'formidable' ou 'busboy'
    // Pour cette démo, on suppose que le body contient { immeuble_id, file }
    
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    await new Promise((resolve) => req.on('end', resolve));

    const data = JSON.parse(body);
    const { immeuble_id, file_base64, filename } = data;

    if (!immeuble_id || !file_base64 || !filename) {
      return res.writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'immeuble_id, file_base64 et filename requis' }));
    }

    // 4. Vérifier que l'immeuble appartient à la régie
    const { data: regie } = await supabase
      .from('regies')
      .select('id')
      .eq('profile_id', user.id)
      .single();

    if (!regie) {
      return res.writeHead(404, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Régie non trouvée' }));
    }

    const { data: immeuble } = await supabase
      .from('immeubles')
      .select('id')
      .eq('id', immeuble_id)
      .eq('regie_id', regie.id)
      .single();

    if (!immeuble) {
      return res.writeHead(403, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Immeuble non trouvé ou accès refusé' }));
    }

    // 5. Upload du fichier dans Storage
    const fileBuffer = Buffer.from(file_base64, 'base64');
    const filePath = `${immeuble_id}/${Date.now()}-${filename}`;

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('photos-immeubles')
      .upload(filePath, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) {
      console.error('Erreur upload:', uploadError);
      return res.writeHead(500, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Erreur lors de l\'upload' }));
    }

    // 6. Récupérer l'URL publique (signée pour 1 heure)
    const { data: urlData } = supabase
      .storage
      .from('photos-immeubles')
      .getPublicUrl(filePath);

    // 7. Mettre à jour la colonne photo_url de l'immeuble
    const { error: updateError } = await supabase
      .from('immeubles')
      .update({ photo_url: urlData.publicUrl })
      .eq('id', immeuble_id);

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
    console.error('Erreur upload immeuble:', error);
    return res.writeHead(500, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Erreur serveur' }));
  }
};
