@echo off
rem Double-click to open the VerifyPay site and start the CRE runner. Arguments are passed through (e.g. --recheck-now).
powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0start.ps1" %*
