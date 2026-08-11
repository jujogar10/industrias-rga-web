/*
 * Ejes de búsqueda de la categoría RUEDAS — ver plan.md §5.1.
 *
 * Esto es configuración, no código: soportes/tenedores tendrán su propio
 * archivo con sus propios ejes (tipo de montaje, freno…) y los componentes
 * de filtro no cambian. Si una categoría no necesita calculadora,
 * simplemente no declara un eje de tipo "calculadora".
 */

export const RUEDAS = {
  /**
   * Cuántas ruedas efectivas soportan la carga, según la configuración del
   * equipo. ⚠️ Pendiente de validar con RGA (plan.md §14).
   *
   *  2 → carretilla o zorra: ambas apoyan siempre, no hay redundancia.
   *      No se descuenta lo que sostiene el operario: si suelta, las ruedas
   *      quedan con todo.
   *  3 → trípode: tres puntos definen un plano, las tres siempre tocan.
   *  4 → plataforma: en piso irregular una queda al aire y su carga pasa
   *      a las otras, así que se calcula sobre tres.
   */
  divisores: { 2: 2, 3: 3, 4: 3 } as Record<number, number>,

  /** Configuraciones que se ofrecen en la calculadora, en orden. */
  configuraciones: [2, 3, 4] as const,

  /** Tope del deslizador de peso, en kg. */
  pesoMaximo: 4000,
  pesoPaso: 50,

  ejes: [
    { id: "capacidad", tipo: "calculadora", campo: "capacidadKg" },
    { id: "banda", tipo: "opciones", campo: "banda" },
    { id: "linea", tipo: "opciones", campo: "linea" },
  ],
} as const;

/** Capacidad mínima por rueda para mover `peso` con `nRuedas` ruedas. */
export function capacidadRequerida(peso: number, nRuedas: number): number {
  const divisor = RUEDAS.divisores[nRuedas] ?? nRuedas;
  return Math.ceil(peso / divisor);
}
