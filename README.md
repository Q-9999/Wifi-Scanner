# MMQ. / NetScanner - Localhost Wi-Fi Spectrum, Troubleshooting & RF Design Suite

Bộ công cụ khảo sát sóng Wi-Fi thời gian thực (Live Wi-Fi Site Survey), phân tích phổ tần số (RF Spectrum Analyzer), xử lý sự cố toàn diện (All-in-One Troubleshooting) và quy hoạch mặt bằng bản đồ nhiệt đa chế độ (RF Floorplan & Heatmap Planner) chạy trực tiếp trên máy cục bộ tại địa chỉ `http://localhost:8000`. Hệ thống được thiết kế nhẹ, tốc độ phản hồi nhanh, hỗ trợ giao diện Sáng / Tối (Light / Dark Mode) và giải thích song ngữ Việt - Anh (Vietnamese - English) rõ ràng, sát thực tế chuyên ngành mạng máy tính (NWC203 / NWC303).

---

## 🏛️ Tổng Quan Kiến Trúc & Triết Lý Thiết Kế (System Overview & Design References)

Tài liệu này được biên soạn chi tiết để bất kỳ kỹ sư hoặc phiên làm việc mới nào chỉ cần đọc file `README.md` là nắm bắt trọn vẹn cấu trúc mã nguồn, luồng dữ liệu và toàn bộ tính năng của công cụ **MMQ./NetScanner**:

1. **Giao Diện Bảng Điều Khiển Phân Tích Hiện Đại (Modern SaaS Analytics Dashboard UI)**:
   * Thiết kế tham chiếu phong cách **SaaS Analytics Dashboard** (`uupm.cc`): Nền lưới ánh sáng chuyển sắc (Radial Aurora Mesh Background), thẻ kính mờ phân tách độ sâu (Glassmorphic Cards), thanh chỉ số tổng quan 5 thẻ KPI ở đầu trang kèm nhãn trạng thái trực quan và thanh tiến trình định lượng (Progress Track), thanh điều hướng phân đoạn (Segmented Tab Navigation) và bảng dữ liệu mật độ cao dễ đọc.
2. **Quy Hoạch Mặt Bằng & Bản Đồ Nhiệt 5 Chế Độ Chuẩn Ekahau (Ekahau Wi-Fi Design Solutions)**:
   * Tham chiếu quy trình thiết kế mạng không dây chuyên nghiệp của **Ekahau**: Hỗ trợ mô phỏng 3 băng tần (**2.4 GHz**, **5.0 GHz**, **6.0 GHz Wi-Fi 6E/7**), 3 hồ sơ tiêu chuẩn nghiệm thu (**SLA Profiles**: Văn phòng tiêu chuẩn, Đàm thoại VoWiFi / Roaming, Hội trường mật độ cao), **5 chế độ bản đồ nhiệt chuyên sâu**, công cụ nạp trực tiếp các trạm phát thực tế vừa quét được lên mặt bằng và đầu dò thông số sóng tại điểm trỏ chuột (Live Point Probe).
3. **Bộ Công Cụ Chẩn Đoán & Xử Lý Sự Cố Toàn Diện Chuẩn Oscium (Oscium All-in-One Troubleshooting Bundle)**:
   * Tham chiếu bộ giải pháp khảo sát thực địa của **Oscium** (gồm WiPry Clarity, Wi-Spy Lucid / Chanalyzer, Device Finder và Nomad):
     * **Bộ Dò Hướng Tín Hiệu AP (Oscium Device Finder)**: Khóa mục tiêu vào bất kỳ địa chỉ BSSID nào để theo dõi biến thiên công suất dBm theo thời gian thực, ghi nhận đỉnh sóng (Peak RSSI), thước đo độ tiệm cận (%) và ước tính khoảng cách vật lý tới bộ phát.
     * **Bộ Phân Loại Nhiễu Phổ Tần Tầng 1 & Tầng 2 (Spectrum & Interference Classifier)**: Tự động bóc tách 5 nhóm nguyên nhân gây nhiễu vật lý và nghẽn truyền dẫn.
     * **Bảng Kiểm Tra Chẩn Đoán 4 Tầng & Đo Độ Trễ Đa Chặng (4-Layer Checklist & Multi-Hop Latency Audit)**: Tách biệt rõ ràng độ trễ nội bộ (Local Gateway), độ trễ đường truyền Internet (WAN Cloud) và tốc độ phân giải tên miền (DNS Resolver).

