# MMQ./WifiScanner (tool-NWC203)

Phần mềm khảo sát mạng không dây (WLAN) và chẩn đoán kết nối mạng chạy cục bộ trên hệ điều hành Windows. Chương trình thu thập thông số lớp vật lý (PHY) và lớp liên kết dữ liệu (MAC) từ card mạng Wi-Fi qua giao diện `wlanapi.dll` và lệnh `netsh wlan`, kết hợp đo kiểm lớp mạng/vận chuyển, sau đó hiển thị dữ liệu trên giao diện web nền sáng (Light Mode) chạy bằng FastAPI và Uvicorn.

---

## 1. Cấu trúc thư mục phân cấp

```text
tool-NWC203/
├── api/
│   ├── __init__.py                  # Khởi tạo gói FastAPI app
│   └── server.py                    # Máy chủ FastAPI phục vụ REST API, SSE và WebSocket
├── core/
│   ├── __init__.py                  # Khởi tạo các mô-đun xử lý lõi
│   ├── wifi_scanner.py              # Thu thập BSSID qua wlanapi.dll/netsh, tra cứu IEEE OUI, nhóm phần cứng
│   ├── channel_analyzer.py          # Chấm điểm kênh 2.4/5/6 GHz, phân tích CCI/ACI và chẩn đoán Oscium
│   ├── vowifi_analyzer.py           # Đo RTT, Jitter, Packet Loss đa chặng và tính điểm MOS (ITU-T G.107)
│   ├── ai_planner.py                # Mô phỏng suy hao sóng Log-Distance/WAF và tính lưới Ekahau 5 lớp
│   ├── speedtest_runner.py          # Đo Ping, Jitter, Download/Upload qua Cloudflare Speed CDN
│   └── report_generator.py          # Xuất báo cáo kỹ thuật định dạng CSV (UTF-8-SIG) và JSON
├── static/
│   ├── index.html                   # Giao diện trang đơn 8 thẻ chức năng (tiếng Việt, không dùng icon)
│   ├── styles.css                   # Bảng định kiểu Light Mode nền sáng
│   ├── app.js                       # Điều khiển giao diện, đồ thị phổ Canvas, Speed Test và Ekahau Planner
│   ├── heatmap.js                   # Động cơ dò tia 180 hướng (Raytracing) trên mặt bằng 2D
│   └── lucide.min.js                # Tệp giữ chỗ (đã loại bỏ bộ icon Lucide khỏi giao diện)
├── docs/
│   ├── PROJECT.md                   # Đặc tả yêu cầu tính năng và các mốc hoàn thiện dự án
│   └── TEST_INFRA.md                # Tài liệu cấu trúc kiểm thử tự động
├── tests/
│   ├── __init__.py                  # Khởi tạo gói kiểm thử
│   ├── test_full_suite.py           # Bộ kiểm thử 9 phần chức năng từ lõi đến giao diện
│   ├── test_challenger_mb_static.py # Kiểm thử tĩnh HTML/CSS/JS (0 emoji, 0 icon, Light Mode)
│   ├── test_challenger_mb_dynamic.py# Kiểm thử luồng SSE Speed Test, Oscium schema và nội suy Heatmap
│   ├── test_repo_integrity_mc.py    # Kiểm tra đồng bộ tài liệu, mã nguồn và chạy chéo các bộ test
│   ├── test_challenger_ma.py        # Kiểm thử mô-đun backend độc lập
│   ├── test_adversarial_m_a.py      # Kiểm thử dữ liệu biên và ngoại lệ backend
│   └── test_stress_e2e_mc.py        # Kiểm thử tải lặp lại và tính ổn định luồng dữ liệu
├── reports/
│   └── .gitkeep                     # Giữ cấu trúc thư mục lưu trữ các tệp CSV/JSON đã xuất
├── .gitignore                       # Quy tắc loại trừ bộ nhớ đệm và tệp báo cáo sinh tự động
├── LICENSE                          # Giấy phép MIT
├── PROJECT_OVERVIEW.md              # Tài liệu kiến trúc kỹ thuật và đặc tả API nội bộ
├── README.md                        # Tài liệu tổng quan và hướng dẫn vận hành dự án
├── requirements.txt                 # Danh sách thư viện Python phụ thuộc
├── run.py                           # Điểm khởi chạy máy chủ kèm tự kiểm tra gói và mở trình duyệt
└── start.bat                        # Tệp lệnh khởi chạy nhanh trên Windows
```

---

## 2. Kiến trúc kỹ thuật và luồng dữ liệu

