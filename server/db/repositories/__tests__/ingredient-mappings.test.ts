import { describe, it, expect, vi } from "vitest";

// Mock the database module before importing the module under test
vi.mock("../../drizzle", () => ({
  db: {
    query: {},
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../schema", () => ({
  ingredientNameMappings: {
    rawName: "rawName",
    normalizedName: "normalizedName",
    createdAt: "createdAt",
    id: "id",
  },
}));

import { escapeLikePattern } from "../ingredient-mappings";

// Test the escapeLikePattern helper function
describe("escapeLikePattern", () => {
  it("escapes % characters", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
  });

  it("escapes _ characters", () => {
    expect(escapeLikePattern("foo_bar")).toBe("foo\\_bar");
  });

  it("escapes backslash characters", () => {
    expect(escapeLikePattern("path\\to")).toBe("path\\\\to");
  });

  it("escapes multiple special characters", () => {
    expect(escapeLikePattern("100% organic_food")).toBe("100\\% organic\\_food");
  });

  it("returns normal strings unchanged", () => {
    expect(escapeLikePattern("chicken breast")).toBe("chicken breast");
  });
});