---

## 🌟 Chi Tiết Các Phân Hệ Chức Năng (Core Functional Modules)

### 1. 📡 Khảo Sát Sóng Wi-Fi Thời Gian Thực & Gom Cụm Phần Cứng (Live Site Survey & BSSID Clustering)
* **Quét Trực Tiếp Qua Windows Native WLAN API (`wlanapi.dll`)**:
  * Giao tiếp trực tiếp với trình điều khiển card mạng không dây giúp thu thập danh sách trạm phát chỉ trong ~15-25ms, kết hợp luồng dữ liệu đồng bộ liên tục qua **WebSocket (`/ws/live`)**.
* **Thông Số Kỹ Thuật Đầy Đủ Cho Từng BSSID**:
  * Tên mạng (**SSID**), địa chỉ phần cứng (**BSSID**), hãng sản xuất phần cứng tra cứu từ cơ sở dữ liệu IEEE OUI (**Vendor**: Cisco, Aruba, Ruckus, Ubiquiti, TP-Link, Asus, Viettel, VNPT, FPT...).
  * Cường độ sóng theo phần trăm (**Signal %**) và công suất thực (**RSSI dBm**), mức nền nhiễu ước tính (**Noise Floor dBm**), tỷ số tín hiệu trên nhiễu (**SNR dB**).
  * Thế hệ chuẩn Wi-Fi (**Wi-Fi 4 / 802.11n**, **Wi-Fi 5 / 802.11ac**, **Wi-Fi 6 / 802.11ax**, **Wi-Fi 6E / 7 / 802.11be**), độ rộng kênh (**20 / 40 / 80 / 160 MHz**), chỉ số điều chế (**MCS Index 0-11**) và tốc độ truyền dữ liệu thực tế ước tính (**Estimated TCP/IP Throughput Mbps**).
  * Trích xuất thông số tải trạm phát (**BSS Load IE**): Tỷ lệ chiếm dụng kênh (**Channel Utilization %**) và số lượng thiết bị đang kết nối (**Connected Station Count**).
* **Gom Cụm Thiết Bị Vật Lý & Giải Mã Mạng Ẩn (Hardware Clustering & Hidden SSID De-cloaking)**:
  * Tự động nhóm các BSSID có cùng tiền tố MAC (5 byte đầu hoặc cùng OUI và cường độ sóng tương đương) thành một thiết bị phần cứng duy nhất phát đa băng tần (2.4G + 5G + Guest + Mesh Backhaul).
  * Tự động phát hiện và đối chiếu tên thật của các mạng ẩn (Hidden SSID) nếu nằm trên cùng một phần cứng vật lý với mạng chính.

### 2. 🎯 Bộ Dò Hướng Tín Hiệu AP Thực Địa (Oscium Device Finder Modal)
* Kích hoạt từ thanh công cụ khảo sát hoặc bấm biểu tượng **🎯** trên bất kỳ dòng mạng / thẻ chi tiết AP nào.
* **Chức Năng Định Vị Vật Lý**:
  * Hiển thị đồng hồ đo công suất tức thời (**Current RSSI dBm**), mức sóng mạnh nhất ghi nhận được (**Peak RSSI**), mức trung bình (**Average RSSI**), mức thấp nhất (**Min RSSI**) và khoảng cách vật lý ước tính bằng mét (**Estimated Distance**).
  * **Thước Đo Độ Tiệm Cận (Proximity Meter 0 - 100%)**: Tự động đổi màu và đưa ra chỉ dẫn di chuyển theo hướng tăng của sóng để kỹ thuật viên xác định chính xác vị trí đặt bộ phát hoặc phát hiện trạm phát lạ (Rogue / Evil Twin AP).
  * **Biểu Đồ Lịch Sử Dò Hướng 60 Mẫu (Directional History Graph)**: Vẽ đường biến thiên RSSI mượt mà trên Canvas kèm vạch chuẩn đỉnh sóng (Peak Marker).

### 3. 📊 Phân Tích Phổ Tần Số, Thác Nước & Bộ Phân Loại Nhiễu (RF Spectrum, Waterfall & Interference Classifiers)
* **Đồ Thị Phổ Chuông OFDM 2.4 GHz & 5 GHz**:
  * Vẽ mặt nạ phổ công suất thực của từng trạm phát theo đúng kênh trung tâm và độ rộng băng thông (20/40/80/160 MHz).
