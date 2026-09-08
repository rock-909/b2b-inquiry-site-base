import { vi } from "vitest";

// Mock Next.js navigation (App Router)
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => "/"),
  useParams: vi.fn(() => ({})),
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
  notFound: vi.fn(),
}));

// Mock Next.js 16 Cache Components API
// - cacheLife() and cacheTag() are no-ops in test environment
// - unstable_cache passes through the function for testing
// - revalidatePath and revalidateTag are no-ops in tests
vi.mock("next/cache", () => ({
  cacheLife: vi.fn(() => undefined),
  cacheTag: vi.fn(() => undefined),
  unstable_cache: vi.fn((fn) => fn),
  revalidatePath: vi.fn(() => undefined),
  revalidateTag: vi.fn(() => undefined),
  unstable_expireTag: vi.fn(() => undefined),
  unstable_expirePath: vi.fn(() => undefined),
}));

Object.defineProperty(window, "open", { value: vi.fn(), configurable: true });

// Anchor click: dispatch click event without performing navigation
vi.spyOn(HTMLAnchorElement.prototype as any, "click").mockImplementation(
  function anchorClickMock(this: HTMLAnchorElement) {
    const evt = new MouseEvent("click", { bubbles: true, cancelable: true });
    this.dispatchEvent(evt);
  },
);
