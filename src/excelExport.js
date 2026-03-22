// ─── Excel Export Utility (generates .xls via HTML table) ───
// Excel opens HTML tables natively with styling support.

export function downloadExcel(columns, rows, filename = "export") {
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };

  let html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Sheet1</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  td, th { mso-number-format:"\\@"; font-family: Calibri; font-size: 11pt; }
  th { background: #034C9D; color: #fff; font-weight: bold; padding: 6px 10px; }
  td { padding: 4px 10px; border-bottom: 1px solid #e5e7eb; }
  .num { mso-number-format:"#\\,##0\\.00"; text-align: right; }
  .int { mso-number-format:"#\\,##0"; text-align: right; }
  .pct { mso-number-format:"0\\.00\\%"; text-align: right; }
</style>
</head><body><table>`;

  // Header row
  html += "<thead><tr>";
  columns.forEach((col) => {
    html += `<th>${esc(col.label)}</th>`;
  });
  html += "</tr></thead><tbody>";

  // Data rows
  rows.forEach((row) => {
    html += "<tr>";
    columns.forEach((col) => {
      const val = row[col.key];
      const cls = col.type === "number" ? "num" : col.type === "int" ? "int" : col.type === "pct" ? "pct" : "";
      html += `<td class="${cls}">${esc(val)}</td>`;
    });
    html += "</tr>";
  });

  html += "</tbody></table></body></html>";

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
