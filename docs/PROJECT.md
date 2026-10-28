# Project: tool-NWC203 — MMQ./WifiScanner Upgrade

## Architecture
tool-NWC203 là ứng dụng phân tích môi trường Wi-Fi chuyên sâu chạy trên nền tảng Python (FastAPI/Uvicorn) và giao diện web hiện đại (HTML5/CSS3/JavaScript Canvas).
Hệ thống kết nối trực tiếp với card mạng Wi-Fi thông qua Windows Native WLAN API (`wlanapi.dll` ctypes) và tiện ích hệ thống `netsh wlan`.

```
[Trình duyệt Web (Light Mode chuẩn UI/UX, 100% tiếng Việt không icon)]
   │
   ├── REST APIs & Server-Sent Events (SSE) & WebSockets
   ▼
[FastAPI Server (server.py)]
   ├── Quét sóng & Thu thập phần cứng (wifi_scanner.py)
   ├── Phân tích phổ & Chẩn đoán Oscium (channel_analyzer.py)
   ├── Đo kiểm tốc độ mạng Speed Test (speedtest_runner.py)
   ├── Tính toán Bản đồ nhiệt & Lập kế hoạch AP (ai_planner.py)
   ├── Phân tích VoWiFi & Đường truyền đa chặng (vowifi_analyzer.py)
   └── Xuất báo cáo kỹ thuật (report_generator.py)
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1: Bản địa hóa 100% Tiếng Việt | Chuyển toàn bộ giao diện, thông báo, nhãn, modal, bảng dữ liệu sang tiếng Việt chuẩn, không còn chuỗi tiếng Anh | M_B | ORIGINAL_REQUEST §R1 |
| 2 | R1: Phong cách ngôn ngữ không icon | Loại bỏ 100% emoji (33 emoji trong HTML, 39 emoji trong JS) và icon (58 Lucide icons, gỡ bỏ `lucide.min.js`), thay bằng nhãn chữ tối giản | M_B | ORIGINAL_REQUEST §R1 |
| 3 | R2: Loại bỏ Dark Mode | Xóa bỏ toàn bộ cấu hình Dark mode trong CSS (:root dark base, [data-theme="light"] override), gỡ nút theme toggle | M_B | ORIGINAL_REQUEST §R2 |
| 4 | R2: Giao diện nền sáng (Light Mode) chuẩn UI/UX | Chuyển toàn bộ giao diện sang nền xám sáng (#f8fafc), thẻ trắng (#ffffff), viền mảnh (#e2e8f0), chữ sắc nét (#0f172a), tối ưu bố cục | M_B | ORIGINAL_REQUEST §R2 |
| 5 | R3: Làm mượt đồ họa Bản đồ nhiệt Wi-Fi | Nâng cấp `drawFloorplanHeatmap` sang thuật toán làm mượt nội suy thay thế cho các ô vuông gắt `fillRect`, dải màu 5 bậc liên tục | M_B | ORIGINAL_REQUEST §R3 |
| 6 | R3: Bảng thuộc tính Điểm truy cập (AP Inspector) | Cho phép tùy chỉnh tên AP, kênh phát, công suất phát (Tx power) và độ lợi anten độc lập từng điểm | M_B | ORIGINAL_REQUEST §R3 |
| 7 | R3: Hiệu chuẩn khoảng cách thực tế | Công cụ thước đo hiệu chuẩn tỷ lệ pixel sang mét dựa trên 2 điểm mốc trên bản vẽ | M_B | ORIGINAL_REQUEST §R3 |
| 8 | R3: Nạp ảnh mặt bằng kiến trúc | Tải ảnh mặt bằng (PNG/JPG) làm nền đáy với thanh trượt chỉnh độ mờ linh hoạt | M_B | ORIGINAL_REQUEST §R3 |
| 9 | R4: Tích hợp thông số Card mạng vào Oscium | Nạp `connected_interface` vào bộ chẩn đoán sự cố Oscium, bổ sung `adapter_diagnostics` và `automated_root_cause` | M_A | ORIGINAL_REQUEST §R4 |
| 10 | R4: Bảng điều khiển Chẩn đoán Sự cố Oscium tập trung | Giao diện 6 khối thẻ trực quan: Điểm sức khỏe, Card mạng, Sơ đồ đa chặng, Bảng kiểm 6 tiêu chuẩn, Chữ ký nhiễu phi Wi-Fi, Hướng dẫn khắc phục | M_B | ORIGINAL_REQUEST §R4 |
| 11 | R5: Module đo tốc độ Speed Test Backend | Phát triển `speedtest_runner.py` đo Download, Upload, Ping/Latency qua Cloudflare Speed CDN bằng `httpx` (hỗ trợ User-Agent và fast/mock mode) | M_A | ORIGINAL_REQUEST §R5 |
| 12 | R5: Giao diện Đo tốc độ Wi-Fi trực tiếp | Tab mới "Đo tốc độ mạng" với đồng hồ tốc độ, đồ thị tiến trình, đối sánh tốc độ internet với tốc độ liên kết Wi-Fi vật lý | M_B | ORIGINAL_REQUEST §R5 |
| 13 | R1: Làm sạch chuỗi backend song ngữ | Chuyển đổi toàn bộ chuỗi song ngữ trong `server.py`, `report_generator.py`, `vowifi_analyzer.py`, `channel_analyzer.py`, `ai_planner.py` sang tiếng Việt | M_A | ORIGINAL_REQUEST §R1 |
| 14 | R6: Mở rộng bộ kiểm thử tự động | Mở rộng `test_full_suite.py` bổ sung kiểm thử Speed Test, kiểm tra không icon/emoji, kiểm tra CSS Light mode, kiểm tra tài liệu | M_C | ORIGINAL_REQUEST §R6 |
| 15 | R6: Cập nhật tài liệu dự án | Cập nhật đồng bộ `PROJECT_OVERVIEW.md` và `README.md`: loại bỏ emoji/Dark mode, cập nhật tính năng Speed Test, Heatmap, Oscium | M_C | ORIGINAL_REQUEST §R6 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M_A | Backend Core Services & APIs | `speedtest_runner.py`, `server.py`, `channel_analyzer.py`, `vowifi_analyzer.py`, `report_generator.py` | none | DONE |
| M_B | Frontend UI/UX, Heatmap & Speed Test Interface | `static/index.html`, `static/styles.css`, `static/app.js` | M_A | DONE |
| M_C | Final E2E Suite Pass, Verification & Documentation | `test_full_suite.py`, `PROJECT_OVERVIEW.md`, `README.md` | M_A, M_B | DONE |

## Interface Contracts

### Backend ↔ Speed Test UI (`speedtest_runner.py` & `server.py`)
- `POST /api/speedtest/start`:
  - Request: `{ "mode": "quick" | "full" }` (optional)
  - Response: `{ "status": "running", "test_id": "<uuid>" }`
- `GET /api/speedtest/status`:
  - Response:
    ```json
    {
      "status": "idle" | "running" | "completed" | "error",
      "stage": "idle" | "ping" | "download" | "upload" | "finished",
      "progress_pct": 0-100,
      "ping_ms": float,
      "jitter_ms": float,
      "download_mbps": float,
      "upload_mbps": float,
      "link_speed_mbps": float,
      "server_location": string,
      "error_message": string | null
    }
    ```
- `GET /api/speedtest/stream`: Server-Sent Events phát sinh trạng thái thời gian thực.

### Backend ↔ Oscium Troubleshooting (`channel_analyzer.py` & `server.py`)
- `GET /api/troubleshooting/all-in-one`:
  - Trả về đối tượng JSON mở rộng gồm:
    ```json
    {
      "global_score": int,
      "avg_snr_db": float,
      "connected_interface": {
        "interface": string,
        "ssid": string,
        "bssid": string,
        "signal_pct": int,
        "rssi_dbm": int,
        "channel": int,
        "band": string,
        "rx_rate_mbps": float,
        "tx_rate_mbps": float
      },
      "troubleshooting_suite": {
        "health_score": int,
        "spectrum_classifiers": [...],
        "checklist": [...],
        "non_wifi_interferers": [...],
        "adapter_diagnostics": {
          "status": string,
          "rx_tx_symmetry": string,
          "signal_adequacy": string,
          "recommendations": [...]
        },
        "automated_root_cause": {
          "primary_issue_vi": string,
          "severity": "info" | "warning" | "critical",
          "action_steps_vi": [...]
        }
      },
      "airtime_breakdown": {...},
      "roaming_audit": {...},
      "path_quality": {...}
    }
    ```

### Heatmap Data Contract (`ai_planner.py` & `static/app.js`)
- `POST /api/ai-planner/calculate-heatmap`:
  - Request: `{ "width_m": float, "height_m": float, "aps": [...], "walls": [...] }`
  - Response giữ nguyên các ma trận 2D: `grid`, `primary_rssi_grid`, `secondary_rssi_grid`, `snr_grid`, `interference_grid`, `throughput_grid`.

## Code Layout
- `speedtest_runner.py`: Bộ thực thi kiểm tra tốc độ Download/Upload/Ping qua Cloudflare Speed CDN.
- `server.py`: FastAPI server định tuyến REST, SSE, Static files.
- `channel_analyzer.py`: Phân tích kênh tần số, suy luận nhiễu và bộ kiểm tra Oscium.
- `wifi_scanner.py`: Quét card mạng Wi-Fi và phân giải OUI vendor.
- `ai_planner.py`: Tính toán bản đồ nhiệt và vị trí tối ưu điểm truy cập.
- `vowifi_analyzer.py`: Đo kiểm MOS chất lượng thoại và tuyến mạng đa chặng.
- `report_generator.py`: Xuất tài liệu báo cáo kỹ thuật CSV/PDF.
- `static/index.html`: Giao diện ứng dụng chính (100% tiếng Việt, Light mode).
- `static/styles.css`: Hệ thống định kiểu Light mode chuẩn UI/UX Pro Max.
- `static/app.js`: Xử lý tương tác, biểu đồ Canvas, điều khiển Speed Test và Bản đồ nhiệt.
- `test_full_suite.py`: Bộ kiểm thử tự động toàn diện.
- `PROJECT_OVERVIEW.md` & `README.md`: Tài liệu hướng dẫn và đặc tả dự án.
