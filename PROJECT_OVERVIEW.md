# MMQ./WifiScanner - Tổng Quan Kiến Trúc Và Hướng Dẫn Kỹ Thuật (tool-NWC203)

Tài liệu mô tả kiến trúc kỹ thuật, luồng xử lý dữ liệu và hướng dẫn vận hành của hệ thống khảo sát sóng vô tuyến, đo lường thông số mạng Wi-Fi, phân tích phổ tần, mô phỏng bản đồ nhiệt suy hao sóng, đo tốc độ truyền dữ liệu internet và xuất báo cáo kỹ thuật. Tài liệu được viết bằng tiếng Việt chuyên ngành mạng máy tính, sử dụng câu văn trực tiếp theo nghĩa cơ bản, không sử dụng các từ ngữ ẩn dụ và không sử dụng các từ ngữ mang tính phóng đại.

---

## 1. Mục Tiêu Và Nguyên Tắc Thiết Kế

### 1.1. Giao Diện Nền Sáng (Light Mode)
- Hệ thống cố định ở chế độ nền sáng, không cung cấp chế độ nền tối và không có nút chuyển đổi giao diện nền tối.
- Màu sắc giao diện:
  - Nền trang web sử dụng màu xám nhạt: `#f8fafc`.
  - Nền các thẻ chứa nội dung sử dụng màu trắng: `#ffffff`.
  - Đường viền các thẻ và bảng dữ liệu sử dụng màu xám sáng: `#e2e8f0`.
  - Văn bản chính sử dụng màu đen xám: `#0f172a`.
  - Văn bản phụ và chú thích sử dụng màu xám: `#64748b`.
  - Màu sắc chỉ thị trạng thái: màu xanh lá `#059669` cho trạng thái tốt, màu vàng cam `#d97706` cho mức trung bình, màu đỏ `#dc2626` cho mức cảnh báo hoặc sóng yếu, màu xanh dương `#0284c7` cho thông tin nổi bật.
- Không sử dụng biểu tượng cảm xúc (emoji) và không sử dụng các bộ biểu tượng đồ họa trang trí trong giao diện và văn bản.

### 1.2. Ngôn Ngữ Chuyên Ngành Mạng Máy Tính
- Toàn bộ nhãn, thông báo và tài liệu sử dụng tiếng Việt chuyên ngành mạng máy tính.
- Các thuật ngữ kỹ thuật được sử dụng đúng nghĩa đen: trạm phát sóng, địa chỉ MAC, cường độ tín hiệu nhận RSSI, tỷ số tín hiệu trên nhiễu SNR, mức nền nhiễu, độ rộng kênh, điều chế biên độ xung vuông QAM, chỉ số điều chế và mã hóa MCS, độ trễ khứ hồi RTT, biến động trễ Jitter, tỷ lệ mất gói tin, điểm chất lượng thoại MOS.
- Không dùng từ ngữ ẩn dụ và không đặt các từ ẩn dụ trong dấu ngoặc kép.

### 1.3. Hệ Thống 8 Chức Năng
Hệ thống gồm 8 thẻ chức năng chính:
1. Khảo sát sóng (Survey): Quét trạm phát sóng và nhóm phần cứng thiết bị.
2. Phổ tần vô tuyến (Spectrum): Đồ thị phổ công suất và phân tích nhiễu kênh.
3. Tối ưu hóa và chẩn đoán (Optimizer): Đề xuất kênh phát và khối kiểm tra sự cố Oscium.
4. Chất lượng cuộc gọi thoại (VoWiFi): Đo độ trễ ba chặng và tính điểm chất lượng thoại MOS theo chuẩn ITU-T G.107.
5. Bản đồ nhiệt sóng (Planner & Heatmap): Mô phỏng suy hao sóng theo giải thuật dò tia (Raytracing) và mô phỏng lưới số hóa chuẩn Ekahau/Acrylic.
6. Đo tốc độ mạng (Speed Test): Đo tốc độ tải về, tải lên, độ trễ và biến động trễ qua Cloudflare Anycast CDN.
7. Kiểm tra an toàn bảo mật (Security Audit): Quét trạm phát không đặt mật khẩu và phát hiện trạm phát có dấu hiệu bất thường.
8. Lưu trữ báo cáo (Reports): Xuất dữ liệu ra tập tin CSV (mã hóa UTF-8 có BOM) và tập tin JSON.

