# MMQ. / NetScanner - Localhost Wi-Fi Spectrum & Site Survey Suite

Một bộ công cụ phân tích phổ vô tuyến (RF Spectrum Analyzer) và khảo sát mạng Wi-Fi (Site Survey) chạy trực tiếp trên máy cục bộ (`http://localhost:8000`). Được thiết kế tối ưu hóa hiệu năng, siêu nhẹ cho cả các dòng máy tính cấu hình thấp, kết hợp song ngữ (Việt - Anh) chuẩn xác theo chuyên ngành mạng máy tính (NWC203 / NWC303).

---

##  Tính Năng Nổi Bật (Key Features)

### 1. 📡 Thu Thập & Khảo Sát Sóng Wi-Fi Thời Gian Thực (Live Wi-Fi Site Survey)
* **Tích Hợp Sâu C-API Windows Native WLAN (`wlanapi.dll`)**: Đo lường trực tiếp phần cứng chỉ mất ~16ms, phản ánh tức thì độ mạnh tín hiệu (RSSI dBm) và độ ổn định anten.
* **Định Danh Dữ Liệu Song Ngữ Dễ Tiếp Thu**:
  * **Tên Mạng (SSID)** & **Địa chỉ MAC thiết bị (BSSID)**.
  * **Cường độ tín hiệu thực tế**: Phần trăm (%) và chuẩn công suất âm `dBm` kèm nhãn phân loại trực quan (`Rất mạnh`, `Tốt`, `Trung bình`, `Yếu / Vùng chết`).
  * **Chuẩn thế hệ Wi-Fi**: Nhận diện Wi-Fi 4 (802.11n), Wi-Fi 5 (802.11ac), Wi-Fi 6 (802.11ax), Wi-Fi 7 (802.11be).
  * **Hãng sản xuất trạm phát**: Tự động tra cứu IEEE OUI Vendor (Cisco, Aruba, TP-Link, Apple, Intel, Xiaomi...).
  * **Tải kênh & Số máy khách**: Trích xuất tỉ lệ nghẽn kênh (%) và số lượng client đang nối từ Information Elements (BSS Load).
  * **Theo dõi card mạng nội bộ & Mẹo Roaming**: Hiển thị tốc độ truyền dữ liệu Link Speed (Tx/Rx Mbps), độ trễ Ping Gateway và gợi ý chuyển sang băng tần 5GHz khi router phát sóng kép.

### 2.  Tối Ưu Kênh & Cài Đặt Router Trực Tiếp (Channel Optimizer & Router Setup)
* **Mô Hình Băng Tần 2.4 GHz**:
  * Ưu tiên 3 kênh chuẩn sạch không chồng lấn (**1, 6, 11**).
  * Phân biệt rõ ràng **Nhiễu Cùng Kênh (Co-Channel Interference - CCI)** và **Nhiễu Chồng Lấn Kênh Kề (Adjacent Channel Interference - ACI)**.
  * Phạt điểm nặng các kênh dị (2, 3, 4, 5, 7, 8, 9, 10) vì gây phá hủy băng thông lân cận.
* **Mô Hình Băng Tần 5 GHz**:
  * Đánh giá khối UNII-1 (Kênh 36-48), UNII-2A/2C DFS (52-144) và UNII-3 (149-165).
  * Tự động tính toán **Khối Gộp Kênh 80 MHz (Channel Bonding)** giúp đạt tốc độ cao nhất mà không bị văng mạng do sóng Radar DFS.
* **Bảng Hướng Dẫn Cài Đặt Router Thực Chiến**:
  * Cung cấp 4 bước thao tác ngay trên trang quản trị `192.168.1.1` của modem/router gia đình/ký túc xá.

### 3.  Kiểm Toán Thoại VoWiFi & Điểm MOS (Voice over Wi-Fi / ITU-T E-Model G.107)
* **Tính năng tương đương giải pháp Enterprise (Ekahau AI Pro / AirMagnet)**:
  * Đo đạc trực tiếp RTT Latency, Jitter (ms) và Tỷ lệ mất gói (Packet Loss %).
  * Tính điểm **MOS (Mean Opinion Score: 1.0 - 4.5)** theo công thức chuẩn viễn thông ITU-T G.107 E-model.
  * Phân loại trải nghiệm đàm thoại thực tế: Zalo Call, Microsoft Teams, Zoom, Google Meet và Wi-Fi Calling.
  * Đánh giá độ tương thích các bộ giải mã âm thanh: **Opus HD Audio**, **G.711u/a** và **G.729**.

