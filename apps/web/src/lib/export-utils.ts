/** Utilidades compartilhadas pelos módulos de exportação (Resultados, Visão Geral). */

/** Carimbo de data local no formato YYYY-MM-DD, usado nos nomes de arquivo. */
export function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Escapa uma célula para CSV (separador `;`), protegendo aspas e quebras de linha. */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (/[";\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Dispara o download de um Blob com o nome de arquivo informado. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
