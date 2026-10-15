// Sauvegarde de tous les documents dans un fichier, et restauration.

import { readFile } from 'node:fs/promises';
import { test, expect, ouvrir, contenu, attendreEnregistrement } from './aides.js';

async function sauvegarder(page) {
  await page.click('#bouton-menu');
  const [telechargement] = await Promise.all([page.waitForEvent('download'), page.click('#bouton-sauvegarder')]);
  const chemin = await telechargement.path();
  return { nom: telechargement.suggestedFilename(), texte: await readFile(chemin, 'utf8') };
}

async function restaurer(page, nom, texte) {
  await page.click('#bouton-menu');
  const [choix] = await Promise.all([page.waitForEvent('filechooser'), page.click('#bouton-restaurer')]);
  await choix.setFiles({ name: nom, mimeType: 'application/json', buffer: Buffer.from(texte) });
}

async function viderLaBase(page) {
  await page.evaluate(
    () =>
      new Promise((resoudre, rejeter) => {
        localStorage.clear();
        const requete = indexedDB.deleteDatabase('plume');
        requete.onsuccess = resoudre;
        requete.onerror = rejeter;
      }),
  );
  await page.reload();
  await page.locator('#feuille[contenteditable="true"]').waitFor();
}

test('exporter, vider la base, restaurer', async ({ page }) => {
  await ouvrir(page);
  await page.fill('#titre-document', 'Lettre');
  await page.locator('#feuille').click();
  await page.keyboard.type('Chère amie');
  await attendreEnregistrement(page);
  await page.click('#bouton-documents');
  await page.click('#bouton-nouveau-document');
  await expect(page.locator('#tiroir-documents')).toBeHidden();
  await page.fill('#titre-document', 'Liste');
  await page.locator('#feuille').click();
  await page.keyboard.type('Pain, lait');
  await attendreEnregistrement(page);

  const { nom, texte } = await sauvegarder(page);
  const aujourdhui = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  expect(nom).toBe(`plume-sauvegarde-${aujourdhui}.json`);
  const donnees = JSON.parse(texte);
  expect(donnees.format).toBe('plume-sauvegarde');
  expect(donnees.version).toBe(1);
  expect(donnees.documents.map((d) => d.titre).sort()).toEqual(['Lettre', 'Liste']);

  await viderLaBase(page);
  await page.click('#bouton-documents');
  await expect(page.locator('#liste-documents .document')).toHaveCount(1); // le document vide de départ
  await page.keyboard.press('Escape');

  await restaurer(page, nom, texte);
  const question = page.locator('#fenetre-question');
  await expect(question.locator('.question-message')).toContainText('Ce fichier contient 2 documents.');
  await question.getByRole('button', { name: 'Ajouter les documents' }).click();
  await expect(question.locator('.question-message')).toHaveText('2 documents ajoutés.');
  await question.getByRole('button', { name: 'Compris' }).click();

  await page.click('#bouton-documents');
  // Les documents restaurés gardent leur date : le document vide créé après
  // l'effacement est le plus récent.
  await expect(page.locator('#liste-documents .document-titre')).toHaveText(['Sans titre', 'Liste', 'Lettre']);
  await page.locator('#liste-documents .document-ouvrir', { hasText: 'Lettre' }).click();
  await expect(page.locator('#tiroir-documents')).toBeHidden();
  expect(await contenu(page)).toBe('<p>Chère amie</p>');

  // Restaurer une deuxième fois la même sauvegarde : rien n'est ajouté en double.
  await restaurer(page, nom, texte);
  await question.getByRole('button', { name: 'Ajouter les documents' }).click();
  await expect(question.locator('.question-message')).toHaveText(
    "0 document ajouté. 2 documents étaient déjà présents à l'identique : rien n'a été ajouté en double.",
  );
  await question.getByRole('button', { name: 'Compris' }).click();

  // Même identifiant mais contenu différent : ajouté comme copie, jamais remplacé.
  const modifiee = JSON.parse(texte);
  modifiee.documents[0].html = '<p>Version modifiée</p>';
  await restaurer(page, nom, JSON.stringify(modifiee));
  await question.getByRole('button', { name: 'Ajouter les documents' }).click();
  await expect(question.locator('.question-message')).toContainText('1 document ajouté.');
  await question.getByRole('button', { name: 'Compris' }).click();
  await page.click('#bouton-documents');
  await expect(page.locator('#liste-documents .document')).toHaveCount(4);
  await expect(page.locator('#liste-documents .document-titre', { hasText: '(restauré)' })).toHaveCount(1);
});