---

## 2. Kiến Trúc Kỹ Thuật Và Luồng Dữ Liệu

### 2.1. Sơ Đồ Kiến Trúc

```
[Trình Duyệt Người Dùng (HTML5, CSS3 Light Mode, JavaScript ES6+, HTML5 Canvas)]
                               │
        ┌───────────────────────┼────────────────────────┐
        ▼                       ▼                        ▼
   REST APIs             Server-Sent Events (SSE)    WebSocket (/ws/live)
   (/api/*)              (/api/stream/live,          (Dữ liệu quét sóng
                         /api/speedtest/stream)       thời gian thực)
        │                       │                        │
        └───────────────────────┼────────────────────────┘
                                ▼
         [Máy Chủ Dịch Vụ FastAPI / Uvicorn (server.py)]
                                │
  ┌─────────────────┬───────────┴───────────┬─────────────────┐
  │                 │                       │                 │
  ▼                 ▼                       ▼                 ▼
[Mô-đun Quét]     [Mô-đun Phổ Tần &]     [Mô-đun Đo Tốc Độ] [Mô-đun Bản Đồ Nhiệt]
wifi_scanner.py   Oscium Chẩn Đoán]      speedtest_runner.py  ai_planner.py &
                  channel_analyzer.py                         heatmap.js
  │                 │                       │                 │
  │                 ▼                       │                 ▼
  │               [Mô-đun VoWiFi MOS]       │               [Mô-đun Xuất Báo Cáo]
  │                vowifi_analyzer.py       │                report_generator.py
  ▼
[Card Mạng WLAN]
(wlanapi.dll & netsh wlan)
```

### 2.2. Các Thành Phần Xử Lý Backend

1. `server.py`:
   - Máy chủ ứng dụng viết bằng framework FastAPI chạy trên nền máy chủ ASGI Uvicorn tại cổng 8000.
   - Cung cấp các điểm cuối REST API cho toàn bộ các chức năng.
   - Quản lý luồng quét sóng chạy ngầm trong một luồng riêng biệt, chu kỳ cập nhật dữ liệu từ 2 đến 3 giây một lần.
   - Phát dữ liệu thời gian thực tới trình duyệt qua Server-Sent Events và WebSocket.

2. `wifi_scanner.py`:
   - Giao tiếp trực tiếp với card mạng không dây của máy tính Windows thông qua thư viện `ctypes` gọi hàm trong `wlanapi.dll`.
   - Sử dụng lệnh hệ thống `netsh wlan show networks mode=bssid` và `netsh wlan show interfaces` làm kênh thu thập dữ liệu dự phòng.
   - Trích xuất các trường thông tin: SSID, BSSID, RSSI (dBm), phần trăm sóng, băng tần, kênh phát, chuẩn 802.11, kiểu mã hóa bảo mật, tốc độ lý thuyết Rx/Tx, thông tin BSS Load.
   - Thực hiện thuật toán nhóm phần cứng: so sánh tiền tố 5 octet đầu của địa chỉ MAC để xác định các BSSID phát ra từ cùng một bo mạch phần cứng.
   - Thực hiện đối chiếu địa chỉ MAC để giải mã tên mạng của các BSSID ẩn phát chung thiết bị với mạng chính.

3. `channel_analyzer.py`:
   - Phân tích hiện tượng trùng kênh (Co-Channel Interference) và lấn kênh kề (Adjacent Channel Interference).
   - Chấm điểm chất lượng các kênh trên 3 băng tần: 2.4 GHz, 5 GHz và 6 GHz theo công thức trừ điểm phạt dựa trên mức tín hiệu của các trạm phát lân cận.
   - Tạo cấu trúc dữ liệu cho khối chẩn đoán sự cố Oscium: đánh giá card mạng đang kết nối, kiểm tra 6 tiêu chuẩn kỹ thuật, phát hiện chữ ký của 4 nguồn phát xạ không phải Wi-Fi.

