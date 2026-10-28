# MMQ./WifiScanner - Công Cụ Khảo Sát Và Phân Tích Mạng Wi-Fi 

MMQ./WifiScanner là công cụ khảo sát sóng vô tuyến, đo lường thông số mạng Wi-Fi, phân tích phổ tần, mô phỏng bản đồ nhiệt suy hao sóng, đo tốc độ truyền dữ liệu internet và xuất báo cáo dữ liệu. Ứng dụng chạy trực tiếp trên máy tính cục bộ bằng chính card Wifi trong máy bạn.



---

## 1. Kiến Trúc Hệ Thống

Ứng dụng gồm hai phần chính:

1. **Phần máy chủ xử lý (Backend - Python)**:
   - Sử dụng FastAPI và Uvicorn để tiếp nhận yêu cầu HTTP REST API, truyền dữ liệu thời gian thực qua Server-Sent Events (SSE) và kết nối WebSocket.
   - Thu thập dữ liệu sóng từ card mạng không dây thông qua Windows Native WLAN API (wlanapi.dll) và công cụ 
etsh wlan của hệ điều hành Windows.
   - Tích hợp các mô-đun xử lý: phân tích kênh phát, kiểm tra sự cố mạng theo chuẩn Oscium, đánh giá chất lượng thoại VoWiFi theo mô hình ITU-T G.107 E-Model, tính toán suy hao sóng theo mô hình ITU-R P.1238 và đo tốc độ mạng qua mạng lưới máy chủ Cloudflare Anycast CDN.

2. **Phần giao diện người dùng (Frontend - Web)**:
   - Xây dựng dưới dạng trang đơn bằng HTML5, CSS3 và JavaScript thuần (Vanilla JS), không sử dụng thư viện bên ngoài.
   - Biểu đồ phổ tần, biểu đồ biến thiên tín hiệu và bản đồ nhiệt được vẽ trực tiếp bằng thẻ HTML5 Canvas.

---

## 2. Hướng Dẫn Cài Đặt Và Khởi Động

### Yêu Cầu Hệ Thống
- Hệ điều hành: Windows 10 hoặc Windows 11.
- Python: Phiên bản 3.10 trở lên.
- Thiết bị: Card mạng Wi-Fi.

### Các Bước Khởi Động
1. Mở thư mục chứa mã nguồn trong cửa sổ dòng lệnh (CMD hoặc PowerShell).
2. Cài đặt các gói thư viện cần thiết:
   `bash
   pip install -r requirements.txt
   `
3. Khởi động chương trình:
   - Cách 1: Nhấn đúp chuột vào tập tin start.bat.
   - Cách 2: Chạy lệnh: python run.py
4. Trình duyệt web sẽ tự động mở địa chỉ: http://localhost:8000.

---

## 3. Chi Tiết 8 Chức Năng Chính

### Chức Năng 1: Khảo Sát Sóng Wi-Fi Thời Gian Thực
- Quét và liệt kê danh sách các trạm phát sóng (BSSID) mà card mạng thu nhận được.
- Ghi nhận đầy đủ các thông số kỹ thuật:
  - Tên mạng (SSID), địa chỉ vật lý MAC (BSSID), tên nhà sản xuất phần cứng theo mã tra cứu IEEE OUI.
  - Mức tín hiệu thu (RSSI tính bằng dBm), tỷ lệ phần trăm tín hiệu (%), mức nền nhiễu ước tính (Noise Floor tính bằng dBm) và tỷ số tín hiệu trên nhiễu (SNR tính bằng dB).
  - Chuẩn mạng Wi-Fi (Wi-Fi 4 / 802.11n, Wi-Fi 5 / 802.11ac, Wi-Fi 6 / 802.11ax, Wi-Fi 6E/7 / 802.11be), độ rộng kênh (20, 40, 80, 160 MHz), chỉ số điều chế và mã hóa MCS (từ 0 đến 11), dạng điều chế tín hiệu (từ BPSK đến 4096-QAM) và tốc độ truyền dữ liệu lý thuyết (Mbps).
  - Tỷ lệ chiếm dụng thời gian kênh và số lượng thiết bị đang kết nối từ phần tử BSS Load.
- Nhóm phần cứng vật lý: Tự động xác định các BSSID cùng thuộc một bộ phát phần cứng phát đồng thời nhiều băng tần (2.4 GHz, 5 GHz, mạng khách, mạng kết nối nội bộ).
- Xác định tên mạng ẩn: Đối chiếu địa chỉ MAC để tìm tên mạng của các trạm phát ẩn hoạt động trên cùng thiết bị với trạm phát chính.
- Công cụ dò tìm vị trí trạm phát: Theo dõi mức tín hiệu RSSI theo thời gian thực, khoảng cách ước tính tính bằng mét và tỷ lệ tiếp cận giúp người dùng xác định vị trí đặt thiết bị phát sóng.

