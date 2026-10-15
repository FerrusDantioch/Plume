// Listes de choix proposées dans la barre d'outils : tailles, polices,
// couleurs du texte et couleurs de surlignage. Ce sont des données du
// document (pas des couleurs d'interface) : elles restent identiques quel
// que soit le thème.

export const TAILLES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
export const TAILLE_PAR_DEFAUT = 12;

// `pile` est la valeur CSS ; null signifie « police par défaut de la page ».
export const POLICES = [
  { id: 'literata', nom: 'Literata', pile: null },
  { id: 'sans', nom: 'Sans-serif', pile: 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  { id: 'machine', nom: 'Machine à écrire', pile: '"JetBrains Mono", ui-monospace, monospace' },
];

/** Reconnaît une police à partir de sa valeur CSS (ou renvoie null). */
export function policeDepuisCss(valeur) {
  const v = (valeur ?? '').toLowerCase();
  if (v.includes('jetbrains') || v.includes('monospace')) return POLICES[2];
  if (v.includes('sans-serif') || v.includes('system-ui')) return POLICES[1];
  if (v.includes('literata') || v.includes('serif')) return POLICES[0];
  return null;
}

// `valeur` null signifie « Automatique » (couleur du thème) ou « Aucun ».
export const COULEURS_TEXTE = [
  { nom: 'Automatique', valeur: null },
  { nom: 'Noir', valeur: '#000000' },
  { nom: 'Blanc', valeur: '#ffffff' },
  { nom: 'Gris', valeur: '#8b8d98' },
  { nom: 'Rouge', valeur: '#e5484d' },
  { nom: 'Orange', valeur: '#f76b15' },
  { nom: 'Jaune', valeur: '#ffc53d' },
  { nom: 'Vert', valeur: '#30a46c' },
  { nom: 'Cyan', valeur: '#05a2c2' },
  { nom: 'Bleu', valeur: '#0090ff' },
  { nom: 'Violet', valeur: '#8e4ec6' },
  { nom: 'Rose', valeur: '#d6409f' },
];

export const COULEURS_SURLIGNAGE = [
  { nom: 'Aucun', valeur: null },
  { nom: 'Jaune', valeur: '#ffe066' },
  { nom: 'Vert', valeur: '#8ce99a' },
  { nom: 'Cyan', valeur: '#74d7ee' },
  { nom: 'Rose', valeur: '#f7a8d4' },
  { nom: 'Orange', valeur: '#ffb36b' },
  { nom: 'Violet', valeur: '#c4a7ff' },
  { nom: 'Gris', valeur: '#ced4da' },
];

let pinceau = null; // sert à traduire les noms de couleurs (« red »)

/** Convertit « rgb(229, 72, 77) », « #E5484D » ou « red » en hexadécimal (sinon null). */
export function versHexa(couleur) {
  if (!couleur) return null;
  let c = couleur.trim().toLowerCase();
  if (/^[a-z]{3,30}$/.test(c) && c !== 'transparent') {
    pinceau ??= document.createElement('canvas').getContext('2d');
    pinceau.fillStyle = '#010203'; // valeur témoin : inchangée si le nom est inconnu
    pinceau.fillStyle = c;
    c = pinceau.fillStyle;
    if (c === '#010203') return null;
  }
  if (/^#[0-9a-f]{6}$/.test(c)) return c;
  if (/^#[0-9a-f]{3}$/.test(c)) return '#' + [...c.slice(1)].map((x) => x + x).join('');
  const m = c.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/);
  if (!m) return null;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return null; // transparent
  return '#' + m.slice(1, 4).map((x) => Math.min(255, Number(x)).toString(16).padStart(2, '0')).join('');
}
