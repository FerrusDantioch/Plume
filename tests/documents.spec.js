// Enregistrement automatique et gestion de plusieurs documents.

import { test, expect, ouvrir, contenu, attendreEnregistrement } from './aides.js';

test.describe('Enregistrement automatique', () => {
  test('premier lancement : un document vide « Sans titre »', async ({ page }) => {
    await ouvrir(page);
    expect(await contenu(page)).toBe('<p><br></p>');
    await expect(page.locator('#titre-document')).toHaveValue('');
    await expect(page.locator('#titre-document')).toHaveAttribute('placeholder', 'Sans titre');
    await expect(page.locator('#feuille')).toHaveAttribute('data-vide', '');
  });

  test("taper puis recharger la page sans attendre : rien n'est perdu", async ({ page }) => {
    await ouvrir(page);
    await page.fill('#titre-document', 'Rapport');
    await page.locator('#feuille').click();
    await page.keyboard.type('Texte tapé juste avant le rechargement');
    // Aucune attente : on recharge tout de suite.
    await page.reload();
    await page.locator('#feuille[contenteditable="true"]').waitFor();
    expect(await contenu(page)).toBe('<p>Texte tapé juste avant le rechargement</p>');
    await expect(page.locator('#titre-document')).toHaveValue('Rapport');
  });

  test('fermer puis rouvrir : le dernier document revient', async ({ page, context }) => {
    await ouvrir(page);
    await page.locator('#feuille').click();
    await page.keyboard.type('Je reviendrai');
    await expect(page.locator('#etat-enregistrement')).toHaveText('Modification…');
    await attendreEnregistrement(page);
    await expect(page.locator('#etat-enregistrement')).toHaveText(/^Enregistré à \d\d:\d\d$/);
    await page.close();
    const nouvelle = await context.newPage();
    await ouvrir(nouvelle);
    expect(await contenu(nouvelle)).toBe('<p>Je reviendrai</p>');
  });

  test('Ctrl+S enregistre et affiche « Enregistré »', async ({ page }) => {
    await ouvrir(page);
    await page.locator('#feuille').click();
    await page.keyboard.type('Vite');
    await page.keyboard.press('Control+s');
    await expect(page.locator('.message', { hasText: 'Enregistré.' })).toBeVisible();
    await attendreEnregistrement(page);
  });

  test('le stockage persistant est demandé au premier enregistrement', async ({ page }) => {
    await page.addInitScript(() => {
      window.__persistance = 0;
      if (navigator.storage) {
        navigator.storage.persist = async () => {
          window.__persistance++;
          return true;
        };
        navigator.storage.persisted = async () => false;
      }
    });
    await ouvrir(page);
    await page.locator('#feuille').click();
    await page.keyboard.type('a');
    await attendreEnregistrement(page);
    await page.keyboard.type('b');
    await attendreEnregistrement(page);
    expect(await page.evaluate(() => window.__persistance)).toBe(1);
  });
});

test.describe('Plusieurs documents', () => {
  async function ouvrirTiroir(page) {
    await page.click('#bouton-documents');
    await expect(page.locator('#tiroir-documents')).toBeVisible();
  }

  test('créer, ouvrir, dupliquer, mettre à la corbeille', async ({ page }) => {
    await ouvrir(page);
    await page.fill('#titre-document', 'Premier');
    await page.locator('#feuille').click();
    await page.keyboard.type('Contenu du premier');

    // Créer un deuxième document.
    await ouvrirTiroir(page);
    await page.click('#bouton-nouveau-document');
    await expect(page.locator('#tiroir-documents')).toBeHidden();
    expect(await contenu(page)).toBe('<p><br></p>');
    await page.fill('#titre-document', 'Second');
    await page.locator('#feuille').click();
    await page.keyboard.type('Contenu du second');
    await attendreEnregistrement(page);

    // La liste : du plus récent au plus ancien, avec date et début du texte.
    await ouvrirTiroir(page);
    const titres = page.locator('#liste-documents .document-titre');
    await expect(titres).toHaveText(['Second', 'Premier']);
    await expect(page.locator('#liste-documents .document').first()).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('#liste-documents .document-extrait').nth(1)).toHaveText('Contenu du premier');
    await expect(page.locator('#liste-documents .document-date').first()).toHaveText(/^Modifié le \d{1,2} \S+ \d{4} à \d\d:\d\d$/);

    // Ouvrir le premier.
    await page.locator('#liste-documents .document-ouvrir', { hasText: 'Premier' }).click();
    await expect(page.locator('#titre-document')).toHaveValue('Premier');
    expect(await contenu(page)).toBe('<p>Contenu du premier</p>');

    // Dupliquer le premier.
    await ouvrirTiroir(page);
    await page.getByRole('button', { name: 'Dupliquer « Premier »' }).click();
    await expect(titres).toHaveCount(3);
    await expect(page.locator('#liste-documents .document-titre', { hasText: 'Premier (copie)' })).toBeVisible();

    // Mettre à la corbeille : pas de question (le document reste récupérable).
    await page.getByRole('button', { name: 'Mettre « Second » à la corbeille' }).click();
    await expect(titres).toHaveCount(2);
    await expect(titres).not.toContainText(['Second']);
    await expect(page.locator('#annonce-documents .annonce-texte')).toHaveText('« Second » est dans la corbeille.');
    await expect(page.locator('#libelle-corbeille')).toHaveText('Corbeille (1)');
    await expect(page.locator('#bouton-nouveau-document')).toBeFocused();
  });

  test('mettre le document ouvert à la corbeille ouvre un autre document', async ({ page }) => {
    await ouvrir(page);
    await page.fill('#titre-document', 'A garder');
    await attendreEnregistrement(page);
    await ouvrirTiroir(page);
    await page.click('#bouton-nouveau-document');
    await expect(page.locator('#tiroir-documents')).toBeHidden();
    await page.fill('#titre-document', 'A jeter');
    await attendreEnregistrement(page);
    await ouvrirTiroir(page);
    await page.getByRole('button', { name: 'Mettre « A jeter » à la corbeille' }).click();
    await expect(page.locator('#liste-documents .document-titre')).toHaveText(['A garder']);
    await page.keyboard.press('Escape');
    await expect(page.locator('#titre-document')).toHaveValue('A garder');
    // Après un rechargement, c'est bien ce document qui s'ouvre.
    await page.reload();
    await page.locator('#feuille[contenteditable="true"]').waitFor();
    await expect(page.locator('#titre-document')).toHaveValue('A garder');
  });
});
