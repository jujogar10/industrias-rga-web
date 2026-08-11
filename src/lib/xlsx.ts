import ExcelJS from "exceljs";

/*
 * Lectura genérica de las hojas del catálogo. Las plantillas de RGA tienen
 * una nota en la fila 1 y los encabezados en la fila 2, así que los datos
 * arrancan en la 3.
 */

const FILA_ENCABEZADOS = 2;

export type Fila = Record<string, unknown>;

/** "en qué se diferencia (para el cliente)" -> "en que se diferencia para el cliente" */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Devuelve las filas con datos de una hoja, indexadas por encabezado normalizado.
 * Ignora las filas cuya primera columna esté vacía (el rango con formato de la
 * plantilla llega hasta la fila 300 aunque estén en blanco).
 */
export async function leerHoja(ruta: string, hoja: string): Promise<Fila[]> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(ruta);
  const ws = libro.getWorksheet(hoja);
  if (!ws) {
    throw new Error(
      `${ruta}: no existe la hoja "${hoja}". Hojas disponibles: ` +
        libro.worksheets.map((w) => w.name).join(", "),
    );
  }

  const encabezados: string[] = [];
  ws.getRow(FILA_ENCABEZADOS).eachCell({ includeEmpty: true }, (celda, col) => {
    encabezados[col] = normalizar(String(celda.value ?? ""));
  });

  const filas: Fila[] = [];
  ws.eachRow({ includeEmpty: false }, (fila, numero) => {
    if (numero <= FILA_ENCABEZADOS) return;
    const registro: Fila = {};
    let vacia = true;
    fila.eachCell({ includeEmpty: true }, (celda, col) => {
      const clave = encabezados[col];
      if (!clave) return;
      const valor = limpiar(celda.value);
      registro[clave] = valor;
      if (col === 1 && valor !== null) vacia = false;
    });
    if (!vacia) {
      registro.__fila = numero;
      filas.push(registro);
    }
  });

  return filas;
}

/** Excel devuelve objetos para fórmulas y texto enriquecido; aquí se aplanan. */
function limpiar(valor: ExcelJS.CellValue): unknown {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "object") {
    if ("result" in valor) return limpiar(valor.result as ExcelJS.CellValue);
    if ("richText" in valor) {
      return valor.richText.map((t) => t.text).join("");
    }
    if ("text" in valor) return String(valor.text);
    return null;
  }
  if (typeof valor === "string") {
    const t = valor.trim();
    return t === "" ? null : t;
  }
  return valor;
}

/** Busca una columna por el inicio de su encabezado normalizado. */
export function campo(fila: Fila, clave: string): unknown {
  const normal = normalizar(clave);
  if (normal in fila) return fila[normal];
  const encontrada = Object.keys(fila).find((k) => k.startsWith(normal));
  return encontrada ? fila[encontrada] : null;
}

export function texto(fila: Fila, clave: string): string | null {
  const v = campo(fila, clave);
  return v === null || v === undefined ? null : String(v).trim();
}

export function numero(fila: Fila, clave: string): number | null {
  const v = campo(fila, clave);
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function siNo(fila: Fila, clave: string): boolean | null {
  const v = texto(fila, clave);
  if (v === null) return null;
  const t = v.toUpperCase();
  if (t === "SI" || t === "SÍ") return true;
  if (t === "NO") return false;
  return null;
}
