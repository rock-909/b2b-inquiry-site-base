export function HeroGuideOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-1/2 z-0 hidden w-[calc(100%-48px)] max-w-[1080px] -translate-x-1/2 lg:block"
      style={{
        backgroundImage:
          "linear-gradient(to right, transparent calc(100% - 1px), var(--grid-guide) calc(100% - 1px)), linear-gradient(to bottom, transparent calc(100% - 1px), var(--grid-guide) calc(100% - 1px))",
        backgroundSize: "8.333333% 12.5%",
        maskImage:
          "linear-gradient(to bottom, var(--foreground) 0%, var(--foreground) 25%, transparent 62.5%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, var(--foreground) 0%, var(--foreground) 25%, transparent 62.5%)",
      }}
      aria-hidden="true"
    />
  );
}
