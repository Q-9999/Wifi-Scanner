import math
from typing import List, Dict, Any, Tuple, Optional

# Wall & Obstacle RF Attenuation Factors (dB) based on IEEE 802.11 indoor propagation measurements
WALL_ATTENUATION = {
    "concrete": 12.0,  # Tường bê tông cốt thép dày
    "brick": 6.0,      # Tường gạch xây 10-20cm
    "wood": 4.0,       # Vách gỗ / thạch cao
    "glass": 3.0,      # Vách kính / cửa sổ kính
    "door": 2.0,       # Cửa ra vào gỗ mỏng
    "metal": 15.0      # Lõi thang máy / tủ kim loại / cửa cuốn sắt
}

# Ekahau-style Requirement SLA Profiles
SLA_PROFILES = {
    "office": {
        "id": "office",
        "name_vi": "Văn phòng tiêu chuẩn (-67 dBm)",
        "name_en": "Văn phòng tiêu chuẩn (-67 dBm / SNR 20 dB)",
        "target_rssi_dbm": -67.0,
        "secondary_rssi_dbm": -75.0,
        "min_snr_db": 20.0,
        "clients_per_ap_24": 25,
        "clients_per_ap_5": 45,
        "clients_per_ap_6": 65
    },
    "voice": {
        "id": "voice",
        "name_vi": "Thoại qua Wi-Fi và họp trực tuyến (-65 dBm)",
        "name_en": "Thoại qua Wi-Fi và họp trực tuyến (-65 dBm / SNR 25 dB)",
        "target_rssi_dbm": -65.0,
        "secondary_rssi_dbm": -70.0,
        "min_snr_db": 25.0,
        "clients_per_ap_24": 20,
        "clients_per_ap_5": 35,
        "clients_per_ap_6": 55
    },
    "high_density": {
        "id": "high_density",
        "name_vi": "Hội trường mật độ cao (-60 dBm)",
        "name_en": "Hội trường mật độ cao (-60 dBm / SNR 28 dB)",
        "target_rssi_dbm": -60.0,
        "secondary_rssi_dbm": -67.0,
        "min_snr_db": 28.0,
        "clients_per_ap_24": 30,
        "clients_per_ap_5": 60,
        "clients_per_ap_6": 90
    }
}


def _get_band_rf_params(freq_ghz: float) -> Tuple[float, float, float, float, float]:
    """
    Return (base_loss_1m, path_loss_exp_10, wall_multiplier, noise_floor_dbm, max_phy_mbps)
    for 2.4 GHz, 5.0 GHz, or 6.0 GHz (Wi-Fi 6E / Wi-Fi 7).
    """
    f = float(freq_ghz or 2.4)
    if f >= 5.8:
        # 6 GHz (UNII-5..8): Higher free-space loss & material absorption, ultra-clean noise floor, 160MHz channels
        return (48.0, 31.5, 1.42, -96.0, 2402.0)
    elif f >= 4.0:
        # 5 GHz (UNII-1..3): Moderate path loss & absorption, clean noise floor, 80MHz channels
        return (46.5, 30.0, 1.25, -95.0, 1201.0)
    else:
        # 2.4 GHz: Lowest path loss & wall absorption, higher background noise floor, 20MHz channels
        return (40.0, 28.0, 1.00, -92.0, 286.8)


def _estimate_cell_throughput_mbps(snr_db: float, max_phy_mbps: float, contention_count: int) -> float:
    """
    Estimate achievable TCP/PHY data rate (Mbps) at a floorplan point from SNR (dB),
    band channel capacity, and co-channel contention count.
    """
    if snr_db <= 4.0:
        return 0.0
    elif snr_db >= 38.0:
        scale = 0.82
    elif snr_db >= 32.0:
        scale = 0.68
    elif snr_db >= 26.0:
        scale = 0.52
    elif snr_db >= 20.0:
        scale = 0.36
    elif snr_db >= 14.0:
        scale = 0.20
    elif snr_db >= 9.0:
        scale = 0.10
    else:
        scale = 0.04

    # Co-channel contention reduces per-client airtime slice
    contention_factor = 1.0 / (1.0 + max(0, contention_count) * 0.35)
    return round(max_phy_mbps * scale * contention_factor, 1)


