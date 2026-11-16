const DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']

/** A number in the school book's digits: 10 → «١٠». */
export function ar(value: number | string): string {
  return String(value).replace(/\d/g, (d) => DIGITS[Number(d)]!)
}