* **Biểu Đồ Thác Nước Theo Thời Gian (Spectrogram Waterfall)**:
  * Lưu vết mật độ năng lượng trên băng tần 2.4 GHz (Kênh 1-14) theo dòng thời gian giúp phát hiện các nguồn gây nhiễu chớp nhoáng.
* **Bộ Phân Loại Nhiễu Phổ Tần Tầng 1 & Tầng 2 (Oscium Wi-Spy + Chanalyzer Classifier)**:
  * **Tầng 1 (2.4 GHz Overlap)**: Phát hiện nhiễu chồng lấn kênh kề (ACI) và các bộ phát chiếm băng thông rộng 40 MHz trên băng tần 2.4 GHz.
  * **Tầng 1 (2.45 GHz Non-WiFi ISM)**: Đánh giá mật độ nhiễu nền từ thiết bị Bluetooth, chuột không dây, Zigbee và lò vi sóng.
  * **Tầng 1 (5 GHz DFS Radar)**: Giám sát các kênh UNII-2A/2C (Kênh 52-144) chịu ràng buộc nhường kênh cho sóng Radar thời tiết / quân sự.
  * **Tầng 1 (6 GHz Wi-Fi 6E/7 UNII-5)**: Đánh giá các kênh ưu tiên quét (**PSC Channels**: 5, 21, 37, 53, 69, 85) và khối kênh siêu tốc **160 MHz**.
  * **Tầng 2 (MAC Airtime & Frame Retry)**: Tính toán tỷ lệ chiếm dụng thời gian đường truyền và tỷ lệ phát lại gói tin (**Estimated Frame Retry Rate %**).

### 4. ⚡ Tối Ưu Kênh Đa Băng Tần & Bảng Kiểm Tra Chẩn Đoán 4 Tầng (Channel Optimizer & 4-Layer Checklist)
* **Chấm Điểm & Khuyến Nghị Kênh Tự Động (2.4 GHz / 5 GHz / 6 GHz)**:
  * Đánh giá toàn bộ kênh khả dụng trên 3 băng tần, tự động chọn ra kênh sạch nhất trên 2.4 GHz (ưu tiên 1, 6, 11), kênh/khối 80 MHz sạch nhất trên 5 GHz và kênh PSC / khối 160 MHz tối ưu trên 6 GHz.
* **Bảng Kiểm Tra Chẩn Đoán Mạng 4 Tầng (Oscium 4-Layer Troubleshooting Checklist)**:
  1. **Tầng 1 - Môi Trường Phổ Vô Tuyến (RF Physical Layer)**: Kiểm tra điểm sức khỏe phổ tần và mức độ đè kênh.
  2. **Tầng 2 - Liên Kết & Chuyển Vùng (802.11 MAC & Roaming)**: Kiểm tra tốc độ liên kết (Link Speed), tỷ lệ phát lại gói tin (Retry Rate) và tình trạng thiết bị bám sóng yếu (Sticky Client).
  3. **Tầng 3 - Cấu Hình Kênh & Băng Thông (Channel Plan)**: Kiểm tra xem trạm phát đang kết nối có đặt đúng kênh chuẩn hay không.
  4. **Tầng 4 - An Ninh & Bảo Mật (WLAN Security)**: Kiểm tra chuẩn mã hóa (WPA2/WPA3), cảnh báo mạng mở (Open) hoặc nghi vấn giả mạo SSID (Evil Twin).

### 5. 🎙️ Kiểm Toán Thoại VoWiFi, Điểm MOS ITU-T G.107 & Đo Độ Trễ Đa Chặng (VoWiFi & Multi-Hop Path Audit)
* **Mô Hình Toán Học ITU-T G.107 E-Model**:
  * Đo đạc trực tiếp độ trễ khứ hồi (**RTT Latency ms**), độ biến thiên trễ (**Jitter ms**) và tỷ lệ rớt gói (**Packet Loss %**) để tính hệ số truyền dẫn $R$-factor và quy đổi ra điểm chất lượng đàm thoại **MOS (1.0 - 4.5)**.
  * Đánh giá khả năng hoạt động của các bộ mã hóa âm thanh thời gian thực (**Opus HD**, **G.711 PCM**, **G.729**).
