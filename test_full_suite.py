# -*- coding: utf-8 -*-
"""
test_full_suite.py — Bộ kiểm thử tự động toàn diện dự án MMQ./NetScanner (Milestone M_C)
Bao gồm 9 phần kiểm định:
  1. Kiểm thử SNR, Noise Floor, MCS Index, Modulation, Throughput và De-cloaking BSSID.
  2. Kiểm thử Channel Analyzer: Băng tần 6 GHz, Oscium Troubleshooting Suite, Roaming & Airtime.
  3. Kiểm thử Ekahau 5-Mode Floorplan RF Heatmap & Tri-Band Differentiation (2.4/5.0/6.0 GHz).
  4. Kiểm thử VoWiFi Multi-Hop Path Audit & ITU-T G.107 MOS Score.
  5. Kiểm thử các điểm cuối FastAPI REST API cơ sở (Channel, Oscium, Heatmap Optimizer).
  6. Kiểm thử Speed Test Backend & API (SpeedTestRunner mock < 0.05s, 10 trường cốt lõi, 4 API endpoints).
  7. Kiểm thử tính toàn vẹn ngôn ngữ và chuẩn không biểu tượng (0 Emojis, 0 Lucide, 0 Bilingual Slashes).
  8. Kiểm thử kiến trúc giao diện nền sáng (Light Mode :root variables, 0 data-theme, 0 dark mode rules).
  9. Kiểm thử đồng bộ tài liệu dự án (PROJECT_OVERVIEW.md & README.md: 0 Emojis, đầy đủ 8 tab chức năng).
"""

import sys
import os
import re
import json
import time

sys.stdout.reconfigure(encoding='utf-8')
tool_dir = os.path.dirname(os.path.abspath(__file__))
if tool_dir not in sys.path:
    sys.path.append(tool_dir)

import wifi_scanner
import channel_analyzer
import ai_planner
import vowifi_analyzer
import report_generator
import speedtest_runner
from fastapi.testclient import TestClient
import server

# Khởi tạo dữ liệu quét sóng môi trường
networks, interface, clusters, threats = wifi_scanner.scan_wifi_with_interface()
analysis = channel_analyzer.analyze_wifi_environment(networks, connected_interface=interface, security_threats=threats)

print("=== MMQ./NetScanner Verification Suite ===")
print(f"Total Networks (BSSIDs): {len(networks)}")
print(f"Total Physical Clusters: {len(clusters)}")
print(f"Security Audit Summary: {threats}")
print(f"Connected Interface: {interface.get('interface_name')} | SSID: {interface.get('ssid')} | IP/BSSID: {interface.get('bssid')}")

# ==============================================================================
# 1. Verify SNR, Noise Floor, MCS Index, and De-cloaking Accuracy
# ==============================================================================
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

# ==============================================================================
# 2. Verify Channel Analyzer: 6 GHz + Oscium Troubleshooting Suite + Roaming & Airtime Audits
# ==============================================================================
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

# ==============================================================================
# 3. Verify Ekahau 5-Mode Floorplan RF Heatmap & Tri-Band Differentiation (2.4 GHz vs 5.0 GHz vs 6.0 GHz)
# ==============================================================================
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

# ==============================================================================
# 4. Verify VoWiFi Multi-Hop Path Audit & ITU-T G.107 MOS
# ==============================================================================
dns_res = vowifi_analyzer.measure_dns_resolution_ms("google.com")
assert isinstance(dns_res, dict) and dns_res.get("dns_latency_ms", -1) >= 0.0, f"Invalid DNS latency result: {dns_res}"
vowifi_res = vowifi_analyzer.measure_network_quality("127.0.0.1", ping_count=2)
assert 1.0 <= vowifi_res["mos_score"] <= 4.5, f"Unexpected MOS score: {vowifi_res}"
assert "gateway_ip" in vowifi_res and "gateway_latency_ms" in vowifi_res and "dns_latency_ms" in vowifi_res and "path_diagnosis_vi" in vowifi_res, "Missing Multi-Hop VoWiFi fields"

