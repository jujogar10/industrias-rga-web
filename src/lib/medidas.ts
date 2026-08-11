/*
 * Medidas en pulgadas con notación fraccionaria — ver plan.md §5.1.
 * RGA carga las medidas como las escribe el sector ("3", "1 7/8", "5/16").
 * El sitio necesita el decimal para ordenar y comparar, pero muestra
 * siempre la fracción original: nadie pide una rueda de eje 0.3125".
 */

export interface Medida {
  /** Lo que se muestra en pantalla, ya con el símbolo de pulgada: `1 7/8"` */
  texto: string;
  /** Lo que se usa para ordenar y comparar: 1.875 */
  decimal: number;
}

const FRACCION = /^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/;

/**
 * Convierte lo que venga de Excel a una Medida.
 * Acepta números (3, 2.5) y fracciones en texto ("1 7/8", "3/4").
 * Devuelve null si la celda está vacía; lanza si la notación no se entiende,
 * para que el build falle señalando la celda en vez de publicar un dato mudo.
 */
export function aMedida(valor: unknown, donde: string): Medida | null {
  if (valor === null || valor === undefined || valor === "") return null;

  if (typeof valor === "number") {
    return { texto: `${formatearNumero(valor)}"`, decimal: valor };
  }

  const crudo = String(valor).trim();
  if (!crudo) return null;

  const m = crudo.match(FRACCION);
  if (m) {
    const entero = m[1] ? Number(m[1]) : 0;
    const numerador = Number(m[2]);
    const denominador = Number(m[3]);
    if (denominador === 0) {
      throw new Error(`${donde}: la fracción "${crudo}" tiene denominador cero.`);
    }
    return { texto: `${crudo}"`, decimal: entero + numerador / denominador };
  }

  // Un decimal escrito a mano, con punto o con coma.
  const numero = Number(crudo.replace(",", "."));
  if (Number.isFinite(numero)) {
    return { texto: `${formatearNumero(numero)}"`, decimal: numero };
  }

  throw new Error(
    `${donde}: no entiendo la medida "${crudo}". Escríbela como 3, 1 7/8 o 5/16 ` +
      `(espacio entre entero y fracción, barra normal, sin comillas ni "in").`,
  );
}

function formatearNumero(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}
