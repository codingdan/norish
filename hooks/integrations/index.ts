/**
 * Integrations Hooks
 *
 * tRPC-based hooks for external service integrations.
 */

// KitchenOwl integration
export {
  useKitchenOwlConfig,
  useKitchenOwlMutations,
  useSendToKitchenOwl,
} from "./use-kitchenowl";

export type { SendIngredientsOptions } from "./use-kitchenowl";
