import { z } from "zod";

import { router } from "../../trpc";
import { adminProcedure } from "../../middleware";

import {
  listMappings,
  addMapping,
  updateMapping,
  deleteMapping,
  clearAllMappings,
} from "@/server/db/repositories/ingredient-mappings";

export const ingredientCacheRouter = router({
  list: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return listMappings(input.page, input.limit, input.search);
    }),

  add: adminProcedure
    .input(
      z.object({
        rawName: z.string().min(1),
        normalizedName: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const entry = await addMapping(input.rawName, input.normalizedName);
      return { success: true, entry };
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        normalizedName: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      await updateMapping(input.id, input.normalizedName);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await deleteMapping(input.id);
      return { success: true };
    }),

  clear: adminProcedure.mutation(async () => {
    const count = await clearAllMappings();
    return { success: true, count };
  }),
});
