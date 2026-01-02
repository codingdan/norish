import { z } from "zod";

import { router } from "../../trpc";
import { adminProcedure } from "../../middleware";

import { trpcLogger as log } from "@/server/logger";
import { setConfig } from "@/server/db/repositories/server-config";
import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";

/**
 * Update grocery tracking enabled setting.
 */
const updateGroceryTracking = adminProcedure.input(z.boolean()).mutation(async ({ input, ctx }) => {
  log.info({ userId: ctx.user.id, enabled: input }, "Updating grocery tracking setting");

  await setConfig(ServerConfigKeys.GROCERY_TRACKING_ENABLED, input, ctx.user.id, false);

  return { success: true };
});

export const groceryTrackingProcedures = router({
  updateGroceryTracking,
});