4. `vowifi_analyzer.py`:
   - Thực hiện kiểm tra độ trễ đa chặng bằng lệnh ping hệ thống: chặng máy tính đến địa chỉ cổng bộ định tuyến (Default Gateway), chặng đến máy chủ internet (8.8.8.8, 1.1.1.1) và thời gian truy vấn máy chủ tên miền DNS.
   - Tính toán chỉ số chất lượng truyền giọng nói theo mô hình ITU-T G.107 E-Model: tính hệ số suy giảm trễ Id, hệ số suy giảm mất gói Ie-eff, hệ số truyền dẫn R và quy đổi sang điểm đánh giá trung bình MOS từ 1.0 đến 4.5.

5. `ai_planner.py`:
   - Mô phỏng suy hao sóng theo mô hình Log-Distance Path Loss kết hợp khuyến nghị ITU-R P.1238 cho môi trường trong nhà.
   - Tính toán cường độ tín hiệu tại từng tọa độ trên lưới mặt bằng kiến trúc.
   - Cung cấp giải thuật đề xuất vị trí đặt trạm phát sóng để phủ sóng diện tích mặt bằng theo tiêu chuẩn SLA yêu cầu.

6. `speedtest_runner.py`:
   - Đo tốc độ internet bằng thư viện `httpx` bất đồng bộ kết nối đến mạng lưới máy chủ Anycast CDN của Cloudflare.
   - Thực hiện 4 phép đo tuần tự: đo độ trễ gói tin (Ping Latency), đo biến động trễ (Jitter), đo tốc độ tải về (Download Throughput) và đo tốc độ tải lên (Upload Throughput).
   - Cung cấp luồng dữ liệu Server-Sent Events tại `/api/speedtest/stream` để cập nhật tiến trình đo lên giao diện người dùng theo chu kỳ 100 mili-giây.

7. `report_generator.py`:
   - Tập hợp toàn bộ dữ liệu khảo sát, phân tích phổ, chẩn đoán sự cố, chất lượng thoại và danh sách trạm phát.
   - Xuất dữ liệu ra tập tin CSV mã hóa UTF-8 có kèm BOM để hiển thị đúng dấu tiếng Việt trên Microsoft Excel.
   - Xuất dữ liệu ra tập tin JSON có cấu trúc đầy đủ.
   - Lưu trữ tập tin trong thư mục `reports/` theo quy tắc đặt tên có ngày tháng và mã số thứ tự.

---

## 3. Chi Tiết Kỹ Thuật 8 Thẻ Chức Năng

### 3.1. Thẻ 1: Khảo Sát Sóng (Survey)
- Bảng danh sách hiển thị toàn bộ các trạm phát sóng trong tầm thu của card mạng.
- Các cột dữ liệu:
  - Trạng thái kết nối: hiển thị nhãn màu xanh lá đối với mạng đang kết nối.
  - Tên mạng (SSID): hiển thị tên mạng, nhãn mạng ẩn nếu trạm phát không phát tên, và tên mạng tìm được nếu đối chiếu thành công.
  - Nhãn cụm phần cứng (`.badge-cluster`): hiển thị nhãn màu xanh lam nhạt nền sáng đối với các trạm phát thuộc cùng một thiết bị phần cứng đa băng tần.
  - Địa chỉ vật lý (BSSID): định dạng chuỗi 6 cặp ký tự thập lục phân.
  - Hãng sản xuất phần cứng: tra cứu từ cơ sở dữ liệu IEEE OUI.
  - Mức tín hiệu và SNR: hiển thị thanh mức sóng, giá trị dBm, phần trăm sóng, giá trị SNR (dB) và mức nền nhiễu ước tính (dBm).
  - Kênh phát và độ rộng kênh: số kênh phát, độ rộng dải tần (20, 40, 80, 160 MHz) và nhãn cảnh báo nếu kênh thuộc dải radar DFS.
  - Băng tần: 2.4 GHz, 5 GHz hoặc 6 GHz.
  - Chuẩn mạng và điều chế: chuẩn 802.11n/ac/ax/be, chỉ số MCS và dạng điều chế.
  - Kiểu bảo mật: WPA2, WPA3, WEP hoặc mạng không đặt mật khẩu.
  - Tốc độ lý thuyết và tải kênh: tốc độ tối đa theo cấu hình sóng và tỷ lệ sử dụng kênh từ BSS Load.
