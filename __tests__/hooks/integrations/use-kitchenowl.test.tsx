import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock query keys
const mockConfigQueryKey = ["integrations", "getKitchenOwlConfig"];

// Mock query/mutation options
const mockGetConfigQueryOptions = vi.fn();
const mockSaveConfigMutationOptions = vi.fn();
const mockDeleteConfigMutationOptions = vi.fn();
const mockTestConnectionMutationOptions = vi.fn();
const mockSendToKitchenOwlMutationOptions = vi.fn();

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    integrations: {
      getKitchenOwlConfig: {
        queryKey: () => mockConfigQueryKey,
        queryOptions: () => mockGetConfigQueryOptions(),
      },
      saveKitchenOwlConfig: {
        mutationOptions: () => mockSaveConfigMutationOptions(),
      },
      deleteKitchenOwlConfig: {
        mutationOptions: () => mockDeleteConfigMutationOptions(),
      },
      testKitchenOwlConnection: {
        mutationOptions: () => mockTestConnectionMutationOptions(),
      },
      sendToKitchenOwl: {
        mutationOptions: () => mockSendToKitchenOwlMutationOptions(),
      },
    },
  }),
}));

// Import after mocking
import {
  useKitchenOwlConfig,
  useKitchenOwlMutations,
  useSendToKitchenOwl,
} from "@/hooks/integrations/use-kitchenowl";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function createTestWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestWrapper";
  return Wrapper;
}

describe("useKitchenOwlConfig", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  it("returns isConfigured=false when no config exists", async () => {
    mockGetConfigQueryOptions.mockReturnValue({
      queryKey: mockConfigQueryKey,
      queryFn: async () => null,
    });

    const { result } = renderHook(() => useKitchenOwlConfig(), {
      wrapper: createTestWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isConfigured).toBe(false);
    expect(result.current.config).toBeNull();
  });

  it("returns isConfigured=true when config with serverUrl exists", async () => {
    const mockConfig = {
      serverUrl: "https://kitchen.example.com",
      apiTokenMasked: "abcd••••1234",
      defaultHouseholdId: 1,
      defaultShoppingListId: 1,
      enabled: true,
    };

    mockGetConfigQueryOptions.mockReturnValue({
      queryKey: mockConfigQueryKey,
      queryFn: async () => mockConfig,
    });

    const { result } = renderHook(() => useKitchenOwlConfig(), {
      wrapper: createTestWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isConfigured).toBe(true);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.config).toEqual(mockConfig);
  });

  it("returns isEnabled=false when config is disabled", async () => {
    const mockConfig = {
      serverUrl: "https://kitchen.example.com",
      apiTokenMasked: "abcd••••1234",
      defaultHouseholdId: 1,
      defaultShoppingListId: 1,
      enabled: false,
    };

    mockGetConfigQueryOptions.mockReturnValue({
      queryKey: mockConfigQueryKey,
      queryFn: async () => mockConfig,
    });

    const { result } = renderHook(() => useKitchenOwlConfig(), {
      wrapper: createTestWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isConfigured).toBe(true);
    expect(result.current.isEnabled).toBe(false);
  });

  it("provides invalidate function", async () => {
    mockGetConfigQueryOptions.mockReturnValue({
      queryKey: mockConfigQueryKey,
      queryFn: async () => null,
    });

    const { result } = renderHook(() => useKitchenOwlConfig(), {
      wrapper: createTestWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.invalidate).toBeDefined();
    expect(typeof result.current.invalidate).toBe("function");
  });
});

describe("useKitchenOwlMutations", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();

    // Setup default mock returns
    mockGetConfigQueryOptions.mockReturnValue({
      queryKey: mockConfigQueryKey,
      queryFn: async () => null,
    });
    mockSaveConfigMutationOptions.mockReturnValue({
      mutationFn: vi.fn().mockResolvedValue({ success: true }),
    });
    mockDeleteConfigMutationOptions.mockReturnValue({
      mutationFn: vi.fn().mockResolvedValue({ success: true }),
    });
    mockTestConnectionMutationOptions.mockReturnValue({
      mutationFn: vi.fn().mockResolvedValue({ success: true, households: [] }),
    });
  });

  it("returns saveConfig mutation", async () => {
    const { result } = renderHook(() => useKitchenOwlMutations(), {
      wrapper: createTestWrapper(queryClient),
    });

    expect(result.current.saveConfig).toBeDefined();
    expect(result.current.saveConfig.mutateAsync).toBeDefined();
  });

  it("returns deleteConfig mutation", async () => {
    const { result } = renderHook(() => useKitchenOwlMutations(), {
      wrapper: createTestWrapper(queryClient),
    });

    expect(result.current.deleteConfig).toBeDefined();
    expect(result.current.deleteConfig.mutateAsync).toBeDefined();
  });

  it("returns testConnection mutation", async () => {
    const { result } = renderHook(() => useKitchenOwlMutations(), {
      wrapper: createTestWrapper(queryClient),
    });

    expect(result.current.testConnection).toBeDefined();
    expect(result.current.testConnection.mutateAsync).toBeDefined();
  });
});

describe("useSendToKitchenOwl", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();

    mockSendToKitchenOwlMutationOptions.mockReturnValue({
      mutationFn: vi.fn().mockResolvedValue({
        successCount: 5,
        failCount: 0,
        totalItems: 5,
      }),
    });
  });

  it("returns sendIngredients function", async () => {
    const { result } = renderHook(() => useSendToKitchenOwl(), {
      wrapper: createTestWrapper(queryClient),
    });

    expect(result.current.sendIngredients).toBeDefined();
    expect(typeof result.current.sendIngredients).toBe("function");
  });

  it("returns loading state", async () => {
    const { result } = renderHook(() => useSendToKitchenOwl(), {
      wrapper: createTestWrapper(queryClient),
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("returns success state and reset function", async () => {
    const { result } = renderHook(() => useSendToKitchenOwl(), {
      wrapper: createTestWrapper(queryClient),
    });

    expect(result.current.isSuccess).toBe(false);
    expect(result.current.reset).toBeDefined();
    expect(typeof result.current.reset).toBe("function");
  });
});
