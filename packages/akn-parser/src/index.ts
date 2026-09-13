/**
 * `@antinomia/akn-parser`
 *
 * Parser e normalizzatore Akoma Ntoso per gli open data di Normattiva, con
 * risoluzione di URN:NIR ed ELI e con la risoluzione della multivigenza: dato un
 * URN e una data, il testo dell'articolo vigente a quella data.
 *
 * Fonte dei dati: Normattiva open data, licenza CC BY 4.0.
 * La banca dati Normattiva non ha carattere di ufficialità: l'unico testo
 * ufficiale è quello pubblicato sulla Gazzetta Ufficiale.
 */
export * from './urn.js';
export * from './eli.js';
export * from './akn.js';
export * from './modifications.js';
export * from './citations.js';
export * from './multivigenza.js';
export { parseXml, textContent, normalizeSpace } from './xml.js';
export type { XmlElement, XmlNode, XmlText } from './xml.js';
export { parseVersionFileName, type VersionFileName } from './filenames.js';