Hệ thống tách biệt tầng thu thập/tính toán bằng Python khỏi tầng hiển thị trên trình duyệt:

1. **Tầng thu thập lớp vật lý và liên kết (`core/wifi_scanner.py`)**:
   - Gọi hàm trong thư viện hệ thống `wlanapi.dll` của Windows thông qua `ctypes` (`WlanOpenHandle`, `WlanEnumInterfaces`, `WlanScan`, `WlanGetNetworkBssList`) để yêu cầu trình điều khiển card mạng quét lại phổ tần thực tế.
   - Đọc thêm dữ liệu xác thực, mã hóa, kiểu radio và trạng thái kết nối từ lệnh `netsh wlan show networks mode=bssid` và `netsh wlan show interfaces`.
   - Tính mức nền nhiễu (`Noise Floor`) theo băng tần (`-94 dBm` cơ sở ở `2.4 GHz`, `-96 dBm` cơ sở ở `5/6 GHz` cộng hệ số mật độ đồng kênh), tính tỷ số tín hiệu trên nhiễu (`SNR`), ánh xạ chỉ số điều chế và mã hóa (`MCS`), dạng điều chế (`QAM`), độ rộng kênh và tốc độ thông lượng ước tính.
2. **Tầng máy chủ ứng dụng (`api/server.py`)**:
   - Khởi chạy bằng `FastAPI` trên nền `Uvicorn` (`127.0.0.1:8000` mặc định, tự động tăng cổng nếu cổng 8000 đang bận khi chạy qua `run.py`).
   - Duy trì một luồng chạy nền (`background_scanner_worker`) cập nhật bảng quét và chuỗi lịch sử cường độ tín hiệu (`signal_history`) tối đa 20 mẫu cho mỗi `BSSID`.
   - Phát dữ liệu xuống trình duyệt qua `REST API`, `WebSocket` (`/ws/live`) và `Server-Sent Events` (`/api/stream/live`, `/api/speedtest/stream`).
3. **Tầng giao diện trình duyệt (`static/`)**:
   - Viết bằng `HTML5`, `CSS3` (nền sáng cố định Light Mode với các biến `:root` như `--bg-main: #f8fafc`, `--bg-card: #ffffff`, `--text-primary: #0f172a`) và JavaScript thuần (`app.js`, `heatmap.js`).
   - Toàn bộ đồ thị phổ công suất `OFDM`, biểu đồ lịch sử `RSSI`, đồ thị thác nước (`Spectrogram`) và bản đồ nhiệt mặt bằng được vẽ trực tiếp trên `HTML5 Canvas`.

---

## 3. Yêu cầu hệ thống và cài đặt

### Yêu cầu môi trường
- Hệ điều hành: Windows 10 hoặc Windows 11 (phục vụ gọi `wlanapi.dll` và `netsh wlan`).
- Python: phiên bản 3.10 trở lên.
- Phần cứng: card mạng Wi-Fi đang bật (Location Services cần được cấp quyền trên Windows để hệ điều hành trả về danh sách `BSSID`).

### Cài đặt thư viện phụ thuộc
```bash
pip install -r requirements.txt
```
Các thư viện khai báo trong `requirements.txt`: `fastapi>=0.100.0`, `uvicorn>=0.23.0`, `httpx>=0.24.0`, `pydantic>=2.0.0`.

### Khởi chạy ứng dụng
- Cách 1: Chạy tệp `start.bat` (trên Windows).
- Cách 2: Chạy bằng dòng lệnh Python:
  ```bash
  python run.py
  ```
Khi chạy `run.py`, chương trình sẽ kiểm tra các gói phụ thuộc, tìm cổng trống bắt đầu từ `8000`, khởi động máy chủ và mở trình duyệt tại `http://localhost:8000`.

---

## 4. Đặc tả 8 phân hệ chức năng

Giao diện web tổ chức 8 thẻ chức năng tương ứng với từng bước khảo sát và chẩn đoán mạng:

