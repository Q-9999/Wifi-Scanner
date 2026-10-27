import os
import csv
import json
import re
from datetime import datetime
from typing import List, Dict, Any

def get_next_report_filename(output_dir: str, extension: str = "csv") -> str:
    """
    Generate sequential report filename in format:
    NetScanner_Report_[MM-DD-YYYY]_[ID-01].ext
    Auto-increments ID-01, ID-02, ID-03 for the current date.
    """
    os.makedirs(output_dir, exist_ok=True)
    now = datetime.now()
    date_str = now.strftime("%m-%d-%Y")
    prefix = f"NetScanner_Report_{date_str}_ID-"

    existing_ids = []
    try:
        for fname in os.listdir(output_dir):
            if fname.startswith(prefix) and fname.endswith(f".{extension}"):
                match = re.search(r"_ID-(\d+)\." + re.escape(extension) + r"$", fname)
                if match:
                    existing_ids.append(int(match.group(1)))
    except Exception:
        pass

    next_id = max(existing_ids) + 1 if existing_ids else 1
    return f"NetScanner_Report_{date_str}_ID-{next_id:02d}.{extension}"


def evaluate_signal_level(dbm: int) -> str:
    """Classify RSSI signal strength into practical real-world status"""
    if dbm >= -60:
        return "Rất mạnh / Excellent (-30 to -60 dBm: Game, 4K, Live)"
    elif dbm >= -70:
        return "Tốt / Good (-61 to -70 dBm: Web, Zoom, Teams)"
    elif dbm >= -80:
        return "Yếu / Fair (-71 to -80 dBm: Chập chờn, giảm tốc độ)"
    else:
        return "Rất yếu / Poor (< -80 dBm: Dễ rớt mạng, mất gói)"


