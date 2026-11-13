/**
 * Version des icônes PWA et favicons.
 *
 * iOS et Android figent l'icône d'une application installée : changer le contenu
 * des PNG ne suffit pas, il faut aussi changer leur URL. Incrémenter cette
 * version (et la constante équivalente dans public/sw.js) force le téléphone à
 * retélécharger les icônes.
 */
export const ICON_VERSION = "2";

export function pwaIcon(name: string) {
  return `/icons/${name}?v=${ICON_VERSION}`;
}
