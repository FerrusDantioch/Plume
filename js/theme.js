// Thèmes de couleurs (définis dans css/themes.css).
// Au chargement, un petit script dans index.html applique déjà le thème
// mémorisé avant l'affichage ; ce module gère ensuite le choix dans le menu.

export const THEMES = [
  { id: 'omni', nom: 'Omni-système' },
  { id: 'sombre', nom: 'Sombre' },
  { id: 'clair', nom: 'Clair' },
];

export const THEME_PAR_DEFAUT = 'omni';

/** Applique un thème : attribut data-theme, couleur de la barre du navigateur. */
export function appliquerTheme(id) {
  const theme = THEMES.some((t) => t.id === id) ? id : THEME_PAR_DEFAUT;
  const racine = document.documentElement;
  racine.dataset.theme = theme;
  const styles = getComputedStyle(racine);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', styles.getPropertyValue('--surface').trim());
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', styles.getPropertyValue('color-scheme').trim());
  return theme;
}

/**
 * Construit le choix du thème (trois boutons radio avec une pastille
 * d'aperçu) dans `conteneur`, et mémorise le choix.
 */
export function creerChoixTheme({ conteneur, preferences }) {
  const actuel = appliquerTheme(preferences.lire('theme', THEME_PAR_DEFAUT));
  for (const theme of THEMES) {
    const etiquette = document.createElement('label');
    etiquette.className = 'choix-theme';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'theme';
    radio.value = theme.id;
    radio.checked = theme.id === actuel;
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      appliquerTheme(theme.id);
      preferences.ecrire('theme', theme.id);
    });
    // La pastille porte le thème qu'elle représente : ses couleurs viennent
    // directement de themes.css.
    const pastille = document.createElement('span');
    pastille.className = 'pastille-theme';
    pastille.dataset.theme = theme.id;
    pastille.setAttribute('aria-hidden', 'true');
    const nom = document.createElement('span');
    nom.textContent = theme.nom;
    etiquette.append(radio, pastille, nom);
    conteneur.append(etiquette);
  }
}