# ==============================================================================
# 5. Verify FastAPI Endpoints via TestClient
# ==============================================================================
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

# ==============================================================================
# 6. Verify Speed Test Backend & API
# ==============================================================================
runner = speedtest_runner.SpeedTestRunner()
t_mock_start = time.perf_counter()
start_res = runner.start(mode="mock")
wall_time = time.perf_counter() - t_mock_start

assert start_res.get("status") == "running", f"Mock start status expected 'running', got {start_res}"
assert wall_time < 0.2, f"Mock execution wall clock exceeded 0.2s: {wall_time:.4f}s"

st_mock = runner.get_state()
assert st_mock["elapsed_seconds"] <= 0.05, f"Mock elapsed_seconds expected <= 0.05, got {st_mock['elapsed_seconds']}"

core_speed_fields = [
    "status", "stage", "progress_pct", "ping_ms", "jitter_ms",
    "download_mbps", "upload_mbps", "link_speed_mbps", "diagnosis_vi", "network_context"
]
for field in core_speed_fields:
    assert field in st_mock, f"Missing core speed test field: {field}"

assert st_mock["status"] == "completed" and st_mock["stage"] == "finished"
assert st_mock["progress_pct"] == 100
assert st_mock["download_mbps"] > 0 and st_mock["upload_mbps"] > 0 and st_mock["ping_ms"] > 0
assert isinstance(st_mock["network_context"], dict)

# Test 4 FastAPI Speed Test API endpoints
r_api_start = client.post("/api/speedtest/start", json={"mode": "mock"})
assert r_api_start.status_code == 200
assert r_api_start.json().get("status") == "running"

r_api_status = client.get("/api/speedtest/status")
assert r_api_status.status_code == 200
api_st = r_api_status.json()
for field in core_speed_fields:
    assert field in api_st, f"Missing core field in /api/speedtest/status: {field}"

sse_received = False
with client.stream("GET", "/api/speedtest/stream") as stream:
    for line in stream.iter_lines():
        if line and line.startswith("data: "):
            ev_data = json.loads(line[6:].strip())
            assert "status" in ev_data and "progress_pct" in ev_data
            sse_received = True
            break
assert sse_received, "Failed to receive SSE event from /api/speedtest/stream"

client.post("/api/speedtest/start", json={"mode": "quick"})
r_api_stop = client.post("/api/speedtest/stop")
assert r_api_stop.status_code == 200
assert r_api_stop.json().get("status") == "stopped"

# ==============================================================================
# 7. Verify Static Asset Language & Symbol Integrity (Zero Emojis, Zero Lucide)
# ==============================================================================
static_dir = os.path.join(tool_dir, "static")
static_assets = ["index.html", "styles.css", "app.js", "lucide.min.js"]

emoji_pattern = re.compile(
    r'[\U00010000-\U0010ffff]|[\u2600-\u27bf]|[\u2300-\u23ff]|[\u2b50-\u2b55]|[\u200d]|[\ufe00-\ufe0f]'
)
html_entity_pattern = re.compile(
    r'&#(?:x1[fF][0-9a-fA-F]{3}|12[89][0-9]{4});'
)
lucide_tag_pattern = re.compile(r'<i\s+[^>]*data-lucide', re.IGNORECASE)

forbidden_bilingual_patterns = [
    re.compile(p, re.IGNORECASE) for p in [
        r'Sáng\s*/\s*Tối', r'Light\s*/\s*Dark', r'VI\s*/\s*EN', r'Tiếng Việt\s*/\s*English',
        r'Khảo sát\s*/\s*Survey', r'Survey\s*/\s*Khảo sát',
        r'Báo cáo\s*/\s*Reports', r'Reports\s*/\s*Báo cáo',
        r'Tối ưu\s*/\s*Optimizer', r'Optimizer\s*/\s*Tối ưu',
        r'An ninh\s*/\s*Security', r'Security\s*/\s*An ninh',
        r'Bản đồ\s*/\s*Planner', r'Planner\s*/\s*Bản đồ',
        r'Bản đồ\s*/\s*Heatmap', r'Heatmap\s*/\s*Bản đồ'
    ]
]

