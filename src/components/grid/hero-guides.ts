interface GuideConfig {
  column: number;
  row: number;
  borderRight: boolean;
  borderBottom: boolean;
}

/**
 * Generate hero-style guide configs with fade-out effect.
 * Row 1 has full borders, progressively fewer as rows increase.
 */
export function heroGuides(cols: number, rows: number): GuideConfig[] {
  const guides: GuideConfig[] = [];
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= cols; col++) {
      const fadeThreshold = Math.max(1, rows - row);
      const showRight = col < cols && row <= fadeThreshold;
      const showBottom = row <= fadeThreshold + 1;
      if (showRight || showBottom) {
        guides.push({
          column: col,
          row,
          borderRight: showRight,
          borderBottom: showBottom,
        });
      }
    }
  }
  return guides;
}

export type { GuideConfig };
