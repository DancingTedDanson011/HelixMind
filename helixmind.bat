@echo off
echo HelixMind CLI - Windows Launcher
echo.
echo If you have issues, try:
echo   1. node dist/cli/index.js %*
echo   2. npx tsx src/cli/index.ts %*
echo.

REM Try to run the built version
if exist "dist/cli/index.js" (
  echo Running built version...
  node "dist/cli/index.js" %*
  goto :eof
)

REM Try to run via tsx
echo Built version not found, running via tsx...
npx tsx src/cli/index.ts %*