for asset_name in static_assets:
    asset_path = os.path.join(static_dir, asset_name)
    assert os.path.exists(asset_path), f"Static asset {asset_name} not found"
    with open(asset_path, "r", encoding="utf-8", errors="replace") as f:
        asset_content = f.read()

    assert not emoji_pattern.search(asset_content), f"Forbidden emoji character found in {asset_name}"
    assert not html_entity_pattern.search(asset_content), f"Forbidden emoji HTML entity found in {asset_name}"
    assert not lucide_tag_pattern.search(asset_content), f"Forbidden <i data-lucide> tag found in {asset_name}"

    for pattern in forbidden_bilingual_patterns:
        assert not pattern.search(asset_content), f"Forbidden bilingual slash string found in {asset_name}: {pattern.pattern}"

# ==============================================================================
# 8. Verify CSS Pure Light Mode Architecture
# ==============================================================================
css_file = os.path.join(static_dir, "styles.css")
with open(css_file, "r", encoding="utf-8") as f:
    css_content = f.read()

root_block_match = re.search(r':root\s*\{([^}]+)\}', css_content)
assert root_block_match, "Missing :root declaration in styles.css"
root_block = root_block_match.group(1)

assert "color-scheme: light" in root_block, "Missing color-scheme: light in styles.css :root"
assert ("--bg-main: #f8fafc" in root_block or "--bg-primary: #f8fafc" in root_block), "Missing light background variable #f8fafc"
assert ("--bg-card: #ffffff" in root_block or "--card-bg: #ffffff" in root_block), "Missing white card background variable #ffffff"
assert "--text-primary: #0f172a" in root_block, "Missing dark text variable #0f172a"

assert '[data-theme="light"]' not in css_content, "Obsolete selector [data-theme='light'] found in styles.css"
assert '[data-theme="dark"]' not in css_content, "Obsolete selector [data-theme='dark'] found in styles.css"
assert "prefers-color-scheme: dark" not in css_content, "Obsolete dark mode media query found in styles.css"

# ==============================================================================
# 9. Verify Project Documentation Integrity (Zero Emojis & 8 Tabs Documented)
# ==============================================================================
required_tabs = [
    ("Tab 1 - Quét sóng (Survey)", ["khảo sát", "survey", "quét"]),
    ("Tab 2 - Phổ tần vô tuyến (Spectrum)", ["phổ tần", "spectrum"]),
    ("Tab 3 - Tối ưu hóa & Chẩn đoán Oscium (Optimizer)", ["tối ưu", "oscium", "optimizer"]),
    ("Tab 4 - Đánh giá chất lượng thoại VoWiFi (VoWiFi)", ["vowifi", "vowi-fi", "thoại", "mos"]),
    ("Tab 5 - Bản đồ nhiệt sóng (Planner)", ["bản đồ nhiệt", "heatmap", "planner", "ekahau"]),
    ("Tab 6 - Đo tốc độ mạng (Speed Test)", ["tốc độ", "speed test", "speedtest"]),
    ("Tab 7 - Kiểm tra an toàn bảo mật (Security Audit)", ["an toàn", "bảo mật", "security"]),
    ("Tab 8 - Lưu trữ và xuất báo cáo (Reports)", ["báo cáo", "report", "reports"])
]

for doc_file in ["PROJECT_OVERVIEW.md", "README.md"]:
    doc_path = os.path.join(tool_dir, doc_file)
    assert os.path.exists(doc_path), f"Documentation file {doc_file} not found"
    with open(doc_path, "r", encoding="utf-8") as f:
        doc_content = f.read()

    doc_emojis = emoji_pattern.findall(doc_content)
    assert len(doc_emojis) == 0, f"Found {len(doc_emojis)} forbidden emojis in {doc_file}: {doc_emojis[:5]}"

    doc_lower = doc_content.lower()
    for tab_label, keywords in required_tabs:
        assert any(kw in doc_lower for kw in keywords), f"{doc_file} is missing documentation for {tab_label}"

# Hiển thị thông tin các cụm phần cứng & mạng ẩn đã giải mã
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
