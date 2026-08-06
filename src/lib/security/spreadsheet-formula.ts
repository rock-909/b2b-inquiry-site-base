const SPREADSHEET_FORMULA_PREFIX_PATTERN = /^[=+\-@]/;

export function hasSpreadsheetFormulaPrefix(value: string): boolean {
  return SPREADSHEET_FORMULA_PREFIX_PATTERN.test(value);
}
