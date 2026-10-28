import subprocess
import time
import math
import platform
import re
import socket
from typing import Dict, Any, List, Optional


def _detect_default_gateway() -> str:
    """Detect local default gateway IPv4 address on Windows/Linux/macOS with fallback"""
    is_windows = platform.system().lower() == "windows"
    try:
        if is_windows:
            res = subprocess.run(
                ["ipconfig"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=1.5
            )
            matches = re.findall(r"Default Gateway[\s\.]+:\s*(\d+\.\d+\.\d+\.\d+)", res.stdout, re.IGNORECASE)
            for ip in matches:
                if ip and ip != "0.0.0.0":
                    return ip
        else:
            res = subprocess.run(
                ["ip", "route"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=1.5
            )
            m = re.search(r"default via (\d+\.\d+\.\d+\.\d+)", res.stdout)
            if m:
                return m.group(1)
    except Exception:
        pass
    return "192.168.1.1"


def measure_dns_resolution_ms(domain: str = "cloudflare.com") -> Dict[str, Any]:
    """Measure DNS lookup latency in milliseconds using OS resolver"""
    t0 = time.time()
    try:
        ip = socket.gethostbyname(domain)
        elapsed_ms = round((time.time() - t0) * 1000.0, 2)
        return {
            "domain": domain,
            "resolved_ip": ip,
            "dns_latency_ms": elapsed_ms,
            "status": "PASS" if elapsed_ms < 80 else "WARNING"
        }
    except Exception:
        return {
            "domain": domain,
            "resolved_ip": None,
            "dns_latency_ms": 999.0,
            "status": "CRITICAL"
        }


def measure_network_quality(target_host: str = "8.8.8.8", ping_count: int = 5) -> Dict[str, Any]:
    """
    Measure real-time RTT latency, Jitter, and Packet Loss using native OS ping.
    """
    rtts: List[float] = []
    lost_packets = 0
    is_windows = platform.system().lower() == "windows"

    cmd = ["ping", "-n" if is_windows else "-c", "1", "-w" if is_windows else "-W", "1000", target_host]

    for _ in range(ping_count):
        t0 = time.time()
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=1.5)
            elapsed_ms = (time.time() - t0) * 1000.0

            if res.returncode == 0:
                match = re.search(r"time[=<](\d+(?:\.\d+)?)ms", res.stdout, re.IGNORECASE)
                if match:
                    rtts.append(float(match.group(1)))
                else:
                    rtts.append(round(elapsed_ms, 2))
            else:
                lost_packets += 1
        except Exception:
            lost_packets += 1
        time.sleep(0.04)

    total_attempts = max(1, ping_count)
    packet_loss_pct = (lost_packets / total_attempts) * 100.0

    if not rtts:
        avg_rtt = 999.0
        jitter = 999.0
        min_rtt = 999.0
        max_rtt = 999.0
    else:
        avg_rtt = round(sum(rtts) / len(rtts), 2)
        min_rtt = round(min(rtts), 2)
        max_rtt = round(max(rtts), 2)

        if len(rtts) > 1:
            diffs = [abs(rtts[i] - rtts[i - 1]) for i in range(1, len(rtts))]
            jitter = round(sum(diffs) / len(diffs), 2)
        else:
            jitter = 0.0

    # Calculate ITU-T G.107 E-Model MOS Score (Mean Opinion Score: 1.0 to 4.5)
    effective_latency = avg_rtt + (jitter * 2.0)

    if effective_latency < 160:
        id_factor = effective_latency / 40.0
    else:
        id_factor = (effective_latency - 120.0) / 10.0

    loss_factor = packet_loss_pct * 2.5

    r_val = 94.2 - id_factor - loss_factor
    r_val = max(0.0, min(100.0, r_val))

    if r_val < 0:
        mos = 1.0
    elif r_val > 100:
        mos = 4.5
    else:
        mos = 1.0 + (0.035 * r_val) + (r_val * (r_val - 60.0) * (100.0 - r_val) * 0.000007)

    mos = round(max(1.0, min(4.5, mos)), 2)

    if mos >= 4.3:
        rating = "Tuyệt vời (Tối ưu)"
        badge_color = "success"
        verdict = "Đường truyền hoàn hảo, cuộc gọi thoại và video trực tuyến rất ổn định, không gián đoạn hoặc mất tiếng."
    elif mos >= 4.0:
        rating = "Tốt"
        badge_color = "success"
        verdict = "Chất lượng thoại rõ ràng, ổn định, độ trễ thấp phù hợp hội họp và đàm thoại công việc."
    elif mos >= 3.6:
        rating = "Khá (Trung bình)"
        badge_color = "warning"
        verdict = "Có thể gặp hiện tượng giật tiếng hoặc ngắt quãng ngắn khi di chuyển giữa các phòng."
    elif mos >= 3.0:
        rating = "Kém"
        badge_color = "danger"
        verdict = "Độ trễ cao hoặc mất gói tin. Cuộc gọi thoại có thể bị rè tiếng, méo giọng hoặc trễ tiếng."
    else:
        rating = "Rất kém"
        badge_color = "danger"
        verdict = "Nghẽn mạng nghiêm trọng, nguy cơ gián đoạn cuộc gọi hoặc không thể thiết lập cuộc đàm thoại."

    dns_check = measure_dns_resolution_ms("cloudflare.com")
    gateway_ip = _detect_default_gateway()
    gw_hop = measure_single_hop_fast(gateway_ip)

    if gw_hop["latency_ms"] >= 25.0:
        bottleneck_vi = f"Độ trễ từ máy tới bộ định tuyến Router ({gateway_ip}) cao ({gw_hop['latency_ms']} ms), nguyên nhân do suy hao hoặc nhiễu sóng Wi-Fi nội bộ."
    elif avg_rtt >= 100.0:
        bottleneck_vi = f"Kết nối tới bộ định tuyến nội bộ tốt ({gw_hop['latency_ms']} ms) nhưng ra Internet chậm ({avg_rtt} ms), nguyên nhân do đường truyền internet của nhà mạng ISP."
    else:
        bottleneck_vi = f"Toàn bộ các chặng kết nối (Bộ định tuyến nội bộ {gw_hop['latency_ms']} ms, Cổng Internet {avg_rtt} ms, Máy chủ tên miền DNS {dns_check['dns_latency_ms']} ms) đều thông suốt và ổn định."

    return {
        "target": target_host,
        "packets_sent": total_attempts,
        "packets_received": len(rtts),
        "packet_loss_pct": round(packet_loss_pct, 1),
        "latency_avg_ms": avg_rtt,
        "latency_min_ms": min_rtt,
        "latency_max_ms": max_rtt,
        "jitter_ms": jitter,
        "itu_r_factor": round(r_val, 1),
        "mos_score": mos,
        "rating": rating,
        "badge_color": badge_color,
        "verdict": verdict,
        "gateway_ip": gateway_ip,
        "gateway_latency_ms": gw_hop["latency_ms"],
        "dns_latency_ms": dns_check["dns_latency_ms"],
        "path_diagnosis_vi": bottleneck_vi,
        "supported_codecs": [
            {"codec": "Opus (Âm thanh độ nét cao HD)", "status": "Khuyên dùng" if mos >= 4.0 else "Cần giảm băng thông"},
            {"codec": "G.711 (Chất lượng chuẩn 64kbps)", "status": "Tốt" if packet_loss_pct < 2 else "Mất gói tin"},
            {"codec": "G.729 (Băng thông thấp 8kbps)", "status": "Phù hợp khi mạng yếu"}
        ]
    }


def measure_single_hop_fast(host: str) -> Dict[str, Any]:
    """Single fast 1-packet ping for local gateway hop verification"""
    is_windows = platform.system().lower() == "windows"
    cmd = ["ping", "-n" if is_windows else "-c", "1", "-w" if is_windows else "-W", "600", host]
    t0 = time.time()
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=0.9)
        elapsed_ms = (time.time() - t0) * 1000.0
        if res.returncode == 0:
            match = re.search(r"time[=<](\d+(?:\.\d+)?)ms", res.stdout, re.IGNORECASE)
            lat = float(match.group(1)) if match else round(elapsed_ms, 2)
            return {"host": host, "reachable": True, "latency_ms": lat}
    except Exception:
        pass
    return {"host": host, "reachable": False, "latency_ms": 0.0}


if __name__ == "__main__":
    result = measure_network_quality("8.8.8.8", 3)
    print("VoWiFi MOS Test Result:")
    print("MOS Score:", result['mos_score'], "/ 4.5")
    print(f"RTT: {result['latency_avg_ms']} ms | Jitter: {result['jitter_ms']} ms | Loss: {result['packet_loss_pct']}%")
