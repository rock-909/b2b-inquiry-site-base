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

Object.defineProperty(window, "open", { value: vi.fn(), configurable: true });

// Anchor click: dispatch click event without performing navigation
vi.spyOn(HTMLAnchorElement.prototype as any, "click").mockImplementation(
  function anchorClickMock(this: HTMLAnchorElement) {
    const evt = new MouseEvent("click", { bubbles: true, cancelable: true });
    this.dispatchEvent(evt);
  },
);
