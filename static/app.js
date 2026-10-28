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
        theme: "light",
        currentLang: "vi",
        rationaleLang: "vi",
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
            slaCutoff: -65.0,
            view25D: false,
            unit: "m",
            walls: [],
            aps: [],
            roomLabels: [],
            heatmap: null,
            activeTool: "draw", // "room" | "draw" | "select" | "place_ap" | "calibrate" | "ruler" | "delete"
            dragStart: null,
            previewWall: null,
            previewRoom: null,
            rulerMeasure: null, // { x1, y1, x2, y2 }
            calibrationMeasure: null, // { px1, py1, px2, py2 }
            backgroundImage: null, // HTML Image element
            backgroundImageOpacity: 0.45,
            selectedWallIndex: -1,
            selectedApIndex: -1,
            hoveredWallIndex: -1,
            hoveredApIndex: -1,
            isComputing: false
        }
    };

        // Professional Vietnamese Dictionary (100% Clean Vietnamese, Zero Emojis, Zero Icons)
    const I18N = {
        vi: {
            brand_subtitle: "Phân tích phổ tần và quy hoạch vùng phủ sóng không dây",
            badge_stream_live: "ĐANG QUÉT TRỰC TIẾP",
            scan_opt_balanced: "Cân bằng (3 giây - khuyên dùng)",
            scan_opt_eco: "Tiết kiệm pin (5 giây)",
            scan_opt_fast: "Quét nhanh (1 giây)",
            scan_opt_pause: "Tạm dừng quét",
            btn_scan_now: "Quét ngay",
            btn_autopick: "Tính toán kênh tự động",
            btn_export_csv: "Xuất bảng tính",
            btn_device_finder: "Dò tìm vị trí trạm phát",
            stat_aps: "Số lượng trạm phát",
            stat_ssids: "Số tên mạng phát hiện",
            stat_health: "Điểm chất lượng môi trường",
            stat_best_24: "Kênh tối ưu 2.4 GHz",
            stat_best_5: "Kênh tối ưu 5 GHz",
            tab_survey: "Khảo sát sóng",
            tab_spectrum: "Phổ tần vô tuyến",
            tab_optimizer: "Tối ưu hóa và chẩn đoán",
            tab_vowifi: "Chất lượng cuộc gọi thoại",
            tab_planner: "Bản đồ nhiệt sóng",
            tab_security: "Kiểm tra an toàn bảo mật",
            tab_reports: "Lưu trữ báo cáo",
            search_placeholder: "Tìm kiếm theo tên mạng SSID, địa chỉ MAC BSSID hoặc hãng sản xuất...",
            filter_band: "Dải tần:",
            filter_all: "Tất cả dải tần",
            filter_security: "Chuẩn bảo mật:",
            filter_sec_all: "Tất cả chuẩn bảo mật",
            filter_sec_open: "Mạng không mật khẩu",
            filter_sec_ent: "Doanh nghiệp WPA Enterprise",
            view_list: "Danh sách trạm phát",
            view_cluster: "Nhóm theo thiết bị vật lý",
            th_ssid: "Tên mạng (SSID)",
            th_bssid: "Địa chỉ vật lý (MAC)",
            th_vendor: "Hãng sản xuất",
            th_signal: "Cường độ tín hiệu và SNR",
            th_channel: "Kênh phát",
            th_band: "Dải tần",
            th_gen: "Chuẩn Wi-Fi và điều chế MCS",
            th_security: "Chuẩn mã hóa bảo mật",
            th_load: "Độ chiếm dụng kênh",
            th_details: "Chi tiết",
            oscium_spec_title: "Phân loại nguồn can nhiễu và chiếm dụng phổ tần",
            oscium_spec_desc: "Tự động phân tích can nhiễu kênh kề, mật độ dải tần 2.4 GHz, kênh Radar thời tiết 5 GHz và tỷ lệ gửi lại gói tin.",
            oscium_spec_badge: "Giám sát tầng vật lý và liên kết",
            oscium_checklist_title: "Bảng kiểm tra và chẩn đoán sự cố toàn diện",
            oscium_checklist_desc: "Đánh giá tự động từ tầng vật lý, tỷ lệ gửi lại gói tin, khả năng chuyển vùng đến an toàn bảo mật.",
            oscium_checklist_badge: "Chẩn đoán tự động",
            spec_24_pill: "Dải tần 2.4 GHz ISM",
            spec_24_desc: "Kênh 1 đến 14 (3 kênh chuẩn không chồng lấn: 1, 6, 11)",
            spec_legend_active: "Trạm phát đang hoạt động",
            spec_legend_rec: "Kênh tối ưu đề xuất",
            spec_note_24: "Đang phân tích mức độ tranh chấp trùng kênh và can nhiễu kênh kề...",
            spec_5_pill: "Dải tần 5 GHz UNII",
            spec_5_desc: "Dải UNII-1 (Kênh 36-48), UNII-2 Radar DFS (52-144), UNII-3 (149-165)",
            spec_legend_block: "Khối gộp kênh sạch",
            spec_note_5: "Đang đánh giá phân bổ các khối kênh 20 MHz, 40 MHz và 80 MHz...",
            spec_time_pill: "Biến thiên cường độ sóng theo thời gian",
            spec_time_desc: "Lịch sử dao động mức tín hiệu RSSI (dBm) theo thời gian thực",
            spec_time_note: "Theo dõi độ ổn định sóng thu. Dao động lớn cho thấy có vật cản di chuyển hoặc phản xạ sóng.",
            spec_waterfall_pill: "Biểu đồ phổ năng lượng thác nước",
            spec_waterfall_desc: "Mật độ năng lượng sóng tích lũy trên các kênh theo dòng thời gian",
            spec_waterfall_note: "Giúp phát hiện ngay kênh tần số nào bị chiếm dụng liên tục thời gian thực.",
            matrix_24_title: "Bảng chấm điểm kênh 2.4 GHz",
            matrix_24_desc: "Điểm chất lượng kênh tính theo mức độ trùng kênh và lấn kênh kề.",
            matrix_5_title: "Băng tần 5 GHz và các khối gộp kênh 80 MHz",
            matrix_5_desc: "Đánh giá các khối kênh rộng và cảnh báo dải kênh radar thời tiết DFS.",
            blocks_80_title: "Các khối kênh 80 MHz tối ưu khuyên dùng",
            rationale_card_title: "Giải thích kỹ thuật và lý do chọn kênh",
            btn_calc_channel: "Tính toán kênh tự động",
            heading_diag_24: "Chẩn đoán kênh dải tần 2.4 GHz",
            heading_diag_5: "Chẩn đoán kênh dải tần 5 GHz và 6 GHz",
            heading_admin_rec: "Khuyến nghị cài đặt thực tế",
            airtime_card_title: "Phân tích chiếm dụng thời lượng phát sóng",
            airtime_card_desc: "Tỷ lệ thời lượng phát sóng bị chiếm bởi các khung quản lý và truyền dữ liệu.",
            roaming_card_title: "Kiểm tra chuyển vùng và thiết bị bám sóng yếu",
            roaming_card_desc: "Phát hiện mạng nhiều trạm phát có nguy cơ làm thiết bị bám vào trạm phát sóng yếu.",
            router_guide_title: "Hướng dẫn cấu hình thiết bị phát Wi-Fi",
            router_guide_badge: "Thực hành cấu hình",
            router_step1_title: "Bước 1: Đăng nhập giao diện quản trị router",
            router_step1_desc: "Mở trình duyệt truy cập <code>192.168.1.1</code> hoặc <code>192.168.0.1</code>. Tên đăng nhập và mật khẩu in ở mặt đáy thiết bị.",
            router_step2_title: "Bước 2: Cấu hình dải tần 2.4 GHz",
            router_step2_desc: "• <b>Độ rộng kênh:</b> Cố định <b>20 MHz</b> để tránh chồng lấn dải tần.<br>• <b>Kênh phát:</b> Chọn kênh khuyến nghị <b>1, 6 hoặc 11</b>.",
            router_step3_title: "Bước 3: Cấu hình dải tần 5 GHz và 6 GHz",
            router_step3_desc: "• <b>Độ rộng kênh:</b> Chọn <b>80 MHz</b> trên 5 GHz hoặc <b>160 MHz</b> trên 6 GHz.<br>• <b>Kênh phát:</b> Ưu tiên khối Kênh 36-48 hoặc 149-161 để tránh ngắt sóng do radar.",
            router_step4_title: "Bước 4: Tách tên Wi-Fi nếu cần thiết",
            router_step4_desc: "Nếu router đời cũ chuyển băng tần kém, hãy đặt 2 tên riêng biệt (ví dụ <code>WiFi_2.4G</code> và <code>WiFi_5G</code>) để kết nối sóng 5 GHz tốc độ cao khi ở gần.",
            vowifi_title: "Đo kiểm chất lượng thoại VoWiFi và đường truyền mạng",
            vowifi_desc: "Tính toán theo tiêu chuẩn viễn thông ITU-T G.107 E-model đánh giá độ trễ RTT, biến động trễ Jitter, tỷ lệ mất gói và phân tách đường truyền nội bộ so với Internet.",
            btn_run_vowifi: "Bắt đầu đo kiểm",
            stat_mos_score: "Điểm chất lượng thoại MOS",
            stat_rtt_latency: "Độ trễ khứ hồi RTT",
            stat_jitter: "Độ biến thiên trễ Jitter",
            stat_packet_loss: "Tỷ lệ mất gói",
            vowifi_rating_ready: "Trạng thái đường truyền: Sẵn sàng đo",
            vowifi_untested: "Chưa đo",
            vowifi_verdict_ready: "Bấm nút Bắt đầu đo kiểm để hệ thống gửi gói tin kiểm tra và tính toán điểm chất lượng thực tế.",
            vowifi_codecs_title: "Khả năng tương thích chuẩn mã hóa giọng nói",
            vowifi_codec_opus: "Tương thích cao",
            vowifi_codec_g711: "Chất lượng rõ ràng",
            vowifi_codec_g729: "Dự phòng băng thông thấp",
            vowifi_why_mos: "Tầm quan trọng của chỉ số MOS trong cuộc gọi thoại",
            vowifi_why_mos_desc: "Khi sóng Wi-Fi mạnh nhưng biến động trễ Jitter lớn hoặc có mất gói tin thì cuộc gọi thoại vẫn bị gián đoạn, rè tiếng hoặc trễ lời. Điểm MOS từ 4.0 trở lên đảm bảo đàm thoại ổn định.",
            planner_title: "Quy hoạch vị trí trạm phát và bản đồ nhiệt vùng phủ sóng",
            planner_desc: "Thiết kế mặt bằng trực quan kết hợp 5 chế độ bản đồ nhiệt chuyên sâu (Sóng chính, Sóng dự phòng chuyển vùng, Tỷ số SNR, Nhiễu tranh chấp kênh, Tốc độ ước tính) trên các dải tần 2.4 GHz, 5 GHz và 6 GHz.",
            preset_apartment: "Căn hộ 70m² (2 phòng ngủ)",
            preset_townhouse: "Nhà phố dài 120m²",
            preset_office: "Văn phòng mở 250m²",
            preset_custom: "Mặt bằng trống (tự vẽ mới)",
            sla_voice: "Tiêu chuẩn thoại VoWiFi (-65 dBm / SNR 25 dB)",
            sla_office: "Tiêu chuẩn văn phòng (-67 dBm / SNR 20 dB)",
            sla_hd: "Tiêu chuẩn hội trường mật độ cao (-60 dBm / SNR 28 dB)",
            btn_import_aps: "Nạp trạm phát thực tế",
            label_heatmap_mode: "Chế độ bản đồ nhiệt:",
            hm_mode_primary: "1. Mức tín hiệu chính (dBm)",
            hm_mode_secondary: "2. Tín hiệu dự phòng chuyển vùng (dBm)",
            hm_mode_snr: "3. Tỷ số tín hiệu trên nhiễu SNR (dB)",
            hm_mode_interference: "4. Mức độ tranh chấp kênh",
            hm_mode_throughput: "5. Tốc độ truyền dữ liệu ước tính (Mbps)",
            kpi_pri_cov: "Độ phủ sóng chính",
            kpi_sec_roam: "Dự phòng chuyển vùng",
            kpi_avg_snr: "Tỷ số tín hiệu trên nhiễu",
            kpi_tp_cap: "Tốc độ và sức chứa trạm phát",
            kpi_conflict_dead: "Tranh chấp kênh và điểm mất sóng",
            label_dimensions: "Kích thước mặt bằng:",
            btn_apply_dim: "Thiết lập",
            label_wall_material: "Vật liệu vách ngăn:",
            mat_brick: "Tường gạch (-6 dB)",
            mat_concrete: "Bê tông cốt thép (-12 dB)",
            mat_glass: "Cửa kính hoặc vách kính (-3 dB)",
            mat_wood: "Vách gỗ hoặc thạch cao (-4 dB)",
            mat_door: "Cửa ra vào mỏng (-2 dB)",
            mat_metal: "Tủ kim loại hoặc thang máy (-15 dB)",
            label_sim_band: "Dải tần mô phỏng:",
            band_opt_24: "Dải tần 2.4 GHz (xuyên tường tốt)",
            band_opt_5: "Dải tần 5.0 GHz (80 MHz tốc độ cao)",
            band_opt_6: "Dải tần 6.0 GHz (160 MHz tốc độ tối đa)",
            label_toggle_25d: "Hiển thị không gian 2.5D",
            tool_room: "Vẽ khung phòng",
            tool_draw: "Vẽ tường đơn",
            tool_select: "Chọn và chỉnh sửa",
            tool_place_ap: "Đặt trạm phát",
            tool_ruler: "Thước đo khoảng cách",
            tool_delete: "Xóa vật thể",
            btn_undo_wall: "Hoàn tác",
            btn_clear_all: "Xóa toàn bộ",
            label_signal_level: "Mức sóng:",
            legend_strong: "Rất mạnh (-30 dBm)",
            legend_good: "Tốt (-65 dBm)",
            legend_weak: "Yếu hoặc mất sóng (-90 dBm)",
            inspector_label_mat: "Thay đổi vật liệu:",
            inspector_label_len: "Chiều dài:",
            unit_opt_m: "Mét (m)",
            unit_opt_in: "Inch (in)",
            unit_opt_ft: "Feet (ft)",
            unit_opt_cm: "Centimet (cm)",
            btn_apply_len: "Áp dụng",
            btn_del_wall: "Xóa vách ngăn",
            obj_th_type: "Loại vách ngăn",
            obj_th_coords: "Tọa độ (m)",
            obj_th_len: "Chiều dài",
            obj_th_loss: "Độ suy hao",
            obj_th_action: "Thao tác",
            btn_complete_planner: "Tự động đặt trạm và tính phủ sóng",
            btn_complete_planner_bottom: "Tự động tối ưu vị trí trạm và tính phủ sóng",
            btn_recalc_heatmap: "Tính toán lại vùng phủ sóng",
            planner_results_heading: "Kết quả đánh giá độ phủ sóng",
            planner_placeholder: "Vẽ mặt bằng kiến trúc và bấm nút Tự động đặt trạm và tính phủ sóng để hiển thị kết quả phân tích.",
            df_modal_title: "Bộ dò hướng và định vị trạm phát sóng",
            df_select_target: "Chọn trạm phát BSSID cần dò tìm vị trí vật lý:",
            df_reset_peak: "Đặt lại đỉnh sóng",
            df_peak_rssi: "Mức tín hiệu mạnh nhất ghi nhận",
            df_min_rssi: "Mức tín hiệu thấp nhất",
            df_est_dist: "Khoảng cách ước tính",
            sec_open_title: "Cảnh báo: Phát hiện mạng Wi-Fi không đặt mật khẩu",
            sec_open_desc: "Đang kiểm tra các trạm phát sóng Wi-Fi không kích hoạt mật khẩu bảo vệ...",
            sec_dist_title: "Phân bố các chuẩn bảo mật trong khu vực",
            sec_diag_title: "Phân tích nguy cơ bảo mật yếu và giải pháp khắc phục",
            sec_diag_badge: "Kiểm tra an toàn bảo mật",
            sec_cause_title: "1. Nguyên nhân kỹ thuật dẫn đến đánh giá bảo mật yếu",
            sec_cause_desc_1: "<b>Nguyên nhân kỹ thuật:</b> Mạng không mật khẩu (Open) hoặc sử dụng chuẩn cũ WEP / WPA-TKIP không mã hóa dữ liệu truyền tải.",
            sec_cause_desc_2: "Sóng vô tuyến truyền lan trong không gian. Thiết bị bất kỳ trong vùng phủ sóng đều có thể thu thập các gói tin chưa mã hóa.",
            sec_danger_title: "2. Rủi ro thực tế đối với an toàn dữ liệu",
            sec_danger_item1: "<b>Thu thập gói tin mạng:</b> Kẻ xấu có thể bắt và đọc dữ liệu chưa mã hóa truyền trong mạng.",
            sec_danger_item2: "<b>Trạm phát giả mạo:</b> Dễ dàng tạo tên mạng trùng lặp nhằm đánh lừa người dùng kết nối.",
            sec_danger_item3: "<b>Truy cập trái phép thiết bị nội bộ:</b> Người ngoài có thể quét thấy máy in, camera và thiết bị chia sẻ trong mạng LAN.",
            sec_fix_title: "3. Quy trình các bước khắc phục cụ thể",
            sec_fix_item1: "<b>Kích hoạt chuẩn mã hóa an toàn:</b> Đăng nhập router chuyển chế độ bảo mật sang <b>WPA2-PSK (AES)</b> hoặc <b>WPA3-SAE</b>.",
            sec_fix_item2: "<b>Thiết lập mật khẩu độ dài phù hợp:</b> Sử dụng mật khẩu từ 12 ký tự trở lên kết hợp chữ hoa, chữ thường và chữ số.",
            sec_fix_item3: "<b>Bật chế độ cách ly máy khách:</b> Đối với mạng khách, bật tính năng cách ly máy khách để tránh các thiết bị quét lẫn nhau.",
            sec_fix_item4: "<b>Vô hiệu hóa tính năng WPS:</b> Tắt xác thực PIN WPS trên router nhằm ngăn chặn dò quét tự động.",
            reports_title: "Lưu trữ báo cáo khảo sát hệ thống",
            reports_desc: "Các tệp báo cáo khảo sát được lưu trữ định dạng bảng tính mở trực tiếp bằng Microsoft Excel.",
            btn_export_csv_modal: "Xuất tệp bảng tính CSV",
            btn_export_json_modal: "Xuất tệp dữ liệu JSON",
            btn_clear_reports: "Xóa báo cáo cũ",
            rep_format: "Định dạng",
            rep_filename: "Tên tệp báo cáo",
            rep_created: "Thời điểm tạo",
            rep_size: "Dung lượng",
            rep_action: "Thao tác",
            modal_export_title: "Xuất báo cáo khảo sát mạng",
            modal_export_desc: "Lựa chọn định dạng tệp báo cáo cần tải về máy tính.",
            format_csv_name: "Bảng tính CSV (.csv) - Mở bằng Microsoft Excel",
            format_csv_desc: "Chứa gợi ý kênh tối ưu, chỉ số SNR, điều chế MCS, an toàn bảo mật và danh sách trạm phát.",
            format_json_name: "Tệp dữ liệu JSON (.json)",
            format_json_desc: "Toàn bộ cấu trúc dữ liệu đo kiểm kỹ thuật phục vụ lưu trữ hoặc tích hợp.",
            export_generating: "Đang khởi tạo tệp báo cáo...",
            btn_cancel: "Hủy bỏ",
            btn_download_report: "Tải báo cáo"
        }
    };
    I18N.en = I18N.vi;

    function setLanguage(lang) {
        state.currentLang = "vi";
        state.rationaleLang = "vi";
        localStorage.setItem("netscanner_lang", "vi");
        document.documentElement.setAttribute("lang", "vi");

        const langLabel = document.getElementById("lang-current-label");
        if (langLabel) langLabel.textContent = "VI";

        const translateLabel = document.getElementById("translate-rationale-label");
        if (translateLabel) {
            translateLabel.textContent = "Dịch chẩn đoán";
        }

        const dict = I18N.vi;

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

    // Helper for safe Lucide icons creation (No-op in pure Light Mode)
    function safeCreateIcons() {}
    function updateThemeIcon() {}

    // Apply Initial Theme (Fixed Light Mode)
    document.documentElement.setAttribute("data-theme", "light");
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
    const networkSearch = document.getElementById("search-input") || document.getElementById("network-search");
    const filterSecurity = document.getElementById("filter-security");
    const surveyTableBody = document.getElementById("survey-tbody") || document.getElementById("survey-table-body");
    const apDrawer = document.getElementById("ap-drawer");
    const btnCloseDrawer = document.getElementById("btn-close-drawer") || document.getElementById("btnCloseDrawer");
    const reportModal = document.getElementById("report-modal");

    // Canvases
    const canvas24 = document.getElementById("canvas-spectrum-24");
    const canvas5 = document.getElementById("canvas-spectrum-50") || document.getElementById("canvas-spectrum-5");
    const canvasSignal = document.getElementById("canvas-signal-history");
    const canvasWaterfall = document.getElementById("canvas-waterfall") || document.getElementById("canvas-spectrum-waterfall");

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
            } else if (tabId === "tab-speedtest") {
                window.renderSpeedTestHistoryTable();
            } else if (tabId === "tab-optimizer") {
                window.refreshOsciumDiagnostics();
            } else if (tabId === "tab-planner") {
                if (window.refreshInvasionoHeatmap) window.refreshInvasionoHeatmap();
            }
        });
    });

    // Theme Toggle (Safely guarded)
    if (btnThemeToggle) {
        btnThemeToggle.addEventListener("click", () => {
            state.theme = "light";
            document.documentElement.setAttribute("data-theme", "light");
            updateThemeIcon();
            drawSpectrumGraphs();
        });
    }

    // Global Language Toggle (Fixed Vietnamese)
    if (btnLangToggle) {
        btnLangToggle.addEventListener("click", () => {
            setLanguage("vi");
        });
    }

    // Inline Technical Rationale Translator (Tab 3)
    if (btnTranslateRationale) {
        btnTranslateRationale.addEventListener("click", () => {
            state.rationaleLang = "vi";
            if (state.analysis) {
                updateRationaleDisplay(state.analysis.evaluation_24ghz, state.analysis.evaluation_5ghz);
            }
            safeCreateIcons();
        });
    }

    function updateThemeIcon() {
        const icon = document.getElementById("theme-icon");
        if (icon) {
            // Theme toggle removed
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
        } else if (state.currentTab === "tab-speedtest") {
            window.renderSpeedTestHistoryTable();
        } else if (state.currentTab === "tab-spectrum") {
            drawSpectrumGraphs();
        } else if (state.currentTab === "tab-optimizer") {
            renderOptimizerChannels();
            window.refreshOsciumDiagnostics();
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
    if (networkSearch) {
        networkSearch.addEventListener("input", (e) => {
            state.searchQuery = e.target.value.toLowerCase().trim();
            renderSurveyTable();
        });
    }

    document.querySelectorAll(".filter-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            const bandVal = pill.getAttribute("data-band") || pill.getAttribute("data-filter-band");
            if (bandVal) {
                document.querySelectorAll("#filter-chips .filter-pill").forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                state.filterBand = bandVal;
                renderSurveyTable();
                return;
            }
            const secVal = pill.getAttribute("data-sec");
            if (secVal) {
                document.querySelectorAll("#sec-chips .filter-pill").forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                state.filterSecurity = secVal;
                renderSurveyTable();
                return;
            }
        });
    });

    document.querySelectorAll(".chip-filter").forEach(chip => {
        chip.addEventListener("click", () => {
            const quick = chip.getAttribute("data-filter") || chip.getAttribute("data-quick-filter") || "all";
            if (chip.classList.contains("active") && state.filterQuick === quick) {
                chip.classList.remove("active");
                state.filterQuick = "all";
            } else {
                document.querySelectorAll(".chip-filter").forEach(c => c.classList.remove("active"));
                chip.classList.add("active");
                state.filterQuick = quick;
            }
            renderSurveyTable();
        });
    });

    if (filterSecurity) {
        filterSecurity.addEventListener("change", (e) => {
            state.filterSecurity = e.target.value;
            renderSurveyTable();
        });
    }

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
    if (btnScan) {
        btnScan.addEventListener("click", () => {
            fetchScanData(true);
        });
    }

    // Auto-Pick Actions
    if (btnQuickAutoPick) btnQuickAutoPick.addEventListener("click", () => {
        switchToTab("tab-optimizer");
        triggerAutoPick();
    });

    if (btnTriggerAutoPick) {
        btnTriggerAutoPick.addEventListener("click", () => {
            triggerAutoPick();
        });
    }

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
    if (btnCloseDrawer) {
        btnCloseDrawer.addEventListener("click", () => {
            if (apDrawer) apDrawer.classList.add("hidden");
        });
    }

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
                    roamNotice = ` • <span style="color:#10b981; font-weight:700;" title="Router nhà bạn có phát cả sóng 5GHz siêu tốc! Hãy kết nối sóng 5G để tăng tốc gấp 3 lần!">Mẹo: Chuyển sang sóng 5GHz (${alt5g.signal_dbm} dBm)</span>`;
                }
            }
            document.getElementById("conn-rates").innerHTML = (conn.tx_rate ? `${conn.tx_rate} Mbps` : (conn.radio_type || '')) + roamNotice;
        } else {
            connCard.classList.add("hidden");
        }
    }

    // Render Survey Table with Filters and Sorting
    function renderSurveyTable() {
        const tbody = document.getElementById("survey-tbody") || document.getElementById("survey-table-body");
        if (!tbody) return;
        if (!state.networks || state.networks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" class="loading-row">Không tìm thấy sóng Wi-Fi xung quanh. Đang quét...</td></tr>`;
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
            tbody.innerHTML = `<tr><td colspan="11" class="loading-row">Không có mạng Wi-Fi nào khớp với bộ lọc tìm kiếm.</td></tr>`;
            return;
        }

        const isVi = state.currentLang === "vi";
        tbody.innerHTML = filtered.map(net => {
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
            const connIcon = net.is_connected ? `<span class="conn-indicator" style="font-size:0.75rem; color:#059669; font-weight:700;">Đang kết nối</span> ` : ``;

            const bssLoadDisplay = net.channel_utilization_pct !== null ? `${net.channel_utilization_pct}%` : `N/A`;
            const clientsDisplay = net.connected_stations > 0 ? (isVi ? `(${net.connected_stations} máy)` : `(${net.connected_stations} stas)`) : ``;

            let ssidHtml = escapeHtml(net.ssid || "[Hidden Network]");
            if (net.is_hidden && net.is_decloaked && net.decloaked_ssid) {
                ssidHtml = `
                    <div class="decloaked-wrapper">
                        <span class="decloaked-badge" title="${isVi ? 'Giải mã thành công nhờ phân tích phần cứng BSSID! Độ tin cậy: ' : 'De-cloaked via BSSID Topology! Confidence: '}${net.decloak_confidence}%">
                            ${isVi ? 'ĐÃ GIẢI MÃ' : 'UNCLOAKED'}
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
                threatBadge = ` <span class="badge badge-threat-crit" title="${escapeHtml(net.threat_description || '')}">${isVi ? 'GIẢ MẠO AP' : 'EVIL TWIN'}</span>`;
            } else if (net.threat_level === "WARNING") {
                threatBadge = ` <span class="badge badge-threat-warn" title="${escapeHtml(net.threat_description || '')}">${isVi ? 'CẢNH BÁO' : 'WARNING'}</span>`;
            }

            let roamBadge = "";
            if (net.roaming_status === "STICKY_CLIENT") {
                roamBadge = ` <span class="badge" style="background:#f59e0b; color:#111; font-weight:700;" title="${escapeHtml(net.roaming_note || '')}">${isVi ? 'CẦN ROAMING' : 'STICKY CLIENT'}</span>`;
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
                        ${(net.cluster_size && net.cluster_size > 1) ? `<span class="badge badge-cluster" title="${isVi ? 'Cùng thiết bị phần cứng đa băng tần' : 'Same physical multi-band hardware'}">Cụm ${net.cluster_size} BSSID</span>` : ''}
                        ${isOpenSec ? `<span class="badge" style="background:#ef4444; color:#fff; font-size:0.65rem;" title="${isVi ? 'Mạng không mã hóa! Nguy cơ lộ thông tin' : 'Unencrypted network! High sniffing risk'}">${isVi ? 'KHÔNG BẢO MẬT' : 'UNSECURED'}</span>` : ''}
                    </td>
                    <td class="mac-cell">${net.bssid}</td>
                    <td>${escapeHtml(net.vendor || (isVi ? 'Không rõ' : 'Unknown'))}</td>
                    <td>
                        <div class="signal-meter-wrapper">
                            <div class="signal-bar-bg">
                                <div class="signal-bar-fill ${sigClass}" style="width: ${sig}%;"></div>
                            </div>
                            <span><b>${dbm}</b> dBm (${sig}%) &bull; <b style="color:#0284c7;">SNR ${snr} dB</b> <small style="display:block; font-size:0.72rem; color:var(--text-secondary);">NF: ${nf} dBm | ${sigLabel}</small></span>
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
                            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); window.openDeviceFinder('${net.bssid}')" title="${isVi ? 'Dò hướng tín hiệu vật lý của trạm phát này' : 'Track directional signal for this AP'}" style="border-color:#0284c7; color:#0284c7;">
                                Dò tìm
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
        const tableContainer = document.getElementById("view-list-container") || document.getElementById("table-container-view");
        const clusterContainer = document.getElementById("view-cluster-container") || document.getElementById("cluster-container");

        if (view === "cluster") {
            if (btnList) btnList.classList.remove("active");
            if (btnCluster) btnCluster.classList.add("active");
            if (tableContainer) tableContainer.classList.add("hidden");
            if (clusterContainer) {
                clusterContainer.classList.remove("hidden");
                renderClusterView();
            }
        } else {
            if (btnCluster) btnCluster.classList.remove("active");
            if (btnList) btnList.classList.add("active");
            if (clusterContainer) clusterContainer.classList.add("hidden");
            if (tableContainer) {
                tableContainer.classList.remove("hidden");
                renderSurveyTable();
            }
        }
        safeCreateIcons();
    };

    const btnViewList = document.getElementById("btn-view-list");
    if (btnViewList) btnViewList.addEventListener("click", () => window.switchSurveyView("list"));
    const btnViewCluster = document.getElementById("btn-view-cluster");
    if (btnViewCluster) btnViewCluster.addEventListener("click", () => window.switchSurveyView("cluster"));

    // Update RF Security Banner
    function updateThreatBanner() {
        const badge = document.getElementById("survey-threat-indicator");
        if (!badge) return;

        const isVi = state.currentLang === "vi";
        const threats = state.threats;
        if (!threats || threats.status === "SECURE" || threats.total_threats === 0) {
            badge.style.color = "#059669";
            badge.style.background = "rgba(5, 150, 105, 0.08)";
            badge.style.borderColor = "rgba(5, 150, 105, 0.2)";
            badge.innerHTML = `<span>${isVi ? 'An Ninh Sóng: An Toàn (Không có trạm giả mạo)' : 'RF Security: Clean'}</span>`;
        } else if (threats.status === "DANGER" || threats.critical_count > 0) {
            badge.style.color = "#dc2626";
            badge.style.background = "rgba(220, 38, 38, 0.10)";
            badge.style.borderColor = "rgba(220, 38, 38, 0.3)";
            badge.innerHTML = `<span>${isVi ? `CẢNH BÁO: Phát hiện ${threats.critical_count} trạm phát giả mạo!` : `CRITICAL: ${threats.critical_count} Rogue AP Detected!`}</span>`;
        } else {
            badge.style.color = "#d97706";
            badge.style.background = "rgba(217, 119, 6, 0.10)";
            badge.style.borderColor = "rgba(217, 119, 6, 0.25)";
            badge.innerHTML = `<span>${isVi ? `Lưu ý: Có ${threats.warning_count} trạm phát cần chú ý` : `Notice: ${threats.warning_count} anomaly APs`}</span>`;
        }
        safeCreateIcons();
    }

    // Render Hardware Topology & Mesh Clusters View
    function renderClusterView() {
        const container = document.getElementById("clusters-grid") || document.getElementById("view-cluster-container") || document.getElementById("cluster-container");
        if (!container) return;
        const banner = document.getElementById("cluster-summary-banner");
        if (banner) {
            banner.textContent = `Tổng cộng phát hiện ${(state.clusters || []).length} cụm thiết bị vật lý (${(state.networks || []).length} trạm phát BSSID).`;
        }

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
                    nameDisplay = `<span class="decloaked-badge">${isVi ? 'ĐÃ GIẢI MÃ' : 'UNCLOAKED'}</span> <b style="color:#0284c7;">${escapeHtml(m.decloaked_ssid)}</b> <span style="font-size:0.75rem; color:var(--text-secondary); font-style:italic;">(${escapeHtml(m.decloak_role || '')})</span>`;
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
                                Dò tìm
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
                                <span>AP</span>
                            </div>
                            <div>
                                <div class="cluster-title">${escapeHtml(c.parent_ssid || 'Access Point')}</div>
                                <div class="cluster-vendor">${escapeHtml(c.vendor || 'Generic IEEE 802.11')} &bull; BSSID Gốc: <code>${c.parent_bssid}</code></div>
                            </div>
                        </div>
                        <div class="cluster-badges">
                            ${hasDecloaked ? `<span class="badge" style="background:#059669; color:#fff; font-size:0.75rem;">${isVi ? 'CHỨA MẠNG MESH ẨN ĐÃ GIẢI MÃ' : 'UNCLOAKED MESH LINK'}</span>` : ''}
                            <span class="badge badge-cluster">${bssCount} BSSIDs</span>
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
                    ${isVi ? 'Dò Hướng & Định Vị Vật Lý Trạm Phát Này (Device Finder)' : 'Track Directional Signal for This AP (Device Finder)'}
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
                    <b>${net.signal_dbm} dBm</b> (${net.signal_percent}%) &bull; <b style="color:#0284c7;">SNR: ${snr} dB</b>
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
                    ${isOpen ? `<div style="margin-top:6px; color:#ef4444; font-size:0.8rem; line-height:1.4;">${isVi ? '<b>Cảnh báo an ninh:</b> Sóng truyền dữ liệu không mã hóa! Bất kỳ ai cũng có thể bắt gói tin hoặc giả mạo trạm phát sóng. Nên vào Router bật WPA2-PSK (AES) hoặc WPA3-SAE ngay.' : '<b>Security Alert:</b> Unencrypted transmission! Anyone within range can capture packets or deploy a rogue AP. Enable WPA2-PSK (AES) or WPA3-SAE immediately.'}</div>` : ''}
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
                    ${isVi ? 'ĐÁNH GIÁ CHUYỂN VÙNG (MULTI-AP ROAMING)' : 'MULTI-AP ROAMING AUDIT'}
                </div>
                <div class="drawer-field-val" style="font-size: 0.8rem; line-height: 1.4; color: var(--text-primary); margin-top: 4px;">
                    ${escapeHtml(net.roaming_note)}
                </div>
            </div>
            ` : ''}
            ${net.is_hidden ? `
            <div class="drawer-field" style="background: rgba(16, 185, 129, 0.08); border-left: 3px solid #10b981; padding: 10px; border-radius: 4px; margin-top: 10px;">
                <div class="drawer-field-label" style="color: #10b981; font-weight: 700;">
                    ${isVi ? 'THÔNG TIN GIẢI MÃ MẠNG ẨN (BSSID CLUSTERING)' : 'HIDDEN SSID DE-CLOAKING DETAILS'}
                </div>
                <div class="drawer-field-val" style="font-size: 0.82rem; line-height: 1.5; margin-top: 5px;">
                    <div>• <b>${isVi ? 'Tên giải mã' : 'De-cloaked Name'}:</b> <span style="color:#38bdf8; font-weight:600;">${escapeHtml(net.decloaked_ssid || net.ssid)}</span></div>
                    <div>• <b>${isVi ? 'Thiết bị gốc' : 'Parent Hardware'}:</b> ${escapeHtml(net.parent_ssid || 'N/A')} (${net.parent_bssid || 'N/A'})</div>
                    <div>• <b>${isVi ? 'Bản chất mạng' : 'Inferred Role'}:</b> ${escapeHtml(net.decloak_role || (isVi ? 'Mạng ngầm nội bộ' : 'Internal Backhaul'))}</div>
                    <div>• <b>${isVi ? 'Độ tin cậy' : 'Confidence'}:</b> ${net.decloak_confidence}%</div>
                    <div style="margin-top:6px; font-size:0.75rem; color:var(--text-secondary);">
                        ${isVi ? '<b>Nguyên lý:</b> Bộ phát Wi-Fi Mesh hoặc bộ phát đa băng tần thường tạo thêm địa chỉ BSSID ẩn trên cùng phần cứng để truyền dữ liệu nội bộ (Backhaul). Hệ thống đối chiếu dải địa chỉ MAC và mức sóng thu để tìm ra bộ phát gốc.' : '<b>Mechanism:</b> Mesh and dual-band routers generate unadvertised virtual BSSIDs on identical hardware for backhaul links. BSSID clustering correlates MAC offsets and RSSI to identify the parent AP.'}
                    </div>
                </div>
            </div>
            ` : ''}
            ${net.is_dfs ? `
            <div class="drawer-field" style="background: rgba(99, 102, 241, 0.08); border-left: 3px solid #6366f1; padding: 10px; border-radius: 4px; margin-top: 10px;">
                <div class="drawer-field-label" style="color: #818cf8; font-weight: 700;">
                    ${isVi ? 'THÔNG TIN KÊNH RADAR DFS (UNII-2)' : 'DFS RADAR CHANNEL METRICS'}
                </div>
                <div class="drawer-field-val" style="font-size: 0.78rem; line-height: 1.5; color: var(--text-secondary); margin-top: 4px;">
                    ${isVi ? `Kênh ${net.channel} nằm trong dải tần chia sẻ với hệ thống Radar thời tiết và quân sự. Theo chuẩn IEEE 802.11h, nếu bộ phát phát hiện tín hiệu radar, nó bắt buộc phải tự động chuyển kênh trong vòng 60 giây.` : `Channel ${net.channel} resides in the UNII-2 DFS radar spectrum. In compliance with 802.11h, the AP must vacate this frequency upon detecting radar pulses.`}
                </div>
            </div>
            ` : ''}
            ${net.threat_description ? `
            <div class="drawer-field" style="background: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; padding: 10px; border-radius: 4px; margin-top: 10px;">
                <div class="drawer-field-label" style="color: #ef4444; font-weight: 700;">
                    ${isVi ? 'CẢNH BÁO AN NINH SÓNG' : 'RF SECURITY ALERT'}
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
                        ${remed ? `<div style="margin-top: 6px; font-size: 0.76rem; color: #0284c7; font-weight: 600;">Khắc phục: ${escapeHtml(remed)}</div>` : ''}
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
                            ${escapeHtml(isVi ? nw.remediation_vi : (nw.remediation_en || nw.remediation_vi))}
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
                ? `<div style="color:#059669; font-size:0.8rem;">${isVi ? 'Không có mạng đa AP nào gặp lỗi bám sóng yếu (Sticky Client).' : 'No multi-AP roaming sticky client anomalies detected.'}</div>`
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
            btnTriggerAutoPick.innerHTML = `<span>${isVi ? 'Tính Kênh Tự Động' : 'Run Auto-Pick'}</span>`;
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
                    ${action ? `<div style="margin-top: 6px; font-size: 0.76rem; color: #0284c7; font-weight: 600;">Khắc phục: ${escapeHtml(action)}</div>` : ''}
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

            if (btn) btn.innerHTML = `<span>${state.currentLang === 'vi' ? 'Đã tải!' : 'Downloaded!'}</span>`;
            if (state.currentTab === "tab-reports") fetchReportsArchive();
        } catch (err) {
            alert((state.currentLang === 'vi' ? "Lỗi xuất báo cáo: " : "Export error: ") + err.message);
            if (btn) btn.innerHTML = origHtml;
        } finally {
            setTimeout(() => {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = `<span>${state.currentLang === 'vi' ? 'Xuất bảng tính' : 'Export CSV'}</span>`;
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

    if (btnCloseReportModal) {
        btnCloseReportModal.addEventListener("click", () => {
            if (reportModal) reportModal.classList.add("hidden");
        });
    }

    if (btnCancelExport) {
        btnCancelExport.addEventListener("click", () => {
            if (reportModal) reportModal.classList.add("hidden");
        });
    }

    document.querySelectorAll(".format-card").forEach(card => {
        card.addEventListener("click", () => {
            document.querySelectorAll(".format-card").forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");
            const radio = card.querySelector("input[type='radio']");
            if (radio) radio.checked = true;
        });
    });

    if (btnConfirmExport) {
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
    }

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
                                    ${isVi ? 'Tải về' : 'Download'}
                                </a>
                                <button class="btn btn-sm btn-danger" onclick="window.deleteSingleReport('${escapeHtml(r.filename)}')" style="background:#dc2626; color:#fff;" title="${isVi ? 'Xóa file báo cáo này' : 'Delete this report file'}">
                                    ${isVi ? 'Xóa' : 'Delete'}
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
                btn.innerHTML = `${isVi ? 'Đo Chất Lượng Ngay' : 'Run Quality Test'}`;
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
            slaEl.textContent = passed ? (isVi ? "ĐẠT CHUẨN SLA" : "SLA PASS") : (isVi ? "CHƯA ĐẠT SLA" : "SLA WARNING");
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
                ? `${count} vách ngăn • ${apCount} trạm phát`
                : `${count} walls • ${apCount} APs`;
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
                <td style="padding:5px 8px; font-weight:700; color:#0284c7;">Trạm AP-${apIdx + 1}</td>
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
                                <span class="badge" style="background:#f1f5f9; border:1px solid #0284c7; color:#0f172a; padding:6px 10px; font-size:0.82rem;">
                                    <b>${escapeHtml(a.name || "AP")}</b> (x=${a.x}m, y=${a.y}m) • 2.4G: <b>Kênh ${a.channel_24 || 1}</b> • 5G: <b>Ch ${a.channel_5 || 36}</b> • 6G: <b>Ch ${a.channel_6 || 37}</b> (${escapeHtml(a.role || "Router")})
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
        state.planner.calibrationMeasure = null;
        const toolButtons = {
            room: document.getElementById("btn-tool-room"),
            draw: document.getElementById("btn-tool-draw"),
            select: document.getElementById("btn-tool-select"),
            place_ap: document.getElementById("btn-tool-place-ap"),
            calibrate: document.getElementById("btn-tool-calibrate"),
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
                hintText.textContent = "Hướng dẫn: Đang ở chế độ Vẽ khung phòng. Nhấp chuột và kéo tạo hình chữ nhật để dựng nhanh 4 bức tường khép kín kèm diện tích m².";
            }
        } else if (tool === "draw") {
            if (canvas) canvas.style.cursor = "crosshair";
            if (hintText) {
                hintText.textContent = "Hướng dẫn: Đang ở chế độ Vẽ tường đơn. Nhấp chuột và kéo trên bản đồ để tạo vách ngăn (giữ Shift để khóa phương thẳng).";
            }
        } else if (tool === "select") {
            if (canvas) canvas.style.cursor = "pointer";
            if (hintText) {
                hintText.textContent = "Hướng dẫn: Đang ở chế độ Chọn & Di chuyển. Nhấp vào bức tường hoặc bộ phát AP bất kỳ để kéo di chuyển vị trí, hoặc chỉnh sửa thuộc tính.";
            }
        } else if (tool === "place_ap") {
            if (canvas) canvas.style.cursor = "copy";
            if (hintText) {
                hintText.textContent = "Hướng dẫn: Đang ở chế độ Đặt thêm AP. Nhấp vào vị trí bất kỳ trên mặt bằng để đặt bộ phát Wi-Fi và cập nhật vùng phủ sóng.";
            }
        } else if (tool === "calibrate") {
            if (canvas) canvas.style.cursor = "crosshair";
            if (hintText) {
                hintText.textContent = "Hướng dẫn: Đang ở chế độ Hiệu chuẩn thước đo. Kéo một đoạn mốc đã biết độ dài trên bản vẽ để quy đổi tỷ lệ sang mét thực tế.";
            }
        } else if (tool === "ruler") {
            if (canvas) canvas.style.cursor = "crosshair";
            if (hintText) {
                hintText.textContent = "Hướng dẫn: Đang ở chế độ Thước đo suy hao. Nhấp và kéo từ điểm A đến điểm B để đo khoảng cách thực, số vách ngăn xuyên qua và tổng mức suy hao (dB).";
            }
        } else {
            if (canvas) canvas.style.cursor = "pointer";
            if (hintText) {
                hintText.textContent = "Hướng dẫn: Đang ở chế độ Xóa. Nhấp vào bức tường hoặc bộ phát AP trên bản đồ để xóa bỏ.";
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
                    ? `<div class="spinner mini" style="display:inline-block; margin-right:8px;"></div> ${isVi ? 'Đang tính toán vị trí bộ phát và tạo bản đồ nhiệt...' : 'Calculating optimal AP placement...'}`
                    : (isVi ? 'Tự Động Bố Trí AP & Tính Độ Phủ Sóng' : 'Auto-Place APs & Compute Coverage');
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
                            <span class="badge" style="background:#f1f5f9; border:1px solid #0284c7; color:#0f172a; padding:6px 10px; font-size:0.82rem;">
                                <b>${a.name}</b> (x=${a.x}m, y=${a.y}m) • 2.4G: <b>Kênh ${a.channel_24}</b> • 5G: <b>Ch ${a.channel_5}</b> • 6G: <b>Ch ${a.channel_6 || 37}</b> (${a.role})
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

    // =========================================================================
    // AP PROPERTY INSPECTOR CONTROLLERS (R3 EKAHAU BENCHMARK)
    // =========================================================================

    window.openApInspector = function(apIndex) {
        if (apIndex < 0 || apIndex >= state.planner.aps.length) {
            window.closeApInspector();
            return;
        }
        window.deselectWall();
        state.planner.selectedApIndex = apIndex;
        const ap = state.planner.aps[apIndex];

        const inspector = document.getElementById("planner-ap-inspector");
        const titleEl = document.getElementById("inspector-ap-title");
        const nameEl = document.getElementById("inspector-ap-name");
        const ch24El = document.getElementById("inspector-ap-ch24");
        const ch5El = document.getElementById("inspector-ap-ch5");
        const ch6El = document.getElementById("inspector-ap-ch6");
        const txEl = document.getElementById("inspector-ap-txpower");
        const antEl = document.getElementById("inspector-ap-antenna");
        const enEl = document.getElementById("inspector-ap-enabled");

        if (inspector) inspector.style.display = "flex";
        if (titleEl) titleEl.textContent = `Điểm Truy Cập #${apIndex + 1} (${ap.x.toFixed(1)}m, ${ap.y.toFixed(1)}m)`;
        if (nameEl) nameEl.value = ap.name || `AP-${apIndex + 1}`;
        if (ch24El) ch24El.value = ap.channel_24 || 1;
        if (ch5El) ch5El.value = ap.channel_5 || 36;
        if (ch6El) ch6El.value = ap.channel_6 || 37;
        if (txEl) txEl.value = ap.tx_power_dbm || 20;
        if (antEl) antEl.value = ap.antenna_gain_dbi || 3;
        if (enEl) enEl.checked = (ap.enabled !== false);

        renderPlannerObjectTable();
        drawFloorplanHeatmap();
    };

    window.closeApInspector = function() {
        state.planner.selectedApIndex = -1;
        const inspector = document.getElementById("planner-ap-inspector");
        if (inspector) inspector.style.display = "none";
        renderPlannerObjectTable();
        drawFloorplanHeatmap();
    };

    window.applyApInspectorChanges = function() {
        const idx = state.planner.selectedApIndex;
        if (idx < 0 || idx >= state.planner.aps.length) return;
        const ap = state.planner.aps[idx];

        const nameEl = document.getElementById("inspector-ap-name");
        const ch24El = document.getElementById("inspector-ap-ch24");
        const ch5El = document.getElementById("inspector-ap-ch5");
        const ch6El = document.getElementById("inspector-ap-ch6");
        const txEl = document.getElementById("inspector-ap-txpower");
        const antEl = document.getElementById("inspector-ap-antenna");
        const enEl = document.getElementById("inspector-ap-enabled");

        if (nameEl && nameEl.value.trim()) ap.name = nameEl.value.trim();
        if (ch24El) ap.channel_24 = parseInt(ch24El.value) || 1;
        if (ch5El) ap.channel_5 = parseInt(ch5El.value) || 36;
        if (ch6El) ap.channel_6 = parseInt(ch6El.value) || 37;
        if (txEl) ap.tx_power_dbm = parseInt(txEl.value) || 20;
        if (antEl) ap.antenna_gain_dbi = parseInt(antEl.value) || 3;
        if (enEl) ap.enabled = enEl.checked;

        renderPlannerObjectTable();
        window.recalculateCurrentAPHeatmap();
    };

    window.deleteSelectedApFromInspector = function() {
        const idx = state.planner.selectedApIndex;
        if (idx < 0 || idx >= state.planner.aps.length) return;
        window.deletePlacedAp(idx);
        window.closeApInspector();
    };

    // =========================================================================
    // DISTANCE CALIBRATION CONTROLLERS (R3 ACRYLIC BENCHMARK)
    // =========================================================================

    let pendingCalibrationPixelDist = 0;

    window.openCalibrationModal = function(pixelDist) {
        pendingCalibrationPixelDist = pixelDist;
        const modal = document.getElementById("planner-calibration-modal");
        const pxEl = document.getElementById("calib-pixel-length");
        const realEl = document.getElementById("calib-real-meters");

        if (pxEl) pxEl.textContent = pixelDist.toFixed(1);
        if (realEl) {
            const m = getPlotMetrics();
            const estM = (pixelDist / m.scaleX).toFixed(1);
            realEl.value = Math.max(0.5, estM);
        }
        if (modal) modal.style.display = "flex";
    };

    window.cancelDistanceCalibration = function() {
        pendingCalibrationPixelDist = 0;
        state.planner.calibrationMeasure = null;
        const modal = document.getElementById("planner-calibration-modal");
        if (modal) modal.style.display = "none";
        window.setPlannerTool("select");
        drawFloorplanHeatmap();
    };

    window.applyDistanceCalibration = function() {
        const realEl = document.getElementById("calib-real-meters");
        const realM = parseFloat(realEl ? realEl.value : 0);
        if (!realM || realM <= 0.1 || pendingCalibrationPixelDist <= 5) {
            window.cancelDistanceCalibration();
            return;
        }

        const ppm = pendingCalibrationPixelDist / realM;
        const m = getPlotMetrics();
        const newW = Math.max(4, Math.min(100, Math.round((m.plotW / ppm) * 10) / 10));
        const newH = Math.max(4, Math.min(100, Math.round((m.plotH / ppm) * 10) / 10));

        state.planner.width_m = newW;
        state.planner.height_m = newH;

        const wInput = document.getElementById("planner-width-input");
        const hInput = document.getElementById("planner-height-input");
        if (wInput) wInput.value = newW;
        if (hInput) hInput.value = newH;

        window.cancelDistanceCalibration();
        if (state.planner.aps && state.planner.aps.length > 0) {
            window.recalculateCurrentAPHeatmap();
        } else {
            drawFloorplanHeatmap();
        }
    };

    // =========================================================================
    // FLOORPLAN BACKGROUND IMAGE CONTROLLERS (R3 ACRYLIC BENCHMARK)
    // =========================================================================

    window.handleFloorplanImageUpload = function(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                state.planner.backgroundImage = img;
                state.planner.backgroundImageOpacity = 0.45;
                state.planner.imageSettings = {
                    mode: "contain",
                    scale: 1.0,
                    offsetX: 0,
                    offsetY: 0
                };
                state.planner.panImageActive = false;

                const opGroup = document.getElementById("planner-image-opacity-group");
                if (opGroup) opGroup.style.display = "flex";

                // Update UI controls
                const scaleInput = document.getElementById("planner-image-scale");
                const scaleVal = document.getElementById("planner-image-scale-val");
                const modeSelect = document.getElementById("planner-image-mode-select");
                const opInput = document.getElementById("planner-image-opacity");
                const opVal = document.getElementById("planner-image-opacity-val");

                if (scaleInput) scaleInput.value = "1.0";
                if (scaleVal) scaleVal.textContent = "100%";
                if (modeSelect) modeSelect.value = "contain";
                if (opInput) opInput.value = "0.45";
                if (opVal) opVal.textContent = "45%";

                drawFloorplanHeatmap();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    window.setFloorplanImageOpacity = function(val) {
        const op = Math.max(0.05, Math.min(1.0, parseFloat(val)));
        state.planner.backgroundImageOpacity = op;
        const label = document.getElementById("planner-image-opacity-val");
        if (label) label.textContent = `${Math.round(op * 100)}%`;
        drawFloorplanHeatmap();
    };

    window.setFloorplanImageMode = function(mode) {
        if (!state.planner.imageSettings) {
            state.planner.imageSettings = { mode: "contain", scale: 1.0, offsetX: 0, offsetY: 0 };
        }
        state.planner.imageSettings.mode = mode;
        drawFloorplanHeatmap();
    };

    window.setFloorplanImageScale = function(val) {
        const s = Math.max(0.2, Math.min(3.0, parseFloat(val)));
        if (!state.planner.imageSettings) {
            state.planner.imageSettings = { mode: "contain", scale: 1.0, offsetX: 0, offsetY: 0 };
        }
        state.planner.imageSettings.scale = s;
        const label = document.getElementById("planner-image-scale-val");
        if (label) label.textContent = `${Math.round(s * 100)}%`;
        const scaleInput = document.getElementById("planner-image-scale");
        if (scaleInput && scaleInput.value != s) scaleInput.value = s;
        drawFloorplanHeatmap();
    };

    window.toggleImagePanMode = function() {
        state.planner.panImageActive = !state.planner.panImageActive;
        const btn = document.getElementById("btn-tool-pan-img");
        const canvas = document.getElementById("canvas-floorplan-heatmap");
        if (btn) {
            if (state.planner.panImageActive) {
                btn.style.background = "#0284c7";
                btn.style.color = "#ffffff";
                btn.style.borderColor = "#0284c7";
                if (canvas) canvas.style.cursor = "grab";
            } else {
                btn.style.background = "";
                btn.style.color = "";
                btn.style.borderColor = "";
                if (canvas) canvas.style.cursor = "crosshair";
            }
        }
    };

    window.syncFloorplanDimensionsToImage = function() {
        const img = state.planner.backgroundImage;
        if (!img) return;
        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;
        if (!imgW || !imgH) return;
        const imgAspect = imgW / imgH;

        // Auto calculate height_m keeping current width_m
        const curW = state.planner.width_m || 50.0;
        const newH = parseFloat((curW / imgAspect).toFixed(1));
        state.planner.height_m = Math.max(4.0, Math.min(100.0, newH));

        const heightInput = document.getElementById("planner-height-input");
        if (heightInput) heightInput.value = state.planner.height_m;

        if (state.planner.imageSettings) {
            state.planner.imageSettings.scale = 1.0;
            state.planner.imageSettings.offsetX = 0;
            state.planner.imageSettings.offsetY = 0;
        }
        const scaleInput = document.getElementById("planner-image-scale");
        const scaleVal = document.getElementById("planner-image-scale-val");
        if (scaleInput) scaleInput.value = "1.0";
        if (scaleVal) scaleVal.textContent = "100%";

        drawFloorplanHeatmap();
    };

    window.resetFloorplanImageAlignment = function() {
        if (!state.planner.imageSettings) {
            state.planner.imageSettings = { mode: "contain", scale: 1.0, offsetX: 0, offsetY: 0 };
        }
        state.planner.imageSettings.scale = 1.0;
        state.planner.imageSettings.offsetX = 0;
        state.planner.imageSettings.offsetY = 0;

        const scaleInput = document.getElementById("planner-image-scale");
        const scaleVal = document.getElementById("planner-image-scale-val");
        if (scaleInput) scaleInput.value = "1.0";
        if (scaleVal) scaleVal.textContent = "100%";

        drawFloorplanHeatmap();
    };

    window.clearFloorplanImage = function() {
        state.planner.backgroundImage = null;
        state.planner.panImageActive = false;
        const opGroup = document.getElementById("planner-image-opacity-group");
        if (opGroup) opGroup.style.display = "none";
        const fileInput = document.getElementById("planner-floorplan-file");
        if (fileInput) fileInput.value = "";
        const btn = document.getElementById("btn-tool-pan-img");
        if (btn) {
            btn.style.background = "";
            btn.style.color = "";
            btn.style.borderColor = "";
        }
        const canvas = document.getElementById("canvas-floorplan-heatmap");
        if (canvas) canvas.style.cursor = "crosshair";
        drawFloorplanHeatmap();
    };

    // =========================================================================
    // PLANNER CANVAS INTERACTION (SETUP)
    // =========================================================================

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

        let dragMode = null; // null | 'draw' | 'room' | 'ruler' | 'calibrate' | 'move_ap' | 'move_wall' | 'drag_handle1' | 'drag_handle2'
        let dragWallIdx = -1;
        let dragApIdx = -1;
        let dragStartPt = null;
        let dragOrigWall = null;

        canvas.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;
            const pt = getCoords(e);

            if (state.planner.panImageActive || e.spaceKey) {
                dragMode = "pan_image";
                dragStartPt = { clientX: e.clientX, clientY: e.clientY };
                dragOrigWall = {
                    x: (state.planner.imageSettings && state.planner.imageSettings.offsetX) || 0,
                    y: (state.planner.imageSettings && state.planner.imageSettings.offsetY) || 0
                };
                canvas.style.cursor = "grabbing";
                return;
            }
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

            if (tool === "calibrate") {
                window.deselectWall();
                window.closeApInspector();
                dragMode = "calibrate";
                dragStartPt = { px: pt.px, py: pt.py, mx: pt.x, my: pt.y };
                state.planner.calibrationMeasure = { px1: pt.px, py1: pt.py, px2: pt.px, py2: pt.py };
                drawFloorplanHeatmap();
                return;
            }

            if (tool === "ruler") {
                window.deselectWall();
                window.closeApInspector();
                dragMode = "ruler";
                dragStartPt = { x: snap(pt.x, 0.25), y: snap(pt.y, 0.25) };
                state.planner.rulerMeasure = { x1: dragStartPt.x, y1: dragStartPt.y, x2: dragStartPt.x, y2: dragStartPt.y };
                drawFloorplanHeatmap();
                return;
            }

            if (apHit >= 0) {
                window.openApInspector(apHit);
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
                window.closeApInspector();
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
                window.closeApInspector();
                dragMode = "room";
                dragStartPt = { x: snap(pt.x, 0.5), y: snap(pt.y, 0.5) };
                state.planner.previewRoom = null;
            } else if (tool === "draw") {
                window.deselectWall();
                window.closeApInspector();
                dragMode = "draw";
                dragStartPt = { x: snap(pt.x, 0.5), y: snap(pt.y, 0.5) };
                state.planner.previewWall = null;
            } else {
                window.deselectWall();
                window.closeApInspector();
            }
            drawFloorplanHeatmap();
        });

        canvas.addEventListener("mousemove", (e) => {
            const pt = getCoords(e);
            state.planner.cursorMeters = { x: pt.x, y: pt.y };
            const m = getPlotMetrics();

            if (dragMode) {
                if (dragMode === "pan_image" && dragStartPt && dragOrigWall) {
                    if (!state.planner.imageSettings) {
                        state.planner.imageSettings = { mode: "contain", scale: 1.0, offsetX: 0, offsetY: 0 };
                    }
                    state.planner.imageSettings.offsetX = dragOrigWall.x + (e.clientX - dragStartPt.clientX);
                    state.planner.imageSettings.offsetY = dragOrigWall.y + (e.clientY - dragStartPt.clientY);
                    drawFloorplanHeatmap();
                    return;
                }
                if (dragMode === "move_ap" && dragApIdx >= 0 && dragApIdx < state.planner.aps.length) {
                    state.planner.aps[dragApIdx].x = Math.max(0.25, Math.min(m.width_m - 0.25, snap(pt.x, 0.25)));
                    state.planner.aps[dragApIdx].y = Math.max(0.25, Math.min(m.height_m - 0.25, snap(pt.y, 0.25)));
                    drawFloorplanHeatmap();
                    return;
                }

                if (dragMode === "calibrate" && dragStartPt) {
                    state.planner.calibrationMeasure = {
                        px1: dragStartPt.px,
                        py1: dragStartPt.py,
                        px2: pt.px,
                        py2: pt.py
                    };
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
                    state.planner.previewRoom = {
                        x1: dragStartPt.x,
                        y1: dragStartPt.y,
                        x2: snap(pt.x, 0.5),
                        y2: snap(pt.y, 0.5),
                        material: document.getElementById("planner-wall-material-select")?.value || "brick"
                    };
                    drawFloorplanHeatmap();
                    return;
                }

                if (dragMode === "draw" && dragStartPt) {
                    let endX = snap(pt.x, 0.25);
                    let endY = snap(pt.y, 0.25);
                    if (e.shiftKey) {
                        const dx = Math.abs(endX - dragStartPt.x);
                        const dy = Math.abs(endY - dragStartPt.y);
                        if (dx > dy) endY = dragStartPt.y;
                        else endX = dragStartPt.x;
                    }
                    state.planner.previewWall = {
                        x1: dragStartPt.x,
                        y1: dragStartPt.y,
                        x2: endX,
                        y2: endY,
                        material: document.getElementById("planner-wall-material-select")?.value || "brick"
                    };
                    drawFloorplanHeatmap();
                    return;
                }

                if (dragMode === "move_wall" && dragWallIdx >= 0 && dragOrigWall && dragStartPt) {
                    const dx = snap(pt.x - dragStartPt.x, 0.25);
                    const dy = snap(pt.y - dragStartPt.y, 0.25);
                    const w = state.planner.walls[dragWallIdx];
                    let nx1 = dragOrigWall.x1 + dx, ny1 = dragOrigWall.y1 + dy;
                    let nx2 = dragOrigWall.x2 + dx, ny2 = dragOrigWall.y2 + dy;

                    const minX = Math.min(nx1, nx2);
                    const maxX = Math.max(nx1, nx2);
                    const minY = Math.min(ny1, ny2);
                    const maxY = Math.max(ny1, ny2);

                    if (minX >= 0 && maxX <= m.width_m && minY >= 0 && maxY <= m.height_m) {
                        w.x1 = nx1; w.y1 = ny1;
                        w.x2 = nx2; w.y2 = ny2;
                    }
                    drawFloorplanHeatmap();
                    return;
                }

                if ((dragMode === "drag_handle1" || dragMode === "drag_handle2") && dragWallIdx >= 0) {
                    const w = state.planner.walls[dragWallIdx];
                    let nx = snap(pt.x, 0.25);
                    let ny = snap(pt.y, 0.25);
                    if (e.shiftKey) {
                        const anchorX = (dragMode === "drag_handle1") ? w.x2 : w.x1;
                        const anchorY = (dragMode === "drag_handle1") ? w.y2 : w.y1;
                        const dx = Math.abs(nx - anchorX);
                        const dy = Math.abs(ny - anchorY);
                        if (dx > dy) ny = anchorY;
                        else nx = anchorX;
                    }

                    if (dragMode === "drag_handle1") {
                        w.x1 = Math.max(0, Math.min(m.width_m, nx));
                        w.y1 = Math.max(0, Math.min(m.height_m, ny));
                    } else {
                        w.x2 = Math.max(0, Math.min(m.width_m, nx));
                        w.y2 = Math.max(0, Math.min(m.height_m, ny));
                    }
                    drawFloorplanHeatmap();
                    return;
                }
            }

            // Hover state updates
            const apHit = findApHit(pt);
            const hit = findHitTarget(pt);
            let prevHoveredWall = state.planner.hoveredWallIndex;
            let prevHoveredAp = state.planner.hoveredApIndex;

            state.planner.hoveredWallIndex = hit ? hit.wallIdx : -1;
            state.planner.hoveredPart = hit ? hit.part : null;
            state.planner.hoveredApIndex = apHit;

            if (prevHoveredWall !== state.planner.hoveredWallIndex || prevHoveredAp !== state.planner.hoveredApIndex) {
                drawFloorplanHeatmap();
            }

            if (!dragMode) {
                const tool = state.planner.activeTool;
                if (tool === "calibrate" || tool === "ruler" || tool === "draw" || tool === "room") {
                    canvas.style.cursor = "crosshair";
                } else if (tool === "place_ap") {
                    canvas.style.cursor = "copy";
                } else if (apHit >= 0) {
                    canvas.style.cursor = "grab";
                } else if (hit) {
                    if (hit.part === "handle1" || hit.part === "handle2") canvas.style.cursor = "crosshair";
                    else if (hit.part === "midpoint" || hit.part === "body") canvas.style.cursor = "grab";
                } else {
                    canvas.style.cursor = "default";
                }
            }
        });

        const finishDragging = (e) => {
            if (!dragMode) return;
            const pt = getCoords(e);

            if (dragMode === "calibrate" && state.planner.calibrationMeasure) {
                const cm = state.planner.calibrationMeasure;
                const pDist = Math.hypot(cm.px2 - cm.px1, cm.py2 - cm.py1);
                if (pDist >= 15) {
                    window.openCalibrationModal(pDist);
                } else {
                    state.planner.calibrationMeasure = null;
                }
            } else if (dragMode === "move_ap") {
                window.recalculateCurrentAPHeatmap();
            } else if (dragMode === "room" && dragStartPt) {
                const xA = Math.min(dragStartPt.x, snap(pt.x, 0.5));
                const xB = Math.max(dragStartPt.x, snap(pt.x, 0.5));
                const yA = Math.min(dragStartPt.y, snap(pt.y, 0.5));
                const yB = Math.max(dragStartPt.y, snap(pt.y, 0.5));
                const rw = xB - xA;
                const rh = yB - yA;

                if (rw >= 1.0 && rh >= 1.0) {
                    const matSelect = document.getElementById("planner-wall-material-select");
                    const mat = matSelect ? matSelect.value : "brick";
                    const roomId = Date.now() + Math.floor(Math.random() * 1000);

                    state.planner.walls.push({ x1: xA, y1: yA, x2: xB, y2: yA, material: mat, roomId });
                    state.planner.walls.push({ x1: xB, y1: yA, x2: xB, y2: yB, material: mat, roomId });
                    state.planner.walls.push({ x1: xB, y1: yB, x2: xA, y2: yB, material: mat, roomId });
                    state.planner.walls.push({ x1: xA, y1: yB, x2: xA, y2: yA, material: mat, roomId });

                    if (!state.planner.roomLabels) state.planner.roomLabels = [];
                    const areaM2 = (rw * rh).toFixed(1);
                    const roomNum = (state.planner.roomLabels || []).length + 1;
                    state.planner.roomLabels.push({
                        roomId,
                        x: (xA + xB) / 2,
                        y: (yA + yB) / 2,
                        text: `Phòng ${roomNum} (${areaM2}m²)`
                    });

                    updateWallCountBadge();
                    window.recalculateCurrentAPHeatmap();
                }
                state.planner.previewRoom = null;
            } else if (dragMode === "draw" && dragStartPt) {
                let endX = snap(pt.x, 0.25);
                let endY = snap(pt.y, 0.25);
                if (e.shiftKey) {
                    const dx = Math.abs(endX - dragStartPt.x);
                    const dy = Math.abs(endY - dragStartPt.y);
                    if (dx > dy) endY = dragStartPt.y;
                    else endX = dragStartPt.x;
                }
                const dist = Math.hypot(endX - dragStartPt.x, endY - dragStartPt.y);
                if (dist >= 0.5) {
                    const matSelect = document.getElementById("planner-wall-material-select");
                    const mat = matSelect ? matSelect.value : "brick";
                    state.planner.walls.push({
                        x1: dragStartPt.x,
                        y1: dragStartPt.y,
                        x2: endX,
                        y2: endY,
                        material: mat
                    });
                    const newIdx = state.planner.walls.length - 1;
                    window.selectWall(newIdx);
                    updateWallCountBadge();
                    window.recalculateCurrentAPHeatmap();
                }
                state.planner.previewWall = null;
            } else if (dragMode === "drag_handle1" || dragMode === "drag_handle2") {
                if (dragWallIdx >= 0 && dragWallIdx < state.planner.walls.length) {
                    const w = state.planner.walls[dragWallIdx];
                    const dist = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
                    if (dist < 0.25) {
                        window.deleteWallAt(dragWallIdx);
                    } else {
                        window.recalculateCurrentAPHeatmap();
                    }
                }
            } else if (dragMode === "move_wall") {
                if (dragWallIdx >= 0 && dragWallIdx < state.planner.walls.length) {
                    const w = state.planner.walls[dragWallIdx];
                    const finalLen = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
                    const lenEl = document.getElementById("inspector-wall-length");
                    if (lenEl) {
                        const curUnit = state.planner.unit || "m";
                        lenEl.value = convertMetersToUnit(finalLen, curUnit);
                    }
                    window.recalculateCurrentAPHeatmap();
                }
            }

            dragMode = null;
            dragWallIdx = -1;
            dragApIdx = -1;
            dragStartPt = null;
            dragOrigWall = null;
            if (canvas) canvas.style.cursor = state.planner.panImageActive ? "grab" : "crosshair";
            drawFloorplanHeatmap();
        };

        canvas.addEventListener("mouseup", finishDragging);
        canvas.addEventListener("mouseleave", finishDragging);

        // Mouse wheel zoom for background image when in pan mode or holding Alt
        canvas.addEventListener("wheel", (e) => {
            if (state.planner.backgroundImage && (state.planner.panImageActive || e.altKey)) {
                e.preventDefault();
                if (!state.planner.imageSettings) {
                    state.planner.imageSettings = { mode: "contain", scale: 1.0, offsetX: 0, offsetY: 0 };
                }
                const step = e.deltaY < 0 ? 0.05 : -0.05;
                const newScale = Math.max(0.2, Math.min(3.0, parseFloat((state.planner.imageSettings.scale + step).toFixed(2))));
                window.setFloorplanImageScale(newScale);
            }
        }, { passive: false });

        window.addEventListener("keydown", (e) => {
            const tabPlanner = document.getElementById("tab-planner");
            if (!tabPlanner || !tabPlanner.classList.contains("active")) return;
            const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
            if (tag === "input" || tag === "select" || tag === "textarea") return;

            if (e.key === "Delete" || e.key === "Backspace") {
                if (state.planner.selectedWallIndex >= 0) {
                    e.preventDefault();
                    window.deleteWallAt(state.planner.selectedWallIndex);
                } else if (state.planner.selectedApIndex >= 0) {
                    e.preventDefault();
                    window.deletePlacedAp(state.planner.selectedApIndex);
                    window.closeApInspector();
                }
            }
        });
    }

    // =========================================================================
    // 5-TIER CONTINUOUS RF COLOR SCALES (EKAHAU & ACRYLIC WI-FI BENCHMARK)
    // =========================================================================

    function interpolateColorStops(val, stops) {
        if (val >= stops[0].val) {
            return { r: stops[0].r, g: stops[0].g, b: stops[0].b, a: stops[0].a };
        }
        const last = stops[stops.length - 1];
        if (val <= last.val) {
            return { r: last.r, g: last.g, b: last.b, a: last.a };
        }
        for (let i = 0; i < stops.length - 1; i++) {
            const s1 = stops[i];
            const s2 = stops[i + 1];
            if (val <= s1.val && val >= s2.val) {
                const range = s1.val - s2.val;
                const t = range === 0 ? 0 : (val - s2.val) / range;
                return {
                    r: Math.round(s2.r + t * (s1.r - s2.r)),
                    g: Math.round(s2.g + t * (s1.g - s2.g)),
                    b: Math.round(s2.b + t * (s1.b - s2.b)),
                    a: Number((s2.a + t * (s1.a - s2.a)).toFixed(3))
                };
            }
        }
        return { r: last.r, g: last.g, b: last.b, a: last.a };
    }

    const RSSI_STOPS = [
        { val: -45, r: 5,   g: 150, b: 105, a: 0.70 }, // Very Strong: #059669
        { val: -55, r: 16,  g: 185, b: 129, a: 0.65 }, // Good: #10b981
        { val: -65, r: 234, g: 179, b: 8,   a: 0.60 }, // Moderate: #eab308
        { val: -75, r: 249, g: 115, b: 22,  a: 0.55 }, // Weak: #f97316
        { val: -85, r: 239, g: 68,  b: 68,  a: 0.50 }, // Critical: #ef4444
        { val: -95, r: 148, g: 163, b: 184, a: 0.15 }  // Dead Zone: #94a3b8
    ];

    function getContinuousRssiColor(rssi) {
        return interpolateColorStops(rssi, RSSI_STOPS);
    }

    function getContinuousColor(rssi) {
        const c = getContinuousRssiColor(rssi);
        return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
    }

    const SNR_STOPS = [
        { val: 40, r: 5,   g: 150, b: 105, a: 0.70 },
        { val: 30, r: 16,  g: 185, b: 129, a: 0.65 },
        { val: 20, r: 234, g: 179, b: 8,   a: 0.60 },
        { val: 12, r: 249, g: 115, b: 22,  a: 0.55 },
        { val: 0,  r: 239, g: 68,  b: 68,  a: 0.45 }
    ];
    function getContinuousSnrColor(snr) {
        return interpolateColorStops(snr, SNR_STOPS);
    }

    const INTERFERENCE_STOPS = [
        { val: 0, r: 16,  g: 185, b: 129, a: 0.55 },
        { val: 1, r: 234, g: 179, b: 8,   a: 0.60 },
        { val: 2, r: 249, g: 115, b: 22,  a: 0.65 },
        { val: 4, r: 239, g: 68,  b: 68,  a: 0.70 }
    ];
    function getContinuousInterferenceColor(conflicts) {
        if (conflicts <= 0) return { r: 16, g: 185, b: 129, a: 0.55 };
        if (conflicts >= 4) return { r: 239, g: 68, b: 68, a: 0.70 };
        for (let i = 0; i < INTERFERENCE_STOPS.length - 1; i++) {
            const s1 = INTERFERENCE_STOPS[i];
            const s2 = INTERFERENCE_STOPS[i + 1];
            if (conflicts >= s1.val && conflicts <= s2.val) {
                const t = (conflicts - s1.val) / (s2.val - s1.val);
                return {
                    r: Math.round(s1.r + t * (s2.r - s1.r)),
                    g: Math.round(s2.g + t * (s1.g - s2.g)),
                    b: Math.round(s2.b + t * (s1.b - s2.b)),
                    a: Number((s1.a + t * (s2.a - s1.a)).toFixed(3))
                };
            }
        }
        return { r: 239, g: 68, b: 68, a: 0.70 };
    }

    const THROUGHPUT_STOPS = [
        { val: 800, r: 5,   g: 150, b: 105, a: 0.70 },
        { val: 400, r: 16,  g: 185, b: 129, a: 0.65 },
        { val: 150, r: 234, g: 179, b: 8,   a: 0.60 },
        { val: 50,  r: 249, g: 115, b: 22,  a: 0.55 },
        { val: 0,   r: 239, g: 68,  b: 68,  a: 0.45 }
    ];
    function getContinuousThroughputColor(mbps) {
        return interpolateColorStops(mbps, THROUGHPUT_STOPS);
    }

    function getRssiColor(rssi) { return getContinuousColor(rssi); }
    function getSnrColor(snr) { const c = getContinuousSnrColor(snr); return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`; }
    function getInterferenceColor(cCount) { const c = getContinuousInterferenceColor(cCount); return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`; }
    function getThroughputColor(mbps) { const c = getContinuousThroughputColor(mbps); return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`; }

    // Hidden Offscreen Canvas for smooth GPU-accelerated Bilinear Heatmap interpolation
    let offscreenHeatmapCanvas = null;

    function renderSmoothHeatmapBuffer(activeGrid, activeMode, gridW, gridH, slaCutoff) {
        if (!offscreenHeatmapCanvas) {
            offscreenHeatmapCanvas = document.createElement("canvas");
        }
        if (offscreenHeatmapCanvas.width !== gridW || offscreenHeatmapCanvas.height !== gridH) {
            offscreenHeatmapCanvas.width = gridW;
            offscreenHeatmapCanvas.height = gridH;
        }
        const offCtx = offscreenHeatmapCanvas.getContext("2d");
        const imgData = offCtx.createImageData(gridW, gridH);
        const data = imgData.data;

        for (let j = 0; j < gridH; j++) {
            for (let i = 0; i < gridW; i++) {
                const val = activeGrid[j][i];
                const idx = (j * gridW + i) * 4;
                let rgba;

                if (activeMode === "snr") {
                    rgba = getContinuousSnrColor(val);
                } else if (activeMode === "interference") {
                    rgba = getContinuousInterferenceColor(val);
                } else if (activeMode === "throughput") {
                    rgba = getContinuousThroughputColor(val);
                } else {
                    rgba = getContinuousRssiColor(val);
                }

                data[idx] = rgba.r;
                data[idx + 1] = rgba.g;
                data[idx + 2] = rgba.b;

                if ((activeMode === "primary_rssi" || activeMode === "secondary_rssi") && val < slaCutoff) {
                    data[idx + 3] = Math.round(rgba.a * 0.35 * 255);
                } else {
                    data[idx + 3] = Math.round(rgba.a * 255);
                }
            }
        }
        offCtx.putImageData(imgData, 0, 0);
        return offscreenHeatmapCanvas;
    }

    // =========================================================================
    // DRAW FLOORPLAN HEATMAP (LIGHT MODE PRO MAX & BILINEAR UPSAMPLING)
    // =========================================================================

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

        // 1. BASE FILL (Pure Light Theme Styling)
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(plotX, plotY, plotW, plotH);

        // 1.5. DRAW FLOORPLAN BACKGROUND IMAGE LAYER (PRESERVE ASPECT RATIO & ZOOM/PAN)
        if (state.planner.backgroundImage && state.planner.backgroundImage.complete) {
            ctx.save();
            const op = state.planner.backgroundImageOpacity !== undefined ? state.planner.backgroundImageOpacity : 0.45;
            ctx.globalAlpha = op;

            const img = state.planner.backgroundImage;
            const imgW = img.naturalWidth || img.width || 1000;
            const imgH = img.naturalHeight || img.height || 1000;
            const imgAspect = imgW / imgH;

            const settings = state.planner.imageSettings || { mode: "contain", scale: 1.0, offsetX: 0, offsetY: 0 };
            const mode = settings.mode || "contain";
            const userScale = Math.max(0.2, Math.min(4.0, settings.scale || 1.0));
            const offX = settings.offsetX || 0;
            const offY = settings.offsetY || 0;

            // Clip strictly to plot canvas to avoid overflowing onto rulers
            ctx.beginPath();
            ctx.rect(plotX, plotY, plotW, plotH);
            ctx.clip();

            let drawW, drawH, drawX, drawY;
            if (mode === "fill") {
                drawW = plotW * userScale;
                drawH = plotH * userScale;
                drawX = plotX + (plotW - drawW) / 2 + offX;
                drawY = plotY + (plotH - drawH) / 2 + offY;
            } else {
                // "contain" - maintain true architectural drawing aspect ratio without distortion
                let baseW = plotW;
                let baseH = plotW / imgAspect;
                if (baseH > plotH) {
                    baseH = plotH;
                    baseW = plotH * imgAspect;
                }
                drawW = baseW * userScale;
                drawH = baseH * userScale;
                drawX = plotX + (plotW - drawW) / 2 + offX;
                drawY = plotY + (plotH - drawH) / 2 + offY;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, drawX, drawY, drawW, drawH);

            // Subtle border if pan tool is active
            if (state.planner.panImageActive) {
                ctx.strokeStyle = "#0284c7";
                ctx.lineWidth = 1.5;
                ctx.setLineDash([6, 4]);
                ctx.strokeRect(drawX, drawY, drawW, drawH);
                ctx.setLineDash([]);
            }

            ctx.restore();
        }

        // 2. DRAW HEATMAP (SMOOTH BILINEAR GPU UPSAMPLING)
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
            const slaCutoff = state.planner.slaCutoff !== undefined ? state.planner.slaCutoff : -65.0;

            // Render buffer and draw with bilinear filtering enabled
            const buffer = renderSmoothHeatmapBuffer(activeGrid, activeMode, gridW, gridH, slaCutoff);
            ctx.save();
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(buffer, 0, 0, gridW, gridH, plotX, plotY, plotW, plotH);
            ctx.restore();

            // Hazard cross-hatching for non-compliant dead zones
            let compliantCells = 0;
            const totalCells = gridH * gridW;
            const cellW = plotW / gridW;
            const cellH = plotH / gridH;

            for (let j = 0; j < gridH; j++) {
                for (let i = 0; i < gridW; i++) {
                    const val = activeGrid[j][i];
                    if (activeMode === "primary_rssi" || activeMode === "secondary_rssi") {
                        if (val >= slaCutoff) {
                            compliantCells++;
                        } else {
                            const cx = plotX + i * cellW;
                            const cy = plotY + j * cellH;
                            ctx.strokeStyle = "rgba(239, 68, 68, 0.35)";
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
                if (activeMode === "primary_rssi") {
                    slaBadge.textContent = `SLA Sóng Chính: Đạt ${slaPct}% (Ngưỡng ${slaCutoff} dBm)`;
                } else if (activeMode === "secondary_rssi") {
                    slaBadge.textContent = `SLA Chuyển Vùng: Đạt ${slaPct}% (Ngưỡng ${slaCutoff} dBm)`;
                } else if (activeMode === "snr") {
                    slaBadge.textContent = `SLA Tỷ Số SNR: Đạt ${slaPct}% (≥ 20 dB)`;
                } else if (activeMode === "interference") {
                    slaBadge.textContent = `SLA Không Nhiễu: Đạt ${slaPct}% (≤ 1 AP)`;
                } else {
                    slaBadge.textContent = `SLA Băng Thông: Đạt ${slaPct}% (≥ 100 Mbps)`;
                }
                slaBadge.style.background = slaPct >= 85 ? "rgba(16, 185, 129, 0.15)" : (slaPct >= 65 ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)");
                slaBadge.style.color = slaPct >= 85 ? "#059669" : (slaPct >= 65 ? "#d97706" : "#dc2626");
                slaBadge.style.borderColor = slaPct >= 85 ? "#10b981" : (slaPct >= 65 ? "#f59e0b" : "#ef4444");
            }
        }

        // Live Point Probe Readout
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
                probeEl.textContent = `Điểm đo: Tọa độ (${curProbeM.x.toFixed(1)}m, ${curProbeM.y.toFixed(1)}m) | Sóng chính: ${pRssi} dBm | Sóng phụ: ${sRssi} dBm | SNR: ${pSnr} dB | Tranh chấp: ${pInt} AP | Tốc độ: ${pTput} Mbps`;
            } else {
                probeEl.textContent = "Điểm đo: Di chuột lên bản vẽ để xem thông số sóng tại chỗ";
            }
        }

        // 3. ARCHITECTURAL GRID (Light Theme Styling)
        ctx.strokeStyle = "rgba(15, 23, 42, 0.04)";
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
            ctx.strokeStyle = isMajor5 ? "rgba(2, 132, 199, 0.20)" : "rgba(15, 23, 42, 0.07)";
            ctx.lineWidth = isMajor5 ? 1.5 : 1;
            ctx.beginPath();
            ctx.moveTo(toX(x), plotY);
            ctx.lineTo(toX(x), plotY + plotH);
            ctx.stroke();
        }
        for (let y = 1; y < height_m; y++) {
            const isMajor5 = (y % 5 === 0);
            ctx.strokeStyle = isMajor5 ? "rgba(2, 132, 199, 0.20)" : "rgba(15, 23, 42, 0.07)";
            ctx.lineWidth = isMajor5 ? 1.5 : 1;
            ctx.beginPath();
            ctx.moveTo(plotX, toY(y));
            ctx.lineTo(plotX + plotW, toY(y));
            ctx.stroke();
        }

        // 4. PERIMETER FRAME & CORNER BRACKETS
        ctx.strokeStyle = "#0284c7";
        ctx.lineWidth = 2;
        ctx.strokeRect(plotX, plotY, plotW, plotH);

        const bracketLen = 10;
        ctx.strokeStyle = "#0284c7";
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

        // 5. ROOM LABELS
        if (state.planner.roomLabels) {
            for (const r of state.planner.roomLabels) {
                const rx = toX(r.x);
                const ry = toY(r.y);
                ctx.font = "bold 11px sans-serif";
                const tw = ctx.measureText(r.text).width;
                ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
                ctx.fillRect(rx - tw/2 - 6, ry - 10, tw + 12, 20);
                ctx.strokeStyle = "#cbd5e1";
                ctx.lineWidth = 1;
                ctx.strokeRect(rx - tw/2 - 6, ry - 10, tw + 12, 20);

                ctx.fillStyle = "#0f172a";
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
            ctx.strokeStyle = "rgba(2, 132, 199, 0.35)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, plotY);
            ctx.lineTo(cx, cy);
            ctx.lineTo(plotX, cy);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        function getWallStyle(mat) {
            if (mat === "concrete") return { casing: "#334155", core: "#94a3b8", center: "#e2e8f0", width: 8 };
            if (mat === "metal") return { casing: "#4c1d95", core: "#a855f7", center: "#f3e8ff", width: 9 };
            if (mat === "glass") return { casing: "rgba(2, 132, 199, 0.28)", core: "#0284c7", center: "#ffffff", width: 7 };
            if (mat === "wood") return { casing: "#b45309", core: "#d97706", center: "#fef08a", width: 6 };
            if (mat === "door") return { casing: "#065f46", core: "#10b981", center: "#d1fae5", width: 5 };
            return { casing: "#c2410c", core: "#ea580c", center: "#fed7aa", width: 6 };
        }

        // 7. DRAW WALLS
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
                ctx.fillStyle = wall.material === "glass" ? "rgba(2, 132, 199, 0.18)" : "rgba(15, 23, 42, 0.65)";
                ctx.fill();
                ctx.strokeStyle = style.core;
                ctx.lineWidth = 1.2;
                ctx.stroke();
                ctx.restore();
            }

            if (isSelected) {
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.lineCap = "round";
                ctx.strokeStyle = "#0284c7";
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
                ctx.strokeStyle = "rgba(2, 132, 199, 0.35)";
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
                [{ x: x1, y: y1 }, { x: x2, y: y2 }].forEach((pt, pIdx) => {
                    const isPartHovered = isHovered && (
                        (pIdx === 0 && state.planner.hoveredPart === "handle1") ||
                        (pIdx === 1 && state.planner.hoveredPart === "handle2")
                    );
                    const r = isPartHovered ? 10 : 8;

                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, r + 4, 0, Math.PI * 2);
                    ctx.fillStyle = "rgba(2, 132, 199, 0.25)";
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
                const pillW = 96;
                const pillH = 20;
                ctx.fillStyle = isMidHovered ? "#e0f2fe" : "#ffffff";
                ctx.strokeStyle = isMidHovered ? "#0284c7" : "#cbd5e1";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect(midX - pillW/2, midY - pillH/2, pillW, pillH, 10);
                ctx.fill();
                ctx.stroke();

                ctx.font = "bold 10px sans-serif";
                ctx.fillStyle = "#0284c7";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("Di Chuyển Vách", midX, midY);

                const lenM = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
                const formattedLen = `${convertMetersToUnit(lenM, curUnit)} ${curUnit}`;
                const theta = Math.round(Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1) * 180 / Math.PI);
                const dimText = `${formattedLen} (${Math.abs(theta)}°)`;

                ctx.font = "bold 11px monospace";
                const tw = ctx.measureText(dimText).width;
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(midX - tw/2 - 6, midY - 28, tw + 12, 18);
                ctx.strokeStyle = "#0284c7";
                ctx.lineWidth = 1.2;
                ctx.strokeRect(midX - tw/2 - 6, midY - 28, tw + 12, 18);

                ctx.fillStyle = "#0284c7";
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
                        ctx.fillText("Bấm để Xóa Vách", midX, midY - 14);
                    } else {
                        ctx.fillStyle = "#0284c7";
                        ctx.fillText(`Bấm Chọn & Di Chuyển (${formattedLen})`, midX, midY - 14);
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
            ctx.fillStyle = "#0284c7";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(formattedLen, midX, midY - 14);
        }

        // 8B. LIVE DRAWING PREVIEW ROOM BOX
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
            ctx.fillStyle = "rgba(2, 132, 199, 0.08)";
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
            ctx.fillStyle = "#0284c7";
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
            ctx.strokeStyle = "#d97706";
            ctx.lineWidth = 2.2;
            ctx.setLineDash([6, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            [{ x: rx1, y: ry1 }, { x: rx2, y: ry2 }].forEach(pt => {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = "#f59e0b";
                ctx.fill();
                ctx.strokeStyle = "#0f172a";
                ctx.lineWidth = 1.5;
                ctx.stroke();
            });

            const midX = (rx1 + rx2) / 2;
            const midY = (ry1 + ry2) / 2;
            const label = `${convertMetersToUnit(distM, curUnit)} ${curUnit} | ${wallHits} vách (-${wallLoss.toFixed(1)}dB) | Tổng suy hao: -${totalLoss} dB`;
            ctx.font = "bold 11px monospace";
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(midX - tw / 2 - 8, midY - 26, tw + 16, 20);
            ctx.strokeStyle = "#d97706";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(midX - tw / 2 - 8, midY - 26, tw + 16, 20);
            ctx.fillStyle = "#b45309";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, midX, midY - 16);
            ctx.restore();
        }

        // 8D. DISTANCE CALIBRATION MEASUREMENT PREVIEW (R3)
        const cm = state.planner.calibrationMeasure;
        if (cm) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(cm.px1, cm.py1);
            ctx.lineTo(cm.px2, cm.py2);
            ctx.strokeStyle = "#0284c7";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([8, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            [{ x: cm.px1, y: cm.py1 }, { x: cm.px2, y: cm.py2 }].forEach(pt => {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
                ctx.fillStyle = "#0284c7";
                ctx.fill();
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.stroke();
            });

            const pDist = Math.hypot(cm.px2 - cm.px1, cm.py2 - cm.py1);
            const midX = (cm.px1 + cm.px2) / 2;
            const midY = (cm.py1 + cm.py2) / 2;
            const calibLabel = `Hiệu chuẩn: ${pDist.toFixed(1)} điểm ảnh`;
            ctx.font = "bold 11px sans-serif";
            const tw = ctx.measureText(calibLabel).width;
            ctx.fillStyle = "#0284c7";
            ctx.fillRect(midX - tw/2 - 6, midY - 24, tw + 12, 18);
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(calibLabel, midX, midY - 15);
            ctx.restore();
        }

        // 9. DRAW AP MARKERS & SELECTION RINGS
        state.planner.aps.forEach((ap, apIdx) => {
            const cx = toX(ap.x);
            const cy = toY(ap.y);
            const isApSelected = (state.planner.selectedApIndex === apIdx);
            const isApDisabled = ap.enabled === false;

            // Outer pulse ring
            ctx.beginPath();
            ctx.arc(cx, cy, 26, 0, Math.PI * 2);
            ctx.fillStyle = isApDisabled ? "rgba(148, 163, 184, 0.12)" : "rgba(2, 132, 199, 0.15)";
            ctx.fill();
            ctx.strokeStyle = isApSelected ? "#0284c7" : (isApDisabled ? "#94a3b8" : "rgba(2, 132, 199, 0.6)");
            ctx.lineWidth = isApSelected ? 2.5 : 1.5;
            if (isApSelected) ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Middle ring
            ctx.beginPath();
            ctx.arc(cx, cy, 16, 0, Math.PI * 2);
            ctx.fillStyle = isApDisabled ? "rgba(148, 163, 184, 0.20)" : "rgba(2, 132, 199, 0.25)";
            ctx.fill();

            // Center AP core
            ctx.beginPath();
            ctx.arc(cx, cy, 9, 0, Math.PI * 2);
            ctx.fillStyle = isApDisabled ? "#64748b" : (isApSelected ? "#0284c7" : "#0ea5e9");
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // AP Label Tag
            ctx.font = "bold 11px sans-serif";
            const chText = `Ch ${ap.channel_24 || 1}/${ap.channel_5 || 36}/6G:${ap.channel_6 || 37}`;
            const label = isApDisabled ? `${ap.name} (Tạm ngắt)` : `${ap.name} (${chText} • ${ap.tx_power_dbm || 20}dBm)`;
            const tw = ctx.measureText(label).width;

            ctx.fillStyle = "#ffffff";
            ctx.fillRect(cx - tw/2 - 6, cy - 38, tw + 12, 20);
            ctx.strokeStyle = isApSelected ? "#0284c7" : (isApDisabled ? "#cbd5e1" : "#0284c7");
            ctx.lineWidth = isApSelected ? 2 : 1;
            ctx.strokeRect(cx - tw/2 - 6, cy - 38, tw + 12, 20);

            ctx.fillStyle = isApDisabled ? "#64748b" : "#0369a1";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, cx, cy - 28);
        });

        // 10. TOP METRIC RULER (Light Mode Styling)
        ctx.fillStyle = "#f1f5f9";
        ctx.fillRect(0, 0, W, RULER_TOP);
        ctx.strokeStyle = "#cbd5e1";
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
            ctx.strokeStyle = isMajor5 ? "#0284c7" : "#94a3b8";
            ctx.lineWidth = isMajor5 ? 1.5 : 1;
            ctx.stroke();

            ctx.fillStyle = isMajor5 ? "#0284c7" : "#475569";
            ctx.fillText(x === 0 ? "0" : (x === width_m ? `${x}m` : `${x}`), rx, RULER_TOP - 11);
        }

        if (curM && curM.x >= 0 && curM.x <= width_m) {
            const pinX = toX(curM.x);
            ctx.fillStyle = "#0284c7";
            ctx.beginPath();
            ctx.moveTo(pinX - 4, RULER_TOP - 2);
            ctx.lineTo(pinX + 4, RULER_TOP - 2);
            ctx.lineTo(pinX, RULER_TOP + 4);
            ctx.closePath();
            ctx.fill();
        }

        // 11. LEFT METRIC RULER (Light Mode Styling)
        ctx.fillStyle = "#f1f5f9";
        ctx.fillRect(0, 0, RULER_LEFT, H);
        ctx.strokeStyle = "#cbd5e1";
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
            ctx.strokeStyle = isMajor5 ? "#0284c7" : "#94a3b8";
            ctx.lineWidth = isMajor5 ? 1.5 : 1;
            ctx.stroke();

            ctx.fillStyle = isMajor5 ? "#0284c7" : "#475569";
            ctx.fillText(y === 0 ? "0" : (y === height_m ? `${y}m` : `${y}`), RULER_LEFT - 11, ry);
        }

        if (curM && curM.y >= 0 && curM.y <= height_m) {
            const pinY = toY(curM.y);
            ctx.fillStyle = "#0284c7";
            ctx.beginPath();
            ctx.moveTo(RULER_LEFT - 2, pinY - 4);
            ctx.lineTo(RULER_LEFT - 2, pinY + 4);
            ctx.lineTo(RULER_LEFT + 4, pinY);
            ctx.closePath();
            ctx.fill();
        }

        // 12. TOP-LEFT JUNCTION BADGE (Light Mode Styling)
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(0, 0, RULER_LEFT, RULER_TOP);
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1;
        ctx.strokeRect(1, 1, RULER_LEFT - 2, RULER_TOP - 2);

        ctx.fillStyle = "#0369a1";
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(curUnit, RULER_LEFT / 2, RULER_TOP / 2);

        // 13. BOTTOM STATUS READOUT
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = "#475569";
        ctx.fillText(`MẶT BẰNG ${state.planner.view25D ? '2.5D' : '2D'} (${state.planner.freq_ghz || 2.4} GHz • Chế độ: ${activeMode.toUpperCase()}) • ${width_m}m × ${height_m}m (${(width_m * height_m).toFixed(0)} m²)`, plotX + 8, H - 6);

        if (curM && curM.x >= 0 && curM.x <= width_m && curM.y >= 0 && curM.y <= height_m) {
            ctx.textAlign = "right";
            ctx.fillStyle = "#0284c7";
            ctx.fillText(`X: ${curM.x.toFixed(2)}m  Y: ${curM.y.toFixed(2)}m (Bước nhảy: 0.25m)`, plotX + plotW - 8, H - 6);
        }
    }

    // =========================================================================
    // OSCIUM CENTRALIZED TROUBLESHOOTING DASHBOARD (R4)
    // =========================================================================

    window.refreshOsciumDiagnostics = async function() {
        const btn = document.getElementById("btn-run-oscium-diag");
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Đang chẩn đoán...";
        }

        try {
            const response = await fetch("/api/troubleshooting/all-in-one");
            if (!response.ok) {
                throw new Error("Lỗi máy chủ: " + response.status);
            }
            const data = await response.json();
            window.renderOsciumTroubleshootingDashboard(data);
        } catch (err) {
            console.error("Lỗi tải dữ liệu chẩn đoán Oscium:", err);
            const summaryEl = document.getElementById("oscium-health-summary-text");
            if (summaryEl) {
                summaryEl.textContent = "Không thể tải dữ liệu chẩn đoán sự cố: " + (err.message || "Lỗi mạng");
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = "Chẩn Đoán Toàn Diện Ngay";
            }
        }
    };

    window.renderOsciumTroubleshootingDashboard = function(data) {
        if (!data) return;

        const tsSuite = data.troubleshooting_suite || {};
        const adapterDiag = tsSuite.adapter_diagnostics || {};
        const iface = data.connected_interface || {};
        const rootCause = tsSuite.automated_root_cause || {};
        const pathQ = data.path_quality || {};
        const timestamp = data.timestamp || new Date().toLocaleString("vi-VN");

        // KHỐI 1: TỔNG QUAN ĐIỂM SỨC KHỎE
        const lastUpdateEl = document.getElementById("oscium-last-update-time");
        if (lastUpdateEl) lastUpdateEl.textContent = "Cập nhật: " + timestamp;

        const healthScore = tsSuite.health_score !== undefined ? tsSuite.health_score : (data.global_score || 0);
        const scoreValEl = document.getElementById("oscium-score-val");
        if (scoreValEl) {
            scoreValEl.textContent = healthScore;
            if (healthScore >= 80) scoreValEl.style.color = "#059669";
            else if (healthScore >= 60) scoreValEl.style.color = "#d97706";
            else scoreValEl.style.color = "#dc2626";
        }

        const healthVerdictEl = document.getElementById("oscium-health-verdict-badge");
        if (healthVerdictEl) {
            if (healthScore >= 85) {
                healthVerdictEl.className = "badge-status-pass";
                healthVerdictEl.textContent = "Môi trường sóng xuất sắc";
            } else if (healthScore >= 70) {
                healthVerdictEl.className = "badge-status-pass";
                healthVerdictEl.textContent = "Đạt chuẩn ổn định";
            } else if (healthScore >= 50) {
                healthVerdictEl.className = "badge-status-warn";
                healthVerdictEl.textContent = "Cảnh báo có can nhiễu";
            } else {
                healthVerdictEl.className = "badge-status-crit";
                healthVerdictEl.textContent = "Chất lượng sóng kém";
            }
        }

        const retryEl = document.getElementById("oscium-retry-badge");
        if (retryEl) {
            const retryPct = tsSuite.estimated_retry_rate_pct !== undefined ? tsSuite.estimated_retry_rate_pct : 2.5;
            retryEl.textContent = "Gửi lại gói tin: ~" + retryPct + "%";
        }

        const snrEl = document.getElementById("oscium-snr-badge");
        if (snrEl) {
            const avgSnr = data.avg_snr_db !== undefined ? data.avg_snr_db : 0;
            snrEl.textContent = "SNR trung bình: " + avgSnr + " dB";
        }

        const summaryTextEl = document.getElementById("oscium-health-summary-text");
        if (summaryTextEl) {
            if (healthScore >= 80) {
                summaryTextEl.textContent = "Môi trường sóng vô tuyến và thông số card mạng đạt chuẩn cao. Không phát hiện xung đột kênh hay nguồn phát nhiễu ngoại vi làm gián đoạn liên lạc.";
            } else if (healthScore >= 60) {
                summaryTextEl.textContent = "Hệ thống ghi nhận một số xung đột sóng ở dải 2.4GHz hoặc có nguồn phát lân cận làm tăng tỷ lệ gửi lại gói tin. Hãy làm theo hướng dẫn tối ưu phía dưới.";
            } else {
                summaryTextEl.textContent = "Môi trường mạng bị can nhiễu nghiêm trọng hoặc tín hiệu thu tại card mạng quá yếu. Tốc độ thực tế có thể suy giảm mạnh và gây rớt cuộc đàm thoại.";
            }
        }

        // KHỐI 2: PHẦN CỨNG CARD MẠNG THU SÓNG
        const statusPillEl = document.getElementById("oscium-adapter-status-pill");
        if (statusPillEl) {
            const adStatus = adapterDiag.status || "Chưa xác định";
            statusPillEl.textContent = adStatus;
            if (adStatus.includes("TỐT") || adStatus.includes("ĐẠT")) {
                statusPillEl.className = "badge-status-pass";
            } else if (adStatus.includes("CẢNH BÁO")) {
                statusPillEl.className = "badge-status-warn";
            } else {
                statusPillEl.className = "badge-status-crit";
            }
        }

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val || "--";
        };

        setTxt("oscium-adapter-name", adapterDiag.device_description || iface.description || iface.interface_name || "Card Wi-Fi");
        setTxt("oscium-adapter-ssid", adapterDiag.connected_ssid || iface.ssid || "Chưa kết nối");
        setTxt("oscium-adapter-bssid", adapterDiag.connected_bssid || iface.bssid || "--");

        const bandCh = (adapterDiag.band || iface.band || "5 GHz") + " - Kênh " + (adapterDiag.channel || iface.channel || "--");
        setTxt("oscium-adapter-channel", bandCh);

        const rssiDbm = adapterDiag.rssi_dbm !== undefined ? adapterDiag.rssi_dbm : (iface.rssi || -60);
        const sigPct = adapterDiag.signal_pct !== undefined ? adapterDiag.signal_pct : (iface.signal || 75);
        setTxt("oscium-adapter-rssi", rssiDbm + " dBm (" + sigPct + "%)");

        const rx = adapterDiag.rx_rate_mbps !== undefined ? adapterDiag.rx_rate_mbps : (iface.rx_rate || 0);
        const tx = adapterDiag.tx_rate_mbps !== undefined ? adapterDiag.tx_rate_mbps : (iface.tx_rate || 0);
        setTxt("oscium-adapter-rates", "Thu: " + Math.round(rx) + " Mbps | Phát: " + Math.round(tx) + " Mbps");

        setTxt("oscium-adapter-adequacy", adapterDiag.signal_adequacy || "ĐẠT CHUẨN");
        setTxt("oscium-adapter-symmetry", adapterDiag.rx_tx_symmetry || "CÂN BẰNG ĐỐI XỨNG");

        const adviceBox = document.getElementById("oscium-adapter-advice-box");
        if (adviceBox) {
            const recs = adapterDiag.recommendations || [];
            adviceBox.textContent = recs.length > 0 ? recs.join(" ") : "Thông số card mạng và liên kết vô tuyến đang ở trạng thái tối ưu, không cần can thiệp cấu hình.";
        }

        // KHỐI 3: SƠ ĐỒ ĐƯỜNG TRUYỀN ĐA CHẶNG
        setTxt("oscium-gateway-ip", pathQ.gateway_ip || "192.168.1.1");
        setTxt("oscium-hop1-latency", (pathQ.gateway_latency_ms || 2.4) + " ms");
        setTxt("oscium-hop2-latency", (pathQ.dns_latency_ms || 14.2) + " ms");
        setTxt("oscium-hop3-latency", (pathQ.latency_avg_ms || 28.5) + " ms");

        setTxt("oscium-path-rtt", (pathQ.latency_avg_ms || 28.5) + " ms");
        setTxt("oscium-path-jitter", (pathQ.jitter_ms || 1.8) + " ms");
        setTxt("oscium-path-loss", (pathQ.packet_loss_pct || 0.0) + " %");
        setTxt("oscium-path-mos", (pathQ.mos_score || 4.4) + " / 4.5");

        const hop1Status = document.getElementById("oscium-hop1-status");
        if (hop1Status) {
            const gwLat = pathQ.gateway_latency_ms || 2.4;
            hop1Status.className = gwLat < 10 ? "oscium-node-badge status-pass" : (gwLat < 25 ? "oscium-node-badge status-warning" : "oscium-node-badge status-critical");
            hop1Status.textContent = gwLat < 10 ? "Wi-Fi thông suốt" : "Wi-Fi bị chậm";
        }

        const hop2Status = document.getElementById("oscium-hop2-status");
        if (hop2Status) {
            const dnsLat = pathQ.dns_latency_ms || 14.2;
            hop2Status.className = dnsLat < 50 ? "oscium-node-badge status-pass" : "oscium-node-badge status-warning";
            hop2Status.textContent = dnsLat < 50 ? "DNS ổn định" : "DNS phản hồi chậm";
        }

        const hop3Status = document.getElementById("oscium-hop3-status");
        if (hop3Status) {
            const wanLat = pathQ.latency_avg_ms || 28.5;
            const loss = pathQ.packet_loss_pct || 0;
            hop3Status.className = (wanLat < 80 && loss < 1) ? "oscium-node-badge status-pass" : "oscium-node-badge status-warning";
            hop3Status.textContent = loss > 2 ? "Mất gói tin" : (wanLat < 80 ? "Đường truyền tốt" : "Độ trễ cao");
        }

        const pathDiagBox = document.getElementById("oscium-path-diagnosis-box");
        if (pathDiagBox) {
            pathDiagBox.textContent = pathQ.path_diagnosis_vi || pathQ.verdict || "Toàn bộ các chặng kết nối đều hoạt động ổn định.";
        }

        // KHỐI 4: BẢNG KIỂM TRA 6 TIÊU CHUẨN CỐT LÕI
        const checklistBox = document.getElementById("oscium-checklist-container");
        if (checklistBox && Array.isArray(tsSuite.checklist)) {
            checklistBox.innerHTML = tsSuite.checklist.map(item => {
                const status = (item.status || "PASS").toUpperCase();
                let cardClass = "pass";
                let statusText = "ĐẠT CHUẨN";
                let badgeClass = "badge-status-pass";

                if (status === "WARNING") {
                    cardClass = "warning";
                    statusText = "CẢNH BÁO";
                    badgeClass = "badge-status-warn";
                } else if (status === "CRITICAL") {
                    cardClass = "critical";
                    statusText = "NGHIÊM TRỌNG";
                    badgeClass = "badge-status-crit";
                }

                return `
                    <div class="oscium-check-card ${cardClass}">
                        <div class="oscium-check-header">
                            <span class="oscium-check-title">${escapeHtml(item.category_vi || "")}</span>
                            <span class="${badgeClass}">${statusText}</span>
                        </div>
                        <div class="oscium-check-metric">${escapeHtml(item.metric || "")}</div>
                        <div class="oscium-check-desc">${escapeHtml(item.summary_vi || "")}</div>
                        ${item.remediation_vi ? `<div class="oscium-check-remed">${escapeHtml(item.remediation_vi)}</div>` : ""}
                    </div>
                `;
            }).join("");
        }

        // KHỐI 5: CHỮ KÝ NGUỒN NHIỄU NGOÀI LUỒNG PHI WI-FI
        const interferersBox = document.getElementById("oscium-interferers-container");
        if (interferersBox && Array.isArray(tsSuite.non_wifi_interferers)) {
            interferersBox.innerHTML = tsSuite.non_wifi_interferers.map(nw => {
                const isDet = Boolean(nw.detected);
                const cardClass = isDet ? "detected" : "";
                const badgeClass = isDet ? "badge-status-warn" : "badge-status-pass";
                const badgeText = isDet ? "ĐÃ PHÁT HIỆN" : "KHÔNG PHÁT HIỆN";

                return `
                    <div class="oscium-interferer-card ${cardClass}">
                        <div class="oscium-interferer-header">
                            <span class="oscium-interferer-name">${escapeHtml(nw.name_vi || "")}</span>
                            <span class="${badgeClass}">${badgeText}</span>
                        </div>
                        <div class="oscium-interferer-meta">${escapeHtml(nw.band || "")} &bull; ${escapeHtml(nw.freq_range || "")}</div>
                        <div class="oscium-interferer-impact">${escapeHtml(nw.impact_vi || "")}</div>
                        <div class="oscium-interferer-remed">${escapeHtml(nw.remediation_vi || "")}</div>
                    </div>
                `;
            }).join("");
        }

        // KHỐI 6: NGUYÊN NHÂN GỐC RỄ VÀ HƯỚNG DẪN XỬ LÝ
        const sevBadge = document.getElementById("oscium-rootcause-severity-badge");
        if (sevBadge) {
            const sev = (rootCause.severity || "info").toLowerCase();
            if (sev === "critical") {
                sevBadge.className = "badge-status-crit";
                sevBadge.textContent = "Mức độ nghiêm trọng";
            } else if (sev === "warning") {
                sevBadge.className = "badge-status-warn";
                sevBadge.textContent = "Cần lưu ý xử lý";
            } else {
                sevBadge.className = "badge-status-pass";
                sevBadge.textContent = "Hoạt động bình thường";
            }
        }

        const issueText = document.getElementById("oscium-primary-issue-text");
        if (issueText) {
            issueText.textContent = rootCause.primary_issue_vi || "Môi trường sóng vô tuyến và thông số card mạng đạt chuẩn ổn định cao, không phát hiện xung đột hay nghẽn nghẽn kỹ thuật.";
        }

        const stepsList = document.getElementById("oscium-action-steps-list");
        if (stepsList) {
            const steps = rootCause.action_steps_vi || [];
            if (steps.length > 0) {
                stepsList.innerHTML = steps.map(s => `<li>${escapeHtml(s)}</li>`).join("");
            } else {
                stepsList.innerHTML = "<li>Duy trì cấu hình kênh hiện tại và kiểm tra lại định kỳ.</li>";
            }
        }
    };

    // =========================================================================
    // SPEED TEST WI-FI CONTROLLER (R5)
    // =========================================================================

    const speedtestState = {
        isRunning: false,
        mode: "quick",
        sseSource: null,
        pollingTimer: null,
        testId: null,
        historyKey: "netscanner_speedtest_history_v1"
    };

    window.setSpeedTestMode = function(mode) {
        if (speedtestState.isRunning) return;
        speedtestState.mode = mode;
        document.querySelectorAll(".speedtest-mode-btn").forEach(btn => {
            if (btn.getAttribute("data-mode") === mode) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    };

    window.startSpeedTest = async function() {
        if (speedtestState.isRunning) return;

        const btnStart = document.getElementById("btn-start-speedtest");
        const btnStop = document.getElementById("btn-stop-speedtest");
        if (btnStart) btnStart.style.display = "none";
        if (btnStop) btnStop.style.display = "inline-block";

        speedtestState.isRunning = true;
        window.resetSpeedTestUI();

        const stageText = document.getElementById("speedtest-stage-text");
        if (stageText) stageText.textContent = "Đang kết nối tới máy chủ Anycast...";

        try {
            const response = await fetch("/api/speedtest/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: speedtestState.mode })
            });

            if (!response.ok) {
                throw new Error("Không thể khởi động bài đo: Mã lỗi " + response.status);
            }

            const data = await response.json();
            speedtestState.testId = data.test_id;
            window.startSpeedTestStreamListener();
        } catch (err) {
            console.error("Lỗi khi bắt đầu Speed Test:", err);
            window.handleSpeedTestError("Lỗi kết nối máy chủ: " + (err.message || "Không xác định"));
        }
    };

    window.stopSpeedTest = async function() {
        try {
            await fetch("/api/speedtest/stop", { method: "POST" });
        } catch (e) {
            console.warn("Lỗi gọi dừng bài đo:", e);
        }
        window.cleanupSpeedTestListeners();
        speedtestState.isRunning = false;

        const btnStart = document.getElementById("btn-start-speedtest");
        const btnStop = document.getElementById("btn-stop-speedtest");
        if (btnStart) btnStart.style.display = "inline-block";
        if (btnStop) btnStop.style.display = "none";

        const stageText = document.getElementById("speedtest-stage-text");
        if (stageText) stageText.textContent = "Người dùng đã dừng bài đo kiểm";
    };

    window.startSpeedTestStreamListener = function() {
        window.cleanupSpeedTestListeners();

        try {
            if (!window.EventSource) {
                throw new Error("Trình duyệt không hỗ trợ EventSource");
            }

            const sse = new EventSource("/api/speedtest/stream");
            speedtestState.sseSource = sse;

            sse.onmessage = function(event) {
                try {
                    const state = JSON.parse(event.data);
                    window.updateSpeedTestUI(state);

                    if (state.status === "completed") {
                        window.onSpeedTestCompleted(state);
                    } else if (state.status === "error") {
                        window.handleSpeedTestError(state.error_message || "Đo kiểm gặp lỗi kết nối");
                    } else if (state.status === "stopped") {
                        window.cleanupSpeedTestListeners();
                        speedtestState.isRunning = false;
                    }
                } catch (parseErr) {
                    console.warn("Lỗi phân tích JSON gói tin SSE:", parseErr);
                }
            };

            sse.onerror = function() {
                console.warn("Luồng SSE bị gián đoạn, tự động chuyển sang REST Polling dự phòng...");
                window.cleanupSpeedTestListeners();
                window.startSpeedTestPollingFallback();
            };

        } catch (err) {
            console.warn("Khởi tạo SSE thất bại, chuyển sang Polling:", err);
            window.startSpeedTestPollingFallback();
        }
    };

    window.startSpeedTestPollingFallback = function() {
        if (speedtestState.pollingTimer) clearInterval(speedtestState.pollingTimer);

        speedtestState.pollingTimer = setInterval(async () => {
            try {
                const resp = await fetch("/api/speedtest/status");
                if (!resp.ok) return;
                const state = await resp.json();
                window.updateSpeedTestUI(state);

                if (state.status === "completed") {
                    clearInterval(speedtestState.pollingTimer);
                    speedtestState.pollingTimer = null;
                    window.onSpeedTestCompleted(state);
                } else if (state.status === "error") {
                    clearInterval(speedtestState.pollingTimer);
                    speedtestState.pollingTimer = null;
                    window.handleSpeedTestError(state.error_message || "Đo kiểm gặp lỗi");
                } else if (state.status === "stopped") {
                    clearInterval(speedtestState.pollingTimer);
                    speedtestState.pollingTimer = null;
                    speedtestState.isRunning = false;
                }
            } catch (e) {
                console.warn("Lỗi Polling Speed Test:", e);
            }
        }, 200);
    };

    window.cleanupSpeedTestListeners = function() {
        if (speedtestState.sseSource) {
            try { speedtestState.sseSource.close(); } catch (e) {}
            speedtestState.sseSource = null;
        }
        if (speedtestState.pollingTimer) {
            clearInterval(speedtestState.pollingTimer);
            speedtestState.pollingTimer = null;
        }
    };

    window.resetSpeedTestUI = function() {
        const setT = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        const setW = (id, w) => {
            const el = document.getElementById(id);
            if (el) el.style.width = w;
        };

        setT("gauge-download-val", "0.0");
        setT("gauge-upload-val", "0.0");
        setT("gauge-ping-val", "0.0");
        setT("gauge-jitter-val", "0.0");
        setT("speedtest-progress-percent", "0%");

        setW("speedtest-progress-bar", "0%");
        setW("gauge-download-fill", "0%");
        setW("gauge-upload-fill", "0%");
        setW("gauge-ping-fill", "0%");
        setW("gauge-jitter-fill", "0%");
        setW("compare-down-fill", "0%");
        setW("compare-link-fill", "0%");

        const badges = ["badge-stage-download", "badge-stage-upload", "badge-stage-ping"];
        badges.forEach(bId => {
            const el = document.getElementById(bId);
            if (el) {
                el.className = "gauge-stage-badge";
                el.textContent = "Chờ đo";
            }
        });
    };

    window.updateSpeedTestUI = function(st) {
        if (!st) return;

        const pct = Math.max(0, Math.min(100, st.progress_pct || 0));
        const pBar = document.getElementById("speedtest-progress-bar");
        if (pBar) pBar.style.width = pct + "%";

        const pText = document.getElementById("speedtest-progress-percent");
        if (pText) pText.textContent = pct + "%";

        const stageEl = document.getElementById("speedtest-stage-text");
        if (stageEl) {
            stageEl.textContent = st.phase_text_vi || "Đang đo kiểm...";
        }

        const srvEl = document.getElementById("speedtest-server-label");
        if (srvEl && st.server_location) {
            srvEl.textContent = st.server_location;
        }

        const badgePing = document.getElementById("badge-stage-ping");
        if (st.stage === "ping") {
            if (badgePing) {
                badgePing.className = "gauge-stage-badge active";
                badgePing.textContent = "Đang đo";
            }
        } else if (st.stage === "download" || st.stage === "upload" || st.stage === "finished") {
            if (badgePing) {
                badgePing.className = "gauge-stage-badge done";
                badgePing.textContent = "Hoàn tất";
            }
        }

        if (st.ping_ms > 0) {
            const gPing = document.getElementById("gauge-ping-val");
            if (gPing) gPing.textContent = st.ping_ms.toFixed(1);
            const pFill = document.getElementById("gauge-ping-fill");
            if (pFill) pFill.style.width = Math.min(100, (st.ping_ms / 150) * 100) + "%";

            const pVerdict = document.getElementById("gauge-ping-verdict");
            if (pVerdict) {
                pVerdict.textContent = st.ping_ms < 30 ? "Độ trễ thấp, phản hồi tức thì" : (st.ping_ms < 80 ? "Độ trễ tiêu chuẩn" : "Độ trễ cao");
            }
        }

        if (st.jitter_ms > 0) {
            const gJitter = document.getElementById("gauge-jitter-val");
            if (gJitter) gJitter.textContent = st.jitter_ms.toFixed(1);
            const jFill = document.getElementById("gauge-jitter-fill");
            if (jFill) jFill.style.width = Math.min(100, (st.jitter_ms / 30) * 100) + "%";
        }

        const badgeDown = document.getElementById("badge-stage-download");
        if (st.stage === "download") {
            if (badgeDown) {
                badgeDown.className = "gauge-stage-badge active";
                badgeDown.textContent = "Đang đo";
            }
        } else if (st.stage === "upload" || st.stage === "finished") {
            if (badgeDown) {
                badgeDown.className = "gauge-stage-badge done";
                badgeDown.textContent = "Hoàn tất";
            }
        }

        if (st.download_mbps > 0) {
            const gDown = document.getElementById("gauge-download-val");
            if (gDown) gDown.textContent = st.download_mbps.toFixed(1);
            const dFill = document.getElementById("gauge-download-fill");
            if (dFill) dFill.style.width = Math.min(100, (st.download_mbps / 300) * 100) + "%";
        }

        const badgeUp = document.getElementById("badge-stage-upload");
        if (st.stage === "upload") {
            if (badgeUp) {
                badgeUp.className = "gauge-stage-badge active";
                badgeUp.textContent = "Đang đo";
            }
        } else if (st.stage === "finished") {
            if (badgeUp) {
                badgeUp.className = "gauge-stage-badge done";
                badgeUp.textContent = "Hoàn tất";
            }
        }

        if (st.upload_mbps > 0) {
            const gUp = document.getElementById("gauge-upload-val");
            if (gUp) gUp.textContent = st.upload_mbps.toFixed(1);
            const uFill = document.getElementById("gauge-upload-fill");
            if (uFill) uFill.style.width = Math.min(100, (st.upload_mbps / 200) * 100) + "%";
        }
    };

    window.onSpeedTestCompleted = function(st) {
        window.cleanupSpeedTestListeners();
        speedtestState.isRunning = false;

        const btnStart = document.getElementById("btn-start-speedtest");
        const btnStop = document.getElementById("btn-stop-speedtest");
        if (btnStart) btnStart.style.display = "inline-block";
        if (btnStop) btnStop.style.display = "none";

        const pBar = document.getElementById("speedtest-progress-bar");
        if (pBar) pBar.style.width = "100%";
        const pText = document.getElementById("speedtest-progress-percent");
        if (pText) pText.textContent = "100%";
        const stageEl = document.getElementById("speedtest-stage-text");
        if (stageEl) stageEl.textContent = "Đo kiểm tốc độ hoàn tất";

        const downRate = st.download_mbps || 0;
        const linkRate = st.link_speed_mbps || 866.7;

        const downLabel = document.getElementById("compare-down-rate");
        if (downLabel) downLabel.textContent = downRate.toFixed(1) + " Mbps";

        const linkLabel = document.getElementById("compare-link-rate");
        if (linkLabel) linkLabel.textContent = linkRate.toFixed(1) + " Mbps";

        const maxRate = Math.max(downRate, linkRate, 100);
        const dFill = document.getElementById("compare-down-fill");
        if (dFill) dFill.style.width = Math.min(100, (downRate / maxRate) * 100) + "%";

        const lFill = document.getElementById("compare-link-fill");
        if (lFill) lFill.style.width = Math.min(100, (linkRate / maxRate) * 100) + "%";

        const efficiency = linkRate > 0 ? Math.min(100, Math.round((downRate / linkRate) * 100)) : 0;
        const effBadge = document.getElementById("speedtest-efficiency-badge");
        if (effBadge) {
            effBadge.className = efficiency >= 50 ? "badge-status-pass" : "badge-status-warn";
            effBadge.textContent = "Hiệu suất khai thác Wi-Fi: " + efficiency + "%";
        }

        const netCtx = st.network_context || {};
        const setT = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val || "--";
        };

        setT("st-context-ssid", netCtx.ssid || "Wi-Fi Hiện Tại");
        setT("st-context-channel", (netCtx.band || "5 GHz") + " - Kênh " + (netCtx.channel || 60));
        setT("st-context-signal", (netCtx.signal_percent || 90) + " %");
        setT("st-context-elapsed", (st.elapsed_seconds || 5.2) + " giây");

        const diagText = document.getElementById("speedtest-diagnosis-text");
        if (diagText) {
            diagText.textContent = st.diagnosis_vi || "Kết nối Internet hoạt động ổn định.";
        }

        window.saveSpeedTestToHistory(st);
        window.renderSpeedTestHistoryTable();
    };

    window.handleSpeedTestError = function(errMsg) {
        window.cleanupSpeedTestListeners();
        speedtestState.isRunning = false;

        const btnStart = document.getElementById("btn-start-speedtest");
        const btnStop = document.getElementById("btn-stop-speedtest");
        if (btnStart) btnStart.style.display = "inline-block";
        if (btnStop) btnStop.style.display = "none";

        const stageEl = document.getElementById("speedtest-stage-text");
        if (stageEl) {
            stageEl.textContent = "Lỗi đo kiểm: " + errMsg;
            stageEl.style.color = "#dc2626";
        }
    };

    window.saveSpeedTestToHistory = function(st) {
        try {
            const item = {
                id: st.test_id || Date.now().toString(),
                time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " " + new Date().toLocaleDateString("vi-VN"),
                mode: speedtestState.mode === "quick" ? "Đo nhanh" : "Đo đầy đủ",
                download: (st.download_mbps || 0).toFixed(1),
                upload: (st.upload_mbps || 0).toFixed(1),
                ping: (st.ping_ms || 0).toFixed(1),
                jitter: (st.jitter_ms || 0).toFixed(1),
                link_speed: (st.link_speed_mbps || 0).toFixed(1),
                verdict: (st.download_mbps >= 50 && st.ping_ms <= 50) ? "Rất tốt" : ((st.download_mbps >= 20) ? "Ổn định" : "Chậm")
            };

            const raw = localStorage.getItem(speedtestState.historyKey);
            let list = raw ? JSON.parse(raw) : [];
            list.unshift(item);
            if (list.length > 10) list = list.slice(0, 10);
            localStorage.setItem(speedtestState.historyKey, JSON.stringify(list));
        } catch (e) {
            console.warn("Không thể lưu lịch sử đo vào localStorage:", e);
        }
    };

    window.renderSpeedTestHistoryTable = function() {
        const tbody = document.getElementById("speedtest-history-tbody");
        if (!tbody) return;

        try {
            const raw = localStorage.getItem(speedtestState.historyKey);
            const list = raw ? JSON.parse(raw) : [];

            if (list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="loading-row">Chưa có dữ liệu lịch sử đo tốc độ. Hãy bấm "Bắt đầu đo" ở trên.</td></tr>`;
                return;
            }

            tbody.innerHTML = list.map(item => `
                <tr>
                    <td>${escapeHtml(item.time)}</td>
                    <td><span class="oscium-meta-pill">${escapeHtml(item.mode)}</span></td>
                    <td class="font-mono" style="font-weight:700; color:#0284c7;">${escapeHtml(item.download)}</td>
                    <td class="font-mono" style="font-weight:700; color:#059669;">${escapeHtml(item.upload)}</td>
                    <td class="font-mono">${escapeHtml(item.ping)}</td>
                    <td class="font-mono">${escapeHtml(item.jitter)}</td>
                    <td class="font-mono">${escapeHtml(item.link_speed)}</td>
                    <td>
                        <span class="${item.verdict === 'Rất tốt' ? 'badge-status-pass' : (item.verdict === 'Ổn định' ? 'badge-status-neutral' : 'badge-status-warn')}">
                            ${escapeHtml(item.verdict)}
                        </span>
                    </td>
                </tr>
            `).join("");
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="8" class="loading-row">Lỗi đọc lịch sử đo.</td></tr>`;
        }
    };

    window.clearSpeedTestHistory = function() {
        localStorage.removeItem(speedtestState.historyKey);
        window.renderSpeedTestHistoryTable();
    };
    window.addEventListener("resize", () => {
        drawSpectrumGraphs();
    });

    // Initialize Planner Canvas Interaction & Upgrades
    setupPlannerCanvasInteraction();
    window.loadFloorplanPreset("apartment");

    // Initialize AP Inspector & Calibration event listeners
    document.getElementById("planner-floorplan-file")?.addEventListener("change", window.handleFloorplanImageUpload);
    document.getElementById("planner-image-opacity")?.addEventListener("input", (e) => window.setFloorplanImageOpacity(e.target.value));
    document.getElementById("btn-clear-bg-image")?.addEventListener("click", window.clearFloorplanImage);

    // Initialize Speed Test history
    window.renderSpeedTestHistoryTable();


    // Switch between Raytracing Heatmap (NWC_WifiTool) and Ekahau SLA Grid Planner
    window.switchPlannerEngine = function(mode) {
        const btnRay = document.getElementById("btn-switch-hm-raytracing");
        const btnEka = document.getElementById("btn-switch-hm-ekahau");
        const viewRay = document.getElementById("view-heatmap");
        const viewEka = document.getElementById("view-ekahau-planner");

        if (mode === "ekahau") {
            if (btnRay) btnRay.classList.remove("active");
            if (btnEka) btnEka.classList.add("active");
            if (viewRay) viewRay.classList.add("hidden");
            if (viewEka) viewEka.classList.remove("hidden");
            if (window.drawFloorplanHeatmap) window.drawFloorplanHeatmap();
        } else {
            if (btnEka) btnEka.classList.remove("active");
            if (btnRay) btnRay.classList.add("active");
            if (viewEka) viewEka.classList.add("hidden");
            if (viewRay) viewRay.classList.remove("hidden");
            if (window.refreshInvasionoHeatmap) window.refreshInvasionoHeatmap();
        }
    };

    // Initialize Current Language
    setLanguage(state.currentLang);

    // Initial instant fetch to populate UI immediately on page load
    try {
        fetchScanData(false);
    } catch (e) {
        console.error("fetchScanData initial error:", e);
    }

    // Start live WebSocket stream
    try {
        setupContinuousEngine();
    } catch (e) {
        console.error("setupContinuousEngine initial error:", e);
    }
});
