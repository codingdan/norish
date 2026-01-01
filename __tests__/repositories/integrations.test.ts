import { describe, it, expect, vi, beforeEach } from "vitest";

// Create mock db object
const mockFindFirst = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockValues = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockReturning = vi.fn();

const mockDb = {
  query: {
    integrations: {
      findFirst: mockFindFirst,
    },
  },
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
};

// Setup chainable mocks
mockInsert.mockReturnValue({ values: mockValues });
mockValues.mockReturnValue({ returning: mockReturning });
mockUpdate.mockReturnValue({ set: mockSet });
mockSet.mockReturnValue({ where: mockWhere });
mockWhere.mockReturnValue({ returning: mockReturning });
mockDelete.mockReturnValue({ where: vi.fn() });

// Mock the drizzle module (used by relative import ../drizzle)
vi.mock("@/server/db/drizzle", () => ({
  db: mockDb,
}));

// Mock crypto
vi.mock("@/server/auth/crypto", () => ({
  encrypt: vi.fn((val: string) => `encrypted:${val}`),
  decrypt: vi.fn((val: string) => val.replace("encrypted:", "")),
}));

describe("integrations repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chainable mocks
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockDelete.mockReturnValue({ where: vi.fn() });
  });

  it("encrypts token when saving integration", async () => {
    const { saveKitchenOwlConfig } = await import("@/server/db/repositories/integrations");
    const { encrypt } = await import("@/server/auth/crypto");

    // Mock no existing config
    mockFindFirst.mockResolvedValue(null);
    // Mock insert returning created integration
    mockReturning.mockResolvedValue([{
      id: "int-1",
      userId: "user-123",
      type: "kitchenowl",
      serverUrl: "https://kitchen.example.com",
      encryptedToken: "encrypted:secret-token",
      defaultHouseholdId: null,
      defaultShoppingListId: null,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    await saveKitchenOwlConfig("user-123", {
      serverUrl: "https://kitchen.example.com",
      apiToken: "secret-token",
    });

    expect(encrypt).toHaveBeenCalledWith("secret-token");
  });

  it("decrypts token when retrieving integration", async () => {
    const { getKitchenOwlConfig } = await import("@/server/db/repositories/integrations");
    const { decrypt } = await import("@/server/auth/crypto");

    mockFindFirst.mockResolvedValue({
      id: "int-1",
      userId: "user-123",
      type: "kitchenowl",
      serverUrl: "https://kitchen.example.com",
      encryptedToken: "encrypted:secret-token",
      defaultHouseholdId: 1,
      defaultShoppingListId: 1,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await getKitchenOwlConfig("user-123");

    expect(decrypt).toHaveBeenCalledWith("encrypted:secret-token");
    expect(result?.apiToken).toBe("secret-token");
  });
});
