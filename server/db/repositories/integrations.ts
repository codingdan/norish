import { eq, and } from "drizzle-orm";
import { db } from "../drizzle";
import { integrations, type Integration } from "../schema";
import { encrypt, decrypt } from "@/server/auth/crypto";

export interface KitchenOwlConfig {
  serverUrl: string;
  apiToken: string;
  defaultHouseholdId?: number | null;
  defaultShoppingListId?: number | null;
  enabled: boolean;
}

export interface KitchenOwlConfigInput {
  serverUrl: string;
  apiToken: string;
  defaultHouseholdId?: number | null;
  defaultShoppingListId?: number | null;
}

export async function getKitchenOwlConfig(userId: string): Promise<KitchenOwlConfig | null> {
  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.userId, userId),
      eq(integrations.type, "kitchenowl")
    ),
  });

  if (!integration || !integration.serverUrl || !integration.encryptedToken) {
    return null;
  }

  return {
    serverUrl: integration.serverUrl,
    apiToken: decrypt(integration.encryptedToken),
    defaultHouseholdId: integration.defaultHouseholdId,
    defaultShoppingListId: integration.defaultShoppingListId,
    enabled: integration.enabled,
  };
}

export async function saveKitchenOwlConfig(
  userId: string,
  config: KitchenOwlConfigInput
): Promise<Integration> {
  const encryptedToken = encrypt(config.apiToken);

  const existing = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.userId, userId),
      eq(integrations.type, "kitchenowl")
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(integrations)
      .set({
        serverUrl: config.serverUrl,
        encryptedToken,
        defaultHouseholdId: config.defaultHouseholdId ?? null,
        defaultShoppingListId: config.defaultShoppingListId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(integrations)
    .values({
      userId,
      type: "kitchenowl",
      serverUrl: config.serverUrl,
      encryptedToken,
      defaultHouseholdId: config.defaultHouseholdId ?? null,
      defaultShoppingListId: config.defaultShoppingListId ?? null,
      enabled: true,
    })
    .returning();

  return created;
}

export async function deleteKitchenOwlConfig(userId: string): Promise<void> {
  await db
    .delete(integrations)
    .where(
      and(
        eq(integrations.userId, userId),
        eq(integrations.type, "kitchenowl")
      )
    );
}

export async function setKitchenOwlEnabled(userId: string, enabled: boolean): Promise<void> {
  await db
    .update(integrations)
    .set({ enabled, updatedAt: new Date() })
    .where(
      and(
        eq(integrations.userId, userId),
        eq(integrations.type, "kitchenowl")
      )
    );
}