* **Đo Kiểm Đa Chặng Phân Tách Điểm Nghẽn (Multi-Hop Path Audit)**:
  * **Chặng 1 (Local Wi-Fi Hop)**: Đo độ trễ từ máy tính tới địa chỉ **Default Gateway IP** của bộ định tuyến nội bộ để xác định lỗi do sóng Wi-Fi yếu hay nhiễu nội mạng.
  * **Chặng 2 (WAN Internet Hop)**: Đo độ trễ tới máy chủ quốc tế (Google DNS `8.8.8.8`, Cloudflare `1.1.1.1`, OpenDNS) để kiểm tra đường truyền nhà mạng ISP.
  * **Chặng 3 (DNS Resolver)**: Đo thời gian phân giải tên miền thực tế bằng mili-giây (`dns_latency_ms`) và đưa ra kết luận chẩn đoán cụ thể bằng tiếng Việt.

### 6. 🗺️ Quy Hoạch Mặt Bằng & Bản Đồ Nhiệt 5 Chế Độ Chuẩn Ekahau (Interactive 2D/2.5D Floorplan & 5-Mode Heatmap)
* **Công Cụ Thiết Kế Mặt Bằng Trực Quan (Sweet Home 3D + SketchUp Style)**:
  * Hỗ trợ 6 công cụ tương tác trực tiếp trên Canvas: **Vẽ Khung Phòng (`room`)**, **Vẽ Tường Lẻ (`draw`)**, **Chọn & Kéo Sửa (`select`)**, **Đặt Thêm AP Thủ Công (`place_ap`)**, **Thước Đo Suy Hao (`ruler`)**, **Xóa Đối Tượng (`delete`)** và chuyển đổi góc nhìn **Phối Cảnh 2.5D (`view25D`)**.
  * Hỗ trợ **6 loại vật liệu cản sóng** với hệ số suy hao riêng theo tần số: Tường gạch ($-6\text{ dB}$), Tường bê tông dày ($-12\text{ dB}$), Vách gỗ/Thạch cao ($-4\text{ dB}$), Kính cường lực ($-3\text{ dB}$), Cửa phòng ($-2\text{ dB}$), Lõi thang máy/Tủ sắt ($-15\text{ dB}$).
  * **Nạp AP Quét Thực Tế (`importScannedAPsToFloorplan`)**: Đưa ngay các bộ phát thực tế đang quét được ngoài đời thực vào bản vẽ để mô phỏng vùng phủ.
* **Mô Phỏng 3 Băng Tần & 3 Hồ Sơ Nghiệm Thu SLA**:
  * Chuyển đổi tức thì giữa **2.4 GHz** (xuyên tường tốt), **5.0 GHz** (tốc độ cao) và **6.0 GHz Wi-Fi 6E/7** (băng thông siêu rộng 160 MHz, suy hao vật cản cao hơn).
  * Kiểm định tự động theo 3 hồ sơ **SLA Profiles**:
    * `office` (Văn phòng tiêu chuẩn: Primary $\ge -67\text{ dBm}$, Secondary $\ge -75\text{ dBm}$, SNR $\ge 20\text{ dB}$).
    * `voice` (Đàm thoại VoWiFi / Roaming: Primary $\ge -65\text{ dBm}$, Secondary $\ge -70\text{ dBm}$, SNR $\ge 25\text{ dB}$).
    * `high_density` (Hội trường mật độ cao: Primary $\ge -62\text{ dBm}$, Secondary $\ge -68\text{ dBm}$, SNR $\ge 28\text{ dB}$).
* **5 Chế Độ Bản Đồ Nhiệt Chuyên Sâu (5 Ekahau Visualization Modes)**:
  1. **Sóng Chính (`primary_rssi`)**: Cường độ tín hiệu mạnh nhất nhận được tại mỗi tọa độ (dBm).
  2. **Sóng Phụ Chuyển Vùng (`secondary_rssi`)**: Cường độ tín hiệu của trạm phát mạnh thứ hai tại mỗi điểm, đảm bảo thiết bị chuyển vùng (Roaming) mượt mà không bị đứt cuộc gọi khi di chuyển.
  3. **Tỷ Số Tín Hiệu / Nhiễu (`snr`)**: Phân bố tỷ số SNR (dB) quyết định khả năng đạt chuẩn điều chế cao (QAM-1024 / QAM-4096).
  4. **Tranh Chấp Đồng Kênh (`interference`)**: Phát hiện các vùng giao thoa có nhiều trạm phát dùng trùng kênh hoặc kênh đè nhau gây nghẽn Co-Channel Interference.
  5. **Tốc Độ Dữ Liệu & Sức Chứa (`throughput`)**: Bản đồ tốc độ truyền tải dữ liệu PHY ước tính (Mbps) và tổng sức chứa thiết bị kết nối đồng thời (**Max Client Capacity**).