### 4.1. Khảo sát sóng (Survey - `tab-survey`)
- Hiển thị bảng danh sách các trạm phát sóng (`BSSID`) quét được cùng thông tin card mạng đang kết nối.
- Trích xuất và hiển thị: tên mạng (`SSID`), địa chỉ MAC (`BSSID`), hãng sản xuất phần cứng tra từ bảng `IEEE OUI` (có xử lý bit địa chỉ quản trị cục bộ `LAA`), cường độ tín hiệu thu `RSSI` (`dBm` và `%`), mức nền nhiễu `Noise Floor`, tỷ số `SNR` (`dB`), băng tần (`2.4 GHz`, `5 GHz`, `6 GHz`), kênh phát, độ rộng kênh (`20/40/80/160 MHz`), cảnh báo kênh radar `DFS`, thế hệ `802.11` (`Wi-Fi 4` đến `Wi-Fi 7`), chỉ số `MCS`, chuẩn bảo mật và tải kênh (`BSS Load`).
- Nhóm phần cứng vật lý: gom các `BSSID` có cùng tiền tố 5 octet địa chỉ MAC vào cùng một nhóm thiết bị phát, đồng thời gán nhãn tên mạng dự đoán cho `BSSID` ẩn nếu có `BSSID` công khai nằm chung nhóm phần cứng đó.
- Công cụ dò tìm vị trí trạm phát (`Device Finder`): theo dõi biến thiên `RSSI` của một `BSSID` chỉ định để ước lượng khoảng cách và tỷ lệ tiếp cận.

### 4.2. Phổ tần vô tuyến (Spectrum - `tab-spectrum`)
- Vẽ mặt nạ phổ công suất `OFDM` của từng trạm phát theo tần số trung tâm và độ rộng kênh trên băng tần `2.4 GHz` (kênh 1-14) và `5 GHz`.
- Vẽ đồ thị lịch sử cường độ tín hiệu (`RSSI History`) theo thời gian thực và đồ thị thác nước (`Spectrogram`) biểu diễn mật độ tín hiệu theo trục thời gian để nhận diện trạm phát sóng gián đoạn hoặc chồng lấn.
- Phát hiện can nhiễu kênh kề (`ACI`) trên `2.4 GHz`, cảnh báo cấu hình kênh rộng `40 MHz` ở dải `2.4 GHz` và nhận diện các trạm hoạt động trong dải `DFS` (`UNII-2A`, `UNII-2C`).

### 4.3. Tối ưu hóa và chẩn đoán Oscium (Optimizer - `tab-optimizer`)
- Chấm điểm kênh phát từ `1` đến `100` trên cả 3 băng tần (`2.4 GHz` ưu tiên kênh `1, 6, 11`; `5 GHz` đánh giá từng kênh và khối `80 MHz`; `6 GHz` đánh giá kênh quét ưu tiên `PSC` và khối `160 MHz` trên `UNII-5`) dựa trên công suất tuyến tính từ `RSSI` các trạm trùng kênh (`CCI`) và lân cận (`ACI`).
- Cung cấp bảng điều khiển chẩn đoán `Oscium` gồm 6 phần dữ liệu trả về từ `/api/troubleshooting/all-in-one`:
  1. Điểm đánh giá chất lượng môi trường (`health_score`, thang điểm `0-100`).
  2. Thống kê thông số card mạng đang kết nối (`adapter_diagnostics`: tốc độ Rx/Tx, mức đối xứng thu phát, đánh giá độ mạnh tín hiệu).
  3. Đo độ trễ phân tách 3 chặng (`path_quality`: bộ định tuyến nội bộ, máy chủ internet, máy chủ phân giải `DNS`).
  4. Bảng kiểm 6 tiêu chuẩn kỹ thuật (`checklist`: vùng phủ, chất lượng phổ, nhiễu phi Wi-Fi, thời lượng phát sóng và tỷ lệ gửi lại gói tin, chuyển vùng đa trạm, bảo mật mã hóa).
  5. Bảng phân tích chữ ký 4 nguồn nhiễu phi Wi-Fi (`non_wifi_interferers`: lò vi sóng `2.45 GHz`, thiết bị `Bluetooth FHSS`, camera tương tự truyền liên tục và xung radar `DFS`).
  6. Kết luận nguyên nhân chính và các bước xử lý kỹ thuật (`automated_root_cause`).

### 4.4. Đo tốc độ mạng (Speed Test - `tab-speedtest`)
- Thực hiện đo kiểm trực tiếp từ backend qua `httpx` (tự động dự phòng bằng `urllib.request`) tới hệ thống máy chủ `Cloudflare Anycast CDN` (`https://speed.cloudflare.com`).
- Đo tuần tự 4 thông số: độ trễ `Ping` (`ms`), biến thiên độ trễ `Jitter` (`ms`), tốc độ tải xuống `Download` (`Mbps`) và tốc độ tải lên `Upload` (`Mbps`).
- Hỗ trợ chế độ `quick` (đo nhanh), `full` (đo tải cao hơn) và `mock` (dùng cho kiểm thử tự động).
- Truyền trạng thái tiến trình qua luồng `SSE` tại `/api/speedtest/stream` và đối sánh kết quả băng thông internet với tốc độ liên kết vật lý (`PHY Rate`) của card mạng Wi-Fi để xác định điểm nghẽn nằm ở mạng nội bộ hay đường truyền nhà cung cấp.

