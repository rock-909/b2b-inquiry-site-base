import { vi } from "vitest";

const __ioEmptyRect: DOMRectReadOnly = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
};

class MockIntersectionObserver {
  static _instances = new Set<MockIntersectionObserver>();
  static _observed = new Set<Element>();
  static _autoVisibleAll = true;

  private _cb: IntersectionObserverCallback | undefined;

  readonly observe = vi.fn((el: Element) => {
    MockIntersectionObserver._observed.add(el);
    if (MockIntersectionObserver._autoVisibleAll && this._cb) {
      this._cb(
        [
          {
            isIntersecting: true,
            target: el as Element,
            intersectionRatio: 1,
            boundingClientRect: __ioEmptyRect,
            rootBounds: null,
            time: Date.now(),
          } as unknown as IntersectionObserverEntry,
        ],
        this as unknown as IntersectionObserver,
      );
    }
  });

  readonly unobserve = vi.fn((el: Element) => {
    MockIntersectionObserver._observed.delete(el);
  });

  readonly disconnect = vi.fn(() => {
    // keep observed registry global so other instances can still trigger
  });

  readonly takeRecords = vi.fn(() => [] as IntersectionObserverEntry[]);

  constructor(
    callback?: IntersectionObserverCallback,
    _options?: IntersectionObserverInit,
  ) {
    this._cb = callback;
    MockIntersectionObserver._instances.add(this);
  }
}

globalThis.IntersectionObserver =
  MockIntersectionObserver as unknown as typeof IntersectionObserver;

export function triggerVisible(el: Element) {
  for (const inst of MockIntersectionObserver._instances) {
    (inst as any)._cb?.(
      [
        {
          isIntersecting: true,
          target: el,
          intersectionRatio: 1,
          boundingClientRect: __ioEmptyRect,
          rootBounds: null,
          time: Date.now(),
        } as unknown as IntersectionObserverEntry,
      ],
      inst as unknown as IntersectionObserver,
    );
  }
}

export function triggerAll() {
  for (const el of Array.from(MockIntersectionObserver._observed)) {
    triggerVisible(el);
  }
}

export function setIntersectionAutoVisibleAll(v: boolean) {
  MockIntersectionObserver._autoVisibleAll = v;
}
