// Corbeille : un document supprimé reste récupérable pendant 30 jours.

import { readFile } from 'node:fs/promises';
import { test, expect, ouvrir, contenu, attendreEnregistrement } from './aides.js';

const JOUR = 24 * 60 * 60 * 1000;

/** Écrit des documents directement dans la base de données de l'application. */
function ecrireDocuments(page, documents) {
  return page.evaluate(
    (liste) =>
      new Promise((resoudre, rejeter) => {
        const requete = indexedDB.open('plume', 1);
        requete.onsuccess = () => {
          const transaction = requete.result.transaction('documents', 'readwrite');
          for (const doc of liste) transaction.objectStore('documents').put(doc);
          transaction.oncomplete = () => {
            requete.result.close();
            resoudre();
          };
          transaction.onerror = () => rejeter(transaction.error);
        };
        requete.onerror = () => rejeter(requete.error);
      }),
    documents,
  );
}

function lireDocuments(page) {
  return page.evaluate(
    () =>
      new Promise((resoudre) => {
        const requete = indexedDB.open('plume', 1);
        requete.onsuccess = () => {
          const lecture = requete.result.transaction('documents').objectStore('documents').getAll();
          lecture.onsuccess = () => {
            requete.result.close();
            resoudre(lecture.result);
          };
        };
      }),
  );
}

async function nouveauDocument(page, titre, texte) {
  await page.click('#bouton-documents');
  await page.click('#bouton-nouveau-document');
  await expect(page.locator('#tiroir-documents')).toBeHidden();
  await page.fill('#titre-document', titre);
  await page.locator('#feuille').click();
  await page.keyboard.type(texte);
  await attendreEnregistrement(page);
}

async function ouvrirCorbeille(page) {
  await page.click('#bouton-documents');
  await page.click('#bouton-corbeille');
  await expect(page.locator('#tiroir-corbeille')).toBeVisible();
}