- Khối gom cụm phần cứng: bảng tổng hợp gom các BSSID thuộc cùng một bộ phát vật lý thành từng nhóm, hiển thị tên thiết bị, địa chỉ MAC gốc, số lượng BSSID con và danh sách các kênh đang phát đồng thời.
- Công cụ dò tìm vị trí trạm phát (Device Finder): khóa mục tiêu vào một địa chỉ BSSID cụ thể, hiển thị cường độ sóng tức thời, mức sóng lớn nhất thu được, khoảng cách ước tính tính bằng mét và thước đo tỷ lệ tiếp cận từ 0 đến 100%.

### 3.2. Thẻ 2: Phổ Tần Vô Tuyến (Spectrum)
- Đồ thị phổ công suất sóng vô tuyến:
  - Băng tần 2.4 GHz: hiển thị dải tần từ 2400 MHz đến 2500 MHz, vẽ dạng hình chuông công suất của từng trạm phát trên các kênh từ 1 đến 14.
  - Băng tần 5 GHz: hiển thị dải tần từ 5150 MHz đến 5850 MHz, vẽ dạng hình khối công suất tương ứng với độ rộng 20, 40, 80 hoặc 160 MHz.
- Đồ thị lịch sử mức tín hiệu (RSSI History): ghi lại đồ thị biến thiên mức tín hiệu (dBm) của 5 trạm phát mạnh nhất theo trục thời gian.
- Đồ thị phổ tần theo thời gian (Spectrogram Waterfall): thể hiện mật độ công suất sóng theo trục thời gian, giúp nhận diện các trạm phát ngắt quãng hoặc hiện tượng chiếm dụng kênh bất thường.
- Phân loại hiện tượng nhiễu:
  - Nhiễu kênh kề (Adjacent Channel Interference): đếm số lượng trạm phát nằm ở các kênh lân cận không cách nhau đủ 5 kênh trên băng tần 2.4 GHz.
  - Trạm phát sử dụng độ rộng 40 MHz trên băng tần 2.4 GHz: cảnh báo chiếm dụng dải tần gây ảnh hưởng đến các trạm xung quanh.
  - Kênh radar quân sự và thời tiết (DFS): kiểm tra các trạm phát đang hoạt động trên dải tần UNII-2A và UNII-2C (kênh 52 đến 144).

### 3.3. Thẻ 3: Tối Ưu Hóa Kênh Và Chẩn Đoán Oscium (Optimizer)
- Khuyến nghị cấu hình kênh:
  - Băng tần 2.4 GHz: phân tích và chọn kênh sạch nhất trong 3 kênh không chồng lấn (kênh 1, 6 hoặc 11).
  - Băng tần 5 GHz: phân tích và chọn khối kênh 80 MHz có tổng mức can nhiễu thấp nhất.
  - Băng tần 6 GHz: phân tích các kênh ưu tiên quét (Preferred Scanning Channels - PSC).