### 4.5. Chất lượng cuộc gọi thoại (VoWiFi - `tab-vowifi`)
- Đo độ trễ khứ hồi (`RTT`), `Jitter` và tỷ lệ mất gói tin (`Packet Loss %`) bằng lệnh `ping` hệ thống kết hợp kiểm tra phân giải tên miền `DNS` và chặng đầu đến `Default Gateway`.
- Tính hệ số truyền dẫn `R-Factor` và điểm chất lượng thoại `MOS` (thang điểm `1.0` đến `4.5`) theo công thức `ITU-T G.107 E-Model`.
- Đánh giá mức độ đáp ứng của đường truyền đối với 3 bộ mã hóa giọng nói: `Opus`, `G.711` và `G.729`.

### 4.6. Bản đồ nhiệt sóng (Planner & Heatmap - `tab-planner`)
Gồm hai động cơ mô phỏng hoạt động trên mặt bằng 2D:
- **Mô phỏng dò tia tán xạ (`static/heatmap.js`)**:
  - Phát `180` tia xung quanh mỗi trạm phát (`360` độ) để tính suy hao truyền sóng qua khoảng cách và giao cắt với `7` loại vật liệu (`Tường thạch cao`, `Tường gạch`, `Tường bê tông`, `Vách kính`, `Cửa kính cường lực`, `Cửa gỗ`, `Cửa kim loại`).
  - Tự động cắt đoạn tường trùng khi đặt cửa lên tường; hỗ trợ đặt thiết bị đầu cuối (`Laptop`, `PC`) để tính `RSSI`, số tường chắn và liên kết mạnh nhất; có nút nạp thông số từ `/api/scan`.
- **Mô phỏng lưới phủ sóng theo ngưỡng SLA (`core/ai_planner.py` và `static/app.js`)**:
  - Áp dụng mô hình suy hao đường truyền trong nhà (`Log-Distance Path Loss` kèm hệ số xuyên tường theo băng tần `2.4 GHz`, `5 GHz`, `6 GHz`) và công cụ đề xuất vị trí đặt trạm phát đạt ngưỡng nghiệm thu `SLA` (`office`: `-67 dBm`, `voice`: `-65 dBm`, `high_density`: `-60 dBm`).
  - Kết xuất bằng nội suy song tuyến tính (`Bilinear Interpolation`) với 5 lớp hiển thị: cường độ sóng chính (`primary_rssi_grid`), cường độ sóng phụ phục vụ chuyển vùng (`secondary_rssi_grid`), tỷ số tín hiệu trên nhiễu (`snr_grid`), mật độ xung đột kênh (`interference_grid`) và tốc độ dữ liệu ước tính (`throughput_grid`).
  - Hỗ trợ nạp ảnh mặt bằng (`PNG`/`JPG`), thước đo hiệu chuẩn tỷ lệ pixel sang mét thực tế và bảng chỉnh sửa thuộc tính từng trạm phát (kênh `2.4/5/6 GHz`, công suất `Tx Power`).

### 4.7. Kiểm tra an toàn bảo mật (Security Audit - `tab-security`)
- Phân loại các mạng phát hiện theo chuẩn bảo mật: mạng mở không mật khẩu (`Open`), chuẩn cũ kém an toàn (`WEP`, `WPA-TKIP`), `WPA2`, `WPA3` và mạng doanh nghiệp (`Enterprise`).
- Phát hiện các tập hợp `BSSID` sử dụng cùng tên mạng `SSID` nhưng khác tiền tố phần cứng hoặc suy giảm cấu hình bảo mật để cảnh báo khả năng xuất hiện trạm phát giả mạo.
- Đưa ra danh sách cảnh báo theo mức độ và hướng dẫn khắc phục cho từng trường hợp.

### 4.8. Lưu trữ báo cáo (Reports - `tab-reports`)
- Tổng hợp kết quả quét sóng, phân tích kênh 3 băng tần, kiểm tra `Oscium`, thông số `VoWiFi` và cảnh báo bảo mật để xuất thành tệp `CSV` (mã hóa `utf-8-sig` có BOM để mở đúng tiếng Việt trong Excel) hoặc `JSON`.
- Đặt tên tệp tự động theo quy tắc `NetScanner_Report_[MM-DD-YYYY]_[ID-01].csv` và `.json` trong thư mục `reports/`.
- Cho phép liệt kê, tải xuống, xóa từng tệp hoặc xóa toàn bộ tệp báo cáo đã lưu thông qua giao diện web.

