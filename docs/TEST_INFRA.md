# E2E Test Infra: tool-NWC203

## Test Philosophy
- Opaque-box, requirement-driven. Xác thực trực tiếp các hành vi và kết quả quan sát được từ góc nhìn người dùng cuối và API người dùng.
- Phương pháp luận kết hợp: Phân vùng tương đương (Category-Partition), Phân tích giá trị biên (Boundary Value Analysis - BVA), Kiểm thử cặp đôi (Pairwise Combinatorial Testing), và Kịch bản đo kiểm thực tế (Real-World Workload Testing).

## Feature Inventory & Test Coverage
| # | Feature | Nguồn yêu cầu | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------|:------:|:------:|:------:|
| 1 | R1: Bản địa hóa 100% Tiếng Việt trên toàn bộ giao diện | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 2 | R1: Ngôn ngữ tối giản không biểu tượng (0 icon, 0 emoji) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 3 | R2: Loại bỏ Dark mode và thiết lập Light mode cố định | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 4 | R2: Chuẩn hóa bố cục UI/UX chuyên nghiệp | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 5 | R3: Làm mượt đồ họa Bản đồ nhiệt Wi-Fi và dải màu đa bậc | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 6 | R3: Bảng thuộc tính AP và nạp ảnh mặt bằng kiến trúc | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 7 | R4: Tích hợp thông số Card mạng vào chẩn đoán Oscium | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 8 | R4: Chẩn đoán nguyên nhân gốc rễ và hướng dẫn từng bước | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 9 | R5: Đo tốc độ Download, Upload, Ping/Latency thực tế | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |
| 10 | R5: API đo tốc độ và đối sánh với tốc độ liên kết Wi-Fi | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |
| 11 | R6: Cập nhật đồng bộ tài liệu PROJECT_OVERVIEW và README | ORIGINAL_REQUEST §R6 | 5 | 5 | ✓ |

## Test Architecture
- **Test Runner chính**: `python test_full_suite.py`
- **Môi trường**: Windows PowerShell / Python 3.14.
- **Tiêu chuẩn đạt**: Exit code = 0, toàn bộ các khẳng định (`assert`) vượt qua, thông báo `ALL VERIFICATIONS PASSED SUCCESSFULLY!`.
- **Cấu trúc bộ kiểm thử mở rộng**:
  - Phần 1: Kiểm thử vô tuyến vật lý (Noise Floor, SNR, MCS index, OUI resolution).
  - Phần 2: Phân tích phổ kênh 2.4/5/6 GHz và Chẩn đoán sự cố Oscium (Checklist 6 điểm, 4 chữ ký nhiễu phi Wi-Fi, Adapter Diagnostics, Automated Root Cause).
  - Phần 3: Bản đồ nhiệt 5 lớp Ekahau (Lưới ma trận 2D, suy hao 3 băng tần, làm mượt đồ họa).
  - Phần 4: Đánh giá chất lượng VoWiFi và phân tích trễ DNS/Gateway đa chặng.
  - Phần 5: Kiểm thử API REST và SSE (FastAPI TestClient cho các endpoint hệ thống).
  - Phần 6: Kiểm thử Speed Test Backend & API (Đo đạc Cloudflare CDN, xử lý ngắt kết nối, User-Agent, chế độ nhanh mock mode).
  - Phần 7: Kiểm thử tự động ngôn ngữ tiếng Việt 100% (Quét Regex phát hiện 0 emoji, 0 Lucide icon, 0 chuỗi song ngữ tiếng Anh).
  - Phần 8: Kiểm thử tự động giao diện Light mode (Kiểm tra `:root` biến màu sáng, không có khối `[data-theme="light"]`, không có nền tối cứng).
  - Phần 9: Kiểm tra tính đồng bộ và đầy đủ của tài liệu `PROJECT_OVERVIEW.md` và `README.md`.

## Real-World Application Scenarios (Tier 4)
| # | Kịch bản thực tế | Tính năng kiểm thử | Độ phức tạp |
|---|------------------|-------------------|------------|
| 1 | Khởi động công cụ và nạp giao diện tiếng Việt Light mode không icon | F1, F2, F3, F4 | Cơ bản |
| 2 | Chạy đo kiểm tốc độ mạng Speed Test và so sánh với tốc độ liên kết card Wi-Fi | F9, F10 | Nâng cao |
| 3 | Khảo sát bản đồ nhiệt mặt bằng với ảnh nền và cấu hình công suất AP | F5, F6 | Nâng cao |
| 4 | Chẩn đoán sự cố mạng Wi-Fi yếu/nhiễu kênh theo phong cách Oscium | F7, F8 | Nâng cao |
| 5 | Xuất báo cáo tổng hợp môi trường sóng và kiểm tra tính toàn vẹn tài liệu | F11 | Toàn diện |

## Coverage Thresholds
- Tier 1: Tối thiểu 5 ca kiểm thử cho từng tính năng độc lập.
- Tier 2: Tối thiểu 5 ca kiểm thử biên và trường hợp ngoại lệ.
- Tier 3: Kiểm thử tương tác chéo giữa các module (Speed Test + Card mạng, Heatmap + Phân tích kênh).
- Tier 4: Tối thiểu 5 kịch bản ứng dụng hoàn chỉnh từ đầu đến cuối.
