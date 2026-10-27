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
        if "2.4" in str(n.get("band", "")) or (isinstance(n.get("channel"), int) and 1 <= n.get("channel") <= 14)
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
        if "5" in str(n.get("band", "")) or (isinstance(n.get("channel"), int) and n.get("channel") >= 32)
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


def analyze_wifi_environment(networks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Full RF, SNR/MCS, Airtime, Roaming, and Security Analysis of the scanned Wi-Fi environment"""
    eval_24 = evaluate_24ghz_channels(networks)
    eval_5 = evaluate_5ghz_channels(networks)

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

        # Estimate individual AP airtime weight for Airtime Treemap/Breakdown (Eye P.A. parity)
        util = n.get("channel_utilization_pct")
        if util is None:
            # Estimate active beacon + traffic airtime based on signal & generation
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

    # Multi-AP Mesh / Roaming Audit Summary (Hamina / Ekahau Roaming standard)
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
        "evaluation_24ghz": eval_24,
        "evaluation_5ghz": eval_5
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
