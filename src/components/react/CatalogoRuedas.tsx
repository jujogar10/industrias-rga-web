import { useEffect, useMemo, useRef, useState } from "react";
import type { TextosCatalogo } from "../../i18n/catalogo";

/*
 * Catálogo de ruedas con las tres puertas de entrada (plan.md §5.1).
 *
 * Dos reglas que guían todo el componente:
 *  1. La cuadrícula nunca arranca vacía — filtrar solo reduce.
 *  2. Un chip que llevaría a cero resultados no se ofrece. Los conteos se
 *     calculan contra los OTROS filtros activos, así material y línea quedan
 *     encadenados sin combinaciones imposibles.
 */

export interface RuedaVista {
  referencia: string;
  linea: string;
  banda: string;
  capacidadKg: number;
  diametro: string;
  ancho: string | null;
  eje: string | null;
  durezaShore: string | null;
  materialNombre: string;
  lineaNombre: string;
  imagen: string | null;
  url: string;
}

export interface Opcion {
  id: string;
  nombre: string;
}

interface Props {
  ruedas: RuedaVista[];
  materiales: Opcion[];
  lineas: Opcion[];
  textos: TextosCatalogo;
  configuraciones: readonly number[];
  divisores: Record<number, number>;
  pesoMaximo: number;
  pesoPaso: number;
  whatsappUrl: string;
  ctaWhatsapp: string;
  locale: string;
}

type Estado = {
  nRuedas: number | null;
  peso: number;
  materiales: string[];
  lineas: string[];
};

const VACIO: Estado = { nRuedas: null, peso: 0, materiales: [], lineas: [] };