- Bảng điều khiển chẩn đoán sự cố tập trung theo chuẩn Oscium gồm 6 khối thẻ:
  1. Thẻ Điểm đánh giá chất lượng kết nối: hiển thị số điểm từ 0 đến 100 dựa trên mức tín hiệu, tỷ số SNR, tỷ lệ gửi lại gói tin và mức can nhiễu.
  2. Thẻ Thông số card mạng kết nối: hiển thị tên giao diện card mạng, tên mạng đang kết nối, địa chỉ MAC trạm phát, kênh tần số, băng tần, tốc độ nhận dữ liệu (Rx), tốc độ gửi dữ liệu (Tx), mức đối xứng thu phát và đánh giá mức độ đáp ứng tín hiệu.
  3. Thẻ Đo độ trễ ba chặng mạng: hiển thị độ trễ chặng 1 đến bộ định tuyến, chặng 2 ra máy chủ internet và chặng 3 phân giải tên miền DNS.
  4. Thẻ Bảng kiểm 6 tiêu chuẩn kỹ thuật: kiểm tra cường độ tín hiệu sóng chính, mức độ can nhiễu kênh kề, nguồn phát xạ không phải Wi-Fi, tỷ lệ thời gian chiếm kênh, điều kiện chuyển vùng và chuẩn an toàn mã hóa.
  5. Thẻ Chữ ký nhiễu không phải Wi-Fi: kiểm tra và cảnh báo 4 dạng nguồn phát: lò vi sóng (2.45 GHz), tai nghe/chuột Bluetooth, camera giám sát không dây analog và sóng radar DFS.
  6. Thẻ Hướng dẫn xử lý sự cố: tổng hợp nguyên nhân lỗi kỹ thuật chính và liệt kê danh sách các bước xử lý bằng tiếng Việt để quản trị viên mạng khắc phục.

### 3.4. Thẻ 4: Chất Lượng Cuộc Gọi Thoại VoWiFi (VoWiFi)
- Đo kiểm chất lượng truyền âm thanh qua mạng Wi-Fi theo mô hình ITU-T G.107 E-Model:
  - Độ trễ khứ hồi RTT (ms): đo thời gian gói tin di chuyển giữa máy tính và máy chủ.
  - Biến động trễ Jitter (ms): đo mức độ chênh lệch thời gian đến của các gói tin liên tiếp.
  - Tỷ lệ mất gói tin (%): đo tỷ lệ phần trăm số gói tin không nhận được phản hồi.
  - Hệ số chất lượng đường truyền R-factor: tính theo công thức chuẩn viễn thông và quy đổi sang điểm MOS từ 1.0 đến 4.5.
- Đánh giá mức độ đáp ứng của mạng đối với 3 bộ mã hóa âm thanh:
  - Opus HD Voice: yêu cầu độ trễ dưới 50 ms, mất gói dưới 1%.
  - G.711 PCM: yêu cầu độ trễ dưới 100 ms, mất gói dưới 2%.
  - G.729: yêu cầu độ trễ dưới 150 ms, mất gói dưới 3%.
- Kiểm tra phân tách từng chặng giúp kỹ sư mạng xác định vị trí phát sinh độ trễ cao là do kết nối Wi-Fi nội bộ, do đường truyền của nhà cung cấp dịch vụ internet hay do máy chủ DNS.

### 3.5. Thẻ 5: Bản Đồ Nhiệt Vùng Phủ Sóng (Planner & Heatmap)
Hệ thống cung cấp hai công cụ mô phỏng sóng không dây, chuyển đổi linh hoạt bằng nút bấm trên giao diện:

#### Động Cơ 1: Bản Đồ Nhiệt Dò Tia Tán Xạ (Raytracing)
- Mô hình dò tia 180 hướng:
  - Từ mỗi vị trí trạm phát sóng (Access Point), hệ thống tính toán 180 tia quét xung quanh 360 độ (mỗi tia cách nhau 2 độ).
  - Từng tia sóng tự động tính toán giao cắt hình học với các bức tường, tính tích lũy suy hao truyền sóng trong không gian tự do (FSPL) theo tần số kết hợp hệ số suy hao của từng loại vật liệu mà tia xuyên qua.
  - Kết xuất vùng phủ sóng đa giác bán trong suốt trên mặt bằng.
- 7 Loại vật liệu tường cản sóng tiêu chuẩn:
  1. Vách thạch cao / Vách ngăn nhẹ: Suy hao 2.0 dB.
  2. Tường gạch tiêu chuẩn: Suy hao 4.0 dB.
  3. Tường bê tông cốt thép dày: Suy hao 12.0 dB.
  4. Cửa sổ kính thường: Suy hao 2.0 dB.
  5. Cửa gỗ thông phòng: Suy hao 3.0 dB.
  6. Cửa kim loại / Cửa thép: Suy hao 15.0 dB.
  7. Cửa kính cường lực: Suy hao 2.5 dB.
