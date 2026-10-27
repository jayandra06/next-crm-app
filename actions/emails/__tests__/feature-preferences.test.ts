jest.mock("@/lib/auth-server", () => ({ getSession: jest.fn() }));
jest.mock("next/headers", () => ({
  cookies: jest.fn().mockResolvedValue({
    get: jest.fn(),
    set: jest.fn(),
  }),
}));
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
  unstable_cache: jest.fn((fn) => fn),
}));

import {
  SUPPORTED_FEATURES,
  type FeatureKey,
} from "@/lib/email/feature-preferences";

describe("feature email preferences", () => {
  it("includes all required CRM features", () => {
    const keys = SUPPORTED_FEATURES.map((f) => f.key);
    expect(keys).toContain("emails");
    expect(keys).toContain("leads");
    expect(keys).toContain("contacts");
    expect(keys).toContain("sales");
    expect(keys).toContain("contracts");
    expect(keys).toContain("marketing");
    expect(keys).toContain("canva");
    expect(keys).toContain("linkedin");
    expect(keys.length).toBe(8);
  });

  it("has valid default paths and descriptions for each feature", () => {
    SUPPORTED_FEATURES.forEach((feature) => {
      expect(feature.defaultPath).toBeTruthy();
      expect(feature.label).toBeTruthy();
      expect(feature.description).toBeTruthy();
    });
  });
});