### Chức Năng 2: Đồ Thị Phổ Tần Vô Tuyến
- Đồ thị phổ sóng OFDM: Hiển thị dạng công suất tín hiệu của từng trạm phát trên các băng tần 2.4 GHz và 5 GHz theo kênh trung tâm và độ rộng kênh.
- Đồ thị biến thiên mức tín hiệu theo thời gian (RSSI History) giúp theo dõi độ ổn định của tín hiệu.
- Đồ thị phổ tần theo thời gian (Spectrogram) giúp ghi lại biên độ tín hiệu theo trục thời gian để phát hiện sóng phát ngắt quãng.
- Phân tích hiện tượng nhiễu sóng:
  - Nhận diện nhiễu kênh kề, trạm phát sử dụng độ rộng 40 MHz trên băng tần 2.4 GHz và cảnh báo các kênh radar DFS (kênh 52 đến 144).
  - Theo dõi tỷ lệ thời gian chiếm dụng kênh và tỷ lệ gửi lại gói tin.

### Chức Năng 3: Tối Ưu Hóa Kênh Và Chẩn Đoán Sự Cố Oscium
- Chấm điểm và đề xuất kênh phát:
  - Đánh giá các kênh trên 3 băng tần: 2.4 GHz, 5 GHz và 6 GHz.
  - Đề xuất kênh ít bị trùng lặp: kênh 1, 6 hoặc 11 trên 2.4 GHz; khối kênh 80 MHz ít nhiễu trên 5 GHz; kênh ưu tiên quét (PSC) trên 6 GHz.
- Bảng điều khiển chẩn đoán sự cố gồm 6 thẻ thông tin:
  1. Điểm đánh giá kết nối: Chấm điểm trên thang từ 0 - 100.
  2. Thông số card mạng đang kết nối: Giao diện mạng, tên mạng đang kết nối, địa chỉ MAC trạm phát, kênh, băng tần, tốc độ truyền và nhận dữ liệu (Rx/Tx Rate).
  3. Kiểm tra độ trễ 3 chặng mạng: Độ trễ đến cổng bộ định tuyến nội bộ, độ trễ đến máy chủ internet và độ trễ phân giải tên miền DNS.
  4. Bảng kiểm 6 tiêu chuẩn kỹ thuật: Mức tín hiệu sóng, độ trùng lặp kênh, nguồn nhiễu không phải Wi-Fi, thời gian chiếm kênh, khả năng chuyển vùng và chuẩn mã hóa.
  5. Nhận diện 4 nguồn phát nhiễu không phải Wi-Fi: Lò vi sóng (2.45 GHz), thiết bị Bluetooth, camera không dây analog và radar DFS.
  6. Hướng dẫn khắc phục sự cố: Tổng hợp lỗi kỹ thuật và đưa ra các bước xử lý cụ thể.

### Chức Năng 4: Đánh Giá Chất Lượng Cuộc Gọi Thoại VoWiFi 
- Tính toán thông số truyền âm thanh qua mạng không dây theo mô hình ITU-T G.107 E-Model.
- Đo lường các chỉ số kỹ thuật: Độ trễ khứ hồi (RTT Latency tính bằng ms), độ biến thiên trễ (Jitter tính bằng ms), tỷ lệ mất gói tin (%) và quy đổi sang điểm MOS (từ 1.0 đến 4.5).
- Đánh giá khả năng đáp ứng của mạng với 3 bộ mã hóa giọng nói: Opus HD Voice, G.711 PCM và G.729.
- Kiểm tra độ trễ phân tách theo từng chặng:
  - Chặng 1: Độ trễ từ máy tính đến địa chỉ cổng mặc định của bộ định tuyến (Default Gateway IP).
  - Chặng 2: Độ trễ từ máy tính ra máy chủ internet ngoài.
  - Chặng 3: Thời gian phản hồi truy vấn của máy chủ tên miền DNS.

### Chức Năng 5: Bản Đồ Nhiệt Vùng Phủ Sóng 

#### Công Cụ 1: Mô Phỏng Tán Xạ Tia Sóng 
- Mô phỏng dò tia 180 hướng: Từ mỗi Access Point, hệ thống phát ra 180 tia quét xung quanh góc 360 độ, tính toán giao điểm hình học với từng đoạn tường chắn và tính độ suy hao truyền sóng theo khoảng cách và vật liệu cản sóng.
- Hỗ trợ 7 loại vật liệu tường cản sóng thực tế:
  1. Vách thạch cao / Vách ngăn nhẹ: Suy hao 2.0 dB.
  2. Tường gạch tiêu chuẩn: Suy hao 4.0 dB.
  3. Tường bê tông cốt thép dày: Suy hao 12.0 dB.
  4. Cửa sổ kính thường: Suy hao 2.0 dB.
  5. Cửa gỗ thông phòng: Suy hao 3.0 dB.
  6. Cửa kim loại / Cửa thép: Suy hao 15.0 dB.
  7. Cửa kính cường lực: Suy hao 2.5 dB.