def generate_csv_report(networks: List[Dict[str, Any]], analysis: Dict[str, Any], filepath: str) -> str:
    """
    Generate Bilingual CSV Site Survey Report in MMQ./NetScanner Basic-Meaning format.
    Uses UTF-8 BOM encoding for direct display in Microsoft Excel.
    """
    ev_24 = analysis.get("evaluation_24ghz", {})
    ev_5 = analysis.get("evaluation_5ghz", {})
    sec = analysis.get("security_audit", {})
    open_nets = sec.get("open_unsecured", [])

    g_score = analysis.get("global_score", 0)
    health_desc = (
        "Tốt - Môi trường sóng sạch, ít nhiễu" if g_score >= 80
        else ("Khá - Có một số kênh trùng lấn" if g_score >= 60 else "Kém - Môi trường nhiễu nhiều, cần đổi kênh")
    )

    best_24 = ev_24.get("recommended_channel", 1)
    best_5 = ev_5.get("recommended_channel", 36)
    best_block = ev_5.get("recommended_80mhz_block", "UNII-1 (36-48)")

    with open(filepath, mode="w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)

        filename_base = os.path.basename(filepath)
        writer.writerow(["=========================================================================================="])
        writer.writerow(["# MMQ./NetScanner - BÁO CÁO KHẢO SÁT & TỐI ƯU HÓA SÓNG WI-FI / WI-FI SITE SURVEY REPORT"])
        writer.writerow(["=========================================================================================="])
        writer.writerow(["Tên File Báo Cáo / Report Filename", filename_base])
        writer.writerow(["Thời Gian Khảo Sát / Survey Time", datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
        writer.writerow(["Điểm Chất Lượng Môi Trường Sóng / Environment Score", f"{g_score} / 100 ({health_desc})"])
        writer.writerow(["Tỷ Số Tín Hiệu Trên Nhiễu Trung Bình / Average SNR", f"{analysis.get('avg_snr_db', 0)} dB"])
        writer.writerow(["Tổng Số Bộ Phát BSSID / Total Access Points Detected", len(networks)])
        writer.writerow(["Tổng Số Tên Mạng Riêng / Unique SSIDs", analysis.get("unique_ssids", 0)])
        writer.writerow([])

        writer.writerow(["[1. KẾT QUẢ GỢI Ý KÊNH PHÁT SÓNG / CHANNEL RECOMMENDATIONS]"])
        writer.writerow(["Băng Tần / Band", "Kênh Khuyên Dùng / Best Channel", "Điểm Đánh Giá / Score", "Độ Rộng Kênh / Width", "Lý Do Kỹ Thuật Thực Tế / Engineering Rationale"])
        writer.writerow([
            "2.4 GHz ISM",
            f"Kênh / Channel {best_24}",
            f"{ev_24.get('recommended_score')}/100",
            "20 MHz (Cố định 20MHz để tránh nhiễu lấn kênh ACI)",
            ev_24.get("recommendation_reason", "")
        ])
        writer.writerow([
            "5 GHz UNII",
            f"Kênh / Channel {best_5}",
            f"{ev_5.get('recommended_score')}/100",
            f"80 MHz Bonding: {best_block}",
            ev_5.get("recommendation_reason", "")
        ])
        writer.writerow([])

        writer.writerow(["[2. HƯỚNG DẪN CẤU HÌNH ROUTER NHANH / QUICK ROUTER CONFIGURATION GUIDE]"])
        writer.writerow(["Bước 1: Truy cập trang quản trị", "Mở trình duyệt nhập địa chỉ IP Router: 192.168.1.1 hoặc 192.168.0.1 (xem tem dưới đáy modem)"])
        writer.writerow(["Bước 2: Đăng nhập quản trị", "Tài khoản và mật khẩu thường là admin/admin hoặc xem mật khẩu in dưới đáy router"])
        writer.writerow(["Bước 3: Cài đặt băng tần 2.4 GHz", f"Đặt Channel thành Kênh {best_24}, Channel Width (Độ rộng kênh) đặt cố định 20 MHz (Không chọn 40MHz)"])
        writer.writerow(["Bước 4: Cài đặt băng tần 5 GHz", f"Đặt Channel thành Kênh {best_5}, Channel Width đặt 80 MHz (Khối {best_block})"])
        writer.writerow([])

        writer.writerow(["[3. KIỂM TRA AN TOÀN BẢO MẬT & HƯỚNG DẪN KHẮC PHỤC / SECURITY AUDIT & FIX GUIDE]"])
        if open_nets:
            writer.writerow([f"CẢNH BÁO NGUY HIỂM / CRITICAL WARNING: Phát hiện {len(open_nets)} mạng Wi-Fi không đặt mật khẩu (Open / Unencrypted)!"])
            writer.writerow(["Tên Mạng (SSID)", "Địa Chỉ MAC (BSSID)", "Kênh (Channel)", "Nguyên Nhân", "Rủi Ro Thực Tế", "Cách Khắc Phục"])
            for o in open_nets:
                writer.writerow([
                    o.get("ssid"),
                    o.get("bssid"),
                    f"Kênh {o.get('channel')}",
                    "Router không bật xác thực mật khẩu (Mã hóa: None)",
                    "1. Bị nghe lén dữ liệu (Packet Sniffing) lộ thông tin truyền tải. 2. Bị kẻ xấu dựng bộ phát giả mạo trùng tên (Evil Twin). 3. Bị người lạ dùng chung làm nghẽn băng thông.",
                    "1. Vào Router (192.168.1.1) đổi chế độ sang WPA2-PSK (AES) hoặc WPA3-Personal. 2. Đặt mật khẩu từ 12 ký tự trở lên. 3. Nếu là mạng khách quán cafe: Bật tính năng AP Isolation / Client Isolation để cách ly các thiết bị."
                ])
        else:
            writer.writerow(["TRẠNG THÁI AN TOÀN: 100% các mạng xung quanh đều bật mã hóa bảo mật (WPA2, WPA3 hoặc Enterprise)."])
        writer.writerow([])

        writer.writerow(["[4. THỐNG KÊ CHI TIẾT 3 KÊNH CHUẨN 2.4 GHz / STANDARD NON-OVERLAPPING CHANNELS (1, 6, 11)]"])
        writer.writerow(["Kênh / Channel", "Số AP Dùng Chung Kênh (CCI)", "Số AP Kênh Kề Chồng Lấn (ACI)", "Điểm Chất Lượng (0-100)", "Nhận Xét Đánh Giá"])
        ch_24_evals = ev_24.get("channel_evaluations", {})
        for ch in (1, 6, 11):
            if ch in ch_24_evals:
                ev = ch_24_evals[ch]
                same_cnt = len(ev.get("same_channel_aps", []))
                adj_cnt = len(ev.get("overlapping_aps", []))
                score = ev.get("health_score", 0)
                writer.writerow([
                    f"Kênh {ch}",
                    f"{same_cnt} bộ phát (AP)",
                    f"{adj_cnt} bộ phát lân cận",
                    f"{score} / 100",
                    "Kênh chuẩn độc lập 20MHz (Ít nhiễu hơn các kênh lệch 2, 3, 4, 7, 8, 9, 10)"
                ])
        writer.writerow([])

        writer.writerow(["[5. TIÊU CHUẨN CHẤT LƯỢNG THOẠI VoWiFi & HỌP TRỰC TUYẾN / VOWIFI ITU-T QUALITY STANDARDS]"])
        writer.writerow(["Chỉ Số / Metric", "Ngưỡng Đạt Chuẩn (Target)", "Tác Động Thực Tế (Real-World Impact)", "Khuyến Nghị Kỹ Thuật"])
        writer.writerow(["Điểm MOS (Mean Opinion Score)", ">= 4.0 / 4.5", "Chất lượng thoại rõ nét, không ngắt quãng khi gọi Teams/Zoom/Zalo", "Nếu MOS < 3.8, kiểm tra ngay độ trễ và tỷ lệ rớt gói"])
        writer.writerow(["Độ Trễ Khứ Hồi (RTT Latency)", "< 100 ms", "Độ trễ truyền âm thanh giữa 2 đầu cuộc gọi", "Nếu > 150ms sẽ xảy ra hiện tượng trễ tiếng giữa 2 người nói"])
        writer.writerow(["Độ Biến Thiên Trễ (Jitter)", "< 20 ms", "Độ ổn định của luồng gói tin âm thanh", "Nếu Jitter > 30ms âm thanh sẽ bị méo hoặc ngắt quãng"])
        writer.writerow(["Tỷ Lệ Rớt Gói (Packet Loss)", "< 1.0 %", "Tỷ lệ gói tin thoại bị thất thoát khi truyền", "Nếu > 2% sẽ bị mất từ, đứt câu nói"])
        writer.writerow([])

        writer.writerow(["[6. BẢNG KÊ CHI TIẾT DANH SÁCH MẠNG QUÉT ĐƯỢC / DETAILED WI-FI INVENTORY]"])
        writer.writerow([
            "STT / No.",
            "Tên Mạng / SSID",
            "Địa Chỉ MAC / BSSID",
            "Cường Độ Sóng / Signal (dBm)",
            "Chất Lượng / Link (%)",
            "Tỷ Số Sóng/Nhiễu / SNR (dB)",
            "Chỉ Số Điều Chế / MCS Index",
            "Tốc Độ Thực Tế Ước Tính / Est. Throughput (Mbps)",
            "Đánh Giá Sóng / Signal Rating",
            "Kênh / Channel",
            "Băng Tần / Band",
            "Tần Số / Frequency (MHz)",
            "Thế Hệ Wi-Fi / Generation",
            "Chuẩn Kỹ Thuật / Radio Type",
            "Xác Thực / Authentication",
            "Mã Hóa / Encryption",
            "Độ An Toàn / Security Level",
            "Nhà Sản Xuất / Vendor",
            "Tải Kênh / Airtime Load (%)",
            "Thiết Bị Đang Bắt / Client Count",
            "Trạng Thái Kết Nối / Active Link"
        ])

        for idx, n in enumerate(networks, start=1):
            dbm = n.get("signal_dbm", -100)
            auth_str = str(n.get("authentication", ""))
            cipher_str = str(n.get("encryption", ""))

            if "open" in auth_str.lower() or "none" in cipher_str.lower():
                sec_level = "NGUY HIỂM (Open - Không mã hóa)"
            elif "wpa3" in auth_str.lower():
                sec_level = "Rất an toàn (WPA3 đời mới)"
            elif "enterprise" in auth_str.lower():
                sec_level = "Rất an toàn (Doanh nghiệp 802.1X)"
            elif "wpa2" in auth_str.lower():
                sec_level = "An toàn tiêu chuẩn (WPA2-AES)"
            else:
                sec_level = "Trung bình (Chuẩn cũ WPA/WEP)"

            writer.writerow([
                idx,
                n.get("ssid", "[Hidden Network]"),
                n.get("bssid", ""),
                f"{dbm} dBm",
                f"{n.get('signal_percent', 0)}%",
                f"{n.get('snr_db', 0)} dB",
                f"MCS {n.get('mcs_index', 0)} ({n.get('modulation', '')})",
                f"{n.get('est_throughput_mbps', 0)} Mbps",
                evaluate_signal_level(dbm),
                f"Kênh {n.get('channel', '')}",
                n.get("band", ""),
                f"{n.get('frequency_mhz', '')} MHz",
                n.get("wifi_generation", ""),
                n.get("radio_type", ""),
                n.get("authentication", ""),
                n.get("encryption", ""),
                sec_level,
                n.get("vendor", ""),
                f"{n.get('channel_utilization_pct')}%" if n.get("channel_utilization_pct") is not None else "N/A",
                n.get("connected_stations", 0),
                "ĐANG KẾT NỐI (Active)" if n.get("is_connected") else "Không"
            ])

    return filepath


def generate_json_report(networks: List[Dict[str, Any]], analysis: Dict[str, Any], filepath: str) -> str:
    """Export complete scan data as JSON"""
    payload = {
        "metadata": {
            "application": "MMQ./NetScanner Localhost Edition",
            "version": "3.0.0-Bilingual",
            "scan_timestamp": datetime.now().isoformat(),
            "networks_discovered": len(networks)
        },
        "analysis": analysis,
        "networks": networks
    }
    with open(filepath, mode="w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    return filepath


def export_report(format_type: str, networks: List[Dict[str, Any]], analysis: Dict[str, Any], output_dir: str = ".") -> str:
    """
    Unified entrypoint to export reports in format:
    NetScanner_Report_[MM-DD-YYYY]_[ID-01].csv
    """
    os.makedirs(output_dir, exist_ok=True)
    fmt = format_type.strip().lower()

    if fmt == "json":
        filename = get_next_report_filename(output_dir, extension="json")
        path = os.path.join(output_dir, filename)
        return generate_json_report(networks, analysis, path)
    else:
        filename = get_next_report_filename(output_dir, extension="csv")
        path = os.path.join(output_dir, filename)
        return generate_csv_report(networks, analysis, path)
