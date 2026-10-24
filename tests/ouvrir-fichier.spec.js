// « Ouvrir un fichier » : un fichier Word (.docx) ou texte (.txt) devient un
// nouveau document. Les fichiers d'essai sont dans tests/fichiers (créés par
// tests/fichiers/creer-fichiers.py, avec python-docx et LibreOffice).

import { readFile } from 'node:fs/promises';
import { deflateRawSync, crc32 } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { test, expect, ouvrir, contenu, DOCUMENT_ESSAI } from './aides.js';

const FICHIERS = fileURLToPath(new URL('./fichiers/', import.meta.url));

/** Petite archive ZIP compressée (pour fabriquer un fichier piégé). */
function creerZip(fichiers) {
  const locaux = [];
  const centraux = [];
  let decalage = 0;
  for (const { nom, donnees, tailleAnnoncee } of fichiers) {
    const n = Buffer.from(nom);
    const compresse = deflateRawSync(donnees);
    const taille = tailleAnnoncee ?? donnees.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(donnees), 14);
    local.writeUInt32LE(compresse.length, 18);
    local.writeUInt32LE(taille, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc32(donnees), 16);
    central.writeUInt32LE(compresse.length, 20);
    central.writeUInt32LE(taille, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(decalage, 42);
    locaux.push(local, n, compresse);
    centraux.push(central, n);
    decalage += 30 + n.length + compresse.length;
  }
  const repertoire = Buffer.concat(centraux);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(fichiers.length, 8);
  fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(repertoire.length, 12);
  fin.writeUInt32LE(decalage, 16);
  return Buffer.concat([...locaux, repertoire, fin]);
}

/** Choisit un fichier avec « Mes documents → Ouvrir un fichier ». */
async function ouvrirFichier(page, fichier) {
  await page.click('#bouton-documents');
  const [choix] = await Promise.all([page.waitForEvent('filechooser'), page.click('#bouton-ouvrir-fichier')]);
  await choix.setFiles(fichier);
}

// Contenu attendu des deux fichiers Word d'essai (même document, écrit par
// Word/python-docx ou par LibreOffice). L'interligne « simple » vient du style
// par défaut de ces fichiers.
const ATTENDU_WORD =
  '<h1>Compte rendu</h1>' +
  '<p style="line-height: 1.15;">Texte <b>gras</b>, <i>italique</i>, <u>souligné</u>, <s>barré</s>, ' +
  '<span style="color: rgb(229, 72, 77);">rouge</span>, <span style="background-color: rgb(255, 255, 0);">surligné</span>, ' +
  '<span style="font-size: 18pt;">grand</span> et <span style="font-family: &quot;JetBrains Mono&quot;, ui-monospace, monospace;">machine</span>.</p>' +
  '<p style="text-align: center; line-height: 1.15;">Paragraphe centré</p>' +
  '<p style="text-align: justify; line-height: 2;">Paragraphe justifié en double interligne</p>' +
  '<h2>Listes</h2>';

for (const nom of ['exemple-word.docx', 'exemple-libreoffice.docx']) {
  test(`ouvrir un fichier Word : ${nom}`, async ({ page }) => {
    await ouvrir(page);
    await ouvrirFichier(page, FICHIERS + nom);
    const question = page.locator('#fenetre-question');
    await expect(question).toBeVisible();
    await expect(question.locator('h2')).toHaveText('Fichier ouvert');
    await expect(question.locator('.question-message')).toHaveText(
      `« ${nom.replace('.docx', '')} » est ouvert dans un nouveau document. Le fichier d'origine n'est pas modifié. ` +
        "1 image n'a pas été reprise : Omni-Texte ne gère pas les images. Le tableau a été transformé en simples paragraphes.",
    );
    await question.getByRole('button', { name: 'Compris' }).click();
    await expect(page.locator('#tiroir-documents')).toBeHidden();
    await expect(page.locator('#titre-document')).toHaveValue(nom.replace('.docx', ''));

    const html = await contenu(page);
    expect(html.startsWith(ATTENDU_WORD)).toBe(true);
    // Listes, saut de ligne, titre 3, texte du tableau.
    expect(html).toMatch(/<ul><li[^>]*>pomme<\/li><li[^>]*>poire<\/li><\/ul><ol><li[^>]*>un<\/li><li[^>]*>deux<\/li><\/ol>/);
    expect(html).toContain('Ligne un<br>Ligne deux</p><h3>Détails</h3>');
    for (const texte of ['Case A', 'Case B', 'Case C', 'Case D', 'Fin du document.']) expect(html).toContain(`>${texte}</p>`);

    // C'est un nouveau document : l'ancien est toujours là.
    await page.click('#bouton-documents');
    await expect(page.locator('#liste-documents .document')).toHaveCount(2);
  });
}

test('ouvrir un fichier texte écrit avec l’ancien encodage de Windows', async ({ page }) => {
  await ouvrir(page);
  await ouvrirFichier(page, `${FICHIERS}ancien-windows.txt`);
  await expect(page.locator('.message', { hasText: '« ancien-windows » est ouvert dans un nouveau document.' })).toBeVisible();
  await expect(page.locator('#titre-document')).toHaveValue('ancien-windows');
  expect(await contenu(page)).toBe('<p>Première ligne : café, élève, garçon.</p><p><br></p><p>Troisième ligne.</p>');
  await expect(page.locator('#feuille')).toBeFocused();
});