export default function CatalogoRuedas({
  ruedas,
  materiales,
  lineas,
  textos,
  configuraciones,
  divisores,
  pesoMaximo,
  pesoPaso,
  whatsappUrl,
  ctaWhatsapp,
  locale,
}: Props) {
  const [estado, setEstado] = useState<Estado>(VACIO);
  const [abierta, setAbierta] = useState<string | null>(null);
  const refResultados = useRef<HTMLDivElement>(null);

  // Al cargar, reconstruye el estado desde la URL para que un enlace
  // compartido por WhatsApp abra el catálogo ya filtrado.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const n = Number(p.get("ruedas"));
    const peso = Number(p.get("peso"));
    const inicial: Estado = {
      nRuedas: configuraciones.includes(n) ? n : null,
      peso: Number.isFinite(peso) && peso > 0 ? peso : 0,
      materiales: (p.get("material") ?? "").split(",").filter(Boolean),
      lineas: (p.get("linea") ?? "").split(",").filter(Boolean),
    };
    setEstado(inicial);
    if (inicial.peso > 0) setAbierta("carga");
    else if (inicial.materiales.length) setAbierta("material");
    else if (inicial.lineas.length) setAbierta("linea");
  }, []);

  useEffect(() => {
    const p = new URLSearchParams();
    if (estado.peso > 0) {
      p.set("peso", String(estado.peso));
      if (estado.nRuedas) p.set("ruedas", String(estado.nRuedas));
    }
    if (estado.materiales.length) p.set("material", estado.materiales.join(","));
    if (estado.lineas.length) p.set("linea", estado.lineas.join(","));
    const query = p.toString();
    const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [estado]);

  const nRuedas = estado.nRuedas ?? 4;
  const requerido = useMemo(() => {
    if (estado.peso <= 0) return 0;
    return Math.ceil(estado.peso / (divisores[nRuedas] ?? nRuedas));
  }, [estado.peso, nRuedas, divisores]);

  const pasa = (r: RuedaVista, omitir?: "material" | "linea") =>
    (requerido === 0 || r.capacidadKg >= requerido) &&
    (omitir === "material" || !estado.materiales.length || estado.materiales.includes(r.banda)) &&
    (omitir === "linea" || !estado.lineas.length || estado.lineas.includes(r.linea));

  const resultados = useMemo(() => ruedas.filter((r) => pasa(r)), [ruedas, estado, requerido]);

  const opcionesMaterial = useMemo(
    () =>
      contar(
        materiales,
        ruedas.filter((r) => pasa(r, "material")),
        (r) => r.banda,
        estado.materiales,
      ),
    [ruedas, estado, requerido],
  );
  const opcionesLinea = useMemo(
    () =>
      contar(
        lineas,
        ruedas.filter((r) => pasa(r, "linea")),
        (r) => r.linea,
        estado.lineas,
      ),
    [ruedas, estado, requerido],
  );

  const alternar = (clave: "materiales" | "lineas", id: string) =>
    setEstado((e) => ({
      ...e,
      [clave]: e[clave].includes(id) ? e[clave].filter((x) => x !== id) : [...e[clave], id],
    }));

  const nota =
    nRuedas === 2 ? textos.nota2 : nRuedas === 3 ? textos.nota3 : textos.nota4;
  const efectivas = divisores[nRuedas] ?? nRuedas;
  const kg = (n: number) => n.toLocaleString(locale);

  /*
   * Resumen de lo que está filtrando ahora mismo. Existe porque los paneles
   * son excluyentes: al abrir "línea" se ocultan los chips de material y el
   * cliente perdía de vista qué tenía puesto.
   */
  const nombreDe = (lista: Opcion[], id: string) =>
    lista.find((o) => o.id === id)?.nombre ?? id;

  /*
   * En móvil el panel abierto ocupa toda la pantalla y tanto el contador como
   * la cuadrícula quedan bajo el pliegue: se toca un chip y no pasa nada
   * visible, así que el filtro parece roto. Por eso cada panel lleva su propio
   * contador en vivo abajo, que además cierra el panel y baja a los resultados.
   */
  const cerrarYVer = () => {
    setAbierta(null);
    requestAnimationFrame(() =>
      refResultados.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  const filtrosActivos = [
    ...(estado.peso > 0
      ? [
          {
            clave: "peso",
            etiqueta: textos.resumenCarga
              .replace("{peso}", kg(estado.peso))
              .replace("{n}", String(nRuedas)),
            quitar: () => setEstado((e) => ({ ...e, peso: 0 })),
          },
        ]
      : []),
    ...estado.materiales.map((id) => ({
      clave: `material-${id}`,
      etiqueta: nombreDe(materiales, id),
      quitar: () => alternar("materiales", id),
    })),
    ...estado.lineas.map((id) => ({
      clave: `linea-${id}`,
      etiqueta: nombreDe(lineas, id),
      quitar: () => alternar("lineas", id),
    })),
  ];

  return (
    <div>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Puerta
          activa={abierta === "carga"}
          titulo={textos.puertaCarga}
          sub={textos.puertaCargaSub}
          cuantos={estado.peso > 0 ? 1 : 0}
          onClick={() => setAbierta(abierta === "carga" ? null : "carga")}
        />
        <Puerta
          activa={abierta === "material"}
          titulo={textos.puertaMaterial}
          sub={textos.puertaMaterialSub}
          cuantos={estado.materiales.length}
          onClick={() => setAbierta(abierta === "material" ? null : "material")}
        />
        <Puerta
          activa={abierta === "linea"}
          titulo={textos.puertaLinea}
          sub={textos.puertaLineaSub}
          cuantos={estado.lineas.length}
          onClick={() => setAbierta(abierta === "linea" ? null : "linea")}
        />
      </div>

      {abierta === "carga" && (
        <div className="mb-8 rounded-[--radius-card] bg-rga-bg-alt p-6">
          <p className="mb-3 text-sm text-rga-text-secondary">{textos.calcPaso1}</p>
          <div className="mb-6 flex flex-wrap gap-2">
            {configuraciones.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setEstado((e) => ({ ...e, nRuedas: n }))}
                aria-pressed={estado.nRuedas === n}
                className={`rounded-[--radius-card] border px-5 py-2.5 font-body text-sm transition ${
                  estado.nRuedas === n
                    ? "border-rga-navy bg-rga-navy text-white"
                    : "border-rga-border bg-white text-rga-text hover:border-rga-acero"
                }`}
              >
                {n} {textos.ruedas}
              </button>
            ))}
          </div>

          <label className="mb-3 block text-sm text-rga-text-secondary" htmlFor="peso">
            {textos.calcPaso2}
          </label>
          <div className="flex items-center gap-4">
            <input
              id="peso"
              type="range"
              min={0}
              max={pesoMaximo}
              step={pesoPaso}
              value={estado.peso}
              onChange={(ev) => {
                // El valor se lee ahora, no dentro del updater: React ejecuta
                // el updater después y para entonces currentTarget ya es null.
                const peso = Number(ev.currentTarget.value);
                setEstado((e) => ({ ...e, peso }));
              }}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-rga-border accent-rga-navy"
            />
            <span className="min-w-24 text-right font-mono-tech text-sm">
              {estado.peso > 0 ? `${kg(estado.peso)} kg` : textos.calcSinDefinir}
            </span>
          </div>

          {estado.peso > 0 && (
            <div className="mt-5 rounded-[--radius-card] bg-white p-4">
              <p className="font-heading text-lg text-rga-navy">
                {textos.calcResultado.replace("{kg}", kg(requerido))}
              </p>
              <p className="mt-1 font-mono-tech text-xs text-rga-text-secondary">
                {textos.calcFormula
                  .replace("{peso}", kg(estado.peso))
                  .replace(
                    "{efectivas}",
                    `${efectivas} ${efectivas === nRuedas ? textos.ruedas : textos.ruedasEfectivas}`,
                  )}
              </p>
            </div>
          )}
          <p className="mt-3 text-sm leading-relaxed text-rga-text-secondary">{nota}</p>
          <PiePanel total={resultados.length} textos={textos} onVer={cerrarYVer} />
        </div>
      )}

      {abierta === "material" && (
        <Chips
          titulo={textos.material}
          opciones={opcionesMaterial}
          activos={estado.materiales}
          onToggle={(id) => alternar("materiales", id)}
        >
          <PiePanel total={resultados.length} textos={textos} onVer={cerrarYVer} />
        </Chips>
      )}

      {abierta === "linea" && (
        <Chips
          titulo={textos.linea}
          opciones={opcionesLinea}
          activos={estado.lineas}
          onToggle={(id) => alternar("lineas", id)}
        >
          <PiePanel total={resultados.length} textos={textos} onVer={cerrarYVer} />
        </Chips>
      )}

      <div ref={refResultados} className="mb-8 scroll-mt-24 border-y border-rga-border py-3">
        <div className="flex items-center justify-between gap-4">
          <span className="font-body text-sm font-medium">
            {resultados.length}{" "}
            {resultados.length === 1 ? textos.referencia : textos.referencias}
          </span>
          {filtrosActivos.length > 0 && (
            <button
              type="button"
              onClick={() => setEstado(VACIO)}
              className="font-body text-sm text-rga-navy underline-offset-4 hover:underline"
            >
              {textos.limpiar}
            </button>
          )}
        </div>

        {filtrosActivos.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-body text-xs text-rga-text-secondary">
              {textos.filtrando}:
            </span>
            {filtrosActivos.map((f) => (
              <button
                key={f.clave}
                type="button"
                onClick={f.quitar}
                title={textos.quitarFiltro}
                className="inline-flex items-center gap-1.5 rounded-[--radius-card] bg-rga-navy py-1 pl-3 pr-2 font-body text-xs text-white hover:bg-rga-navy-hover"
              >
                {f.etiqueta}
                <span aria-hidden="true" className="text-white/70">
                  ✕
                </span>
                <span className="sr-only">— {textos.quitarFiltro}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {resultados.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {resultados.map((r) => (
            <Tarjeta key={r.referencia} rueda={r} textos={textos} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="rounded-[--radius-card] bg-rga-bg-alt p-8 text-center">
          <p className="font-heading text-xl text-rga-navy">{textos.vacioTitulo}</p>
          <p className="mx-auto mt-2 max-w-md font-body text-rga-text-secondary">
            {textos.vacioCuerpo}
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener"
            className="mt-6 inline-flex rounded-[--radius-card] bg-rga-navy px-5 py-3 font-body text-sm font-medium text-white hover:bg-rga-navy-hover"
          >
            {ctaWhatsapp}
          </a>
        </div>
      )}
    </div>
  );
}

function Puerta({
  activa,
  titulo,
  sub,
  cuantos,
  onClick,
}: {
  activa: boolean;
  titulo: string;
  sub: string;
  cuantos: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`rounded-[--radius-card] border p-5 text-left transition ${
        activa
          ? "border-rga-navy bg-white ring-1 ring-rga-navy"
          : "border-rga-border bg-white hover:border-rga-acero"
      }`}
    >
      <p className="flex items-center gap-2 font-heading text-base font-medium text-rga-text">
        {titulo}
        {/* Marca la puerta cerrada que sí tiene algo puesto. */}
        {cuantos > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rga-navy px-1.5 font-body text-xs text-white">
            {cuantos}
          </span>
        )}
      </p>
      <p className="mt-1 font-body text-sm text-rga-text-secondary">{sub}</p>
    </button>
  );
}

function PiePanel({
  total,
  textos,
  onVer,
}: {
  total: number;
  textos: TextosCatalogo;
  onVer: () => void;
}) {
  const etiqueta =
    total === 0
      ? textos.verCero
      : total === 1
        ? textos.verUna
        : textos.verN.replace("{n}", String(total));
  return (
    <button
      type="button"
      onClick={onVer}
      className="mt-5 w-full rounded-[--radius-card] bg-rga-navy px-5 py-3 font-body text-sm font-medium text-white transition hover:bg-rga-navy-hover"
    >
      {etiqueta}
    </button>
  );
}

function Chips({
  titulo,
  opciones,
  activos,
  onToggle,
  children,
}: {
  titulo: string;
  opciones: Array<Opcion & { total: number }>;
  activos: string[];
  onToggle: (id: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 rounded-[--radius-card] bg-rga-bg-alt p-6">
      <p className="mb-3 text-sm text-rga-text-secondary">{titulo}</p>
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => {
          const on = activos.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onToggle(o.id)}
              aria-pressed={on}
              className={`rounded-[--radius-card] border px-4 py-2 font-body text-sm transition ${
                on
                  ? "border-rga-navy bg-rga-navy text-white"
                  : "border-rga-border bg-white text-rga-text hover:border-rga-acero"
              }`}
            >
              {o.nombre}{" "}
              <span className={on ? "text-white/70" : "text-rga-text-secondary"}>
                ({o.total})
              </span>
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}

function Tarjeta({
  rueda,
  textos,
  locale,
}: {
  rueda: RuedaVista;
  textos: TextosCatalogo;
  locale: string;
}) {
  return (
    <a
      href={rueda.url}
      className="group block overflow-hidden rounded-[--radius-card] border border-rga-border bg-white transition-shadow hover:shadow-lg"
    >
      <div className="aspect-square overflow-hidden bg-rga-bg-alt">
        {rueda.imagen ? (
          <img
            src={rueda.imagen}
            alt={`${rueda.lineaNombre} ${rueda.diametro}`}
            loading="lazy"
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-heading text-sm text-rga-acero-light">
            {rueda.referencia}
          </div>
        )}
      </div>
      <div className="p-5">
        <p className="font-mono-tech text-xs text-rga-text-secondary">{rueda.referencia}</p>
        <p className="mt-1 font-heading text-base font-medium text-rga-text">
          Ø{rueda.diametro} · {rueda.materialNombre}
        </p>
        <p className="mt-3 font-heading text-2xl font-semibold text-rga-navy">
          {rueda.capacidadKg.toLocaleString(locale)} kg
        </p>
        <p className="font-body text-xs text-rga-text-secondary">{textos.capacidadPorRueda}</p>
        <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono-tech text-xs text-rga-text-secondary">
          {rueda.eje && (
            <div>
              <dt className="inline">{textos.eje} </dt>
              <dd className="inline text-rga-text">{rueda.eje}</dd>
            </div>
          )}
          {rueda.ancho && (
            <div>
              <dt className="inline">{textos.ancho} </dt>
              <dd className="inline text-rga-text">{rueda.ancho}</dd>
            </div>
          )}
          {rueda.durezaShore && (
            <div>
              <dt className="inline">{textos.dureza} </dt>
              <dd className="inline text-rga-text">{rueda.durezaShore}</dd>
            </div>
          )}
        </dl>
        <span className="mt-4 inline-block rounded-[--radius-card] bg-rga-bg-alt px-3 py-1 font-body text-xs text-rga-acero-dark">
          {rueda.lineaNombre}
        </span>
      </div>
    </a>
  );
}

/*
 * Un chip que daría cero resultados no se ofrece — salvo que ya esté activo:
 * si se ocultara, el cliente vería "0 referencias" sin ver la causa y sin
 * forma de deshacerlo salvo limpiar todo.
 */
function contar(
  opciones: Opcion[],
  ruedas: RuedaVista[],
  campo: (r: RuedaVista) => string,
  activos: string[],
): Array<Opcion & { total: number }> {
  return opciones
    .map((o) => ({ ...o, total: ruedas.filter((r) => campo(r) === o.id).length }))
    .filter((o) => o.total > 0 || activos.includes(o.id));
}
