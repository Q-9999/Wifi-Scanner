// MMQ./NetScanner Localhost - Wi-Fi Scanner, Spectrum & Floorplan Client
document.addEventListener("DOMContentLoaded", () => {
    // Application State
    const state = {
        networks: [],
        clusters: [],
        threats: null,
        surveyView: "list", // "list" | "cluster"
        analysis: null,
        interface: null,
        signalHistory: {},
        waterfallHistory: [], // Rolling buffer of channel energy rows for Spectrogram Waterfall
        scanCount: 0,
        filterBand: "all",
        filterSecurity: "all",
        filterQuick: "all",
        searchQuery: "",
        sortColumn: "signal",
        sortDirection: "desc",
        scanMode: "3",
        currentTab: "tab-survey",
        timerId: null,
        ws: null,
        eventSource: null,
        selectedChannel24: null,
        selectedChannel5: null,
        theme: localStorage.getItem("netscanner_theme") || "light",
        currentLang: localStorage.getItem("netscanner_lang") || "vi",
        rationaleLang: localStorage.getItem("netscanner_lang") || "vi",
        vowifiTested: false,
        plannerLoaded: false,
        deviceFinder: {
            open: false,
            targetBssid: null,
            peakDbm: -100,
            minDbm: 0,
            history: []
        },
        planner: {
            preset: "apartment",
            width_m: 12.0,
            height_m: 8.0,
            freq_ghz: 2.4,
            heatmapMode: "primary_rssi", // "primary_rssi" | "secondary_rssi" | "snr" | "interference" | "throughput"
            slaProfile: "voice", // "voice" | "office" | "high_density"
            view25D: false,
            unit: "m",
            walls: [],
            aps: [],
            roomLabels: [],
            heatmap: null,
            activeTool: "draw", // "room" | "draw" | "select" | "place_ap" | "ruler" | "delete"
            dragStart: null,
            previewWall: null,
            previewRoom: null,
            rulerMeasure: null, // { x1, y1, x2, y2 }
            selectedWallIndex: -1,
            hoveredWallIndex: -1,
            hoveredApIndex: -1,
            isComputing: false
        }
    };

    // Bilingual Dictionary (VI & EN) - Basic-Meaning, Zero Quotation Marks
    const I18N = {
        vi: {
            brand_subtitle: "Công Cụ Quét Sóng, Phân Tích Kênh & Quy Hoạch Mạng Wi-Fi",
            badge_stream_live: "ĐANG QUÉT TRỰC TIẾP",
            scan_opt_balanced: "⚖️ Cân bằng (3s - Khuyên dùng)",
            scan_opt_eco: "🌱 Tiết kiệm pin (5s)",
            scan_opt_fast: "⚡ Quét nhanh (1s)",
            scan_opt_pause: "⏸️ Tạm dừng (Quét thủ công)",
            btn_scan_now: "Quét Ngay",
            btn_autopick: "Tính Kênh Tự Động",
            btn_export_csv: "Xuất CSV",
            btn_device_finder: "🎯 Dò Hướng Tín Hiệu AP",
            stat_aps: "Bộ Phát / APs Found",
            stat_ssids: "Tên Mạng / Unique SSIDs",
            stat_health: "Điểm Môi Trường / Score",
            stat_best_24: "Kênh Tốt Nhất 2.4GHz",
            stat_best_5: "Kênh Tốt Nhất 5GHz",
            tab_survey: "Quét Sóng / Survey",
            tab_spectrum: "Phổ Sóng RF / Spectrum",
            tab_optimizer: "Tối Ưu Kênh & Chẩn Đoán / Optimizer",
            tab_vowifi: "Thoại VoWiFi & MOS",
            tab_planner: "Quy Hoạch AP & Bản Đồ Nhiệt RF / Planner",
            tab_security: "Đánh Giá An Ninh / Security Audit",
            tab_reports: "Kho Báo Cáo / Reports",
            search_placeholder: "Tìm theo tên mạng SSID, địa chỉ MAC hoặc hãng sản xuất (Cisco, Aruba, Viettel, FPT)...",
            filter_band: "Băng Tần:",
            filter_all: "Tất Cả",
            filter_security: "Bảo Mật:",
            filter_sec_all: "Tất Cả Bảo Mật",
            filter_sec_open: "Mạng Mở (Không Mật Khẩu)",
            filter_sec_ent: "Doanh Nghiệp (Enterprise)",
            view_list: "Danh Sách BSSID",
            view_cluster: "Gom Nhóm Theo Thiết Bị Vật Lý (Hardware Grouping)",
            th_ssid: "Tên Mạng (SSID)",
            th_bssid: "Địa Chỉ MAC (BSSID)",
            th_vendor: "Hãng Sản Xuất (Vendor)",
            th_signal: "Cường Độ Sóng & SNR",
            th_channel: "Kênh (Channel)",
            th_band: "Băng Tần (Band)",
            th_gen: "Chuẩn & Điều Chế MCS",
            th_security: "Bảo Mật (Security)",
            th_load: "Tải Kênh & Tốc Độ Thực",
            th_details: "Chi Tiết",
            oscium_spec_title: "Phân Loại Nguồn Nhiễu Phổ Vô Tuyến & Độ Chiếm Dụng Kênh (RF Interference Classifier)",
            oscium_spec_desc: "Tự động phân tích giao thoa kênh lân cận (ACI), mật độ băng tần 2.45GHz ISM, kênh Radar DFS 5GHz, khối kênh 6GHz PSC và tỷ lệ phát lại gói tin.",
            oscium_spec_badge: "Giám Sát Phổ Tầng 1 & Tầng 2",
            oscium_checklist_title: "Bảng Kiểm Tra & Chẩn Đoán Sự Cố Wi-Fi Toàn Diện 4 Tầng (4-Layer Troubleshooting Suite)",
            oscium_checklist_desc: "Đánh giá tự động từ Tầng Vật Lý (RF Spectrum), Tầng Liên Kết (MAC Airtime & Retry), Chuyển Vùng Đa Trạm (Mesh Roaming) đến An Toàn Mã Hóa.",
            oscium_checklist_badge: "Chẩn Đoán Tự Động",
            spec_24_pill: "Dải Tần 2.4 GHz ISM",
            spec_24_desc: "Kênh 1 đến 14 (3 kênh chuẩn không chồng lấn: 1, 6, 11)",
            spec_legend_active: "AP Đang Phát",
            spec_legend_rec: "Kênh Khuyên Dùng",
            spec_note_24: "Đang phân tích độ trùng kênh (CCI) và giao thoa kênh kề (ACI)...",
            spec_5_pill: "Dải Tần 5 GHz UNII",
            spec_5_desc: "UNII-1 (Kênh 36-48), UNII-2A/2C DFS (52-144), UNII-3 (149-165)",
            spec_legend_block: "Khối Kênh Sạch",
            spec_note_5: "Đang đánh giá phân bổ gộp kênh 20MHz, 40MHz và 80MHz...",
            spec_time_pill: "Biểu Đồ Sóng Theo Thời Gian",
            spec_time_desc: "Lịch sử biến thiên độ mạnh tín hiệu RSSI (dBm) theo thời gian thực",
            spec_time_note: "Theo dõi độ ổn định sóng thu. Dao động lớn hơn 8 dBm cho thấy có vật cản di chuyển hoặc phản xạ sóng.",
            spec_waterfall_pill: "Biểu Đồ Thác Nước Mật Độ Phổ (Channel Spectrogram Waterfall)",
            spec_waterfall_desc: "Mật độ năng lượng sóng tích lũy trên các kênh 1-14 và 5GHz theo dòng thời gian (Xanh: Rảnh • Vàng/Đỏ: Dày đặc sóng)",
            spec_waterfall_note: "Giúp phát hiện ngay kênh nào bị chiếm dụng liên tục theo thời gian thực.",
            matrix_24_title: "Bảng Chấm Điểm Kênh 2.4 GHz (Channel Matrix)",
            matrix_24_desc: "Điểm chất lượng kênh tính theo số bộ phát trùng kênh (CCI) và lấn kênh kề (ACI).",
            matrix_5_title: "Băng Tần 5 GHz UNII & Khối Gộp Kênh 80MHz",
            matrix_5_desc: "Đánh giá các khối kênh rộng VHT80/HE80 và cảnh báo kênh có sóng Radar thời tiết DFS.",
            blocks_80_title: "Các Nhóm Gộp Kênh 80 MHz Khuyên Dùng (Clean Blocks)",
            rationale_card_title: "Giải Thích Kỹ Thuật & Lý Do Chọn Kênh",
            btn_calc_channel: "Tính Kênh Tự Động",
            heading_diag_24: "Chẩn Đoán Kênh Băng Tần 2.4 GHz",
            heading_diag_5: "Chẩn Đoán Kênh Băng Tần 5 GHz & 6 GHz",
            heading_admin_rec: "Khuyến Nghị Cài Đặt Thực Tế",
            airtime_card_title: "Phân Tích Chiếm Dụng Thời Gian Sóng (Airtime Utilization & Overhead)",
            airtime_card_desc: "Tỷ lệ phần trăm thời gian kênh bị chiếm bởi gói tin quản lý (Beacon) và truyền dữ liệu trên các kênh chính.",
            roaming_card_title: "Kiểm Tra Chuyển Vùng Mesh & Thiết Bị Bám Sóng Yếu (Roaming & Sticky Client Audit)",
            roaming_card_desc: "Phát hiện các mạng phát nhiều trạm (Multi-AP / Mesh) có nguy cơ làm điện thoại bám chặt vào cục phát yếu hoặc trùng kênh giữa các tầng.",
            router_guide_title: "Hướng Dẫn Cài Đặt Router Trực Tiếp (Router Configuration Guide)",
            router_guide_badge: "Áp Dụng Thực Tế",
            router_step1_title: "Bước 1: Đăng Nhập Trang Quản Trị Router",
            router_step1_desc: "Mở trình duyệt nhập địa chỉ: <code>192.168.1.1</code> hoặc <code>192.168.0.1</code>. Tên đăng nhập và mật khẩu quản trị thường in ở tem dưới đáy router (thường là <code>admin / admin</code> hoặc mã nhà mạng).",
            router_step2_title: "Bước 2: Cài Đặt Sóng 2.4 GHz",
            router_step2_desc: "• <b>Độ rộng kênh (Channel Width):</b> Cố định <b>20 MHz</b> (Tránh dùng 40MHz vì sẽ chồng lấn chiếm gần hết 14 kênh gây suy giảm tốc độ toàn mạng).<br>• <b>Kênh phát (Channel):</b> Chọn kênh khuyến nghị <b>1, 6 hoặc 11</b> từ kết quả đo của NetScanner.",
            router_step3_title: "Bước 3: Cài Đặt Sóng 5 GHz & 6 GHz",
            router_step3_desc: "• <b>Độ rộng kênh (Channel Width):</b> Chọn <b>80 MHz</b> trên 5GHz hoặc <b>160 MHz</b> trên 6GHz.<br>• <b>Kênh phát (Channel):</b> Chọn khối UNII-1 sạch (Kênh 36-48) hoặc UNII-3 (149-161) để tránh bị ngắt kết nối do sóng Radar DFS.",
            router_step4_title: "Bước 4: Mẹo Tách Tên Wi-Fi Tránh Nghẽn Sóng",
            router_step4_desc: "Nếu router đời cũ không hỗ trợ tự chuyển băng tần thông minh, hãy tách thành 2 tên riêng: <code>Nha_2.4G</code> và <code>Nha_5G</code>. Kết nối điện thoại và laptop vào sóng 5G khi ở gần để đạt tốc độ cao gấp 3-4 lần.",
            vowifi_title: "🎙️ Đo Kiểm Chất Lượng Thoại VoWiFi & Đường Truyền Đa Chặng (VoIP MOS & Multi-Hop Check)",
            vowifi_desc: "Tính toán theo tiêu chuẩn viễn thông ITU-T G.107 E-model đánh giá độ trễ RTT, Jitter, Packet Loss và phân tách độ trễ nội bộ (Router Gateway) so với Internet bên ngoài.",
            btn_run_vowifi: "Đo Chất Lượng Ngay",
            stat_mos_score: "Điểm MOS Thoại (1.0 - 4.5)",
            stat_rtt_latency: "Độ Trễ Khứ Hồi / RTT Latency",
            stat_jitter: "Độ Biến Thiên Trễ / Jitter",
            stat_packet_loss: "Tỷ Lệ Mất Gói / Packet Loss",
            vowifi_rating_ready: "Trạng Thái Đường Truyền: Sẵn sàng kiểm tra",
            vowifi_untested: "Chưa đo",
            vowifi_verdict_ready: "Bấm nút Đo Chất Lượng Ngay để hệ thống gửi gói tin kiểm tra độ trễ và tính toán điểm MOS thực tế.",
            vowifi_codecs_title: "Tương Thích Chuẩn Nén Âm Thanh (Voice Codecs)",
            vowifi_codec_opus: "Tương thích cao",
            vowifi_codec_g711: "Chuẩn thoại rõ",
            vowifi_codec_g729: "Dự phòng tốt",
            vowifi_why_mos: "Tại Sao Chỉ Số MOS Lại Quyết Định Cuộc Gọi?",
            vowifi_why_mos_desc: "Trong thực tế sử dụng mạng, sóng Wi-Fi mạnh (<code>-50 dBm</code>) nhưng nếu <b>Jitter &gt; 25ms</b> hoặc <b>Packet Loss &gt; 1%</b> thì cuộc gọi thoại vẫn bị giật tiếng, rè giọng hoặc trễ lời. Điểm MOS từ <b>4.0 trở lên</b> đảm bảo cuộc họp trực tuyến mượt mà.",
            planner_title: "🗺️ Quy Hoạch Vị Trí Trạm Phát & Bản Đồ Nhiệt Đa Chế Độ (Floorplan & Multi-Mode RF Heatmap)",
            planner_desc: "Thiết kế mặt bằng trực quan kết hợp 5 chế độ bản đồ nhiệt chuyên sâu (Sóng chính, Sóng dự phòng chuyển vùng, Tỷ số SNR, Nhiễu tranh chấp kênh, Tốc độ & Dung lượng tải) trên 3 băng tần 2.4GHz / 5GHz / 6GHz.",
            preset_apartment: "Căn Hộ 70m² (2 Phòng Ngủ)",
            preset_townhouse: "Nhà Phố Dài 120m²",
            preset_office: "Văn Phòng Mở 250m²",
            preset_custom: "🎨 Mặt Bằng Trống (Tự Vẽ Mới)",
            sla_voice: "🎯 Chuẩn Thoại VoWiFi (-65 dBm / SNR 25dB)",
            sla_office: "🏢 Chuẩn Văn Phòng (-67 dBm / SNR 20dB)",
            sla_hd: "🏟️ Hội Trường Mật Độ Cao (-60 dBm / SNR 28dB)",
            btn_import_aps: "📥 Nạp AP Thực Tế",
            label_heatmap_mode: "Chế độ Bản đồ nhiệt:",
            hm_mode_primary: "1. Sóng Chính (Primary Signal dBm)",
            hm_mode_secondary: "2. Sóng Dự Phòng (Secondary Roaming)",
            hm_mode_snr: "3. Tỷ Số Tín Hiệu/Nhiễu (SNR dB)",
            hm_mode_interference: "4. Nhiễu Tranh Chấp Kênh (Interference)",
            hm_mode_throughput: "5. Tốc Độ & Dung Lượng (Data Rate Mbps)",
            kpi_pri_cov: "Độ Phủ Sóng Chính (Primary)",
            kpi_sec_roam: "Dự Phòng Chuyển Vùng (Secondary)",
            kpi_avg_snr: "Tỷ Số Tín Hiệu / Nhiễu (SNR)",
            kpi_tp_cap: "Tốc Độ & Sức Chứa Thiết Bị",
            kpi_conflict_dead: "Tranh Chấp Kênh & Góc Khuất",
            label_dimensions: "Khổ đất:",
            btn_apply_dim: "Đặt Khổ",
            label_wall_material: "Vật liệu:",
            mat_brick: "🧱 Tường Gạch (-6 dB)",
            mat_concrete: "🏛️ Bê Tông Cốt Thép (-12 dB)",
            mat_glass: "🪟 Cửa Kính / Vách Kính (-3 dB)",
            mat_wood: "🪵 Vách Gỗ / Thạch Cao (-4 dB)",
            mat_door: "🚪 Cửa Ra Vào Mỏng (-2 dB)",
            mat_metal: "🛡️ Tủ Sắt / Lõi Thang Máy (-15 dB)",
            label_sim_band: "Băng tần:",
            band_opt_24: "📶 Sóng 2.4 GHz (Xuyên tường tốt)",
            band_opt_5: "⚡ Sóng 5.0 GHz (80MHz Tốc độ cao)",
            band_opt_6: "🚀 Sóng 6.0 GHz (Wi-Fi 6E/7 160MHz)",
            label_toggle_25d: "🧊 Xem Khối 2.5D",
            tool_room: "🏠 Vẽ Khung Phòng",
            tool_draw: "✏️ Vẽ Tường Lẻ",
            tool_select: "👆 Chọn & Kéo Sửa",
            tool_place_ap: "📡 Đặt Thêm AP",
            tool_ruler: "📏 Thước Đo Suy Hao",
            tool_delete: "🗑️ Xóa",
            btn_undo_wall: "↩️ Hoàn Tác",
            btn_clear_all: "🗑️ Xóa Hết",
            label_signal_level: "Mức Sóng:",
            legend_strong: "Rất Mạnh (-30 dBm)",
            legend_good: "Tốt (-65 dBm)",
            legend_weak: "Yếu / Mất Sóng (-90 dBm)",
            inspector_label_mat: "Đổi vật liệu:",
            inspector_label_len: "Độ dài:",
            unit_opt_m: "Mét (m)",
            unit_opt_in: "Inch (in)",
            unit_opt_ft: "Feet (ft)",
            unit_opt_cm: "Centimet (cm)",
            btn_apply_len: "Áp Dụng Độ Dài",
            btn_del_wall: "Xóa Vách Này",
            obj_th_type: "Loại Vách / Vật Cản",
            obj_th_coords: "Tọa Độ (m)",
            obj_th_len: "Chiều Dài",
            obj_th_loss: "Suy Hao",
            obj_th_action: "Thao Tác",
            btn_complete_planner: "✅ Tự Động Đặt AP & Tính Phủ Sóng",
            btn_complete_planner_bottom: "✅ Tự Động Tìm Vị Trí Đặt Router & Tính Phủ Sóng",
            btn_recalc_heatmap: "🔄 Tính Lại Bản Đồ Nhiệt Theo Vị Trí AP Hiện Tại",
            planner_results_heading: "Kết Quả Đánh Giá Độ Phủ Sóng",
            planner_placeholder: "Bấm nút Tự Động Tìm Vị Trí Đặt Router ở trên sau khi vẽ mặt bằng xong để hệ thống tính toán vị trí lắp đặt và hiển thị vùng phủ sóng.",
            df_modal_title: "Bộ Dò Hướng & Định Vị Tín Hiệu Trạm Phát (Device Finder)",
            df_select_target: "Chọn trạm phát BSSID cần dò tìm vị trí vật lý:",
            df_reset_peak: "Đặt Lại Đỉnh Sóng",
            df_peak_rssi: "Đỉnh Sóng Cao Nhất (Peak)",
            df_min_rssi: "Mức Thấp Nhất (Min)",
            df_est_dist: "Khoảng Cách Ước Tính",
            sec_open_title: "Cảnh Báo: Phát Hiện Mạng Wi-Fi Không Đặt Mật Khẩu (Open / Unencrypted)",
            sec_open_desc: "Đang kiểm tra các trạm phát sóng Wi-Fi không bật mã hóa WPA2/WPA3...",
            sec_dist_title: "Thống Kê Chuẩn Bảo Mật Trong Khu Vực (Security Protocol Distribution)",
            sec_diag_title: "Phân Tích Rủi Ro Mạng Bảo Mật Thấp & Cách Khắc Phục",
            sec_diag_badge: "Kiểm Tra An Toàn Mạng",
            sec_cause_title: "1. Tại Sao Mạng Bị Đánh Giá Bảo Mật Thấp?",
            sec_cause_desc_1: "<b>Nguyên nhân kỹ thuật:</b> Mạng Open (None) hoặc dùng chuẩn cũ WEP / WPA-TKIP <b>không mã hóa</b> dữ liệu truyền qua sóng radio.",
            sec_cause_desc_2: "Sóng Wi-Fi phát lan truyền trong không khí. Bất kỳ thiết bị nào trong vùng phủ sóng đều có thể thu được gói tin nếu không bật mã hóa.",
            sec_danger_title: "2. Rủi Ro Thực Tế Nếu Không Khắc Phục",
            sec_danger_item1: "<b>Nghe lén gói tin (Packet Sniffing):</b> Người khác có thể dùng phần mềm bắt gói tin để đọc các dữ liệu không mã hóa trên mạng.",
            sec_danger_item2: "<b>Trạm phát giả mạo (Evil Twin):</b> Kẻ xấu dễ dàng phát một mạng Wi-Fi trùng tên để đánh lừa thiết bị tự động kết nối vào.",
            sec_danger_item3: "<b>Truy cập trái phép thiết bị nội bộ:</b> Người lạ có thể quét thấy máy in, camera IP hoặc thư mục chia sẻ trong mạng LAN.",
            sec_fix_title: "3. Các Bước Khắc Phục Cụ Thể",
            sec_fix_item1: "<b>Đổi chuẩn mã hóa:</b> Đăng nhập vào Router (<code>192.168.1.1</code>), chuyển chế độ bảo mật sang <b>WPA2-PSK (AES)</b> hoặc <b>WPA3-SAE</b>.",
            sec_fix_item2: "<b>Đặt mật khẩu đủ mạnh:</b> Dùng mật khẩu từ 12 ký tự trở lên kết hợp chữ hoa, chữ thường và chữ số.",
            sec_fix_item3: "<b>Bật cách ly thiết bị (Client Isolation):</b> Đối với mạng khách ở quán cafe hoặc văn phòng, bật Guest Wi-Fi kèm Client Isolation để các máy khách không tự quét nhau.",
            sec_fix_item4: "<b>Tắt tính năng WPS:</b> Tắt mã PIN WPS trên Router để tránh bị dò mật khẩu tự động.",
            reports_title: "Kho Lưu Trữ Báo Cáo MMQ./NetScanner",
            reports_desc: "Các file báo cáo khảo sát được lưu theo định dạng chuẩn <code>NetScanner_Report_[MM-DD-YYYY]_[ID-01].csv</code> mở trực tiếp bằng Microsoft Excel.",
            btn_export_csv_modal: "Xuất Báo Cáo CSV",
            btn_export_json_modal: "Xuất File JSON",
            btn_clear_reports: "Dọn Báo Cáo Cũ",
            rep_format: "Định Dạng",
            rep_filename: "Tên File Báo Cáo",
            rep_created: "Thời Gian Tạo",
            rep_size: "Dung Lượng",
            rep_action: "Thao Tác",
            modal_export_title: "Xuất Báo Cáo Khảo Sát Wi-Fi",
            modal_export_desc: "Chọn định dạng file báo cáo cần tải về. Định dạng CSV tương thích trực tiếp với Microsoft Excel hỗ trợ đầy đủ tiếng Việt.",
            format_csv_name: "Bảng Tính CSV (.csv) - Mở Bằng Excel",
            format_csv_desc: "Bao gồm kết quả gợi ý kênh, chỉ số SNR, MCS, kiểm tra bảo mật và danh sách chi tiết từng BSSID.",
            format_json_name: "Dữ Liệu JSON (.json)",
            format_json_desc: "Toàn bộ dữ liệu đo đạc dạng cấu trúc JSON dùng cho lưu trữ kỹ thuật hoặc tích hợp hệ thống.",
            export_generating: "Đang tạo báo cáo...",
            btn_cancel: "Hủy",
            btn_download_report: "Tải Báo Cáo"
        },
        en: {
            brand_subtitle: "Wi-Fi Network Scanner, Channel Analyzer & Floorplan Coverage Tool",
            badge_stream_live: "LIVE SCANNING",
            scan_opt_balanced: "⚖️ Balanced (3s - Recommended)",
            scan_opt_eco: "🌱 Power Saver (5s)",
            scan_opt_fast: "⚡ Fast (1s)",
            scan_opt_pause: "⏸️ Paused (Manual)",
            btn_scan_now: "Scan Now",
            btn_autopick: "Auto-Pick Channel",
            btn_export_csv: "Export CSV",
            btn_device_finder: "🎯 Signal Finder",
            stat_aps: "Access Points Found",
            stat_ssids: "Unique SSIDs",
            stat_health: "Environment Score",
            stat_best_24: "Best 2.4GHz Channel",
            stat_best_5: "Best 5GHz Channel",
            tab_survey: "Network Survey",
            tab_spectrum: "RF Spectrum",
            tab_optimizer: "Channel & Diagnostics",
            tab_vowifi: "VoWiFi & MOS Voice",
            tab_planner: "AP & RF Heatmap Planner",
            tab_security: "Security Audit",
            tab_reports: "Reports Archive",
            search_placeholder: "Search by SSID, MAC BSSID, or Vendor (Cisco, Aruba, Apple)...",
            filter_band: "Band:",
            filter_all: "All",
            filter_security: "Security:",
            filter_sec_all: "All Security",
            filter_sec_open: "Open (No Password)",
            filter_sec_ent: "Enterprise (802.1X)",
            view_list: "BSSID List",
            view_cluster: "Hardware Device Grouping",
            th_ssid: "Network Name (SSID)",
            th_bssid: "MAC Address (BSSID)",
            th_vendor: "Vendor / Hardware",
            th_signal: "Signal & SNR",
            th_channel: "Channel",
            th_band: "Band",
            th_gen: "Wi-Fi Gen & MCS",
            th_security: "Security Protocol",
            th_load: "Channel Load & Speed",
            th_details: "Details",
            oscium_spec_title: "RF Spectrum Interference & Contention Classifier",
            oscium_spec_desc: "Automatically classifies Adjacent-Channel Interference (ACI), 2.45GHz ISM density, 5GHz DFS radar channels, 6GHz PSC blocks, and frame retry rates.",
            oscium_spec_badge: "Layer 1 & Layer 2 Monitor",
            oscium_checklist_title: "4-Layer All-in-One Wi-Fi Troubleshooting Checklist",
            oscium_checklist_desc: "Automated health check across Physical RF Spectrum, MAC Airtime & Retries, Multi-AP Roaming, and Security Encryption.",
            oscium_checklist_badge: "Automated Diagnostics",
            spec_24_pill: "2.4 GHz ISM Band",
            spec_24_desc: "Channels 1 to 14 (3 non-overlapping standard channels: 1, 6, 11)",
            spec_legend_active: "Active APs",
            spec_legend_rec: "Recommended Channel",
            spec_note_24: "Analyzing Co-Channel Interference (CCI) and Adjacent-Channel Interference (ACI)...",
            spec_5_pill: "5 GHz UNII Band",
            spec_5_desc: "UNII-1 (Ch 36-48), UNII-2A/2C DFS (52-144), UNII-3 (149-165)",
            spec_legend_block: "Clean Bonding Block",
            spec_note_5: "Evaluating 20MHz, 40MHz, and 80MHz channel allocations...",
            spec_time_pill: "Live Signal Strength vs Time",
            spec_time_desc: "Real-time RSSI signal variation and link stability history",
            spec_time_note: "Monitors link stability. Fluctuations above 8 dBm indicate moving obstacles or multipath reflections.",
            spec_waterfall_pill: "Channel Spectrogram Waterfall",
            spec_waterfall_desc: "Accumulated RF energy across 2.4GHz and 5GHz channels over time (Blue: Quiet • Yellow/Red: Busy)",
            spec_waterfall_note: "Identifies persistent channel congestion over time.",
            matrix_24_title: "2.4 GHz Channel Quality Matrix",
            matrix_24_desc: "Channel scores calculated from Co-Channel (CCI) and Adjacent-Channel Interference (ACI).",
            matrix_5_title: "5 GHz UNII Band & 80MHz Channel Blocks",
            matrix_5_desc: "Evaluates 80MHz channel blocks and warns about DFS weather radar channels.",
            blocks_80_title: "Recommended 80 MHz Channel Blocks (Clean Blocks)",
            rationale_card_title: "Technical Explanation & Channel Selection",
            btn_calc_channel: "Auto-Pick Channel",
            heading_diag_24: "2.4 GHz Band Channel Diagnosis",
            heading_diag_5: "5 GHz & 6 GHz Band Channel Diagnosis",
            heading_admin_rec: "Practical Setup Advice",
            airtime_card_title: "Airtime Utilization & Management Overhead",
            airtime_card_desc: "Percentage of channel time consumed by management beacons and data frames on primary channels.",
            roaming_card_title: "Mesh Roaming & Sticky Client Audit",
            roaming_card_desc: "Detects multi-AP networks where clients may stay stuck on a distant AP or suffer same-channel interference.",
            router_guide_title: "Direct Router Setup Guide (Configuration Guide)",
            router_guide_badge: "Practical Steps",
            router_step1_title: "Step 1: Log In to Router Admin Page",
            router_step1_desc: "Open a browser and enter <code>192.168.1.1</code> or <code>192.168.0.1</code>. Login credentials are printed on the bottom label of the router.",
            router_step2_title: "Step 2: Configure 2.4 GHz Radio",
            router_step2_desc: "• <b>Channel Width:</b> Lock to <b>20 MHz</b> (Avoid 40MHz on 2.4GHz as it overlaps nearby channels).<br>• <b>Channel:</b> Select recommended channel <b>1, 6, or 11</b>.",
            router_step3_title: "Step 3: Configure 5 GHz & 6 GHz Radio",
            router_step3_desc: "• <b>Channel Width:</b> Select <b>80 MHz</b> on 5GHz or <b>160 MHz</b> on 6GHz.<br>• <b>Channel:</b> Choose non-DFS UNII-1 (36-48) or UNII-3 (149-161) to prevent radar disconnects.",
            router_step4_title: "Step 4: Separate Band Names if Needed",
            router_step4_desc: "If an older router does not steer bands well, use separate names like <code>Home_2.4G</code> and <code>Home_5G</code>.",
            vowifi_title: "🎙️ VoWiFi Voice Quality & Multi-Hop Path Test (VoIP MOS)",
            vowifi_desc: "ITU-T G.107 E-model metric evaluating RTT latency, Jitter, Packet Loss, and separating local Gateway latency from WAN Internet latency.",
            btn_run_vowifi: "Run Quality Test",
            stat_mos_score: "Voice MOS Score (1.0 - 4.5)",
            stat_rtt_latency: "Round-Trip Latency (RTT)",
            stat_jitter: "Latency Jitter",
            stat_packet_loss: "Packet Loss Rate",
            vowifi_rating_ready: "Link Status: Ready to test",
            vowifi_untested: "Untested",
            vowifi_verdict_ready: "Click Run Quality Test to send test packets and calculate the actual MOS score.",
            vowifi_codecs_title: "Voice Codec Compatibility",
            vowifi_codec_opus: "Compatible",
            vowifi_codec_g711: "Clear Voice",
            vowifi_codec_g729: "Low-Bandwidth Fallback",
            vowifi_why_mos: "Why Does the MOS Score Matter?",
            vowifi_why_mos_desc: "Even with strong signal (<code>-50 dBm</code>), if <b>Jitter &gt; 25ms</b> or <b>Packet Loss &gt; 1%</b>, voice calls suffer audio drops or delay. A MOS score of <b>4.0 or higher</b> ensures smooth calls.",
            planner_title: "🗺️ AP Placement Planner & Multi-Mode RF Heatmap",
            planner_desc: "Interactive floorplan design with 5 heatmap modes (Primary Signal, Secondary Roaming, SNR, Channel Interference, Data Rate & Capacity) across 2.4GHz / 5GHz / 6GHz.",
            preset_apartment: "Apartment 70m² (2 Bedrooms)",
            preset_townhouse: "Townhouse 120m²",
            preset_office: "Open Office 250m²",
            preset_custom: "🎨 Blank Floorplan (Draw from Scratch)",
            sla_voice: "🎯 VoWiFi Voice Grade (-65 dBm / SNR 25dB)",
            sla_office: "🏢 Standard Office (-67 dBm / SNR 20dB)",
            sla_hd: "🏟️ High-Density Venue (-60 dBm / SNR 28dB)",
            btn_import_aps: "📥 Import Live APs",
            label_heatmap_mode: "Heatmap Mode:",
            hm_mode_primary: "1. Primary Signal (dBm)",
            hm_mode_secondary: "2. Secondary Roaming (dBm)",
            hm_mode_snr: "3. Signal-to-Noise Ratio (SNR dB)",
            hm_mode_interference: "4. Channel Interference",
            hm_mode_throughput: "5. Data Rate & Capacity (Mbps)",
            kpi_pri_cov: "Primary Coverage",
            kpi_sec_roam: "Roaming Redundancy (Secondary)",
            kpi_avg_snr: "Average SNR Margin",
            kpi_tp_cap: "Throughput & Client Capacity",
            kpi_conflict_dead: "Channel Conflict & Deadzones",
            label_dimensions: "Plot Size:",
            btn_apply_dim: "Apply Size",
            label_wall_material: "Material:",
            mat_brick: "🧱 Brick Wall (-6 dB)",
            mat_concrete: "🏛️ Concrete Wall (-12 dB)",
            mat_glass: "🪟 Glass Window/Wall (-3 dB)",
            mat_wood: "🪵 Wood / Drywall (-4 dB)",
            mat_door: "🚪 Interior Door (-2 dB)",
            mat_metal: "🛡️ Metal / Elevator Shaft (-15 dB)",
            label_sim_band: "Band:",
            band_opt_24: "📶 2.4 GHz (Wall Penetration)",
            band_opt_5: "⚡ 5.0 GHz (80MHz High Speed)",
            band_opt_6: "🚀 6.0 GHz (Wi-Fi 6E/7 160MHz)",
            label_toggle_25d: "🧊 2.5D View",
            tool_room: "🏠 Draw Room Box",
            tool_draw: "✏️ Draw Wall",
            tool_select: "👆 Select & Drag",
            tool_place_ap: "📡 Place AP",
            tool_ruler: "📏 Measure Loss",
            tool_delete: "🗑️ Delete",
            btn_undo_wall: "↩️ Undo",
            btn_clear_all: "🗑️ Clear All",
            label_signal_level: "Signal Level:",
            legend_strong: "Strong (-30 dBm)",
            legend_good: "Good (-65 dBm)",
            legend_weak: "Weak / Dead Zone (-90 dBm)",
            inspector_label_mat: "Change Material:",
            inspector_label_len: "Length:",
            unit_opt_m: "Meters (m)",
            unit_opt_in: "Inches (in)",
            unit_opt_ft: "Feet (ft)",
            unit_opt_cm: "Centimeters (cm)",
            btn_apply_len: "Apply Length",
            btn_del_wall: "Delete Wall",
            obj_th_type: "Wall / Obstacle Type",
            obj_th_coords: "Coordinates (m)",
            obj_th_len: "Length",
            obj_th_loss: "RF Attenuation",
            obj_th_action: "Actions",
            btn_complete_planner: "✅ Auto-Place APs & Calculate Coverage",
            btn_complete_planner_bottom: "✅ Auto-Place APs & Compute Coverage",
            btn_recalc_heatmap: "🔄 Recalculate Heatmap for Current APs",
            planner_results_heading: "RF Coverage Results",
            planner_placeholder: "Click Auto-Place APs & Calculate Coverage above after sketching your floorplan to compute router locations.",
            df_modal_title: "Directional AP Signal Tracker (Device Finder)",
            df_select_target: "Select target BSSID to track physical location:",
            df_reset_peak: "Reset Peak",
            df_peak_rssi: "Peak Signal Recorded",
            df_min_rssi: "Minimum Signal",
            df_est_dist: "Estimated Distance",
            sec_open_title: "Warning: Unencrypted Wi-Fi Networks Detected (Open)",
            sec_open_desc: "Checking for nearby Access Points operating without WPA2/WPA3 password protection...",
            sec_dist_title: "Security Protocol Distribution in Area",
            sec_diag_title: "Low Security Risk Analysis & Fix Guide",
            sec_diag_badge: "Network Security Check",
            sec_cause_title: "1. Why Is the Network Rated Low Security?",
            sec_cause_desc_1: "<b>Technical Cause:</b> Open (None) or legacy WEP / WPA-TKIP networks transmit radio frames <b>without encryption</b>.",
            sec_cause_desc_2: "Wi-Fi signals travel through shared air. Anyone within range can capture unencrypted packets.",
            sec_danger_title: "2. Practical Risks If Unfixed",
            sec_danger_item1: "<b>Packet Sniffing:</b> Unencrypted traffic can be captured using packet analysis tools.",
            sec_danger_item2: "<b>Evil Twin Spoofing:</b> Attackers can set up a duplicate SSID to trick devices into connecting.",
            sec_danger_item3: "<b>LAN Access:</b> Unauthorized users can discover printers, IP cameras, or shared folders on the local network.",
            sec_fix_title: "3. Concrete Fix Steps",
            sec_fix_item1: "<b>Enable WPA2/WPA3:</b> Log in to the Router (<code>192.168.1.1</code>) and set security to <b>WPA2-PSK (AES)</b> or <b>WPA3-SAE</b>.",
            sec_fix_item2: "<b>Strong Password:</b> Set a password with at least 12 characters.",
            sec_fix_item3: "<b>Client Isolation:</b> Enable Guest Network with Client Isolation for visitor Wi-Fi.",
            sec_fix_item4: "<b>Disable WPS:</b> Turn off WPS PIN authentication on the router.",
            reports_title: "MMQ./NetScanner Reports Archive",
            reports_desc: "Survey reports saved locally as <code>NetScanner_Report_[MM-DD-YYYY]_[ID-01].csv</code> for direct viewing in Microsoft Excel.",
            btn_export_csv_modal: "Export CSV Report",
            btn_export_json_modal: "Export JSON File",
            btn_clear_reports: "Clear Old Reports",
            rep_format: "Format",
            rep_filename: "Report File Name",
            rep_created: "Created Time",
            rep_size: "File Size",
            rep_action: "Actions",
            modal_export_title: "Export Wi-Fi Survey Report",
            modal_export_desc: "Choose an export file format. CSV opens directly in Microsoft Excel with full bilingual support.",
            format_csv_name: "CSV Spreadsheet (.csv) - Open in Excel",
            format_csv_desc: "Contains channel recommendations, SNR, MCS, security audit, and BSSID inventory.",
            format_json_name: "JSON Data (.json)",
            format_json_desc: "Complete scan data in JSON structure for technical archiving or automation.",
            export_generating: "Generating report...",
            btn_cancel: "Cancel",
            btn_download_report: "Download Report"
        }
    };

    function setLanguage(lang) {
        state.currentLang = lang;
        state.rationaleLang = lang;
        localStorage.setItem("netscanner_lang", lang);
        document.documentElement.setAttribute("lang", lang);

        const langLabel = document.getElementById("lang-current-label");
        if (langLabel) langLabel.textContent = lang.toUpperCase();

        const translateLabel = document.getElementById("translate-rationale-label");
        if (translateLabel) {
            translateLabel.textContent = lang === "vi" ? "🌐 Dịch sang English" : "🌐 Dịch sang Tiếng Việt";
        }

        const dict = I18N[lang] || I18N.vi;

        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (dict[key]) {
                el.innerHTML = dict[key];
            }
        });

        document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
            const key = el.getAttribute("data-i18n-placeholder");
            if (dict[key]) {
                el.setAttribute("placeholder", dict[key]);
            }
        });

        if (state.analysis) {
            updateOverviewHeader();
            renderOptimizerChannels();
            renderOsciumSpectrumClassifiers();
            renderSecurityAudit();
        }
        renderSurveyTable();
        updateWallCountBadge();
        if (window.setPlannerTool) {
            window.setPlannerTool(state.planner.activeTool || "draw");
        }
        if (state.currentTab === "tab-planner") {
            drawFloorplanHeatmap();
        }
        if (state.currentTab === "tab-reports") {
            fetchReportsArchive();
        }
        safeCreateIcons();
    }

    // Helper for safe Lucide icons creation
    function safeCreateIcons() {
        try {
            if (window.lucide && typeof lucide.createIcons === "function") {
                lucide.createIcons();
            }
        } catch (e) {}
    }

    // Apply Initial Theme
    document.documentElement.setAttribute("data-theme", state.theme);
    updateThemeIcon();
    safeCreateIcons();

    // DOM Elements
    const btnScan = document.getElementById("btn-scan");
    const scanIcon = document.getElementById("scan-icon");
    const autoScanSelect = document.getElementById("auto-scan-interval");
    const scanCountBadge = document.getElementById("scan-count-badge");
    const btnQuickAutoPick = document.getElementById("btn-quick-autopick");
    const btnTriggerAutoPick = document.getElementById("btn-trigger-autopick");
    const btnExportCsv = document.getElementById("btn-export-csv");
    const btnOpenReportModal = document.getElementById("btn-open-report-modal");
    const btnCloseReportModal = document.getElementById("btn-close-report-modal");
    const btnCancelExport = document.getElementById("btn-cancel-export");
    const btnConfirmExport = document.getElementById("btn-confirm-export");
    const btnThemeToggle = document.getElementById("btn-theme-toggle");
    const btnLangToggle = document.getElementById("btn-lang-toggle");
    const langCurrentLabel = document.getElementById("lang-current-label");
    const btnTranslateRationale = document.getElementById("btn-translate-rationale");
    const translateRationaleLabel = document.getElementById("translate-rationale-label");
    const networkSearch = document.getElementById("network-search");
    const filterSecurity = document.getElementById("filter-security");
    const surveyTableBody = document.getElementById("survey-table-body");
    const apDrawer = document.getElementById("ap-drawer");
    const btnCloseDrawer = document.getElementById("btn-close-drawer");
    const reportModal = document.getElementById("report-modal");

    // Canvases
    const canvas24 = document.getElementById("canvas-spectrum-24");
    const canvas5 = document.getElementById("canvas-spectrum-5");
    const canvasSignal = document.getElementById("canvas-signal-history");
    const canvasWaterfall = document.getElementById("canvas-spectrum-waterfall");

    // Tab Navigation: Tab-Aware rendering saves CPU
    document.querySelectorAll(".nav-tab").forEach(tabBtn => {
        tabBtn.addEventListener("click", () => {
            document.querySelectorAll(".nav-tab").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
            tabBtn.classList.add("active");
            const tabId = tabBtn.getAttribute("data-tab");
            state.currentTab = tabId;
            const targetPane = document.getElementById(tabId);
            if (targetPane) targetPane.classList.add("active");

            renderCurrentTab();
            if (tabId === "tab-reports") {
                fetchReportsArchive();
            }
        });
    });

    // Theme Toggle
    btnThemeToggle.addEventListener("click", () => {
        state.theme = state.theme === "dark" ? "light" : "dark";
        localStorage.setItem("netscanner_theme", state.theme);
        document.documentElement.setAttribute("data-theme", state.theme);
        updateThemeIcon();
        drawSpectrumGraphs();
    });

    // Global Language Toggle (VI <-> EN)
    if (btnLangToggle) {
        btnLangToggle.addEventListener("click", () => {
            const nextLang = state.currentLang === "vi" ? "en" : "vi";
            setLanguage(nextLang);
        });
    }

    // Inline Technical Rationale Translator (Tab 3)
    if (btnTranslateRationale) {
        btnTranslateRationale.addEventListener("click", () => {
            state.rationaleLang = state.rationaleLang === "vi" ? "en" : "vi";
            if (translateRationaleLabel) {
                translateRationaleLabel.textContent = state.rationaleLang === "vi" ? "🌐 Dịch sang English" : "🌐 Dịch sang Tiếng Việt";
            }
            if (state.analysis) {
                updateRationaleDisplay(state.analysis.evaluation_24ghz, state.analysis.evaluation_5ghz);
            }
            safeCreateIcons();
        });
    }

    function updateThemeIcon() {
        const icon = document.getElementById("theme-icon");
        if (icon) {
            icon.setAttribute("data-lucide", state.theme === "dark" ? "sun" : "moon");
            safeCreateIcons();
        }
    }

    // CONTINUOUS STREAMING ENGINE (WEBSOCKET -> SSE -> HTTP POLLING)
    function setupContinuousEngine() {
        if (state.scanMode === "0") return;

        const protocol = location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${location.host}/ws/live`;

        try {
            if (state.ws) {
                try { state.ws.close(); } catch (e) {}
                state.ws = null;
            }
            const ws = new WebSocket(wsUrl);
            state.ws = ws;

            ws.onopen = () => {
                setLiveStatusIndicator(true, state.currentLang === "vi" ? "ĐANG QUÉT TRỰC TIẾP" : "LIVE SCANNING");
            };

            ws.onmessage = (event) => {
                if (state.scanMode === "0") return;
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "live_update") {
                        handleLiveUpdate(data);
                    }
                } catch (e) {
                    console.error("WS Parse error:", e);
                }
            };

            ws.onclose = () => {
                if (state.scanMode !== "0") {
                    startSSEStream();
                }
            };

            ws.onerror = () => {
                if (state.scanMode !== "0") {
                    startSSEStream();
                }
            };
        } catch (e) {
            startSSEStream();
        }
    }

    // Server-Sent Events Fallback
    function startSSEStream() {
        if (state.eventSource) {
            try { state.eventSource.close(); } catch (e) {}
            state.eventSource = null;
        }
        if (state.scanMode === "0") return;

        try {
            const es = new EventSource("/api/stream/live");
            state.eventSource = es;

            es.onopen = () => {
                setLiveStatusIndicator(true, state.currentLang === "vi" ? "ĐANG QUÉT (SSE)" : "LIVE (SSE)");
            };

            es.onmessage = (event) => {
                if (state.scanMode === "0") return;
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "live_update") {
                        handleLiveUpdate(data);
                    }
                } catch (e) {}
            };

            es.onerror = () => {
                if (state.eventSource) {
                    try { state.eventSource.close(); } catch (e) {}
                    state.eventSource = null;
                }
                startHttpFallbackPolling();
            };
        } catch (e) {
            startHttpFallbackPolling();
        }
    }

    // HTTP Polling Fallback
    function startHttpFallbackPolling() {
        if (state.scanMode === "0" || state.timerId) return;
        setLiveStatusIndicator(true, state.currentLang === "vi" ? "ĐANG QUÉT (HTTP)" : "POLLING (HTTP)");
        const intervalSec = parseInt(state.scanMode, 10) || 3;
        state.timerId = setInterval(() => {
            if (state.scanMode === "0") {
                clearInterval(state.timerId);
                state.timerId = null;
                return;
            }
            fetchScanData(false);
        }, intervalSec * 1000);
    }

    function setLiveStatusIndicator(active, text) {
        const liveText = document.querySelector(".live-text");
        const dot = document.querySelector(".live-dot");
        if (liveText) liveText.textContent = text;
        if (dot) {
            if (active) {
                dot.style.backgroundColor = "var(--success)";
                dot.classList.add("pulse-animation");
            } else {
                dot.style.backgroundColor = "var(--warning)";
                dot.classList.remove("pulse-animation");
            }
        }
    }

    function renderCurrentTab() {
        if (state.currentTab === "tab-survey") {
            if (state.surveyView === "cluster") {
                renderClusterView();
            } else {
                renderSurveyTable();
            }
            updateThreatBanner();
        } else if (state.currentTab === "tab-spectrum") {
            drawSpectrumGraphs();
        } else if (state.currentTab === "tab-optimizer") {
            renderOptimizerChannels();
        } else if (state.currentTab === "tab-vowifi") {
            if (!state.vowifiTested) {
                window.runVoWifiTest();
            }
        } else if (state.currentTab === "tab-planner") {
            if (!state.plannerLoaded) {
                state.plannerLoaded = true;
                window.loadFloorplanPreset("apartment");
            } else {
                drawFloorplanHeatmap();
            }
        } else if (state.currentTab === "tab-security") {
            renderSecurityAudit();
        }
    }

    // Handle Incoming Live Update Packet
    function handleLiveUpdate(data) {
        state.scanCount = data.scan_count || (state.scanCount + 1);
        if (scanCountBadge) {
            scanCountBadge.textContent = `#${state.scanCount}`;
        }

        state.networks = data.networks || [];
        state.clusters = data.clusters || [];
        state.threats = data.threats || null;
        state.analysis = data.analysis || null;
        state.interface = data.interface || null;
        if (data.signal_history) {
            state.signalHistory = data.signal_history;
        }

        // Record a snapshot row of 2.4GHz and 5GHz channel energy for the Spectrogram Waterfall
        const wfRow = { time: data.timestamp || new Date().toLocaleTimeString() };
        for (const net of state.networks) {
            const ch = Number(net.channel);
            const dbm = Number(net.signal_dbm || -100);
            if (ch >= 1 && ch <= 14) {
                for (let c = 1; c <= 14; c++) {
                    const diff = Math.abs(c - ch);
                    if (diff <= 3) {
                        const bleedDbm = dbm - (diff * 5);
                        const k = `24_${c}`;
                        if (wfRow[k] === undefined || bleedDbm > wfRow[k]) {
                            wfRow[k] = bleedDbm;
                        }
                    }
                }
            } else if (ch >= 32) {
                const k = `5_${ch}`;
                if (wfRow[k] === undefined || dbm > wfRow[k]) {
                    wfRow[k] = dbm;
                }
            }
        }
        state.waterfallHistory.push(wfRow);
        if (state.waterfallHistory.length > 30) {
            state.waterfallHistory.shift();
        }

        updateOverviewHeader();
        if (state.deviceFinder.open) {
            updateDeviceFinderModal();
        }

        if (document.hidden) return;
        renderCurrentTab();
    }

    // Scan Mode Selection Handling (Resilient Mode Switching)
    autoScanSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        state.scanMode = val;

        // Clear existing interval timers
        if (state.timerId) {
            clearInterval(state.timerId);
            state.timerId = null;
        }

        if (val === "0") {
            // Paused
            if (state.ws) { try { state.ws.close(); } catch(e){} state.ws = null; }
            if (state.eventSource) { try { state.eventSource.close(); } catch(e){} state.eventSource = null; }
            setLiveStatusIndicator(false, "PAUSED (THỦ CÔNG)");
        } else {
            // Start continuous engine
            setupContinuousEngine();
            setLiveStatusIndicator(true, `STREAM LIVE (${val}s)`);
        }
    });

    // Search and Filters
    networkSearch.addEventListener("input", (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        renderSurveyTable();
    });

    document.querySelectorAll(".filter-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            state.filterBand = pill.getAttribute("data-filter-band");
            renderSurveyTable();
        });
    });

    document.querySelectorAll(".chip-filter").forEach(chip => {
        chip.addEventListener("click", () => {
            document.querySelectorAll(".chip-filter").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            state.filterQuick = chip.getAttribute("data-quick-filter") || "all";
            renderSurveyTable();
        });
    });

    filterSecurity.addEventListener("change", (e) => {
        state.filterSecurity = e.target.value;
        renderSurveyTable();
    });

    // Table Header Sorting
    document.querySelectorAll("#survey-table th[data-sort]").forEach(th => {
        th.addEventListener("click", () => {
            const col = th.getAttribute("data-sort");
            if (state.sortColumn === col) {
                state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
            } else {
                state.sortColumn = col;
                state.sortDirection = "desc";
            }
            renderSurveyTable();
        });
    });

    // Scan Actions
    btnScan.addEventListener("click", () => {
        fetchScanData(true);
    });

    // Auto-Pick Actions
    if (btnQuickAutoPick) btnQuickAutoPick.addEventListener("click", () => {
        switchToTab("tab-optimizer");
        triggerAutoPick();
    });

    btnTriggerAutoPick.addEventListener("click", () => {
        triggerAutoPick();
    });

    function switchToTab(tabId) {
        document.querySelectorAll(".nav-tab").forEach(b => {
            b.classList.toggle("active", b.getAttribute("data-tab") === tabId);
        });
        document.querySelectorAll(".tab-pane").forEach(p => {
            p.classList.toggle("active", p.id === tabId);
        });
        state.currentTab = tabId;
        if (tabId === "tab-spectrum") {
            setTimeout(drawSpectrumGraphs, 50);
        }
    }

    // Close AP Drawer
    btnCloseDrawer.addEventListener("click", () => {
        apDrawer.classList.add("hidden");
    });

    // Fetch Live Scan Data (HTTP REST fallback)
    async function fetchScanData(force = false) {
        setScanLoading(true);
        try {
            const res = await fetch(`/api/scan?force=${force}`);
            if (!res.ok) throw new Error("Failed to scan Wi-Fi");
            const data = await res.json();
            handleLiveUpdate(data);
        } catch (err) {
            console.error("Scan error:", err);
        } finally {
            setScanLoading(false);
        }
    }

    function setScanLoading(loading) {
        if (loading) {
            scanIcon.classList.add("icon-pulse");
        } else {
            scanIcon.classList.remove("icon-pulse");
        }
    }

    // Update Top Overview Cards (uupm.cc SaaS Analytics KPI Cards) & Active Connection Bar
    function updateOverviewHeader() {
        const stats = state.analysis;
        if (!stats) return;
        const isVi = state.currentLang === "vi";

        document.getElementById("stat-total-aps").textContent = stats.total_aps;
        document.getElementById("stat-unique-ssids").textContent = stats.unique_ssids;
        
        const healthEl = document.getElementById("stat-health-score");
        healthEl.innerHTML = `${stats.global_score} <span class="score-max">/ 100</span>`;
        if (stats.global_score >= 80) healthEl.style.color = "var(--success)";
        else if (stats.global_score >= 60) healthEl.style.color = "var(--warning)";
        else healthEl.style.color = "var(--danger)";

        const best24 = stats.evaluation_24ghz?.recommended_channel ?? "--";
        const score24 = stats.evaluation_24ghz?.recommended_score ?? 80;
        const best5 = stats.evaluation_5ghz?.recommended_channel ?? "--";
        const score5 = stats.evaluation_5ghz?.recommended_score ?? 90;
        document.getElementById("stat-best-24").textContent = `Ch ${best24}`;
        document.getElementById("stat-best-5").textContent = `Ch ${best5}`;

        // Update SaaS KPI Trend Pills & Progress Bars
        const trendAps = document.getElementById("stat-trend-aps");
        if (trendAps) {
            trendAps.textContent = stats.total_aps > 20 ? (isVi ? "Mật độ cao" : "High Density") : (isVi ? "Bình thường" : "Normal");
            trendAps.className = `stat-trend-pill ${stats.total_aps > 20 ? "trend-warn" : "trend-info"}`;
        }
        const barAps = document.getElementById("stat-bar-aps");
        if (barAps) barAps.style.width = `${Math.min(100, Math.round((stats.total_aps / 35) * 100))}%`;

        const trendSsids = document.getElementById("stat-trend-ssids");
        if (trendSsids) {
            const clusterCount = (state.clusters || []).length || stats.unique_ssids;
            trendSsids.textContent = `${clusterCount} ${isVi ? "Cụm" : "Clusters"}`;
        }
        const barSsids = document.getElementById("stat-bar-ssids");
        if (barSsids) barSsids.style.width = `${Math.min(100, Math.round((stats.unique_ssids / 25) * 100))}%`;

        const trendHealth = document.getElementById("stat-trend-health");
        if (trendHealth) {
            if (stats.global_score >= 80) {
                trendHealth.textContent = isVi ? "Tốt" : "Optimal";
                trendHealth.className = "stat-trend-pill trend-good";
            } else if (stats.global_score >= 60) {
                trendHealth.textContent = isVi ? "Khá" : "Fair";
                trendHealth.className = "stat-trend-pill trend-warn";
            } else {
                trendHealth.textContent = isVi ? "Nhiễu" : "Congested";
                trendHealth.className = "stat-trend-pill trend-crit";
            }
        }
        const barHealth = document.getElementById("stat-bar-health");
        if (barHealth) barHealth.style.width = `${Math.min(100, Math.max(8, stats.global_score))}%`;

        const trend24 = document.getElementById("stat-trend-24");
        if (trend24) trend24.textContent = `${score24}/100`;
        const bar24 = document.getElementById("stat-bar-24");
        if (bar24) bar24.style.width = `${Math.min(100, Math.max(10, score24))}%`;

        const trend5 = document.getElementById("stat-trend-5");
        if (trend5) trend5.textContent = `${score5}/100`;
        const bar5 = document.getElementById("stat-bar-5");
        if (bar5) bar5.style.width = `${Math.min(100, Math.max(10, score5))}%`;

        // Active Connection Bar & Roaming Advisor
        const conn = state.interface;
        const connCard = document.getElementById("active-connection-card");
        if (conn && conn.connected && conn.ssid) {
            connCard.classList.remove("hidden");
            document.getElementById("conn-ssid").textContent = conn.ssid;
            document.getElementById("conn-band-badge").textContent = conn.band || "Wi-Fi";
            document.getElementById("conn-ch").textContent = `Ch ${conn.channel || '?'}`;
            document.getElementById("conn-sig").textContent = `${conn.rssi ? conn.rssi + ' dBm' : (conn.signal ? conn.signal + '%' : '')}`;
            
            let roamNotice = "";
            if (String(conn.band).includes("2.4")) {
                const alt5g = (state.networks || []).find(n => n.ssid === conn.ssid && String(n.band).includes("5") && (n.signal_dbm || -100) > -75);
                if (alt5g) {
                    roamNotice = ` • <span style="color:#10b981; font-weight:700;" title="Router nhà bạn có phát cả sóng 5GHz siêu tốc! Hãy kết nối sóng 5G để tăng tốc gấp 3 lần!">💡 Mẹo: Chuyển sang sóng 5GHz (${alt5g.signal_dbm} dBm)</span>`;
                }
            }
            document.getElementById("conn-rates").innerHTML = (conn.tx_rate ? `${conn.tx_rate} Mbps` : (conn.radio_type || '')) + roamNotice;
        } else {
            connCard.classList.add("hidden");
        }
    }

    // Render Survey Table with Filters and Sorting
    function renderSurveyTable() {
        if (!state.networks || state.networks.length === 0) {
            surveyTableBody.innerHTML = `<tr><td colspan="11" class="loading-row">Không tìm thấy sóng Wi-Fi xung quanh. Đang quét...</td></tr>`;
            return;
        }

        let filtered = state.networks.filter(net => {
            if (state.filterBand !== "all" && !String(net.band).includes(state.filterBand)) return false;
            if (state.filterQuick && state.filterQuick !== "all") {
                if (state.filterQuick === "connected" && !net.is_connected) return false;
                if (state.filterQuick === "open") {
                    const auth = String(net.authentication || "").toLowerCase();
                    const enc = String(net.encryption || "").toLowerCase();
                    if (!auth.includes("open") && !enc.includes("none")) return false;
                }
                if (state.filterQuick === "hidden" && !net.is_hidden) return false;
                if (state.filterQuick === "threats" && net.threat_level !== "WARNING" && net.threat_level !== "CRITICAL") return false;
            }
            if (state.filterSecurity !== "all") {
                const auth = String(net.authentication || "").toLowerCase();
                if (state.filterSecurity === "open" && !auth.includes("open") && !String(net.encryption).toLowerCase().includes("none")) return false;
                if (state.filterSecurity === "wpa2" && !auth.includes("wpa2")) return false;
                if (state.filterSecurity === "wpa3" && !auth.includes("wpa3")) return false;
                if (state.filterSecurity === "enterprise" && !auth.includes("enterprise")) return false;
            }
            if (state.searchQuery) {
                const q = state.searchQuery;
                const matchSsid = String(net.ssid || "").toLowerCase().includes(q);
                const matchBssid = String(net.bssid || "").toLowerCase().includes(q);
                const matchVendor = String(net.vendor || "").toLowerCase().includes(q);
                if (!matchSsid && !matchBssid && !matchVendor) return false;
            }
            return true;
        });

        // Sorting
        filtered.sort((a, b) => {
            let valA = a[state.sortColumn];
            let valB = b[state.sortColumn];

            if (state.sortColumn === "signal") {
                valA = a.signal_percent ?? 0;
                valB = b.signal_percent ?? 0;
            } else if (state.sortColumn === "connected") {
                valA = a.is_connected ? 1 : 0;
                valB = b.is_connected ? 1 : 0;
            } else if (state.sortColumn === "utilization") {
                valA = a.channel_utilization_pct ?? 0;
                valB = b.channel_utilization_pct ?? 0;
            }

            if (valA < valB) return state.sortDirection === "asc" ? -1 : 1;
            if (valA > valB) return state.sortDirection === "asc" ? 1 : -1;
            return 0;
        });

        if (filtered.length === 0) {
            surveyTableBody.innerHTML = `<tr><td colspan="11" class="loading-row">Không có mạng Wi-Fi nào khớp với bộ lọc tìm kiếm.</td></tr>`;
            return;
        }

        const isVi = state.currentLang === "vi";
        surveyTableBody.innerHTML = filtered.map(net => {
            const sig = net.signal_percent || 0;
            const dbm = net.signal_dbm || -100;
            const snr = net.snr_db !== undefined ? net.snr_db : Math.max(0, dbm + 95);
            const nf = net.noise_floor_dbm !== undefined ? net.noise_floor_dbm : -95;
            const mcs = net.mcs_index !== undefined ? `MCS ${net.mcs_index}` : "";
            const mod = net.modulation || "";
            const bw = net.channel_width_mhz ? `${net.channel_width_mhz}MHz` : "20MHz";
            const estTp = net.est_throughput_mbps !== undefined ? `${net.est_throughput_mbps} Mbps` : "";

            let sigClass = "sig-poor";
            let sigLabel = isVi ? "Rất Yếu" : "Very Poor";
            if (dbm >= -50) {
                sigClass = "sig-excellent";
                sigLabel = isVi ? "Rất Mạnh (Game/4K)" : "Excellent (Game/4K)";
            } else if (dbm >= -65) {
                sigClass = "sig-good";
                sigLabel = isVi ? "Tốt (Mượt mà)" : "Good (Smooth)";
            } else if (dbm >= -75) {
                sigClass = "sig-fair";
                sigLabel = isVi ? "Trung Bình (Chập chờn)" : "Fair (Unstable)";
            } else {
                sigLabel = isVi ? "Yếu (Dễ rớt gói)" : "Poor (Packet Loss)";
            }

            const gen = net.wifi_generation || "Wi-Fi 4";
            let genBadgeClass = "badge-gen-4";
            if (gen.includes("7")) genBadgeClass = "badge-gen-7";
            else if (gen.includes("6")) genBadgeClass = "badge-gen-6";
            else if (gen.includes("5")) genBadgeClass = "badge-gen-5";

            const auth = net.authentication || "Open";
            let secBadgeClass = "badge-sec-wpa2";
            let isOpenSec = false;
            if (auth.toLowerCase().includes("open") || String(net.encryption).toLowerCase().includes("none")) {
                secBadgeClass = "badge-sec-open";
                isOpenSec = true;
            } else if (auth.toLowerCase().includes("wpa3")) {
                secBadgeClass = "badge-sec-wpa3";
            } else if (auth.toLowerCase().includes("enterprise")) {
                secBadgeClass = "badge-sec-ent";
            }

            const activeRowClass = net.is_connected ? "active-row" : "";
            const connIcon = net.is_connected ? `<i data-lucide="check-circle" class="conn-indicator"></i>` : ``;

            const bssLoadDisplay = net.channel_utilization_pct !== null ? `${net.channel_utilization_pct}%` : `N/A`;
            const clientsDisplay = net.connected_stations > 0 ? (isVi ? `(${net.connected_stations} máy)` : `(${net.connected_stations} stas)`) : ``;

            let ssidHtml = escapeHtml(net.ssid || "[Hidden Network]");
            if (net.is_hidden && net.is_decloaked && net.decloaked_ssid) {
                ssidHtml = `
                    <div class="decloaked-wrapper">
                        <span class="decloaked-badge" title="${isVi ? 'Giải mã thành công nhờ phân tích phần cứng BSSID! Độ tin cậy: ' : 'De-cloaked via BSSID Topology! Confidence: '}${net.decloak_confidence}%">
                            <i data-lucide="unlock" style="width:11px; height:11px; display:inline; margin-right:3px;"></i>${isVi ? 'ĐÃ GIẢI MÃ' : 'UNCLOAKED'}
                        </span>
                        <span class="decloaked-name">${escapeHtml(net.decloaked_ssid)}</span>
                        <span class="decloaked-sub">${escapeHtml(net.decloak_role || (isVi ? 'Mạng liên kết ẩn' : 'Hidden Link'))}</span>
                    </div>
                `;
            } else if (net.is_hidden) {
                ssidHtml = `<span class="hidden-raw">[Hidden Network]</span>`;
            }

            let threatBadge = "";
            if (net.threat_level === "CRITICAL") {
                threatBadge = ` <span class="badge badge-threat-crit" title="${escapeHtml(net.threat_description || '')}">⚠️ ${isVi ? 'GIẢ MẠO AP' : 'EVIL TWIN'}</span>`;
            } else if (net.threat_level === "WARNING") {
                threatBadge = ` <span class="badge badge-threat-warn" title="${escapeHtml(net.threat_description || '')}">⚠️ ${isVi ? 'CẢNH BÁO' : 'WARNING'}</span>`;
            }

            let roamBadge = "";
            if (net.roaming_status === "STICKY_CLIENT") {
                roamBadge = ` <span class="badge" style="background:#f59e0b; color:#111; font-weight:700;" title="${escapeHtml(net.roaming_note || '')}">🔄 ${isVi ? 'CẦN ROAMING' : 'STICKY CLIENT'}</span>`;
            }

            const dfsBadge = net.is_dfs ? `<span class="badge badge-dfs" title="${isVi ? 'Kênh Radar quân sự/khí tượng (DFS - UNII-2)' : 'DFS Radar Channel'}">DFS</span>` : '';

            return `
                <tr class="${activeRowClass}" onclick="window.inspectAP('${net.bssid}')">
                    <td style="text-align: center;">${connIcon}</td>
                    <td class="ssid-cell">
                        ${ssidHtml}
                        ${threatBadge}
                        ${roamBadge}
                        ${net.is_connected ? `<span class="badge" style="background:#10b981; color:#fff;">${isVi ? 'ĐANG NỐI' : 'CONNECTED'}</span>` : ''}
                        ${(net.cluster_size && net.cluster_size > 1) ? `<span class="badge" style="background:#182238; border:1px solid #0ea5e9; color:#38bdf8; font-size:0.68rem;" title="${isVi ? 'Cùng thiết bị phần cứng đa băng tần' : 'Same physical multi-band hardware'}">🔗 Cụm ${net.cluster_size} BSSID</span>` : ''}
                        ${isOpenSec ? `<span class="badge" style="background:#ef4444; color:#fff; font-size:0.65rem;" title="${isVi ? 'Mạng không mã hóa! Nguy cơ lộ thông tin' : 'Unencrypted network! High sniffing risk'}">${isVi ? '⚠️ KHÔNG BẢO MẬT' : '⚠️ UNSECURED'}</span>` : ''}
                    </td>
                    <td class="mac-cell">${net.bssid}</td>
                    <td>${escapeHtml(net.vendor || (isVi ? 'Không rõ' : 'Unknown'))}</td>
                    <td>
                        <div class="signal-meter-wrapper">
                            <div class="signal-bar-bg">
                                <div class="signal-bar-fill ${sigClass}" style="width: ${sig}%;"></div>
                            </div>
                            <span><b>${dbm}</b> dBm (${sig}%) &bull; <b style="color:#38bdf8;">SNR ${snr} dB</b> <small style="display:block; font-size:0.72rem; color:var(--text-secondary);">NF: ${nf} dBm | ${sigLabel}</small></span>
                        </div>
                    </td>
                    <td><b>${isVi ? 'Kênh' : 'Ch'} ${net.channel}</b> <small style="color:var(--text-secondary);">(${bw})</small> ${dfsBadge}</td>
                    <td>${net.band}</td>
                    <td>
                        <span class="badge ${genBadgeClass}">${gen}</span>
                        ${mcs ? `<small style="display:block; font-size:0.7rem; color:#38bdf8; margin-top:2px;">${mcs} (${mod})</small>` : ''}
                    </td>
                    <td><span class="badge ${secBadgeClass}">${auth}</span></td>
                    <td>
                        ${bssLoadDisplay} ${clientsDisplay}
                        ${estTp ? `<small style="display:block; font-size:0.72rem; color:#10b981; font-weight:600;">~${estTp}</small>` : ''}
                    </td>
                    <td>
                        <div style="display:flex; gap:5px; align-items:center;">
                            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); window.inspectAP('${net.bssid}')">
                                ${isVi ? 'Chi Tiết' : 'Details'}
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); window.openDeviceFinder('${net.bssid}')" title="${isVi ? 'Dò hướng tín hiệu vật lý của trạm phát này' : 'Track directional signal for this AP'}" style="border-color:rgba(14,165,233,0.4); color:#38bdf8;">
                                🎯
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        safeCreateIcons();
    }

    // Switch between Flat BSSID List View and Hardware Topology Clusters
    window.switchSurveyView = function(view) {
        state.surveyView = view;
        const btnList = document.getElementById("btn-view-list");
        const btnCluster = document.getElementById("btn-view-cluster");
        const tableContainer = document.getElementById("table-container-view");
        const clusterContainer = document.getElementById("cluster-container");

        if (view === "cluster") {
            if (btnList) { btnList.classList.remove("active", "btn-primary"); btnList.classList.add("btn-secondary"); }
            if (btnCluster) { btnCluster.classList.add("active", "btn-primary"); btnCluster.classList.remove("btn-secondary"); }
            if (tableContainer) tableContainer.classList.add("hidden");
            if (clusterContainer) { clusterContainer.classList.remove("hidden"); renderClusterView(); }
        } else {
            if (btnCluster) { btnCluster.classList.remove("active", "btn-primary"); btnCluster.classList.add("btn-secondary"); }
            if (btnList) { btnList.classList.add("active", "btn-primary"); btnList.classList.remove("btn-secondary"); }
            if (clusterContainer) clusterContainer.classList.add("hidden");
            if (tableContainer) { tableContainer.classList.remove("hidden"); renderSurveyTable(); }
        }
        safeCreateIcons();
    };

    // Update RF Security Banner
    function updateThreatBanner() {
        const badge = document.getElementById("survey-threat-indicator");
        if (!badge) return;

        const isVi = state.currentLang === "vi";
        const threats = state.threats;
        if (!threats || threats.status === "SECURE" || threats.total_threats === 0) {
            badge.style.color = "#10b981";
            badge.style.background = "rgba(16, 185, 129, 0.08)";
            badge.style.borderColor = "rgba(16, 185, 129, 0.2)";
            badge.innerHTML = `<i data-lucide="shield-check" style="width:16px; height:16px;"></i> <span>${isVi ? 'An Ninh Sóng: An Toàn (Không có trạm giả mạo)' : 'RF Security: Clean (No Rogue APs)'}</span>`;
        } else if (threats.status === "DANGER" || threats.critical_count > 0) {
            badge.style.color = "#ef4444";
            badge.style.background = "rgba(239, 68, 68, 0.12)";
            badge.style.borderColor = "rgba(239, 68, 68, 0.3)";
            badge.innerHTML = `<i data-lucide="alert-triangle" style="width:16px; height:16px;"></i> <span>${isVi ? `CẢNH BÁO: Phát hiện ${threats.critical_count} trạm phát giả mạo!` : `CRITICAL: ${threats.critical_count} Evil Twin AP Detected!`}</span>`;
        } else {
            badge.style.color = "#f59e0b";
            badge.style.background = "rgba(245, 158, 11, 0.1)";
            badge.style.borderColor = "rgba(245, 158, 11, 0.25)";
            badge.innerHTML = `<i data-lucide="alert-circle" style="width:16px; height:16px;"></i> <span>${isVi ? `Lưu ý: Có ${threats.warning_count} trạm phát cần chú ý` : `Notice: ${threats.warning_count} anomaly APs`}</span>`;
        }
        safeCreateIcons();
    }

    // Render Hardware Topology & Mesh Clusters View
    function renderClusterView() {
        const container = document.getElementById("cluster-container");
        if (!container) return;

        const isVi = state.currentLang === "vi";
        const clusters = state.clusters || [];

        if (clusters.length === 0) {
            container.innerHTML = `<div class="loading-row" style="text-align:center; padding:30px; color:var(--text-secondary);">${isVi ? 'Đang phân tích cấu trúc phần cứng các trạm phát...' : 'Analyzing hardware device topologies...'}</div>`;
            return;
        }

        container.innerHTML = clusters.map((c) => {
            const hasDecloaked = c.has_decloaked;
            const bssCount = c.bss_count || (c.members ? c.members.length : 1);
            const maxDbm = c.max_signal_dbm || -100;
            const maxPct = c.max_signal_percent || 0;
            const bandsStr = (c.bands || []).join(" + ");
            const channelsStr = (c.channels || []).join(", ");

            const membersHtml = (c.members || []).map(m => {
                const isHidden = m.is_hidden;
                const isDecloaked = m.is_decloaked;
                const dfsBadge = m.is_dfs ? `<span class="badge badge-dfs">DFS</span>` : '';

                let nameDisplay = escapeHtml(m.ssid);
                if (isHidden && isDecloaked) {
                    nameDisplay = `<span class="decloaked-badge"><i data-lucide="unlock" style="width:10px; height:10px; margin-right:3px; display:inline;"></i>${isVi ? 'ĐÃ GIẢI MÃ' : 'UNCLOAKED'}</span> <b style="color:#38bdf8;">${escapeHtml(m.decloaked_ssid)}</b> <span style="font-size:0.75rem; color:var(--text-secondary); font-style:italic;">(${escapeHtml(m.decloak_role || '')})</span>`;
                } else if (isHidden) {
                    nameDisplay = `<span class="hidden-raw">[Hidden Network]</span>`;
                }

                return `
                    <tr>
                        <td style="width: 35%;">
                            ${nameDisplay}
                            ${m.is_connected ? `<span class="badge" style="background:#10b981; color:#fff; font-size:0.65rem;">${isVi ? 'ĐANG NỐI' : 'CONNECTED'}</span>` : ''}
                        </td>
                        <td class="mac-cell" style="width: 20%;">${m.bssid}</td>
                        <td style="width: 15%;"><b>${isVi ? 'Kênh' : 'Ch'} ${m.channel}</b> (${m.band}) ${dfsBadge}</td>
                        <td style="width: 15%;"><b>${m.signal_dbm} dBm</b> (${m.signal_percent}%)</td>
                        <td style="width: 15%; text-align: right;">
                            <button class="btn btn-sm btn-secondary" onclick="window.inspectAP('${m.bssid}')">
                                ${isVi ? 'Chi Tiết' : 'Details'}
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="window.openDeviceFinder('${m.bssid}')" title="Dò hướng tín hiệu">
                                🎯
                            </button>
                        </td>
                    </tr>
                `;
            }).join("");

            return `
                <div class="cluster-card">
                    <div class="cluster-header">
                        <div class="cluster-title-wrap">
                            <div class="cluster-icon">
                                <i data-lucide="router"></i>
                            </div>
                            <div>
                                <div class="cluster-title">${escapeHtml(c.parent_ssid || 'Access Point')}</div>
                                <div class="cluster-vendor">${escapeHtml(c.vendor || 'Generic IEEE 802.11')} &bull; BSSID Gốc: <code>${c.parent_bssid}</code></div>
                            </div>
                        </div>
                        <div class="cluster-badges">
                            ${hasDecloaked ? `<span class="badge" style="background:linear-gradient(135deg, #059669, #10b981); color:#fff; font-size:0.75rem;"><i data-lucide="unlock" style="width:12px; height:12px; display:inline; margin-right:4px;"></i>${isVi ? 'CHỨA MẠNG MESH ẨN ĐÃ GIẢI MÃ' : 'UNCLOAKED MESH LINK'}</span>` : ''}
                            <span class="badge" style="background:rgba(56, 189, 248, 0.15); color:#38bdf8;">${bssCount} BSSIDs</span>
                            <span class="badge" style="background:rgba(148, 163, 184, 0.15); color:var(--text-secondary);">${bandsStr} (Kênh ${channelsStr})</span>
                            <span class="badge" style="background:rgba(16, 185, 129, 0.15); color:#10b981;"><b>${maxDbm} dBm</b> (${maxPct}%)</span>
                        </div>
                    </div>
                    <table class="cluster-subtable">
                        <thead>
                            <tr>
                                <th>${isVi ? 'Tên Phát Sóng (SSID / Vai Trò)' : 'SSID / Role'}</th>
                                <th>${isVi ? 'Địa Chỉ MAC (BSSID)' : 'BSSID MAC'}</th>
                                <th>${isVi ? 'Kênh & Băng Tần' : 'Channel & Band'}</th>
                                <th>${isVi ? 'Cường Độ Sóng' : 'Signal (RSSI)'}</th>
                                <th style="text-align: right;">${isVi ? 'Thao Tác' : 'Action'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${membersHtml}
                        </tbody>
                    </table>
                </div>
            `;
        }).join("");

        safeCreateIcons();
    }

    // Inspect AP Details Drawer
    window.inspectAP = function(bssid) {
        const net = state.networks.find(n => n.bssid === bssid);
        if (!net) return;

        document.getElementById("drawer-ssid").textContent = net.ssid;
        const body = document.getElementById("drawer-content");

        const isOpen = String(net.authentication || "").toLowerCase().includes("open") || String(net.encryption || "").toLowerCase().includes("none");

        const isVi = state.currentLang === "vi";
        const snr = net.snr_db !== undefined ? net.snr_db : Math.max(0, (net.signal_dbm || -80) + 95);
        const nf = net.noise_floor_dbm !== undefined ? net.noise_floor_dbm : -95;

        body.innerHTML = `
            <div style="margin-bottom: 12px;">
                <button class="btn btn-primary btn-sm" style="width: 100%; justify-content: center;" onclick="window.openDeviceFinder('${net.bssid}')">
                    🎯 ${isVi ? 'Dò Hướng & Định Vị Vật Lý Trạm Phát Này (Device Finder)' : 'Track Directional Signal for This AP (Device Finder)'}
                </button>
            </div>
            <div class="drawer-field">
                <div class="drawer-field-label">${isVi ? 'Tên Mạng (SSID)' : 'Network Name (SSID)'}</div>
                <div class="drawer-field-val">${escapeHtml(net.ssid)}</div>
            </div>
            <div class="drawer-field">
                <div class="drawer-field-label">${isVi ? 'Địa Chỉ MAC Vật Lý (BSSID)' : 'Physical MAC Address (BSSID)'}</div>
                <div class="drawer-field-val mac-cell">${net.bssid}</div>
            </div>
            <div class="drawer-field">
                <div class="drawer-field-label">${isVi ? 'Hãng Sản Xuất Thiết Bị (Vendor)' : 'Hardware Manufacturer (Vendor)'}</div>
                <div class="drawer-field-val">${net.vendor || (isVi ? 'Không rõ' : 'Unknown')}</div>
            </div>
            <div class="drawer-field">
                <div class="drawer-field-label">${isVi ? 'Tín Hiệu Thu (RSSI) & Tỷ Lệ Tín Hiệu/Nhiễu (SNR)' : 'Signal (RSSI) & SNR / Noise Floor'}</div>
                <div class="drawer-field-val">
                    <b>${net.signal_dbm} dBm</b> (${net.signal_percent}%) &bull; <b style="color:#38bdf8;">SNR: ${snr} dB</b>
                    <div style="font-size:0.78rem; color:var(--text-secondary); margin-top:2px;">${isVi ? 'Nhiễu nền ước tính (Noise Floor):' : 'Estimated Noise Floor:'} ${nf} dBm</div>
                </div>
            </div>
            <div class="drawer-field">
                <div class="drawer-field-label">${isVi ? 'Kênh Tần Số & Độ Rộng Kênh' : 'Channel, Band & Width'}</div>
                <div class="drawer-field-val">${isVi ? 'Kênh' : 'Channel'} ${net.channel} (${net.band} - ${net.frequency_mhz} MHz) &bull; <b>${net.channel_width_mhz || 20} MHz</b></div>
            </div>
            <div class="drawer-field">
                <div class="drawer-field-label">${isVi ? 'Chuẩn Wi-Fi, Điều Chế & Chỉ Số MCS' : 'Wi-Fi Generation, Modulation & MCS Index'}</div>
                <div class="drawer-field-val">
                    ${net.wifi_generation} (${net.radio_type}) &bull; <b style="color:#10b981;">MCS ${net.mcs_index ?? 7} (${net.modulation || '64-QAM'})</b>
                </div>
            </div>
            <div class="drawer-field">
                <div class="drawer-field-label">${isVi ? 'Băng Thông Lý Thuyết (PHY) & Tốc Độ Thực Tế (TCP/IP)' : 'PHY Link Rate & Est. Real TCP/IP Throughput'}</div>
                <div class="drawer-field-val">
                    PHY: <b>${net.phy_rate_mbps || 144} Mbps</b> &rarr; ${isVi ? 'Thực đạt ước tính:' : 'Est. Real Throughput:'} <b style="color:#38bdf8;">~${net.est_throughput_mbps || 85} Mbps</b>
                </div>
            </div>
            <div class="drawer-field">
                <div class="drawer-field-label">${isVi ? 'Chế Độ Bảo Mật & Mã Hóa' : 'Security Mode & Encryption'}</div>
                <div class="drawer-field-val">
                    ${net.authentication} / ${net.encryption}
                    ${isOpen ? `<div style="margin-top:6px; color:#ef4444; font-size:0.8rem; line-height:1.4;">${isVi ? '⚠️ <b>Cảnh báo an ninh:</b> Sóng truyền dữ liệu không mã hóa! Bất kỳ ai cũng có thể bắt gói tin hoặc giả mạo trạm phát sóng. Nên vào Router bật WPA2-PSK (AES) hoặc WPA3-SAE ngay.' : '⚠️ <b>Security Alert:</b> Unencrypted transmission! Anyone within range can capture packets or deploy a rogue AP. Enable WPA2-PSK (AES) or WPA3-SAE immediately.'}</div>` : ''}
                </div>
            </div>
            <div class="drawer-field">
                <div class="drawer-field-label">${isVi ? 'Tải Kênh Vô Tuyến (BSS Load)' : 'Channel Utilization (BSS Load)'}</div>
                <div class="drawer-field-val">${net.channel_utilization_pct !== null ? net.channel_utilization_pct + '%' : (isVi ? 'Thiết bị không phát gói thông tin BSS load' : 'AP does not beacon BSS load element')}</div>
            </div>
            <div class="drawer-field">
                <div class="drawer-field-label">${isVi ? 'Số Máy Khách Đang Kết Nối' : 'Active Connected Clients'}</div>
                <div class="drawer-field-val">${net.connected_stations} ${isVi ? 'Thiết Bị' : 'Stations'}</div>
            </div>
            <div class="drawer-field">
                <div class="drawer-field-label">${isVi ? 'Tốc Độ Hỗ Trợ (Supported Rates)' : 'Supported Data Rates'}</div>
                <div class="drawer-field-val" style="font-size: 0.75rem;">${(net.rates && net.rates.length) ? net.rates.join(', ') + ' Mbps' : (isVi ? 'Chuẩn tốc độ 802.11 thông thường' : 'Standard 802.11 legacy rates')}</div>
            </div>
            ${net.roaming_note ? `
            <div class="drawer-field" style="background: rgba(245, 158, 11, 0.08); border-left: 3px solid #f59e0b; padding: 10px; border-radius: 4px; margin-top: 10px;">
                <div class="drawer-field-label" style="color: #fbbf24; font-weight: 700;">
                    🔄 ${isVi ? 'ĐÁNH GIÁ CHUYỂN VÙNG (MULTI-AP ROAMING)' : 'MULTI-AP ROAMING AUDIT'}
                </div>
                <div class="drawer-field-val" style="font-size: 0.8rem; line-height: 1.4; color: var(--text-primary); margin-top: 4px;">
                    ${escapeHtml(net.roaming_note)}
                </div>
            </div>
            ` : ''}
            ${net.is_hidden ? `
            <div class="drawer-field" style="background: rgba(16, 185, 129, 0.08); border-left: 3px solid #10b981; padding: 10px; border-radius: 4px; margin-top: 10px;">
                <div class="drawer-field-label" style="color: #10b981; font-weight: 700;">
                    <i data-lucide="unlock" style="width:14px; height:14px; display:inline; vertical-align:middle;"></i> ${isVi ? 'THÔNG TIN GIẢI MÃ MẠNG ẨN (BSSID CLUSTERING)' : 'HIDDEN SSID DE-CLOAKING DETAILS'}
                </div>
                <div class="drawer-field-val" style="font-size: 0.82rem; line-height: 1.5; margin-top: 5px;">
                    <div>• <b>${isVi ? 'Tên giải mã' : 'De-cloaked Name'}:</b> <span style="color:#38bdf8; font-weight:600;">${escapeHtml(net.decloaked_ssid || net.ssid)}</span></div>
                    <div>• <b>${isVi ? 'Thiết bị gốc' : 'Parent Hardware'}:</b> ${escapeHtml(net.parent_ssid || 'N/A')} (${net.parent_bssid || 'N/A'})</div>
                    <div>• <b>${isVi ? 'Bản chất mạng' : 'Inferred Role'}:</b> ${escapeHtml(net.decloak_role || (isVi ? 'Mạng ngầm nội bộ' : 'Internal Backhaul'))}</div>
                    <div>• <b>${isVi ? 'Độ tin cậy' : 'Confidence'}:</b> ${net.decloak_confidence}%</div>
                    <div style="margin-top:6px; font-size:0.75rem; color:var(--text-secondary);">
                        ${isVi ? 'ℹ️ <b>Nguyên lý:</b> Bộ phát Wi-Fi Mesh hoặc bộ phát đa băng tần thường tạo thêm địa chỉ BSSID ẩn trên cùng phần cứng để truyền dữ liệu nội bộ (Backhaul). Hệ thống đối chiếu dải địa chỉ MAC và mức sóng thu để tìm ra bộ phát gốc.' : 'ℹ️ <b>Mechanism:</b> Mesh and dual-band routers generate unadvertised virtual BSSIDs on identical hardware for backhaul links. BSSID clustering correlates MAC offsets and RSSI to identify the parent AP.'}
                    </div>
                </div>
            </div>
            ` : ''}
            ${net.is_dfs ? `
            <div class="drawer-field" style="background: rgba(99, 102, 241, 0.08); border-left: 3px solid #6366f1; padding: 10px; border-radius: 4px; margin-top: 10px;">
                <div class="drawer-field-label" style="color: #818cf8; font-weight: 700;">
                    📡 ${isVi ? 'THÔNG TIN KÊNH RADAR DFS (UNII-2)' : 'DFS RADAR CHANNEL METRICS'}
                </div>
                <div class="drawer-field-val" style="font-size: 0.78rem; line-height: 1.5; color: var(--text-secondary); margin-top: 4px;">
                    ${isVi ? `Kênh ${net.channel} nằm trong dải tần chia sẻ với hệ thống Radar thời tiết và quân sự. Theo chuẩn IEEE 802.11h, nếu bộ phát phát hiện tín hiệu radar, nó bắt buộc phải tự động chuyển kênh trong vòng 60 giây.` : `Channel ${net.channel} resides in the UNII-2 DFS radar spectrum. In compliance with 802.11h, the AP must vacate this frequency upon detecting radar pulses.`}
                </div>
            </div>
            ` : ''}
            ${net.threat_description ? `
            <div class="drawer-field" style="background: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; padding: 10px; border-radius: 4px; margin-top: 10px;">
                <div class="drawer-field-label" style="color: #ef4444; font-weight: 700;">
                    ⚠️ ${isVi ? 'CẢNH BÁO AN NINH SÓNG' : 'RF SECURITY ALERT'}
                </div>
                <div class="drawer-field-val" style="font-size: 0.8rem; line-height: 1.4; color: #fca5a5; margin-top: 4px;">
                    ${escapeHtml(net.threat_description)}
                </div>
            </div>
            ` : ''}
        `;

        apDrawer.classList.remove("hidden");
    };

    // --- MODULE: Oscium Device Finder (Directional AP Signal Tracker) ---
    window.openDeviceFinder = function(bssid) {
        const modal = document.getElementById("device-finder-modal");
        if (!modal) return;
        state.deviceFinder.open = true;

        const nets = state.networks || [];
        let target = bssid;
        if (!target && nets.length > 0) {
            const connNet = nets.find(n => n.is_connected);
            target = connNet ? connNet.bssid : nets[0].bssid;
        }

        if (target && target !== state.deviceFinder.targetBssid) {
            state.deviceFinder.targetBssid = target;
            state.deviceFinder.peakDbm = -100;
            state.deviceFinder.minDbm = 0;
            state.deviceFinder.history = [];
        }

        modal.classList.remove("hidden");
        updateDeviceFinderModal();
        safeCreateIcons();
    };

    window.closeDeviceFinder = function() {
        state.deviceFinder.open = false;
        const modal = document.getElementById("device-finder-modal");
        if (modal) modal.classList.add("hidden");
    };

    window.changeDeviceFinderTarget = function(bssid) {
        state.deviceFinder.targetBssid = bssid;
        state.deviceFinder.peakDbm = -100;
        state.deviceFinder.minDbm = 0;
        state.deviceFinder.history = [];
        updateDeviceFinderModal();
    };

    window.resetDeviceFinderPeak = function() {
        state.deviceFinder.peakDbm = -100;
        state.deviceFinder.minDbm = 0;
        state.deviceFinder.history = [];
        updateDeviceFinderModal();
    };

    function updateDeviceFinderModal() {
        if (!state.deviceFinder.open) return;
        const isVi = state.currentLang === "vi";
        const nets = state.networks || [];
        const selectEl = document.getElementById("df-target-select");

        if (selectEl && nets.length > 0) {
            const curTarget = state.deviceFinder.targetBssid || nets[0].bssid;
            selectEl.innerHTML = nets.map(n => {
                const name = n.is_hidden && n.decloaked_ssid ? n.decloaked_ssid : (n.ssid || "[Hidden]");
                const sel = n.bssid === curTarget ? "selected" : "";
                return `<option value="${n.bssid}" ${sel}>${escapeHtml(name)} (${n.bssid}) — Ch ${n.channel} [${n.signal_dbm} dBm]</option>`;
            }).join("");
            if (!state.deviceFinder.targetBssid) {
                state.deviceFinder.targetBssid = curTarget;
            }
        }

        const net = nets.find(n => n.bssid === state.deviceFinder.targetBssid) || nets[0];
        if (!net) return;

        const dbm = Number(net.signal_dbm ?? -95);
        if (dbm > state.deviceFinder.peakDbm) state.deviceFinder.peakDbm = dbm;
        if (state.deviceFinder.minDbm === 0 || dbm < state.deviceFinder.minDbm) state.deviceFinder.minDbm = dbm;

        const prevDbm = state.deviceFinder.history.length > 0
            ? state.deviceFinder.history[state.deviceFinder.history.length - 1]
            : dbm;

        state.deviceFinder.history.push(dbm);
        if (state.deviceFinder.history.length > 40) state.deviceFinder.history.shift();

        // Proximity percentage (-92 dBm = 0%, -32 dBm = 100%)
        const proxPct = Math.max(2, Math.min(100, Math.round(((dbm - (-92)) / 60) * 100)));
        // Free-Space & Indoor Path Loss distance estimation
        const freqMhz = Number(net.frequency_mhz || (Number(net.channel) > 14 ? 5200 : 2437));
        const txPower = 20.0;
        const fspl1m = 20 * Math.log10(freqMhz) - 27.55;
        const pathLossExp = freqMhz > 5000 ? 3.0 : 2.7;
        const estDistM = Math.max(0.3, Math.min(80.0, Math.pow(10, (txPower - dbm - fspl1m) / (10 * pathLossExp)))).toFixed(1);

        const metaEl = document.getElementById("df-target-meta");
        if (metaEl) {
            metaEl.textContent = `SSID: ${net.ssid || '[Hidden]'} | BSSID: ${net.bssid} | ${net.band} Ch ${net.channel} | Vendor: ${net.vendor || 'Unknown'}`;
        }

        const rssiEl = document.getElementById("df-current-rssi");
        if (rssiEl) {
            rssiEl.textContent = `${dbm} dBm`;
            rssiEl.style.color = dbm >= -55 ? "#10b981" : (dbm >= -70 ? "#38bdf8" : (dbm >= -80 ? "#f59e0b" : "#ef4444"));
        }

        const barEl = document.getElementById("df-proximity-bar");
        if (barEl) barEl.style.width = `${proxPct}%`;

        const proxLabel = document.getElementById("df-proximity-label");
        if (proxLabel) {
            proxLabel.textContent = isVi
                ? `Mức độ tiệm cận: ${proxPct}% (${proxPct >= 80 ? 'Rất gần trạm phát!' : (proxPct >= 55 ? 'Khoảng cách trung bình' : 'Ở xa / Khuất tường')})`
                : `Proximity: ${proxPct}% (${proxPct >= 80 ? 'Very Close to AP!' : (proxPct >= 55 ? 'Moderate Distance' : 'Far / Behind Obstacles')})`;
        }

        const trendLabel = document.getElementById("df-trend-label");
        if (trendLabel) {
            const diff = dbm - prevDbm;
            if (diff >= 2) {
                trendLabel.textContent = isVi ? `▲ Sóng tăng +${diff} dB (Đang tiến lại gần AP)` : `▲ Signal +${diff} dB (Moving Closer)`;
                trendLabel.style.color = "#10b981";
            } else if (diff <= -2) {
                trendLabel.textContent = isVi ? `▼ Sóng giảm ${diff} dB (Đang đi ra xa / Bị chắn)` : `▼ Signal ${diff} dB (Moving Away)`;
                trendLabel.style.color = "#ef4444";
            } else {
                trendLabel.textContent = isVi ? `● Mức sóng ổn định (Giữ hướng di chuyển để dò đỉnh sóng)` : `● Signal steady (Move slowly to locate peak)`;
                trendLabel.style.color = "#38bdf8";
            }
        }

        const peakEl = document.getElementById("df-peak-rssi");
        if (peakEl) peakEl.textContent = `${state.deviceFinder.peakDbm} dBm`;

        const minEl = document.getElementById("df-min-rssi");
        if (minEl) minEl.textContent = `${state.deviceFinder.minDbm} dBm`;

        const distEl = document.getElementById("df-est-distance");
        if (distEl) distEl.textContent = `~${estDistM} m`;

        // Draw Device Finder Sparkline
        const dfCanvas = document.getElementById("canvas-device-finder");
        if (dfCanvas) {
            const ctx = dfCanvas.getContext("2d");
            const cw = dfCanvas.width;
            const ch = dfCanvas.height;
            ctx.fillStyle = "#060b16";
            ctx.fillRect(0, 0, cw, ch);

            ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
            ctx.lineWidth = 1;
            for (let d = -40; d >= -90; d -= 15) {
                const y = 14 + ((d - (-30)) / (-95 - (-30))) * (ch - 28);
                ctx.beginPath();
                ctx.moveTo(36, y);
                ctx.lineTo(cw - 12, y);
                ctx.stroke();
                ctx.fillStyle = "#64748b";
                ctx.font = "10px monospace";
                ctx.textAlign = "right";
                ctx.fillText(`${d}`, 32, y + 3);
            }

            const pts = state.deviceFinder.history;
            if (pts.length > 0) {
                ctx.beginPath();
                pts.forEach((val, idx) => {
                    const x = 36 + (idx / Math.max(1, 39)) * (cw - 48);
                    const y = 14 + ((Math.max(-95, Math.min(-30, val)) - (-30)) / (-95 - (-30))) * (ch - 28);
                    if (idx === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });
                ctx.strokeStyle = "#0ea5e9";
                ctx.lineWidth = 2.5;
                ctx.stroke();

                const lastVal = pts[pts.length - 1];
                const lx = 36 + ((pts.length - 1) / Math.max(1, 39)) * (cw - 48);
                const ly = 14 + ((Math.max(-95, Math.min(-30, lastVal)) - (-30)) / (-95 - (-30))) * (ch - 28);
                ctx.beginPath();
                ctx.arc(lx, ly, 4.5, 0, Math.PI * 2);
                ctx.fillStyle = "#10b981";
                ctx.fill();
            }
        }
    }

    // Render Channel Matrix Grid, Bonding Blocks & Oscium 4-Layer Checklist
    function renderOptimizerChannels() {
        if (!state.analysis) return;
        const ev24 = state.analysis.evaluation_24ghz;
        const ev5 = state.analysis.evaluation_5ghz;
        const ev6 = state.analysis.evaluation_6ghz;

        const grid24 = document.getElementById("grid-channels-24");
        const isVi = state.currentLang === "vi";
        const best24 = ev24.recommended_channel;
        document.getElementById("optimizer-best-24-badge").textContent = `${isVi ? 'Khuyên dùng' : 'Pick'}: Ch ${best24} (${ev24.recommended_score}/100)`;

        grid24.innerHTML = Object.values(ev24.channel_evaluations).map(item => {
            const isPicked = item.channel === best24;
            const score = item.health_score ?? 0;
            let scoreClass = "ch-score-high";
            if (score < 50) scoreClass = "ch-score-low";
            else if (score < 75) scoreClass = "ch-score-med";

            const apCount = item.same_channel_aps.length;
            const adjCount = item.overlapping_aps.length;

            return `
                <div class="channel-btn ${isPicked ? 'picked' : ''}" onclick="window.selectChannelDetail(2.4, ${item.channel})">
                    <div class="ch-num">${item.channel}</div>
                    <div class="ch-score ${scoreClass}">${score}</div>
                    <div class="ch-aps">${apCount} APs ${adjCount > 0 ? `(+${adjCount})` : ''}</div>
                </div>
            `;
        }).join("");

        const grid5 = document.getElementById("grid-channels-5");
        const best5 = ev5.recommended_channel;
        document.getElementById("optimizer-best-5-badge").textContent = `${isVi ? 'Khuyên dùng' : 'Pick'}: Ch ${best5} (${ev5.recommended_score}/100)`;

        grid5.innerHTML = Object.values(ev5.channel_evaluations).map(item => {
            const isPicked = item.channel === best5;
            const score = item.health_score ?? 0;
            let scoreClass = "ch-score-high";
            if (score < 50) scoreClass = "ch-score-low";
            else if (score < 75) scoreClass = "ch-score-med";

            const apCount = item.same_channel_aps.length;

            return `
                <div class="channel-btn ${isPicked ? 'picked' : ''}" onclick="window.selectChannelDetail(5, ${item.channel})">
                    <div class="ch-num">${item.channel}</div>
                    <div class="ch-score ${scoreClass}">${score}</div>
                    <div class="ch-aps">${apCount} APs ${item.is_dfs ? 'DFS' : ''}</div>
                </div>
            `;
        }).join("");

        const blocksList = document.getElementById("blocks-80mhz-list");
        const bestBlockName = ev5.recommended_80mhz_block;
        blocksList.innerHTML = (ev5.all_80mhz_blocks || []).map(b => {
            const isBest = b.block_name === bestBlockName;
            return `
                <div class="block-item ${isBest ? 'best-block' : ''}">
                    <div>
                        <div class="block-name">${b.block_name} ${isBest ? `<span class="badge" style="background:#10b981; color:#fff;">${isVi ? 'KHUYÊN DÙNG' : 'RECOMMENDED'}</span>` : ''}</div>
                        <div class="block-sub">${isVi ? 'Các kênh:' : 'Channels:'} ${b.primary_channels.join(', ')} • ${b.total_aps} ${isVi ? 'trạm cạnh tranh' : 'competing APs'} ${b.is_dfs ? '• DFS' : ''}</div>
                    </div>
                    <div class="block-score">${b.avg_score} / 100</div>
                </div>
            `;
        }).join("");

        // Render Oscium 6-Point All-in-One Troubleshooting Checklist & Non-Wi-Fi Signatures
        const checklistEl = document.getElementById("oscium-checklist-grid");
        const tsSuite = state.analysis.troubleshooting_suite;
        if (tsSuite) {
            const hsBadge = document.getElementById("oscium-health-score-badge");
            if (hsBadge) {
                const hScore = tsSuite.health_score !== undefined ? tsSuite.health_score : (state.analysis.global_score || 85);
                hsBadge.textContent = isVi ? `Sức Khỏe Mạng: ${hScore} / 100` : `Network Health: ${hScore} / 100`;
                hsBadge.style.color = hScore >= 80 ? "#10b981" : (hScore >= 60 ? "#f59e0b" : "#ef4444");
                hsBadge.style.borderColor = hsBadge.style.color;
                hsBadge.style.background = hScore >= 80 ? "rgba(16, 185, 129, 0.15)" : (hScore >= 60 ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)");
            }
        }

        if (checklistEl && tsSuite && tsSuite.checklist) {
            checklistEl.innerHTML = tsSuite.checklist.map(item => {
                const status = item.status || "PASS";
                const sevClass = status === "PASS" ? "severity-ok" : (status === "WARNING" ? "severity-warn" : "severity-crit");
                const badgeBg = status === "PASS" ? "#10b981" : (status === "WARNING" ? "#f59e0b" : "#ef4444");
                const statusText = status === "PASS" ? (isVi ? "ĐẠT CHUẨN" : "PASS") : (status === "WARNING" ? (isVi ? "CẢNH BÁO" : "WARNING") : (isVi ? "NGHIÊM TRỌNG" : "CRITICAL"));
                const title = isVi ? (item.category_vi || item.layer_vi) : (item.category_en || item.layer_en);
                const desc = isVi ? (item.summary_vi || item.detail_vi) : (item.summary_en || item.detail_en);
                const remed = isVi ? item.remediation_vi : (item.remediation_en || item.remediation_vi);

                return `
                    <div class="oscium-diag-card ${sevClass}">
                        <div class="oscium-diag-header">
                            <span class="oscium-diag-title">${escapeHtml(title)}</span>
                            <span class="badge" style="background:${badgeBg}; color:#fff;">${statusText}</span>
                        </div>
                        <div class="oscium-diag-metric">${escapeHtml(item.metric || "")}</div>
                        <div class="oscium-diag-desc">${escapeHtml(desc || "")}</div>
                        ${remed ? `<div style="margin-top: 6px; font-size: 0.76rem; color: #38bdf8; font-weight: 600;">💡 ${escapeHtml(remed)}</div>` : ''}
                    </div>
                `;
            }).join("");
        }

        const nonWifiEl = document.getElementById("oscium-non-wifi-grid");
        if (nonWifiEl && tsSuite && tsSuite.non_wifi_interferers) {
            nonWifiEl.innerHTML = tsSuite.non_wifi_interferers.map(nw => {
                const isDet = nw.detected;
                const cardBorder = isDet ? (nw.severity === "WARNING" ? "#f59e0b" : "#0ea5e9") : "var(--border-color)";
                const badgeColor = isDet ? (nw.severity === "WARNING" ? "#f59e0b" : "#0ea5e9") : "#10b981";
                const badgeText = isDet ? (isVi ? "PHÁT HIỆN" : "ACTIVE") : (isVi ? "KHÔNG CÓ" : "CLEAR");

                return `
                    <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid ${cardBorder}; border-radius: 6px; padding: 10px 12px; font-size: 0.8rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <span style="font-weight: 700; color: #f8fafc;">${escapeHtml(isVi ? nw.name_vi : nw.name_en)}</span>
                            <span class="badge" style="background: ${badgeColor}; color: #fff; font-size: 0.7rem; padding: 2px 6px;">${badgeText}</span>
                        </div>
                        <div style="color: var(--text-secondary); font-size: 0.75rem; margin-bottom: 3px;">
                            <span>${escapeHtml(nw.band)} &bull; ${escapeHtml(nw.freq_range)}</span>
                        </div>
                        <div style="color: #94a3b8; font-size: 0.76rem; line-height: 1.4; margin-bottom: 4px;">
                            ${escapeHtml(isVi ? nw.impact_vi : nw.impact_en)}
                        </div>
                        <div style="color: #38bdf8; font-size: 0.74rem; font-weight: 600;">
                            🛠️ ${escapeHtml(isVi ? nw.remediation_vi : (nw.remediation_en || nw.remediation_vi))}
                        </div>
                    </div>
                `;
            }).join("");
        }

        const auditBox = document.getElementById("roaming-airtime-audit-box");
        if (auditBox) {
            const at = state.analysis.airtime_breakdown || {};
            const roam = state.analysis.roaming_audit || [];
            const beaconPct = at.beacon_overhead_pct ?? 4;
            const dataPct = at.data_contention_pct ?? 15;
            const freePct = at.free_airtime_pct ?? 81;

            let roamHtml = roam.length === 0
                ? `<div style="color:#10b981; font-size:0.8rem;">✓ ${isVi ? 'Không có mạng đa AP nào gặp lỗi bám sóng yếu (Sticky Client).' : 'No multi-AP roaming sticky client anomalies detected.'}</div>`
                : roam.map(r => `
                    <div style="padding:6px 8px; background:rgba(15,23,42,0.6); border-left:3px solid ${r.status === 'STICKY_CLIENT_RISK' ? '#f59e0b' : '#38bdf8'}; border-radius:4px; margin-top:5px;">
                        <b>${escapeHtml(r.ssid)}</b> (${r.ap_count} BSSIDs &bull; ${r.bands.join('/')}) — Max: <b>${r.best_dbm} dBm</b> / Min: <b>${r.weakest_dbm} dBm</b> (Spread ${r.spread_db} dB)
                        <div style="font-size:0.75rem; color:var(--text-secondary);">${isVi ? r.recommendation_vi : r.recommendation_en}</div>
                    </div>
                `).join("");

            auditBox.innerHTML = `
                <div style="margin-bottom:8px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.78rem; margin-bottom:4px;">
                        <span>${isVi ? 'Chiếm dụng gói tin quản lý (Beacon):' : 'Management Beacon Overhead:'} <b>${beaconPct}%</b></span>
                        <span>${isVi ? 'Tranh chấp dữ liệu (Data):' : 'Data Contention:'} <b>${dataPct}%</b></span>
                        <span style="color:#10b981;">${isVi ? 'Thời gian rỗi (Free Airtime):' : 'Free Airtime:'} <b>${freePct}%</b></span>
                    </div>
                    <div style="width:100%; height:8px; background:#1e293b; border-radius:4px; overflow:hidden; display:flex;">
                        <div style="width:${beaconPct}%; background:#f59e0b;" title="Beacon Overhead"></div>
                        <div style="width:${dataPct}%; background:#ef4444;" title="Data Contention"></div>
                        <div style="width:${freePct}%; background:#10b981;" title="Free Airtime"></div>
                    </div>
                </div>
                <div>${roamHtml}</div>
            `;
        }

        updateRationaleDisplay(ev24, ev5, ev6);
    }

    // Trigger Full Auto-Pick
    async function triggerAutoPick() {
        const lang = state.rationaleLang || state.currentLang || "vi";
        const isVi = lang === "vi";

        btnTriggerAutoPick.disabled = true;
        btnTriggerAutoPick.innerHTML = `<div class="spinner mini"></div> ${isVi ? 'Đang Tính Toán...' : 'Auto-Picking...'}`;

        try {
            const res = await fetch("/api/channel-autopick", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ environment_type: "office", target_band: "both" })
            });

            if (!res.ok) throw new Error("Auto-pick calculation failed");
            const data = await res.json();
            
            const p24 = data.recommendations.band_24ghz;
            const p5 = data.recommendations.band_5ghz;
            const p6 = data.recommendations.band_6ghz;

            const r24 = (isVi ? p24.reasons_vi : p24.reasons_en) || p24.reasons || [];
            const r5 = (isVi ? p5.reasons_vi : p5.reasons_en) || p5.reasons || [];

            const chLabel = isVi ? "Kênh" : "Channel";
            const ratingLabel = isVi ? "Điểm Đánh Giá" : "Health Rating";
            const recWidthLabel = isVi ? "Độ Rộng Khuyên Dùng:" : "Recommended Width:";
            const diagLabel = isVi ? "Chẩn Đoán Phổ Vô Tuyến Chi Tiết:" : "Detailed RF Spectral Diagnosis:";
            const blockLabel = isVi ? "Khối Kênh 80MHz Khuyên Dùng:" : "Recommended 80MHz Block:";
            const bondLabel = isVi ? "Độ Rộng Gộp Kênh:" : "Channel Bonding Width:";

            document.getElementById("rationale-24ghz-content").innerHTML = `
                <p><b>${isVi ? 'Kênh Được Chọn:' : 'Selected Channel:'}</b> <span class="text-accent" style="font-size:1.1rem; font-weight:800;">${chLabel} ${p24.picked_channel}</span> (${ratingLabel}: <b>${p24.score}/100</b>)</p>
                <p><b>${recWidthLabel}</b> ${p24.channel_width}</p>
                <div style="margin-top:8px;">
                    <b>${diagLabel}</b>
                    <ul style="margin-top:4px; padding-left:18px;">
                        ${r24.map(r => `<li>${r}</li>`).join("")}
                    </ul>
                </div>
            `;

            const block6Html = p6
                ? `<p style="margin-top:6px; color:#38bdf8;"><b>${isVi ? 'Dải 6 GHz (Wi-Fi 6E/7):' : '6 GHz Band (Wi-Fi 6E/7):'}</b> PSC Ch ${p6.picked_psc_channel} &bull; ${p6.recommended_160mhz_block}</p>`
                : "";

            document.getElementById("rationale-5ghz-content").innerHTML = `
                <p><b>${isVi ? 'Kênh Được Chọn:' : 'Selected Channel:'}</b> <span class="text-accent" style="font-size:1.1rem; font-weight:800;">${chLabel} ${p5.picked_channel}</span> (${ratingLabel}: <b>${p5.score}/100</b>)</p>
                <p><b>${blockLabel}</b> ${p5.recommended_80mhz_block} (${isVi ? 'Các kênh:' : 'Channels:'} ${p5.recommended_80mhz_channels.join(', ')})</p>
                <p><b>${bondLabel}</b> ${p5.channel_width}</p>
                ${block6Html}
                <div style="margin-top:8px;">
                    <b>${diagLabel}</b>
                    <ul style="margin-top:4px; padding-left:18px;">
                        ${r5.map(r => `<li>${r}</li>`).join("")}
                    </ul>
                </div>
            `;

            const advice = (isVi ? data.system_advice_vi : data.system_advice_en) || data.system_advice || [];
            if (advice.length > 0) {
                document.getElementById("admin-advice-list").innerHTML = advice.map(adv => `<li>${adv}</li>`).join("");
            }
        } catch (err) {
            console.error(err);
            alert((isVi ? "Tối ưu kênh tự động thất bại: " : "Auto-pick optimization failed: ") + err.message);
        } finally {
            btnTriggerAutoPick.disabled = false;
            btnTriggerAutoPick.innerHTML = `<i data-lucide="sparkles"></i> <span>${isVi ? 'Tính Kênh Tự Động' : 'Run Auto-Pick'}</span>`;
            safeCreateIcons();
        }
    }

    function updateRationaleDisplay(ev24, ev5, ev6) {
        if (!ev24 || !ev5) return;
        const lang = state.rationaleLang || state.currentLang || "vi";
        const isVi = lang === "vi";
        const eval6 = ev6 || state.analysis?.evaluation_6ghz;

        const list24 = (isVi ? ev24.reasons_breakdown_vi : ev24.reasons_breakdown_en) || ev24.reasons_breakdown || [];
        const list5 = (isVi ? ev5.reasons_breakdown_vi : ev5.reasons_breakdown_en) || ev5.reasons_breakdown || [];

        const title24 = isVi ? "Kênh 2.4 GHz Tối Ưu:" : "Optimal 2.4 GHz Channel:";
        const ratingLabel = isVi ? "Điểm Đánh Giá" : "Health Rating";
        const chLabel = isVi ? "Kênh" : "Channel";

        const content24El = document.getElementById("rationale-24ghz-content");
        if (content24El) {
            content24El.innerHTML = `
                <p><b>${title24}</b> <span class="text-accent" style="font-weight:700;">${chLabel} ${ev24.recommended_channel}</span> (${ratingLabel}: <b>${ev24.recommended_score}/100</b>)</p>
                <ul style="margin-top:6px; padding-left:18px;">
                    ${list24.map(r => `<li>${r}</li>`).join("")}
                </ul>
            `;
        }

        const title5 = isVi ? "Kênh 5 GHz Tối Ưu:" : "Optimal 5 GHz Channel:";
        const blockLabel = isVi ? "Khối 80MHz Sạch Nhất:" : "Cleanest 80MHz Block:";
        const info6Html = eval6
            ? `<p style="margin-top:4px; color:#38bdf8;"><b>${isVi ? 'Khuyến nghị 6 GHz UNII-5:' : '6 GHz UNII-5 Recommendation:'}</b> PSC Ch ${eval6.recommended_channel} (${eval6.recommended_160mhz_block})</p>`
            : "";

        const content5El = document.getElementById("rationale-5ghz-content");
        if (content5El) {
            content5El.innerHTML = `
                <p><b>${title5}</b> <span class="text-accent" style="font-weight:700;">${chLabel} ${ev5.recommended_channel}</span> (${ratingLabel}: <b>${ev5.recommended_score}/100</b>)</p>
                <p style="margin-top:4px;"><b>${blockLabel}</b> ${ev5.recommended_80mhz_block} (${ev5.best_80mhz_block?.avg_score ?? '--'}/100)</p>
                ${info6Html}
                <ul style="margin-top:6px; padding-left:18px;">
                    ${list5.map(r => `<li>${r}</li>`).join("")}
                </ul>
            `;
        }
    }

    window.selectChannelDetail = function(band, ch) {
        if (!state.analysis) return;
        const isVi = (state.rationaleLang || state.currentLang) === "vi";
        if (band === 2.4) {
            const ev = state.analysis.evaluation_24ghz.channel_evaluations[ch];
            if (!ev) return;
            const sameCount = ev.same_channel_aps.length;
            const adjCount = ev.overlapping_aps.length;

            let explanation = isVi
                ? `<b>Phân Tích Kênh ${ch} (2.4 GHz):</b> Điểm Sức Khỏe: <b>${ev.health_score}/100</b>.<br>`
                : `<b>Channel ${ch} Analysis (2.4 GHz):</b> Health Score: <b>${ev.health_score}/100</b>.<br>`;

            if (ev.is_standard) {
                explanation += isVi
                    ? `Kênh chuẩn 20MHz không chồng lấn theo IEEE 802.11 (1, 6, 11). `
                    : `Standard non-overlapping 20MHz channel (1, 6, 11). `;
            } else {
                explanation += isVi
                    ? `<span style="color:var(--danger)">CẢNH BÁO: Kênh không chuẩn gây chồng lấn dải biên (ACI)! Làm rớt gói mạng xung quanh.</span><br>`
                    : `<span style="color:var(--danger)">WARNING: Non-standard overlapping channel. Causes Adjacent Channel Interference (ACI)!</span><br>`;
            }
            explanation += isVi
                ? `Số AP phát cùng kênh: <b>${sameCount}</b>. Số AP chồng lấn lân cận: <b>${adjCount}</b>. Tải kênh vô tuyến: <b>${ev.utilization_pct}%</b>.`
                : `Competing Same-Channel APs: <b>${sameCount}</b>. Overlapping Adjacent APs: <b>${adjCount}</b>. Airtime Utilization: <b>${ev.utilization_pct}%</b>.`;

            document.getElementById("rationale-24ghz-content").innerHTML = explanation;
        } else {
            const ev = state.analysis.evaluation_5ghz.channel_evaluations[ch];
            if (!ev) return;
            const sameCount = ev.same_channel_aps.length;

            let explanation = isVi
                ? `<b>Phân Tích Kênh ${ch} (5 GHz):</b> Nhóm dải tần: <b>${ev.unii_group}</b> | Điểm Sức Khỏe: <b>${ev.health_score}/100</b>.<br>`
                : `<b>5 GHz Channel ${ch} Analysis:</b> Group: <b>${ev.unii_group}</b> | Health Score: <b>${ev.health_score}/100</b>.<br>`;

            if (ev.is_dfs) {
                explanation += isVi
                    ? `<i>Kênh DFS: Cần chia sẻ phổ với Radar khí tượng/quân sự. Có thể bị router tự động ngắt phát nếu phát hiện xung Radar.</i><br>`
                    : `<i>DFS Channel: Requires Dynamic Frequency Selection. Subject to radar avoidance shutdown.</i><br>`;
            } else {
                explanation += isVi
                    ? `<i>Kênh Non-DFS: Sạch 100%, miễn nhiễm hoàn toàn với radar. Kết nối siêu ổn định.</i><br>`
                    : `<i>Non-DFS Channel: 100% immune to radar detection events. Rock-solid stability.</i><br>`;
            }
            explanation += isVi
                ? `Số AP cạnh tranh cùng kênh: <b>${sameCount}</b>. Tải kênh: <b>${ev.utilization_pct}%</b>.`
                : `Same-Channel Competing APs: <b>${sameCount}</b>. Airtime Utilization: <b>${ev.utilization_pct}%</b>.`;

            document.getElementById("rationale-5ghz-content").innerHTML = explanation;
        }
    };

    function renderSecurityAudit() {
        if (!state.analysis) return;
        const sec = state.analysis.security_audit;
        const openNets = sec.open_unsecured || [];
        
        const isVi = state.currentLang === "vi";
        const openCard = document.getElementById("sec-open-card");
        const openDesc = document.getElementById("sec-open-desc");
        const openList = document.getElementById("sec-open-list");

        if (openNets.length > 0) {
            openCard.style.display = "flex";
            openDesc.textContent = isVi
                ? `NGUY CƠ CAO: Phát hiện ${openNets.length} trạm phát sóng Wi-Fi không dùng mật khẩu hoặc không có mã hóa!`
                : `HIGH RISK: Detected ${openNets.length} Wi-Fi Access Points operating without password or encryption!`;
            openList.innerHTML = openNets.map(n => `
                <div class="vuln-item">
                    <span><b>${escapeHtml(n.ssid)}</b> (${n.bssid})</span>
                    <span>${isVi ? 'Kênh' : 'Ch'} ${n.channel} (${n.band}) • ${n.signal_percent}% (${n.signal_dbm} dBm)</span>
                </div>
            `).join("");
        } else {
            openCard.style.display = "none";
        }

        const total = state.analysis.total_aps || 1;
        const wpa3Count = (sec.cutting_edge_wpa3 || []).length;
        const wpa2Count = (sec.modern_wpa2 || []).length;
        const entCount = (sec.enterprise || []).length;
        const openCount = openNets.length;

        const barsContainer = document.getElementById("sec-distribution-bars");
        barsContainer.innerHTML = `
            <div class="sec-bar-row">
                <div class="sec-bar-label"><span>${isVi ? 'WPA3-SAE / OWE (Chuẩn Mới Nhất - An Toàn Tuyệt Đối)' : 'WPA3-SAE / OWE (Next-Gen Standard - Highly Secure)'}</span><span>${wpa3Count} APs (${Math.round(wpa3Count/total*100)}%)</span></div>
                <div class="sec-bar-track"><div class="sec-bar-fill" style="width:${wpa3Count/total*100}%; background-color:#10b981;"></div></div>
            </div>
            <div class="sec-bar-row">
                <div class="sec-bar-label"><span>${isVi ? 'Doanh Nghiệp / Enterprise (Xác Thực 802.1X RADIUS)' : 'Enterprise / 802.1X (RADIUS Authentication)'}</span><span>${entCount} APs (${Math.round(entCount/total*100)}%)</span></div>
                <div class="sec-bar-track"><div class="sec-bar-fill" style="width:${entCount/total*100}%; background-color:#a855f7;"></div></div>
            </div>
            <div class="sec-bar-row">
                <div class="sec-bar-label"><span>${isVi ? 'WPA2-Personal (Mã Hóa AES/CCMP Tiêu Chuẩn)' : 'WPA2-Personal (Standard AES/CCMP Encryption)'}</span><span>${wpa2Count} APs (${Math.round(wpa2Count/total*100)}%)</span></div>
                <div class="sec-bar-track"><div class="sec-bar-fill" style="width:${wpa2Count/total*100}%; background-color:#3b82f6;"></div></div>
            </div>
            <div class="sec-bar-row">
                <div class="sec-bar-label"><span>${isVi ? 'Mạng Mở / Open (Không Mã Hóa - Rủi Ro Bắt Gói Tin Rất Cao)' : 'Open / Unsecured (Cleartext Frames - High Sniffing Risk)'}</span><span>${openCount} APs (${Math.round(openCount/total*100)}%)</span></div>
                <div class="sec-bar-track"><div class="sec-bar-fill" style="width:${openCount/total*100}%; background-color:#ef4444;"></div></div>
            </div>
        `;
    }

    // Render Oscium Wi-Spy + Chanalyzer Spectrum Classifiers
    function renderOsciumSpectrumClassifiers() {
        const gridEl = document.getElementById("oscium-spectrum-classifier-grid");
        if (!gridEl || !state.analysis) return;
        const tsSuite = state.analysis.troubleshooting_suite;
        if (!tsSuite || !tsSuite.spectrum_classifiers) return;

        const isVi = state.currentLang === "vi";
        gridEl.innerHTML = tsSuite.spectrum_classifiers.map(c => {
            const sev = c.severity || "PASS";
            const sevClass = (sev === "PASS" || sev === "OK" || sev === "INFO") ? "severity-ok" : (sev === "WARNING" ? "severity-warn" : "severity-crit");
            const badgeBg = (sev === "PASS" || sev === "OK") ? "#10b981" : (sev === "INFO" ? "#0ea5e9" : (sev === "WARNING" ? "#f59e0b" : "#ef4444"));
            const title = isVi ? (c.title_vi || c.title_en) : (c.title_en || c.title_vi);
            const desc = isVi ? (c.detail_vi || c.diagnosis_vi || "") : (c.detail_en || c.diagnosis_en || "");
            const action = isVi ? c.action_vi : (c.action_en || c.action_vi);

            return `
                <div class="oscium-diag-card ${sevClass}">
                    <div class="oscium-diag-header">
                        <span class="oscium-diag-title">${escapeHtml(title)}</span>
                        <span class="badge" style="background:${badgeBg}; color:#fff;">${escapeHtml(c.band || "RF")}</span>
                    </div>
                    <div class="oscium-diag-desc">${escapeHtml(desc)}</div>
                    ${action ? `<div style="margin-top: 6px; font-size: 0.76rem; color: #38bdf8; font-weight: 600;">🛠️ ${escapeHtml(action)}</div>` : ''}
                </div>
            `;
        }).join("");
    }

    // DRAW RF SPECTRUM BELL-CURVES, CONTINUOUS SIGNAL GRAPH & WATERFALL
    function drawSpectrumGraphs() {
        try {
            renderOsciumSpectrumClassifiers();
        } catch (e) {}
        try {
            drawSpectrum24();
        } catch (e) {
            console.error("Error drawing 2.4GHz spectrum:", e);
        }
        try {
            drawSpectrum5();
        } catch (e) {
            console.error("Error drawing 5GHz spectrum:", e);
        }
        try {
            drawContinuousSignalHistory();
        } catch (e) {
            console.error("Error drawing signal history:", e);
        }
        try {
            drawSpectrumWaterfall();
        } catch (e) {
            console.error("Error drawing spectrum waterfall:", e);
        }
    }

    function drawSpectrum24() {
        if (!canvas24) return;
        const ctx = canvas24.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas24.getBoundingClientRect();
        if (rect.width === 0) return;
        
        canvas24.width = rect.width * dpr;
        canvas24.height = 240 * dpr;
        ctx.scale(dpr, dpr);

        const w = rect.width;
        const h = 240;
        const isDark = state.theme === "dark";

        ctx.fillStyle = isDark ? "#0b0f19" : "#f8fafc";
        ctx.fillRect(0, 0, w, h);

        const paddingLeft = 45;
        const paddingBottom = 30;
        const graphW = w - paddingLeft - 20;
        const graphH = h - paddingBottom - 20;

        ctx.strokeStyle = isDark ? "#1e293b" : "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.fillStyle = isDark ? "#64748b" : "#94a3b8";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "right";

        for (let dbm = -30; dbm >= -100; dbm -= 10) {
            const y = 20 + ((dbm - (-30)) / (-100 - (-30))) * graphH;
            ctx.beginPath();
            ctx.moveTo(paddingLeft, y);
            ctx.lineTo(w - 20, y);
            ctx.stroke();
            ctx.fillText(`${dbm} dBm`, paddingLeft - 6, y + 3);
        }

        ctx.textAlign = "center";
        const channelX = (ch) => paddingLeft + ((ch - 0.5) / 14) * graphW;

        for (let ch = 1; ch <= 14; ch++) {
            const x = channelX(ch);
            const isStandard = (ch === 1 || ch === 6 || ch === 11);
            ctx.fillStyle = isStandard ? (isDark ? "#38bdf8" : "#0284c7") : (isDark ? "#64748b" : "#94a3b8");
            ctx.font = isStandard ? "bold 11px sans-serif" : "10px sans-serif";
            ctx.fillText(`Ch ${ch}`, x, h - 10);

            ctx.beginPath();
            ctx.strokeStyle = isStandard ? (isDark ? "rgba(56, 189, 248, 0.25)" : "rgba(2, 132, 199, 0.2)") : (isDark ? "#1e293b" : "#f1f5f9");
            ctx.lineWidth = isStandard ? 1.5 : 1;
            ctx.moveTo(x, 20);
            ctx.lineTo(x, h - paddingBottom);
            ctx.stroke();
        }

        const bestCh24 = state.analysis?.evaluation_24ghz?.recommended_channel;
        if (bestCh24) {
            const cx = channelX(bestCh24);
            const chWidthPx = (graphW / 14) * 4;
            ctx.save();
            ctx.strokeStyle = "#10b981";
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(cx - chWidthPx / 2, h - paddingBottom);
            ctx.quadraticCurveTo(cx, 35, cx + chWidthPx / 2, h - paddingBottom);
            ctx.stroke();
            ctx.fillStyle = isDark ? "rgba(16, 185, 129, 0.08)" : "rgba(16, 185, 129, 0.12)";
            ctx.fill();
            ctx.restore();
        }

        const nets24 = (state.networks || []).filter(n => {
            const bandStr = String(n.band || "");
            const ch = Number(n.channel);
            return bandStr.includes("2.4") || (ch >= 1 && ch <= 14);
        });

        const note24 = document.getElementById("spectrum-note-24");
        if (note24) {
            const bestScore = state.analysis?.evaluation_24ghz?.recommended_score || "--";
            note24.innerHTML = `Đang hiển thị <b>${nets24.length} mạng Wi-Fi</b> trên dải tần 2.4 GHz. Kênh tối ưu nhất: <b>Kênh ${bestCh24 || '--'}</b> (Điểm sức khỏe: <b>${bestScore}/100</b>).`;
        }

        nets24.sort((a, b) => (a.signal_dbm || -100) - (b.signal_dbm || -100));

        const channelLabelCounters = {};

        nets24.forEach((net, idx) => {
            const ch = Number(net.channel);
            if (!ch || ch < 1 || ch > 14) return;
            const dbm = Math.max(-98, Math.min(-30, net.signal_dbm || -90));
            const cx = channelX(ch);
            const peakY = 20 + ((dbm - (-30)) / (-100 - (-30))) * graphH;
            const baseY = h - paddingBottom;
            const curveWidth = (graphW / 14) * 4.2;

            const hue = (ch * 47 + idx * 31) % 360;
            const isConn = !!net.is_connected;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(cx - curveWidth / 2, baseY);
            ctx.bezierCurveTo(
                cx - curveWidth / 3.5, baseY,
                cx - curveWidth / 4, peakY,
                cx, peakY
            );
            ctx.bezierCurveTo(
                cx + curveWidth / 4, peakY,
                cx + curveWidth / 3.5, baseY,
                cx + curveWidth / 2, baseY
            );

            const grad = ctx.createLinearGradient(0, peakY, 0, baseY);
            if (isConn) {
                grad.addColorStop(0, "rgba(16, 185, 129, 0.45)");
                grad.addColorStop(1, "rgba(16, 185, 129, 0.05)");
                ctx.strokeStyle = "#10b981";
                ctx.lineWidth = 3;
                ctx.shadowColor = "#10b981";
                ctx.shadowBlur = 8;
            } else {
                grad.addColorStop(0, `hsla(${hue}, 85%, 60%, 0.35)`);
                grad.addColorStop(1, `hsla(${hue}, 85%, 60%, 0.03)`);
                ctx.strokeStyle = `hsl(${hue}, 80%, 55%)`;
                ctx.lineWidth = 1.8;
            }

            ctx.fillStyle = grad;
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            channelLabelCounters[ch] = (channelLabelCounters[ch] || 0) + 1;
            const labelRank = channelLabelCounters[ch] - 1;
            const labelY = Math.max(28, peakY - 6 - (labelRank * 11));

            ctx.fillStyle = isConn ? "#10b981" : (isDark ? "#f1f5f9" : "#0f172a");
            ctx.font = isConn ? "bold 10px sans-serif" : "9px sans-serif";
            const ssidStr = net.ssid && net.ssid !== "[Hidden Network]" ? net.ssid : net.bssid.slice(-8);
            const labelText = ssidStr.length > 12 ? ssidStr.slice(0, 11) + ".." : ssidStr;
            ctx.fillText(`${labelText} (${dbm})`, cx, labelY);
        });
    }

    function drawSpectrum5() {
        if (!canvas5) return;
        const ctx = canvas5.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas5.getBoundingClientRect();
        if (rect.width === 0) return;

        canvas5.width = rect.width * dpr;
        canvas5.height = 240 * dpr;
        ctx.scale(dpr, dpr);

        const w = rect.width;
        const h = 240;
        const isDark = state.theme === "dark";

        ctx.fillStyle = isDark ? "#0b0f19" : "#f8fafc";
        ctx.fillRect(0, 0, w, h);

        const paddingLeft = 45;
        const paddingBottom = 30;
        const graphW = w - paddingLeft - 20;
        const graphH = h - paddingBottom - 20;

        ctx.strokeStyle = isDark ? "#1e293b" : "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.fillStyle = isDark ? "#64748b" : "#94a3b8";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "right";

        for (let dbm = -30; dbm >= -100; dbm -= 10) {
            const y = 20 + ((dbm - (-30)) / (-100 - (-30))) * graphH;
            ctx.beginPath();
            ctx.moveTo(paddingLeft, y);
            ctx.lineTo(w - 20, y);
            ctx.stroke();
            ctx.fillText(`${dbm} dBm`, paddingLeft - 6, y + 3);
        }

        const channels5 = [36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144, 149, 153, 157, 161, 165];
        ctx.textAlign = "center";
        const getChX = (ch) => {
            const idx = channels5.indexOf(ch);
            if (idx === -1) {
                const minC = 36, maxC = 165;
                return paddingLeft + ((ch - minC) / (maxC - minC)) * graphW;
            }
            return paddingLeft + ((idx + 0.5) / channels5.length) * graphW;
        };

        channels5.forEach(ch => {
            const x = getChX(ch);
            const isDfs = (ch >= 52 && ch <= 144);
            ctx.fillStyle = isDfs ? (isDark ? "#f59e0b" : "#d97706") : (isDark ? "#38bdf8" : "#0284c7");
            ctx.font = "9px sans-serif";
            ctx.fillText(`${ch}`, x, h - 10);

            ctx.beginPath();
            ctx.strokeStyle = isDfs ? (isDark ? "rgba(245, 158, 11, 0.15)" : "rgba(217, 119, 6, 0.12)") : (isDark ? "#1e293b" : "#f1f5f9");
            ctx.moveTo(x, 20);
            ctx.lineTo(x, h - paddingBottom);
            ctx.stroke();
        });

        const nets5 = (state.networks || []).filter(n => {
            const bandStr = String(n.band || "");
            const ch = Number(n.channel);
            return bandStr.includes("5") || ch >= 32;
        });

        const note5 = document.getElementById("spectrum-note-5");
        if (note5) {
            const bestCh5 = state.analysis?.evaluation_5ghz?.recommended_channel || "--";
            const bestBlock = state.analysis?.evaluation_5ghz?.recommended_80mhz_block || "--";
            note5.innerHTML = `Đang hiển thị <b>${nets5.length} mạng Wi-Fi</b> trên dải tần 5 GHz. Khối 80MHz sạch nhất: <b>${bestBlock}</b> (Kênh đề xuất: <b>Ch ${bestCh5}</b>).`;
        }

        nets5.sort((a, b) => (a.signal_dbm || -100) - (b.signal_dbm || -100));

        const channelLabelCounters5 = {};

        nets5.forEach((net, idx) => {
            const ch = Number(net.channel);
            if (!ch) return;
            const dbm = Math.max(-98, Math.min(-30, net.signal_dbm || -90));
            const cx = getChX(ch);
            const peakY = 20 + ((dbm - (-30)) / (-100 - (-30))) * graphH;
            const baseY = h - paddingBottom;
            const curveWidth = (graphW / channels5.length) * 2.2;

            const hue = (ch * 19 + idx * 43) % 360;
            const isConn = !!net.is_connected;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(cx - curveWidth / 2, baseY);
            ctx.bezierCurveTo(
                cx - curveWidth / 3.5, baseY,
                cx - curveWidth / 4, peakY,
                cx, peakY
            );
            ctx.bezierCurveTo(
                cx + curveWidth / 4, peakY,
                cx + curveWidth / 3.5, baseY,
                cx + curveWidth / 2, baseY
            );

            const grad = ctx.createLinearGradient(0, peakY, 0, baseY);
            if (isConn) {
                grad.addColorStop(0, "rgba(16, 185, 129, 0.45)");
                grad.addColorStop(1, "rgba(16, 185, 129, 0.05)");
                ctx.strokeStyle = "#10b981";
                ctx.lineWidth = 3;
                ctx.shadowColor = "#10b981";
                ctx.shadowBlur = 8;
            } else {
                grad.addColorStop(0, `hsla(${hue}, 85%, 60%, 0.35)`);
                grad.addColorStop(1, `hsla(${hue}, 85%, 60%, 0.03)`);
                ctx.strokeStyle = `hsl(${hue}, 85%, 60%)`;
                ctx.lineWidth = 1.8;
            }

            ctx.fillStyle = grad;
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            channelLabelCounters5[ch] = (channelLabelCounters5[ch] || 0) + 1;
            const labelRank = channelLabelCounters5[ch] - 1;
            const labelY = Math.max(28, peakY - 6 - (labelRank * 11));

            ctx.fillStyle = isConn ? "#10b981" : (isDark ? "#ffffff" : "#0f172a");
            ctx.font = isConn ? "bold 10px sans-serif" : "9px sans-serif";
            const ssidStr = net.ssid && net.ssid !== "[Hidden Network]" ? net.ssid : net.bssid.slice(-8);
            const label = ssidStr.length > 12 ? ssidStr.slice(0, 11) + ".." : ssidStr;
            ctx.fillText(`${label} (${dbm})`, cx, labelY);
        });
    }

    // CONTINUOUS SIGNAL STRENGTH VS TIME LINE CHART
    function drawContinuousSignalHistory() {
        if (!canvasSignal) return;
        const ctx = canvasSignal.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        const rect = canvasSignal.getBoundingClientRect();
        if (rect.width === 0) return;

        canvasSignal.width = rect.width * dpr;
        canvasSignal.height = 220 * dpr;
        ctx.scale(dpr, dpr);

        const w = rect.width;
        const h = 220;
        const isDark = state.theme === "dark";

        ctx.fillStyle = isDark ? "#0b0f19" : "#f8fafc";
        ctx.fillRect(0, 0, w, h);

        const paddingLeft = 45;
        const paddingBottom = 30;
        const graphW = w - paddingLeft - 20;
        const graphH = h - paddingBottom - 20;

        ctx.strokeStyle = isDark ? "#1e293b" : "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.fillStyle = isDark ? "#64748b" : "#94a3b8";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "right";

        for (let dbm = -30; dbm >= -100; dbm -= 10) {
            const y = 20 + ((dbm - (-30)) / (-100 - (-30))) * graphH;
            ctx.beginPath();
            ctx.moveTo(paddingLeft, y);
            ctx.lineTo(w - 20, y);
            ctx.stroke();
            ctx.fillText(`${dbm}`, paddingLeft - 6, y + 3);
        }

        const historyData = state.signalHistory || {};
        const activeBssid = state.interface?.bssid;
        
        const trackedBssids = Object.keys(historyData).sort((a, b) => {
            if (a === activeBssid) return -1;
            if (b === activeBssid) return 1;
            const ptsA = historyData[a].history;
            const ptsB = historyData[b].history;
            const lastA = ptsA.length ? ptsA[ptsA.length - 1].dbm : -100;
            const lastB = ptsB.length ? ptsB[ptsB.length - 1].dbm : -100;
            return lastB - lastA;
        }).slice(0, 6);

        const legendEl = document.getElementById("signal-history-legend");
        if (legendEl) legendEl.innerHTML = "";

        const colors = ["#10b981", "#06b6d4", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444"];
        const maxPoints = 35;

        trackedBssids.forEach((bssid, idx) => {
            const item = historyData[bssid];
            if (!item || !item.history || item.history.length === 0) return;
            const pts = item.history;
            const color = colors[idx % colors.length];

            if (legendEl) {
                const dot = document.createElement("span");
                dot.className = "legend-item";
                const isConn = bssid === activeBssid ? " (Connected)" : "";
                dot.innerHTML = `<span class="legend-dot" style="background:${color}"></span> ${escapeHtml(item.ssid)} [Ch ${item.channel}]${isConn}`;
                legendEl.appendChild(dot);
            }

            if (pts.length < 2) return;

            ctx.strokeStyle = color;
            ctx.lineWidth = (bssid === activeBssid) ? 2.8 : 1.6;
            ctx.beginPath();

            pts.forEach((pt, pIdx) => {
                const x = paddingLeft + (pIdx / (maxPoints - 1)) * graphW;
                const dbm = Math.max(-100, Math.min(-30, pt.dbm));
                const y = 20 + ((dbm - (-30)) / (-100 - (-30))) * graphH;
                if (pIdx === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            const lastPt = pts[pts.length - 1];
            const lastX = paddingLeft + ((pts.length - 1) / (maxPoints - 1)) * graphW;
            const lastY = 20 + ((lastPt.dbm - (-30)) / (-100 - (-30))) * graphH;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(lastX, lastY, (bssid === activeBssid) ? 4.5 : 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // REAL-TIME CHANNEL SPECTROGRAM WATERFALL (CHANALYZER STYLE)
    function drawSpectrumWaterfall() {
        if (!canvasWaterfall) return;
        const ctx = canvasWaterfall.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        const rect = canvasWaterfall.getBoundingClientRect();
        if (rect.width === 0) return;

        canvasWaterfall.width = rect.width * dpr;
        canvasWaterfall.height = 175 * dpr;
        ctx.scale(dpr, dpr);

        const w = rect.width;
        const h = 175;
        const isDark = state.theme === "dark";

        ctx.fillStyle = isDark ? "#080c14" : "#0f172a";
        ctx.fillRect(0, 0, w, h);

        const paddingLeft = 45;
        const paddingBottom = 26;
        const graphW = w - paddingLeft - 20;
        const graphH = h - paddingBottom - 14;

        const wfCols = [
            { label: "Ch1", key: "24_1" },
            { label: "Ch2", key: "24_2" },
            { label: "Ch3", key: "24_3" },
            { label: "Ch4", key: "24_4" },
            { label: "Ch5", key: "24_5" },
            { label: "Ch6", key: "24_6" },
            { label: "Ch7", key: "24_7" },
            { label: "Ch8", key: "24_8" },
            { label: "Ch9", key: "24_9" },
            { label: "Ch10", key: "24_10" },
            { label: "Ch11", key: "24_11" },
            { label: "Ch13", key: "24_13" },
            { label: "5G:36", key: "5_36" },
            { label: "5G:44", key: "5_44" },
            { label: "5G:52", key: "5_52" },
            { label: "5G:100", key: "5_100" },
            { label: "5G:149", key: "5_149" },
            { label: "5G:157", key: "5_157" }
        ];

        const colW = graphW / wfCols.length;
        const rows = state.waterfallHistory || [];
        const maxRows = 30;
        const rowH = graphH / maxRows;

        rows.forEach((snap, rIdx) => {
            const y = 10 + (maxRows - rows.length + rIdx) * rowH;
            wfCols.forEach((col, cIdx) => {
                const x = paddingLeft + cIdx * colW;
                const dbm = snap[col.key] !== undefined ? snap[col.key] : -96;
                let fill = "rgba(15, 23, 42, 0.9)";
                if (dbm >= -50) fill = "rgba(239, 68, 68, 0.92)";
                else if (dbm >= -62) fill = "rgba(245, 158, 11, 0.88)";
                else if (dbm >= -75) fill = "rgba(16, 185, 129, 0.82)";
                else if (dbm >= -88) fill = "rgba(14, 165, 233, 0.65)";
                else if (dbm > -95) fill = "rgba(30, 58, 138, 0.45)";

                ctx.fillStyle = fill;
                ctx.fillRect(x + 1, y, Math.max(2, colW - 2), Math.max(2, rowH - 0.5));
            });
        });

        ctx.fillStyle = "#94a3b8";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        wfCols.forEach((col, cIdx) => {
            const cx = paddingLeft + (cIdx + 0.5) * colW;
            ctx.fillText(col.label, cx, h - 8);
        });

        ctx.textAlign = "right";
        ctx.fillText("Now", paddingLeft - 6, 14 + graphH);
        ctx.fillText("-60s", paddingLeft - 6, 18);
    }

    // QUICK 1-CLICK EXPORT
    window.quickExportReport = async function(format = "csv") {
        const btn = document.getElementById("btn-export-csv");
        const origHtml = btn ? btn.innerHTML : "";
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<div class="spinner mini"></div> <span>Đang xuất...</span>`;
        }

        try {
            const res = await fetch("/api/export-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ format: format })
            });

            if (!res.ok) throw new Error("Xuất file báo cáo thất bại");
            const data = await res.json();
            
            const a = document.createElement("a");
            a.href = data.download_url;
            a.download = data.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            if (btn) btn.innerHTML = `<i data-lucide="check"></i> <span>${state.currentLang === 'vi' ? 'Đã tải!' : 'Downloaded!'}</span>`;
            if (state.currentTab === "tab-reports") fetchReportsArchive();
        } catch (err) {
            alert((state.currentLang === 'vi' ? "Lỗi xuất báo cáo: " : "Export error: ") + err.message);
            if (btn) btn.innerHTML = origHtml;
        } finally {
            setTimeout(() => {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = `<i data-lucide="file-spreadsheet"></i> <span>${state.currentLang === 'vi' ? 'Xuất CSV' : 'Export CSV'}</span>`;
                    safeCreateIcons();
                }
            }, 1500);
        }
    };

    if (btnExportCsv) {
        btnExportCsv.addEventListener("click", () => window.quickExportReport("csv"));
    }

    // REPORT EXPORT MODAL MANAGEMENT
    window.openReportModal = function() {
        reportModal.classList.remove("hidden");
    };

    if (btnOpenReportModal) {
        btnOpenReportModal.addEventListener("click", () => {
            window.openReportModal();
        });
    }

    btnCloseReportModal.addEventListener("click", () => {
        reportModal.classList.add("hidden");
    });

    btnCancelExport.addEventListener("click", () => {
        reportModal.classList.add("hidden");
    });

    document.querySelectorAll(".format-card").forEach(card => {
        card.addEventListener("click", () => {
            document.querySelectorAll(".format-card").forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");
            const radio = card.querySelector("input[type='radio']");
            if (radio) radio.checked = true;
        });
    });

    btnConfirmExport.addEventListener("click", async () => {
        const selectedRadio = document.querySelector("input[name='report_format']:checked");
        if (!selectedRadio) return;
        const format = selectedRadio.value;

        const statusBox = document.getElementById("export-status");
        const statusText = document.getElementById("export-status-text");
        statusBox.classList.remove("hidden");
        statusText.textContent = `Đang trích xuất báo cáo khảo sát Wi-Fi định dạng ${format.toUpperCase()}...`;
        btnConfirmExport.disabled = true;

        try {
            const res = await fetch("/api/export-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ format: format })
            });

            if (!res.ok) throw new Error("Xuất báo cáo thất bại");
            const data = await res.json();
            
            const a = document.createElement("a");
            a.href = data.download_url;
            a.download = data.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            statusText.textContent = `Đã tải về thành công: ${data.filename}`;
            setTimeout(() => {
                reportModal.classList.add("hidden");
                statusBox.classList.add("hidden");
                btnConfirmExport.disabled = false;
            }, 1200);

            fetchReportsArchive();
        } catch (err) {
            console.error(err);
            statusText.textContent = "Lỗi: " + err.message;
            btnConfirmExport.disabled = false;
        }
    });

    async function fetchReportsArchive() {
        const tbody = document.getElementById("reports-table-body");
        if (!tbody) return;

        try {
            const res = await fetch("/api/reports/list");
            if (!res.ok) return;
            const data = await res.json();
            const reports = data.reports || [];

            const isVi = state.currentLang === "vi";
            if (reports.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-secondary);">${isVi ? 'Chưa có báo cáo nào trong kho. Bấm nút Xuất CSV để tạo báo cáo mới.' : 'No saved reports found. Click Export CSV to generate a new report.'}</td></tr>`;
                return;
            }

            tbody.innerHTML = reports.map(r => {
                let fmtClass = "fmt-pdf";
                if (r.format === "DOCX") fmtClass = "fmt-docx";
                else if (r.format === "CSV") fmtClass = "fmt-csv";
                else if (r.format === "JSON") fmtClass = "fmt-json";

                const sizeKb = (r.size_bytes / 1024).toFixed(1);

                return `
                    <tr>
                        <td><span class="badge-format ${fmtClass}">${r.format}</span></td>
                        <td><b>${escapeHtml(r.filename)}</b></td>
                        <td>${r.created_at}</td>
                        <td>${sizeKb} KB</td>
                        <td>
                            <div class="flex-center gap-2">
                                <a href="${r.download_url}" download class="btn btn-sm btn-primary">
                                    <i data-lucide="download" style="width:12px; height:12px;"></i> ${isVi ? 'Tải' : 'Download'}
                                </a>
                                <button class="btn btn-sm btn-danger" onclick="window.deleteSingleReport('${escapeHtml(r.filename)}')" style="background:#dc2626; color:#fff;" title="${isVi ? 'Xóa file báo cáo này' : 'Delete this report file'}">
                                    <i data-lucide="trash" style="width:12px; height:12px;"></i> ${isVi ? 'Xóa' : 'Delete'}
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join("");

            safeCreateIcons();
        } catch (e) {
            console.error("Error loading reports archive:", e);
        }
    }

    // Delete single report file
    window.deleteSingleReport = async function(filename) {
        if (!confirm(`Bạn có chắc chắn muốn xóa báo cáo ${filename} không?`)) return;
        try {
            const res = await fetch(`/api/reports/${encodeURIComponent(filename)}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Không thể xóa file");
            fetchReportsArchive();
        } catch (err) {
            alert("Lỗi khi xóa: " + err.message);
        }
    };

    // Clear all old reports
    window.clearAllOldReports = async function() {
        if (!confirm("Bạn có chắc chắn muốn xóa TOÀN BỘ các bản ghi báo cáo cũ trong kho lưu trữ không?")) return;
        try {
            const res = await fetch("/api/reports/clear-all", { method: "POST" });
            if (!res.ok) throw new Error("Không thể dọn dẹp kho lưu trữ");
            const data = await res.json();
            alert(`Đã dọn dẹp thành công ${data.cleared_count} file báo cáo cũ!`);
            fetchReportsArchive();
        } catch (err) {
            alert("Lỗi khi dọn dẹp: " + err.message);
        }
    };

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // --- MODULE: VoWiFi & ITU-T G.107 MOS Score + Multi-Hop Path Audit ---
    window.runVoWifiTest = async function() {
        const btn = document.getElementById("btn-run-vowifi");
        const targetSelect = document.getElementById("vowifi-target-select");
        const target = targetSelect ? targetSelect.value : "8.8.8.8";
        const isVi = state.currentLang === "vi";

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<div class="spinner mini"></div> ${isVi ? 'Đang Đo VoWiFi...' : 'Measuring VoWiFi...'}`;
        }

        try {
            const res = await fetch(`/api/vowifi-mos?target=${encodeURIComponent(target)}&count=5`);
            if (!res.ok) throw new Error(isVi ? "Không thể kết nối đo mạng" : "Failed to run VoWiFi test");
            const data = await res.json();
            state.vowifiTested = true;

            const mosEl = document.getElementById("mos-val-display");
            const rttEl = document.getElementById("rtt-val-display");
            const jitterEl = document.getElementById("jitter-val-display");
            const lossEl = document.getElementById("loss-val-display");
            const titleEl = document.getElementById("vowifi-rating-title");
            const badgeEl = document.getElementById("vowifi-rating-badge");
            const verdictEl = document.getElementById("vowifi-verdict-text");

            if (mosEl) mosEl.innerHTML = `${data.mos_score} <span style="font-size: 1rem; color: var(--text-secondary);">/ 4.5</span>`;
            if (rttEl) rttEl.textContent = `${data.latency_avg_ms} ms`;
            if (jitterEl) jitterEl.textContent = `${data.jitter_ms} ms`;
            if (lossEl) lossEl.textContent = `${data.packet_loss_pct} %`;

            if (titleEl) titleEl.textContent = `${isVi ? 'Chất Lượng Cuộc Gọi:' : 'Call Quality:'} ${data.rating}`;
            if (badgeEl) {
                badgeEl.textContent = `MOS: ${data.mos_score}`;
                if (data.mos_score >= 4.0) badgeEl.style.backgroundColor = "var(--success)";
                else if (data.mos_score >= 3.6) badgeEl.style.backgroundColor = "var(--warning)";
                else badgeEl.style.backgroundColor = "var(--danger)";
            }
            if (verdictEl) verdictEl.textContent = data.verdict;

            // Populate Multi-Hop Latency Check strip
            const hopGwVal = document.getElementById("hop-gateway-val");
            const hopGwIp = document.getElementById("hop-gateway-ip");
            const hopWanVal = document.getElementById("hop-wan-val");
            const hopWanTarget = document.getElementById("hop-wan-target");
            const hopDnsVal = document.getElementById("hop-dns-val");
            const pathText = document.getElementById("vowifi-path-text");

            if (hopGwVal) {
                hopGwVal.textContent = data.gateway_latency_ms !== undefined ? `${data.gateway_latency_ms} ms` : "-- ms";
                hopGwVal.style.color = (data.gateway_latency_ms || 0) <= 8 ? "#10b981" : ((data.gateway_latency_ms || 0) <= 20 ? "#f59e0b" : "#ef4444");
            }
            if (hopGwIp) {
                hopGwIp.textContent = `Gateway IP: ${data.gateway_ip || "192.168.1.1"}`;
            }
            if (hopWanVal) {
                hopWanVal.textContent = `${data.latency_avg_ms} ms`;
                hopWanVal.style.color = data.latency_avg_ms <= 50 ? "#10b981" : (data.latency_avg_ms <= 120 ? "#f59e0b" : "#ef4444");
            }
            if (hopWanTarget) {
                hopWanTarget.textContent = `Target: ${data.target || target} (Loss ${data.packet_loss_pct}%)`;
            }
            if (hopDnsVal) {
                hopDnsVal.textContent = data.dns_latency_ms !== undefined ? `${data.dns_latency_ms} ms` : "-- ms";
                hopDnsVal.style.color = (data.dns_latency_ms || 0) <= 45 ? "#10b981" : "#f59e0b";
            }
            if (pathText && data.path_diagnosis_vi) {
                pathText.textContent = data.path_diagnosis_vi;
            }

            const codecsList = document.getElementById("vowifi-codecs-list");
            if (codecsList && data.supported_codecs) {
                codecsList.innerHTML = data.supported_codecs.map(c => `
                    <li style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 4px;">
                        <span><b>${escapeHtml(c.codec)}</b>:</span>
                        <span style="color: ${c.status === 'Khuyên dùng' || c.status === 'Tốt' ? '#10b981' : '#f59e0b'}; font-weight:700;">${c.status}</span>
                    </li>
                `).join("");
            }
        } catch (e) {
            console.error("VoWiFi test error:", e);
            alert((isVi ? "Lỗi khi kiểm tra VoWiFi: " : "VoWiFi test error: ") + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="play"></i> ${isVi ? 'Đo Chất Lượng Ngay' : 'Run Quality Test'}`;
                safeCreateIcons();
            }
        }
    };

    // --- MODULE: Interactive Floorplan & RF Heatmap Simulator (Ekahau + Sweet Home 3D + SketchUp UX) ---
    const MATERIAL_DB_LOSS = {
        brick: 6.0,
        concrete: 12.0,
        wood: 4.0,
        glass: 3.0,
        door: 2.0,
        metal: 15.0
    };

    const MATERIAL_NAMES = {
        brick: { vi: "Tường gạch", en: "Brick Wall" },
        concrete: { vi: "Bê tông dày", en: "Concrete Wall" },
        wood: { vi: "Vách gỗ / Thạch cao", en: "Wood / Drywall" },
        glass: { vi: "Kính cường lực", en: "Glass Partition" },
        door: { vi: "Cửa gỗ / Cửa phòng", en: "Interior Door" },
        metal: { vi: "Lõi thang máy / Tủ sắt", en: "Elevator / Metal" }
    };

    function updateEkahauKpiStrip(hm) {
        const isVi = state.currentLang === "vi";
        const covEl = document.getElementById("ekahau-kpi-coverage");
        const covTargetEl = document.getElementById("ekahau-kpi-coverage-target");
        const roamEl = document.getElementById("ekahau-kpi-roaming");
        const roamTargetEl = document.getElementById("ekahau-kpi-roaming-target");
        const snrEl = document.getElementById("ekahau-kpi-snr");
        const snrTargetEl = document.getElementById("ekahau-kpi-snr-target");
        const tputEl = document.getElementById("ekahau-kpi-tput");
        const capEl = document.getElementById("ekahau-kpi-capacity");
        const slaEl = document.getElementById("ekahau-kpi-sla");
        const confEl = document.getElementById("ekahau-kpi-conflict");

        if (!hm) {
            if (covEl) covEl.textContent = "--%";
            if (roamEl) roamEl.textContent = "--%";
            if (snrEl) snrEl.textContent = "-- dB";
            if (tputEl) tputEl.textContent = "-- Mbps";
            if (capEl) capEl.textContent = isVi ? "Sức chứa: -- thiết bị" : "Capacity: -- clients";
            if (slaEl) {
                slaEl.textContent = isVi ? "CHỜ TÍNH TOÁN" : "PENDING";
                slaEl.style.color = "#cbd5e1";
            }
            if (confEl) confEl.textContent = isVi ? "Tranh chấp kênh: --%" : "Channel conflict: --%";
            return;
        }

        const targets = hm.sla_targets || { min_primary_dbm: -65, min_secondary_dbm: -72, min_snr_db: 20 };
        if (covEl) {
            covEl.textContent = `${hm.coverage_pct !== undefined ? hm.coverage_pct : 0}%`;
            covEl.style.color = (hm.coverage_pct || 0) >= 90 ? "#10b981" : "#f59e0b";
        }
        if (covTargetEl) covTargetEl.textContent = `Target ≥ ${targets.min_primary_dbm} dBm`;

        if (roamEl) {
            roamEl.textContent = `${hm.roaming_redundancy_pct !== undefined ? hm.roaming_redundancy_pct : 0}%`;
            roamEl.style.color = (hm.roaming_redundancy_pct || 0) >= 65 ? "#38bdf8" : "#94a3b8";
        }
        if (roamTargetEl) roamTargetEl.textContent = `2nd AP ≥ ${targets.min_secondary_dbm} dBm`;

        if (snrEl) {
            snrEl.textContent = `${hm.avg_snr_db !== undefined ? hm.avg_snr_db : 0} dB`;
        }
        if (snrTargetEl) snrTargetEl.textContent = `Target ≥ ${targets.min_snr_db} dB`;

        if (tputEl) {
            tputEl.textContent = `${hm.avg_throughput_mbps || 0} Mbps (Peak ${hm.peak_throughput_mbps || 0})`;
        }
        if (capEl) {
            capEl.textContent = isVi
                ? `Sức chứa tối đa: ~${hm.capacity_max_clients || 0} thiết bị`
                : `Max capacity: ~${hm.capacity_max_clients || 0} clients`;
        }
        if (slaEl) {
            const passed = Boolean(hm.sla_pass);
            slaEl.textContent = passed ? (isVi ? "ĐẠT CHUẨN SLA ✓" : "SLA PASS ✓") : (isVi ? "CHƯA ĐẠT SLA ⚠" : "SLA WARNING ⚠");
            slaEl.style.color = passed ? "#10b981" : "#f59e0b";
        }
        if (confEl) {
            confEl.textContent = isVi
                ? `Tranh chấp kênh: ${hm.channel_conflict_pct || 0}%`
                : `Channel conflict: ${hm.channel_conflict_pct || 0}%`;
        }
    }

    function updateHeatmapLegendBanner() {
        const legend = document.getElementById("planner-dynamic-legend");
        if (!legend) return;
        const mode = state.planner.heatmapMode || "primary_rssi";
        const isVi = state.currentLang === "vi";

        if (mode === "primary_rssi" || mode === "secondary_rssi") {
            const title = mode === "primary_rssi"
                ? (isVi ? "Cường Độ Sóng Chính (Primary RSSI):" : "Primary Signal (RSSI):")
                : (isVi ? "Vùng Chuyển Vùng AP Phụ (Secondary RSSI):" : "Secondary Roaming Signal:");
            legend.innerHTML = `
                <strong style="color:#38bdf8;">${title}</strong>
                <span><i class="dot" style="background:#10b981;"></i> &ge; -50 dBm (${isVi ? 'Rất mạnh' : 'Excellent'})</span>
                <span><i class="dot" style="background:#eab308;"></i> -65 dBm (${isVi ? 'Chuẩn VoWiFi' : 'VoWiFi SLA'})</span>
                <span><i class="dot" style="background:#f97316;"></i> -75 dBm (${isVi ? 'Yếu' : 'Weak'})</span>
                <span><i class="dot" style="background:#ef4444;"></i> &lt; -80 dBm (${isVi ? 'Điểm mù' : 'Dead zone'})</span>
            `;
        } else if (mode === "snr") {
            legend.innerHTML = `
                <strong style="color:#a78bfa;">${isVi ? 'Tỷ Số Tín Hiệu / Nhiễu (SNR dB):' : 'Signal-to-Noise Ratio (SNR dB):'}</strong>
                <span><i class="dot" style="background:#10b981;"></i> &ge; 35 dB (Wi-Fi 6/7 QAM-1024)</span>
                <span><i class="dot" style="background:#38bdf8;"></i> 25 - 34 dB (${isVi ? 'Tốt / Chuẩn Voice' : 'Good / Voice SLA'})</span>
                <span><i class="dot" style="background:#f59e0b;"></i> 15 - 24 dB (${isVi ? 'Trung bình' : 'Moderate'})</span>
                <span><i class="dot" style="background:#ef4444;"></i> &lt; 15 dB (${isVi ? 'Nhiễu cao' : 'Low SNR'})</span>
            `;
        } else if (mode === "interference") {
            legend.innerHTML = `
                <strong style="color:#f43f5e;">${isVi ? 'Mức Độ Tranh Chấp Đồng Kênh (SIR / Contention):' : 'Channel Interference / Contention:'}</strong>
                <span><i class="dot" style="background:#10b981;"></i> 0 dB (${isVi ? 'Sạch / Không đè kênh' : 'Clean / No conflict'})</span>
                <span><i class="dot" style="background:#eab308;"></i> 1 - 2 AP (${isVi ? 'Can nhiễu nhẹ' : 'Mild contention'})</span>
                <span><i class="dot" style="background:#ef4444;"></i> &ge; 2 AP đè kênh (${isVi ? 'Nghẽn Co-Channel' : 'High CCI conflict'})</span>
            `;
        } else if (mode === "throughput") {
            legend.innerHTML = `
                <strong style="color:#10b981;">${isVi ? 'Tốc Độ Dữ Liệu Ước Tính (PHY Data Rate):' : 'Estimated PHY Data Rate (Mbps):'}</strong>
                <span><i class="dot" style="background:#10b981;"></i> &ge; 600 Mbps (${isVi ? 'Tốc độ Gigabit' : 'Gigabit MCS'})</span>
                <span><i class="dot" style="background:#38bdf8;"></i> 250 - 599 Mbps (${isVi ? 'Cao / 4K Stream' : 'High Throughput'})</span>
                <span><i class="dot" style="background:#eab308;"></i> 60 - 249 Mbps (${isVi ? 'Đủ dùng chuẩn HD' : 'Standard Data'})</span>
                <span><i class="dot" style="background:#ef4444;"></i> &lt; 60 Mbps (${isVi ? ' Nghẽn / Chậm' : 'Low Rate'})</span>
            `;
        }
    }

    window.setHeatmapVisualizationMode = function(mode) {
        state.planner.heatmapMode = mode || "primary_rssi";
        document.querySelectorAll(".ekahau-mode-btn").forEach(btn => {
            const m = btn.getAttribute("data-hm-mode") || btn.id.replace("btn-hm-mode-", "");
            if (m === state.planner.heatmapMode) btn.classList.add("active");
            else btn.classList.remove("active");
        });
        updateHeatmapLegendBanner();
        drawFloorplanHeatmap();
    };

    window.updateSlaCutoff = function(val) {
        state.planner.slaCutoff = parseFloat(val) || -65.0;
        const valEl = document.getElementById("ekahau-sla-cutoff-val");
        if (valEl) valEl.textContent = `${state.planner.slaCutoff} dBm`;
        drawFloorplanHeatmap();
    };

    window.updateApTxPower = function(val) {
        state.planner.txPowerDbm = parseFloat(val) || 20.0;
        if (state.planner.aps && state.planner.aps.length > 0) {
            window.recalculateCurrentAPHeatmap();
        }
    };

    window.updateApAntenna = function(val) {
        state.planner.antennaDbi = parseFloat(val) || 3.0;
        if (state.planner.aps && state.planner.aps.length > 0) {
            window.recalculateCurrentAPHeatmap();
        }
    };

    window.changePlannerSlaProfile = function(profile) {
        state.planner.slaProfile = profile || "office";
        if (state.planner.aps && state.planner.aps.length > 0) {
            window.recalculateCurrentAPHeatmap();
        } else {
            drawFloorplanHeatmap();
        }
    };

    window.importScannedAPsToFloorplan = function() {
        const isVi = state.currentLang === "vi";
        const networks = state.networks || [];
        if (networks.length === 0) {
            alert(isVi ? "Chưa có dữ liệu quét thực tế để nạp lên bản vẽ." : "No scanned networks available to import.");
            return;
        }
        // Pick up to 4 strongest unique SSID/BSSID clusters to place onto floorplan
        const sorted = [...networks].sort((a, b) => (parseInt(b.signal) || 0) - (parseInt(a.signal) || 0));
        const picked = [];
        const usedKeys = new Set();
        for (const net of sorted) {
            const key = net.ssid || net.bssid;
            if (!usedKeys.has(key)) {
                usedKeys.add(key);
                picked.push(net);
            }
            if (picked.length >= 4) break;
        }

        const W = state.planner.width_m || 12.0;
        const H = state.planner.height_m || 8.0;
        const positions = [
            { x: +(W * 0.25).toFixed(1), y: +(H * 0.35).toFixed(1) },
            { x: +(W * 0.75).toFixed(1), y: +(H * 0.65).toFixed(1) },
            { x: +(W * 0.25).toFixed(1), y: +(H * 0.70).toFixed(1) },
            { x: +(W * 0.75).toFixed(1), y: +(H * 0.30).toFixed(1) }
        ];

        state.planner.aps = picked.map((net, idx) => {
            const ch = parseInt(net.channel) || 1;
            const is5 = String(net.band || "").includes("5");
            const is6 = String(net.band || "").includes("6");
            return {
                id: idx + 1,
                name: `${(net.ssid || "AP").slice(0, 14)}`,
                x: positions[idx % positions.length].x,
                y: positions[idx % positions.length].y,
                channel_24: (!is5 && !is6) ? ch : [1, 6, 11][idx % 3],
                channel_5: is5 ? ch : [36, 52, 149, 161][idx % 4],
                channel_6: is6 ? ch : [37, 69, 101, 133][idx % 4],
                tx_power_dbm: 20.0,
                role: net.vendor ? `${net.vendor.split(" ")[0]} AP` : "Scanned AP"
            };
        });

        updateWallCountBadge();
        window.recalculateCurrentAPHeatmap();
    };

    function resetPlannerSummaryBox() {
        const isVi = state.currentLang === "vi";
        const badge = document.getElementById("planner-coverage-badge");
        if (badge) {
            badge.textContent = isVi ? "Tỷ Lệ Phủ Sóng: --%" : "Coverage: --%";
            badge.style.backgroundColor = "#10b981";
        }
        const rationaleBox = document.getElementById("planner-rationale-list");
        if (rationaleBox) {
            rationaleBox.innerHTML = `<span data-i18n="planner_placeholder">${I18N[state.currentLang]?.planner_placeholder || I18N.vi.planner_placeholder}</span>`;
        }
        updateEkahauKpiStrip(null);
    }

    function cleanupOrphanRoomLabels() {
        if (!state.planner.roomLabels) return;
        const activeRoomIds = new Set(
            (state.planner.walls || [])
                .map(w => w.roomId)
                .filter(id => id !== undefined && id !== null)
        );
        state.planner.roomLabels = state.planner.roomLabels.filter(
            lbl => lbl.roomId === undefined || activeRoomIds.has(lbl.roomId)
        );
    }

    function updateWallCountBadge() {
        const countBadge = document.getElementById("planner-wall-count-badge");
        if (countBadge) {
            const count = state.planner.walls.length;
            const apCount = (state.planner.aps || []).length;
            const isVi = state.currentLang === "vi";
            countBadge.textContent = isVi
                ? `🧱 ${count} vách ngăn • 📡 ${apCount} AP`
                : `🧱 ${count} walls • 📡 ${apCount} APs`;
        }
        renderPlannerObjectTable();
    }

    window.deleteWallAt = function(idx) {
        if (idx < 0 || idx >= state.planner.walls.length) return;
        state.planner.walls.splice(idx, 1);
        cleanupOrphanRoomLabels();
        window.deselectWall();
        updateWallCountBadge();
        if (state.planner.aps && state.planner.aps.length > 0) {
            window.recalculateCurrentAPHeatmap();
        } else {
            drawFloorplanHeatmap();
        }
    };

    window.deletePlacedAp = function(apIdx) {
        if (!state.planner.aps || apIdx < 0 || apIdx >= state.planner.aps.length) return;
        state.planner.aps.splice(apIdx, 1);
        updateWallCountBadge();
        if (state.planner.aps.length > 0) {
            window.recalculateCurrentAPHeatmap();
        } else {
            state.planner.heatmap = null;
            resetPlannerSummaryBox();
            drawFloorplanHeatmap();
        }
    };

    function renderPlannerObjectTable() {
        const tbody = document.getElementById("planner-object-list-body");
        if (!tbody) return;
        const isVi = state.currentLang === "vi";
        const curUnit = state.planner.unit || "m";
        const curFreq = state.planner.freq_ghz || 2.4;
        const freqMult = curFreq >= 6.0 ? 1.42 : (curFreq >= 5.0 ? 1.25 : 1.0);

        const hasWalls = state.planner.walls && state.planner.walls.length > 0;
        const hasAps = state.planner.aps && state.planner.aps.length > 0;

        if (!hasWalls && !hasAps) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding:10px; text-align:center; color:var(--text-secondary);">${isVi ? 'Chưa có vách ngăn hoặc bộ phát nào trên mặt bằng.' : 'No walls or APs on floorplan.'}</td></tr>`;
            return;
        }

        const apRows = (state.planner.aps || []).map((ap, apIdx) => `
            <tr style="border-bottom:1px solid rgba(148,163,184,0.12); background:rgba(6,182,212,0.08);">
                <td style="padding:5px 8px; font-weight:700; color:#06b6d4;">📡 AP-${apIdx + 1}</td>
                <td style="padding:5px 8px; font-weight:600;">${escapeHtml(ap.name || `AP-${apIdx + 1}`)} (${escapeHtml(ap.role || "Router")})</td>
                <td style="padding:5px 8px; font-family:monospace;">(x=${ap.x}m, y=${ap.y}m)</td>
                <td style="padding:5px 8px; font-weight:600;">Ch ${ap.channel_24 || 1} / ${ap.channel_5 || 36} / 6G:${ap.channel_6 || 37}</td>
                <td style="padding:5px 8px; color:#10b981; font-weight:600;">+${ap.tx_power_dbm || 20} dBm TX</td>
                <td style="padding:5px 8px; text-align:right;">
                    <button class="btn btn-sm btn-danger" style="padding:2px 6px; font-size:0.7rem; background:#dc2626; color:#fff;" onclick="event.stopPropagation(); window.deletePlacedAp(${apIdx});">${isVi ? 'Xóa AP' : 'Del AP'}</button>
                </td>
            </tr>
        `).join("");

        const wallRows = (state.planner.walls || []).map((w, idx) => {
            const lenM = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
            const lenFormatted = `${convertMetersToUnit(lenM, curUnit)} ${curUnit}`;
            const matKey = String(w.material || "brick").toLowerCase();
            const matName = MATERIAL_NAMES[matKey] ? (isVi ? MATERIAL_NAMES[matKey].vi : MATERIAL_NAMES[matKey].en) : matKey;
            const lossDb = ((MATERIAL_DB_LOSS[matKey] || 6.0) * freqMult).toFixed(1);
            const isSel = state.planner.selectedWallIndex === idx;

            return `
                <tr style="border-bottom:1px solid rgba(148,163,184,0.12); background:${isSel ? 'rgba(14,165,233,0.15)' : 'transparent'}; cursor:pointer;" onclick="window.selectWall(${idx})">
                    <td style="padding:5px 8px; font-weight:700; color:#38bdf8;">#${idx + 1}</td>
                    <td style="padding:5px 8px;">${matName}</td>
                    <td style="padding:5px 8px; font-family:monospace;">(${w.x1}, ${w.y1}) &rarr; (${w.x2}, ${w.y2})</td>
                    <td style="padding:5px 8px; font-weight:600;">${lenFormatted}</td>
                    <td style="padding:5px 8px; color:#f59e0b; font-weight:600;">-${lossDb} dB</td>
                    <td style="padding:5px 8px; text-align:right;">
                        <button class="btn btn-sm btn-secondary" style="padding:2px 6px; font-size:0.7rem;" onclick="event.stopPropagation(); window.selectWall(${idx})">${isVi ? 'Sửa' : 'Edit'}</button>
                        <button class="btn btn-sm btn-danger" style="padding:2px 6px; font-size:0.7rem; background:#dc2626; color:#fff;" onclick="event.stopPropagation(); window.deleteWallAt(${idx});">${isVi ? 'Xóa' : 'Del'}</button>
                    </td>
                </tr>
            `;
        }).join("");

        tbody.innerHTML = apRows + wallRows;
    }

    function convertMetersToUnit(meters, unit) {
        if (unit === "in") return (meters * 39.3700787).toFixed(1);
        if (unit === "ft") return (meters * 3.2808399).toFixed(2);
        if (unit === "cm") return (meters * 100.0).toFixed(0);
        return meters.toFixed(2);
    }

    function convertUnitToMeters(val, unit) {
        const num = parseFloat(val) || 0;
        if (unit === "in") return num * 0.0254;
        if (unit === "ft") return num * 0.3048;
        if (unit === "cm") return num * 0.01;
        return num;
    }

    window.changePlannerBand = function(val) {
        state.planner.freq_ghz = parseFloat(val) || 2.4;
        renderPlannerObjectTable();
        if (state.planner.aps && state.planner.aps.length > 0) {
            window.recalculateCurrentAPHeatmap();
        } else {
            drawFloorplanHeatmap();
        }
    };

    window.togglePlanner25DView = function() {
        state.planner.view25D = !state.planner.view25D;
        const btn = document.getElementById("btn-toggle-25d");
        if (btn) {
            btn.className = state.planner.view25D ? "btn btn-sm btn-accent" : "btn btn-sm btn-secondary";
        }
        drawFloorplanHeatmap();
    };

    window.recalculateCurrentAPHeatmap = async function() {
        if (!state.planner.aps || state.planner.aps.length === 0) {
            state.planner.heatmap = null;
            resetPlannerSummaryBox();
            updateWallCountBadge();
            drawFloorplanHeatmap();
            return;
        }
        try {
            const cleanWalls = (state.planner.walls || []).map(w => ({
                x1: parseFloat(w.x1) || 0.0,
                y1: parseFloat(w.y1) || 0.0,
                x2: parseFloat(w.x2) || 0.0,
                y2: parseFloat(w.y2) || 0.0,
                material: String(w.material || "brick").toLowerCase()
            })).filter(w => (w.x1 !== w.x2 || w.y1 !== w.y2));

            const curFreq = state.planner.freq_ghz || 2.4;
            const curSla = state.planner.slaProfile || "office";
            const res = await fetch("/api/ai-planner/calculate-heatmap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    width_m: state.planner.width_m,
                    height_m: state.planner.height_m,
                    walls: cleanWalls,
                    aps: state.planner.aps,
                    tx_power: (parseFloat(state.planner.txPowerDbm) || 20.0) + (parseFloat(state.planner.antennaDbi) || 3.0) - 3.0,
                    freq_ghz: curFreq,
                    sla_profile: curSla
                })
            });
            if (res.ok) {
                const data = await res.json();
                state.planner.heatmap = data;
                updateEkahauKpiStrip(data);
                const badge = document.getElementById("planner-coverage-badge");
                const isVi = state.currentLang === "vi";
                const covPct = data.coverage_pct !== undefined ? data.coverage_pct : 0;
                if (badge) {
                    badge.textContent = `${isVi ? 'Tỷ Lệ Phủ Sóng:' : 'Coverage:'} ${covPct}% (${curFreq} GHz)`;
                    badge.style.backgroundColor = covPct >= 90 ? "#10b981" : "#f59e0b";
                }
                const rationaleBox = document.getElementById("planner-rationale-list");
                if (rationaleBox) {
                    rationaleBox.innerHTML = `
                        <div style="margin-bottom:8px; font-weight:700; color:var(--text-primary);">
                            ${isVi
                                ? `Kết quả mô phỏng trực tiếp: Đang bố trí <b>${state.planner.aps.length} Access Point</b> ở băng tần <b>${curFreq} GHz</b>, đạt độ phủ sóng chính <b>${covPct}%</b>, vùng phủ chuyển vùng phụ <b>${data.roaming_redundancy_pct || 0}%</b>, tốc độ trung bình <b>${data.avg_throughput_mbps || 0} Mbps</b>.`
                                : `Live Simulation Result: <b>${state.planner.aps.length} Access Point(s)</b> active on <b>${curFreq} GHz</b> band, achieving <b>${covPct}%</b> primary coverage, <b>${data.roaming_redundancy_pct || 0}%</b> secondary roaming coverage, and <b>${data.avg_throughput_mbps || 0} Mbps</b> average PHY rate.`}
                        </div>
                        <div style="margin-top:8px; display:flex; gap:10px; flex-wrap:wrap;">
                            ${state.planner.aps.map(a => `
                                <span class="badge" style="background:#1e293b; border:1px solid #06b6d4; color:#fff; padding:6px 10px; font-size:0.82rem;">
                                    📍 <b>${escapeHtml(a.name || "AP")}</b> (x=${a.x}m, y=${a.y}m) • 2.4G: <b>Ch ${a.channel_24 || 1}</b> • 5G: <b>Ch ${a.channel_5 || 36}</b> • 6G: <b>Ch ${a.channel_6 || 37}</b> (${escapeHtml(a.role || "Router")})
                                </span>
                            `).join("")}
                        </div>
                    `;
                }
                updateWallCountBadge();
                drawFloorplanHeatmap();
            }
        } catch (err) {
            console.error("Error recalculating AP heatmap:", err);
        }
    };

    window.setPlannerTool = function(tool) {
        state.planner.activeTool = tool;
        state.planner.rulerMeasure = null;
        const toolButtons = {
            room: document.getElementById("btn-tool-room"),
            draw: document.getElementById("btn-tool-draw"),
            select: document.getElementById("btn-tool-select"),
            place_ap: document.getElementById("btn-tool-place-ap"),
            ruler: document.getElementById("btn-tool-ruler"),
            delete: document.getElementById("btn-tool-delete")
        };
        const hintText = document.getElementById("planner-instruction-text");
        const canvas = document.getElementById("canvas-floorplan-heatmap");
        const isVi = state.currentLang === "vi";

        Object.keys(toolButtons).forEach(k => {
            const b = toolButtons[k];
            if (!b) return;
            if (k === tool) {
                b.className = (k === "delete") ? "btn btn-sm btn-danger" : "btn btn-sm btn-accent";
            } else {
                b.className = "btn btn-sm btn-secondary";
            }
        });

        if (tool === "room") {
            if (canvas) canvas.style.cursor = "crosshair";
            if (hintText) {
                hintText.textContent = isVi
                    ? "💡 Hướng dẫn: Đang ở chế độ Vẽ Khung Phòng (kiểu Sweet Home 3D). Nhấp chuột và kéo tạo hình chữ nhật để dựng nhanh 4 bức tường khép kín kèm diện tích m²."
                    : "💡 Guide: Draw Room Box mode (Sweet Home 3D style). Click and drag a rectangle to create 4 connected walls with automatic area m² label.";
            }
        } else if (tool === "draw") {
            if (canvas) canvas.style.cursor = "crosshair";
            if (hintText) {
                hintText.textContent = isVi 
                    ? "💡 Hướng dẫn: Đang ở chế độ Vẽ Tường Lẻ. Nhấp chuột và kéo trên bản đồ để tạo vách ngăn (giữ Shift để khóa phương thẳng). Bấm vào tường bất kỳ để kéo sửa." 
                    : "💡 Guide: Draw Wall mode. Click and drag on canvas to create walls (hold Shift for orthogonal lines). Click any wall to drag or resize.";
            }
        } else if (tool === "select") {
            if (canvas) canvas.style.cursor = "pointer";
            if (hintText) {
                hintText.textContent = isVi 
                    ? "💡 Hướng dẫn: Đang ở chế độ Chọn & Kéo Sửa. Nhấp vào bức tường hoặc bộ phát AP bất kỳ để kéo di chuyển vị trí, hoặc kéo 2 đầu mút bức tường để thay đổi độ dài." 
                    : "💡 Guide: Select & Move mode. Click and drag any wall or AP marker to move it, or drag wall endpoints to resize.";
            }
        } else if (tool === "place_ap") {
            if (canvas) canvas.style.cursor = "copy";
            if (hintText) {
                hintText.textContent = isVi
                    ? "💡 Hướng dẫn: Đang ở chế độ Đặt Thêm AP Thủ Công. Nhấp vào vị trí bất kỳ trên mặt bằng để đặt bộ phát Wi-Fi và xem ngay vùng phủ sóng thực tế, hoặc kéo AP hiện có."
                    : "💡 Guide: Place AP mode. Click anywhere on the floorplan to place a Wi-Fi AP and immediately compute its heatmap, or drag an existing AP.";
            }
        } else if (tool === "ruler") {
            if (canvas) canvas.style.cursor = "crosshair";
            if (hintText) {
                hintText.textContent = isVi
                    ? "💡 Hướng dẫn: Đang ở chế độ Thước Đo Suy Hao (kiểu SketchUp Tape Measure). Nhấp và kéo từ điểm A đến điểm B để đo khoảng cách thực, số vách ngăn xuyên qua và tổng mức suy hao (dB)."
                    : "💡 Guide: Tape Measure mode (SketchUp style). Click and drag between two points to measure distance, wall intersections, and total path loss (dB).";
            }
        } else {
            if (canvas) canvas.style.cursor = "pointer";
            if (hintText) {
                hintText.textContent = isVi 
                    ? "💡 Hướng dẫn: Đang ở chế độ Xóa. Nhấp vào bức tường hoặc bộ phát AP trên bản đồ để xóa bỏ." 
                    : "💡 Guide: Delete mode. Click on any wall or AP marker to remove it.";
            }
        }
        drawFloorplanHeatmap();
    };

    window.selectWall = function(idx) {
        if (idx < 0 || idx >= state.planner.walls.length) {
            window.deselectWall();
            return;
        }
        state.planner.selectedWallIndex = idx;
        const w = state.planner.walls[idx];
        const lenM = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
        const unit = state.planner.unit || "m";
        const valInUnit = convertMetersToUnit(lenM, unit);

        const inspector = document.getElementById("planner-wall-inspector");
        const titleEl = document.getElementById("inspector-wall-title");
        const matEl = document.getElementById("inspector-wall-material");
        const lenEl = document.getElementById("inspector-wall-length");
        const unitEl = document.getElementById("inspector-wall-unit");
        const isVi = state.currentLang === "vi";

        if (inspector) inspector.style.display = "flex";
        if (titleEl) titleEl.textContent = `${isVi ? 'Vách Ngăn' : 'Selected Wall'} #${idx + 1} (${String(w.material || 'brick').toUpperCase()})`;
        if (matEl) matEl.value = w.material || "brick";
        if (lenEl) lenEl.value = valInUnit;
        if (unitEl) unitEl.value = unit;

        renderPlannerObjectTable();
        safeCreateIcons();
        drawFloorplanHeatmap();
    };

    window.deselectWall = function() {
        state.planner.selectedWallIndex = -1;
        const inspector = document.getElementById("planner-wall-inspector");
        if (inspector) inspector.style.display = "none";
        renderPlannerObjectTable();
        drawFloorplanHeatmap();
    };

    window.changeWallUnit = function(newUnit) {
        state.planner.unit = newUnit;
        if (state.planner.selectedWallIndex >= 0) {
            const w = state.planner.walls[state.planner.selectedWallIndex];
            const lenM = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
            const lenEl = document.getElementById("inspector-wall-length");
            if (lenEl) lenEl.value = convertMetersToUnit(lenM, newUnit);
        }
        renderPlannerObjectTable();
        drawFloorplanHeatmap();
    };

    window.applySelectedWallLength = function() {
        if (state.planner.selectedWallIndex < 0) return;
        const idx = state.planner.selectedWallIndex;
        const w = state.planner.walls[idx];
        const lenEl = document.getElementById("inspector-wall-length");
        const unitEl = document.getElementById("inspector-wall-unit");
        const unit = unitEl ? unitEl.value : (state.planner.unit || "m");
        const isVi = state.currentLang === "vi";

        const inputVal = parseFloat(lenEl ? lenEl.value : 0);
        if (isNaN(inputVal) || inputVal <= 0) {
            alert(isVi ? "Vui lòng nhập chiều dài hợp lệ lớn hơn 0" : "Please enter a valid length greater than 0");
            return;
        }

        const newLenMeters = Math.max(0.2, Math.min(100.0, convertUnitToMeters(inputVal, unit)));
        const dx = w.x2 - w.x1;
        const dy = w.y2 - w.y1;
        const theta = (dx === 0 && dy === 0) ? 0 : Math.atan2(dy, dx);

        w.x2 = Math.round(Math.max(0, Math.min(state.planner.width_m, w.x1 + newLenMeters * Math.cos(theta))) * 100) / 100;
        w.y2 = Math.round(Math.max(0, Math.min(state.planner.height_m, w.y1 + newLenMeters * Math.sin(theta))) * 100) / 100;

        const actualLenM = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
        if (lenEl) lenEl.value = convertMetersToUnit(actualLenM, unit);

        renderPlannerObjectTable();
        if (state.planner.aps && state.planner.aps.length > 0) {
            window.recalculateCurrentAPHeatmap();
        } else {
            drawFloorplanHeatmap();
        }
    };

    window.updateSelectedWallMaterial = function(mat) {
        if (state.planner.selectedWallIndex < 0) return;
        const w = state.planner.walls[state.planner.selectedWallIndex];
        w.material = mat;
        const titleEl = document.getElementById("inspector-wall-title");
        const isVi = state.currentLang === "vi";
        if (titleEl) titleEl.textContent = `${isVi ? 'Vách Ngăn' : 'Selected Wall'} #${state.planner.selectedWallIndex + 1} (${mat.toUpperCase()})`;
        renderPlannerObjectTable();
        if (state.planner.aps && state.planner.aps.length > 0) {
            window.recalculateCurrentAPHeatmap();
        } else {
            drawFloorplanHeatmap();
        }
    };

    window.deleteSelectedWall = function() {
        if (state.planner.selectedWallIndex < 0) return;
        window.deleteWallAt(state.planner.selectedWallIndex);
    };

    window.applyFloorplanDimensions = function() {
        const wInput = document.getElementById("planner-width-input");
        const hInput = document.getElementById("planner-height-input");
        const w = parseFloat(wInput ? wInput.value : 12.0) || 12.0;
        const h = parseFloat(hInput ? hInput.value : 8.0) || 8.0;

        state.planner.width_m = Math.max(4.0, Math.min(100.0, w));
        state.planner.height_m = Math.max(4.0, Math.min(100.0, h));
        state.planner.heatmap = null;
        state.planner.aps = [];
        resetPlannerSummaryBox();
        updateWallCountBadge();
        drawFloorplanHeatmap();
    };

    window.undoLastWall = function() {
        if (state.planner.walls.length > 0) {
            const popped = state.planner.walls.pop();
            if (popped && popped.roomId !== undefined) {
                state.planner.walls = state.planner.walls.filter(w => w.roomId !== popped.roomId);
            }
            cleanupOrphanRoomLabels();
            window.deselectWall();
            updateWallCountBadge();
            if (state.planner.aps && state.planner.aps.length > 0) {
                window.recalculateCurrentAPHeatmap();
            } else {
                drawFloorplanHeatmap();
            }
        }
    };

    window.clearAllWalls = function() {
        const isVi = state.currentLang === "vi";
        if (state.planner.walls.length > 0 || state.planner.aps.length > 0) {
            if (!confirm(isVi ? "Bạn có chắc chắn muốn xóa toàn bộ vách ngăn và bộ phát trên mặt bằng không?" : "Are you sure you want to clear all walls and APs on the floorplan?")) return;
        }
        state.planner.walls = [];
        state.planner.aps = [];
        state.planner.heatmap = null;
        state.planner.roomLabels = [];
        state.planner.rulerMeasure = null;
        resetPlannerSummaryBox();
        window.deselectWall();
        updateWallCountBadge();
        drawFloorplanHeatmap();
    };

    window.loadFloorplanPreset = function(preset) {
        state.planner.preset = preset;
        state.planner.heatmap = null;
        state.planner.aps = [];
        state.planner.rulerMeasure = null;
        resetPlannerSummaryBox();
        window.deselectWall();

        const wInput = document.getElementById("planner-width-input");
        const hInput = document.getElementById("planner-height-input");

        if (preset === "custom") {
            state.planner.width_m = 12.0;
            state.planner.height_m = 8.0;
            state.planner.walls = [];
            state.planner.roomLabels = [];
            if (wInput) wInput.value = 12;
            if (hInput) hInput.value = 8;
        } else if (preset === "apartment") {
            state.planner.width_m = 12.0;
            state.planner.height_m = 8.0;
            if (wInput) wInput.value = 12;
            if (hInput) hInput.value = 8;
            state.planner.walls = [
                { x1: 0, y1: 4, x2: 5.5, y2: 4, material: "brick" },
                { x1: 5.5, y1: 4, x2: 7, y2: 4, material: "door" },
                { x1: 7, y1: 0, x2: 7, y2: 8, material: "concrete" },
                { x1: 7, y1: 4, x2: 12, y2: 4, material: "brick" },
                { x1: 3, y1: 4, x2: 3, y2: 8, material: "glass" }
            ];
            state.planner.roomLabels = [
                { text: "P.Khách (Living • 28m²)", x: 3.5, y: 2.0 },
                { text: "Bếp & Ăn (Dining • 16m²)", x: 5.0, y: 6.0 },
                { text: "P.Ngủ Master (20m²)", x: 9.5, y: 2.0 },
                { text: "P.Ngủ 2 (20m²)", x: 9.5, y: 6.0 }
            ];
        } else if (preset === "townhouse") {
            state.planner.width_m = 20.0;
            state.planner.height_m = 6.0;
            if (wInput) wInput.value = 20;
            if (hInput) hInput.value = 6;
            state.planner.walls = [
                { x1: 6, y1: 0, x2: 6, y2: 4.5, material: "concrete" },
                { x1: 6, y1: 4.5, x2: 6, y2: 6, material: "door" },
                { x1: 13, y1: 0, x2: 13, y2: 6, material: "brick" },
                { x1: 8.5, y1: 1.5, x2: 10.5, y2: 1.5, material: "metal" }
            ];
            state.planner.roomLabels = [
                { text: "Sảnh / Gara & Khách (36m²)", x: 3.0, y: 3.0 },
                { text: "Cầu Thang & Thang Máy (42m²)", x: 9.5, y: 3.5 },
                { text: "Bếp & Phòng Ăn Sau (42m²)", x: 16.5, y: 3.0 }
            ];
        } else if (preset === "office") {
            state.planner.width_m = 20.0;
            state.planner.height_m = 12.0;
            if (wInput) wInput.value = 20;
            if (hInput) hInput.value = 12;
            state.planner.walls = [
                { x1: 0, y1: 5, x2: 7, y2: 5, material: "glass" },
                { x1: 7, y1: 0, x2: 7, y2: 5, material: "glass" },
                { x1: 13, y1: 0, x2: 13, y2: 5, material: "glass" },
                { x1: 13, y1: 5, x2: 20, y2: 5, material: "glass" },
                { x1: 9, y1: 5.5, x2: 11, y2: 5.5, material: "metal" },
                { x1: 10, y1: 7, x2: 10, y2: 12, material: "concrete" }
            ];
            state.planner.roomLabels = [
                { text: "Phòng Họp A (Glass • 35m²)", x: 3.5, y: 2.5 },
                { text: "Phòng Họp B (Glass • 35m²)", x: 16.5, y: 2.5 },
                { text: "Khu Làm Việc Chung (Open • 140m²)", x: 10.0, y: 9.0 }
            ];
        }
        updateWallCountBadge();
        drawFloorplanHeatmap();
    };

    window.completeAndRunPlanner = async function() {
        window.runAIPlanner = window.completeAndRunPlanner;
        const btnTop = document.getElementById("btn-complete-planner");
        const btnBottom = document.getElementById("btn-complete-planner-bottom");
        const btnLabel = document.getElementById("btn-complete-label");
        const isVi = state.currentLang === "vi";

        const setBtnState = (loading) => {
            [btnTop, btnBottom].forEach(b => {
                if (!b) return;
                b.disabled = loading;
                b.style.opacity = loading ? "0.7" : "1";
            });
            if (btnLabel) {
                btnLabel.innerHTML = loading 
                    ? `<div class="spinner mini" style="display:inline-block; margin-right:8px;"></div> ${isVi ? '⚙️ Đang tính toán vị trí bộ phát & tạo bản đồ nhiệt...' : '⚙️ Calculating optimal AP placement & Heatmap...'}`
                    : (isVi ? '✅ Tự Động Bố Trí AP & Tính Độ Phủ Sóng' : '✅ Auto-Place APs & Compute Coverage');
            }
        };

        setBtnState(true);

        try {
            const wInput = document.getElementById("planner-width-input");
            const hInput = document.getElementById("planner-height-input");
            if (wInput) state.planner.width_m = Math.max(4.0, parseFloat(wInput.value) || state.planner.width_m || 12.0);
            if (hInput) state.planner.height_m = Math.max(4.0, parseFloat(hInput.value) || state.planner.height_m || 8.0);

            const cleanWalls = (state.planner.walls || []).map(w => ({
                x1: parseFloat(w.x1) || 0.0,
                y1: parseFloat(w.y1) || 0.0,
                x2: parseFloat(w.x2) || 0.0,
                y2: parseFloat(w.y2) || 0.0,
                material: String(w.material || "brick").toLowerCase()
            })).filter(w => (w.x1 !== w.x2 || w.y1 !== w.y2));

            const payload = {
                width_m: state.planner.width_m,
                height_m: state.planner.height_m,
                walls: cleanWalls,
                max_aps: 4,
                freq_ghz: state.planner.freq_ghz || 2.4,
                sla_profile: state.planner.slaProfile || "office"
            };

            const res = await fetch("/api/ai-planner/optimize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || (isVi ? "Máy chủ không thể tính toán mặt bằng" : "Server failed to calculate floorplan"));
            }

            const data = await res.json();
            state.planner.aps = data.access_points || [];
            state.planner.heatmap = data.heatmap || null;
            updateEkahauKpiStrip(state.planner.heatmap);

            const badge = document.getElementById("planner-coverage-badge");
            if (badge) {
                badge.textContent = `${isVi ? 'Tỷ Lệ Phủ Sóng:' : 'Coverage:'} ${data.coverage_percentage}% (${data.quality_rating})`;
                badge.style.backgroundColor = data.coverage_percentage >= 90 ? "#10b981" : "#f59e0b";
            }

            const rationaleBox = document.getElementById("planner-rationale-list");
            if (rationaleBox && data.ai_rationale) {
                rationaleBox.innerHTML = `
                    <div style="margin-bottom:8px; font-weight:700; color:var(--text-primary);">
                        ${isVi ? 'Kết quả tính toán tối ưu:' : 'RF Optimization Summary:'} Cần trang bị <b>${data.recommended_ap_count} Access Point</b> (băng tần mô phỏng <b>${state.planner.freq_ghz || 2.4} GHz</b>) để phủ sóng <b>${data.coverage_percentage}%</b> diện tích đạt chuẩn SLA. Bạn có thể chuyển đổi 5 chế độ Bản Đồ Nhiệt bên trên hoặc kéo trực tiếp các điểm AP trên bản vẽ.
                    </div>
                    <ul style="padding-left: 20px; display: flex; flex-direction: column; gap: 6px;">
                        ${data.ai_rationale.map(r => `<li>${escapeHtml(r)}</li>`).join("")}
                    </ul>
                    <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
                        ${data.access_points.map(a => `
                            <span class="badge" style="background:#1e293b; border:1px solid #06b6d4; color:#fff; padding:6px 10px; font-size:0.82rem;">
                                📍 <b>${a.name}</b> (x=${a.x}m, y=${a.y}m) • 2.4G: <b>Ch ${a.channel_24}</b> • 5G: <b>Ch ${a.channel_5}</b> • 6G: <b>Ch ${a.channel_6 || 37}</b> (${a.role})
                            </span>
                        `).join("")}
                    </div>
                `;
            }

            updateWallCountBadge();
            drawFloorplanHeatmap();

            const resultBox = document.getElementById("planner-result-box");
            if (resultBox) {
                resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        } catch (e) {
            console.error("Planner calculation error:", e);
            alert((isVi ? "Lỗi tính toán quy hoạch AP: " : "AP Placement Planner Error: ") + e.message);
        } finally {
            setBtnState(false);
            safeCreateIcons();
        }
    };

    function distToSegment(p, v, w) {
        const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
    }

    function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
        const ccw = (p1x, p1y, p2x, p2y, p3x, p3y) => (p3y - p1y) * (p2x - p1x) > (p2y - p1y) * (p3x - p1x);
        return (ccw(ax, ay, cx, cy, dx, dy) !== ccw(bx, by, cx, cy, dx, dy)) &&
               (ccw(ax, ay, bx, by, cx, cy) !== ccw(ax, ay, bx, by, dx, dy));
    }

    const RULER_TOP = 28;
    const RULER_LEFT = 36;
    const RULER_RIGHT = 14;
    const RULER_BOTTOM = 22;

    function getPlotMetrics() {
        const canvas = document.getElementById("canvas-floorplan-heatmap");
        const W = canvas ? canvas.width : 960;
        const H = canvas ? canvas.height : 520;
        const width_m = state.planner.width_m || 12.0;
        const height_m = state.planner.height_m || 8.0;
        const plotW = W - RULER_LEFT - RULER_RIGHT;
        const plotH = H - RULER_TOP - RULER_BOTTOM;
        const scaleX = plotW / width_m;
        const scaleY = plotH / height_m;
        return { width_m, height_m, plotW, plotH, scaleX, scaleY, W, H };
    }

    function toCanvasX(mx) {
        const m = getPlotMetrics();
        return RULER_LEFT + mx * m.scaleX;
    }

    function toCanvasY(my) {
        const m = getPlotMetrics();
        return RULER_TOP + my * m.scaleY;
    }

    function setupPlannerCanvasInteraction() {
        const canvas = document.getElementById("canvas-floorplan-heatmap");
        if (!canvas) return;

        function getCoords(e) {
            const rect = canvas.getBoundingClientRect();
            const px = (e.clientX - rect.left) * (canvas.width / rect.width);
            const py = (e.clientY - rect.top) * (canvas.height / rect.height);
            const m = getPlotMetrics();
            const mx = Math.max(0, Math.min(m.width_m, (px - RULER_LEFT) / m.scaleX));
            const my = Math.max(0, Math.min(m.height_m, (py - RULER_TOP) / m.scaleY));
            return { x: mx, y: my, px, py };
        }

        function snap(val, step = 0.5) {
            return Math.round(val / step) * step;
        }

        function findApHit(pt) {
            const aps = state.planner.aps || [];
            for (let i = 0; i < aps.length; i++) {
                const ax = toCanvasX(aps[i].x);
                const ay = toCanvasY(aps[i].y);
                if (Math.hypot(pt.px - ax, pt.py - ay) <= 20) {
                    return i;
                }
            }
            return -1;
        }

        function findHitTarget(pt) {
            const selIdx = state.planner.selectedWallIndex;
            if (selIdx >= 0 && selIdx < state.planner.walls.length) {
                const sw = state.planner.walls[selIdx];
                const h1x = toCanvasX(sw.x1), h1y = toCanvasY(sw.y1);
                const h2x = toCanvasX(sw.x2), h2y = toCanvasY(sw.y2);
                const midx = (h1x + h2x) / 2, midy = (h1y + h2y) / 2;

                if (Math.hypot(pt.px - h1x, pt.py - h1y) <= 15) {
                    return { wallIdx: selIdx, part: "handle1" };
                }
                if (Math.hypot(pt.px - h2x, pt.py - h2y) <= 15) {
                    return { wallIdx: selIdx, part: "handle2" };
                }
                if (Math.hypot(pt.px - midx, pt.py - midy) <= 24) {
                    return { wallIdx: selIdx, part: "midpoint" };
                }
                const dSel = distToSegment(pt, { x: sw.x1, y: sw.y1 }, { x: sw.x2, y: sw.y2 });
                if (dSel <= 0.45) {
                    return { wallIdx: selIdx, part: "body" };
                }
            }

            let bestHit = null;
            let minDist = 0.55;
            for (let idx = 0; idx < state.planner.walls.length; idx++) {
                if (idx === selIdx) continue;
                const w = state.planner.walls[idx];
                const h1x = toCanvasX(w.x1), h1y = toCanvasY(w.y1);
                const h2x = toCanvasX(w.x2), h2y = toCanvasY(w.y2);

                if (Math.hypot(pt.px - h1x, pt.py - h1y) <= 14) {
                    return { wallIdx: idx, part: "handle1" };
                }
                if (Math.hypot(pt.px - h2x, pt.py - h2y) <= 14) {
                    return { wallIdx: idx, part: "handle2" };
                }

                const d = distToSegment(pt, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
                if (d < minDist) {
                    minDist = d;
                    bestHit = { wallIdx: idx, part: "body" };
                }
            }
            return bestHit;
        }

        let dragMode = null; // null | 'draw' | 'room' | 'ruler' | 'move_ap' | 'move_wall' | 'drag_handle1' | 'drag_handle2'
        let dragWallIdx = -1;
        let dragApIdx = -1;
        let dragStartPt = null;
        let dragOrigWall = null;

        canvas.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;
            const pt = getCoords(e);
            const apHit = findApHit(pt);
            const hit = findHitTarget(pt);
            const tool = state.planner.activeTool;

            if (tool === "delete") {
                if (apHit >= 0) {
                    window.deletePlacedAp(apHit);
                    return;
                }
                if (hit && hit.wallIdx >= 0) {
                    window.deleteWallAt(hit.wallIdx);
                }
                return;
            }

            if (tool === "ruler") {
                window.deselectWall();
                dragMode = "ruler";
                dragStartPt = { x: snap(pt.x, 0.25), y: snap(pt.y, 0.25) };
                state.planner.rulerMeasure = { x1: dragStartPt.x, y1: dragStartPt.y, x2: dragStartPt.x, y2: dragStartPt.y };
                drawFloorplanHeatmap();
                return;
            }

            if (apHit >= 0) {
                dragApIdx = apHit;
                dragMode = "move_ap";
                canvas.style.cursor = "grabbing";
                drawFloorplanHeatmap();
                return;
            }

            if (tool === "place_ap") {
                const newIdx = (state.planner.aps || []).length + 1;
                const ch24Pool = [1, 6, 11];
                const ch5Pool = [36, 44, 149, 157];
                state.planner.aps.push({
                    id: newIdx,
                    name: `AP-${newIdx}`,
                    x: snap(pt.x, 0.25),
                    y: snap(pt.y, 0.25),
                    channel_24: ch24Pool[(newIdx - 1) % ch24Pool.length],
                    channel_5: ch5Pool[(newIdx - 1) % ch5Pool.length],
                    tx_power_dbm: 20,
                    role: newIdx === 1 ? "Primary Router" : `Mesh Node #${newIdx - 1}`
                });
                window.recalculateCurrentAPHeatmap();
                return;
            }

            if (hit && hit.wallIdx >= 0 && tool !== "room") {
                dragWallIdx = hit.wallIdx;
                window.selectWall(dragWallIdx);
                const w = state.planner.walls[dragWallIdx];
                dragOrigWall = { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 };
                dragStartPt = { x: pt.x, y: pt.y };

                if (hit.part === "handle1") {
                    dragMode = "drag_handle1";
                    canvas.style.cursor = "crosshair";
                } else if (hit.part === "handle2") {
                    dragMode = "drag_handle2";
                    canvas.style.cursor = "crosshair";
                } else {
                    dragMode = "move_wall";
                    canvas.style.cursor = "grabbing";
                }
                drawFloorplanHeatmap();
                return;
            }

            if (tool === "room") {
                window.deselectWall();
                dragMode = "room";
                dragStartPt = { x: snap(pt.x, 0.5), y: snap(pt.y, 0.5) };
                state.planner.previewRoom = null;
            } else if (tool === "draw") {
                window.deselectWall();
                dragMode = "draw";
                dragStartPt = { x: snap(pt.x, 0.5), y: snap(pt.y, 0.5) };
                state.planner.previewWall = null;
            } else {
                window.deselectWall();
            }
            drawFloorplanHeatmap();
        });

        canvas.addEventListener("mousemove", (e) => {
            const pt = getCoords(e);
            state.planner.cursorMeters = { x: pt.x, y: pt.y };
            const m = getPlotMetrics();

            if (dragMode) {
                if (dragMode === "move_ap" && dragApIdx >= 0 && dragApIdx < state.planner.aps.length) {
                    state.planner.aps[dragApIdx].x = Math.max(0.25, Math.min(m.width_m - 0.25, snap(pt.x, 0.25)));
                    state.planner.aps[dragApIdx].y = Math.max(0.25, Math.min(m.height_m - 0.25, snap(pt.y, 0.25)));
                    drawFloorplanHeatmap();
                    return;
                }

                if (dragMode === "ruler" && dragStartPt) {
                    state.planner.rulerMeasure = {
                        x1: dragStartPt.x,
                        y1: dragStartPt.y,
                        x2: snap(pt.x, 0.25),
                        y2: snap(pt.y, 0.25)
                    };
                    drawFloorplanHeatmap();
                    return;
                }

                if (dragMode === "room" && dragStartPt) {
                    const matSelect = document.getElementById("planner-material-select");
                    const mat = matSelect ? matSelect.value : "brick";
                    state.planner.previewRoom = {
                        x1: dragStartPt.x,
                        y1: dragStartPt.y,
                        x2: snap(pt.x, 0.5),
                        y2: snap(pt.y, 0.5),
                        material: mat
                    };
                    drawFloorplanHeatmap();
                    return;
                }

                if (dragMode === "drag_handle1" && dragWallIdx >= 0 && dragWallIdx < state.planner.walls.length) {
                    const w = state.planner.walls[dragWallIdx];
                    let nx = snap(pt.x, 0.25);
                    let ny = snap(pt.y, 0.25);

                    if (e.shiftKey) {
                        if (Math.abs(nx - w.x2) > Math.abs(ny - w.y2)) ny = w.y2;
                        else nx = w.x2;
                    }
                    w.x1 = Math.max(0, Math.min(m.width_m, nx));
                    w.y1 = Math.max(0, Math.min(m.height_m, ny));

                    const liveLen = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
                    const lenEl = document.getElementById("inspector-wall-length");
                    if (lenEl) lenEl.value = convertMetersToUnit(liveLen, state.planner.unit || "m");

                    drawFloorplanHeatmap();
                    return;
                }

                if (dragMode === "drag_handle2" && dragWallIdx >= 0 && dragWallIdx < state.planner.walls.length) {
                    const w = state.planner.walls[dragWallIdx];
                    let nx = snap(pt.x, 0.25);
                    let ny = snap(pt.y, 0.25);

                    if (e.shiftKey) {
                        if (Math.abs(nx - w.x1) > Math.abs(ny - w.y1)) ny = w.y1;
                        else nx = w.x1;
                    }
                    w.x2 = Math.max(0, Math.min(m.width_m, nx));
                    w.y2 = Math.max(0, Math.min(m.height_m, ny));

                    const liveLen = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
                    const lenEl = document.getElementById("inspector-wall-length");
                    if (lenEl) lenEl.value = convertMetersToUnit(liveLen, state.planner.unit || "m");

                    drawFloorplanHeatmap();
                    return;
                }

                if (dragMode === "move_wall" && dragWallIdx >= 0 && dragOrigWall && dragStartPt) {
                    const w = state.planner.walls[dragWallIdx];
                    let dx = snap(pt.x - dragStartPt.x, 0.25);
                    let dy = snap(pt.y - dragStartPt.y, 0.25);

                    let nx1 = dragOrigWall.x1 + dx;
                    let ny1 = dragOrigWall.y1 + dy;
                    let nx2 = dragOrigWall.x2 + dx;
                    let ny2 = dragOrigWall.y2 + dy;

                    const minX = Math.min(nx1, nx2);
                    const maxX = Math.max(nx1, nx2);
                    const minY = Math.min(ny1, ny2);
                    const maxY = Math.max(ny1, ny2);

                    if (minX < 0) { nx1 -= minX; nx2 -= minX; }
                    if (maxX > m.width_m) { const shift = maxX - m.width_m; nx1 -= shift; nx2 -= shift; }
                    if (minY < 0) { ny1 -= minY; ny2 -= minY; }
                    if (maxY > m.height_m) { const shift = maxY - m.height_m; ny1 -= shift; ny2 -= shift; }

                    w.x1 = Math.round(nx1 * 100) / 100;
                    w.y1 = Math.round(ny1 * 100) / 100;
                    w.x2 = Math.round(nx2 * 100) / 100;
                    w.y2 = Math.round(ny2 * 100) / 100;

                    drawFloorplanHeatmap();
                    return;
                }

                if (dragMode === "draw" && dragStartPt) {
                    let endX = snap(pt.x, 0.5);
                    let endY = snap(pt.y, 0.5);

                    if (e.shiftKey) {
                        if (Math.abs(endX - dragStartPt.x) > Math.abs(endY - dragStartPt.y)) endY = dragStartPt.y;
                        else endX = dragStartPt.x;
                    }

                    const matSelect = document.getElementById("planner-material-select");
                    const mat = matSelect ? matSelect.value : "brick";

                    state.planner.previewWall = {
                        x1: dragStartPt.x,
                        y1: dragStartPt.y,
                        x2: endX,
                        y2: endY,
                        material: mat
                    };
                    drawFloorplanHeatmap();
                    return;
                }
            }

            const apHit = findApHit(pt);
            const hit = findHitTarget(pt);
            state.planner.hoveredWallIndex = hit ? hit.wallIdx : -1;
            state.planner.hoveredPart = hit ? hit.part : null;

            if (apHit >= 0) {
                canvas.style.cursor = (state.planner.activeTool === "delete") ? "pointer" : "grab";
            } else if (state.planner.activeTool === "delete") {
                canvas.style.cursor = hit ? "pointer" : "default";
            } else if (hit && state.planner.activeTool !== "room" && state.planner.activeTool !== "ruler") {
                if (hit.part === "handle1" || hit.part === "handle2") canvas.style.cursor = "crosshair";
                else canvas.style.cursor = "grab";
            } else {
                canvas.style.cursor = (state.planner.activeTool === "draw" || state.planner.activeTool === "room" || state.planner.activeTool === "ruler") ? "crosshair" : "default";
            }
            drawFloorplanHeatmap();
        });

        const finishDragging = (e) => {
            if (!dragMode) return;
            const pt = getCoords(e);

            if (dragMode === "move_ap") {
                window.recalculateCurrentAPHeatmap();
            } else if (dragMode === "room" && dragStartPt) {
                const xA = Math.min(dragStartPt.x, snap(pt.x, 0.5));
                const xB = Math.max(dragStartPt.x, snap(pt.x, 0.5));
                const yA = Math.min(dragStartPt.y, snap(pt.y, 0.5));
                const yB = Math.max(dragStartPt.y, snap(pt.y, 0.5));
                const rw = xB - xA;
                const rh = yB - yA;
                if (rw >= 1.0 && rh >= 1.0) {
                    const matSelect = document.getElementById("planner-material-select");
                    const mat = matSelect ? matSelect.value : "brick";
                    const roomId = Date.now() + Math.floor(Math.random() * 1000);
                    state.planner.walls.push(
                        { x1: xA, y1: yA, x2: xB, y2: yA, material: mat, roomId },
                        { x1: xB, y1: yA, x2: xB, y2: yB, material: mat, roomId },
                        { x1: xB, y1: yB, x2: xA, y2: yB, material: mat, roomId },
                        { x1: xA, y1: yB, x2: xA, y2: yA, material: mat, roomId }
                    );
                    const areaM2 = (rw * rh).toFixed(1);
                    const roomNum = (state.planner.roomLabels || []).length + 1;
                    state.planner.roomLabels.push({
                        roomId,
                        text: `Phòng #${roomNum} (${rw}m×${rh}m • ${areaM2}m²)`,
                        x: (xA + xB) / 2,
                        y: (yA + yB) / 2
                    });
                    updateWallCountBadge();
                    if (state.planner.aps && state.planner.aps.length > 0) window.recalculateCurrentAPHeatmap();
                }
            } else if (dragMode === "draw" && dragStartPt) {
                let endX = snap(pt.x, 0.5);
                let endY = snap(pt.y, 0.5);

                if (e.shiftKey) {
                    if (Math.abs(endX - dragStartPt.x) > Math.abs(endY - dragStartPt.y)) endY = dragStartPt.y;
                    else endX = dragStartPt.x;
                }

                const dist = Math.hypot(endX - dragStartPt.x, endY - dragStartPt.y);
                if (dist >= 0.5) {
                    const matSelect = document.getElementById("planner-material-select");
                    const mat = matSelect ? matSelect.value : "brick";
                    state.planner.walls.push({
                        x1: dragStartPt.x,
                        y1: dragStartPt.y,
                        x2: endX,
                        y2: endY,
                        material: mat
                    });
                    updateWallCountBadge();
                    const newIdx = state.planner.walls.length - 1;
                    window.selectWall(newIdx);
                    if (state.planner.aps && state.planner.aps.length > 0) window.recalculateCurrentAPHeatmap();
                }
            } else if (dragMode === "drag_handle1" || dragMode === "drag_handle2" || dragMode === "move_wall") {
                if (dragWallIdx >= 0 && dragWallIdx < state.planner.walls.length) {
                    const w = state.planner.walls[dragWallIdx];
                    const dist = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
                    if (dist < 0.25 && dragOrigWall) {
                        w.x1 = dragOrigWall.x1;
                        w.y1 = dragOrigWall.y1;
                        w.x2 = dragOrigWall.x2;
                        w.y2 = dragOrigWall.y2;
                    }
                    const finalLen = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
                    const lenEl = document.getElementById("inspector-wall-length");
                    if (lenEl) lenEl.value = convertMetersToUnit(finalLen, state.planner.unit || "m");
                }
                renderPlannerObjectTable();
                if (state.planner.aps && state.planner.aps.length > 0) window.recalculateCurrentAPHeatmap();
            }

            dragMode = null;
            dragWallIdx = -1;
            dragApIdx = -1;
            dragStartPt = null;
            dragOrigWall = null;
            state.planner.previewWall = null;
            state.planner.previewRoom = null;
            drawFloorplanHeatmap();
        };

        canvas.addEventListener("mouseup", finishDragging);
        canvas.addEventListener("mouseleave", finishDragging);

        window.addEventListener("keydown", (e) => {
            const tabPlanner = document.getElementById("tab-planner");
            if (!tabPlanner || !tabPlanner.classList.contains("active")) return;
            const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
            if (tag === "input" || tag === "select" || tag === "textarea") return;

            if (e.key === "Delete" || e.key === "Backspace") {
                if (state.planner.selectedWallIndex >= 0) {
                    e.preventDefault();
                    window.deleteSelectedWall();
                }
            } else if (e.key === "Escape") {
                state.planner.rulerMeasure = null;
                window.deselectWall();
            }
        });
    }

    // DRAW FLOORPLAN DRAFTING & RF HEATMAP CANVAS
    function drawFloorplanHeatmap() {
        const canvas = document.getElementById("canvas-floorplan-heatmap");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const W = canvas.width;
        const H = canvas.height;

        const width_m = state.planner.width_m || 12.0;
        const height_m = state.planner.height_m || 8.0;
        const curUnit = state.planner.unit || "m";

        const plotX = RULER_LEFT;
        const plotY = RULER_TOP;
        const plotW = W - RULER_LEFT - RULER_RIGHT;
        const plotH = H - RULER_TOP - RULER_BOTTOM;

        const scaleX = plotW / width_m;
        const scaleY = plotH / height_m;

        function toX(mx) { return plotX + mx * scaleX; }
        function toY(my) { return plotY + my * scaleY; }

        const isDark = state.theme === "dark";

        // 1. CLEAR & FILL BASE (Light & Dark Theme adaptive)
        ctx.fillStyle = isDark ? "#070c17" : "#f1f5f9";
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = isDark ? "#0a1324" : "#ffffff";
        ctx.fillRect(plotX, plotY, plotW, plotH);

        // 2. DRAW HEATMAP (Ekahau 5-Mode Matrix Renderer)
        const hm = state.planner.heatmap;
        const activeMode = state.planner.heatmapMode || "primary_rssi";
        if (hm && hm.grid && hm.grid.length > 0) {
            let activeGrid = hm.primary_rssi_grid || hm.grid;
            if (activeMode === "secondary_rssi" && hm.secondary_rssi_grid) activeGrid = hm.secondary_rssi_grid;
            else if (activeMode === "snr" && hm.snr_grid) activeGrid = hm.snr_grid;
            else if (activeMode === "interference" && hm.interference_grid) activeGrid = hm.interference_grid;
            else if (activeMode === "throughput" && hm.throughput_grid) activeGrid = hm.throughput_grid;

            const gridH = activeGrid.length;
            const gridW = activeGrid[0].length;
            const cellW = plotW / gridW;
            const cellH = plotH / gridH;

            const slaCutoff = state.planner.slaCutoff !== undefined ? state.planner.slaCutoff : -65.0;
            let compliantCells = 0;
            const totalCells = gridH * gridW;

            for (let j = 0; j < gridH; j++) {
                for (let i = 0; i < gridW; i++) {
                    const val = activeGrid[j][i];
                    const cx = plotX + i * cellW;
                    const cy = plotY + j * cellH;

                    if (activeMode === "snr") ctx.fillStyle = getSnrColor(val);
                    else if (activeMode === "interference") ctx.fillStyle = getInterferenceColor(val);
                    else if (activeMode === "throughput") ctx.fillStyle = getThroughputColor(val);
                    else ctx.fillStyle = getRssiColor(val);
                    ctx.fillRect(cx, cy, cellW + 0.8, cellH + 0.8);

                    // Ekahau SLA Requirement Cutoff Shading & Hazard Cross-Hatching
                    if (activeMode === "primary_rssi" || activeMode === "secondary_rssi") {
                        if (val >= slaCutoff) {
                            compliantCells++;
                        } else {
                            // Darken non-compliant dead-zone
                            ctx.fillStyle = isDark ? "rgba(10, 16, 30, 0.78)" : "rgba(226, 232, 240, 0.85)";
                            ctx.fillRect(cx, cy, cellW + 0.8, cellH + 0.8);
                            // Subtle hazard cross-hatching
                            ctx.strokeStyle = isDark ? "rgba(239, 68, 68, 0.38)" : "rgba(239, 68, 68, 0.52)";
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            ctx.moveTo(cx, cy);
                            ctx.lineTo(cx + cellW, cy + cellH);
                            ctx.stroke();
                        }
                    } else if (activeMode === "snr") {
                        if (val >= 20.0) compliantCells++;
                    } else if (activeMode === "interference") {
                        if (val <= 1) compliantCells++;
                    } else if (activeMode === "throughput") {
                        if (val >= 100.0) compliantCells++;
                    }
                }
            }

            // Update Ekahau SLA Compliance Status Badge
            const slaBadge = document.getElementById("ekahau-sla-status-badge");
            if (slaBadge) {
                const slaPct = totalCells > 0 ? ((compliantCells / totalCells) * 100).toFixed(1) : 0;
                const isVi = state.currentLang === "vi";
                if (activeMode === "primary_rssi") {
                    slaBadge.textContent = isVi ? `SLA Sóng Chính: Đạt ${slaPct}% (Ngưỡng ${slaCutoff} dBm)` : `Primary SLA: ${slaPct}% Pass (Cutoff ${slaCutoff} dBm)`;
                } else if (activeMode === "secondary_rssi") {
                    slaBadge.textContent = isVi ? `SLA Chuyển Vùng: Đạt ${slaPct}% (Ngưỡng ${slaCutoff} dBm)` : `Roaming SLA: ${slaPct}% Pass (Cutoff ${slaCutoff} dBm)`;
                } else if (activeMode === "snr") {
                    slaBadge.textContent = isVi ? `SLA Tỷ Số SNR: Đạt ${slaPct}% (≥ 20 dB)` : `SNR SLA: ${slaPct}% Pass (≥ 20 dB)`;
                } else if (activeMode === "interference") {
                    slaBadge.textContent = isVi ? `SLA Không Nhiễu: Đạt ${slaPct}% (≤ 1 AP)` : `Clean Spectrum SLA: ${slaPct}% Pass`;
                } else {
                    slaBadge.textContent = isVi ? `SLA Băng Thông: Đạt ${slaPct}% (≥ 100 Mbps)` : `Throughput SLA: ${slaPct}% Pass`;
                }
                slaBadge.style.background = slaPct >= 85 ? "rgba(16, 185, 129, 0.2)" : (slaPct >= 65 ? "rgba(245, 158, 11, 0.2)" : "rgba(239, 68, 68, 0.2)");
                slaBadge.style.color = slaPct >= 85 ? "#10b981" : (slaPct >= 65 ? "#f59e0b" : "#ef4444");
                slaBadge.style.borderColor = slaPct >= 85 ? "#10b981" : (slaPct >= 65 ? "#f59e0b" : "#ef4444");
            }
        }

        // Update Live Point Probe Readout badge on hover
        const probeEl = document.getElementById("planner-hover-probe-readout");
        const curProbeM = state.planner.cursorMeters;
        if (probeEl) {
            if (hm && hm.grid && hm.grid.length > 0 && curProbeM && curProbeM.x >= 0 && curProbeM.x <= width_m && curProbeM.y >= 0 && curProbeM.y <= height_m) {
                const gH = hm.grid.length;
                const gW = hm.grid[0].length;
                const gi = Math.max(0, Math.min(gW - 1, Math.floor((curProbeM.x / width_m) * gW)));
                const gj = Math.max(0, Math.min(gH - 1, Math.floor((curProbeM.y / height_m) * gH)));
                const pRssi = (hm.primary_rssi_grid || hm.grid)[gj]?.[gi] ?? "--";
                const sRssi = hm.secondary_rssi_grid?.[gj]?.[gi] ?? "--";
                const pSnr = hm.snr_grid?.[gj]?.[gi] ?? "--";
                const pInt = hm.interference_grid?.[gj]?.[gi] ?? 0;
                const pTput = hm.throughput_grid?.[gj]?.[gi] ?? "--";
                probeEl.textContent = `🎯 Probe (${curProbeM.x.toFixed(1)}m, ${curProbeM.y.toFixed(1)}m): Pri ${pRssi}dBm | Sec ${sRssi}dBm | SNR ${pSnr}dB | CCI ${pInt} | ${pTput}Mbps`;
            } else {
                probeEl.textContent = state.currentLang === "vi"
                    ? "🎯 Điểm đo: Di chuột lên bản vẽ để xem thông số sóng tại chỗ"
                    : "🎯 Point Probe: Move cursor over canvas to inspect live RF values";
            }
        }

        // 3. ARCHITECTURAL GRID (Theme adaptive)
        ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.05)" : "rgba(15, 23, 42, 0.04)";
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        for (let x = 0.5; x < width_m; x += 1.0) {
            ctx.beginPath();
            ctx.moveTo(toX(x), plotY);
            ctx.lineTo(toX(x), plotY + plotH);
            ctx.stroke();
        }
        for (let y = 0.5; y < height_m; y += 1.0) {
            ctx.beginPath();
            ctx.moveTo(plotX, toY(y));
            ctx.lineTo(plotX + plotW, toY(y));
            ctx.stroke();
        }

        for (let x = 1; x < width_m; x++) {
            const isMajor5 = (x % 5 === 0);
            ctx.strokeStyle = isMajor5 
                ? (isDark ? "rgba(56, 189, 248, 0.22)" : "rgba(2, 132, 199, 0.22)") 
                : (isDark ? "rgba(56, 189, 248, 0.10)" : "rgba(15, 23, 42, 0.07)");
            ctx.lineWidth = isMajor5 ? 1.5 : 1;
            ctx.beginPath();
            ctx.moveTo(toX(x), plotY);
            ctx.lineTo(toX(x), plotY + plotH);
            ctx.stroke();
        }
        for (let y = 1; y < height_m; y++) {
            const isMajor5 = (y % 5 === 0);
            ctx.strokeStyle = isMajor5 
                ? (isDark ? "rgba(56, 189, 248, 0.22)" : "rgba(2, 132, 199, 0.22)") 
                : (isDark ? "rgba(56, 189, 248, 0.10)" : "rgba(15, 23, 42, 0.07)");
            ctx.lineWidth = isMajor5 ? 1.5 : 1;
            ctx.beginPath();
            ctx.moveTo(plotX, toY(y));
            ctx.lineTo(plotX + plotW, toY(y));
            ctx.stroke();
        }

        ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.45)" : "rgba(2, 132, 199, 0.35)";
        ctx.lineWidth = 1;
        for (let x = 2; x < width_m; x += 2) {
            for (let y = 2; y < height_m; y += 2) {
                const gx = toX(x);
                const gy = toY(y);
                ctx.beginPath();
                ctx.moveTo(gx - 4, gy); ctx.lineTo(gx + 4, gy);
                ctx.moveTo(gx, gy - 4); ctx.lineTo(gx, gy + 4);
                ctx.stroke();
            }
        }

        // 4. PERIMETER FRAME & CORNER BRACKETS
        ctx.strokeStyle = isDark ? "#0284c7" : "#0284c7";
        ctx.lineWidth = 2;
        ctx.strokeRect(plotX, plotY, plotW, plotH);

        const bracketLen = 10;
        ctx.strokeStyle = isDark ? "#38bdf8" : "#0284c7";
        ctx.lineWidth = 2.5;
        [
            { x: plotX, y: plotY, dx: 1, dy: 1 },
            { x: plotX + plotW, y: plotY, dx: -1, dy: 1 },
            { x: plotX, y: plotY + plotH, dx: 1, dy: -1 },
            { x: plotX + plotW, y: plotY + plotH, dx: -1, dy: -1 }
        ].forEach(c => {
            ctx.beginPath();
            ctx.moveTo(c.x, c.y + c.dy * bracketLen);
            ctx.lineTo(c.x, c.y);
            ctx.lineTo(c.x + c.dx * bracketLen, c.y);
            ctx.stroke();
        });

        // 5. PRESET & CREATED ROOM LABELS
        if (state.planner.roomLabels) {
            for (const r of state.planner.roomLabels) {
                const rx = toX(r.x);
                const ry = toY(r.y);
                ctx.font = "bold 11px sans-serif";
                const tw = ctx.measureText(r.text).width;
                ctx.fillStyle = isDark ? "rgba(10, 19, 36, 0.75)" : "rgba(255, 255, 255, 0.92)";
                ctx.fillRect(rx - tw/2 - 6, ry - 10, tw + 12, 20);
                ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.25)" : "#cbd5e1";
                ctx.lineWidth = 1;
                ctx.strokeRect(rx - tw/2 - 6, ry - 10, tw + 12, 20);

                ctx.fillStyle = isDark ? "rgba(226, 232, 240, 0.85)" : "#0f172a";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(r.text, rx, ry);
            }
        }

        // 6. LIVE PROJECTION GUIDES
        const curM = state.planner.cursorMeters;
        if (curM && curM.x >= 0 && curM.x <= width_m && curM.y >= 0 && curM.y <= height_m) {
            const cx = toX(curM.x);
            const cy = toY(curM.y);
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = "rgba(14, 165, 233, 0.35)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, plotY);
            ctx.lineTo(cx, cy);
            ctx.lineTo(plotX, cy);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        function getWallStyle(mat) {
            if (mat === "concrete") {
                return { casing: "#334155", core: "#94a3b8", center: "#e2e8f0", width: 8 };
            }
            if (mat === "metal") {
                return { casing: "#4c1d95", core: "#a855f7", center: "#f3e8ff", width: 9 };
            }
            if (mat === "glass") {
                return { casing: "rgba(56, 189, 248, 0.28)", core: "#38bdf8", center: "#ffffff", width: 7 };
            }
            if (mat === "wood") {
                return { casing: "#b45309", core: "#d97706", center: "#fef08a", width: 6 };
            }
            if (mat === "door") {
                return { casing: "#065f46", core: "#10b981", center: "#d1fae5", width: 5 };
            }
            return { casing: "#c2410c", core: "#ea580c", center: "#fed7aa", width: 6 };
        }

        // 7. DRAW SAVED WALLS (With 2.5D Isometric Extrusion Support)
        state.planner.walls.forEach((wall, idx) => {
            const isSelected = (state.planner.selectedWallIndex === idx);
            const isHovered = (state.planner.hoveredWallIndex === idx);
            const style = getWallStyle(wall.material);

            const x1 = toX(wall.x1);
            const y1 = toY(wall.y1);
            const x2 = toX(wall.x2);
            const y2 = toY(wall.y2);
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            // Optional 2.5D Wall Block Extrusion (Sweet Home 3D perspective preview)
            if (state.planner.view25D) {
                const extX = -6;
                const extY = -12;
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.lineTo(x2 + extX, y2 + extY);
                ctx.lineTo(x1 + extX, y1 + extY);
                ctx.closePath();
                ctx.fillStyle = wall.material === "glass" ? "rgba(56, 189, 248, 0.22)" : "rgba(15, 23, 42, 0.72)";
                ctx.fill();
                ctx.strokeStyle = style.core;
                ctx.lineWidth = 1.2;
                ctx.stroke();

                // Top roof edge of 2.5D wall
                ctx.beginPath();
                ctx.moveTo(x1 + extX, y1 + extY);
                ctx.lineTo(x2 + extX, y2 + extY);
                ctx.strokeStyle = style.center;
                ctx.lineWidth = Math.max(2, style.width - 2);
                ctx.stroke();
                ctx.restore();
            }

            if (isSelected) {
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.lineCap = "round";
                ctx.strokeStyle = "#0ea5e9";
                ctx.lineWidth = style.width + 10;
                ctx.setLineDash([8, 5]);
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (isHovered && state.planner.activeTool === "delete") {
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.lineCap = "round";
                ctx.strokeStyle = "#ef4444";
                ctx.lineWidth = style.width + 8;
                ctx.setLineDash([6, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (isHovered) {
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.lineCap = "round";
                ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
                ctx.lineWidth = style.width + 6;
                ctx.stroke();
            }

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineCap = "round";
            ctx.strokeStyle = style.casing;
            ctx.lineWidth = style.width;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineCap = "round";
            ctx.strokeStyle = style.core;
            ctx.lineWidth = Math.max(2, style.width - 2);
            ctx.stroke();

            if (wall.material === "glass" || wall.material === "door") {
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = style.center;
                ctx.lineWidth = 1.2;
                ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
            } else {
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = style.center;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            if (isSelected) {
                [ { x: x1, y: y1 }, { x: x2, y: y2 } ].forEach((pt, pIdx) => {
                    const isPartHovered = isHovered && (
                        (pIdx === 0 && state.planner.hoveredPart === "handle1") ||
                        (pIdx === 1 && state.planner.hoveredPart === "handle2")
                    );
                    const r = isPartHovered ? 10 : 8;

                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, r + 4, 0, Math.PI * 2);
                    ctx.fillStyle = "rgba(14, 165, 233, 0.3)";
                    ctx.fill();

                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
                    ctx.fillStyle = "#ffffff";
                    ctx.fill();
                    ctx.strokeStyle = "#0284c7";
                    ctx.lineWidth = 2.5;
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = "#0284c7";
                    ctx.fill();
                });

                const isMidHovered = isHovered && (state.planner.hoveredPart === "midpoint" || state.planner.hoveredPart === "body");
                const pillW = 86;
                const pillH = 20;
                ctx.fillStyle = isMidHovered ? (isDark ? "#0e2a4a" : "#e0f2fe") : (isDark ? "#091220" : "#ffffff");
                ctx.strokeStyle = isMidHovered ? (isDark ? "#38bdf8" : "#0284c7") : (isDark ? "#0ea5e9" : "#cbd5e1");
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect(midX - pillW/2, midY - pillH/2, pillW, pillH, 10);
                ctx.fill();
                ctx.stroke();

                ctx.font = "bold 10px sans-serif";
                ctx.fillStyle = isMidHovered ? (isDark ? "#7dd3fc" : "#0284c7") : (isDark ? "#38bdf8" : "#0369a1");
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(state.currentLang === "vi" ? "✥ Di Chuyển" : "✥ Move Wall", midX, midY);

                const lenM = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
                const formattedLen = `${convertMetersToUnit(lenM, curUnit)} ${curUnit}`;
                const theta = Math.round(Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1) * 180 / Math.PI);
                const dimText = `📏 ${formattedLen} (${Math.abs(theta)}°)`;

                ctx.font = "bold 11px monospace";
                const tw = ctx.measureText(dimText).width;
                ctx.fillStyle = isDark ? "#060b14" : "#ffffff";
                ctx.fillRect(midX - tw/2 - 6, midY - 28, tw + 12, 18);
                ctx.strokeStyle = isDark ? "#0ea5e9" : "#0284c7";
                ctx.lineWidth = 1.2;
                ctx.strokeRect(midX - tw/2 - 6, midY - 28, tw + 12, 18);

                ctx.fillStyle = isDark ? "#38bdf8" : "#0284c7";
                ctx.fillText(dimText, midX, midY - 19);

            } else {
                ctx.fillStyle = (isHovered && state.planner.activeTool === "delete") ? "#ef4444" : style.core;
                ctx.beginPath();
                ctx.arc(x1, y1, style.width / 2 + 1, 0, Math.PI * 2);
                ctx.arc(x2, y2, style.width / 2 + 1, 0, Math.PI * 2);
                ctx.fill();

                if (isHovered) {
                    const lenM = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
                    const formattedLen = `${convertMetersToUnit(lenM, curUnit)} ${curUnit}`;
                    ctx.font = "bold 11px sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";

                    if (state.planner.activeTool === "delete") {
                        ctx.fillStyle = "#ef4444";
                        ctx.fillText("🗑️ Bấm để Xóa / Click to Delete", midX, midY - 14);
                    } else {
                        ctx.fillStyle = "#38bdf8";
                        ctx.fillText(`👆 Bấm Chọn & Kéo Sửa (${formattedLen})`, midX, midY - 14);
                    }
                }
            }
        });

        // 8A. LIVE DRAWING PREVIEW WALL
        const pw = state.planner.previewWall;
        if (pw) {
            const style = getWallStyle(pw.material);
            const px1 = toX(pw.x1);
            const py1 = toY(pw.y1);
            const px2 = toX(pw.x2);
            const py2 = toY(pw.y2);

            ctx.beginPath();
            ctx.moveTo(px1, py1);
            ctx.lineTo(px2, py2);
            ctx.strokeStyle = style.core;
            ctx.lineWidth = style.width;
            ctx.setLineDash([5, 5]);
            ctx.lineCap = "round";
            ctx.stroke();
            ctx.setLineDash([]);

            const lenM = Math.hypot(pw.x2 - pw.x1, pw.y2 - pw.y1);
            const formattedLen = `${convertMetersToUnit(lenM, curUnit)} ${curUnit}`;
            const midX = (px1 + px2) / 2;
            const midY = (py1 + py2) / 2;
            ctx.font = "bold 11px monospace";
            ctx.fillStyle = "#38bdf8";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(formattedLen, midX, midY - 14);
        }

        // 8B. LIVE DRAWING PREVIEW ROOM BOX (Sweet Home 3D style)
        const pr = state.planner.previewRoom;
        if (pr) {
            const style = getWallStyle(pr.material);
            const xA = Math.min(pr.x1, pr.x2);
            const xB = Math.max(pr.x1, pr.x2);
            const yA = Math.min(pr.y1, pr.y2);
            const yB = Math.max(pr.y1, pr.y2);
            const rx = toX(xA);
            const ry = toY(yA);
            const rwPx = toX(xB) - rx;
            const rhPx = toY(yB) - ry;

            ctx.save();
            ctx.fillStyle = "rgba(14, 165, 233, 0.12)";
            ctx.fillRect(rx, ry, rwPx, rhPx);
            ctx.strokeStyle = style.core;
            ctx.lineWidth = style.width;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(rx, ry, rwPx, rhPx);
            ctx.restore();

            const wM = (xB - xA).toFixed(1);
            const hM = (yB - yA).toFixed(1);
            const areaM2 = ((xB - xA) * (yB - yA)).toFixed(1);
            ctx.font = "bold 11px monospace";
            ctx.fillStyle = "#38bdf8";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`${wM}m × ${hM}m (${areaM2} m²)`, rx + rwPx / 2, ry + rhPx / 2);
        }

        // 8C. SKETCHUP-STYLE TAPE MEASURE & PATH LOSS RULER
        const rm = state.planner.rulerMeasure;
        if (rm) {
            const rx1 = toX(rm.x1);
            const ry1 = toY(rm.y1);
            const rx2 = toX(rm.x2);
            const ry2 = toY(rm.y2);
            const distM = Math.hypot(rm.x2 - rm.x1, rm.y2 - rm.y1);

            let wallHits = 0;
            let wallLoss = 0;
            const freqG = state.planner.freq_ghz || 2.4;
            const freqMult = freqG >= 6.0 ? 1.42 : (freqG >= 5.0 ? 1.25 : 1.0);

            (state.planner.walls || []).forEach(w => {
                if (segmentsIntersect(rm.x1, rm.y1, rm.x2, rm.y2, w.x1, w.y1, w.x2, w.y2)) {
                    wallHits++;
                    const mKey = String(w.material || "brick").toLowerCase();
                    wallLoss += (MATERIAL_DB_LOSS[mKey] || 6.0) * freqMult;
                }
            });

            const fsplBase = freqG >= 6.0 ? 48.2 : (freqG >= 5.0 ? 46.5 : 40.0);
            const pathLossExp = freqG >= 6.0 ? 31.0 : (freqG >= 5.0 ? 30.0 : 28.0);
            const fspl = distM > 0.2 ? fsplBase + pathLossExp * Math.log10(Math.max(1.0, distM)) : 0;
            const totalLoss = (fspl + wallLoss).toFixed(1);

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(rx1, ry1);
            ctx.lineTo(rx2, ry2);
            ctx.strokeStyle = "#facc15";
            ctx.lineWidth = 2.2;
            ctx.setLineDash([6, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            [{ x: rx1, y: ry1 }, { x: rx2, y: ry2 }].forEach(pt => {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = "#facc15";
                ctx.fill();
                ctx.strokeStyle = "#0f172a";
                ctx.lineWidth = 1.5;
                ctx.stroke();
            });

            const midX = (rx1 + rx2) / 2;
            const midY = (ry1 + ry2) / 2;
            const isVi = state.currentLang === "vi";
            const label = isVi
                ? `📐 ${convertMetersToUnit(distM, curUnit)} ${curUnit} | ${wallHits} vách (-${wallLoss.toFixed(1)}dB) | Tổng suy hao: -${totalLoss} dB`
                : `📐 ${convertMetersToUnit(distM, curUnit)} ${curUnit} | ${wallHits} walls (-${wallLoss.toFixed(1)}dB) | Total loss: -${totalLoss} dB`;
            ctx.font = "bold 11px monospace";
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
            ctx.fillRect(midX - tw / 2 - 8, midY - 26, tw + 16, 20);
            ctx.strokeStyle = "#facc15";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(midX - tw / 2 - 8, midY - 26, tw + 16, 20);
            ctx.fillStyle = "#fef08a";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, midX, midY - 16);
            ctx.restore();
        }

        // 9. DRAW OPTIMIZED OR MANUALLY PLACED AP MARKERS
        for (const ap of state.planner.aps) {
            const cx = toX(ap.x);
            const cy = toY(ap.y);

            ctx.beginPath();
            ctx.arc(cx, cy, 26, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(6, 182, 212, 0.20)";
            ctx.fill();
            ctx.strokeStyle = "rgba(6, 182, 212, 0.75)";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(cx, cy, 16, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(6, 182, 212, 0.35)";
            ctx.fill();

            ctx.beginPath();
            ctx.arc(cx, cy, 9, 0, Math.PI * 2);
            ctx.fillStyle = "#06b6d4";
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2.5;
            ctx.stroke();

            ctx.font = "bold 11px sans-serif";
            const label = `${ap.name} (Ch ${ap.channel_24}/${ap.channel_5}/6G:${ap.channel_6 || 37})`;
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = "rgba(8, 14, 26, 0.90)";
            ctx.fillRect(cx - tw/2 - 6, cy - 38, tw + 12, 20);
            ctx.strokeStyle = "#06b6d4";
            ctx.lineWidth = 1.2;
            ctx.strokeRect(cx - tw/2 - 6, cy - 38, tw + 12, 20);

            ctx.fillStyle = "#38bdf8";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, cx, cy - 28);
        }

        // 10. TOP METRIC RULER
        ctx.fillStyle = "#050912";
        ctx.fillRect(0, 0, W, RULER_TOP);
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, RULER_TOP);
        ctx.lineTo(W, RULER_TOP);
        ctx.stroke();

        ctx.font = '9px "JetBrains Mono", Consolas, monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";

        for (let x = 0; x <= width_m; x++) {
            const rx = toX(x);
            const isMajor5 = (x % 5 === 0);
            ctx.beginPath();
            ctx.moveTo(rx, RULER_TOP - (isMajor5 ? 10 : 6));
            ctx.lineTo(rx, RULER_TOP);
            ctx.strokeStyle = isMajor5 ? "#38bdf8" : "#64748b";
            ctx.lineWidth = isMajor5 ? 1.5 : 1;
            ctx.stroke();

            ctx.fillStyle = isMajor5 ? "#38bdf8" : "#94a3b8";
            ctx.fillText(x === 0 ? "0" : (x === width_m ? `${x}m` : `${x}`), rx, RULER_TOP - 11);
        }

        if (curM && curM.x >= 0 && curM.x <= width_m) {
            const pinX = toX(curM.x);
            ctx.fillStyle = "#0ea5e9";
            ctx.beginPath();
            ctx.moveTo(pinX - 4, RULER_TOP - 2);
            ctx.lineTo(pinX + 4, RULER_TOP - 2);
            ctx.lineTo(pinX, RULER_TOP + 4);
            ctx.closePath();
            ctx.fill();
        }

        // 11. LEFT METRIC RULER
        ctx.fillStyle = "#050912";
        ctx.fillRect(0, 0, RULER_LEFT, H);
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(RULER_LEFT, 0);
        ctx.lineTo(RULER_LEFT, H);
        ctx.stroke();

        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        for (let y = 0; y <= height_m; y++) {
            const ry = toY(y);
            const isMajor5 = (y % 5 === 0);
            ctx.beginPath();
            ctx.moveTo(RULER_LEFT - (isMajor5 ? 10 : 6), ry);
            ctx.lineTo(RULER_LEFT, ry);
            ctx.strokeStyle = isMajor5 ? "#38bdf8" : "#64748b";
            ctx.lineWidth = isMajor5 ? 1.5 : 1;
            ctx.stroke();

            ctx.fillStyle = isMajor5 ? "#38bdf8" : "#94a3b8";
            ctx.fillText(y === 0 ? "0" : (y === height_m ? `${y}m` : `${y}`), RULER_LEFT - 11, ry);
        }

        if (curM && curM.y >= 0 && curM.y <= height_m) {
            const pinY = toY(curM.y);
            ctx.fillStyle = "#0ea5e9";
            ctx.beginPath();
            ctx.moveTo(RULER_LEFT - 2, pinY - 4);
            ctx.lineTo(RULER_LEFT - 2, pinY + 4);
            ctx.lineTo(RULER_LEFT + 4, pinY);
            ctx.closePath();
            ctx.fill();
        }

        // 12. TOP-LEFT JUNCTION BADGE
        ctx.fillStyle = "#0b1424";
        ctx.fillRect(0, 0, RULER_LEFT, RULER_TOP);
        ctx.strokeStyle = "#0ea5e9";
        ctx.lineWidth = 1;
        ctx.strokeRect(1, 1, RULER_LEFT - 2, RULER_TOP - 2);

        ctx.fillStyle = "#38bdf8";
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(curUnit, RULER_LEFT / 2, RULER_TOP / 2);

        // 13. BOTTOM STATUS READOUT INSIDE CANVAS
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = "rgba(148, 163, 230, 0.7)";
        ctx.fillText(`FLOORPLAN ${state.planner.view25D ? '2.5D' : '2D'} (${state.planner.freq_ghz || 2.4} GHz • Mode: ${activeMode.toUpperCase()}) • ${width_m}m × ${height_m}m (${(width_m * height_m).toFixed(0)} m²)`, plotX + 8, H - 6);

        if (curM && curM.x >= 0 && curM.x <= width_m && curM.y >= 0 && curM.y <= height_m) {
            ctx.textAlign = "right";
            ctx.fillStyle = "#38bdf8";
            ctx.fillText(`X: ${curM.x.toFixed(2)}m  Y: ${curM.y.toFixed(2)}m (Snap: 0.25m)`, plotX + plotW - 8, H - 6);
        }
    }

    function getRssiColor(rssi) {
        if (rssi >= -48) return "rgba(16, 185, 129, 0.56)";     // Excellent Green
        if (rssi >= -58) return "rgba(52, 211, 153, 0.50)";     // Emerald
        if (rssi >= -65) return "rgba(234, 179, 8, 0.45)";      // Yellow (VoWiFi target)
        if (rssi >= -75) return "rgba(249, 115, 22, 0.40)";     // Orange
        if (rssi >= -85) return "rgba(239, 68, 68, 0.35)";      // Red
        return "rgba(15, 23, 42, 0.82)";                        // Dead zone dark
    }

    function getSnrColor(snr) {
        if (snr >= 35) return "rgba(16, 185, 129, 0.56)";       // Ultra SNR (QAM-1024/4096)
        if (snr >= 25) return "rgba(56, 189, 248, 0.50)";       // Voice/Enterprise SLA
        if (snr >= 18) return "rgba(234, 179, 8, 0.45)";        // Moderate Data
        if (snr >= 10) return "rgba(249, 115, 22, 0.40)";       // Marginal
        return "rgba(239, 68, 68, 0.38)";                       // Poor SNR
    }

    function getInterferenceColor(conflictCount) {
        if (conflictCount <= 0) return "rgba(16, 185, 129, 0.45)"; // Clean
        if (conflictCount === 1) return "rgba(234, 179, 8, 0.50)"; // Mild contention
        if (conflictCount === 2) return "rgba(249, 115, 22, 0.55)";// Moderate CCI
        return "rgba(239, 68, 68, 0.62)";                          // Severe CCI contention
    }

    function getThroughputColor(mbps) {
        if (mbps >= 600) return "rgba(16, 185, 129, 0.56)";     // Gigabit+
        if (mbps >= 250) return "rgba(56, 189, 248, 0.50)";     // High speed
        if (mbps >= 80)  return "rgba(234, 179, 8, 0.45)";      // Standard HD
        if (mbps >= 20)  return "rgba(249, 115, 22, 0.40)";     // Slow
        return "rgba(15, 23, 42, 0.80)";                        // Dead / Disconnected
    }

    window.addEventListener("resize", () => {
        drawSpectrumGraphs();
    });

    // Initialize Planner Canvas Interaction
    setupPlannerCanvasInteraction();
    window.loadFloorplanPreset("apartment");

    // Initialize Current Language
    setLanguage(state.currentLang);

    // Initial instant fetch to populate UI immediately on page load
    fetchScanData(false);

    // Start live WebSocket stream
    setupContinuousEngine();
});
