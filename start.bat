@echo off
chcp 65001 >nul
cd /d "%~dp0"
title MMQ./WifiScanner
cls
echo ======================================================================
echo   MMQ./WifiScanner - He thong Khao sat va Mo phong Song Wi-Fi
echo ======================================================================
echo.
echo   Dang khoi dong may chu va mo trinh duyet...
echo.
python run.py
if errorlevel 1 (
    echo.
    echo   [Loi] Khong the khoi chay chuong trinh ^(Ma loi: %errorlevel%^).
    echo   Vui long kiem tra da cai dat Python 3.10+ va chay:
    echo       python -m pip install -r requirements.txt
    echo.
    pause
)
