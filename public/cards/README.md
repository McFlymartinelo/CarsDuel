# Banque d'images des cartes

Déposez simplement les fichiers ici : l'app les détecte toute seule (aucune base à modifier).
Formats acceptés : `.webp` (recommandé), `.png`, `.jpg`, `.avif`, `.svg`. Idéal : carré 1024×1024, fond noir ou transparent.

## Règle de nommage

Pour chaque carte, l'app prend la **première image qui existe** :

1. `image_url` renseignée en base (chemin ou URL complète) ;
2. **image propre à la carte** : `<code>.webp`, par ex. `moteur/m_1a.webp` ;
3. **image générique de la famille** : `_<famille>.webp`, par ex. `moteur/_v8.webp` ;
4. `_default.webp` du dossier ;
5. sinon, une icône.

Avec 235 moteurs, commencez par les **génériques** (une image par famille), puis ajoutez des images propres aux cartes rares/légendaires.

| Dossier   | Famille (fichier `_...`)                                                                      |
|-----------|-----------------------------------------------------------------------------------------------|
| `moteur/` | architecture : `_v8`, `_v6`, `_4-cylindres`, `_3-cylindres`, `_6-cylindres-en-ligne`, `_v10`, `_v12`, `_w16`, `_bi-rotor`... |
| `boite/`  | `_manuelle`, `_sequentielle`, `_double-embrayage`, `_robotisee`                               |
| `pneus/`  | `_route`, `_sport`, `_pluie`, `_semi-slick`, `_slick`                                         |
| `bonus/`  | `_revision-express`, `_vidange-boite`, `_revision-complete`, `_huile-moteur-competition`, `_huile-boite-competition`, `_assistance-plateau` |

Les noms de famille suivent la valeur en base, sans accents ni espaces (`4 cylindres` → `_4-cylindres`).

## Savoir ce qu'il manque (avec un prompt prêt à coller)

```bash
npm run images:missing
```

## Conseils pour un rendu homogène (Gemini ou autre)

- Gardez **le même prompt de style** pour toutes les images (cadrage, lumière, fond).
- Fond **noir uni** : l'app le fond dans la carte (`mix-blend-lighten`). Un PNG/WebP transparent marche aussi.
- Pas de texte, de logo ni de filigrane dans l'image.
- Exportez en WebP ~800–1024 px : léger et net.
