@echo off
setlocal
cd /d "%~dp0"
echo Starting AImetos client dashboard...
echo URL: http://127.0.0.1:4317
echo Keep this window open while testing.
echo.
"C:\Users\roger\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" apps/api/src/server.ts
echo.
echo Server stopped. If this was unexpected, copy the message above.
pause
