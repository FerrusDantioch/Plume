# Crée les icônes PNG de l'application (dossier icons/).
#
# Dessin original : un fond sombre aux coins arrondis, une feuille violette
# avec un coin plié et trois lignes de texte, et un fin anneau lumineux
# incliné autour, en écho au logo de l'Omni-système.
#
# Utilisation (Python 3 et la bibliothèque Pillow sont nécessaires) :
#   python3 outils/creer-icones.py
# Les fichiers produits sont écrits dans icons/.

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

FOND = (20, 17, 29, 255)        # #14111d
FEUILLE = (167, 119, 255, 255)  # #a777ff (violet de l'accent)
PLI = (122, 82, 214, 255)       # violet plus sombre pour le coin plié
LIGNES = (20, 17, 29, 255)      # lignes de texte sombres
HALO = (214, 194, 255)          # #d6c2ff (lueur de l'anneau)

TAILLE = 1024  # on dessine en grand, puis on réduit (bords plus nets)
DOSSIER = Path(__file__).resolve().parent.parent / "icons"


def anneau(taille, echelle, epaisseur, avant):
    """Dessine la moitié avant ou arrière de l'anneau incliné, avec sa lueur."""
    calque = Image.new("RGBA", (taille, taille), (0, 0, 0, 0))
    d = ImageDraw.Draw(calque)
    cx = cy = taille / 2
    rx, ry = 0.47 * taille * echelle, 0.15 * taille * echelle
    inclinaison = math.radians(-24)
    points = []
    # Moitié avant : sous le centre de l'ellipse ; moitié arrière : au-dessus.
    debut, fin = (0, 180) if avant else (180, 360)
    for i in range(debut, fin + 1):
        t = math.radians(i)
        x, y = rx * math.cos(t), ry * math.sin(t)
        xr = x * math.cos(inclinaison) - y * math.sin(inclinaison)
        yr = x * math.sin(inclinaison) + y * math.cos(inclinaison)
        points.append((cx + xr, cy + yr))
    d.line(points, fill=HALO + (255,), width=epaisseur, joint="curve")
    # La lueur : on floute seulement la transparence, la couleur reste celle
    # du halo partout (sinon le flou mélange du noir et assombrit les bords).
    alpha_floue = calque.getchannel("A").filter(ImageFilter.GaussianBlur(epaisseur * 2.4))
    lueur = Image.new("RGBA", (taille, taille), HALO + (0,))
    lueur.putalpha(alpha_floue.point(lambda a: min(255, int(a * 1.6))))
    resultat = Image.new("RGBA", (taille, taille), (0, 0, 0, 0))
    resultat.alpha_composite(lueur)
    resultat.alpha_composite(calque)
    return resultat


def feuille(taille, echelle):
    """Dessine la feuille violette avec son coin plié et trois lignes."""
    calque = Image.new("RGBA", (taille, taille), (0, 0, 0, 0))
    d = ImageDraw.Draw(calque)
    largeur, hauteur = 0.44 * taille * echelle, 0.56 * taille * echelle
    x0, y0 = (taille - largeur) / 2, (taille - hauteur) / 2
    x1, y1 = x0 + largeur, y0 + hauteur
    pli = largeur * 0.30
    rayon = taille * 0.035 * echelle
    # Corps de la feuille (coin supérieur droit coupé en biais).
    d.rounded_rectangle((x0, y0, x1, y1), radius=rayon, fill=FEUILLE)
    d.polygon([(x1 - pli, y0 - 2), (x1 + 2, y0 - 2), (x1 + 2, y0 + pli)], fill=(0, 0, 0, 0))
    # Le triangle plié.
    d.polygon([(x1 - pli, y0), (x1 - pli, y0 + pli), (x1, y0 + pli)], fill=PLI)
    # Trois lignes de texte, la dernière plus courte.
    marge = largeur * 0.17
    epaisseur = max(2, int(taille * 0.028 * echelle))
    for i, part in enumerate((0.62, 0.78, 0.52)):
        y = y0 + hauteur * (0.47 + i * 0.15)
        d.rounded_rectangle(
            (x0 + marge, y, x0 + marge + (largeur - 2 * marge) * part / 0.78, y + epaisseur),
            radius=epaisseur / 2,
            fill=LIGNES,
        )
    return calque


def icone(echelle, coins_arrondis):
    """Assemble une icône carrée de TAILLE pixels."""
    image = Image.new("RGBA", (TAILLE, TAILLE), (0, 0, 0, 0))
    masque = Image.new("L", (TAILLE, TAILLE), 0)
    rayon = int(TAILLE * 0.22) if coins_arrondis else 0
    ImageDraw.Draw(masque).rounded_rectangle((0, 0, TAILLE - 1, TAILLE - 1), radius=rayon, fill=255)
    fond = Image.new("RGBA", (TAILLE, TAILLE), FOND)
    image.paste(fond, (0, 0), masque)
    epaisseur = max(3, int(TAILLE * 0.014 * echelle))
    image.alpha_composite(anneau(TAILLE, echelle, epaisseur, avant=False))
    image.alpha_composite(feuille(TAILLE, echelle))
    image.alpha_composite(anneau(TAILLE, echelle, epaisseur, avant=True))
    # La lueur ne doit pas déborder des coins arrondis.
    image.putalpha(Image.composite(image.getchannel("A"), Image.new("L", image.size, 0), masque))
    return image


def main():
    DOSSIER.mkdir(exist_ok=True)
    normale = icone(echelle=1.0, coins_arrondis=True)
    # Icône « maskable » : fond plein jusqu'aux bords, dessin réduit pour
    # rester dans la zone sûre (cercle central de 80 %).
    masquable = icone(echelle=0.74, coins_arrondis=False)
    for nom, image, cote in (
        ("icone-192.png", normale, 192),
        ("icone-512.png", normale, 512),
        ("icone-maskable-512.png", masquable, 512),
        ("icone-maskable-192.png", masquable, 192),
        ("apple-touch-icon.png", masquable, 180),
        ("favicon-32.png", normale, 32),
    ):
        image.resize((cote, cote), Image.LANCZOS).save(DOSSIER / nom, optimize=True)
        print("créé :", DOSSIER / nom)


if __name__ == "__main__":
    main()
