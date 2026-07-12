import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const categorias = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/categorias" }),
  schema: z.object({
    slug: z.string(),
    orden: z.number(),
    nombre: z.object({
      es: z.string(),
      en: z.string(),
    }),
    descripcion: z.object({
      es: z.string(),
      en: z.string(),
    }),
    // Ruta bajo /public/videos/ — sin valor mientras no exista el footage (ver plan.md §14)
    video: z.string().optional(),
  }),
});

export const collections = { categorias };