- Tự động khoét lỗ cửa trên tường: Khi đặt cửa lên bức tường đã vẽ, hệ thống tự động nhận diện và loại bỏ đoạn tường trùng lặp để mức suy hao tại vị trí cửa phản ánh đúng vật liệu cửa.
- Mô phỏng thiết bị người dùng (Laptop, PC) và phân tích đường truyền: Cho phép đặt thiết bị máy tính trên sơ đồ, tự động nối tia đến trạm phát tín hiệu tốt nhất, tính toán mức tín hiệu thu (dBm), số lượng bức tường chắn giữa đường và mức suy hao của từng bức tường.
- Đo tín hiệu từ card Wi-Fi thực tế: Nút nạp card Wi-Fi kết nối với API /api/scan để đo cường độ tín hiệu thực tế của card mạng máy tính và hiển thị đối chiếu với kết quả mô phỏng.

#### Công Cụ 2: Mô Phỏng Lưới Phủ Sóng Và Tiêu Chuẩn Nghiệm Thu SLA
- Thuật toán nội suy song tuyến tính (Bilinear Interpolation): Tính toán ma trận điểm trên canvas để tạo dải màu chuyển tiếp 5 mức tín hiệu từ trên -50 dBm đến dưới -85 dBm.
- 5 chế độ hiển thị bản đồ nhiệt:
  1. Cường độ sóng chính: Mức tín hiệu mạnh nhất thu được tại mỗi tọa độ.
  2. Cường độ sóng phụ cho chuyển vùng: Mức tín hiệu của trạm phát mạnh thứ hai, đánh giá điều kiện chuyển vùng khi di chuyển.
  3. Tỷ số tín hiệu trên nhiễu (SNR): Đánh giá mức độ sạch của kênh truyền.
  4. Mức độ trùng kênh: Số lượng trạm phát phát sóng trùng kênh hoặc lấn kênh lên cùng một khu vực.
  5. Tốc độ dữ liệu ước tính: Dự báo tốc độ truyền dữ liệu vật lý và số lượng thiết bị đáp ứng đồng thời.
- Thanh trượt đặt ngưỡng tiêu chuẩn SLA (từ -85 dBm đến -50 dBm): Tự động vẽ đường kẻ sọc cảnh báo và làm mờ các khu vực không đạt yêu cầu kỹ thuật.
- Bảng thuộc tính trạm phát: Cho phép tùy chỉnh tên trạm, kênh phát trên 3 băng tần (2.4 GHz, 5 GHz, 6 GHz), công suất phát (14, 17, 20, 23 dBm) và độ lợi anten bức xạ.
- Hiệu chuẩn tỷ lệ khoảng cách: Thước đo 2 điểm trên bản vẽ để quy đổi tỷ lệ pixel sang mét thực tế.
- Nạp ảnh mặt bằng kiến trúc: Cho phép tải lên tập tin ảnh (PNG, JPG) làm nền sơ đồ với thanh trượt chỉnh độ mờ.

### Chức Năng 6: Đo Tốc Độ Mạng Wi-Fi 
- Đo lường trực tiếp 4 thông số internet: Tốc độ tải về (Download), tốc độ tải lên (Upload), độ trễ mạng (Ping) và biến động trễ (Jitter).
- Kết nối trực tiếp đến mạng lưới máy chủ Anycast CDN của Cloudflare bằng thư viện httpx trên backend.
- Cung cấp hai chế độ đo: Chế độ nhanh (5 giây) và Chế độ đầy đủ (10 giây).
- Cập nhật tiến trình và thông số thời gian thực lên giao diện thông qua Server-Sent Events (SSE) tại địa chỉ /api/speedtest/stream.
- So sánh tốc độ internet thực tế với tốc độ liên kết vật lý của card mạng Wi-Fi để xác định điểm giới hạn băng thông là do nhà mạng hay do sóng không dây.
- Lưu lại lịch sử các lần đo để tiện theo dõi.

### Chức Năng 7: Kiểm Tra An Toàn Bảo Mật 
- Phát hiện các trạm phát không cài đặt mật khẩu mã hóa (mạng mở).
- Cảnh báo các trạm phát sử dụng giao thức bảo mật cũ (WEP hoặc WPA sử dụng thuật toán TKIP).
- Thống kê tỷ lệ sử dụng các chuẩn mã hóa: WPA2, WPA3, mạng không đặt mật khẩu.
- Phát hiện các trạm phát có cùng tên SSID nhưng khác địa chỉ MAC hoặc khác hãng sản xuất để cảnh báo nguy cơ trạm phát giả mạo.

