# Troubleshooting

- No ideas selected: lower thresholds only after reviewing quality, or use normal/high_performance scenario.
- Connector missing credentials: keep it disabled or fill required env vars and run health checks.
- Dashboard empty: call `/api/run-mock-flow` and inspect `data/exports/latest-report.json`.
