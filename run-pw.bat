@echo off
cd /d C:\it\it_frontend
npx playwright test --reporter=dot 1>C:\it\pw-out.txt 2>&1
echo EXIT_CODE=%ERRORLEVEL% >>C:\it\pw-out.txt