* **Đầu Dò Thông Số Sóng Tại Chỗ (Live Point Probe)**:
  * Khi di chuột trên mặt bằng, thanh trạng thái hiển thị tức thì cả 5 thông số (`Pri dBm`, `Sec dBm`, `SNR dB`, `CCI`, `Mbps`) tại đúng tọa độ mét $(x, y)$ đang trỏ.

### 7. 📑 Báo Cáo Khảo Sát Chuẩn Hóa: `NetScanner_Report_[MM-DD-YYYY]_[ID-01].csv` / `.json`
* Tên file xuất ra tuân thủ định dạng: `NetScanner_Report_[MM-DD-YYYY]_[ID-01].csv` (hoặc `.json`), tự động đánh số thứ tự tăng dần (`ID-01`, `ID-02`...) trong thư mục `reports/`.
* Hỗ trợ mã hóa UTF-8 kèm BOM giúp mở trực tiếp trên Microsoft Excel hiển thị chuẩn tiếng Việt, bao gồm 6 phần: Tổng quan môi trường, Khuyến nghị kênh, Hướng dẫn cấu hình Router, Kiểm toán bảo mật, Tiêu chuẩn VoWiFi MOS và Bảng kê chi tiết từng BSSID.

---

## 🛠️ Danh Sách Điểm Cuối Giao Tiếp (REST API & WebSocket Endpoints)

| Phương Thức | Đường Dẫn (Endpoint) | Mô Tả Chức Năng & Dữ Liệu Trả Về |
|---|---|---|
| `GET` | `/api/scan` | Quét sóng Wi-Fi qua phần cứng (`force=true/false`), trả về `networks`, `connected_interface`, `device_clusters`, `security_threats` và toàn bộ dữ liệu phân tích. |
| `GET` | `/api/clusters` | Trả về danh sách các cụm phần cứng vật lý (`device_clusters`) và kết quả giải mã tên mạng ẩn. |
| `GET` | `/api/channel-recommendations` | Phân tích phổ tần 2.4 GHz, 5 GHz, 6 GHz (`channels_24ghz`, `channels_5ghz`, `channels_6ghz`), `roaming_audit`, `airtime_breakdown` và `troubleshooting_suite`. |
| `POST` | `/api/channel-autopick` | Chọn nhanh bộ kênh tối ưu nhất cho cả 3 băng tần (`best_24ghz_channel`, `best_5ghz_channel`, `best_6ghz_channel`, `bond_160mhz_block`). |
| `GET` | `/api/troubleshooting/all-in-one` | Điểm cuối tổng hợp chuẩn Oscium trả về dữ liệu phân loại nhiễu phổ tần, danh sách kiểm tra 4 tầng, trạng thái chuyển vùng và cảnh báo an ninh. |
| `GET` | `/api/vowifi-mos` | Đo kiểm VoWiFi (`target=8.8.8.8`, `count=5`), trả về `mos_score`, `r_factor`, `latency_avg_ms`, `jitter_ms`, `packet_loss_pct`, kèm kiểm toán đa chặng (`gateway_ip`, `gateway_latency_ms`, `dns_latency_ms`, `path_diagnosis_vi`). |
| `POST` | `/api/ai-planner/optimize` | Tự động tính số lượng và tọa độ đặt AP tối ưu trên mặt bằng theo băng tần (`2.4`, `5.0`, `6.0`) và hồ sơ `sla_profile` (`office`, `voice`, `high_density`), trả về danh sách AP và 5 ma trận bản đồ nhiệt. |
| `POST` | `/api/ai-planner/calculate-heatmap` | Tính toán lại tức thì 5 ma trận bản đồ nhiệt (`primary_rssi_grid`, `secondary_rssi_grid`, `snr_grid`, `interference_grid`, `throughput_grid`) và các chỉ số SLA khi người dùng thêm/xóa tường hoặc kéo vị trí AP. |
| `POST` | `/api/export-report` | Khởi tạo file báo cáo `NetScanner_Report_[MM-DD-YYYY]_[ID-XX].csv` hoặc `.json` trong thư mục `reports/`. |
| `GET` | `/api/reports/list` | Liệt kê danh sách các báo cáo đã lưu kèm dung lượng và thời gian tạo. |
| `GET` | `/api/reports/download/{filename}` | Tải file báo cáo về máy tính. |
| `DELETE` | `/api/reports/{filename}` | Xóa một file báo cáo cụ thể. |
| `POST` | `/api/reports/clear-all` | Xóa toàn bộ các file báo cáo cũ trong thư mục `reports/`. |
| `WS` | `/ws/live` | Kênh WebSocket đẩy dữ liệu quét thời gian thực xuống giao diện trình duyệt mỗi chu kỳ. |