### 4.  Quy Hoạch AP & Bản Đồ Nhiệt RF 2D/2.5D (Floorplan RF Heatmap Simulator)
* **Kế thừa thao tác trực quan từ Sweet Home 3D (`sweethome3d.com`) & SketchUp (`sketchup.trimble.com`)**:
  * Thay vì nhúng phần mềm dựng hình 3D nặng nề vào trình duyệt, công cụ chọn lọc các thao tác thiết kế mặt bằng nhanh nhất cho kỹ sư mạng: **Vẽ Khung Phòng (`room`)**, **Vẽ Tường Lẻ (`draw`)**, **Chọn & Kéo Sửa (`select`)**, **Đặt Thêm AP Thủ Công (`place_ap`)**, **Thước Đo Suy Hao (`ruler`)** và **Phối Cảnh 2.5D (`view25D`)**.
  * Chuyển đổi linh hoạt băng tần mô phỏng **2.4 GHz** (xuyên tường tốt) và **5.0 GHz** (tốc độ cao, suy hao vách ngăn lớn hơn 1.25 lần) theo mô hình **ITU-R P.1238 Log-Distance Path Loss Model**.
  * Mô phỏng suy hao thực tế qua 6 loại vật cản: Tường bê tông cốt thép ($-12\text{ dB}$), Lõi thang máy/Tủ sắt ($-15\text{ dB}$), Tường gạch ($-6\text{ dB}$), Vách gỗ/Thạch cao ($-4\text{ dB}$), Kính cường lực ($-3\text{ dB}$), Cửa phòng ($-2\text{ dB}$).
  * Tự động tính toán số lượng trạm phát tối thiểu, tọa độ $(x, y)$ và phân bổ kênh 2.4G/5G để đạt độ phủ sóng $\ge 90\%$ (ngưỡng sóng VoWiFi $\ge -65\text{ dBm}$).

### 5.  Bộ Phân Tích Phổ Tần Số & Biểu Đồ Thác Nước (RF Spectrum & Spectrogram Waterfall)
* **Đồ thị chuông OFDM & Thác Nước Mật Độ Phổ trên HTML5 Canvas**:
  * Vẽ đường cong phổ phân bố công suất thực cho từng AP theo thời gian thực trên cả 2.4 GHz và 5 GHz.
  * **Biểu Đồ Thác Nước (Spectrogram Waterfall)**: Theo dõi mật độ năng lượng tích lũy trên các kênh 1-14 theo dòng thời gian.
  * **Phân Tích Chiếm Dụng Thời Gian Sóng (Airtime Utilization)** và **Kiểm Tra Chuyển Vùng Mesh / Thiết Bị Bám Sóng Yếu (Sticky Client Audit)**.

### 6.  Đánh Giá An Ninh Mạng & Khắc Phục Lỗ Hổng (Security Audit)
* **Phát hiện mạng không mã hóa (Open / Unencrypted) & Giả Mạo Trạm Phát (Evil Twin)**:
  * Nêu rõ **Nguyên nhân kỹ thuật**: Sóng vô tuyến truyền bản rõ không mã hóa.
  * Nêu rõ **Rủi ro thực tế**: Nguy cơ bị bắt gói tin (Packet Sniffing), tấn công trạm phát giả mạo (Evil Twin), truy cập trái phép thiết bị nội bộ (LAN).
  * Nêu rõ **Các bước khắc phục**: Cấu hình WPA2-PSK (AES) / WPA3-SAE, đặt mật khẩu mạnh $\ge 12$ ký tự, bật Client Isolation cho mạng khách và tắt WPS.

