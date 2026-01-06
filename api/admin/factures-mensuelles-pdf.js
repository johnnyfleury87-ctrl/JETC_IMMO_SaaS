/**
 * API Admin - Export PDF Factures Mensuelles JETC
 * 
 * Route: /api/admin/factures-mensuelles-pdf
 * Méthode: GET
 * Accès: admin_jtec uniquement
 * 
 * Query params:
 *   - annee (optionnel): filtrer par année
 *   - mois (optionnel): filtrer par mois
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
    // 1. Vérifier authentification et rôle
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin_jtec') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    // 2. Récupérer les données
    const { annee, mois } = req.query;

    let query = supabaseAdmin
      .from('admin_factures_mensuelles_regies')
      .select('*');

    if (annee) query = query.eq('annee', parseInt(annee));
    if (mois) query = query.eq('mois', parseInt(mois));

    query = query.order('periode', { ascending: false });

    const { data: lignes, error: queryError } = await query;

    if (queryError) {
      console.error('Erreur requête:', queryError);
      return res.status(500).json({ error: 'Erreur récupération données' });
    }

    // 3. Calculer totaux
    const totaux = lignes.reduce((acc, ligne) => {
      acc.nombre_missions += ligne.nombre_missions || 0;
      acc.total_ht += parseFloat(ligne.total_ht || 0);
      acc.total_commission_jetc += parseFloat(ligne.total_commission_jetc || 0);
      return acc;
    }, {
      nombre_missions: 0,
      total_ht: 0,
      total_commission_jetc: 0
    });

    // 4. Générer le PDF
    const doc = new PDFDocument({ 
      size: 'A4',
      margin: 50,
      info: {
        Title: 'Facturation Mensuelle JETC',
        Author: 'JETC Platform',
        Subject: 'Récapitulatif des commissions mensuelles'
      }
    });

    // Headers pour le download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="facturation-jetc-${annee || 'toutes'}-${mois || 'tous'}.pdf"`);

    // Pipe le PDF vers la response
    doc.pipe(res);

    // En-tête du document
    doc.fontSize(20).font('Helvetica-Bold').text('JETC - Facturation Mensuelle', { align: 'center' });
    doc.moveDown(0.5);
    
    // Sous-titre avec filtres
    let subtitle = 'Récapitulatif des commissions';
    if (annee || mois) {
      const moisNoms = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      const periodeParts = [];
      if (mois) periodeParts.push(moisNoms[parseInt(mois) - 1]);
      if (annee) periodeParts.push(annee);
      subtitle += ` - ${periodeParts.join(' ')}`;
    }
    doc.fontSize(12).font('Helvetica').fillColor('#666').text(subtitle, { align: 'center' });
    
    doc.moveDown(0.3);
    doc.fontSize(9).text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, { align: 'center' });
    
    doc.moveDown(2);

    // Statistiques globales
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text('Résumé Global', { underline: true });
    doc.moveDown(0.5);

    const statsY = doc.y;
    const statsBoxWidth = 150;
    const statsBoxHeight = 70;
    const statsGap = 20;

    // Box 1: Missions
    doc.rect(50, statsY, statsBoxWidth, statsBoxHeight).fillAndStroke('#667eea', '#667eea');
    doc.fontSize(8).fillColor('#fff').text('NOMBRE DE MISSIONS', 60, statsY + 15, { width: statsBoxWidth - 20 });
    doc.fontSize(20).font('Helvetica-Bold').text(totaux.nombre_missions.toString(), 60, statsY + 35, { width: statsBoxWidth - 20 });

    // Box 2: Total HT
    doc.rect(50 + statsBoxWidth + statsGap, statsY, statsBoxWidth, statsBoxHeight).fillAndStroke('#2196F3', '#2196F3');
    doc.fontSize(8).fillColor('#fff').text('TOTAL HT', 60 + statsBoxWidth + statsGap, statsY + 15, { width: statsBoxWidth - 20 });
    doc.fontSize(20).font('Helvetica-Bold').text(formatCurrency(totaux.total_ht), 60 + statsBoxWidth + statsGap, statsY + 35, { width: statsBoxWidth - 20 });

    // Box 3: Commission JETC
    doc.rect(50 + (statsBoxWidth + statsGap) * 2, statsY, statsBoxWidth, statsBoxHeight).fillAndStroke('#11998e', '#11998e');
    doc.fontSize(8).fillColor('#fff').text('COMMISSION JETC', 60 + (statsBoxWidth + statsGap) * 2, statsY + 15, { width: statsBoxWidth - 20 });
    doc.fontSize(20).font('Helvetica-Bold').text(formatCurrency(totaux.total_commission_jetc), 60 + (statsBoxWidth + statsGap) * 2, statsY + 35, { width: statsBoxWidth - 20 });

    doc.moveDown(5);

    // Tableau détaillé
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text('Détail par Régie et Période', { underline: true });
    doc.moveDown(1);

    // En-têtes du tableau
    const tableTop = doc.y;
    const colWidths = [80, 150, 60, 60, 80, 80];
    const colPositions = [50, 130, 280, 340, 400, 480];

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#333');
    doc.text('Période', colPositions[0], tableTop);
    doc.text('Régie', colPositions[1], tableTop);
    doc.text('Factures', colPositions[2], tableTop, { width: colWidths[2], align: 'right' });
    doc.text('Missions', colPositions[3], tableTop, { width: colWidths[3], align: 'right' });
    doc.text('Total HT', colPositions[4], tableTop, { width: colWidths[4], align: 'right' });
    doc.text('Commission', colPositions[5], tableTop, { width: colWidths[5], align: 'right' });

    // Ligne de séparation
    doc.moveTo(50, tableTop + 15).lineTo(560, tableTop + 15).stroke();

    let y = tableTop + 25;

    // Lignes de données
    doc.font('Helvetica').fontSize(8).fillColor('#000');
    
    lignes.forEach((ligne, index) => {
      // Vérifier si on doit passer à une nouvelle page
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      // Alternance de couleur de fond
      if (index % 2 === 0) {
        doc.rect(50, y - 5, 510, 20).fillAndStroke('#f9f9f9', '#f9f9f9');
      }

      doc.fillColor('#000');
      doc.text(formatPeriode(ligne.periode), colPositions[0], y);
      doc.text(truncate(ligne.regie_nom, 25), colPositions[1], y);
      doc.text(ligne.nombre_factures.toString(), colPositions[2], y, { width: colWidths[2], align: 'right' });
      doc.text(ligne.nombre_missions.toString(), colPositions[3], y, { width: colWidths[3], align: 'right' });
      doc.text(formatCurrency(ligne.total_ht), colPositions[4], y, { width: colWidths[4], align: 'right' });
      doc.text(formatCurrency(ligne.total_commission_jetc), colPositions[5], y, { width: colWidths[5], align: 'right' });

      y += 20;
    });

    // Footer du tableau (totaux)
    y += 10;
    doc.moveTo(50, y).lineTo(560, y).lineWidth(2).stroke();
    y += 10;

    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('TOTAL', colPositions[0], y);
    doc.text(totaux.nombre_missions.toString(), colPositions[3], y, { width: colWidths[3], align: 'right' });
    doc.text(formatCurrency(totaux.total_ht), colPositions[4], y, { width: colWidths[4], align: 'right' });
    doc.text(formatCurrency(totaux.total_commission_jetc), colPositions[5], y, { width: colWidths[5], align: 'right' });

    // Footer du document
    doc.fontSize(7).font('Helvetica').fillColor('#999');
    doc.text(
      'Document confidentiel - JETC Platform © 2025',
      50,
      750,
      { align: 'center', width: 500 }
    );

    // Finaliser le PDF
    doc.end();

  } catch (error) {
    console.error('Erreur génération PDF:', error);
    
    // Si headers pas encore envoyés, envoyer erreur JSON
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: 'Erreur génération PDF',
        details: error.message 
      });
    }
  }
};

// Helpers
function formatCurrency(amount) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

function formatPeriode(periode) {
  const [annee, mois] = periode.split('-');
  const moisNoms = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
                    'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  return `${moisNoms[parseInt(mois) - 1]} ${annee}`;
}

function truncate(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
