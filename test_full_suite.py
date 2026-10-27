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
import report_generator

networks, interface, clusters, threats = wifi_scanner.scan_wifi_with_interface()
analysis = channel_analyzer.analyze_wifi_environment(networks)

print("=== MMQ./NetScanner v3.0 Verification Suite ===")
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

# 2. Verify Channel Analyzer Roaming & Airtime Audits
assert "roaming_audit" in analysis, "Missing roaming_audit in channel analysis"
assert "airtime_breakdown" in analysis, "Missing airtime_breakdown in channel analysis"

# 3. Verify Floorplan RF Heatmap 2.4 GHz vs 5.0 GHz Differentiation
walls = [{"x1": 6.0, "y1": 0.0, "x2": 6.0, "y2": 8.0, "material": "concrete"}]
plan_24 = ai_planner.optimize_ap_placement(12.0, 8.0, walls, max_aps=3, freq_ghz=2.4)
hm_24 = ai_planner.generate_heatmap_grid(12.0, 8.0, walls, plan_24["access_points"], freq_ghz=2.4)
hm_50 = ai_planner.generate_heatmap_grid(12.0, 8.0, walls, plan_24["access_points"], freq_ghz=5.0)
assert hm_24["grid"] != hm_50["grid"], "5.0 GHz heatmap must differ from 2.4 GHz heatmap even when APs have freq_ghz preset"
assert hm_24["coverage_pct"] >= hm_50["coverage_pct"], "2.4 GHz coverage should be >= 5.0 GHz coverage through concrete walls"

print("\n--- Physical Device Clusters & De-cloaked Hidden Networks ---")
for c in clusters:
    has_decloaked = any(m.get('is_decloaked') for m in c['members'])
    flag = "==> [UNCLOAKED MESH LINK FOUND] <==" if has_decloaked else ""
    print(f"\n[+] {c['cluster_name']} ({c['bss_count']} BSSIDs) {flag}")
    for m in c['members']:
        tag = f"--> UNCLOAKED: {m['decloaked_ssid']}" if m.get('is_decloaked') else ""
        dfs = "[DFS Radar]" if m.get('is_dfs') else ""
        print(f"     - {m['ssid']:<22} | {m['bssid']} | Ch {m['channel']:<3} {dfs:<11} | {m['signal_percent']}% (SNR {m['snr_db']}dB, MCS {m['mcs_index']}) | {m['vendor']} {tag}")

print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")
