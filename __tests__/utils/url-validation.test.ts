import { describe, it, expect } from "vitest";
import { isPrivateUrl, validatePublicUrl } from "@/lib/utils/url-validation";

describe("isPrivateUrl", () => {
  it("detects localhost", () => {
    expect(isPrivateUrl("http://localhost:8080")).toBe(true);
    expect(isPrivateUrl("http://localhost")).toBe(true);
    expect(isPrivateUrl("https://localhost/api")).toBe(true);
  });

  it("detects 127.x.x.x addresses", () => {
    expect(isPrivateUrl("http://127.0.0.1:3000")).toBe(true);
    expect(isPrivateUrl("http://127.255.255.255")).toBe(true);
  });

  it("detects 10.x.x.x private range", () => {
    expect(isPrivateUrl("http://10.0.0.1")).toBe(true);
    expect(isPrivateUrl("http://10.255.255.255")).toBe(true);
  });

  it("detects 172.16-31.x.x private range", () => {
    expect(isPrivateUrl("http://172.16.0.1")).toBe(true);
    expect(isPrivateUrl("http://172.31.255.255")).toBe(true);
    expect(isPrivateUrl("http://172.15.0.1")).toBe(false); // Not in range
    expect(isPrivateUrl("http://172.32.0.1")).toBe(false); // Not in range
  });

  it("detects 192.168.x.x private range", () => {
    expect(isPrivateUrl("http://192.168.0.1")).toBe(true);
    expect(isPrivateUrl("http://192.168.255.255")).toBe(true);
  });

  it("detects 169.254.x.x link-local range", () => {
    expect(isPrivateUrl("http://169.254.169.254")).toBe(true); // AWS metadata
    expect(isPrivateUrl("http://169.254.0.1")).toBe(true);
  });

  it("detects [::1] IPv6 localhost", () => {
    expect(isPrivateUrl("http://[::1]:8080")).toBe(true);
  });

  it("allows public URLs", () => {
    expect(isPrivateUrl("https://kitchenowl.example.com")).toBe(false);
    expect(isPrivateUrl("https://api.kitchenowl.org")).toBe(false);
    expect(isPrivateUrl("https://8.8.8.8")).toBe(false);
  });
});

describe("validatePublicUrl", () => {
  it("throws for private URLs", () => {
    expect(() => validatePublicUrl("http://localhost")).toThrow("private or internal");
    expect(() => validatePublicUrl("http://192.168.1.1")).toThrow("private or internal");
  });

  it("throws for invalid URLs", () => {
    expect(() => validatePublicUrl("not-a-url")).toThrow();
  });

  it("returns normalized URL for valid public URLs", () => {
    expect(validatePublicUrl("https://kitchenowl.example.com/")).toBe("https://kitchenowl.example.com");
  });
});
