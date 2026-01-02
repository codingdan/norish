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

const list = adminProcedure
  .input(
    z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(20),
      search: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const result = await listMappings(input.page, input.limit, input.search);
    return result;
  });

const add = adminProcedure
  .input(
    z.object({
      rawName: z.string().min(1),
      normalizedName: z.string().min(1),
    })
  )
  .mutation(async ({ input, ctx }) => {
    log.info(
      { userId: ctx.user.id, rawName: input.rawName },
      "Adding manual ingredient mapping"
    );

    const result = await addMapping(input.rawName, input.normalizedName);
    return result;
  });

const update = adminProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      normalizedName: z.string().min(1),
    })
  )
  .mutation(async ({ input, ctx }) => {
    log.info(
      { userId: ctx.user.id, id: input.id },
      "Updating ingredient mapping"
    );

    const result = await updateMapping(input.id, input.normalizedName);

    if (!result) {
      throw new Error("Mapping not found");
    }

    return result;
  });

const remove = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    log.info(
      { userId: ctx.user.id, id: input.id },
      "Deleting ingredient mapping"
    );

    const success = await deleteMapping(input.id);

    if (!success) {
      throw new Error("Mapping not found");
    }

    return { success };
  });

const clear = adminProcedure.mutation(async ({ ctx }) => {
  log.info({ userId: ctx.user.id }, "Clearing all ingredient mappings");

  const count = await clearAllMappings();

  log.info({ userId: ctx.user.id, count }, "Cleared ingredient mappings");

  return { count };
});

export const ingredientCacheProcedures = router({
  list,
  add,
  update,
  delete: remove,
  clear,
});
