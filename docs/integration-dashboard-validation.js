// =====================================================
// JETC_IMMO - Script à ajouter au dashboard admin
// =====================================================
// Ce code doit être ajouté dans public/admin/dashboard.html
// À insérer dans la section <script> avant la fin du body

// =====================================================
// 1. HTML à ajouter (dans le <body>, après les autres sections)
// =====================================================

/*
<!-- NOUVELLE SECTION : Validation agences -->
<section class="admin-section" id="section-validation">
  <h2>🏢 Agences en attente de validation</h2>
  <div id="agencesEnAttente" class="agences-container"></div>
</section>
*/

// =====================================================
// 2. CSS à ajouter (dans le <style>)
// =====================================================

/*
.agences-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.agence-card {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  padding: 20px;
  transition: all 0.3s ease;
}

.agence-card:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
}

.agence-card h3 {
  color: #333;
  margin-bottom: 15px;
  font-size: 18px;
}

.agence-card p {
  color: #666;
  margin-bottom: 8px;
  font-size: 14px;
}

.agence-card strong {
  color: #333;
  font-weight: 600;
}

.agence-card .actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.btn-valider, .btn-refuser {
  flex: 1;
  padding: 10px 15px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-valider {
  background: #10b981;
  color: white;
}

.btn-valider:hover {
  background: #059669;
  transform: translateY(-2px);
}

.btn-refuser {
  background: #ef4444;
  color: white;
}

.btn-refuser:hover {
  background: #dc2626;
  transform: translateY(-2px);
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #999;
}

.empty-state p {
  font-size: 16px;
  margin-bottom: 10px;
}
*/

// =====================================================
// 3. JavaScript à ajouter
// =====================================================

// Charger les agences en attente
async function loadAgencesEnAttente() {
  try {
    // Récupérer le token
    const token = localStorage.getItem('jetc_access_token');
    
    if (!token) {
      console.error('[VALIDATION] Token non trouvé');
      return;
    }
    
    // Créer un client Supabase avec le token
    const { createClient } = supabase;
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
    
    // Charger les agences en attente via la vue SQL
    const { data, error } = await supabaseClient
      .from('admin_agences_en_attente')
      .select('*')
      .order('date_inscription', { ascending: false });
    
    if (error) {
      console.error('[VALIDATION] Erreur chargement agences:', error);
      document.getElementById('agencesEnAttente').innerHTML = `
        <div class="empty-state">
          <p>❌ Erreur lors du chargement des agences</p>
          <small>${error.message}</small>
        </div>
      `;
      return;
    }
    
    const container = document.getElementById('agencesEnAttente');
    
    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>✅ Aucune agence en attente de validation</p>
          <small>Toutes les demandes ont été traitées</small>
        </div>
      `;
      return;
    }
    
    // Afficher les agences
    container.innerHTML = data.map(agence => `
      <div class="agence-card" id="agence-${agence.id}">
        <h3>${escapeHtml(agence.nom_agence)}</h3>
        <p><strong>Email :</strong> ${escapeHtml(agence.email_contact)}</p>
        <p><strong>SIRET :</strong> ${agence.siret || 'Non fourni'}</p>
        <p><strong>Collaborateurs :</strong> ${agence.nb_collaborateurs}</p>
        <p><strong>Logements gérés :</strong> ${agence.nb_logements_geres}</p>
        <p><strong>Inscription :</strong> ${new Date(agence.date_inscription).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</p>
        
        <div class="actions">
          <button onclick="validerAgence('${agence.id}', '${escapeHtml(agence.nom_agence)}')" class="btn-valider">
            ✅ Valider
          </button>
          <button onclick="refuserAgence('${agence.id}', '${escapeHtml(agence.nom_agence)}')" class="btn-refuser">
            ❌ Refuser
          </button>
        </div>
      </div>
    `).join('');
    
    console.log(`[VALIDATION] ${data.length} agence(s) en attente`);
    
  } catch (error) {
    console.error('[VALIDATION] Exception:', error);
  }
}

// Valider une agence
async function validerAgence(regieId, regieNom) {
  if (!confirm(`Confirmer la validation de l'agence "${regieNom}" ?`)) {
    return;
  }
  
  try {
    const token = localStorage.getItem('jetc_access_token');
    
    const response = await fetch('/api/admin/valider-agence', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        regie_id: regieId,
        action: 'valider'
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert(`✅ Agence "${regieNom}" validée avec succès !\n\nL'agence peut maintenant se connecter à la plateforme.`);
      loadAgencesEnAttente(); // Recharger la liste
    } else {
      alert(`❌ Erreur lors de la validation :\n${result.error}`);
    }
    
  } catch (error) {
    console.error('[VALIDATION] Erreur validation:', error);
    alert('❌ Erreur de connexion au serveur');
  }
}

// Refuser une agence
async function refuserAgence(regieId, regieNom) {
  const commentaire = prompt(
    `Refuser l'agence "${regieNom}"\n\n` +
    `Raison du refus (sera envoyée à l'agence) :`
  );
  
  if (!commentaire || commentaire.trim().length === 0) {
    alert('Refus annulé : un commentaire est obligatoire');
    return;
  }
  
  if (!confirm(`Confirmer le refus de l'agence "${regieNom}" ?`)) {
    return;
  }
  
  try {
    const token = localStorage.getItem('jetc_access_token');
    
    const response = await fetch('/api/admin/valider-agence', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        regie_id: regieId,
        action: 'refuser',
        commentaire: commentaire.trim()
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert(`✅ Agence "${regieNom}" refusée\n\nL'agence a été notifiée du refus.`);
      loadAgencesEnAttente(); // Recharger la liste
    } else {
      alert(`❌ Erreur lors du refus :\n${result.error}`);
    }
    
  } catch (error) {
    console.error('[VALIDATION] Erreur refus:', error);
    alert('❌ Erreur de connexion au serveur');
  }
}

// Fonction utilitaire pour échapper le HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  // Charger les agences en attente
  loadAgencesEnAttente();
  
  // Recharger toutes les 30 secondes
  setInterval(loadAgencesEnAttente, 30000);
});

// =====================================================
// INSTRUCTIONS D'INTÉGRATION
// =====================================================

/*
ÉTAPES POUR INTÉGRER CE CODE AU DASHBOARD ADMIN :

1. Ouvrir public/admin/dashboard.html

2. Ajouter le HTML de la section (voir bloc commenté ci-dessus)
   → À placer avant </main> ou après les autres sections

3. Ajouter le CSS dans le <style> existant
   → Copier tout le bloc CSS commenté

4. Ajouter le JavaScript
   → Copier les 4 fonctions dans le <script> existant
   → S'assurer que les appels sont bien dans DOMContentLoaded

5. Vérifier que Supabase est bien initialisé
   → Variables SUPABASE_URL et SUPABASE_ANON_KEY doivent exister

6. Tester :
   - Se connecter en tant qu'admin_jtec
   - Vérifier que la section "Agences en attente" s'affiche
   - Créer une agence test et valider le workflow
*/
