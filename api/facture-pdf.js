/**
 * API - Export PDF Facture Individuelle
 * 
 * Route: /api/facture-pdf
 * Méthode: GET
 * Accès: Entreprise (sa facture) ou Régie (facture de sa mission)
 * 
 * Query params:
 *   - facture_id: ID de la facture
 * 
 * Retourne: Stream PDF
 */

const { createClient } = require('@supabase/supabase-js');
const PDFDocument = require('pdfkit');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Vérifier authentification
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    const { facture_id } = req.query;
    if (!facture_id) {
      return res.status(400).json({ error: 'facture_id manquant' });
    }

    // 2. Récupérer la facture via la vue (avec tous les détails)
    const { data: facture, error: factureError } = await supabaseAdmin
      .from('missions_factures_complet')
      .select('*')
      .eq('facture_id', facture_id)
      .single();

    if (factureError || !facture) {
      console.error('Erreur facture:', factureError);
      return res.status(404).json({ error: 'Facture non trouvée' });
    }

    // 3. Vérifier droits d'accès via profile.<role>_id
    // CRITIQUE: user.id = profiles.id (auth), PAS entreprises.id ou regies.id
    // Donc on récupère profile.entreprise_id / profile.regie_id pour comparer
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, entreprise_id, regie_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.error('[PDF] Erreur profile:', profileError);
      return res.status(403).json({ error: 'Profil introuvable' });
    }

    console.log('[PDF] User:', user.id, 'Role:', profile.role, 'entreprise_id:', profile.entreprise_id, 'regie_id:', profile.regie_id);
    console.log('[PDF] Facture entreprise_id:', facture.entreprise_id, 'regie_id:', facture.regie_id);

    const isAdmin = profile.role === 'admin_jtec';

    // Admin peut tout voir
    if (isAdmin) {
      console.log('[PDF] Admin access granted');
    }
    // Entreprise: vérifier ownership via profile.entreprise_id
    else if (profile.role === 'entreprise') {
      if (!profile.entreprise_id) {
        console.error('[PDF] Entreprise profile incomplet: entreprise_id manquant');
        return res.status(403).json({ error: 'Profil entreprise incomplet (entreprise_id manquant)' });
      }
      if (facture.entreprise_id !== profile.entreprise_id) {
        console.error('[PDF] Entreprise', profile.entreprise_id, 'tente d\'accéder à facture entreprise_id', facture.entreprise_id);
        return res.status(403).json({ error: 'Cette facture ne vous appartient pas' });
      }
      console.log('[PDF] Entreprise access granted');
    }
    // Régie: vérifier ownership via profile.regie_id
    else if (profile.role === 'regie') {
      if (!profile.regie_id) {
        console.error('[PDF] Régie profile incomplet: regie_id manquant');
        return res.status(403).json({ error: 'Profil régie incomplet (regie_id manquant)' });
      }
      if (facture.regie_id !== profile.regie_id) {
        console.error('[PDF] Régie', profile.regie_id, 'tente d\'accéder à facture regie_id', facture.regie_id);
        return res.status(403).json({ error: 'Cette facture ne concerne pas votre régie' });
      }
      console.log('[PDF] Régie access granted');
    }
    // Rôle non autorisé
    else {
      console.error('[PDF] Rôle non autorisé:', profile.role);
      return res.status(403).json({ error: 'Accès refusé - Rôle non autorisé' });
    }

    // 4. Récupérer les lignes de facturation
    const { data: lignes, error: lignesError } = await supabaseAdmin
      .from('facture_lignes')
      .select('*')
      .eq('facture_id', facture_id)
      .order('created_at', { ascending: true });

    if (lignesError) {
      console.error('Erreur lignes:', lignesError);
      return res.status(500).json({ error: 'Erreur récupération lignes' });
    }

    // 5. Générer le PDF
    const doc = new PDFDocument({ 
      size: 'A4',
      margin: 50,
      info: {
        Title: `Facture ${facture.facture_numero}`,
        Author: 'JETC Platform',
        Subject: `Facture pour mission ${facture.ticket_titre}`
      }
    });

    // Stream vers la réponse
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="facture_${facture.facture_numero}.pdf"`);
    doc.pipe(res);

    // === EN-TÊTE ===
    doc.fontSize(20).text('FACTURE', { align: 'center' });
    doc.moveDown();

    doc.fontSize(14).text(`Numéro: ${facture.facture_numero}`, { align: 'center' });
    doc.fontSize(10).text(`Date d'émission: ${new Date(facture.facture_date_emission).toLocaleDateString('fr-FR')}`, { align: 'center' });
    
    doc.moveDown(2);

    // === INFORMATIONS ENTREPRISE ET RÉGIE ===
    const leftX = 50;
    const rightX = 320;
    let currentY = doc.y;

    // Entreprise (gauche)
    doc.fontSize(12).text('ENTREPRISE', leftX, currentY, { underline: true });
    doc.fontSize(10).text(facture.entreprise_nom || 'Non spécifié', leftX, currentY + 20);
    doc.fontSize(9).text(facture.entreprise_email || '', leftX, currentY + 35);

    // Régie (droite)
    doc.fontSize(12).text('RÉGIE', rightX, currentY, { underline: true });
    doc.fontSize(10).text(facture.regie_nom || 'Non spécifié', rightX, currentY + 20);
    doc.fontSize(9).text(facture.regie_email || '', rightX, currentY + 35);

    doc.moveDown(4);

    // === MISSION ===
    doc.fontSize(12).text('MISSION', { underline: true });
    doc.fontSize(10).text(`Titre: ${facture.ticket_titre || 'N/A'}`, { continued: false });
    doc.text(`Ticket: #${facture.ticket_id?.substring(0, 8) || 'N/A'}`, { continued: false });
    doc.text(`Mission: #${facture.mission_id?.substring(0, 8) || 'N/A'}`, { continued: false });
    
    doc.moveDown(2);

    // === DÉTAILS FACTURATION ===
    doc.fontSize(12).text('DÉTAILS', { underline: true });
    doc.moveDown(0.5);

    // Tableau des lignes
    const tableTop = doc.y;
    const colDescription = 50;
    const colQuantite = 300;
    const colPrixUnit = 380;
    const colTotal = 460;

    // Header
    doc.fontSize(10)
      .text('Description', colDescription, tableTop, { width: 240, bold: true })
      .text('Qté', colQuantite, tableTop, { width: 70, align: 'right' })
      .text('Prix Unit.', colPrixUnit, tableTop, { width: 70, align: 'right' })
      .text('Total', colTotal, tableTop, { width: 80, align: 'right' });

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    let rowY = tableTop + 25;

    lignes.forEach((ligne) => {
      doc.fontSize(9)
        .text(ligne.description || 'Prestation', colDescription, rowY, { width: 240 })
        .text((ligne.quantite || 1).toString(), colQuantite, rowY, { width: 70, align: 'right' })
        .text(`CHF ${(ligne.prix_unitaire || 0).toFixed(2)}`, colPrixUnit, rowY, { width: 70, align: 'right' })
        .text(`CHF ${(ligne.montant_total || 0).toFixed(2)}`, colTotal, rowY, { width: 80, align: 'right' });

      rowY += 20;
    });

    doc.moveDown(2);

    // === TOTAUX ===
    const totauxY = rowY + 20;
    const totauxLabelX = 370;
    const totauxValueX = 460;

    doc.moveTo(50, totauxY - 5).lineTo(550, totauxY - 5).stroke();

    doc.fontSize(10)
      .text('Total HT:', totauxLabelX, totauxY)
      .text(`CHF ${(facture.facture_montant_ht || 0).toFixed(2)}`, totauxValueX, totauxY, { width: 80, align: 'right' });

    doc.text(`TVA (${facture.facture_taux_tva || 0}%):`, totauxLabelX, totauxY + 20)
      .text(`CHF ${(facture.facture_montant_tva || 0).toFixed(2)}`, totauxValueX, totauxY + 20, { width: 80, align: 'right' });

    doc.fontSize(12).fillColor('#0066CC')
      .text('Total TTC:', totauxLabelX, totauxY + 45)
      .text(`CHF ${(facture.facture_montant_ttc || 0).toFixed(2)}`, totauxValueX, totauxY + 45, { width: 80, align: 'right' });

    doc.fillColor('black');

    // === COMMISSION JETC ===
    if (facture.facture_commission_jetc) {
      doc.moveDown(2);
      doc.fontSize(9).fillColor('#666666')
        .text(`Commission JETC (${facture.facture_taux_commission || 0}%): CHF ${(facture.facture_commission_jetc || 0).toFixed(2)}`, { align: 'right' });
      doc.fillColor('black');
    }

    doc.moveDown(3);

    // === IBAN ===
    if (facture.facture_iban) {
      doc.fontSize(11).text('COORDONNÉES BANCAIRES', { underline: true });
      doc.fontSize(10).text(`IBAN: ${facture.facture_iban}`);
      doc.moveDown();
    }

    // === STATUT ===
    doc.fontSize(10).text(`Statut: ${getStatutLabel(facture.facture_statut)}`, { bold: true });

    if (facture.facture_statut === 'payee' && facture.facture_date_paiement) {
      doc.fontSize(9).fillColor('#27ae60')
        .text(`✓ Payée le ${new Date(facture.facture_date_paiement).toLocaleDateString('fr-FR')}`);
    }

    if (facture.facture_statut === 'refusee' && facture.refus_reason) {
      doc.fontSize(9).fillColor('#e74c3c')
        .text(`✗ Refusée: ${facture.refus_reason}`);
    }

    // === FOOTER ===
    doc.fontSize(8).fillColor('#999999')
      .text('Document généré automatiquement par la plateforme JETC', 50, 750, { align: 'center' });

    // Finaliser
    doc.end();

  } catch (error) {
    console.error('Erreur génération PDF:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Erreur génération PDF', details: error.message });
    }
  }
};

function getStatutLabel(statut) {
  const labels = {
    'brouillon': 'BROUILLON',
    'envoyee': 'ENVOYÉE À LA RÉGIE',
    'payee': 'PAYÉE',
    'refusee': 'REFUSÉE'
  };
  return labels[statut] || statut.toUpperCase();
}
