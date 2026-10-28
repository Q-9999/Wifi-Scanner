# -*- coding: utf-8 -*-
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
tool_dir = os.path.dirname(os.path.abspath(__file__))
if tool_dir not in sys.path:
    sys.path.append(tool_dir)

import wifi_scanner
import channel_analyzer
import ai_planner
import vowifi_analyzer
import report_generator
from fastapi.testclient import TestClient
import server

networks, interface, clusters, threats = wifi_scanner.scan_wifi_with_interface()
analysis = channel_analyzer.analyze_wifi_environment(networks, connected_interface=interface, security_threats=threats)

print("=== MMQ./NetScanner Verification Suite ===")
print(f"Total Networks (BSSIDs): {len(networks)}")
print(f"Total Physical Clusters: {len(clusters)}")
print(f"Security Audit Summary: {threats}")
print(f"Connected Interface: {interface.get('interface_name')} | SSID: {interface.get('ssid')} | IP/BSSID: {interface.get('bssid')}")

# 1. Verify SNR, Noise Floor, MCS Index, and De-cloaking Accuracy
nf_ch6 = wifi_scanner.estimate_channel_noise_floor(6, "2.4 GHz", 3)
assert -98 <= nf_ch6 <= -78, f"Unexpected noise floor: {nf_ch6}"

for net in networks:
    assert "snr_db" in net and "noise_floor_dbm" in net, "Missing SNR / Noise Floor fields"
    assert "mcs_index" in net and "modulation" in net, "Missing MCS / Modulation fields"
    assert "est_throughput_mbps" in net, "Missing estimated real TCP/IP throughput"

# Ensure standalone hidden networks without named siblings are NOT falsely marked as decloaked
for c in clusters:
    named_in_cluster = [m for m in c["members"] if not m.get("is_hidden")]
    for m in c["members"]:
        if m.get("is_decloaked"):
            assert len(named_in_cluster) > 0, f"False de-cloaking on standalone hidden BSSID {m.get('bssid')}"

# 2. Verify Channel Analyzer: 6 GHz + Oscium Troubleshooting Suite + Roaming & Airtime Audits
assert "roaming_audit" in analysis, "Missing roaming_audit in channel analysis"
assert "airtime_breakdown" in analysis, "Missing airtime_breakdown in channel analysis"
assert "channels_6ghz" in analysis and len(analysis["channels_6ghz"]) > 0, "Missing 6 GHz channel evaluations"
assert "best_6ghz_channel" in analysis["summary"], "Missing best_6ghz_channel in summary"
assert "troubleshooting_suite" in analysis, "Missing Oscium troubleshooting_suite in channel analysis"
ts = analysis["troubleshooting_suite"]
assert "spectrum_classifiers" in ts and len(ts["spectrum_classifiers"]) >= 4, "Expected Oscium spectrum classifiers"
assert "checklist" in ts and len(ts["checklist"]) == 6, f"Expected 6-point Oscium troubleshooting checklist, got {len(ts.get('checklist', []))}"
assert "non_wifi_interferers" in ts and len(ts["non_wifi_interferers"]) == 4, "Expected 4 non-Wi-Fi interferer signatures"
assert "health_score" in ts and 0 <= ts["health_score"] <= 100, "Missing or invalid health_score in troubleshooting_suite"
assert "estimated_retry_rate_pct" in ts, "Missing estimated_retry_rate_pct"

# 3. Verify Ekahau 5-Mode Floorplan RF Heatmap & Tri-Band Differentiation (2.4 GHz vs 5.0 GHz vs 6.0 GHz)
walls = [{"x1": 6.0, "y1": 0.0, "x2": 6.0, "y2": 8.0, "material": "concrete"}]
plan_24 = ai_planner.optimize_ap_placement(12.0, 8.0, walls, max_aps=3, freq_ghz=2.4, sla_profile="office")
hm_24 = ai_planner.generate_heatmap_grid(12.0, 8.0, walls, plan_24["access_points"], freq_ghz=2.4, sla_profile="office")
hm_50 = ai_planner.generate_heatmap_grid(12.0, 8.0, walls, plan_24["access_points"], freq_ghz=5.0, sla_profile="voice")
hm_60 = ai_planner.generate_heatmap_grid(12.0, 8.0, walls, plan_24["access_points"], freq_ghz=6.0, sla_profile="high_density")

