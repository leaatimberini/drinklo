import XLSX from "xlsx";

export type ParsedFile = {
  headers: string[];
  rows: Record<string, any>[];
};

function normalizeHeader(value: string) {
  return value.trim();
}

export function parseFile(buffer: Buffer): ParsedFile {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [] };
  }
  const worksheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as Record<string, any>[];

  const headers = json.length > 0 ? Object.keys(json[0]).map(normalizeHeader) : [];
  const rows = json.map((row) => {
    const mapped: Record<string, any> = {};
    for (const key of Object.keys(row)) {
      mapped[normalizeHeader(key)] = row[key];
    }
    return mapped;
  });

  return { headers, rows };
}

export type ImportError = {
  row: number;
  field?: string;
  message: string;
};

export function toCsv<T extends Record<string, any>>(rows: T[], headers: string[]) {
  const escape = (value: any) => {
    const str = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}