test('un fichier abîmé ou d’un autre format est refusé avec une explication', async ({ page }) => {
  await ouvrir(page);
  await ouvrirFichier(page, `${FICHIERS}abime.docx`);
  const question = page.locator('#fenetre-question');
  await expect(question.locator('h2')).toHaveText('Ouverture impossible');
  await expect(question.locator('.question-message')).toHaveText(
    "Ce fichier n'est pas lisible : il est peut-être abîmé, protégé par un mot de passe, ou ce n'est pas un vrai fichier Word.",
  );
  await question.getByRole('button', { name: 'Compris' }).click();
  await expect(page.locator('#tiroir-documents')).toBeVisible(); // rien n'a été créé, le panneau reste ouvert
  await expect(page.locator('#liste-documents .document')).toHaveCount(1);

  const [choix] = await Promise.all([page.waitForEvent('filechooser'), page.click('#bouton-ouvrir-fichier')]);
  await choix.setFiles({ name: 'ancien.doc', mimeType: 'application/msword', buffer: Buffer.from('ancien format') });
  await expect(question.locator('.question-message')).toHaveText(
    "Ce format n'est pas pris en charge. Ouvre ce fichier dans Word, LibreOffice ou Google Docs, enregistre-le au format Word (.docx), puis réessaie.",
  );
});

test('un très long fichier texte (130 000 lignes) s’ouvre entièrement', async ({ page }) => {
  test.setTimeout(120_000);
  await ouvrir(page);
  await page.fill('#titre-document', 'Mon roman');
  await page.locator('#feuille').click();
  await page.keyboard.type('Texte du roman');
  const lignes = Array.from({ length: 130_000 }, (_, i) => `Ligne ${i + 1}`).join('\n');
  await page.click('#bouton-documents');
  const [choix] = await Promise.all([page.waitForEvent('filechooser'), page.click('#bouton-ouvrir-fichier')]);
  await choix.setFiles({ name: 'Très long.txt', mimeType: 'text/plain', buffer: Buffer.from(lignes, 'utf8') });
  await expect(page.locator('.message', { hasText: '« Très long » est ouvert' })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#titre-document')).toHaveValue('Très long');
  expect(await page.locator('#feuille > p').count()).toBe(130_000);
  // « Mon roman » est intact.
  await page.click('#bouton-documents');
  await page.locator('#liste-documents .document-ouvrir', { hasText: 'Mon roman' }).click();
  await expect(page.locator('#titre-document')).toHaveValue('Mon roman');
  expect(await contenu(page)).toBe('<p>Texte du roman</p>');
});

test('un fichier Word piégé (« bombe de décompression ») est refusé', async ({ page }) => {
  await ouvrir(page);
  // document.xml : 200 Mo une fois décompressé, quelques centaines de Ko compressé,
  // et une taille annoncée mensongère (1 000 octets).
  const contenu = Buffer.alloc(200 * 1024 * 1024, 0x20);
  const bombe = creerZip([
    { nom: '[Content_Types].xml', donnees: Buffer.from('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>') },
    { nom: 'word/document.xml', donnees: contenu, tailleAnnoncee: 1000 },
  ]);
  await page.click('#bouton-documents');
  const [choix] = await Promise.all([page.waitForEvent('filechooser'), page.click('#bouton-ouvrir-fichier')]);
  await choix.setFiles({ name: 'piege.docx', mimeType: 'application/octet-stream', buffer: bombe });
  await expect(page.locator('#fenetre-question .question-message')).toHaveText('Ce fichier est trop volumineux.', { timeout: 30_000 });
});

test('aller-retour : un document exporté en Word puis rouvert est identique', async ({ page }) => {
  await ouvrir(page);
  await page.fill('#titre-document', 'Aller-retour');
  await page.evaluate((html) => {
    const feuille = document.getElementById('feuille');
    feuille.innerHTML = html;
    feuille.dispatchEvent(new InputEvent('input', { inputType: 'insertText', bubbles: true }));
  }, DOCUMENT_ESSAI
    // Deux écritures équivalentes à l'écran deviennent leur forme habituelle :
    // un retour à la ligne dans le texte devient <br>, un « non gras » dans du
    // gras coupe simplement le gras.
    .replace('Ligne un\nLigne deux', 'Ligne un<br>Ligne deux')
    .replace('<b>Gras <span style="font-weight: normal;">puis normal</span></b>', '<b>Gras </b>puis normal')
    + '<p style="line-height: 2;">Double</p><ul><li style="line-height: 1.15;">Simple</li></ul>');
  const original = await contenu(page);
  await page.click('#bouton-exporter');
  const [telechargement] = await Promise.all([page.waitForEvent('download'), page.click('#fenetre-export [data-format="docx"]')]);
  // Le fichier téléchargé n'a pas de nom (« .docx ») : on le renomme comme sur l'appareil.
  await ouvrirFichier(page, {
    name: 'Aller-retour.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: await readFile(await telechargement.path()),
  });
  await expect(page.locator('.message', { hasText: '« Aller-retour » est ouvert dans un nouveau document.' })).toBeVisible();
  await page.click('#bouton-documents');
  await expect(page.locator('#liste-documents .document-titre')).toHaveText(['Aller-retour', 'Aller-retour']);
  await page.keyboard.press('Escape');
  expect(await contenu(page)).toBe(original);
});
