# Plume — traitement de texte

Plume est une application de traitement de texte qui s'installe sur un
ordinateur ou un téléphone Android, comme une application classique.

- Aucun compte, aucun serveur : les documents restent sur l'appareil.
- Fonctionne sans connexion internet, après la première visite.
- Ordinateur (Chrome, Edge, Firefox) et Android (Chrome, Brave), à la souris, au clavier et au doigt.
- Première application de la « Suite Bureautique » de l'Omni-système.

Adresse : `https://ferrusdantioch.github.io/Plume/` (dépôt GitHub `FerrusDantioch/Plume`).

---

## 1. Ce que l'application sait faire

- Gras, italique, souligné, barré.
- Taille du texte (de 8 à 72 points), boutons « A− » et « A+ ».
- Police : Literata (par défaut), Sans-serif, Machine à écrire.
- Couleur du texte et surlignage (palettes de pastilles).
- Styles de paragraphe : Texte normal, Titre 1, Titre 2, Titre 3.
- Alignement : gauche, centré, droite, justifié. Listes à puces et numérotées.
- Effacer la mise en forme de la sélection.
- Annuler / Rétablir (boutons, Ctrl+Z, Ctrl+Y, Ctrl+Maj+Z).
- Collage toujours en texte brut (chaque ligne devient un paragraphe).
- Enregistrement automatique, plusieurs documents, compteur de mots et de caractères.
- Sauvegarde de tous les documents dans un fichier, et restauration.
- Bouton « Exporter » : trois formats, le fichier porte le titre du document.
  - PDF : pour imprimer ou envoyer un document figé (feuille blanche, texte noir, couleurs conservées).
  - Word (.docx) : pour continuer le texte dans Word, Google Docs ou LibreOffice.
  - Texte brut (.txt) : le texte seul, sans mise en forme.
- Trois thèmes : Omni-système (par défaut), Sombre, Clair.

Raccourcis clavier : Ctrl+B (gras), Ctrl+I (italique), Ctrl+U (souligné),
Ctrl+S (enregistrer), Ctrl+P (exporter directement en PDF), Ctrl+Z (annuler),
Ctrl+Y (rétablir), Maj+Entrée (aller à la ligne sans changer de paragraphe).

---

## 2. Essayer l'application sur ton ordinateur

Ouvrir `index.html` par un double-clic ne marche pas : le navigateur bloque
les modules JavaScript ouverts depuis un fichier. Il faut un petit serveur
web local. Il est fourni (`outils/serveur.mjs`) et n'a besoin que de Node.js.

**Une seule fois : installer Node.js**

1. Va sur <https://nodejs.org>.
2. Clique sur le bouton de téléchargement marqué « LTS ».
3. Ouvre le fichier téléchargé et clique sur « Suivant » jusqu'à la fin, sans rien changer.

**À chaque essai (Windows)**

1. Ouvre l'Explorateur de fichiers et va dans le dossier `traitement-de-texte`.
2. Clique dans la barre d'adresse en haut de la fenêtre (là où le chemin du dossier est écrit).
3. Efface ce qui est écrit, tape `cmd`, puis appuie sur Entrée. Une fenêtre noire s'ouvre.
4. Dans cette fenêtre, tape : `node outils/serveur.mjs` puis appuie sur Entrée.
5. Le message « Application disponible sur http://localhost:8000/plume/ » s'affiche.
6. Ouvre Chrome et va à l'adresse `http://localhost:8000/plume/`.
7. Pour arrêter : clique dans la fenêtre noire et appuie sur Ctrl+C, puis ferme-la.

**Sur Mac** : ouvre l'application « Terminal », tape `cd ` (avec un espace),
glisse le dossier `traitement-de-texte` dans la fenêtre, appuie sur Entrée,
puis suis les étapes 4 à 7 ci-dessus.

---

## 3. Publier l'application sur GitHub Pages

Le nom du dépôt donne l'adresse : le dépôt `Plume` sera publié à
`https://ferrusdantioch.github.io/Plume/`. Tous les chemins de l'application
sont relatifs : elle fonctionne dans ce sous-dossier.

**Méthode simple, par le site de GitHub (sans rien installer)**

