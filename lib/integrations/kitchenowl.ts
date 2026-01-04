const TIMEOUT_MS = 10000;

export interface KitchenOwlHousehold {
  id: number;
  name: string;
}

export interface KitchenOwlShoppingList {
  id: number;
  name: string;
}

export interface TestConnectionResult {
  success: boolean;
  households?: KitchenOwlHousehold[];
  error?: string;
}

export interface AddItemResult {
  success: boolean;
  error?: string;
}

export interface AddItemsResult {
  successCount: number;
  failCount: number;
  errors: string[];
}

export interface ShoppingListItem {
  name: string;
  description?: string;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function normalizeUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, "");
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
}

export async function testConnection(
  serverUrl: string,
  apiToken: string
): Promise<TestConnectionResult> {
  const url = `${normalizeUrl(serverUrl)}/api/household`;

  try {
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: buildHeaders(apiToken),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `KitchenOwl returned ${response.status}: ${response.statusText}`,
      };
    }

    const households = (await response.json()) as KitchenOwlHousehold[];

    return { success: true, households };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, error: "Connection timed out after 10 seconds" };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getShoppingLists(
  serverUrl: string,
  apiToken: string,
  householdId: number
): Promise<KitchenOwlShoppingList[]> {
  const url = `${normalizeUrl(serverUrl)}/api/household/${householdId}/shoppinglist`;

  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers: buildHeaders(apiToken),
  });

  if (!response.ok) {
    throw new Error(`Failed to get shopping lists: ${response.status}`);
  }

  return response.json();
}

export async function addItemToShoppingList(
  serverUrl: string,
  apiToken: string,
  shoppingListId: number,
  itemName: string,
  description?: string
): Promise<AddItemResult> {
  const url = `${normalizeUrl(serverUrl)}/api/shoppinglist/${shoppingListId}/add-item-by-name`;

  try {
    const body: { name: string; description?: string } = { name: itemName };

    if (description) {
      body.description = description;
    }

    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: buildHeaders(apiToken),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to add item: ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 100;

export async function addItemsToShoppingList(
  serverUrl: string,
  apiToken: string,
  shoppingListId: number,
  items: ShoppingListItem[]
): Promise<AddItemsResult> {
  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  const chunks = chunkArray(items, BATCH_SIZE);

  for (const chunk of chunks) {
    const results = await Promise.all(
      chunk.map((item) =>
        addItemToShoppingList(serverUrl, apiToken, shoppingListId, item.name, item.description)
      )
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];

      if (result.success) {
        successCount++;
      } else {
        failCount++;
        if (result.error) {
          errors.push(`${chunk[i].name}: ${result.error}`);
        }
      }
    }

    // Small delay between batches to avoid overwhelming the server
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return { successCount, failCount, errors };
}
