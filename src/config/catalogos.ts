import { routes } from "../i18n/ui";

/*
 * Qué categorías tienen catálogo navegable propio.
 *
 * Hoy solo ruedas. Cuando tenedores/soportes tenga el suyo, se agrega su
 * línea aquí y la tarjeta de esa categoría empieza a enlazar sola, tanto en
 * Home como en /productos. Las categorías que no aparecen siguen mostrando
 * solo los CTA de contacto.
 */
export const CATALOGOS: Partial<Record<string, keyof typeof routes.es>> = {
  ruedas: "wheels",
};

export function tieneCatalogo(slug: string): boolean {
  return slug in CATALOGOS;
}
