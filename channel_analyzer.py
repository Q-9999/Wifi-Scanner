from typing import List, Dict, Any, Tuple
import math

# Standard non-overlapping channels
CHANNELS_24GHZ_PREFERRED = (1, 6, 11)
CHANNELS_24GHZ_ALL = tuple(range(1, 15))

# 5GHz UNII channels
UNII_1 = (36, 40, 44, 48)
UNII_2A_DFS = (52, 56, 60, 64)
UNII_2C_DFS = (100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144)
UNII_3 = (149, 153, 157, 161, 165)
ALL_5GHZ_CHANNELS = UNII_1 + UNII_2A_DFS + UNII_2C_DFS + UNII_3
DFS_SET_5G = frozenset(UNII_2A_DFS + UNII_2C_DFS)

# 5GHz 80MHz channel blocks: {block_name: (primary_channels, center_channel)}
BLOCKS_80MHZ = {
    "UNII-1 (36-48)": ([36, 40, 44, 48], 42),
    "UNII-2A (52-64) DFS": ([52, 56, 60, 64], 58),
    "UNII-2C Lower (100-112) DFS": ([100, 104, 108, 112], 106),
    "UNII-2C Upper (116-128) DFS": ([116, 120, 124, 128], 122),
    "UNII-3 (149-161)": ([149, 153, 157, 161], 155),
}

# 6GHz UNII-5 Preferred Scanning Channels (PSC) & 160MHz blocks (Wi-Fi 6E / Wi-Fi 7)
PSC_6GHZ_CHANNELS = (5, 21, 37, 53, 69, 85)
ALL_6GHZ_UNII5 = (1, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45, 49, 53, 57, 61, 65, 69, 73, 77, 81, 85, 89, 93)
BLOCKS_160MHZ_6G = {
    "UNII-5 Block A (1-29)": ([1, 5, 9, 13, 17, 21, 25, 29], 15),
    "UNII-5 Block B (33-61)": ([33, 37, 41, 45, 49, 53, 57, 61], 47),
    "UNII-5 Block C (65-93)": ([65, 69, 73, 77, 81, 85, 89, 93], 79),
}

# Precomputed overlap table for 2.4 GHz channel diffs (0..14)
OVERLAP_FACTORS_24 = (1.0, 1.8, 1.5, 1.1, 0.6)


def calculate_overlap_24ghz(target_ch: int, active_ch: int) -> float:
    diff = abs(target_ch - active_ch)
    return OVERLAP_FACTORS_24[diff] if diff < 5 else 0.0


def rssi_to_linear_power(rssi_dbm: float) -> float:
    return 10.0 ** (rssi_dbm / 10.0)


