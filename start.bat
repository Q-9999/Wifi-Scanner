@echo off
chcp 65001 >nul
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
    echo   [Loi] Khong the khoi chay chuong trinh. Vui long kiem tra Python.
    pause
)
