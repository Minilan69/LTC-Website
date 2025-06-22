// ui-handlers.js - Gestionnaires d'événements pour l'interface utilisateur

class UIHandlers {
    constructor() {
        this.init();
    }

    init() {
        this.bindEventListeners();
    }

    bindEventListeners() {
        // Attendre que le DOM soit chargé
        document.addEventListener('DOMContentLoaded', () => {
            this.setupMapControls();
            this.setupMemberSearch();
        });
    }

    setupMapControls() {
        // Bouton pour basculer le mode édition
        const toggleBtn = document.getElementById('toggle-position-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                if (window.mapManager) {
                    window.mapManager.toggleEditMode();
                }
            });
        }

        // Bouton pour supprimer le point utilisateur
        const deleteBtn = document.getElementById('delete-point-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (window.mapManager) {
                    window.mapManager.deletePoint();
                }
            });
        }
    }

    showLoadingSpinner() {
        const spinner = document.createElement('div');
        spinner.id = 'loading-spinner';
        spinner.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 50px;
      height: 50px;
      border: 4px solid #334155;
      border-top: 4px solid #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      z-index: 10000;
    `;

        // Ajouter l'animation CSS
        const style = document.createElement('style');
        style.textContent = `
      @keyframes spin {
        0% { transform: translate(-50%, -50%) rotate(0deg); }
        100% { transform: translate(-50%, -50%) rotate(360deg); }
      }
    `;
        document.head.appendChild(style);
        document.body.appendChild(spinner);

        return spinner;
    }

    hideLoadingSpinner() {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) {
            spinner.remove();
        }
    }

    // Gestion responsive
    handleResize() {
        const sidebar = document.querySelector('.sidebar');
        const mapContainer = document.querySelector('.map-container');

        if (window.innerWidth <= 768) {
            // Mode mobile
            if (sidebar) {
                sidebar.classList.add('mobile');
            }
        } else {
            // Mode desktop
            if (sidebar) {
                sidebar.classList.remove('mobile');
            }
        }
    }
}

// Initialisation des gestionnaires UI
const uiHandlers = new UIHandlers();

// Écouter les changements de taille d'écran
window.addEventListener('resize', () => {
    uiHandlers.handleResize();
});

// Exposer globalement pour l'utilisation dans d'autres scripts
window.uiHandlers = uiHandlers;