test('un fichier invalide est refusé avec un message clair', async ({ page }) => {
  await ouvrir(page);
  const cas = [
    ['pas du json', "Ce fichier n'est pas une sauvegarde : son contenu n'est pas lisible."],
    [JSON.stringify({ format: 'autre-chose', version: 1, documents: [] }), "Ce fichier n'est pas une sauvegarde de Plume."],
    [JSON.stringify({ format: 'plume-sauvegarde', version: 1, documents: [] }), 'Cette sauvegarde ne contient aucun document.'],
    [
      JSON.stringify({ format: 'plume-sauvegarde', version: 1, documents: [{ id: 'a', titre: 'x', html: 3, creeLe: '2026-01-01', modifieLe: '2026-01-01' }] }),
      "Le document n° 1 de la sauvegarde est invalide (contenu manquant). Rien n'a été restauré.",
    ],
    [JSON.stringify({ format: 'plume-sauvegarde', version: 9, documents: [] }), "Cette sauvegarde vient d'une version plus récente de Plume. Mets l'application à jour, puis réessaie."],
  ];
  for (const [texte, message] of cas) {
    await restaurer(page, 'fichier.json', texte);
    const question = page.locator('#fenetre-question');
    await expect(question.locator('h2')).toHaveText('Restauration impossible');
    await expect(question.locator('.question-message')).toHaveText(message);
    await question.getByRole('button', { name: 'Compris' }).click();
  }
  await page.click('#bouton-documents');
  await expect(page.locator('#liste-documents .document')).toHaveCount(1);
});

test('un contenu malveillant est nettoyé', async ({ page }) => {
  await ouvrir(page);
  page.on('dialog', (d) => {
    throw new Error(`Une fenêtre a été ouverte par du code injecté : ${d.message()}`);
  });
  const piege = {
    format: 'plume-sauvegarde',
    version: 1,
    documents: [
      {
        id: 'piege',
        titre: '<img src=x onerror=alert(1)>Piège',
        html:
          '<p onclick="alert(1)" style="color: red; position: fixed; background-image: url(javascript:alert(1))">Texte <b onmouseover="alert(2)">gras</b></p>' +
          '<script>alert(3)</script><img src="x" onerror="alert(4)"><iframe src="javascript:alert(5)"></iframe>' +
          '<a href="javascript:alert(6)">lien</a><svg onload="alert(7)"><circle/></svg>' +
          '<style>body{display:none}</style><p style="font-family: evil; font-size: 9999px">grand</p>',
        creeLe: '2026-01-01T10:00:00.000Z',
        modifieLe: '2030-01-01T10:00:00.000Z',
      },
    ],
  };
  await restaurer(page, 'piege.json', JSON.stringify(piege));
  const question = page.locator('#fenetre-question');
  await question.getByRole('button', { name: 'Ajouter les documents' }).click();
  await question.getByRole('button', { name: 'Compris' }).click();
  await page.click('#bouton-documents');
  await page.locator('#liste-documents .document-ouvrir').first().click();
  await expect(page.locator('#tiroir-documents')).toBeHidden();
  const html = await contenu(page);
  expect(html).toBe('<p style="color: rgb(255, 0, 0);">Texte <b>gras</b></p><p>lien</p><p>grand</p>');
  // Le titre est affiché comme du texte, jamais interprété.
  await expect(page.locator('#titre-document')).toHaveValue('<img src=x onerror=alert(1)>Piège');
  expect(await page.locator('#feuille script, #feuille img, #feuille iframe, #feuille svg, #feuille a').count()).toBe(0);
  expect(await page.evaluate(() => document.querySelectorAll('[onerror], [onclick], [onload], [onmouseover]').length)).toBe(0);
});
