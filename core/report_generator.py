import os
import csv
import json
import re
from datetime import datetime
from typing import List, Dict, Any, Optional

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


def evaluate_signal_level(dbm: Any) -> str:
    """Classify RSSI signal strength into practical real-world status"""
    if dbm is None:
        return "Rất yếu (dưới -80 dBm: Dễ ngắt kết nối, mất gói tin)"
    try:
        val = float(dbm)
    except (ValueError, TypeError):
        return "Rất yếu (dưới -80 dBm: Dễ ngắt kết nối, mất gói tin)"

    if val >= -60:
        return "Rất mạnh (-30 đến -60 dBm: Tối ưu cho mọi dịch vụ trực tuyến)"
    elif val >= -70:
        return "Tốt (-61 đến -70 dBm: Ổn định cho duyệt web và hội họp)"
    elif val >= -80:
        return "Yếu (-71 đến -80 dBm: Tín hiệu chập chờn, giảm tốc độ)"
    else:
        return "Rất yếu (dưới -80 dBm: Dễ ngắt kết nối, mất gói tin)"


def generate_csv_report(networks: List[Dict[str, Any]], analysis: Dict[str, Any], filepath: str) -> str:
    """
    Generate CSV Site Survey Report in pure Vietnamese format.
    Uses UTF-8 BOM encoding for direct display in Microsoft Excel.
    """
    analysis = analysis or {}
    networks = networks or []

    ev_24 = analysis.get("evaluation_24ghz") or {}
    ev_5 = analysis.get("evaluation_5ghz") or {}
    sec = analysis.get("security_audit") or {}
    open_nets = sec.get("open_unsecured") or []

    raw_g_score = analysis.get("global_score")
    g_score = int(raw_g_score) if raw_g_score is not None else 0
    health_desc = (
        "Tốt: Môi trường sóng sạch, ít can nhiễu" if g_score >= 80
        else ("Khá: Xuất hiện một số kênh trùng lấn" if g_score >= 60 else "Kém: Môi trường can nhiễu cao, cần tối ưu kênh phát")
    )

    best_24 = ev_24.get("recommended_channel") if ev_24.get("recommended_channel") is not None else 1
    best_5 = ev_5.get("recommended_channel") if ev_5.get("recommended_channel") is not None else 36
    best_block = ev_5.get("recommended_80mhz_block") or "UNII-1 (36-48)"
    score_24 = ev_24.get('recommended_score') if ev_24.get('recommended_score') is not None else 0
    reason_24 = ev_24.get("recommendation_reason") or ""
    score_5 = ev_5.get('recommended_score') if ev_5.get('recommended_score') is not None else 0
    reason_5 = ev_5.get("recommendation_reason") or ""

    with open(filepath, mode="w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)

        filename_base = os.path.basename(filepath)
        writer.writerow(["=========================================================================================="])
        writer.writerow(["# BÁO CÁO KỸ THUẬT KHẢO SÁT VÀ TỐI ƯU HÓA MẠNG KHÔNG DÂY"])
        writer.writerow(["=========================================================================================="])
        writer.writerow(["Tên tệp báo cáo", filename_base])
        writer.writerow(["Thời gian khảo sát", datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
        writer.writerow(["Điểm chất lượng môi trường sóng", f"{g_score} / 100 ({health_desc})"])
        avg_snr = analysis.get('avg_snr_db') if analysis.get('avg_snr_db') is not None else 0
        writer.writerow(["Tỷ số tín hiệu trên nhiễu trung bình (SNR)", f"{avg_snr} dB"])
        writer.writerow(["Tổng số trạm phát phát hiện", len(networks)])
        unique_ssids = analysis.get("unique_ssids") if analysis.get("unique_ssids") is not None else 0
        writer.writerow(["Tổng số tên mạng riêng biệt (SSID)", unique_ssids])
        writer.writerow([])

        writer.writerow(["[1. KẾT QUẢ KHUYẾN NGHỊ KÊNH PHÁT SÓNG]"])
        writer.writerow(["Băng tần", "Kênh phát tối ưu", "Điểm đánh giá chất lượng", "Độ rộng kênh", "Lý do kỹ thuật và căn cứ đề xuất"])
        writer.writerow([
            "2.4 GHz ISM",
            f"Kênh {best_24}",
            f"{score_24}/100",
            "20 MHz (Cố định độ rộng 20 MHz nhằm tránh nhiễu lấn kênh kề ACI)",
            reason_24
        ])
        writer.writerow([
            "5 GHz UNII",
            f"Kênh {best_5}",
            f"{score_5}/100",
            f"80 MHz (Khối dải tần {best_block})",
            reason_5
        ])
        writer.writerow([])

        writer.writerow(["[2. HƯỚNG DẪN CẤU HÌNH BỘ ĐỊNH TUYẾN NHANH]"])
        writer.writerow(["Bước 1: Truy cập trang quản trị", "Mở trình duyệt web và nhập địa chỉ mạng của bộ định tuyến: 192.168.1.1 hoặc 192.168.0.1 (xem tem dưới đáy thiết bị)"])
        writer.writerow(["Bước 2: Đăng nhập quản trị", "Đăng nhập bằng tài khoản và mật khẩu in trên tem nhãn của thiết bị"])
        writer.writerow(["Bước 3: Cài đặt băng tần 2.4 GHz", f"Thiết lập kênh phát thành Kênh {best_24}, độ rộng kênh đặt cố định 20 MHz (không chọn 40 MHz)"])
        writer.writerow(["Bước 4: Cài đặt băng tần 5 GHz", f"Thiết lập kênh phát thành Kênh {best_5}, độ rộng kênh 80 MHz (Khối {best_block})"])
        writer.writerow([])

        writer.writerow(["[3. KIỂM TRA AN TOÀN BẢO MẬT VÀ HƯỚNG DẪN XỬ LÝ]"])
        if open_nets:
            writer.writerow([f"CẢNH BÁO NGUY HIỂM: Phát hiện {len(open_nets)} mạng không đặt mật khẩu bảo vệ (mạng mở không mã hóa)"])
            writer.writerow(["Tên mạng (SSID)", "Địa chỉ vật lý (MAC)", "Kênh phát", "Nguyên nhân", "Rủi ro thực tế", "Biện pháp khắc phục"])
            for o in open_nets:
                if not isinstance(o, dict):
                    continue
                ch_str = f"Kênh {o.get('channel')}" if o.get('channel') is not None else "Kênh N/A"
                writer.writerow([
                    o.get("ssid") if o.get("ssid") is not None else "[Mạng ẩn]",
                    o.get("bssid") or "",
                    ch_str,
                    "Bộ định tuyến không bật xác thực mật khẩu (Không có mã hóa)",
                    "1. Nguy cơ bị thu thập gói tin trái phép làm lộ thông tin truyền tải. 2. Nguy cơ bị kẻ xấu giả mạo điểm phát sóng cùng tên. 3. Bị thiết bị lạ dùng chung gây nghẽn băng thông.",
                    "1. Truy cập bộ định tuyến chuyển sang chuẩn WPA2-PSK (AES) hoặc WPA3-Personal. 2. Thiết lập mật khẩu từ 12 ký tự trở lên. 3. Nếu dùng mạng khách, kích hoạt tính năng cách ly thiết bị kết nối (Client Isolation)."
                ])
        else:
            writer.writerow(["TRẠNG THÁI AN TOÀN: 100% các mạng phát hiện đều đã kích hoạt mã hóa bảo mật (WPA2, WPA3 hoặc mạng doanh nghiệp)."])
        writer.writerow([])

        writer.writerow(["[4. THỐNG KÊ CHI TIẾT 3 KÊNH TIÊU CHUẨN 2.4 GHz (1, 6, 11)]"])
        writer.writerow(["Kênh phát", "Số trạm dùng chung kênh (CCI)", "Số trạm kênh kề chồng lấn (ACI)", "Điểm chất lượng (thang điểm 100)", "Nhận xét đánh giá"])
        ch_24_evals = ev_24.get("channel_evaluations") or {}
        for ch in (1, 6, 11):
            if ch in ch_24_evals:
                ev = ch_24_evals[ch] or {}
                same_cnt = len(ev.get("same_channel_aps") or [])
                adj_cnt = len(ev.get("overlapping_aps") or [])
                score = ev.get("health_score") if ev.get("health_score") is not None else 0
                writer.writerow([
                    f"Kênh {ch}",
                    f"{same_cnt} trạm phát",
                    f"{adj_cnt} trạm phát lân cận",
                    f"{score} / 100",
                    "Kênh tiêu chuẩn độc lập 20 MHz (ít can nhiễu hơn các kênh lệch 2, 3, 4, 7, 8, 9, 10)"
                ])
        writer.writerow([])

        writer.writerow(["[5. TIÊU CHUẨN CHẤT LƯỢNG CUỘC GỌI THOẠI VÀ HỘP TRỰC TUYẾN THEO CHUẨN ITU-T]"])
        writer.writerow(["Chỉ số đo kiểm", "Ngưỡng đạt tiêu chuẩn", "Tác động thực tế đến người dùng", "Khuyến nghị kỹ thuật"])
        writer.writerow(["Điểm đánh giá chất lượng thoại MOS", "Từ 4.0 đến 4.5", "Chất lượng âm thanh rõ nét, không ngắt quãng khi thực hiện cuộc gọi", "Nếu điểm MOS dưới 3.8, cần kiểm tra độ trễ mạng và tỷ lệ mất gói tin"])
        writer.writerow(["Độ trễ truyền khứ hồi (RTT)", "Dưới 100 ms", "Thời gian truyền tín hiệu âm thanh giữa hai đầu kết nối", "Nếu trên 150 ms sẽ phát sinh độ trễ giọng nói giữa người gọi và người nghe"])
        writer.writerow(["Độ biến thiên trễ (Jitter)", "Dưới 20 ms", "Mức độ ổn định thời gian truyền giữa các gói dữ liệu âm thanh", "Nếu biến thiên trễ trên 30 ms âm thanh sẽ bị méo tiếng hoặc giật cục"])
        writer.writerow(["Tỷ lệ mất gói tin (Packet Loss)", "Dưới 1.0 %", "Tỷ lệ phần trăm gói tin thoại bị thất lạc trên đường truyền", "Nếu mất gói trên 2% âm thanh sẽ bị mất từ hoặc ngắt câu thoại"])
        writer.writerow([])

        writer.writerow(["[6. BẢNG DANH MỤC CHI TIẾT CÁC MẠNG THU NHẬN ĐƯỢC]"])
        writer.writerow([
            "Số thứ tự",
            "Tên mạng (SSID)",
            "Địa chỉ vật lý (MAC)",
            "Mức tín hiệu (dBm)",
            "Chất lượng sóng (%)",
            "Tỷ số tín hiệu trên nhiễu (SNR dB)",
            "Chỉ số điều chế (MCS)",
            "Tốc độ truyền ước tính (Mbps)",
            "Đánh giá chất lượng sóng",
            "Kênh phát",
            "Băng tần",
            "Tần số hoạt động (MHz)",
            "Thế hệ mạng",
            "Chuẩn kỹ thuật",
            "Phương thức xác thực",
            "Chuẩn mã hóa",
            "Mức độ an toàn bảo mật",
            "Hãng sản xuất",
            "Mức chiếm dụng thời lượng sóng (%)",
            "Số thiết bị đang kết nối",
            "Trạng thái kết nối máy tính"
        ])

        for idx, n in enumerate(networks, start=1):
            if not isinstance(n, dict):
                continue
            raw_dbm = n.get("signal_dbm")
            try:
                dbm = int(raw_dbm) if raw_dbm is not None else -100
            except (ValueError, TypeError):
                dbm = -100

            auth_str = str(n.get("authentication") or "")
            cipher_str = str(n.get("encryption") or "")

            if "open" in auth_str.lower() or "none" in cipher_str.lower():
                sec_level = "Nguy hiểm (Mạng mở không mã hóa)"
            elif "wpa3" in auth_str.lower():
                sec_level = "Rất an toàn (Chuẩn WPA3)"
            elif "enterprise" in auth_str.lower():
                sec_level = "Rất an toàn (Mạng doanh nghiệp 802.1X)"
            elif "wpa2" in auth_str.lower():
                sec_level = "An toàn tiêu chuẩn (Chuẩn WPA2-AES)"
            else:
                sec_level = "Kém an toàn (Chuẩn cũ WPA hoặc WEP)"

            sig_pct = n.get('signal_percent') if n.get('signal_percent') is not None else 0
            snr = n.get('snr_db') if n.get('snr_db') is not None else 0
            mcs = n.get('mcs_index') if n.get('mcs_index') is not None else 0
            mod = n.get('modulation') or ''
            throughput = n.get('est_throughput_mbps') if n.get('est_throughput_mbps') is not None else 0
            ch_val = f"Kênh {n.get('channel')}" if n.get('channel') is not None else "Kênh N/A"
            freq_val = f"{n.get('frequency_mhz')} MHz" if n.get('frequency_mhz') is not None else "N/A"
            util_val = f"{n.get('channel_utilization_pct')}%" if n.get('channel_utilization_pct') is not None else "N/A"
            stations = n.get("connected_stations") if n.get("connected_stations") is not None else 0
            conn_status = "Đang kết nối" if n.get("is_connected") else "Không kết nối"

            writer.writerow([
                idx,
                n.get("ssid") if n.get("ssid") is not None else "[Mạng ẩn]",
                n.get("bssid") or "",
                f"{dbm} dBm",
                f"{sig_pct}%",
                f"{snr} dB",
                f"MCS {mcs} ({mod})",
                f"{throughput} Mbps",
                evaluate_signal_level(dbm),
                ch_val,
                n.get("band") or "",
                freq_val,
                n.get("wifi_generation") or "",
                n.get("radio_type") or "",
                auth_str,
                cipher_str,
                sec_level,
                n.get("vendor") or "",
                util_val,
                stations,
                conn_status
            ])

    return filepath


def generate_json_report(networks: List[Dict[str, Any]], analysis: Dict[str, Any], filepath: str) -> str:
    """Export complete scan data as JSON"""
    payload = {
        "metadata": {
            "application": "Hệ thống Phân tích Mạng Wi-Fi",
            "version": "3.0.0",
            "scan_timestamp": datetime.now().isoformat(),
            "networks_discovered": len(networks) if networks is not None else 0
        },
        "analysis": analysis if analysis is not None else {},
        "networks": networks if networks is not None else []
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
    fmt = (format_type or "csv").strip().lower()

    if fmt == "json":
        filename = get_next_report_filename(output_dir, extension="json")
        path = os.path.join(output_dir, filename)
        return generate_json_report(networks, analysis, path)
    else:
        filename = get_next_report_filename(output_dir, extension="csv")
        path = os.path.join(output_dir, filename)
        return generate_csv_report(networks, analysis, path)
