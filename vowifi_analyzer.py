import subprocess
import time
import math
import platform
import re
from typing import Dict, Any, List

def measure_network_quality(target_host: str = "8.8.8.8", ping_count: int = 5) -> Dict[str, Any]:
    """
    Measure real-time RTT latency, Jitter, and Packet Loss using native OS ping.
    Zero external dependencies, minimal CPU/memory footprint.
    """
    rtts: List[float] = []
    lost_packets = 0
    is_windows = platform.system().lower() == "windows"

    # Ping command: Windows uses -n, Unix uses -c; timeout 1000ms
    cmd = ["ping", "-n" if is_windows else "-c", "1", "-w" if is_windows else "-W", "1000", target_host]

    for _ in range(ping_count):
        t0 = time.time()
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=1.5)
            elapsed_ms = (time.time() - t0) * 1000.0

            if res.returncode == 0:
                # Parse output time=XXms
                match = re.search(r"time[=<](\d+(?:\.\d+)?)ms", res.stdout, re.IGNORECASE)
                if match:
                    rtts.append(float(match.group(1)))
                else:
                    rtts.append(round(elapsed_ms, 2))
            else:
                lost_packets += 1
        except Exception:
            lost_packets += 1
        time.sleep(0.05)

    total_attempts = ping_count
    packet_loss_pct = (lost_packets / total_attempts) * 100.0

    if not rtts:
        # Complete packet loss
        avg_rtt = 999.0
        jitter = 999.0
        min_rtt = 999.0
        max_rtt = 999.0
    else:
        avg_rtt = round(sum(rtts) / len(rtts), 2)
        min_rtt = round(min(rtts), 2)
        max_rtt = round(max(rtts), 2)
        
        # Calculate RFC 3550 style jitter (Mean absolute difference between consecutive packets)
        if len(rtts) > 1:
            diffs = [abs(rtts[i] - rtts[i - 1]) for i in range(1, len(rtts))]
            jitter = round(sum(diffs) / len(diffs), 2)
        else:
            jitter = 0.0

    # Calculate ITU-T G.107 E-Model MOS Score (Mean Opinion Score: 1.0 to 4.5)
    # Effective latency including buffer jitter
    effective_latency = avg_rtt + (jitter * 2.0)
    
    # Delay impairment factor (Id)
    if effective_latency < 160:
        id_factor = effective_latency / 40.0
    else:
        id_factor = (effective_latency - 120.0) / 10.0

    # Equipment / Packet loss impairment factor (Ie)
    # Burst loss model for typical G.711 / Opus voice codecs
    loss_factor = packet_loss_pct * 2.5

    # Transmission Rating Factor R (Base 94.2 for pristine VoIP audio)
    r_val = 94.2 - id_factor - loss_factor
    r_val = max(0.0, min(100.0, r_val))

    # Convert R to MOS (1.0 to 4.5 scale)
    if r_val < 0:
        mos = 1.0
    elif r_val > 100:
        mos = 4.5
    else:
        mos = 1.0 + (0.035 * r_val) + (r_val * (r_val - 60.0) * (100.0 - r_val) * 0.000007)
    
    mos = round(max(1.0, min(4.5, mos)), 2)

    # Classify User Experience
    if mos >= 4.3:
        rating = "Tuyệt Vời / Excellent (Pristine)"
        badge_color = "success"
        verdict = "Đường truyền hoàn hảo! Cuộc gọi Zalo, Teams, Zoom, VoIP không hề giật lag hay mất tiếng."
    elif mos >= 4.0:
        rating = "Tốt / Good"
        badge_color = "success"
        verdict = "Chất lượng thoại rõ ràng, ổn định, độ trễ thấp phù hợp đàm thoại công việc."
    elif mos >= 3.6:
        rating = "Khá / Fair"
        badge_color = "warning"
        verdict = "Có thể gặp hiện tượng giật giọng hoặc ngắt quãng ngắn khi di chuyển giữa các phòng."
    elif mos >= 3.0:
        rating = "Kém / Poor"
        badge_color = "danger"
        verdict = "Độ trễ cao hoặc rớt gói tin. Cuộc gọi thoại sẽ bị rè tiếng, méo giọng hoặc trễ hơn 1 giây."
    else:
        rating = "Rất Kém / Bad"
        badge_color = "danger"
        verdict = "Nghẽn mạng nghiêm trọng! Nguy cơ rớt cuộc gọi hoặc không thể thiết lập cuộc đàm thoại."

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
        "supported_codecs": [
            {"codec": "Opus (HD Audio)", "status": "Khuyên dùng" if mos >= 4.0 else "Giảm bitrate"},
            {"codec": "G.711 (Toll Quality 64kbps)", "status": "Tốt" if packet_loss_pct < 2 else "Mất gói"},
            {"codec": "G.729 (Low Bandwidth 8kbps)", "status": "Phù hợp khi mạng yếu"}
        ]
    }

if __name__ == "__main__":
    result = measure_network_quality("8.8.8.8", 3)
    print("VoWiFi MOS Test Result:")
    print("MOS Score:", result['mos_score'], "/ 4.5")
    print(f"RTT: {result['latency_avg_ms']} ms | Jitter: {result['jitter_ms']} ms | Loss: {result['packet_loss_pct']}%")