---

## 📂 Cấu Trúc Thư Mục & Vai Trò Từng Tệp Tin (Repository File Map)

```text
tool-NWC203/
├── run.py                  # Điểm khởi chạy chính: kiểm tra thư viện, mở trình duyệt và chạy Uvicorn server tại cổng 8000
├── start.bat               # Tập lệnh khởi chạy nhanh 1-click trên hệ điều hành Windows
├── server.py               # Máy chủ FastAPI, điều phối bộ nhớ đệm quét nền, các REST API và luồng WebSocket /ws/live
├── wifi_scanner.py         # Giao tiếp phần cứng wlanapi.dll & netsh, tính SNR, Noise Floor, MCS Index, gom cụm BSSID và kiểm toán bảo mật
├── channel_analyzer.py     # Chấm điểm kênh 2.4G/5G/6G, phân tích Airtime, Roaming Audit, 4-Layer Checklist và Spectrum Classifiers
├── vowifi_analyzer.py      # Đo độ trễ đa chặng (Gateway / WAN / DNS) và tính điểm chất lượng thoại VoWiFi theo chuẩn ITU-T G.107 E-Model
├── ai_planner.py           # Mô hình suy hao ITU-R P.1238 đa băng tần (2.4G/5G/6G), tối ưu vị trí AP và sinh 5 ma trận bản đồ nhiệt Ekahau
├── report_generator.py     # Sinh báo cáo chuẩn hóa NetScanner_Report_[MM-DD-YYYY]_[ID-01].csv / .json
├── test_full_suite.py      # Bộ kiểm thử tự động xác minh toàn bộ thuật toán và điểm cuối của hệ thống
├── reports/                # Thư mục lưu trữ các bản xuất báo cáo khảo sát
└── static/
    ├── index.html          # Giao diện chính MMQ./NetScanner (5 KPI Cards, 6 Tabs chức năng, Modal Device Finder, Modal Chi tiết AP)
    ├── styles.css          # Hệ thống giao diện SaaS Analytics Dashboard (Dark/Light theme, Glassmorphism, Ekahau & Oscium UI components)
    ├── app.js              # Toàn bộ logic điều khiển giao diện, song ngữ Việt-Anh, vẽ đồ thị phổ tần, bản đồ nhiệt 5 chế độ và Device Finder
    └── lucide.min.js       # Thư viện biểu tượng đồ họa hoạt động ngoại tuyến (Offline Icons)
```

---

## 🚀 Hướng Dẫn Khởi Chạy & Kiểm Thử (Quick Start & Verification)

### 1. Khởi Chạy Công Cụ
* **Cách 1 (Khuyên dùng trên Windows)**: Nhấp đúp chuột vào tệp `start.bat`.
* **Cách 2 (Chạy từ Terminal / PowerShell)**:
  ```powershell
  python run.py
  ```
  Sau khi khởi chạy, trình duyệt sẽ tự động mở địa chỉ `http://localhost:8000`.

### 2. Chạy Bộ Kiểmử Toàn Diện (Automated Verification Suite)
Để kiểm tra độ chính xác của mô hình toán học RF, bộ phân tích kênh 2.4G/5G/6G, bộ chẩn đoán Oscium, kiểm toán đa chặng VoWiFi và 5 ma trận bản đồ nhiệt Ekahau, chạy lệnh:
```powershell
python test_full_suite.py
```