- Tự động khoét lỗ cửa tường: Khi đặt cửa lên bức tường đã vẽ, thuật toán tự động nhận diện và cắt bỏ đoạn tường trùng lặp để mức suy hao tại vị trí cánh cửa phản ánh đúng vật liệu cửa mà không bị cộng dồn hai lần.
- Mô phỏng thiết bị máy trạm (Laptop, PC) và phân tích đường truyền:
  - Cho phép đặt các thiết bị máy tính người dùng tại bất kỳ vị trí nào trên sơ đồ mặt bằng.
  - Tự động dò tìm trạm phát có mức tín hiệu mạnh nhất đến thiết bị, vẽ tia liên kết trực tiếp, tính toán cường độ sóng thu được (dBm), số bức tường chắn giữa đường và hiển thị mức suy hao của từng bức tường.
- Hiệu chuẩn tín hiệu card Wi-Fi thực tế: Nút bấm kết nối với điểm cuối API `/api/scan` để đo cường độ tín hiệu thực tế của card mạng máy tính và gắn nhãn đối chiếu trực tiếp với mô hình mô phỏng.

#### Động Cơ 2: Bản Đồ Nhiệt Lưới Số Hóa Chuẩn Ekahau Và Acrylic
- Thuật toán làm mượt nội suy song tuyến tính (Bilinear Interpolation):
  - Xử lý ma trận dữ liệu qua canvas phụ trước khi hiển thị, tạo ra dải màu biến thiên liên tục 5 mức tín hiệu từ trên -50 dBm đến dưới -85 dBm.
- 5 Chế độ hiển thị bản đồ nhiệt:
  1. Cường độ sóng chính: Mức tín hiệu lớn nhất thu được tại mỗi vị trí trên mặt bằng.
  2. Cường độ sóng phụ cho chuyển vùng: Mức tín hiệu của trạm phát mạnh thứ hai, đánh giá điều kiện duy trì kết nối khi thiết bị di chuyển.
  3. Tỷ số tín hiệu trên nhiễu (SNR): Phân bố tỷ số SNR đánh giá chất lượng truyền dẫn.
  4. Mức độ trùng kênh: Đếm số lượng trạm phát cùng kênh hoặc đè kênh chiếu vào cùng một vị trí.
  5. Tốc độ dữ liệu ước tính: Dự báo tốc độ truyền dữ liệu vật lý và số lượng thiết bị có thể phục vụ đồng thời.
- Thanh trượt đặt ngưỡng tiêu chuẩn SLA (-85 dBm đến -50 dBm): Tự động vẽ hoa văn kẻ sọc cảnh báo và che mờ các khu vực có mức tín hiệu không đạt ngưỡng yêu cầu.
- Bảng thuộc tính trạm phát: Cho phép nhấp chọn từng trạm phát trên bản vẽ để chỉnh sửa tên trạm, kênh phát độc lập trên 3 băng tần (2.4 GHz, 5 GHz, 6 GHz), công suất phát sóng Tx Power (14, 17, 20, 23 dBm) và độ lợi anten bức xạ.
- Công cụ hiệu chuẩn khoảng cách thực tế: Thước đo hai điểm mốc trên bản vẽ, cho phép người dùng nhập khoảng cách thực tế tính bằng mét để quy đổi tỷ lệ pixel sang kích thước thực địa.
- Nạp ảnh mặt bằng kiến trúc: Tải tập tin hình ảnh mặt bằng (PNG, JPG) làm nền với thanh trượt chỉnh độ mờ linh hoạt.

