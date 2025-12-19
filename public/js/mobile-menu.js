/**
 * ================================
 * MOBILE MENU HANDLER - JETC_IMMO
 * ================================
 * 
 * Gestion du burger menu mobile pour les dashboards
 * À inclure dans chaque dashboard après le HTML
 */

(function() {
  'use strict';

  // Vérifier si on est sur mobile
  function isMobile() {
    return window.innerWidth <= 768;
  }

  // Initialiser le burger menu
  function initMobileMenu() {
    // Ne rien faire si on n'est pas sur mobile
    if (!isMobile()) {
      return;
    }

    // Créer le bouton burger si pas déjà présent
    if (!document.querySelector('.burger-btn')) {
      createBurgerButton();
    }

    // Créer l'overlay si pas déjà présent
    if (!document.querySelector('.sidebar-overlay')) {
      createOverlay();
    }

    // Attacher les event listeners
    attachEventListeners();
  }

  // Créer le bouton burger
  function createBurgerButton() {
    const burgerBtn = document.createElement('button');
    burgerBtn.className = 'burger-btn';
    burgerBtn.setAttribute('aria-label', 'Toggle menu');
    burgerBtn.setAttribute('aria-expanded', 'false');
    
    burgerBtn.innerHTML = `
      <div class="burger-icon">
        <span class="burger-line"></span>
        <span class="burger-line"></span>
        <span class="burger-line"></span>
      </div>
    `;
    
    document.body.appendChild(burgerBtn);
  }

  // Créer l'overlay
  function createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
  }

  // Ouvrir la sidebar
  function openSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const burgerBtn = document.querySelector('.burger-btn');
    
    if (sidebar) {
      sidebar.classList.add('mobile-open');
      document.body.classList.add('sidebar-open');
      burgerBtn.classList.add('active');
      burgerBtn.setAttribute('aria-expanded', 'true');
      overlay.classList.add('active');
      
      // Focus sur le premier menu item pour accessibilité
      setTimeout(() => {
        const firstMenuItem = sidebar.querySelector('.menu-item');
        if (firstMenuItem) {
          firstMenuItem.focus();
        }
      }, 300);
    }
  }

  // Fermer la sidebar
  function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const burgerBtn = document.querySelector('.burger-btn');
    
    if (sidebar) {
      sidebar.classList.remove('mobile-open');
      document.body.classList.remove('sidebar-open');
      burgerBtn.classList.remove('active');
      burgerBtn.setAttribute('aria-expanded', 'false');
      overlay.classList.remove('active');
      
      // Retour focus sur burger button
      burgerBtn.focus();
    }
  }

  // Toggle sidebar
  function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && sidebar.classList.contains('mobile-open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  // Attacher les event listeners
  function attachEventListeners() {
    const burgerBtn = document.querySelector('.burger-btn');
    const overlay = document.querySelector('.sidebar-overlay');

    // Click sur le bouton burger
    if (burgerBtn) {
      burgerBtn.addEventListener('click', toggleSidebar);
    }

    // Click sur l'overlay pour fermer
    if (overlay) {
      overlay.addEventListener('click', closeSidebar);
    }

    // Touche Escape pour fermer
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeSidebar();
      }
    });

    // Fermer si on clique sur un menu item (navigation)
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
      item.addEventListener('click', function() {
        // Petit délai pour permettre la navigation
        setTimeout(closeSidebar, 150);
      });
    });

    // Re-vérifier au resize de la fenêtre
    let resizeTimeout;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function() {
        // Si on passe en desktop, fermer la sidebar mobile
        if (!isMobile()) {
          const sidebar = document.querySelector('.sidebar');
          const overlay = document.querySelector('.sidebar-overlay');
          const burgerBtn = document.querySelector('.burger-btn');
          
          if (sidebar) {
            sidebar.classList.remove('mobile-open');
            document.body.classList.remove('sidebar-open');
            if (burgerBtn) burgerBtn.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
          }
        }
      }, 250);
    });
  }

  // Initialiser au chargement du DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileMenu);
  } else {
    initMobileMenu();
  }

  // Exposer la fonction toggle pour usage externe si besoin
  window.JETC_IMMO = window.JETC_IMMO || {};
  window.JETC_IMMO.toggleMobileMenu = toggleSidebar;
  window.JETC_IMMO.closeMobileMenu = closeSidebar;
  window.JETC_IMMO.openMobileMenu = openSidebar;

})();
