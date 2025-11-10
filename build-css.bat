@echo off
echo Building Tailwind CSS...
echo.
echo Option 1: Download Tailwind CLI standalone from:
echo https://github.com/tailwindlabs/tailwindcss/releases/latest
echo Download tailwindcss-windows-x64.exe (or tailwindcss-windows-arm64.exe for ARM)
echo Rename it to tailwindcss.exe and place it in this directory
echo.
echo Option 2: Install Node.js from https://nodejs.org/ and run: npm run build-css
echo.
echo After obtaining the CLI, run:
echo tailwindcss -i ./src/input.css -o ./dist/output.css --minify
echo.
pause