1. Connecte-toi sur <https://github.com> avec le compte `FerrusDantioch`.
2. Clique sur le bouton « + » en haut à droite, puis sur « New repository ».
3. Dans « Repository name », tape `Plume`.
4. Choisis « Public ». Ne coche aucune autre case. Clique sur « Create repository ».
5. Sur la page qui s'affiche, clique sur le lien « uploading an existing file ».
6. Ouvre le dossier `traitement-de-texte` sur ton ordinateur et sélectionne tout son
   contenu, **sauf le dossier `tests`** (il ne sert qu'aux vérifications).
   Glisse cette sélection dans la page de GitHub.
7. Attends la fin du chargement, puis clique sur le bouton vert « Commit changes ».
8. Clique sur l'onglet « Settings » du dépôt, puis sur « Pages » dans la colonne de gauche.
9. Sous « Branch », choisis `main`, puis `/ (root)`, puis clique sur « Save ».
10. Attends une à deux minutes, puis ouvre `https://ferrusdantioch.github.io/Plume/`.

**Autre méthode, avec l'application GitHub Desktop** : elle garde l'historique
des modifications (le dossier contient déjà un dépôt git local).

1. Installe GitHub Desktop depuis <https://desktop.github.com> et connecte-toi.
2. Menu « File », puis « Add local repository… », puis choisis le dossier `traitement-de-texte`.
3. Clique sur « Publish repository ». Nom : `Plume`. Décoche « Keep this code private ». Clique sur « Publish repository ».
4. Fais ensuite les étapes 8 à 10 de la méthode simple.

**Publier une mise à jour**

1. Augmente le numéro de version dans `js/config.js` (par exemple `1.0.0` devient `1.0.1`).
2. Envoie les fichiers modifiés sur GitHub (étapes 5 à 7 de la méthode simple, sur la page du dépôt :
   bouton « Add file », puis « Upload files »).
3. Les personnes qui utilisent l'application verront : « Une nouvelle version est disponible. Recharger ».

Sans changement de version, les utilisateurs gardent l'ancienne version
(l'application est conservée sur leur appareil pour marcher hors ligne).

---

## 4. Changer le nom ou la version

- **Nom** : dans `js/config.js`, modifie la ligne `nom: 'Plume',`. Puis, dans
  `manifest.webmanifest`, modifie les lignes `"name"` et `"short_name"`.
  Le manifeste est un fichier de données (JSON) : il ne peut pas lire `config.js`,
  c'est pourquoi le nom y est recopié. Un test automatique vérifie que les deux
  correspondent. Le titre de la page et la fenêtre « À propos » suivent `config.js`.
- **Version** : dans `js/config.js`, ligne `version: '1.0.2',` (version actuelle).
- **Ne change jamais** `idStockage: 'plume'` : c'est le nom de la base de données ;
  le changer rendrait les documents existants invisibles.
- **Icônes** : elles sont créées par `outils/creer-icones.py` (Python et la
  bibliothèque Pillow). Le logo de la fenêtre « À propos » est `assets/logo-omni-systeme.webp` :
  pour le remplacer, garde le même nom de fichier.

---

## 5. Les documents et leur sécurité

- Les documents sont enregistrés dans le navigateur de l'appareil (IndexedDB),
  environ une seconde après la dernière frappe, et aussitôt quand la page est fermée.
- Ils ne quittent jamais l'appareil. Si tu effaces les données du site dans le
  navigateur, ils disparaissent : fais régulièrement « Menu → Sauvegarder tous mes
  documents ». Le fichier `plume-sauvegarde-AAAA-MM-JJ.json` se restaure avec
  « Menu → Restaurer une sauvegarde ».
- Sur Firefox, au premier enregistrement, une question peut apparaître
  (« stocker des données de façon persistante ») : réponds « Autoriser ». Cela
  protège les documents contre un effacement automatique quand le disque est plein.

---

## 5 bis. Ouvrir un document exporté dans Word ou Google Docs

**Sur Android**

1. Dans Plume, touche « Exporter », puis « Word (.docx) ».
2. Ouvre l'application « Fichiers » (ou « Mes fichiers »), puis le dossier « Téléchargements ».
3. Touche le fichier. Choisis « Docs » (Google Docs) ou « Word ».

**Sur ordinateur**

- Word ou LibreOffice : double-clique sur le fichier dans le dossier « Téléchargements ».
- Google Docs : ouvre <https://drive.google.com>, clique sur « Nouveau », puis
  « Importer un fichier », choisis le fichier ; ensuite, clique dessus avec le
  bouton droit, puis « Ouvrir avec » et « Google Docs ».

---

## 6. Décisions prises pendant la réalisation

1. **Logo** : aucun dossier `assets/` n'était fourni. Le logo du d20 a été repris
   du portfolio public de l'Omni-système (`assets/logo-omni-systeme.webp`).
   Il ne sert que dans « À propos ». Les icônes de l'application sont une création originale.
2. **Police** : comme la taille, elle s'applique au texte sélectionné (ou au texte
   tapé ensuite). Pour changer tout le document : Ctrl+A, puis choisir la police.
3. **Titre vide** : un nouveau document a un titre vide qui s'affiche « Sans titre »
   (en gris) ; on peut taper le titre directement, sans effacer.
4. **Restauration** : une confirmation est demandée avant d'ajouter. Un document
   strictement identique à un document existant n'est pas ajouté en double ; un
   document avec le même identifiant mais un contenu différent est ajouté comme
   copie (« (restauré) »). Rien n'est jamais remplacé.
5. **Mise en forme** : gras, italique et souligné utilisent la commande du
   navigateur (`execCommand`). Barré, taille, police, couleurs, alignement, listes
   et styles de paragraphe sont faits par le code de l'application, pour un
   résultat identique dans tous les navigateurs.
6. **Retour arrière au début d'un paragraphe** : le texte rejoint le paragraphe
   du dessus et en prend le style (comme dans Word). Chrome ajoutait sinon des
   styles parasites.
7. **Glisser-déposer** : on ne peut pas faire glisser du texte à l'intérieur de la
   page (évite les déplacements accidentels). Un texte déposé depuis une autre
   application est inséré en texte brut.
8. **Applications voisines** : toutes les applications de `ferrusdantioch.github.io`
   partagent le même espace de stockage. Toutes les clés de Plume commencent donc
   par `plume.`, et son service worker ne supprime que les caches commençant par
   `plume-`. Conseil pour les prochaines applications : suivre la même règle.
9. **Sécurité** : une politique de sécurité (`Content-Security-Policy`) interdit
   tout code extérieur. Le petit script du thème, dans `index.html`, est autorisé
   par son empreinte ; un test signale si elle n'est plus à jour.
10. **Installation** : le bandeau d'installation automatique du navigateur est masqué ;
    l'installation se fait depuis « Menu → Installer l'application ».
11. **Contrastes** : toutes les valeurs de couleurs fournies respectent déjà le
    niveau AA ; aucune n'a été modifiée. Des variables complémentaires ont été
    ajoutées dans `css/themes.css` (fond d'un bouton activé, survol, voile, rouge
    de suppression, texte sur surlignage).
12. **Polices** : téléchargées depuis Fontsource (version 5.3.0, licence SIL OFL,
    fichiers `fonts/LICENCE-*.txt`). Literata « 600 italique » a été ajoutée pour un
    gras-italique net.

13. **Export Word (.docx)** : le fichier est fabriqué sur l'appareil, sans aucun
    service extérieur. Polices : Literata reste Literata (Google Docs la propose ;
    Word la remplace par une police à empattements si elle n'est pas installée),
    « Sans-serif » devient Arial, « Machine à écrire » reste JetBrains Mono (Word la
    remplace par Courier New si elle manque). Le surlignage garde sa couleur exacte
    (dans Word, il apparaît comme une « trame de fond »).
14. **Export texte brut (.txt)** : encodage UTF-8 avec marque d'encodage et fins
    de ligne Windows, pour que les accents s'affichent partout.
15. **Pas d'export Markdown** pour l'instant : ce format pourrait induire certains
    utilisateurs en erreur.
---

## 7. Limites connues

- Firefox n'a pas pu être testé automatiquement (seul Chromium était disponible) :
  voir la liste de contrôle manuelle ci-dessous.
- Le téléphone a été testé en émulation (écran 390 × 844, tactile), pas sur un vrai appareil.
- Si le même document est ouvert dans deux onglets, le dernier enregistrement l'emporte.
- L'historique « Annuler » est vidé quand on change de document ou qu'on ferme la page.
- Dans la fenêtre d'impression, le navigateur peut ajouter la date et l'adresse de
  la page : décocher « En-têtes et pieds de page ».

---

## 8. Organisation des fichiers

```
index.html             la page (structure de l'interface, icônes)
manifest.webmanifest   carte d'identité de l'application installable
sw.js                  service worker : copie locale pour le mode hors ligne
css/polices.css        déclaration des polices
css/themes.css         les trois thèmes (seul fichier contenant des couleurs)
css/base.css           mise en page et composants communs à la suite
css/redaction.css      barre d'outils, palettes, feuille, compteur
css/print.css          impression et PDF
js/config.js           nom, version, contact (à modifier ici)
js/app.js              assemblage de l'application
js/theme.js            thèmes                                  (commun à la suite)
js/storage.js          stockage, sauvegarde, restauration      (commun à la suite)
js/ui.js               fenêtres, messages, « À propos »        (commun à la suite)
js/pwa.js              installation et mises à jour            (commun à la suite)
js/editor.js           l'éditeur : commandes, collage, compteur
js/selection.js        outils de sélection
js/mise-en-forme.js    taille, police, couleurs, barré, effacement
js/paragraphes.js      titres, listes, alignement, structure
js/historique.js       Annuler / Rétablir
js/sanitize.js         nettoyage par liste blanche
js/palettes.js         tailles, polices et couleurs proposées
js/barre-outils.js     barre d'outils
js/documents.js        documents et enregistrement automatique
js/tiroir-documents.js panneau « Mes documents »
js/impression.js       export PDF
js/exporter.js         fenêtre « Exporter » (choix du format)
js/export-docx.js      export Word (.docx)
js/export-texte.js     export texte brut (.txt)
js/zip.js              fabrication d'archives ZIP            (commun à la suite)
fonts/                 polices (.woff2) et leurs licences
icons/                 icônes de l'application
assets/                logo de l'Omni-système
outils/                serveur local, création des icônes
tests/                 tests automatiques
```

---

## 9. Tests automatiques (pour un développeur)

Les tests ouvrent l'application dans un vrai navigateur (Chromium, avec Playwright)
et vérifient chaque fonction : mise en forme, annulation, collage, enregistrement,
documents, sauvegarde, thèmes et contrastes, PDF, hors ligne, mise à jour,
téléphone, clavier et accessibilité, absence d'erreur dans la console.

```
cd tests
npm install
npx playwright install chromium
npm test
```

L'analyse du PDF demande aussi Python 3 avec `pdfplumber` et `pypdfium2`
(sinon ce test est ignoré).

---

## 10. Liste de contrôle manuelle (Firefox et vrai téléphone Android)

À faire une fois sur Firefox (ordinateur), puis sur Chrome Android :

1. Ouvrir l'application. Le thème Omni-système (violet sombre) s'affiche sans flash blanc.
2. Taper « Bonjour le monde ». Le compteur indique « 3 mots · 16 caractères ».
3. Sélectionner « Bonjour », toucher Gras : le mot passe en gras ; toucher à nouveau : il redevient normal.
4. Sélectionner « monde », choisir 24 dans la taille, puis la couleur « Rouge », puis le surlignage « Jaune ».
5. Sélectionner seulement « on » dans « monde », choisir « Automatique » puis « Aucun » : seules ces deux lettres changent.
6. Barrer un mot, recharger la page, sélectionner le mot et retirer le barré.
7. Toucher Annuler plusieurs fois, puis Rétablir : les étapes reviennent dans l'ordre.
8. Copier un texte en couleur depuis une page web et le coller : il arrive sans couleur ni police étrangère.
9. Taper un texte puis fermer l'onglet aussitôt ; rouvrir : le texte est là.
10. Menu → thème Clair, recharger : le thème Clair reste, sans flash.
11. Exporter → PDF : le fichier proposé porte le titre du document ; le PDF est blanc, texte noir, couleurs conservées.
12. Exporter → Word (.docx), puis ouvrir le fichier dans Word ou Google Docs : titres, gras, couleurs, surlignage et listes sont conservés.
13. Exporter → Texte brut (.txt), puis ouvrir le fichier : les accents s'affichent correctement.
14. Couper le réseau (mode avion), recharger : l'application s'ouvre et enregistre.
15. Android : pendant la frappe, le clavier ouvert, la barre d'outils reste visible et défile au doigt.
16. Android : Menu → Installer l'application ; l'icône violette apparaît sur l'écran d'accueil.

---

Application réalisée par Ferrus Dantioch, avec l'aide de Claude (Anthropic).
Contact : ferrusdantioch@protonmail.com
