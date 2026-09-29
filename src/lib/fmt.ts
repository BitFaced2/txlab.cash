/** Formatting helpers with no dependencies, safe for the main client bundle. */
export const fmtSats = (n: bigint | number | string) => Number(n).toLocaleString("en-US");
export const short = (hex: string, n = 8) => (hex.length > n * 2 + 1 ? `${hex.slice(0, n)}…${hex.slice(-n)}` : hex);
export const shortAddr = (a: string) => {
  const body = a.replace(/^(bitcoincash|bchtest|bchreg):/, "");
  return body.length > 16 ? `${body.slice(0, 8)}…${body.slice(-6)}` : body;
};
export const words = (n: number) => ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] ?? String(n);
