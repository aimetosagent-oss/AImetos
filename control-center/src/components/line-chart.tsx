import type { LeadTrendPoint } from "@/lib/types";

export function LineChart({ points }: { points: LeadTrendPoint[] }) {
  const width = 700;
  const height = 210;
  const pad = 24;
  const max = Math.max(...points.map((point) => point.value), 1);
  const coords = points.map((point, index) => ({
    ...point,
    x: pad + (index * (width - pad * 2)) / Math.max(points.length - 1, 1),
    y: height - pad - (point.value / max) * (height - pad * 2),
  }));
  const path = coords.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const area = `${path} L${coords.at(-1)?.x || pad},${height - pad} L${coords[0]?.x || pad},${height - pad} Z`;
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolució de leads dels últims set dies">
        <defs><linearGradient id="leadArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#12b8e8" stopOpacity=".34" /><stop offset="100%" stopColor="#12b8e8" stopOpacity="0" /></linearGradient></defs>
        {[0.25, 0.5, 0.75, 1].map((line) => <line key={line} x1={pad} x2={width - pad} y1={height - pad - line * (height - pad * 2)} y2={height - pad - line * (height - pad * 2)} className="chart-grid" />)}
        <path d={area} fill="url(#leadArea)" />
        <path d={path} className="chart-line" />
        {coords.map((point) => <g key={point.label}><circle cx={point.x} cy={point.y} r="4" className="chart-dot" /><text x={point.x} y={height - 4} textAnchor="middle" className="chart-label">{point.label}</text></g>)}
      </svg>
    </div>
  );
}
