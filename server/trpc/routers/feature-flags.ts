import { router, publicProcedure } from "../trpc";

import { getConfig } from "@/server/db/repositories/server-config";
import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";

/**
 * Public feature flags endpoint.
 * Returns app-wide feature configuration that doesn't require authentication.
 */
const getFeatureFlags = publicProcedure.query(async () => {
  const groceryTrackingEnabled = await getConfig<boolean>(
    ServerConfigKeys.GROCERY_TRACKING_ENABLED
  );

  return {
    // Default to true if not set (backwards compatible)
    groceryTrackingEnabled: groceryTrackingEnabled ?? true,
  };
});

export const featureFlagsRouter = router({
  getFeatureFlags,
});
