@echo off
chcp 65001 >nul
title MMQ./NetScanner - Wi-Fi Scanner, Channel Analyzer ^& Floorplan Planner
cls
echo ----------------------------------------------------------------------
echo   MMQ./NetScanner - CONG CU QUET SONG, DO KIEM VA QUY HOACH WI-FI
echo   Wi-Fi Network Scanner, Channel Analyzer ^& Floorplan Coverage Tool
echo ----------------------------------------------------------------------
echo   Chuc nang chinh / Core Functions:
echo   1. Quet danh sach tram phat Wi-Fi (SSID, BSSID, cuong do dBm, SNR, MCS)
echo   2. Phan tich do nhieu kenh 2.4 GHz / 5 GHz va goi y kenh song sach
echo   3. Do do tre mang (Ping, Jitter, Packet Loss) va chat luong goi VoWiFi
echo   4. Phac thao mat bang 2D/2.5D, vat can va mo phong vung phu song Router
echo   5. Xuat bao cao khao sat ra file bang tinh CSV (Excel) va JSON
echo ----------------------------------------------------------------------
python run.py
pause