### 3.6. Thẻ 6: Đo Tốc Độ Mạng Wi-Fi (Speed Test)
- Đo trực tiếp các thông số kết nối internet: Tốc độ tải về (Download), tốc độ tải lên (Upload), độ trễ (Ping) và biến động trễ (Jitter).
- Phương thức kết nối: Sử dụng thư viện `httpx` trên máy chủ backend kết nối với hạ tầng mạng phân phối nội dung Anycast CDN của Cloudflare.
- Hai chế độ đo:
  - Chế độ nhanh (Quick Mode): Thời gian đo 5 giây, sử dụng dung lượng mẫu vừa phải để kiểm tra nhanh.
  - Chế độ đầy đủ (Full Mode): Thời gian đo 10 giây, truyền dữ liệu qua nhiều luồng song song với dung lượng lớn để kiểm tra băng thông tối đa của đường truyền.
- Cập nhật tiến trình liên tục qua luồng dữ liệu Server-Sent Events (SSE) tại `/api/speedtest/stream`, hiển thị trực quan đồng hồ đo và thanh tiến trình theo thời gian thực.
- So sánh tốc độ internet thực tế với tốc độ liên kết vật lý của card mạng Wi-Fi (PHY Rate), tính toán tỷ lệ khai thác băng thông và xác định giới hạn tốc độ là do nhà mạng hay do kết nối không dây.
- Bảng lưu trữ lịch sử các phiên đo kèm thời gian, chế độ, thông số đo và kết luận chẩn đoán.

### 3.7. Thẻ 7: Kiểm Tra An Toàn Bảo Mật (Security Audit)
- Quét và phát hiện các trạm phát không cài đặt mật khẩu mã hóa (mạng mở).
- Cảnh báo các trạm phát sử dụng giao thức bảo mật cũ (WEP, WPA sử dụng thuật toán TKIP).
- Thống kê tỷ lệ phân bổ các chuẩn bảo mật: WPA2-Personal, WPA3-Personal, WPA2/WPA3-Enterprise và mạng mở.
- Phát hiện các trạm phát có cùng tên SSID nhưng khác địa chỉ MAC hoặc khác nhà sản xuất phần cứng để cảnh báo nguy cơ trạm phát giả mạo.
- Bảng danh sách cảnh báo phân loại theo mức độ nghiêm trọng (Thông tin, Cảnh báo, Nguy hiểm) kèm hướng dẫn xử lý cụ thể bằng tiếng Việt.

### 3.8. Thẻ 8: Lưu Trữ Và Xuất Báo Cáo (Reports)
- Xuất dữ liệu khảo sát ra tập tin bảng tính CSV mã hóa UTF-8 có kèm BOM, hiển thị đúng dấu tiếng Việt trên Microsoft Excel.
- Xuất dữ liệu ra tập tin JSON có cấu trúc đầy đủ phục vụ phân tích tự động.
- Quy chuẩn đặt tên tập tin: `NetScanner_Report_[MM-DD-YYYY]_[ID-01].csv` và `.json`.
- Nội dung báo cáo gồm 6 phần:
  1. Tổng quan môi trường và thông số card mạng kết nối.
  2. Bảng khuyến nghị cấu hình kênh và phân tích phổ tần 3 băng tần.
  3. Bảng kiểm tra chất lượng kết nối và chẩn đoán sự cố Oscium.
  4. Đánh giá chất lượng thoại VoWiFi và phân tách độ trễ ba chặng.
  5. Báo cáo kiểm tra an toàn bảo mật và cảnh báo rủi ro.
  6. Bảng kê chi tiết từng trạm phát BSSID thu thập được trong khu vực.
- Quản lý danh sách các tập tin báo cáo trong thư mục `reports/`, hỗ trợ tải về máy tính hoặc xóa tập tin cũ trên giao diện web.

---

## 4. Danh Mục Điểm Cuối REST API

### 4.1. Nhóm API Quét Sóng Và Dữ Liệu Thiết Bị
- `GET /api/scan`: Trả về danh sách trạm phát sóng BSSID, thông tin card mạng đang kết nối, các nhóm phần cứng vật lý và cảnh báo bảo mật.
- `GET /api/stream/live`: Luồng Server-Sent Events truyền dữ liệu quét sóng liên tục tới trình duyệt.
- `GET /api/export/csv`: Xuất dữ liệu khảo sát hiện tại ra tập tin CSV mã hóa UTF-8 có BOM.
- `GET /api/export/json`: Xuất dữ liệu khảo sát hiện tại ra tập tin JSON.

