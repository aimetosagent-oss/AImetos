export function documentPdfFilename(number: string) {
  const safeNumber = number.trim().replace(/[^A-Za-z0-9_-]/g, "-");
  return `${safeNumber || "document"}.pdf`;
}
