import path from "node:path";
import { leerHoja, texto, numero, siNo, type Fila } from "./xlsx";
import { aMedida, type Medida } from "./medidas";
import type { Lang } from "../i18n/ui";

/*
 * Catálogo de ruedas — fuente: src/data/catalogo-ruedas.xlsx (ver plan.md §5.1).
 *
 * Principio: el Excel guarda hechos medibles; las etiquetas de búsqueda se
 * derivan aquí. Los rangos de carga se calculan contra la hoja rangos_carga,
 * y los filtros que ve el cliente salen de los productos que realmente
 * existen, no de una lista declarada a mano.
 *
 * Si un dato no cuadra, el build falla con TODOS los errores juntos y con el
 * número de fila del Excel. Esa es la red que permite editar la hoja sin miedo.
 */

const ARCHIVO = path.resolve(process.cwd(), "src/data/catalogo-ruedas.xlsx");

export interface Termino {
  id: string;
  nombre: Record<Lang, string>;
  orden: number;
}

export interface Linea extends Termino {
  diferencia: string | null;
  imagen: string | null;
}

export interface RangoCarga {
  id: string;
  nombre: Record<Lang, string>;
  min: number;
  max: number;
  orden: number;
}

export interface Rueda {
  referencia: string;
  linea: string;
  banda: string;
  capacidadKg: number;
  diametro: Medida;
  ancho: Medida | null;
  eje: Medida | null;
  nucleo: string | null;
  rodamiento: string | null;
  durezaShore: string | null;
  tempMaxC: number | null;
  aplicaciones: Record<Lang, string[]>;
  imagen: string | null;
  destacado: boolean;
  rango: string;
  slug: Record<Lang, string>;
}

export interface Catalogo {
  ruedas: Rueda[];
  materiales: Termino[];
  lineas: Linea[];
  nucleos: Termino[];
  rodamientos: Termino[];
  rangos: RangoCarga[];
}

let cache: Promise<Catalogo> | null = null;

export function getCatalogo(): Promise<Catalogo> {
  cache ??= construir();
  return cache;
}