### 4.2. Nhóm API Phổ Tần Và Chẩn Đoán Oscium
- `GET /api/channel/analysis`: Trả về dữ liệu phân tích phổ tần, hiện tượng trùng kênh và điểm số đánh giá các kênh trên 3 băng tần.
- `GET /api/troubleshooting/all-in-one`: Trả về bộ dữ liệu chẩn đoán sự cố tập trung theo chuẩn Oscium (điểm đánh giá kết nối, thông số card mạng, bảng kiểm 6 tiêu chuẩn, 4 chữ ký nhiễu không phải Wi-Fi và hướng dẫn xử lý).

### 4.3. Nhóm API Đo Tốc Độ Mạng (Speed Test)
- `POST /api/speedtest/start`: Bắt đầu phiên đo tốc độ mạng mới. Nhận tham số `{ "mode": "quick" | "full" }`.
- `GET /api/speedtest/status`: Trả về trạng thái hiện tại của phiên đo tốc độ, các chỉ số Ping, Jitter, Download, Upload và tốc độ liên kết card mạng.
- `POST /api/speedtest/stop`: Dừng phiên đo tốc độ đang chạy.
- `GET /api/speedtest/stream`: Luồng dữ liệu Server-Sent Events truyền tiến trình đo theo thời gian thực tới trình duyệt.

### 4.4. Nhóm API Chất Lượng Thoại VoWiFi
- `GET /api/vowifi/metrics`: Trả về các chỉ số độ trễ RTT, Jitter, tỷ lệ mất gói tin, điểm MOS và đánh giá theo 3 bộ mã hóa âm thanh.
- `GET /api/vowifi/diagnose`: Trả về kết quả đo độ trễ phân tách ba chặng (nội bộ, internet, DNS) và kết luận nguyên nhân lỗi.

### 4.5. Nhóm API Bản Đồ Nhiệt Vùng Phủ Sóng
- `POST /api/planner/simulate`: Tiếp nhận danh sách tường chắn, trạm phát sóng, băng tần và trả về ma trận mức sóng mô phỏng.
- `POST /api/planner/optimize`: Tiếp nhận mặt bằng kiến trúc và tính toán vị trí đặt trạm phát tối ưu để phủ sóng diện tích yêu cầu.

### 4.6. Nhóm API Quản Lý Báo Cáo
- `GET /api/reports/list`: Trả về danh sách các tập tin báo cáo đã lưu trong thư mục `reports/`.
- `GET /api/reports/download/{filename}`: Tải tập tin báo cáo về máy tính.
- `DELETE /api/reports/delete/{filename}`: Xóa tập tin báo cáo khỏi hệ thống.

---

## 5. Hướng Dẫn Vận Hành Và Kiểm Thử

### 5.1. Khởi Chạy Ứng Dụng
1. Chạy tập tin `start.bat` bằng cách nhấp đúp chuột trong Windows Explorer hoặc gõ lệnh trong CMD.
2. Tập tin `start.bat` sẽ kiểm tra phiên bản Python, cài đặt thư viện nếu chưa có, khởi động máy chủ FastAPI tại địa chỉ `http://localhost:8000` và tự động mở trình duyệt web mặc định của hệ thống.
3. Để dừng ứng dụng, nhấn tổ hợp phím `Ctrl + C` trong cửa sổ dòng lệnh.

### 5.2. Chạy Các Bộ Kiểm Thử Tự Động
- Bộ kiểm thử đầy đủ các chức năng:
  ```bash
  python test_full_suite.py
  ```
- Bộ kiểm thử tĩnh giao diện (kiểm tra không icon, không emoji, giao diện nền sáng):
  ```bash
  python test_challenger_mb_static.py
  ```
- Bộ kiểm thử động thuật toán và luồng dữ liệu (kiểm tra Speed Test, Oscium, công thức suy hao):
  ```bash
  python test_challenger_mb_dynamic.py
  ```