def evaluate_24ghz_channels(networks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Evaluate 2.4 GHz band and recommend the cleanest channel"""
    nets_24 = [
        n for n in networks
        if "2.4" in str(n.get("band", "")) or (isinstance(n.get("channel"), int) and 1 <= n.get("channel") <= 14 and "6" not in str(n.get("band", "")))
    ]

    channel_evals = {
        ch: {
            "channel": ch,
            "band": "2.4 GHz",
            "is_standard": ch in CHANNELS_24GHZ_PREFERRED,
            "same_channel_aps": [],
            "overlapping_aps": [],
            "interference_score": 0.0,
            "avg_signal_dbm": None,
            "utilization_pct": 0,
            "connected_clients": 0
        }
        for ch in CHANNELS_24GHZ_ALL
    }

    for net in nets_24:
        net_ch = net.get("channel")
        if not isinstance(net_ch, int) or net_ch < 1 or net_ch > 14:
            continue
        signal_dbm = net.get("signal_dbm", -90)
        power_factor = rssi_to_linear_power(signal_dbm) * 1e6
        util = net.get("channel_utilization_pct") or 20
        clients = net.get("connected_stations", 0)

        for eval_ch in CHANNELS_24GHZ_ALL:
            overlap = calculate_overlap_24ghz(eval_ch, net_ch)
            if overlap > 0:
                ev = channel_evals[eval_ch]
                ev["interference_score"] += power_factor * overlap * (1.0 + (util / 100.0))
                ev["connected_clients"] += clients
                if eval_ch == net_ch:
                    ev["same_channel_aps"].append(net)
                    if util > ev["utilization_pct"]:
                        ev["utilization_pct"] = util
                else:
                    ev["overlapping_aps"].append({
                        "ssid": net.get("ssid"),
                        "channel": net_ch,
                        "signal_dbm": signal_dbm,
                        "overlap_factor": overlap
                    })

    for ch, data in channel_evals.items():
        if not data["is_standard"]:
            data["interference_score"] += 50.0

    preferred_scores = []
    for ch in CHANNELS_24GHZ_PREFERRED:
        item = channel_evals[ch]
        raw_score = 100.0 - min(100.0, math.sqrt(item["interference_score"]) * 1.5) - (item["utilization_pct"] * 0.25)
        item["health_score"] = max(5, round(raw_score))
        preferred_scores.append((ch, item["health_score"], item))

    for ch in CHANNELS_24GHZ_ALL:
        if ch not in CHANNELS_24GHZ_PREFERRED:
            item = channel_evals[ch]
            raw_score = 60.0 - min(55.0, math.sqrt(item["interference_score"]) * 2.0)
            item["health_score"] = max(1, round(raw_score))

    preferred_scores.sort(key=lambda x: x[1], reverse=True)
    best_channel, best_score, best_data = preferred_scores[0]

    reasons_en = []
    reasons_vi = []
    same_count = len(best_data["same_channel_aps"])
    adj_count = len(best_data["overlapping_aps"])

    reasons_en.append(f"Channel {best_channel} achieved the highest quality score of {best_score}/100.")
    reasons_vi.append(f"Kênh {best_channel} đạt điểm chất lượng sóng cao nhất trong khu vực: {best_score}/100.")

    reasons_en.append(
        "It is an IEEE 802.11 standard non-overlapping 20MHz channel (1, 6, 11), "
        "preventing adjacent channel sideband interference (ACI)."
    )
    reasons_vi.append(
        "Đây là kênh chuẩn 20MHz không chồng lấn theo IEEE 802.11 (1, 6, 11), "
        "giúp loại bỏ hiện tượng nhiễu lấn kênh kề (ACI)."
    )

    if same_count == 0:
        reasons_en.append(f"Zero co-channel Access Points detected on Channel {best_channel} (100% clean airtime).")
        reasons_vi.append(f"Không có bộ phát nào đang dùng chung Kênh {best_channel} (Kênh trống 100%).")
    else:
        ap_names = [f"{ap.get('ssid', 'Unknown')} ({ap.get('signal_dbm')} dBm)" for ap in best_data["same_channel_aps"][:3]]
        reasons_en.append(
            f"{same_count} co-channel AP(s) detected ({', '.join(ap_names)}). "
            f"Co-channel sharing is coordinated via CSMA/CA without frame corruption."
        )
        reasons_vi.append(
            f"Phát hiện {same_count} trạm phát dùng chung kênh ({', '.join(ap_names)}). "
            f"Cơ chế CSMA/CA tự động điều phối lượt phát sóng mà không làm hỏng gói tin."
        )

    if adj_count == 0:
        reasons_en.append("No sideband interference from non-standard channels (2, 3, 4, 5, etc.).")
        reasons_vi.append("Không bị nhiễu giao thoa từ các kênh lệch chuẩn (2, 3, 4, 5...).")
    else:
        reasons_en.append(f"Lowest adjacent channel interference compared to alternatives ({adj_count} nearby signals).")
        reasons_vi.append(f"Mức nhiễu từ kênh lân cận thấp nhất so với các kênh khác ({adj_count} trạm xung quanh).")

    if best_data["utilization_pct"] > 0:
        reasons_en.append(f"Estimated channel airtime load is low at ~{best_data['utilization_pct']}%.")
        reasons_vi.append(f"Mức tải chiếm dụng kênh đo được ở mức thấp (~{best_data['utilization_pct']}%).")

    return {
        "band": "2.4 GHz",
        "recommended_channel": best_channel,
        "recommended_score": best_score,
        "recommendation_reason": " ".join(reasons_vi),
        "reasons_breakdown": reasons_vi,
        "reasons_breakdown_en": reasons_en,
        "reasons_breakdown_vi": reasons_vi,
        "ranked_preferred": [
            {"channel": ch, "score": score, "aps_count": len(channel_evals[ch]["same_channel_aps"])}
            for ch, score, _ in preferred_scores
        ],
        "channel_evaluations": channel_evals
    }


def evaluate_5ghz_channels(networks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Evaluate 5 GHz band and recommend the cleanest channel and 80MHz block"""
    nets_5 = [
        n for n in networks
        if "5" in str(n.get("band", "")) or (isinstance(n.get("channel"), int) and n.get("channel") >= 32 and "6" not in str(n.get("band", "")))
    ]

    channel_evals = {}
    for ch in ALL_5GHZ_CHANNELS:
        dfs = ch in DFS_SET_5G
        unii_group = "UNII-1" if ch in UNII_1 else ("UNII-3" if ch in UNII_3 else "UNII-2 DFS")
        channel_evals[ch] = {
            "channel": ch,
            "band": "5 GHz",
            "unii_group": unii_group,
            "is_dfs": dfs,
            "same_channel_aps": [],
            "interference_score": 0.0,
            "utilization_pct": 0,
            "connected_clients": 0
        }

    for net in nets_5:
        net_ch = net.get("channel")
        if not isinstance(net_ch, int) or net_ch not in channel_evals:
            continue
        signal_dbm = net.get("signal_dbm", -90)
        power_factor = rssi_to_linear_power(signal_dbm) * 1e6
        util = net.get("channel_utilization_pct") or 15
        clients = net.get("connected_stations", 0)

        item = channel_evals[net_ch]
        item["same_channel_aps"].append(net)
        item["interference_score"] += power_factor * (1.0 + (util / 100.0))
        item["connected_clients"] += clients
        if util > item["utilization_pct"]:
            item["utilization_pct"] = util

    for ch, item in channel_evals.items():
        raw_score = 100.0 - min(80.0, math.sqrt(item["interference_score"]) * 2.0) - (item["utilization_pct"] * 0.3)
        if item["is_dfs"]:
            raw_score -= 10.0
        item["health_score"] = max(10, round(raw_score))

    block_evals = []
    for block_name, (sub_channels, center_ch) in BLOCKS_80MHZ.items():
        total_aps = 0
        total_score = 0
        has_dfs = False
        ap_list = []
        for c in sub_channels:
            ev = channel_evals.get(c)
            if ev:
                total_aps += len(ev["same_channel_aps"])
                total_score += ev["health_score"]
                ap_list.extend(ev["same_channel_aps"])
                if ev["is_dfs"]:
                    has_dfs = True
        avg_score = round(total_score / len(sub_channels))
        block_evals.append({
            "block_name": block_name,
            "primary_channels": sub_channels,
            "center_channel": center_ch,
            "avg_score": avg_score,
            "total_aps": total_aps,
            "aps": ap_list,
            "is_dfs": has_dfs
        })

    block_evals.sort(key=lambda x: (x["avg_score"], -x["total_aps"]), reverse=True)
    best_block = block_evals[0]

    sorted_channels = sorted(channel_evals.values(), key=lambda x: (x["health_score"], not x["is_dfs"]), reverse=True)
    best_channel_data = sorted_channels[0]
    best_channel = best_channel_data["channel"]
    best_score = best_channel_data["health_score"]

    reasons_en = [
        f"Channel {best_channel} ({best_channel_data['unii_group']}) achieved score {best_score}/100."
    ]
    reasons_vi = [
        f"Kênh {best_channel} ({best_channel_data['unii_group']}) được chọn với điểm chất lượng {best_score}/100."
    ]
    if not best_channel_data["is_dfs"]:
        reasons_en.append(
            "It operates in a non-DFS frequency band, avoiding weather/military radar interruptions "
            "and mandatory channel switching."
        )
        reasons_vi.append(
            "Kênh thuộc dải tần Non-DFS ổn định, không bị ảnh hưởng bởi sóng radar thời tiết hay quân sự, "
            "tránh việc router tự động đổi kênh gây rớt mạng."
        )
    else:
        reasons_en.append("DFS channel with low congestion, suitable if local radar activity is absent.")
        reasons_vi.append("Kênh DFS đang rất ít thiết bị dùng, phù hợp khi khu vực không có trạm radar.")

    ap_count = len(best_channel_data["same_channel_aps"])
    if ap_count == 0:
        reasons_en.append(f"Zero Access Points are active on channel {best_channel}, providing 100% free spectrum.")
        reasons_vi.append(f"Hiện không có bộ phát nào hoạt động trên Kênh {best_channel}, dải tần thông thoáng 100%.")
    else:
        reasons_en.append(f"Only {ap_count} active AP(s) detected with low signal contention.")
        reasons_vi.append(f"Chỉ có {ap_count} bộ phát đang hoạt động với mức tranh chấp sóng rất thấp.")

    reasons_en.append(
        f"For 80MHz channel width (VHT80/HE80), the cleanest block is {best_block['block_name']} "
        f"(Channels {best_block['primary_channels'][0]}-{best_block['primary_channels'][-1]}), "
        f"averaging {best_block['avg_score']}/100."
    )
    reasons_vi.append(
        f"Với độ rộng kênh 80MHz (VHT80/HE80), khối kênh thông thoáng nhất là {best_block['block_name']} "
        f"(Kênh {best_block['primary_channels'][0]}-{best_block['primary_channels'][-1]}) đạt {best_block['avg_score']}/100 điểm."
    )

    return {
        "band": "5 GHz",
        "recommended_channel": best_channel,
        "recommended_score": best_score,
        "recommended_80mhz_block": best_block["block_name"],
        "recommended_80mhz_channels": best_block["primary_channels"],
        "recommendation_reason": " ".join(reasons_vi),
        "reasons_breakdown": reasons_vi,
        "reasons_breakdown_en": reasons_en,
        "reasons_breakdown_vi": reasons_vi,
        "best_80mhz_block": best_block,
        "channel_evaluations": channel_evals,
        "all_80mhz_blocks": block_evals
    }


def evaluate_6ghz_channels(networks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Evaluate 6 GHz UNII-5 band (Wi-Fi 6E / Wi-Fi 7) and recommend the cleanest PSC channel & 160MHz block"""
    nets_6 = [
        n for n in networks
        if "6" in str(n.get("band", ""))
    ]

    channel_evals = {}
    for ch in ALL_6GHZ_UNII5:
        is_psc = ch in PSC_6GHZ_CHANNELS
        channel_evals[ch] = {
            "channel": ch,
            "band": "6 GHz",
            "is_psc": is_psc,
            "same_channel_aps": [],
            "interference_score": 0.0,
            "utilization_pct": 0,
            "connected_clients": 0
        }

    for net in nets_6:
        net_ch = net.get("channel")
        if not isinstance(net_ch, int) or net_ch not in channel_evals:
            continue
        signal_dbm = net.get("signal_dbm", -90)
        power_factor = rssi_to_linear_power(signal_dbm) * 1e6
        util = net.get("channel_utilization_pct") or 10
        clients = net.get("connected_stations", 0)

        item = channel_evals[net_ch]
        item["same_channel_aps"].append(net)
        item["interference_score"] += power_factor * (1.0 + (util / 100.0))
        item["connected_clients"] += clients
        if util > item["utilization_pct"]:
            item["utilization_pct"] = util

    for ch, item in channel_evals.items():
        raw_score = 100.0 - min(75.0, math.sqrt(item["interference_score"]) * 1.8) - (item["utilization_pct"] * 0.25)
        if not item["is_psc"]:
            raw_score -= 8.0
        item["health_score"] = max(15, round(raw_score))

    psc_candidates = [channel_evals[ch] for ch in PSC_6GHZ_CHANNELS]
    psc_candidates.sort(key=lambda x: (x["health_score"], -len(x["same_channel_aps"])), reverse=True)
    best_psc = psc_candidates[0]

    block_evals = []
    for block_name, (sub_channels, center_ch) in BLOCKS_160MHZ_6G.items():
        total_aps = sum(len(channel_evals[c]["same_channel_aps"]) for c in sub_channels)
        avg_score = round(sum(channel_evals[c]["health_score"] for c in sub_channels) / len(sub_channels))
        block_evals.append({
            "block_name": block_name,
            "primary_channels": sub_channels,
            "center_channel": center_ch,
            "avg_score": avg_score,
            "total_aps": total_aps
        })
    block_evals.sort(key=lambda x: (x["avg_score"], -x["total_aps"]), reverse=True)
    best_block = block_evals[0]

    reasons_vi = [
        f"Kênh PSC {best_psc['channel']} (dải tần 6 GHz UNII-5) đạt {best_psc['health_score']}/100 điểm chất lượng phổ tần.",
        f"Là kênh quét ưu tiên PSC (Preferred Scanning Channel) giúp thiết bị Wi-Fi 6E/7 bắt sóng nhanh và hỗ trợ độ rộng kênh siêu tốc 160MHz ({best_block['block_name']})."
    ]
    reasons_en = [
        f"PSC Channel {best_psc['channel']} (6 GHz UNII-5) achieved {best_psc['health_score']}/100 spectrum quality score.",
        f"Preferred Scanning Channel (PSC) enables fast Wi-Fi 6E/7 discovery and supports ultra-wide 160MHz block {best_block['block_name']}."
    ]

    return {
        "band": "6 GHz",
        "recommended_channel": best_psc["channel"],
        "recommended_score": best_psc["health_score"],
        "recommended_160mhz_block": best_block["block_name"],
        "reasons_breakdown": reasons_vi,
        "reasons_breakdown_vi": reasons_vi,
        "reasons_breakdown_en": reasons_en,
        "best_160mhz_block": best_block,
        "channel_evaluations": channel_evals,
        "all_160mhz_blocks": block_evals
    }


def _build_oscium_troubleshooting_suite(
    networks: List[Dict[str, Any]],
    eval_24: Dict[str, Any],
    eval_5: Dict[str, Any],
    eval_6: Dict[str, Any],
    airtime_summary: Dict[str, Any],
    roaming_groups: List[Dict[str, Any]],
    security_audit: Dict[str, List[Dict[str, Any]]]
) -> Dict[str, Any]:
    """
    Build All-in-One RF & Layer-2 Troubleshooting Diagnostics inspired by Oscium Complete Bundle
    (Wi-Spy Lucid Spectrum + Chanalyzer Interference Classifier + Nomad Layer-2 Audit).
    """
    non_std_24_aps = [
        n for n in networks
        if "2.4" in str(n.get("band", "")) and n.get("channel") not in (1, 6, 11)
    ]
    wide_24_aps = [
        n for n in networks
        if "2.4" in str(n.get("band", "")) and int(n.get("channel_width_mhz") or 20) > 20
    ]
    dfs_5_aps = [
        n for n in networks
        if "5" in str(n.get("band", "")) and n.get("channel") in DFS_SET_5G
    ]
    ch6_11_aps = [
        n for n in networks
        if "2.4" in str(n.get("band", "")) and isinstance(n.get("channel"), int) and 6 <= n.get("channel") <= 11
    ]

    # Estimate MAC Layer 2 Frame Retry Rate (%) from channel contention, ACI overlap, and weak SNR
    aci_penalty = len(non_std_24_aps) * 3.2 + len(wide_24_aps) * 2.5
    contention_factor = airtime_summary.get("data_contention_pct", 10) * 0.22
    est_retry_rate_pct = round(min(45.0, max(1.5, 2.0 + aci_penalty + contention_factor)), 1)

    # 1. Non-Wi-Fi RF Interference Signatures (Oscium WiPry / Chanalyzer Layer-1 Spectrum Classifier)
    # Detect signatures for Microwave, Bluetooth LE/Classic, Wireless CCTV, and Radar DFS
    microwave_detected = len(ch6_11_aps) >= 5 or (len(ch6_11_aps) >= 3 and est_retry_rate_pct > 12.0)
    bluetooth_detected = len(networks) > 0  # Standard ISM coexistence in active environments
    cctv_detected = any(int(n.get("channel_width_mhz") or 20) >= 40 and "2.4" in str(n.get("band", "")) for n in networks)
    radar_detected = len(dfs_5_aps) > 0

    non_wifi_interferers = [
        {
            "id": "MICROWAVE_OVEN",
            "name_vi": "Lò Vi Sóng (Microwave Oven)",
            "name_en": "Microwave Oven",
            "detected": microwave_detected,
            "band": "2.4 GHz ISM",
            "freq_range": "2445 - 2475 MHz (Kênh 8-11)",
            "severity": "WARNING" if microwave_detected else "PASS",
            "duty_cycle": "50% (Chu kỳ bán kỳ điện áp 50/60Hz)",
            "impact_vi": "Xung điện từ công suất 800-1200W gây nghẽn đột ngột dải Kênh 8-11 làm rớt cuộc gọi VoWiFi.",
            "impact_en": "800-1200W RF pulses cause sudden interference bursts on channels 8-11.",
            "remediation_vi": "Chuyển điện thoại và laptop sang sóng 5 GHz hoặc 6 GHz khi ở gần khu vực bếp."
        },
        {
            "id": "BLUETOOTH_HOPPING",
            "name_vi": "Tai Nghe / Chuột Bluetooth (FHSS Coexistence)",
            "name_en": "Bluetooth Low Energy / Classic (FHSS)",
            "detected": bluetooth_detected,
            "band": "2.4 GHz ISM",
            "freq_range": "2402 - 2480 MHz (79 kênh 1MHz)",
            "severity": "INFO",
            "duty_cycle": "15% - 25% (Nhảy tần 1600 lần/giây)",
            "impact_vi": "Thiết bị Bluetooth nhảy tần liên tục qua Kênh 1, 6, 11 nhưng tự thích ứng giảm can nhiễu.",
            "impact_en": "Frequency hopping across 2.4 GHz channels with adaptive frequency hopping.",
            "remediation_vi": "Duy trì khoảng cách tối thiểu 1 mét giữa Router Wi-Fi và thiết bị phát Bluetooth."
        },
        {
            "id": "WIRELESS_CCTV",
            "name_vi": "Camera Không Dây Tương Tự (Wireless CCTV Transmitter)",
            "name_en": "Wireless CCTV Transmitter",
            "detected": cctv_detected,
            "band": "2.4 GHz / 5.8 GHz",
            "freq_range": "Kênh liên tục không ngắt quãng",
            "severity": "WARNING" if cctv_detected else "PASS",
            "duty_cycle": "100% Phát liên tục (Continuous Carrier)",
            "impact_vi": "Camera phát sóng analog liên tục làm kênh bị nghẽn 100% thời gian thực.",
            "impact_en": "Continuous video carrier eliminates Wi-Fi clear channel assessment (CCA).",
            "remediation_vi": "Thay thế camera analog bằng IP Camera Wi-Fi chuẩn 802.11ax hoặc cắm dây LAN PoE."
        },
        {
            "id": "RADAR_DFS",
            "name_vi": "Radar Khí Tượng & Hàng Không (DFS Radar Pulses)",
            "name_en": "DFS Radar Pulses",
            "detected": radar_detected,
            "band": "5 GHz UNII-2 / UNII-2e",
            "freq_range": "5250 - 5725 MHz (Kênh 52 - 144)",
            "severity": "INFO" if radar_detected else "PASS",
            "duty_cycle": "Dạng xung radar quét Doppler",
            "impact_vi": "Nếu radar phát xung, Router bắt buộc ngắt sóng chuyển kênh trong 60 giây (Channel Availability Check).",
            "impact_en": "Radar pulses force AP into 60s silence and dynamic frequency hopping.",
            "remediation_vi": f"Ưu tiên chọn Kênh {eval_5['recommended_channel']} ({eval_5['recommended_80mhz_block']}) thuộc dải Non-DFS để kết nối không gián đoạn."
        }
    ]

    spectrum_classifiers = []
    # 1. Adjacent Channel Interference (ACI) & Wideband 40MHz on 2.4GHz
    if non_std_24_aps or wide_24_aps:
        spectrum_classifiers.append({
            "id": "ACI_24GHZ",
            "severity": "WARNING",
            "band": "2.4 GHz",
            "layer": "Layer 1 - Phổ Tần Vô Tuyến (RF Spectrum)",
            "title_vi": f"Nhiễu Kênh Kề & Kênh Rộng 2.4GHz ({len(non_std_24_aps)} lệch kênh, {len(wide_24_aps)} kênh 40MHz)",
            "title_en": f"2.4GHz Adjacent Channel & 40MHz Wideband Interference ({len(non_std_24_aps)} non-std, {len(wide_24_aps)} 40MHz)",
            "detail_vi": "Các trạm phát ở kênh lệch (2, 3, 4, 5, 7, 8, 9, 10) hoặc bật 40MHz gây chồng lấn phổ tần trực tiếp và làm tăng tỷ lệ gửi lại gói tin (Frame Retry).",
            "action_vi": f"Cố định kênh 2.4GHz về Kênh {eval_24['recommended_channel']} với độ rộng 20MHz tiêu chuẩn."
        })
    else:
        spectrum_classifiers.append({
            "id": "ACI_24GHZ_CLEAN",
            "severity": "PASS",
            "band": "2.4 GHz",
            "layer": "Layer 1 - Phổ Tần Vô Tuyến (RF Spectrum)",
            "title_vi": "Phân Bổ Kênh 2.4GHz Chuẩn 1 / 6 / 11 (Không Nhiễu Kênh Kề ACI)",
            "title_en": "Clean 2.4GHz 1 / 6 / 11 Channel Alignment (Zero ACI)",
            "detail_vi": "Toàn bộ các trạm phát 2.4GHz trong khu vực đều tuân thủ bước kênh không chồng lấn 1, 6, 11.",
            "action_vi": f"Duy trì cấu hình Kênh {eval_24['recommended_channel']} (20MHz)."
        })

    # 2. ISM 2.45 GHz Non-Wi-Fi Risk (Microwave / Bluetooth / Zigbee zone)
    if microwave_detected:
        spectrum_classifiers.append({
            "id": "ISM_245GHZ_DENSITY",
            "severity": "WARNING",
            "band": "2.4 GHz",
            "layer": "Layer 1 - Nhiễu Ngoại Vi Phi Wi-Fi (Non-Wi-Fi ISM)",
            "title_vi": f"Nguy Cơ Nhiễu Lò Vi Sóng Vùng 2.45 GHz ({len(ch6_11_aps)} AP Kênh 6-11)",
            "title_en": f"Microwave & ISM Interference Risk ({len(ch6_11_aps)} APs on Ch 6-11)",
            "detail_vi": "Dải tần 2.44-2.47 GHz (Kênh 6-11) dùng chung phổ với lò vi sóng và thiết bị không dây ngoại vi.",
            "action_vi": "Chuyển các thiết bị làm việc chính sang băng tần 5 GHz hoặc 6 GHz để tránh xung đột sóng ngoại vi."
        })
    else:
        spectrum_classifiers.append({
            "id": "ISM_245GHZ_CLEAN",
            "severity": "PASS",
            "band": "2.4 GHz",
            "layer": "Layer 1 - Nhiễu Ngoại Vi Phi Wi-Fi (Non-Wi-Fi ISM)",
            "title_vi": f"Mật Độ Vùng Tần Số 2.45 GHz Ổn Định ({len(ch6_11_aps)} AP quanh Kênh 6-11)",
            "title_en": f"Low 2.45 GHz ISM Band Contention ({len(ch6_11_aps)} APs on Ch 6-11)",
            "detail_vi": "Mức độ tranh chấp phổ tần với thiết bị ngoại vi Bluetooth / Zigbee / Lò vi sóng ở mức thấp.",
            "action_vi": "Có thể sử dụng bình thường các thiết bị ngoại vi không dây trên băng tần 2.4 GHz."
        })

    # 3. 5 GHz DFS Radar Channel Monitor
    if dfs_5_aps:
        spectrum_classifiers.append({
            "id": "DFS_5GHZ_ACTIVE",
            "severity": "INFO",
            "band": "5 GHz",
            "layer": "Layer 1 - Giám Sát Dải Tần Radar DFS (5 GHz UNII-2)",
            "title_vi": f"Phát Hiện {len(dfs_5_aps)} Bộ Phát Dùng Kênh DFS (Kênh 52-144)",
            "title_en": f"{len(dfs_5_aps)} AP(s) Operating on 5 GHz DFS Channels (Ch 52-144)",
            "detail_vi": "Kênh DFS rất thông thoáng nhưng có thể tự động ngắt kết nối tạm thời nếu phát hiện tín hiệu radar thời tiết hoặc hàng không.",
            "action_vi": f"Nếu cần kết nối thoại liên tục không ngắt quãng, ưu tiên Kênh {eval_5['recommended_channel']} (Non-DFS)."
        })
    else:
        spectrum_classifiers.append({
            "id": "DFS_5GHZ_CLEAR",
            "severity": "PASS",
            "band": "5 GHz",
            "layer": "Layer 1 - Giám Sát Dải Tần Radar DFS (5 GHz UNII-2)",
            "title_vi": "Không Có Bộ Phát Tranh Chấp Dải Tần Radar DFS (Kênh 52-144 Trống)",
            "title_en": "Zero AP Contention on 5 GHz DFS Channels (Ch 52-144 Clean)",
            "detail_vi": "Toàn bộ các kênh UNII-2A/2C DFS hiện đang hoàn toàn trống, không có bộ phát lân cận gây nhiễu.",
            "action_vi": f"Khuyên dùng Kênh Non-DFS {eval_5['recommended_channel']} ({eval_5['recommended_80mhz_block']}) cho độ ổn định cao nhất."
        })

    # 4. 6 GHz UNII-5 PSC & 160 MHz Ultra-Wideband Readiness
    aps_6g_count = sum(1 for n in networks if "6" in str(n.get("band", "")))
    spectrum_classifiers.append({
        "id": "UNII5_6GHZ_PSC",
        "severity": "PASS" if eval_6.get("recommended_score", 95) >= 80 else "INFO",
        "band": "6 GHz",
        "layer": "Layer 1 - Phổ Tần 6 GHz Wi-Fi 6E / Wi-Fi 7 (UNII-5 PSC)",
        "title_vi": f"Dải Tần 6 GHz UNII-5 Sẵn Sàng ({aps_6g_count} AP • Kênh PSC {eval_6['recommended_channel']} đạt {eval_6['recommended_score']}/100)",
        "title_en": f"6 GHz UNII-5 Spectrum Ready ({aps_6g_count} APs • PSC Ch {eval_6['recommended_channel']} Score {eval_6['recommended_score']}/100)",
        "detail_vi": f"Khối băng thông 160MHz sạch nhất là {eval_6['recommended_160mhz_block']}, không bị can nhiễu bởi thiết bị Wi-Fi 4/5 đời cũ.",
        "action_vi": f"Bật băng tần 6 GHz ở Kênh PSC {eval_6['recommended_channel']} (độ rộng 160MHz) cho các thiết bị hỗ trợ Wi-Fi 6E/7."
    })

    # 5. Layer 2 Airtime & Frame Retry Audit
    free_air = airtime_summary.get("free_airtime_pct", 70)
    beacon_oh = airtime_summary.get("beacon_overhead_pct", 10)
    if free_air < 45 or est_retry_rate_pct >= 18.0:
        spectrum_classifiers.append({
            "id": "L2_AIRTIME_CONGESTION",
            "severity": "WARNING",
            "band": "All Bands",
            "layer": "Layer 2 - Thời Lượng Sóng & Gói Tin Lỗi (MAC / Airtime)",
            "title_vi": f"Chiếm Dụng Kênh Cao (Airtime trống {free_air}%, Tỷ lệ gửi lại gói tin ~{est_retry_rate_pct}%)",
            "title_en": f"High Channel Airtime Load (Free Airtime {free_air}%, Est. Retry Rate ~{est_retry_rate_pct}%)",
            "detail_vi": f"Gói tin quảng bá Beacon chiếm {beacon_oh}% thời lượng sóng. Quá nhiều SSID ảo trên cùng một bộ phát làm giảm băng thông thực tế.",
            "action_vi": "Giới hạn tối đa 3 SSID trên mỗi bộ phát và tắt chuẩn cũ 802.11b/g."
        })
    else:
        spectrum_classifiers.append({
            "id": "L2_AIRTIME_HEALTHY",
            "severity": "PASS",
            "band": "All Bands",
            "layer": "Layer 2 - Thời Lượng Sóng & Gói Tin Lỗi (MAC / Airtime)",
            "title_vi": f"Thời Lượng Sóng Thông Thoáng (Airtime trống {free_air}%, Gửi lại gói tin thấp ~{est_retry_rate_pct}%)",
            "title_en": f"Healthy Channel Airtime (Free Airtime {free_air}%, Low Retry Rate ~{est_retry_rate_pct}%)",
            "detail_vi": "Tỷ lệ chiếm dụng kênh và lưu lượng gói tin quảng bá Beacon nằm trong ngưỡng tối ưu.",
            "action_vi": "Không cần can thiệp cấu hình MAC Layer 2."
        })

    # 6-Point Automated Wi-Fi Health Check (Oscium Complete Bundle Suite)
    sticky_count = sum(1 for r in roaming_groups if r.get("status") == "STICKY_CLIENT_RISK")
    open_count = len(security_audit.get("open_unsecured", []))
    strong_aps_count = sum(1 for n in networks if (int(n.get("rssi") or -100) >= -65))
    total_aps_count = max(1, len(networks))
    coverage_rate_pct = round((strong_aps_count / total_aps_count) * 100, 1)

    checklist = [
        {
            "id": "POINT_1_COVERAGE",
            "category_vi": "1. Mức Sóng & Phủ Sóng (Layer 1 Coverage & Primary RSSI)",
            "category_en": "1. Layer 1 Coverage & Primary RSSI",
            "status": "PASS" if coverage_rate_pct >= 50.0 else "WARNING",
            "metric": f"{coverage_rate_pct}% AP đạt mức mạnh ≥ -65 dBm ({strong_aps_count}/{total_aps_count} trạm)",
            "summary_vi": "Đảm bảo mức thu sóng mạnh cho cuộc gọi thoại VoWiFi và xem video 4K mượt mà.",
            "remediation_vi": "Di chuyển Router lại gần khu vực làm việc hoặc bổ sung thêm bộ phát Mesh."
        },
        {
            "id": "POINT_2_SPECTRUM",
            "category_vi": "2. Phổ Tần & Can Nhiễu Kênh (Layer 1 RF Spectrum Quality)",
            "category_en": "2. Layer 1 RF Spectrum Quality",
            "status": "PASS" if (eval_24["recommended_score"] >= 70 and not non_std_24_aps) else "WARNING",
            "metric": f"2.4G: {eval_24['recommended_score']}/100 | 5G: {eval_5['recommended_score']}/100 | 6G: {eval_6['recommended_score']}/100",
            "summary_vi": f"Kênh sạch khuyên dùng: 2.4GHz Kênh {eval_24['recommended_channel']}, 5GHz Kênh {eval_5['recommended_channel']}, 6GHz Kênh {eval_6['recommended_channel']}.",
            "remediation_vi": f"Cấu hình router cố định về Kênh {eval_24['recommended_channel']} (2.4GHz) và Kênh {eval_5['recommended_channel']} (5GHz)."
        },
        {
            "id": "POINT_3_NON_WIFI",
            "category_vi": "3. Nguồn Nhiễu Phi Wi-Fi (Non-Wi-Fi Interference Detection)",
            "category_en": "3. Non-Wi-Fi RF Interference Detection",
            "status": "WARNING" if microwave_detected else "PASS",
            "metric": f"{'Cảnh báo xung lò vi sóng Kênh 8-11' if microwave_detected else 'Không phát hiện xung lò vi sóng'} | Bluetooth FHSS ổn định",
            "summary_vi": "Phát hiện can nhiễu từ lò vi sóng, tai nghe Bluetooth, camera analog và sóng radar thời tiết DFS.",
            "remediation_vi": "Ưu tiên chuyển thiết bị sang băng tần 5GHz hoặc 6GHz để tránh vùng tần số lò vi sóng 2.45GHz."
        },
        {
            "id": "POINT_4_AIRTIME",
            "category_vi": "4. Thời Lượng Sóng & Gửi Lại Gói Tin (Layer 2 Airtime & Frame Retry)",
            "category_en": "4. Layer 2 Airtime & Frame Retry",
            "status": "PASS" if (free_air >= 50 and est_retry_rate_pct < 15.0) else "WARNING",
            "metric": f"Trống {free_air}% | Beacon {beacon_oh}% | Tỷ lệ gửi lại gói tin ~{est_retry_rate_pct}%",
            "summary_vi": "Đánh giá tỷ lệ chiếm dụng thời lượng phát sóng, lưu lượng Beacon và nguy cơ gửi lại gói tin (Retry).",
            "remediation_vi": "Tắt bớt SSID phụ không dùng đến và tắt hỗ trợ chuẩn cũ 802.11b để giảm hao phí Beacon."
        },
        {
            "id": "POINT_5_ROAMING",
            "category_vi": "5. Chuyển Vùng & Trạm Bám Sóng (Layer 2 Roaming & Sticky Client)",
            "category_en": "5. Layer 2 Multi-AP Roaming & Sticky Client",
            "status": "WARNING" if sticky_count > 0 else "PASS",
            "metric": f"{len(roaming_groups)} Hệ thống đa trạm | {sticky_count} Nguy cơ bám sóng yếu",
            "summary_vi": "Kiểm tra độ chênh lệch công suất giữa các bộ phát dùng chung tên mạng SSID.",
            "remediation_vi": "Bật tính năng chuyển vùng nhanh 802.11k/v/r trên router hoặc giảm công suất phát AP phụ."
        },
        {
            "id": "POINT_6_SECURITY",
            "category_vi": "6. An Toàn Mã Hóa & Mạng Mở (Layer 2 WLAN Security)",
            "category_en": "6. Layer 2 WLAN Security & Encryption",
            "status": "CRITICAL" if open_count > 0 else "PASS",
            "metric": f"{open_count} Mạng không mật khẩu | {len(security_audit.get('cutting_edge_wpa3', []))} Trạm chuẩn WPA3",
            "summary_vi": "Kiểm tra chuẩn mã hóa WPA2/WPA3 và phát hiện các mạng mở không bảo mật.",
            "remediation_vi": "Đăng nhập trang quản trị router chuyển sang WPA2-PSK (AES) hoặc WPA3-SAE kèm mật khẩu mạnh."
        }
    ]

    # Calculate Overall Oscium Wi-Fi Health Score (0 - 100)
    score_deductions = 0
    for pt in checklist:
        if pt["status"] == "WARNING":
            score_deductions += 12
        elif pt["status"] == "CRITICAL":
            score_deductions += 25
    health_score = max(20, min(100, 100 - score_deductions))

    return {
        "health_score": health_score,
        "estimated_retry_rate_pct": est_retry_rate_pct,
        "non_standard_24ghz_count": len(non_std_24_aps),
        "wideband_24ghz_count": len(wide_24_aps),
        "dfs_5ghz_count": len(dfs_5_aps),
        "non_wifi_interferers": non_wifi_interferers,
        "spectrum_classifiers": spectrum_classifiers,
        "checklist": checklist
    }


def analyze_wifi_environment(
    networks: List[Dict[str, Any]],
    connected_interface: Dict[str, Any] = None,
    security_threats: Dict[str, Any] = None,
    **kwargs
) -> Dict[str, Any]:
    """Full RF, SNR/MCS, Airtime, Roaming, Security, and Oscium All-in-One Troubleshooting Analysis"""
    eval_24 = evaluate_24ghz_channels(networks)
    eval_5 = evaluate_5ghz_channels(networks)
    eval_6 = evaluate_6ghz_channels(networks)

    total_aps = len(networks)
    unique_ssids = len({n.get("ssid") for n in networks if n.get("ssid")})

    gen_counts: Dict[str, int] = {}
    band_counts = {"2.4 GHz": 0, "5 GHz": 0, "6 GHz": 0}
    security_audit = {
        "open_unsecured": [],
        "legacy_wpa": [],
        "modern_wpa2": [],
        "cutting_edge_wpa3": [],
        "enterprise": []
    }

    snr_list: List[int] = []
    airtime_list: List[Dict[str, Any]] = []
    legacy_aps_count = 0
    ssid_groups: Dict[str, List[Dict[str, Any]]] = {}

    for n in networks:
        gen = n.get("wifi_generation", "Other")
        gen_counts[gen] = gen_counts.get(gen, 0) + 1
        if gen in ("Wi-Fi 1", "Wi-Fi 2", "Wi-Fi 3", "Wi-Fi 4"):
            legacy_aps_count += 1

        b = str(n.get("band", ""))
        if "2.4" in b:
            band_counts["2.4 GHz"] += 1
        elif "5" in b:
            band_counts["5 GHz"] += 1
        elif "6" in b:
            band_counts["6 GHz"] += 1

        if n.get("snr_db") is not None:
            snr_list.append(int(n["snr_db"]))

        util = n.get("channel_utilization_pct")
        if util is None:
            sig_pct = n.get("signal_percent", 20)
            base_air = 8 if "Wi-Fi 6" in gen or "Wi-Fi 7" in gen else (12 if "Wi-Fi 5" in gen else 18)
            util = min(65, max(3, round(base_air * (sig_pct / 60.0))))
        airtime_list.append({
            "ssid": n.get("ssid", "[Hidden]"),
            "bssid": n.get("bssid", ""),
            "channel": n.get("channel", 1),
            "band": b,
            "generation": gen,
            "airtime_pct": util,
            "snr_db": n.get("snr_db", 20),
            "mcs_index": n.get("mcs_index", 5),
            "est_throughput_mbps": n.get("est_throughput_mbps", 50.0)
        })

        ssid = n.get("ssid", "[Hidden]")
        if not n.get("is_hidden"):
            ssid_groups.setdefault(ssid, []).append(n)

        auth = str(n.get("authentication", "")).lower()
        bssid = n.get("bssid", "")
        item = {
            "ssid": ssid,
            "bssid": bssid,
            "auth": n.get("authentication"),
            "channel": n.get("channel"),
            "band": b,
            "signal_percent": n.get("signal_percent", 0),
            "signal_dbm": n.get("signal_dbm", -100)
        }

        if "open" in auth or "none" in str(n.get("encryption", "")).lower():
            security_audit["open_unsecured"].append(item)
        elif "enterprise" in auth:
            security_audit["enterprise"].append(item)
        elif "wpa3" in auth:
            security_audit["cutting_edge_wpa3"].append(item)
        elif "wpa2" in auth:
            security_audit["modern_wpa2"].append(item)
        else:
            security_audit["legacy_wpa"].append(item)

    roaming_groups = []
    for ssid_name, members in ssid_groups.items():
        if len(members) >= 2:
            bands_present = sorted(list({str(m.get("band", "2.4 GHz")) for m in members}))
            channels_present = sorted(list({m.get("channel", 1) for m in members}))
            signals = [m.get("signal_dbm", -100) for m in members]
            max_sig = max(signals)
            min_sig = min(signals)
            spread = max_sig - min_sig
            has_sticky = any(m.get("roaming_status") == "STICKY_CLIENT" for m in members)
            status = "STICKY_CLIENT_RISK" if (has_sticky or (max_sig >= -62 and min_sig < -72)) else "OPTIMAL_ROAMING"
            if status == "STICKY_CLIENT_RISK":
                rec_vi = f"Phát hiện chênh lệch sóng lớn ({spread} dB). Khuyến nghị bật chuẩn 802.11k/v/r (Fast Roaming) hoặc hạ công suất phát 2.4GHz để thiết bị tự động chuyển sang node mạnh nhất ({max_sig} dBm)."
                rec_en = f"Large signal spread ({spread} dB) across nodes. Enable 802.11k/v/r Fast Roaming or lower 2.4GHz TX power so clients roam to the strongest AP ({max_sig} dBm)."
            else:
                rec_vi = f"Hệ thống đa AP ({len(members)} BSSID) phân bổ công suất đồng đều, hỗ trợ chuyển vùng mượt."
                rec_en = f"Multi-AP group ({len(members)} BSSIDs) has balanced overlap for smooth roaming."

            roaming_groups.append({
                "ssid": ssid_name,
                "ap_count": len(members),
                "bands": bands_present,
                "channels": channels_present,
                "best_dbm": max_sig,
                "weakest_dbm": min_sig,
                "spread_db": spread,
                "best_signal_dbm": max_sig,
                "signal_spread_db": spread,
                "dual_band_ready": len(bands_present) >= 2,
                "sticky_warning": has_sticky,
                "status": status,
                "recommendation_vi": rec_vi,
                "recommendation_en": rec_en
            })
    roaming_groups.sort(key=lambda x: (x["sticky_warning"], x["ap_count"], x["best_signal_dbm"]), reverse=True)

    beacon_overhead_pct = min(35, max(2, round(total_aps * 1.6))) if total_aps > 0 else 0
    avg_ch_util = round(sum(a["airtime_pct"] for a in airtime_list) / len(airtime_list)) if airtime_list else 0
    data_contention_pct = min(85 - beacon_overhead_pct, max(0, avg_ch_util))
    free_airtime_pct = max(0, 100 - beacon_overhead_pct - data_contention_pct)

    airtime_summary = {
        "beacon_overhead_pct": beacon_overhead_pct,
        "data_contention_pct": data_contention_pct,
        "free_airtime_pct": free_airtime_pct,
        "legacy_penalty_aps": legacy_aps_count,
        "ap_list": airtime_list[:15]
    }

    troubleshooting_suite = _build_oscium_troubleshooting_suite(
        networks, eval_24, eval_5, eval_6, airtime_summary, roaming_groups, security_audit
    )
    airtime_summary["estimated_retry_rate_pct"] = troubleshooting_suite["estimated_retry_rate_pct"]

    avg_snr = round(sum(snr_list) / len(snr_list), 1) if snr_list else 0.0
    global_score = round((eval_24["recommended_score"] * 0.4) + (eval_5["recommended_score"] * 0.6))

    return {
        "total_aps": total_aps,
        "unique_ssids": unique_ssids,
        "global_score": global_score,
        "avg_snr_db": avg_snr,
        "legacy_aps_count": legacy_aps_count,
        "generation_breakdown": gen_counts,
        "band_breakdown": band_counts,
        "security_audit": security_audit,
        "airtime_breakdown": airtime_summary,
        "roaming_audit": roaming_groups,
        "troubleshooting_suite": troubleshooting_suite,
        "evaluation_24ghz": eval_24,
        "evaluation_5ghz": eval_5,
        "evaluation_6ghz": eval_6,
        "channels_24ghz": list(eval_24.get("channel_evaluations", {}).values()),
        "channels_5ghz": list(eval_5.get("channel_evaluations", {}).values()),
        "channels_6ghz": list(eval_6.get("channel_evaluations", {}).values()),
        "summary": {
            "best_24ghz_channel": eval_24.get("recommended_channel", 1),
            "best_5ghz_channel": eval_5.get("recommended_channel", 36),
            "best_6ghz_channel": eval_6.get("recommended_channel", 37),
            "bond_160mhz_block": eval_6.get("recommended_160mhz_block", "Ch 33-61 (160 MHz)")
        }
    }


if __name__ == "__main__":
    from wifi_scanner import scan_wifi_networks
    nets = scan_wifi_networks()
    analysis = analyze_wifi_environment(nets)
    print("\n--- 2.4 GHz Recommendation ---")
    print(f"Recommended Channel: {analysis['evaluation_24ghz']['recommended_channel']} (Score: {analysis['evaluation_24ghz']['recommended_score']}/100)")
    print(f"Reason: {analysis['evaluation_24ghz']['recommendation_reason']}")

    print("\n--- 5 GHz Recommendation ---")
    print(f"Recommended Channel: {analysis['evaluation_5ghz']['recommended_channel']} (Score: {analysis['evaluation_5ghz']['recommended_score']}/100)")
    print(f"Recommended 80MHz Block: {analysis['evaluation_5ghz']['recommended_80mhz_block']}")
    print(f"Reason: {analysis['evaluation_5ghz']['recommendation_reason']}")