async function construir(): Promise<Catalogo> {
  const errores: string[] = [];
  const anotar = (fila: unknown, mensaje: string) =>
    errores.push(`hoja "ruedas", fila ${fila}: ${mensaje}`);

  const [fMat, fLin, fNuc, fRod, fRan, fRue] = await Promise.all([
    leerHoja(ARCHIVO, "materiales"),
    leerHoja(ARCHIVO, "lineas"),
    leerHoja(ARCHIVO, "nucleos"),
    leerHoja(ARCHIVO, "rodamientos"),
    leerHoja(ARCHIVO, "rangos_carga"),
    leerHoja(ARCHIVO, "ruedas"),
  ]);

  const materiales = terminos(fMat);
  const nucleos = terminos(fNuc);
  const rodamientos = terminos(fRod);

  const lineas: Linea[] = terminos(fLin).map((t, i) => ({
    ...t,
    diferencia: texto(fLin[i], "en que se diferencia"),
    imagen: texto(fLin[i], "imagen"),
  }));

  const rangos: RangoCarga[] = fRan.map((f, i) => {
    const es = texto(f, "etiqueta_es") ?? `rango ${i + 1}`;
    return {
      id: aSlug(es),
      nombre: { es, en: texto(f, "etiqueta_en") ?? es },
      min: numero(f, "min_kg") ?? 0,
      max: numero(f, "max_kg") ?? Number.MAX_SAFE_INTEGER,
      orden: numero(f, "orden") ?? i,
    };
  });

  const ids = (lista: Termino[]) => new Set(lista.map((t) => t.id));
  const idsMat = ids(materiales);
  const idsLin = ids(lineas);
  const idsNuc = ids(nucleos);
  const idsRod = ids(rodamientos);

  const vistas = new Map<string, number>();
  const ruedas: Rueda[] = [];

  for (const f of fRue) {
    const nf = f.__fila;
    const referencia = texto(f, "referencia");
    if (!referencia) continue;

    if (siNo(f, "activo") === false) continue;

    const previa = vistas.get(referencia);
    if (previa) {
      anotar(nf, `la referencia "${referencia}" ya existe en la fila ${previa}.`);
      continue;
    }
    vistas.set(referencia, Number(nf));

    const linea = texto(f, "linea");
    const banda = texto(f, "banda");
    const nucleo = texto(f, "nucleo");
    const rodamiento = texto(f, "rodamiento");
    const capacidadKg = numero(f, "capacidad_kg");

    if (!linea) anotar(nf, "falta la línea.");
    else if (!idsLin.has(linea))
      anotar(nf, `la línea "${linea}" no está en la hoja "lineas".`);

    if (!banda) anotar(nf, "falta el material de banda.");
    else if (!idsMat.has(banda))
      anotar(nf, `el material "${banda}" no está en la hoja "materiales".`);

    if (nucleo && !idsNuc.has(nucleo))
      anotar(nf, `el núcleo "${nucleo}" no está en la hoja "nucleos".`);

    if (rodamiento && !idsRod.has(rodamiento))
      anotar(nf, `el rodamiento "${rodamiento}" no está en la hoja "rodamientos".`);

    if (capacidadKg === null || capacidadKg <= 0)
      anotar(nf, "falta capacidad_kg (debe ser un número mayor que cero).");

    let diametro: Medida | null = null;
    let ancho: Medida | null = null;
    let eje: Medida | null = null;
    try {
      diametro = aMedida(f["diametro in"] ?? f["diametro"], "diametro_in");
      ancho = aMedida(f["ancho in"] ?? f["ancho"], "ancho_in");
      eje = aMedida(f["eje in"] ?? f["eje"], "eje_in");
    } catch (e) {
      anotar(nf, (e as Error).message);
    }
    if (!diametro) anotar(nf, "falta diametro_in.");

    const rango = rangos.find(
      (r) => capacidadKg !== null && capacidadKg >= r.min && capacidadKg <= r.max,
    );
    if (capacidadKg !== null && !rango)
      anotar(
        nf,
        `capacidad ${capacidadKg} kg no cae en ningún rango de la hoja "rangos_carga".`,
      );

    if (errores.length) continue;

    const mat = materiales.find((m) => m.id === banda)!;
    const lin = lineas.find((l) => l.id === linea)!;

    ruedas.push({
      referencia,
      linea: linea!,
      banda: banda!,
      capacidadKg: capacidadKg!,
      diametro: diametro!,
      ancho,
      eje,
      nucleo,
      rodamiento,
      durezaShore: texto(f, "dureza_shore"),
      tempMaxC: numero(f, "temp_max_c"),
      aplicaciones: {
        es: lista(texto(f, "aplicaciones_es")),
        en: lista(texto(f, "aplicaciones_en")),
      },
      imagen: texto(f, "imagen") ?? lin.imagen,
      destacado: siNo(f, "destacado") === true,
      rango: rango!.id,
      slug: {
        es: aSlug(`rueda ${mat.nombre.es} ${diametro!.decimal}in ${referencia}`),
        en: aSlug(`${mat.nombre.en} wheel ${diametro!.decimal}in ${referencia}`),
      },
    });
  }

  if (errores.length) {
    throw new Error(
      `\n\nCatálogo de ruedas — ${errores.length} problema(s) en ` +
        `src/data/catalogo-ruedas.xlsx:\n\n` +
        errores.map((e) => `  • ${e}`).join("\n") +
        `\n\nCorrige el Excel y vuelve a construir.\n`,
    );
  }

  ordenar(ruedas, lineas);
  return { ruedas, materiales, lineas, nucleos, rodamientos, rangos };
}

function terminos(filas: Fila[]): Termino[] {
  return filas
    .map((f, i) => {
      const id = texto(f, "id") ?? "";
      const es = texto(f, "nombre_es") ?? id;
      return {
        id,
        nombre: { es, en: texto(f, "nombre_en") ?? es },
        orden: numero(f, "orden") ?? (i + 1) * 10,
      };
    })
    .filter((t) => t.id)
    .sort((a, b) => a.orden - b.orden);
}

/** Destacados primero, luego por línea, y dentro de cada línea por diámetro. */
function ordenar(ruedas: Rueda[], lineas: Linea[]): void {
  const peso = new Map(lineas.map((l) => [l.id, l.orden]));
  ruedas.sort((a, b) => {
    if (a.destacado !== b.destacado) return a.destacado ? -1 : 1;
    const pa = peso.get(a.linea) ?? 999;
    const pb = peso.get(b.linea) ?? 999;
    if (pa !== pb) return pa - pb;
    return a.diametro.decimal - b.diametro.decimal;
  });
}

function lista(valor: string | null): string[] {
  if (!valor) return [];
  return valor
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function aSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Los chips de filtro salen de los productos activos, no de la taxonomía:
 * un material sin referencias no debe ofrecerse (llevaría a una pantalla vacía),
 * y uno nuevo aparece solo con cargar sus referencias.
 */
export function conteo<T extends { id: string }>(
  terminos: T[],
  ruedas: Rueda[],
  campo: (r: Rueda) => string,
): Array<T & { total: number }> {
  return terminos
    .map((t) => ({ ...t, total: ruedas.filter((r) => campo(r) === t.id).length }))
    .filter((t) => t.total > 0);
}