def _normalize_aps_and_walls(
    aps: List[Dict[str, Any]],
    walls: List[Dict[str, Any]]
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Auto-detect if caller passed (walls, aps) in swapped positional order
    (e.g., first list has x1/y1 wall coordinates and second list has x/y AP coordinates).
    """
    aps_list = aps if isinstance(aps, list) else []
    walls_list = walls if isinstance(walls, list) else []

    if aps_list and isinstance(aps_list[0], dict) and ("x1" in aps_list[0] or "x2" in aps_list[0]):
        if not walls_list or (isinstance(walls_list[0], dict) and "x" in walls_list[0] and "x1" not in walls_list[0]):
            return walls_list, aps_list
    return aps_list, walls_list


def _preprocess_walls(walls: List[Dict[str, Any]], freq_ghz: float = 2.4) -> List[Tuple[float, float, float, float, float, float, float, float, float]]:
    """
    Pre-parse wall dictionaries into compact tuples with Axis-Aligned Bounding Boxes (AABB):
    (x1, y1, x2, y2, min_x, max_x, min_y, max_y, loss_db)
    """
    _, _, freq_wall_multiplier, _, _ = _get_band_rf_params(freq_ghz)
    parsed = []
    for w in (walls or []):
        if not isinstance(w, dict):
            continue
        try:
            x1 = float(w.get("x1", 0.0))
            y1 = float(w.get("y1", 0.0))
            x2 = float(w.get("x2", 0.0))
            y2 = float(w.get("y2", 0.0))
            if x1 == x2 and y1 == y2:
                continue
            mat = str(w.get("material", "brick")).lower()
            base_att = WALL_ATTENUATION.get(mat, 6.0) * freq_wall_multiplier
            parsed.append((
                x1, y1, x2, y2,
                x1 if x1 < x2 else x2,
                x2 if x2 > x1 else x1,
                y1 if y1 < y2 else y2,
                y2 if y2 > y1 else y1,
                base_att
            ))
        except Exception:
            continue
    return parsed


def _segments_intersect(
    ax: float, ay: float, bx: float, by: float,
    cx: float, cy: float, dx: float, dy: float
) -> bool:
    """Fast scalar CCW segment intersection check without tuple allocation"""
    ccw1 = (dy - ay) * (cx - ax) > (cy - ay) * (dx - ax)
    ccw2 = (dy - by) * (cx - bx) > (cy - by) * (dx - bx)
    if ccw1 == ccw2:
        return False
    ccw3 = (cy - ay) * (bx - ax) > (by - ay) * (cx - ax)
    ccw4 = (dy - ay) * (bx - ax) > (by - ay) * (dx - ax)
    return ccw3 != ccw4


def line_intersects(p1: Tuple[float, float], p2: Tuple[float, float], p3: Tuple[float, float], p4: Tuple[float, float]) -> bool:
    """Check if segment (p1, p2) intersects with segment (p3, p4)"""
    return _segments_intersect(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1], p4[0], p4[1])


def _calculate_point_rssi_fast(
    ap_x: float, ap_y: float,
    px: float, py: float,
    tx_power_dbm: float,
    parsed_walls: List[Tuple[float, float, float, float, float, float, float, float, float]],
    base_loss_1m: float,
    path_loss_exp_10: float
) -> float:
    dx = px - ap_x
    dy = py - ap_y
    dist_sq = dx * dx + dy * dy
    dist_m = math.sqrt(dist_sq) if dist_sq > 1.0 else 1.0

    distance_loss = base_loss_1m + path_loss_exp_10 * math.log10(dist_m)

    # Bounding box of ray (ap -> point) for fast AABB wall culling
    r_min_x = ap_x if ap_x < px else px
    r_max_x = px if px > ap_x else ap_x
    r_min_y = ap_y if ap_y < py else py
    r_max_y = py if py > ap_y else ap_y

    wall_loss = 0.0
    for wx1, wy1, wx2, wy2, w_min_x, w_max_x, w_min_y, w_max_y, w_att in parsed_walls:
        if r_max_x < w_min_x or r_min_x > w_max_x or r_max_y < w_min_y or r_min_y > w_max_y:
            continue
        if _segments_intersect(ap_x, ap_y, px, py, wx1, wy1, wx2, wy2):
            wall_loss += w_att

    return round(tx_power_dbm - distance_loss - wall_loss, 1)


def calculate_rssi(ap_pos: Tuple[float, float], point: Tuple[float, float], tx_power_dbm: float, walls: List[Dict[str, Any]], freq_ghz: float = 2.4) -> float:
    """
    Log-distance path loss model with wall attenuation factor (WAF).
    Pl(d) = Pl(d0) + 10*n*log10(d) + sum(WallLoss)
    """
    parsed_walls = _preprocess_walls(walls, freq_ghz=freq_ghz)
    base_loss_1m, path_loss_exp_10, _, _, _ = _get_band_rf_params(freq_ghz)
    return _calculate_point_rssi_fast(
        ap_pos[0], ap_pos[1], point[0], point[1],
        tx_power_dbm, parsed_walls, base_loss_1m, path_loss_exp_10
    )


def generate_heatmap_grid(
    width_m: float,
    height_m: float,
    aps: List[Dict[str, Any]],
    walls: List[Dict[str, Any]],
    resolution: int = 30,
    freq_ghz: float = 2.4,
    sla_profile: str = "voice",
    tx_power: Optional[float] = None
) -> Dict[str, Any]:
    """
    Generate Ekahau-grade multi-mode 2D RF matrices for floorplan visualization:
    1. Primary Signal Strength (grid / primary_rssi_grid) in dBm
    2. Secondary Signal Strength (secondary_rssi_grid) in dBm for Roaming & Failover validation
    3. Signal-to-Noise Ratio (snr_grid) in dB
    4. Channel Interference / Contention Count (interference_grid)
    5. Estimated PHY/TCP Data Rate (throughput_grid) in Mbps
    """
    aps_clean, walls_clean = _normalize_aps_and_walls(aps, walls)

    res = max(10, min(50, int(resolution or 30)))
    step_x = width_m / res
    step_y = height_m / res

    target_freq = float(freq_ghz or 2.4)
    base_loss, exp_10, _, noise_floor_dbm, max_phy_mbps = _get_band_rf_params(target_freq)
    p_walls = _preprocess_walls(walls_clean, freq_ghz=target_freq)

    profile_cfg = SLA_PROFILES.get(str(sla_profile or "voice").lower(), SLA_PROFILES["voice"])
    target_threshold_dbm = profile_cfg["target_rssi_dbm"]
    secondary_threshold_dbm = profile_cfg["secondary_rssi_dbm"]
    min_snr_target = profile_cfg["min_snr_db"]

    channels_24_default = (1, 6, 11)
    channels_5_default = (36, 44, 149, 157, 161)
    channels_6_default = (37, 53, 69, 85, 101)

    fallback_tx = float(tx_power) if tx_power is not None else 20.0
    parsed_aps = []
    for idx, ap in enumerate(aps_clean):
        if not isinstance(ap, dict):
            continue
        ax = float(ap.get("x", 0.0))
        ay = float(ap.get("y", 0.0))
        atx = float(ap.get("tx_power") or ap.get("tx_power_dbm") or fallback_tx)
        if target_freq >= 5.8:
            ach = int(ap.get("channel_6") or ap.get("channel") or channels_6_default[idx % len(channels_6_default)])
        elif target_freq >= 4.0:
            ach = int(ap.get("channel_5") or ap.get("channel") or channels_5_default[idx % len(channels_5_default)])
        else:
            ach = int(ap.get("channel_24") or ap.get("channel") or channels_24_default[idx % len(channels_24_default)])
        parsed_aps.append((ax, ay, atx, ach))

    grid: List[List[float]] = []
    secondary_grid: List[List[float]] = []
    snr_grid: List[List[float]] = []
    interference_grid: List[List[int]] = []
    throughput_grid: List[List[float]] = []

    good_points = 0
    roaming_ready_points = 0
    dead_points = 0
    conflict_points = 0
    snr_pass_points = 0
    total_points = res * res

    rssi_sum = 0.0
    sec_rssi_sum = 0.0
    snr_sum = 0.0
    tp_sum = 0.0
    peak_tp = 0.0

    for j in range(res):
        row_pri: List[float] = []
        row_sec: List[float] = []
        row_snr: List[float] = []
        row_int: List[int] = []
        row_tp: List[float] = []
        y = (j + 0.5) * step_y

        for i in range(res):
            x = (i + 0.5) * step_x
            best_rssi = -110.0
            second_rssi = -110.0
            best_ch = 1
            audible_signals: List[Tuple[float, int]] = []

            for ap_x, ap_y, ap_tx, ap_ch in parsed_aps:
                rssi = _calculate_point_rssi_fast(
                    ap_x, ap_y,
                    x, y,
                    ap_tx,
                    p_walls, base_loss, exp_10
                )
                if rssi >= -85.0:
                    audible_signals.append((rssi, ap_ch))
                if rssi > best_rssi:
                    second_rssi = best_rssi
                    best_rssi = rssi
                    best_ch = ap_ch
                elif rssi > second_rssi:
                    second_rssi = rssi

            # Count co-channel or close overlapping AP contention at this point
            contention_count = 0
            if len(audible_signals) > 1:
                used_primary = False
                for sig_val, sig_ch in audible_signals:
                    if not used_primary and sig_val == best_rssi and sig_ch == best_ch:
                        used_primary = True
                        continue
                    # Same channel or overlapping 2.4GHz channel or strong nearby signal (>= -72 dBm)
                    is_co_channel = (sig_ch == best_ch) or (target_freq < 4.0 and abs(sig_ch - best_ch) < 5)
                    if is_co_channel and sig_val >= -82.0:
                        contention_count += 1
                    elif sig_val >= -68.0 and (best_rssi - sig_val) <= 8.0:
                        contention_count += 1

            # Effective SNR (dB) accounting for noise floor and co-channel interference rise
            effective_noise = noise_floor_dbm + (contention_count * 2.5)
            cell_snr = round(max(0.0, best_rssi - effective_noise), 1) if parsed_aps else 0.0
            cell_tp = _estimate_cell_throughput_mbps(cell_snr, max_phy_mbps, contention_count) if parsed_aps else 0.0

            if best_rssi >= target_threshold_dbm:
                good_points += 1
            elif best_rssi < -78.0:
                dead_points += 1

            if second_rssi >= secondary_threshold_dbm:
                roaming_ready_points += 1

            if cell_snr >= min_snr_target:
                snr_pass_points += 1

            if contention_count >= 1:
                conflict_points += 1

            rssi_sum += best_rssi
            sec_rssi_sum += second_rssi
            snr_sum += cell_snr
            tp_sum += cell_tp
            if cell_tp > peak_tp:
                peak_tp = cell_tp

            row_pri.append(best_rssi)
            row_sec.append(second_rssi)
            row_snr.append(cell_snr)
            row_int.append(contention_count)
            row_tp.append(cell_tp)

        grid.append(row_pri)
        secondary_grid.append(row_sec)
        snr_grid.append(row_snr)
        interference_grid.append(row_int)
        throughput_grid.append(row_tp)

    coverage_pct = round((good_points / max(total_points, 1)) * 100.0, 1)
    roaming_redundancy_pct = round((roaming_ready_points / max(total_points, 1)) * 100.0, 1) if len(parsed_aps) >= 2 else 0.0
    dead_zone_pct = round((dead_points / max(total_points, 1)) * 100.0, 1)
    channel_conflict_pct = round((conflict_points / max(total_points, 1)) * 100.0, 1)
    snr_pass_pct = round((snr_pass_points / max(total_points, 1)) * 100.0, 1)

    avg_rssi_dbm = round(rssi_sum / max(total_points, 1), 1) if parsed_aps else -100.0
    avg_secondary_rssi_dbm = round(sec_rssi_sum / max(total_points, 1), 1) if len(parsed_aps) >= 2 else -110.0
    avg_snr_db = round(snr_sum / max(total_points, 1), 1) if parsed_aps else 0.0
    avg_throughput_mbps = round(tp_sum / max(total_points, 1), 1) if parsed_aps else 0.0

    if target_freq >= 5.8:
        per_ap_clients = profile_cfg["clients_per_ap_6"]
    elif target_freq >= 4.0:
        per_ap_clients = profile_cfg["clients_per_ap_5"]
    else:
        per_ap_clients = profile_cfg["clients_per_ap_24"]
    capacity_max_clients = len(parsed_aps) * per_ap_clients

    sla_pass = (coverage_pct >= 85.0) and (avg_snr_db >= min_snr_target)

    return {
        "width_m": width_m,
        "height_m": height_m,
        "resolution": res,
        "freq_ghz": target_freq,
        "sla_profile": profile_cfg["id"],
        "sla_profile_name_vi": profile_cfg["name_vi"],
        "sla_profile_name_en": profile_cfg["name_en"],
        "sla_pass": sla_pass,
        "target_threshold_dbm": target_threshold_dbm,
        "secondary_threshold_dbm": secondary_threshold_dbm,
        "min_snr_target_db": min_snr_target,
        "noise_floor_dbm": noise_floor_dbm,
        "grid": grid,
        "primary_rssi_grid": grid,
        "secondary_rssi_grid": secondary_grid,
        "snr_grid": snr_grid,
        "interference_grid": interference_grid,
        "throughput_grid": throughput_grid,
        "coverage_pct": coverage_pct,
        "roaming_redundancy_pct": roaming_redundancy_pct,
        "snr_pass_pct": snr_pass_pct,
        "dead_zone_pct": dead_zone_pct,
        "channel_conflict_pct": channel_conflict_pct,
        "avg_rssi_dbm": avg_rssi_dbm,
        "avg_secondary_rssi_dbm": avg_secondary_rssi_dbm,
        "avg_snr_db": avg_snr_db,
        "avg_throughput_mbps": avg_throughput_mbps,
        "peak_throughput_mbps": round(peak_tp, 1),
        "capacity_max_clients": capacity_max_clients
    }


def optimize_ap_placement(
    width_m: float,
    height_m: float,
    walls: List[Dict[str, Any]],
    max_aps: int = 3,
    freq_ghz: float = 2.4,
    sla_profile: str = "voice"
) -> Dict[str, Any]:
    """
    Precomputed-Grid AP Placement Optimizer (Ekahau Auto-Planner style):
    Precomputes the 1D RSSI vector for every candidate position once (O(C * R^2 * W)),
    then evaluates 1-AP, 2-AP, and N-AP combinations via fast vector max operations (O(R^2)).
    Supports 2.4 GHz, 5.0 GHz, and 6.0 GHz bands plus SLA Requirement Profiles.
    """
    tx_power = 20.0
    candidate_steps = 6
    cand_x = [width_m * (i / (candidate_steps + 1)) for i in range(1, candidate_steps + 1)]
    cand_y = [height_m * (j / (candidate_steps + 1)) for j in range(1, candidate_steps + 1)]
    candidates = [(x, y) for x in cand_x for y in cand_y]

    eval_res = 15
    total_pts = eval_res * eval_res
    step_x = width_m / eval_res
    step_y = height_m / eval_res
    eval_points = [((i + 0.5) * step_x, (j + 0.5) * step_y) for j in range(eval_res) for i in range(eval_res)]

    target_freq = float(freq_ghz or 2.4)
    parsed_walls = _preprocess_walls(walls, freq_ghz=target_freq)
    base_loss_1m, path_loss_exp_10, _, _, _ = _get_band_rf_params(target_freq)

    profile_cfg = SLA_PROFILES.get(str(sla_profile or "voice").lower(), SLA_PROFILES["voice"])
    target_rssi = profile_cfg["target_rssi_dbm"]

    # Precompute 1D RSSI array for each candidate once
    cand_vectors: List[List[float]] = []
    for cx, cy in candidates:
        vec = [
            _calculate_point_rssi_fast(cx, cy, px, py, tx_power, parsed_walls, base_loss_1m, path_loss_exp_10)
            for px, py in eval_points
        ]
        cand_vectors.append(vec)

    best_indices: List[int] = [0]
    best_score_tuple = (-1.0, -999.0)  # (coverage_pct, avg_rssi)
    min_sep = math.hypot(width_m, height_m) * 0.28

    for num_aps in range(1, max_aps + 1):
        if num_aps == 1:
            for idx, vec in enumerate(cand_vectors):
                good = sum(1 for v in vec if v >= target_rssi)
                cov = (good / total_pts) * 100.0
                avg_r = sum(vec) / total_pts
                sc = (cov, avg_r)
                if sc > best_score_tuple:
                    best_score_tuple = sc
                    best_indices = [idx]
            if best_score_tuple[0] >= 88.0:
                break

        elif num_aps == 2:
            n_cand = len(candidates)
            for i in range(n_cand):
                c1 = candidates[i]
                v1 = cand_vectors[i]
                for k in range(i + 1, n_cand):
                    c2 = candidates[k]
                    if math.hypot(c1[0] - c2[0], c1[1] - c2[1]) < min_sep:
                        continue
                    v2 = cand_vectors[k]
                    good = 0
                    s_val = 0.0
                    for p in range(total_pts):
                        m_val = v1[p] if v1[p] > v2[p] else v2[p]
                        if m_val >= target_rssi:
                            good += 1
                        s_val += m_val
                    cov = (good / total_pts) * 100.0
                    sc = (cov, s_val / total_pts)
                    if sc > best_score_tuple:
                        best_score_tuple = sc
                        best_indices = [i, k]
            if best_score_tuple[0] >= 90.0:
                break

        else:
            cur_vec = [
                max(cand_vectors[idx][p] for idx in best_indices)
                for p in range(total_pts)
            ]
            chosen_coords = [candidates[idx] for idx in best_indices]
            next_best_idx = -1
            for m_idx in range(len(candidates)):
                if m_idx in best_indices:
                    continue
                cm = candidates[m_idx]
                if any(math.hypot(cm[0] - cc[0], cm[1] - cc[1]) < min_sep * 0.75 for cc in chosen_coords):
                    continue
                vm = cand_vectors[m_idx]
                good = 0
                s_val = 0.0
                for p in range(total_pts):
                    m_val = cur_vec[p] if cur_vec[p] > vm[p] else vm[p]
                    if m_val >= target_rssi:
                        good += 1
                    s_val += m_val
                cov = (good / total_pts) * 100.0
                sc = (cov, s_val / total_pts)
                if sc > best_score_tuple:
                    best_score_tuple = sc
                    next_best_idx = m_idx
            if next_best_idx >= 0:
                best_indices = best_indices + [next_best_idx]
            if best_score_tuple[0] >= 90.0:
                break

    channels_24 = (1, 6, 11)
    channels_5 = (36, 44, 149, 157, 161)
    channels_6 = (37, 53, 69, 85, 101)

    result_aps = []
    ap_channel_labels = []
    for idx, cand_idx in enumerate(best_indices):
        cx, cy = candidates[cand_idx]
        ch24 = channels_24[idx % len(channels_24)]
        ch5 = channels_5[idx % len(channels_5)]
        ch6 = channels_6[idx % len(channels_6)]
        if target_freq >= 5.8:
            active_ch = ch6
            ap_channel_labels.append(f"Trạm {idx+1}: Kênh 6 GHz {ch6} (độ rộng 160 MHz)")
        elif target_freq >= 4.0:
            active_ch = ch5
            ap_channel_labels.append(f"Trạm {idx+1}: Kênh 5 GHz {ch5} (độ rộng 80 MHz)")
        else:
            active_ch = ch24
            ap_channel_labels.append(f"Trạm {idx+1}: Kênh 2.4 GHz {ch24} (độ rộng 20 MHz)")

        result_aps.append({
            "id": idx + 1,
            "name": f"Trạm phát {idx+1}",
            "x": round(cx, 2),
            "y": round(cy, 2),
            "channel": active_ch,
            "channel_24": ch24,
            "channel_5": ch5,
            "channel_6": ch6,
            "tx_power": tx_power,
            "freq_ghz": target_freq,
            "role": "Trạm phát chính (Cổng kết nối)" if idx == 0 else f"Trạm phát phụ (Nút mở rộng {idx})"
        })

    final_hm = generate_heatmap_grid(
        width_m, height_m, result_aps, walls,
        resolution=28, freq_ghz=target_freq, sla_profile=sla_profile
    )

    band_label = "6 GHz (chuẩn Wi-Fi 6E/7)" if target_freq >= 5.8 else ("5 GHz (chuẩn Wi-Fi 5/6)" if target_freq >= 4.0 else "2.4 GHz")

    return {
        "status": "success",
        "recommended_ap_count": len(result_aps),
        "coverage_percentage": final_hm["coverage_pct"],
        "roaming_redundancy_percentage": final_hm["roaming_redundancy_pct"],
        "dead_zone_percentage": final_hm["dead_zone_pct"],
        "channel_conflict_percentage": final_hm["channel_conflict_pct"],
        "avg_rssi_dbm": final_hm["avg_rssi_dbm"],
        "avg_snr_db": final_hm["avg_snr_db"],
        "avg_throughput_mbps": final_hm["avg_throughput_mbps"],
        "capacity_max_clients": final_hm["capacity_max_clients"],
        "sla_profile": final_hm["sla_profile"],
        "sla_pass": final_hm["sla_pass"],
        "quality_rating": "Rất tốt" if final_hm["coverage_pct"] >= 90 else ("Tốt" if final_hm["coverage_pct"] >= 75 else "Khá"),
        "access_points": result_aps,
        "heatmap": final_hm,
        "ai_rationale": [
            f"Đề xuất bố trí {len(result_aps)} trạm phát trên băng tần {band_label} nhằm bao phủ {final_hm['coverage_pct']}% diện tích mặt bằng (đáp ứng ngưỡng {final_hm['target_threshold_dbm']} dBm), mức tín hiệu trung bình đạt {final_hm['avg_rssi_dbm']} dBm và SNR trung bình {final_hm['avg_snr_db']} dB.",
            f"Phân bổ kênh tự động không trùng lặp ({', '.join(ap_channel_labels)}) giúp giảm thiểu xung đột kênh và đạt tốc độ truyền dự kiến trung bình {final_hm['avg_throughput_mbps']} Mbps (đáp ứng tối đa khoảng {final_hm['capacity_max_clients']} thiết bị kết nối đồng thời).",
            f"Đã tính toán độ suy hao xuyên qua {len(walls)} vách ngăn trên sơ đồ (tỷ lệ vùng phủ sóng dự phòng chuyển vùng đạt {final_hm['roaming_redundancy_pct']}%, tỷ lệ vùng góc khuất tín hiệu yếu: {final_hm['dead_zone_pct']}%)."
        ]
    }
