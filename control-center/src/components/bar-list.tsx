export function BarList({ rows, valueSuffix = "" }: { rows: Array<{ label: string; value: number }>; valueSuffix?: string }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return <div className="bar-list">{rows.map((row) => <div className="bar-row" key={row.label}><div className="bar-meta"><span>{row.label}</span><strong>{new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 1 }).format(row.value)}{valueSuffix}</strong></div><div className="bar-track"><span style={{ width: `${Math.max((row.value / max) * 100, 2)}%` }} /></div></div>)}</div>;
}