test('mettre à la corbeille, remettre, supprimer définitivement, vider', async ({ page }) => {
  await ouvrir(page);
  await page.fill('#titre-document', 'Premier');
  await attendreEnregistrement(page);
  await nouveauDocument(page, 'Deuxième', 'Texte du deuxième');
  await nouveauDocument(page, 'Troisième', 'Texte du troisième');

  // Deux documents à la corbeille.
  await page.click('#bouton-documents');
  await expect(page.locator('#libelle-corbeille')).toHaveText('Corbeille (vide)');
  await page.getByRole('button', { name: 'Mettre « Deuxième » à la corbeille' }).click();
  await page.getByRole('button', { name: 'Mettre « Premier » à la corbeille' }).click();
  await expect(page.locator('#liste-documents .document-titre')).toHaveText(['Troisième']);
  await expect(page.locator('#libelle-corbeille')).toHaveText('Corbeille (2)');

  // La corbeille : dernier supprimé en premier, dates, nombre de jours restants.
  await page.click('#bouton-corbeille');
  const corbeille = page.locator('#tiroir-corbeille');
  await expect(corbeille).toBeVisible();
  await expect(page.locator('#tiroir-documents')).toBeHidden();
  await expect(corbeille.locator('#description-corbeille')).toHaveText(
    'Les documents restent ici 30 jours. Ensuite, ils sont supprimés définitivement.',
  );
  await expect(corbeille.locator('.document-jete .document-titre')).toHaveText(['Premier', 'Deuxième']);
  await expect(corbeille.locator('.document-jete').first()).toContainText(/Mis à la corbeille le \d{1,2} \S+ \d{4} à \d\d:\d\d/);
  await expect(corbeille.locator('.document-jete').first()).toContainText('Suppression définitive dans 30 jours');
  await expect(corbeille.getByRole('button', { name: 'Remettre « Premier » dans mes documents' })).toBeFocused();

  // Remettre « Deuxième » : il revient dans la liste, avec son texte.
  await corbeille.getByRole('button', { name: 'Remettre « Deuxième » dans mes documents' }).click();
  await expect(page.locator('.message', { hasText: '« Deuxième » est de retour dans tes documents.' })).toBeVisible();
  await expect(corbeille.locator('.document-jete .document-titre')).toHaveText(['Premier']);
  await page.click('#bouton-retour-documents');
  await expect(page.locator('#tiroir-documents')).toBeVisible();
  await expect(page.locator('#bouton-corbeille')).toBeFocused();
  await expect(page.locator('#liste-documents .document-titre')).toHaveText(['Troisième', 'Deuxième']);
  await page.locator('#liste-documents .document-ouvrir', { hasText: 'Deuxième' }).click();
  await expect(page.locator('#titre-document')).toHaveValue('Deuxième');
  expect(await contenu(page)).toBe('<p>Texte du deuxième</p>');

  // Supprimer définitivement : une question, « Annuler » a le focus.
  await ouvrirCorbeille(page);
  await corbeille.getByRole('button', { name: 'Supprimer définitivement « Premier »' }).click();
  const question = page.locator('#fenetre-question');
  await expect(question.locator('.question-message')).toHaveText('Supprimer définitivement « Premier » ? Cette action est irréversible.');
  await expect(question.getByRole('button', { name: 'Annuler' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(corbeille.locator('.document-jete')).toHaveCount(1);
  await corbeille.getByRole('button', { name: 'Supprimer définitivement « Premier »' }).click();
  await question.getByRole('button', { name: 'Supprimer définitivement' }).click();
  await expect(corbeille.locator('.liste-vide')).toHaveText('La corbeille est vide.');
  await expect(page.locator('#bouton-vider-corbeille')).toBeHidden();
  expect((await lireDocuments(page)).map((d) => d.titre).sort()).toEqual(['Deuxième', 'Troisième']);

  // Vider la corbeille.
  await page.click('#bouton-retour-documents');
  await page.getByRole('button', { name: 'Mettre « Troisième » à la corbeille' }).click();
  await page.click('#bouton-corbeille');
  await page.click('#bouton-vider-corbeille');
  await expect(question.locator('.question-message')).toHaveText(
    'Le document de la corbeille sera supprimé définitivement. Cette action est irréversible.',
  );
  await question.getByRole('button', { name: 'Vider la corbeille' }).click();
  await expect(corbeille.locator('.liste-vide')).toHaveText('La corbeille est vide.');
  expect((await lireDocuments(page)).map((d) => d.titre)).toEqual(['Deuxième']);
});

test('« Annuler » dans le message remet le document, et le rouvre s’il était ouvert', async ({ page }) => {
  await ouvrir(page);
  await page.fill('#titre-document', 'Autre');
  await attendreEnregistrement(page);
  await nouveauDocument(page, 'Important', 'Ne pas perdre');
  await page.click('#bouton-documents');
  await page.getByRole('button', { name: 'Mettre « Important » à la corbeille' }).click();
  await expect(page.locator('#titre-document')).toHaveValue('Autre');
  await page.keyboard.press('Escape');
  await page.locator('.message', { hasText: '« Important » est dans la corbeille.' }).getByRole('button', { name: 'Annuler' }).click();
  await expect(page.locator('.message', { hasText: '« Important » est de retour dans tes documents.' })).toBeVisible();
  await expect(page.locator('#titre-document')).toHaveValue('Important');
  expect(await contenu(page)).toBe('<p>Ne pas perdre</p>');
});

test('après 30 jours, un document de la corbeille est supprimé au lancement', async ({ page }) => {
  await ouvrir(page);
  const maintenant = Date.now();
  const doc = (titre, jours) => ({
    id: `essai-${titre}`,
    titre,
    html: `<p>${titre}</p>`,
    creeLe: new Date(maintenant - 40 * JOUR).toISOString(),
    modifieLe: new Date(maintenant - 40 * JOUR).toISOString(),
    supprimeLe: new Date(maintenant - jours * JOUR).toISOString(),
  });
  await ecrireDocuments(page, [doc('Ancien', 31), doc('Récent', 29.5)]);
  await page.reload();
  await page.locator('#feuille[contenteditable="true"]').waitFor();
  expect((await lireDocuments(page)).map((d) => d.titre)).not.toContain('Ancien');
  await ouvrirCorbeille(page);
  await expect(page.locator('.document-jete .document-titre')).toHaveText(['Récent']);
  await expect(page.locator('.document-jete')).toContainText('Suppression définitive dans 1 jour');
});

test('la sauvegarde ne contient pas la corbeille ; restaurer un document jeté le remet', async ({ page }) => {
  await ouvrir(page);
  await page.fill('#titre-document', 'Gardé');
  await attendreEnregistrement(page);
  await nouveauDocument(page, 'Jeté', 'Contenu jeté');
  // Sauvegarde avant la mise à la corbeille : les deux documents.
  await page.click('#bouton-menu');
  const [avant] = await Promise.all([page.waitForEvent('download'), page.click('#bouton-sauvegarder')]);
  const fichierAvant = await avant.path();
  // Mise à la corbeille, puis sauvegarde : un seul document.
  await page.click('#bouton-documents');
  await page.getByRole('button', { name: 'Mettre « Jeté » à la corbeille' }).click();
  await page.keyboard.press('Escape');
  await page.click('#bouton-menu');
  const [apres] = await Promise.all([page.waitForEvent('download'), page.click('#bouton-sauvegarder')]);
  const sauvegarde = JSON.parse(await readFile(await apres.path(), 'utf8'));
  expect(sauvegarde.documents.map((d) => d.titre)).toEqual(['Gardé']);
  expect(sauvegarde.documents[0]).not.toHaveProperty('supprimeLe');

  // Restaurer la première sauvegarde : « Jeté » sort de la corbeille, sans doublon.
  await page.click('#bouton-menu');
  const [choix] = await Promise.all([page.waitForEvent('filechooser'), page.click('#bouton-restaurer')]);
  await choix.setFiles(fichierAvant);
  await page.locator('#fenetre-question').getByRole('button', { name: 'Ajouter les documents' }).click();
  await expect(page.locator('#message-question')).toContainText('1 document ajouté.');
  await page.locator('#fenetre-question').getByRole('button', { name: 'Compris' }).click();
  const tous = await lireDocuments(page);
  expect(tous.map((d) => d.titre).sort()).toEqual(['Gardé', 'Jeté']);
  expect(tous.every((d) => !('supprimeLe' in d))).toBe(true);
});
