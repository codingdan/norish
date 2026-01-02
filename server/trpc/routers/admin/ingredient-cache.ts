import { z } from "zod";

import { router } from "../../trpc";
import { adminProcedure } from "../../middleware";

import { trpcLogger as log } from "@/server/logger";
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
    .query(async ({ input, ctx }) => {
      log.debug({ userId: ctx.user.id, ...input }, "Listing ingredient cache mappings");
      return listMappings(input.page, input.limit, input.search);
    }),

  add: adminProcedure
    .input(
      z.object({
        rawName: z.string().min(1),
        normalizedName: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      log.info(
        { userId: ctx.user.id, rawName: input.rawName, normalizedName: input.normalizedName },
        "Adding ingredient cache mapping"
      );
      try {
        const entry = await addMapping(input.rawName, input.normalizedName);
        return { success: true, entry };
      } catch (error) {
        if (error instanceof Error && error.message.includes("duplicate key")) {
          return { success: false, error: "Mapping already exists" };
        }
        throw error;
      }
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        normalizedName: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      log.info({ userId: ctx.user.id, id: input.id }, "Updating ingredient cache mapping");
      await updateMapping(input.id, input.normalizedName);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      log.info({ userId: ctx.user.id, id: input.id }, "Deleting ingredient cache mapping");
      await deleteMapping(input.id);
      return { success: true };
    }),

  clear: adminProcedure.mutation(async ({ ctx }) => {
    log.info({ userId: ctx.user.id }, "Clearing all ingredient cache mappings");
    const count = await clearAllMappings();
    return { success: true, count };
  }),
});