---

## 5. Danh mục điểm cuối API (`api/server.py`)

| Nhóm | Giao thức | Đường dẫn | Chức năng |
| :--- | :--- | :--- | :--- |
| Giao diện | `GET` | `/` | Trả về trang chính `static/index.html` |
| Quét sóng | `WS` | `/ws/live` | Kênh WebSocket truyền cập nhật quét sóng và `signal_history` |
| Quét sóng | `GET` | `/api/stream/live` | Luồng `SSE` truyền dữ liệu quét sóng liên tục |
| Quét sóng | `GET` | `/api/scan` | Lấy danh sách `BSSID`, thông số card mạng, cụm phần cứng, cảnh báo (tham số `?force=true`) |
| Quét sóng | `GET` | `/api/clusters` | Lấy danh sách các cụm thiết bị vật lý và tổng hợp cảnh báo |
| Phổ tần & Chẩn đoán | `GET` | `/api/channel-recommendations` | Trả về đánh giá kênh `2.4/5/6 GHz`, airtime, roaming và `troubleshooting_suite` |
| Phổ tần & Chẩn đoán | `POST` | `/api/channel-autopick` | Chọn kênh và độ rộng kênh đề xuất cho cả 3 băng tần |
| Phổ tần & Chẩn đoán | `GET` | `/api/troubleshooting/all-in-one` | Tổng hợp đầy đủ bộ chẩn đoán `Oscium`, `adapter_diagnostics`, `automated_root_cause` và `path_quality` |
| Đo tốc độ | `POST` | `/api/speedtest/start` | Khởi chạy phiên đo tốc độ (`{"mode": "quick" \| "full" \| "mock"}`) |
| Đo tốc độ | `GET` | `/api/speedtest/status` | Đọc trạng thái và kết quả hiện tại của phiên đo tốc độ |
| Đo tốc độ | `POST` | `/api/speedtest/stop` | Dừng phiên đo tốc độ đang chạy |
| Đo tốc độ | `GET` | `/api/speedtest/stream` | Luồng `SSE` cập nhật tiến trình Speed Test |
| VoWiFi | `GET` | `/api/vowifi-mos` | Đo `RTT`, `Jitter`, mất gói, `DNS`, `Default Gateway` và tính điểm `MOS` (`?target=8.8.8.8&count=5`) |
| Bản đồ nhiệt | `POST` | `/api/ai-planner/optimize` | Tính vị trí đặt trạm phát theo kích thước mặt bằng, tường chắn, băng tần và `sla_profile` |
| Bản đồ nhiệt | `POST` | `/api/ai-planner/calculate-heatmap` | Tính 5 ma trận lưới 2D cho các trạm phát và tường chắn đầu vào |
| Báo cáo | `POST` | `/api/export-report` | Tạo tệp báo cáo `CSV` hoặc `JSON` trong `reports/` (`{"format": "csv" \| "json"}`) |
| Báo cáo | `GET` | `/api/reports/list` | Liệt kê danh sách tệp báo cáo hiện có trong `reports/` |
| Báo cáo | `GET` | `/api/reports/download/{filename}` | Tải tệp báo cáo về máy |
| Báo cáo | `DELETE` | `/api/reports/{filename}` | Xóa một tệp báo cáo cụ thể |
| Báo cáo | `POST` | `/api/reports/clear-all` | Xóa toàn bộ tệp báo cáo trong `reports/` |

---

## 6. Kiểm thử tự động

Chạy các bộ kiểm thử từ thư mục gốc của repository (dùng cờ `-B` để không sinh tệp `__pycache__` vào cây làm việc):

```bash
# Kiểm tra cú pháp JavaScript
node --check static/app.js
node --check static/heatmap.js

# Bộ kiểm thử 9 phần từ lõi RF, API đến tài liệu
python -B tests/test_full_suite.py

# Bộ kiểm thử tĩnh giao diện (0 emoji, 0 Lucide icon, Light Mode)
python -B tests/test_challenger_mb_static.py

# Bộ kiểm thử động (SSE Speed Test, Oscium binding, nội suy 5 lớp Heatmap)
python -B tests/test_challenger_mb_dynamic.py

# Bộ kiểm thử toàn vẹn cấu trúc dự án và chạy chéo các suite
python -B tests/test_repo_integrity_mc.py
```

---

*Dự án phục vụ học phần NWC303 tại Đại học FPT Đà Nẵng (2026).*