for hm_check in (hm_24, hm_50, hm_60):
    for key in ("grid", "primary_rssi_grid", "secondary_rssi_grid", "snr_grid", "interference_grid", "throughput_grid"):
        assert key in hm_check and len(hm_check[key]) > 0, f"Missing Ekahau heatmap matrix: {key}"
    for metric in ("coverage_pct", "roaming_redundancy_pct", "avg_snr_db", "avg_throughput_mbps", "peak_throughput_mbps", "channel_conflict_pct", "capacity_max_clients", "sla_pass"):
        assert metric in hm_check, f"Missing Ekahau KPI metric: {metric}"

assert hm_24["grid"] != hm_50["grid"], "5.0 GHz heatmap must differ from 2.4 GHz heatmap"
assert hm_50["grid"] != hm_60["grid"], "6.0 GHz heatmap must differ from 5.0 GHz heatmap"
assert hm_24["coverage_pct"] >= hm_50["coverage_pct"] >= hm_60["coverage_pct"], "Coverage through concrete walls must decrease with higher frequency"

# Verify swapped positional argument resilience (aps, walls) vs (walls, aps)
hm_swapped = ai_planner.generate_heatmap_grid(12.0, 8.0, plan_24["access_points"], walls, freq_ghz=2.4, sla_profile="office")
assert hm_swapped["grid"] == hm_24["grid"], "Swapped positional arguments (aps, walls) must normalize identically"

# 4. Verify VoWiFi Multi-Hop Path Audit & ITU-T G.107 MOS
dns_res = vowifi_analyzer.measure_dns_resolution_ms("google.com")
assert isinstance(dns_res, dict) and dns_res.get("dns_latency_ms", -1) >= 0.0, f"Invalid DNS latency result: {dns_res}"
vowifi_res = vowifi_analyzer.measure_network_quality("127.0.0.1", ping_count=2)
assert 1.0 <= vowifi_res["mos_score"] <= 4.5, f"Unexpected MOS score: {vowifi_res}"
assert "gateway_ip" in vowifi_res and "gateway_latency_ms" in vowifi_res and "dns_latency_ms" in vowifi_res and "path_diagnosis_vi" in vowifi_res, "Missing Multi-Hop VoWiFi fields"

# 5. Verify FastAPI Endpoints via TestClient
client = TestClient(server.app)
r_rec = client.get("/api/channel-recommendations")
assert r_rec.status_code == 200
rec_json = r_rec.json()
assert "channels_6ghz" in rec_json and "troubleshooting_suite" in rec_json

r_ts = client.get("/api/troubleshooting/all-in-one")
assert r_ts.status_code == 200
ts_json = r_ts.json()
assert ts_json["status"] == "success" and "troubleshooting_suite" in ts_json

r_opt = client.post("/api/ai-planner/optimize", json={
    "width_m": 14.0,
    "height_m": 9.0,
    "walls": walls,
    "max_aps": 3,
    "freq_ghz": 6.0,
    "sla_profile": "high_density"
})
assert r_opt.status_code == 200
opt_json = r_opt.json()
assert "heatmap" in opt_json and "secondary_rssi_grid" in opt_json["heatmap"]
assert all("channel_6" in ap for ap in opt_json["access_points"])

print("\n--- Physical Device Clusters & De-cloaked Hidden Networks ---")
for c in clusters[:5]:
    has_decloaked = any(m.get('is_decloaked') for m in c['members'])
    flag = "==> [UNCLOAKED MESH LINK FOUND] <==" if has_decloaked else ""
    print(f"\n[+] {c['cluster_name']} ({c['bss_count']} BSSIDs) {flag}")
    for m in c['members']:
        tag = f"--> UNCLOAKED: {m['decloaked_ssid']}" if m.get('is_decloaked') else ""
        dfs = "[DFS Radar]" if m.get('is_dfs') else ""
        print(f"     - {m['ssid']:<22} | {m['bssid']} | Ch {m['channel']:<3} {dfs:<11} | {m['signal_percent']}% (SNR {m['snr_db']}dB, MCS {m['mcs_index']}) | {m['vendor']} {tag}")

print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")