### 7. 📑 Báo Cáo Khảo Sát Chuẩn Hóa: `NetScanner_Report_[MM-DD-YYYY]_[ID-01].csv`
* Định dạng file báo cáo xuất ra tuân thủ nghiêm ngặt:
  * `NetScanner_Report_[MM-DD-YYYY]_[ID-01].csv` (Tự động tăng số thứ tự `ID-01`, `ID-02` theo ngày).
  * Sinh file nhanh (< 2ms), gọn nhẹ, tương thích hoàn toàn tiếng Việt trên Microsoft Excel (UTF-8 with BOM).
  * Gồm 6 phần chi tiết: Tổng quan, Khuyến nghị kênh 2.4G/5G, Hướng dẫn cài router, Báo cáo chẩn đoán an ninh mạng, Tiêu chuẩn chất lượng thoại VoWiFi MOS và Bảng kê chi tiết từng Access Point (kèm SNR, Noise Floor, MCS Index, tốc độ thực ước tính).

---

##  Hướng Dẫn Khởi Chạy (Quick Start)

### Cách 1: Bấm Đúp Chuột
Bấm đúp vào file `start.bat`.

### Cách 2: Dòng Lệnh Terminal / PowerShell
```bash
python run.py
```
Hệ thống sẽ khởi chạy server FastAPI tại `http://localhost:8000` và tự động mở trình duyệt mặc định.

---

##  Danh Sách REST API

| Phương Thức | Điểm Cuối (Endpoint) | Chức Năng |
|---|---|---|
| `GET` | `/api/vowifi-mos` | Đo đạc RTT, Jitter, Packet loss và tính điểm MOS ITU-T G.107 cho VoWiFi |
| `POST` | `/api/ai-planner/optimize` | Thuật toán tính số lượng và vị trí đặt AP tối ưu trên mặt bằng |
| `POST` | `/api/ai-planner/calculate-heatmap` | Tạo ma trận bản đồ nhiệt 2D RSSI Heatmap từ vị trí AP và vách tường |
| `GET` | `/api/scan` | Quét sóng Wi-Fi phần cứng và trả về danh sách BSSID, cụm thiết bị và cảnh báo |
| `GET` | `/api/clusters` | Trả về danh sách cụm thiết bị vật lý (Hardware Grouping) và giải mã mạng ẩn |
| `GET` | `/api/channel-recommendations` | Trả về điểm số phân tích các kênh 2.4 GHz và 5 GHz |
| `POST` | `/api/channel-autopick` | Kích hoạt thuật toán tự động chọn kênh sạch nhất |
| `POST` | `/api/export-report` | Xuất báo cáo định dạng `csv` hoặc `json` |
| `GET` | `/api/reports/download/{filename}` | Tải file báo cáo về máy |
| `GET` | `/api/reports/list` | Liệt kê danh sách toàn bộ báo cáo trong thư mục `reports/` |
| `DELETE` | `/api/reports/{filename}` | Xóa một bản ghi báo cáo |
| `POST` | `/api/reports/clear-all` | Dọn dẹp sạch toàn bộ kho báo cáo cũ |
| `WS` | `/ws/live` | Luồng WebSocket truyền dữ liệu thời gian thực |

---

##  Cấu Trúc Mã Nguồn (Project Architecture)

```
tool-NWC203/
├── run.py                 # File khởi chạy & tự động mở trình duyệt
├── start.bat              # Script khởi chạy 1-click trên Windows
├── server.py              # FastAPI server, REST API & WebSocket endpoint
├── wifi_scanner.py        # Module quét sóng phần cứng (wlanapi.dll + netsh bssid)
├── channel_analyzer.py    # Mô hình toán học đánh giá phổ tần và tính kênh sạch
├── vowifi_analyzer.py     # Đo đạc độ trễ RTT/Jitter và tính điểm chất lượng thoại MOS
├── ai_planner.py          # Thuật toán tính vị trí AP và vẽ bản đồ nhiệt 2D/2.5D Heatmap
├── report_generator.py    # Bộ xuất báo cáo chuẩn NetScanner_Report_[MM-DD-YYYY]_[ID-01]
├── reports/               # Thư mục lưu trữ báo cáo cục bộ
└── static/
    ├── index.html         # Giao diện chính MMQ./NetScanner
    ├── styles.css         # CSS giao diện Dark/Light mode
    ├── app.js             # Logic xử lý giao diện, vẽ Canvas phổ tần, Heatmap 2D/2.5D và WebSocket
    └── lucide.min.js      # Bộ thư viện icon offline
```
