// Typographie française automatique (réglage dans le menu, activé par défaut).

import { test, expect, ouvrir } from './aides.js';

const INSECABLE = ' ';
const FINE = ' ';

async function taper(page, texte) {
  await page.evaluate(() => {
    const feuille = document.getElementById('feuille');
    feuille.innerHTML = '<p><br></p>';
  });
  await page.locator('#feuille').click();
  await page.keyboard.type(texte);
  return page.evaluate(() => document.getElementById('feuille').textContent);
}

test('espaces insécables, guillemets et apostrophe pendant la frappe', async ({ page }) => {
  await ouvrir(page);
  const cas = [
    ['Bonjour!', `Bonjour${FINE}!`],
    ['Bonjour !', `Bonjour${FINE}!`],
    ['Vraiment ?!', `Vraiment${FINE}?!`],
    ['Liste ; suite', `Liste${FINE}; suite`],
    ['Note: ceci', `Note${INSECABLE}: ceci`],
    ['Il est 14:30', 'Il est 14:30'],
    ['Voir https://exemple.fr', 'Voir https://exemple.fr'],
    ['Il a dit "oui" puis "non".', `Il a dit «${INSECABLE}oui${INSECABLE}» puis «${INSECABLE}non${INSECABLE}».`],
    ['(entre "guillemets")', `(entre «${INSECABLE}guillemets${INSECABLE}»)`],
    ['« bonjour »', `«${INSECABLE}bonjour${INSECABLE}»`],
    ["L'arbre d'aujourd'hui", 'L’arbre d’aujourd’hui'],
    ['! seul', '! seul'],
  ];
  for (const [tape, attendu] of cas) expect(await taper(page, tape), tape).toBe(attendu);
});

test('un texte collé reste tel quel', async ({ page }) => {
  await ouvrir(page);
  await page.locator('#feuille').click();
  await page.evaluate(() => {
    const donnees = new DataTransfer();
    donnees.setData('text/plain', 'Collé! "texte" l\'ami');
    document.getElementById('feuille').dispatchEvent(new ClipboardEvent('paste', { clipboardData: donnees, bubbles: true, cancelable: true }));
  });
  expect(await page.evaluate(() => document.getElementById('feuille').textContent)).toBe('Collé! "texte" l\'ami');
});

test('le réglage du menu désactive la typographie, et il est mémorisé', async ({ page }) => {
  await ouvrir(page);
  await page.click('#bouton-menu');
  const caseACocher = page.getByRole('checkbox', { name: 'Typographie française automatique' });
  await expect(caseACocher).toBeChecked();
  await caseACocher.uncheck();
  await page.keyboard.press('Escape');
  expect(await taper(page, 'Non! "brut" l\'ami')).toBe('Non! "brut" l\'ami');
  await page.reload();
  await page.locator('#feuille[contenteditable="true"]').waitFor();
  await page.click('#bouton-menu');
  await expect(caseACocher).not.toBeChecked();
  await caseACocher.check();
  await page.keyboard.press('Escape');
  expect(await taper(page, 'Oui!')).toBe(`Oui${FINE}!`);
});
