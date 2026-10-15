// Composants d'interface communs à la suite : fenêtres (<dialog>),
// question de confirmation, messages temporaires, fenêtre « À propos ».
// Rien ici n'est propre au traitement de texte.

const ELEMENTS_FOCALISABLES = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function estVisible(element) {
  if (!element?.isConnected || element.disabled) return false;
  if (element.closest('dialog:not([open]), [hidden]')) return false;
  return element.getClientRects().length > 0;
}

/**
 * Prépare toutes les fenêtres de la page :
 * - un bouton portant data-fermer="valeur" ferme sa fenêtre ;
 * - Échap ferme la fenêtre (comportement natif de <dialog>) ;
 * - un clic à côté ferme les fenêtres marquées data-fermeture-exterieure ;
 * - la touche Tab reste à l'intérieur de la fenêtre ouverte ;
 * - à la fermeture, le focus revient sur le bouton qui l'a ouverte.
 */
export function initialiserFenetres() {
  document.addEventListener('click', (e) => {
    const bouton = e.target.closest('[data-fermer]');
    if (bouton) bouton.closest('dialog')?.close(bouton.dataset.fermer);
  });
  for (const fenetre of document.querySelectorAll('dialog')) {
    fenetre.addEventListener('close', () => {
      const cible = [fenetre.declencheur, fenetre.repli].find(estVisible);
      fenetre.declencheur = null;
      cible?.focus();
    });
    fenetre.addEventListener('click', (e) => {
      if (e.target !== fenetre || !('fermetureExterieure' in fenetre.dataset)) return;
      const r = fenetre.getBoundingClientRect();
      const dehors = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      if (dehors) fenetre.close();
    });
    fenetre.addEventListener('keydown', (e) => garderLeFocus(e, fenetre));
  }
}

function garderLeFocus(e, fenetre) {
  if (e.key !== 'Tab') return;
  const elements = [...fenetre.querySelectorAll(ELEMENTS_FOCALISABLES)].filter(
    (el) => estVisible(el) && !(el.type === 'radio' && !el.checked),
  );
  if (elements.length === 0) return;
  const premier = elements[0];
  const dernier = elements.at(-1);
  if (e.shiftKey && document.activeElement === premier) {
    e.preventDefault();
    dernier.focus();
  } else if (!e.shiftKey && document.activeElement === dernier) {
    e.preventDefault();
    premier.focus();
  }
}

/**
 * Ouvre une fenêtre. `declencheur` recevra le focus à la fermeture ; s'il
 * n'est plus visible, c'est `repli` qui le recevra.
 */
export function ouvrirFenetre(fenetre, { declencheur = document.activeElement, repli = null } = {}) {
  fenetre.declencheur = declencheur;
  fenetre.repli = repli;
  if (!fenetre.open) fenetre.showModal();
}

/**
 * Pose une question avec deux boutons. Renvoie une promesse : true si la
 * personne confirme, false sinon (bouton « Annuler » ou touche Échap).
 * Le bouton qui a le focus au départ est toujours « Annuler ».
 */
export function demander({ titre, message, confirmer = 'Confirmer', annuler = 'Annuler', danger = false, declencheur }) {
  const fenetre = document.getElementById('fenetre-question');
  const boutonOui = fenetre.querySelector('[data-fermer="oui"]');
  const boutonNon = fenetre.querySelector('[data-fermer="non"]');
  fenetre.querySelector('h2').textContent = titre;
  fenetre.querySelector('.question-message').textContent = message;
  boutonOui.textContent = confirmer;
  boutonOui.className = `bouton ${danger ? 'bouton-danger' : 'bouton-principal'}`;
  boutonNon.textContent = annuler;
  boutonNon.hidden = false;
  return new Promise((resoudre) => {
    fenetre.returnValue = '';
    fenetre.addEventListener('close', () => resoudre(fenetre.returnValue === 'oui'), { once: true });
    ouvrirFenetre(fenetre, { declencheur });
    boutonNon.focus();
  });
}

/** Affiche une information avec un seul bouton. */
export function informer({ titre, message, bouton = 'Compris', declencheur }) {
  const fenetre = document.getElementById('fenetre-question');
  const boutonOui = fenetre.querySelector('[data-fermer="oui"]');
  fenetre.querySelector('h2').textContent = titre;
  fenetre.querySelector('.question-message').textContent = message;
  boutonOui.textContent = bouton;
  boutonOui.className = 'bouton bouton-principal';
  fenetre.querySelector('[data-fermer="non"]').hidden = true;
  return new Promise((resoudre) => {
    fenetre.addEventListener('close', () => resoudre(), { once: true });
    ouvrirFenetre(fenetre, { declencheur });
    boutonOui.focus();
  });
}

/**
 * Message temporaire en bas de l'écran. Options : `action` (texte d'un
 * bouton), `surAction` (fonction), `duree` en ms (0 = reste affiché).
 */
export function afficherMessage(texte, { action, surAction, duree = 4000 } = {}) {
  const zone = document.getElementById('zone-messages');
  const message = document.createElement('div');
  message.className = 'message';
  const paragraphe = document.createElement('p');
  paragraphe.textContent = texte;
  message.append(paragraphe);
  const fermer = () => message.remove();
  if (action) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'bouton bouton-principal';
    bouton.textContent = action;
    bouton.addEventListener('click', () => {
      fermer();
      surAction?.();
    });
    message.append(bouton);
  }
  if (!duree) {
    const croix = document.createElement('button');
    croix.type = 'button';
    croix.className = 'bouton bouton-icone bouton-discret';
    croix.setAttribute('aria-label', 'Fermer ce message');
    croix.title = 'Fermer';
    croix.innerHTML = '<svg class="icone" aria-hidden="true"><use href="#i-fermer"></use></svg>';
    croix.addEventListener('click', fermer);
    message.append(croix);
  }
  zone.append(message);
  if (duree) setTimeout(fermer, duree);
  return message;
}

/** Remplit la fenêtre « À propos » avec les réglages de config.js. */
export function remplirAPropos(fenetre, config) {
  fenetre.querySelector('.nom-application').textContent = config.nom;
  fenetre.querySelector('.version').textContent = `Version ${config.version}`;
  const contact = fenetre.querySelector('.contact');
  contact.href = `mailto:${config.contact}`;
  contact.textContent = config.contact;
  fenetre.querySelector('.lien-omni').href = config.siteOmni;
}
