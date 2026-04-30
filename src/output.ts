const isColor = process.stdout.isTTY !== false;

const c = (code: string, text: string) => (isColor ? `\x1b[${code}m${text}\x1b[0m` : text);

export const fmt = {
  bold: (s: string) => c("1", s),
  dim: (s: string) => c("2", s),
  red: (s: string) => c("31", s),
  green: (s: string) => c("32", s),
  yellow: (s: string) => c("33", s),
  blue: (s: string) => c("34", s),
};

export const ok = (msg: string) => console.log(`${fmt.green("✓")} ${msg}`);
export const warn = (msg: string) => console.log(`${fmt.yellow("!")} ${msg}`);
export const info = (msg: string) => console.log(`${fmt.blue("›")} ${msg}`);
export const err = (msg: string) => console.error(`${fmt.red("✗")} ${msg}`);
