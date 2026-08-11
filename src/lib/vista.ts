import { getImage } from "astro:assets";
import { getCatalogo } from "./catalogo";
import type { RuedaVista, Opcion } from "../components/react/CatalogoRuedas";
import { routes, type Lang } from "../i18n/ui";

/*
 * Adapta el catálogo (que vive en el servidor, con objetos Medida) a lo que
 * el island de React necesita: strings planos y serializables.
 *
 * Las imágenes se resuelven aquí con import.meta.glob porque el Excel guarda
 * solo el nombre de archivo. Como las tarjetas se pintan dentro de un island
 * de React no se puede usar el componente <Image> de Astro, así que se llama
 * a getImage() a mano — si no, se serviría el PNG máster completo (2 MB) para
 * mostrarlo a 350 px.
 *
 * Un solo tamaño para tarjeta y ficha a propósito: así las 14 tarjetas y la
 * ficha comparten el mismo archivo en caché en vez de descargar dos variantes.
 */

const ANCHO = 1000; // ficha ~464 px, tarjeta ~350 px — alcanza para pantallas 2x

const imagenes = import.meta.glob<{ default: ImageMetadata }>(
  "../assets/productos/*.{png,jpg,jpeg,webp,avif}",
  { eager: true },
);

const porNombre = new Map(
  Object.entries(imagenes).map(([ruta, mod]) => [ruta.split("/").pop()!, mod.default]),
);

export async function urlImagen(archivo: string | null): Promise<string | null> {
  if (!archivo) return null;
  const meta = porNombre.get(archivo);
  if (!meta) return null;
  const optimizada = await getImage({ src: meta, width: ANCHO, format: "webp" });
  return optimizada.src;
}

export async function vistaRuedas(lang: Lang): Promise<{
  ruedas: RuedaVista[];
  materiales: Opcion[];
  lineas: Opcion[];
}> {
  const c = await getCatalogo();
  const nombreMat = new Map(c.materiales.map((m) => [m.id, m.nombre[lang]]));
  const nombreLin = new Map(c.lineas.map((l) => [l.id, l.nombre[lang]]));

  const ruedas = await Promise.all(
    c.ruedas.map(async (r) => ({
      referencia: r.referencia,
      linea: r.linea,
      banda: r.banda,
      capacidadKg: r.capacidadKg,
      diametro: r.diametro.texto,
      ancho: r.ancho?.texto ?? null,
      eje: r.eje?.texto ?? null,
      durezaShore: r.durezaShore,
      materialNombre: nombreMat.get(r.banda) ?? r.banda,
      lineaNombre: nombreLin.get(r.linea) ?? r.linea,
      imagen: await urlImagen(r.imagen),
      url: `${routes[lang].wheels}/${r.slug[lang]}/`,
    })),
  );

  return {
    ruedas,
    materiales: c.materiales.map((m) => ({ id: m.id, nombre: m.nombre[lang] })),
    lineas: c.lineas.map((l) => ({ id: l.id, nombre: l.nombre[lang] })),
  };
}