### Chức Năng 8: Lưu Trữ Và Xuất Báo Cáo 
- Xuất báo cáo ra tập tin CSV theo chuẩn UTF-8 kèm BOM, mở trực tiếp trên Microsoft Excel
- Xuất báo cáo ra tập tin định dạng JSON.
- Format tập tin: NetScanner_Report_[MM-DD-YYYY]_[ID-01].csv và NetScanner_Report_[MM-DD-YYYY]_[ID-01].json.
- Nội dung báo cáo gồm 6 phần:
  1. Thông số môi trường và card mạng đang kết nối.
  2. Bảng phân tích kênh và khuyến nghị kênh phát.
  3. Kết quả kiểm tra sự cố mạng theo chuẩn Oscium.
  4. Kết quả đánh giá cuộc gọi thoại VoWiFi và độ trễ đa chặng.
  5. Kết quả kiểm tra an toàn bảo mật.
  6. Danh sách chi tiết toàn bộ các trạm phát BSSID thu thập được.
- Quản lý danh sách các tập tin báo cáo trong thư mục reports/, cho phép tải về máy tính hoặc xóa tập tin cũ trên giao diện web.

---

## 4. Cấu Trúc Thư Mục Phân Cấp Của Dự Án

├── api/                       # Tầng máy chủ web và các điểm cuối API
│   ├── __init__.py
│   └── server.py              # Máy chủ FastAPI, định tuyến REST API, WebSocket và SSE
├── core/                      # Tầng nghiệp vụ xử lý dữ liệu mạng vô tuyến
│   ├── __init__.py
│   ├── wifi_scanner.py        # Giao tiếp card mạng WLAN, quét sóng, nhóm phần cứng
│   ├── channel_analyzer.py    # Phân tích phổ tần, chấm điểm kênh và chẩn đoán Oscium
│   ├── vowifi_analyzer.py     # Đo trễ đa chặng và tính điểm chất lượng thoại ITU-T G.107 MOS
│   ├── ai_planner.py          # Mô phỏng suy hao sóng ITU-R P.1238 và tối ưu vị trí trạm phát
│   ├── speedtest_runner.py    # Đo tốc độ internet qua mạng lưới máy chủ Cloudflare CDN
│   └── report_generator.py    # Xuất báo cáo dữ liệu định dạng CSV và JSON
├── static/                    # User front-end
│   ├── index.html             # Cấu trúc HTML5 
│   ├── styles.css             # Định dạng giao diện 
│   ├── app.js                 # Xử lý tương tác, bảng dữ liệu và công cụ Ekahau Planner
│   └── heatmap.js             # Động cơ mô phỏng tán xạ tia sóng vô tuyến (Raytracing)
├── tests/                     # Các bộ kiểm thử tự động toàn diện
│   ├── __init__.py
│   ├── test_full_suite.py     # Kiểm thử toàn diện 9 phần chức năng
│   ├── test_challenger_mb_static.py   # Kiểm tra tính toàn vẹn giao diện nền sáng và từ ngữ
│   ├── test_challenger_mb_dynamic.py  # Kiểm tra logic tính toán và các thuật toán
│   ├── test_challenger_ma.py  # Kiểm thử tương thích môi trường và card mạng
│   ├── test_adversarial_m_a.py        # Kiểm thử biên và trường hợp dữ liệu bất thường
│   ├── test_repo_integrity_mc.py      # Kiểm tra toàn vẹn cấu trúc dự án
│   └── test_stress_e2e_mc.py  # Kiểm thử tải và luồng dữ liệu liên tục
├── docs/                      # Tài liệu kỹ thuật chi tiết
│   ├── PROJECT.md
│   └── TEST_INFRA.md
├── assets/                    # Tệp hình ảnh mẫu 
│   └── mau-ho-so-thiet-ke-kien-truc2-566x400.webp
├── reports/                   # Thư mục lưu trữ các tệp báo cáo khảo sát đã xuất
├── requirements.txt           # Danh mục thư viện phụ thuộc Python
├── run.py                     # Điểm khởi chạy ứng dụng bằng lệnh Python
├── start.bat                  # Tập tin khởi động nhanh trên hệ điều hành Windows
├── README.md                  # Hướng dẫn tổng quan về dự án
└── PROJECT_OVERVIEW.md        # Báo cáo kỹ thuật chi tiết toàn bộ hệ thống



*Created as part of the NWC303 Course at Danang FPT University (Oct 2026).* 

