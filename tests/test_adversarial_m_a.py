# -*- coding: utf-8 -*-
"""
Adversarial Verification Suite for Milestone M_A (Backend Core Services & APIs)
Empirically challenges:
  - channel_analyzer.py
  - vowifi_analyzer.py
  - report_generator.py
  - speedtest_runner.py & server.py
"""
import sys
import os
import tempfile
import csv
import json

# Force UTF-8 encoding for standard output
sys.stdout.reconfigure(encoding='utf-8')

tool_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
if tool_dir not in sys.path:
    sys.path.append(tool_dir)

from core import channel_analyzer
from core import vowifi_analyzer
from core import report_generator
from core import wifi_scanner
from core import ai_planner
from core import speedtest_runner
from fastapi.testclient import TestClient
from api import server

test_results = {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "failures": []
}

def record_test(name: str, passed: bool, detail: str = ""):
    test_results["total"] += 1
    if passed:
        test_results["passed"] += 1
        print(f"[PASS] {name}")
    else:
        test_results["failed"] += 1
        test_results["failures"].append({"name": name, "detail": detail})
        print(f"[FAIL] {name}: {detail}")


print("=" * 70)
print("RUNNING ADVERSARIAL VERIFICATION SUITE — MILESTONE M_A")
print("=" * 70)

# ==============================================================================
# SUITE 1: Empty Networks & Interface Null/Empty Variations
# ==============================================================================
print("\n--- SUITE 1: Empty Networks & Interface Null/Empty Variations ---")

# 1.1 Empty networks list
try:
    res_empty = channel_analyzer.analyze_wifi_environment([])
    assert isinstance(res_empty, dict)
    assert res_empty.get("total_aps") == 0
    assert "troubleshooting_suite" in res_empty
    record_test("1.1 analyze_wifi_environment with empty list []", True)
except Exception as e:
    record_test("1.1 analyze_wifi_environment with empty list []", False, str(e))

# 1.2 connected_interface=None
try:
    diag_none = channel_analyzer._evaluate_adapter_diagnostics(None)
    assert diag_none["status"] == "NGẮT KẾT NỐI"
    assert diag_none["is_connected"] is False
    assert diag_none["signal_adequacy"] == "CHƯA KẾT NỐI"
    assert len(diag_none["recommendations"]) > 0
    record_test("1.2 _evaluate_adapter_diagnostics(None)", True)
except Exception as e:
    record_test("1.2 _evaluate_adapter_diagnostics(None)", False, str(e))

# 1.3 connected_interface={}
try:
    diag_empty_dict = channel_analyzer._evaluate_adapter_diagnostics({})
    assert diag_empty_dict["status"] == "NGẮT KẾT NỐI"
    assert diag_empty_dict["is_connected"] is False
    assert diag_empty_dict["signal_adequacy"] == "CHƯA KẾT NỐI"
    record_test("1.3 _evaluate_adapter_diagnostics({})", True)
except Exception as e:
    record_test("1.3 _evaluate_adapter_diagnostics({})", False, str(e))

# 1.4 connected_interface={'connected': False}
try:
    diag_conn_false = channel_analyzer._evaluate_adapter_diagnostics({"connected": False})
    assert diag_conn_false["status"] == "NGẮT KẾT NỐI"
    assert diag_conn_false["is_connected"] is False
    record_test("1.4 _evaluate_adapter_diagnostics({'connected': False})", True)
except Exception as e:
    record_test("1.4 _evaluate_adapter_diagnostics({'connected': False})", False, str(e))


# ==============================================================================
# SUITE 2: Adapter Diagnostics Missing Keys & Extreme Values
# ==============================================================================
print("\n--- SUITE 2: Adapter Diagnostics Missing Keys & Extreme Values ---")

# 2.1 connected_interface={'connected': True} with NO OTHER KEYS
try:
    diag_conn_true_only = channel_analyzer._evaluate_adapter_diagnostics({"connected": True})
    assert diag_conn_true_only["is_connected"] is True
    assert "status" in diag_conn_true_only
    assert "rx_tx_symmetry" in diag_conn_true_only
    assert "signal_adequacy" in diag_conn_true_only
    assert isinstance(diag_conn_true_only["recommendations"], list)
    assert len(diag_conn_true_only["recommendations"]) > 0
    record_test("2.1 _evaluate_adapter_diagnostics({'connected': True}) without extra keys", True)
except Exception as e:
    record_test("2.1 _evaluate_adapter_diagnostics({'connected': True}) without extra keys", False, str(e))

# 2.2 Extreme RSSI: -110 dBm
try:
    diag_extreme_low = channel_analyzer._evaluate_adapter_diagnostics({
        "connected": True,
        "rssi": -110,
        "signal": 0
    })
    assert diag_extreme_low["rssi_dbm"] == -110
    assert diag_extreme_low["signal_adequacy"] == "KHÔNG ĐẠT YÊU CẦU"
    assert diag_extreme_low["status"] == "CẢNH BÁO SÓNG YẾU"
    record_test("2.2 Adapter Diagnostics with extreme RSSI -110 dBm", True)
except Exception as e:
    record_test("2.2 Adapter Diagnostics with extreme RSSI -110 dBm", False, str(e))

# 2.3 Extreme RSSI: 0 dBm (Edge case: does '0 or -100' invert 0 to -100?)
try:
    diag_extreme_0 = channel_analyzer._evaluate_adapter_diagnostics({
        "connected": True,
        "rssi": 0,
        "signal": 100
    })
    # If code uses `get("rssi") or -100`, 0 dBm becomes -100 dBm!
    if diag_extreme_0["rssi_dbm"] == -100:
        record_test(
            "2.3 Adapter Diagnostics with RSSI 0 dBm (Falsy 0 check)",
            False,
            f"RSSI 0 dBm was incorrectly converted to -100 dBm due to `or -100` falsy logic"
        )
    else:
        assert diag_extreme_0["rssi_dbm"] == 0
        record_test("2.3 Adapter Diagnostics with RSSI 0 dBm", True)
except Exception as e:
    record_test("2.3 Adapter Diagnostics with RSSI 0 dBm", False, str(e))


# ==============================================================================
# SUITE 3: Automated Root Cause Decision Tree Coverage
# ==============================================================================
print("\n--- SUITE 3: Automated Root Cause Decision Tree Coverage ---")

def validate_root_cause_schema(rc: dict, label: str):
    assert "primary_issue_vi" in rc and isinstance(rc["primary_issue_vi"], str) and len(rc["primary_issue_vi"]) > 0, f"{label}: missing or empty primary_issue_vi"
    assert "severity" in rc and rc["severity"] in ("info", "warning", "critical"), f"{label}: invalid severity {rc.get('severity')}"
    assert "action_steps_vi" in rc and isinstance(rc["action_steps_vi"], list) and len(rc["action_steps_vi"]) > 0, f"{label}: missing or empty action_steps_vi"
    for step in rc["action_steps_vi"]:
        assert isinstance(step, str) and len(step) > 0, f"{label}: step is not a non-empty string"

# 3.1 Branch 1: Open network security issue (CRITICAL)
try:
    checklist_crit = [{"id": "POINT_6_SECURITY", "status": "CRITICAL"}]
    rc1 = channel_analyzer._evaluate_automated_root_cause(
        checklist=checklist_crit, non_wifi_interferers=[], adapter_diag={},
        eval_24={}, eval_5={}, free_air=80, est_retry_rate_pct=2.0, non_std_24_count=0, wide_24_count=0
    )
    validate_root_cause_schema(rc1, "Branch 1")
    assert rc1["severity"] == "critical"
    record_test("3.1 Automated Root Cause: Open network security (CRITICAL)", True)
except Exception as e:
    record_test("3.1 Automated Root Cause: Open network security (CRITICAL)", False, str(e))

# 3.2 Branch 2: Weak adapter signal (WARNING)
try:
    adapter_weak = {"is_connected": True, "signal_adequacy": "KHÔNG ĐẠT YÊU CẦU", "rssi_dbm": -85}
    rc2 = channel_analyzer._evaluate_automated_root_cause(
        checklist=[], non_wifi_interferers=[], adapter_diag=adapter_weak,
        eval_24={}, eval_5={}, free_air=80, est_retry_rate_pct=2.0, non_std_24_count=0, wide_24_count=0
    )
    validate_root_cause_schema(rc2, "Branch 2")
    assert rc2["severity"] == "warning"
    record_test("3.2 Automated Root Cause: Weak adapter signal (WARNING)", True)
except Exception as e:
    record_test("3.2 Automated Root Cause: Weak adapter signal (WARNING)", False, str(e))

# 3.3 Branch 3: Rx/Tx asymmetry (WARNING)
try:
    adapter_asym = {"is_connected": True, "rx_tx_symmetry": "BẤT ĐỐI XỨNG CHIỀU PHÁT", "rx_rate_mbps": 866.0, "tx_rate_mbps": 24.0}
    rc3 = channel_analyzer._evaluate_automated_root_cause(
        checklist=[], non_wifi_interferers=[], adapter_diag=adapter_asym,
        eval_24={}, eval_5={}, free_air=80, est_retry_rate_pct=2.0, non_std_24_count=0, wide_24_count=0
    )
    validate_root_cause_schema(rc3, "Branch 3")
    assert rc3["severity"] == "warning"
    record_test("3.3 Automated Root Cause: Rx/Tx asymmetry (WARNING)", True)
except Exception as e:
    record_test("3.3 Automated Root Cause: Rx/Tx asymmetry (WARNING)", False, str(e))

# 3.4 Branch 4: Adjacent channel interference ACI (WARNING)
try:
    rc4 = channel_analyzer._evaluate_automated_root_cause(
        checklist=[], non_wifi_interferers=[], adapter_diag={},
        eval_24={"recommended_channel": 6}, eval_5={}, free_air=80, est_retry_rate_pct=2.0, non_std_24_count=3, wide_24_count=1
    )
    validate_root_cause_schema(rc4, "Branch 4")
    assert rc4["severity"] == "warning"
    record_test("3.4 Automated Root Cause: ACI 2.4 GHz interference (WARNING)", True)
except Exception as e:
    record_test("3.4 Automated Root Cause: ACI 2.4 GHz interference (WARNING)", False, str(e))

# 3.5 Branch 5: Microwave non-Wi-Fi interferer (WARNING)
try:
    non_wifi_micro = [{"id": "MICROWAVE_OVEN", "detected": True}]
    rc5 = channel_analyzer._evaluate_automated_root_cause(
        checklist=[], non_wifi_interferers=non_wifi_micro, adapter_diag={},
        eval_24={"recommended_channel": 1}, eval_5={}, free_air=80, est_retry_rate_pct=2.0, non_std_24_count=0, wide_24_count=0
    )
    validate_root_cause_schema(rc5, "Branch 5")
    assert rc5["severity"] == "warning"
    record_test("3.5 Automated Root Cause: Microwave interference (WARNING)", True)
except Exception as e:
    record_test("3.5 Automated Root Cause: Microwave interference (WARNING)", False, str(e))

# 3.6 Branch 6: Airtime congestion / high retry rate (WARNING)
try:
    rc6 = channel_analyzer._evaluate_automated_root_cause(
        checklist=[], non_wifi_interferers=[], adapter_diag={},
        eval_24={}, eval_5={}, free_air=30, est_retry_rate_pct=22.0, non_std_24_count=0, wide_24_count=0
    )
    validate_root_cause_schema(rc6, "Branch 6")
    assert rc6["severity"] == "warning"
    record_test("3.6 Automated Root Cause: Airtime congestion (WARNING)", True)
except Exception as e:
    record_test("3.6 Automated Root Cause: Airtime congestion (WARNING)", False, str(e))

# 3.7 Branch 7: Sticky client roaming risk (WARNING)
try:
    checklist_roam = [{"id": "POINT_5_ROAMING", "status": "WARNING"}]
    rc7 = channel_analyzer._evaluate_automated_root_cause(
        checklist=checklist_roam, non_wifi_interferers=[], adapter_diag={},
        eval_24={}, eval_5={}, free_air=80, est_retry_rate_pct=2.0, non_std_24_count=0, wide_24_count=0
    )
    validate_root_cause_schema(rc7, "Branch 7")
    assert rc7["severity"] == "warning"
    record_test("3.7 Automated Root Cause: Sticky client roaming risk (WARNING)", True)
except Exception as e:
    record_test("3.7 Automated Root Cause: Sticky client roaming risk (WARNING)", False, str(e))

# 3.8 Branch 8: Clean and healthy baseline (INFO)
try:
    rc8 = channel_analyzer._evaluate_automated_root_cause(
        checklist=[], non_wifi_interferers=[], adapter_diag={},
        eval_24={"recommended_channel": 1}, eval_5={"recommended_channel": 36}, free_air=80, est_retry_rate_pct=2.0, non_std_24_count=0, wide_24_count=0
    )
    validate_root_cause_schema(rc8, "Branch 8")
    assert rc8["severity"] == "info"
    record_test("3.8 Automated Root Cause: Clean baseline (INFO)", True)
except Exception as e:
    record_test("3.8 Automated Root Cause: Clean baseline (INFO)", False, str(e))


# ==============================================================================
# SUITE 4: Report Generator CSV Stress Testing (Vietnamese Accents & Special Chars)
# ==============================================================================
print("\n--- SUITE 4: Report Generator CSV Stress Testing ---")

# 4.1 Empty datasets
try:
    tmp_empty = os.path.join(tempfile.gettempdir(), "test_empty_report.csv")
    report_generator.generate_csv_report([], {}, tmp_empty)
    assert os.path.exists(tmp_empty)
    with open(tmp_empty, "rb") as f:
        bom = f.read(3)
        assert bom == b"\xef\xbb\xbf", "Missing UTF-8 BOM"
    os.remove(tmp_empty)
    record_test("4.1 CSV export with empty dataset and empty analysis", True)
except Exception as e:
    record_test("4.1 CSV export with empty dataset and empty analysis", False, str(e))

# 4.2 Special characters and full Vietnamese accents roundtrip
try:
    tmp_adv = os.path.join(tempfile.gettempdir(), "test_adv_report.csv")
    adv_nets = [{
        "ssid": "Trạm Wi-Fi Tầng 3, Phòng Họp Lớn \"VIP\"\nCó Ký Tự Xuống Dòng & Phẩy; Tab\t và Dấu: áàảãạăắằẳẵặâấầẩẫậ",
        "bssid": "aa:bb:cc:dd:ee:ff",
        "signal_dbm": -55,
        "signal_percent": 88,
        "snr_db": 38,
        "mcs_index": 9,
        "modulation": "256-QAM",
        "est_throughput_mbps": 866.7,
        "channel": 149,
        "band": "5 GHz",
        "frequency_mhz": 5745,
        "wifi_generation": "Wi-Fi 5",
        "radio_type": "802.11ac",
        "authentication": "WPA2-Enterprise",
        "encryption": "CCMP",
        "vendor": "Tập Đoàn Viễn Thông Quốc Gia 'VNPT, Viettel, FPT'",
        "channel_utilization_pct": 25,
        "connected_stations": 12,
        "is_connected": True
    }]
    adv_analysis = {
        "global_score": 85,
        "avg_snr_db": 38.0,
        "unique_ssids": 1,
        "evaluation_24ghz": {
            "recommended_channel": 1,
            "recommended_score": 80,
            "recommendation_reason": "Dải tần 2.4 GHz có độ nhiễu thấp tại Kênh 1"
        },
        "evaluation_5ghz": {
            "recommended_channel": 149,
            "recommended_score": 92,
            "recommended_80mhz_block": "UNII-3 (149-161)",
            "recommendation_reason": "Kênh thông thoáng không vướng radar DFS"
        },
        "security_audit": {
            "open_unsecured": []
        }
    }
    report_generator.generate_csv_report(adv_nets, adv_analysis, tmp_adv)
    with open(tmp_adv, "r", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        rows = list(reader)
    assert len(rows) >= 30, f"Expected at least 30 CSV rows, got {len(rows)}"
    # Verify that the complex Vietnamese SSID was preserved verbatim
    ssid_found = any(adv_nets[0]["ssid"] in cell for row in rows for cell in row)
    assert ssid_found, "Vietnamese SSID with accents and special characters was altered or lost"
    os.remove(tmp_adv)
    record_test("4.2 CSV export roundtrip with Vietnamese accents and special characters", True)
except Exception as e:
    record_test("4.2 CSV export roundtrip with Vietnamese accents and special characters", False, str(e))


# ==============================================================================
# SUITE 5: Baseline Invariants Verification (test_full_suite.py)
# ==============================================================================
print("\n--- SUITE 5: Baseline Invariants Verification ---")

# 5.1 Invariant 1: Noise floor & SNR & Throughput
try:
    nf_ch6 = wifi_scanner.estimate_channel_noise_floor(6, "2.4 GHz", 3)
    assert -98 <= nf_ch6 <= -78, f"Unexpected noise floor: {nf_ch6}"
    record_test("5.1 Invariant 1: Noise Floor estimate (-98 <= nf <= -78)", True)
except Exception as e:
    record_test("5.1 Invariant 1: Noise Floor estimate (-98 <= nf <= -78)", False, str(e))

# 5.2 Invariant 2: Channel Analyzer & Oscium Invariants
try:
    nets, iface, clusters, threats = wifi_scanner.scan_wifi_with_interface()
    analysis = channel_analyzer.analyze_wifi_environment(nets, connected_interface=iface, security_threats=threats)
    assert "roaming_audit" in analysis
    assert "airtime_breakdown" in analysis
    assert "channels_6ghz" in analysis and len(analysis["channels_6ghz"]) > 0
    assert "best_6ghz_channel" in analysis["summary"]
    ts = analysis["troubleshooting_suite"]
    assert len(ts["spectrum_classifiers"]) >= 4
    assert len(ts["checklist"]) == 6
    assert len(ts["non_wifi_interferers"]) == 4
    assert 0 <= ts["health_score"] <= 100
    assert "estimated_retry_rate_pct" in ts
    record_test("5.2 Invariant 2: Oscium Troubleshooting Suite 5 invariants", True)
except Exception as e:
    record_test("5.2 Invariant 2: Oscium Troubleshooting Suite 5 invariants", False, str(e))

# 5.3 Invariant 3: Ekahau RF Heatmap 5-mode & tri-band differentiation
try:
    walls = [{"x1": 6.0, "y1": 0.0, "x2": 6.0, "y2": 8.0, "material": "concrete"}]
    plan_24 = ai_planner.optimize_ap_placement(12.0, 8.0, walls, max_aps=3, freq_ghz=2.4, sla_profile="office")
    hm_24 = ai_planner.generate_heatmap_grid(12.0, 8.0, walls, plan_24["access_points"], freq_ghz=2.4, sla_profile="office")
    hm_50 = ai_planner.generate_heatmap_grid(12.0, 8.0, walls, plan_24["access_points"], freq_ghz=5.0, sla_profile="voice")
    hm_60 = ai_planner.generate_heatmap_grid(12.0, 8.0, walls, plan_24["access_points"], freq_ghz=6.0, sla_profile="high_density")
    assert hm_24["grid"] != hm_50["grid"]
    assert hm_50["grid"] != hm_60["grid"]
    assert hm_24["coverage_pct"] >= hm_50["coverage_pct"] >= hm_60["coverage_pct"]
    hm_swapped = ai_planner.generate_heatmap_grid(12.0, 8.0, plan_24["access_points"], walls, freq_ghz=2.4, sla_profile="office")
    assert hm_swapped["grid"] == hm_24["grid"]
    record_test("5.3 Invariant 3: Ekahau 5-mode heatmap matrices & frequency attenuation", True)
except Exception as e:
    record_test("5.3 Invariant 3: Ekahau 5-mode heatmap matrices & frequency attenuation", False, str(e))

# 5.4 Invariant 4: VoWiFi Multi-Hop & ITU-T G.107 MOS
try:
    dns_res = vowifi_analyzer.measure_dns_resolution_ms("cloudflare.com")
    assert isinstance(dns_res, dict) and dns_res.get("dns_latency_ms", -1) >= 0.0
    vowifi_res = vowifi_analyzer.measure_network_quality("127.0.0.1", ping_count=2)
    assert 1.0 <= vowifi_res["mos_score"] <= 4.5
    assert "gateway_ip" in vowifi_res and "path_diagnosis_vi" in vowifi_res
    record_test("5.4 Invariant 4: VoWiFi Multi-Hop path audit & MOS score", True)
except Exception as e:
    record_test("5.4 Invariant 4: VoWiFi Multi-Hop path audit & MOS score", False, str(e))

# 5.5 Invariant 5: FastAPI REST Endpoints via TestClient
try:
    client = TestClient(server.app)
    r_rec = client.get("/api/channel-recommendations")
    assert r_rec.status_code == 200 and "channels_6ghz" in r_rec.json()
    r_ts = client.get("/api/troubleshooting/all-in-one")
    assert r_ts.status_code == 200 and r_ts.json()["status"] == "success"
    r_sp_start = client.post("/api/speedtest/start", json={"mode": "mock"})
    assert r_sp_start.status_code == 200 and r_sp_start.json()["status"] == "running"
    r_sp_stat = client.get("/api/speedtest/status")
    assert r_sp_stat.status_code == 200
    record_test("5.5 Invariant 5: FastAPI REST Endpoints via TestClient", True)
except Exception as e:
    record_test("5.5 Invariant 5: FastAPI REST Endpoints via TestClient", False, str(e))


# ==============================================================================
# SUITE 6: Adversarial Stress Probes & Vulnerability Mining
# ==============================================================================
print("\n--- SUITE 6: Adversarial Stress Probes & Vulnerability Mining ---")

# 6.1 Probe A: Multi-BSSID Roaming Group with channel=None
try:
    probe_nets_a = [
        {"ssid": "OfficeMesh", "bssid": "00:11:22:33:44:01", "channel": 1, "signal_dbm": -55},
        {"ssid": "OfficeMesh", "bssid": "00:11:22:33:44:02", "channel": None, "signal_dbm": -65}
    ]
    channel_analyzer.analyze_wifi_environment(probe_nets_a)
    record_test("6.1 Probe A: Multi-BSSID roaming group with channel=None", True)
except TypeError as te:
    record_test("6.1 Probe A: Multi-BSSID roaming group with channel=None", False, f"TypeError in channel_analyzer.py: {te}")
except Exception as e:
    record_test("6.1 Probe A: Multi-BSSID roaming group with channel=None", False, str(e))

# 6.2 Probe B: Network with signal_percent=None
try:
    probe_nets_b = [{"ssid": "TestAP", "bssid": "00:11:22:33:44:03", "signal_percent": None, "channel": 6}]
    channel_analyzer.analyze_wifi_environment(probe_nets_b)
    record_test("6.2 Probe B: Network object with signal_percent=None", True)
except TypeError as te:
    record_test("6.2 Probe B: Network object with signal_percent=None", False, f"TypeError in channel_analyzer.py: {te}")
except Exception as e:
    record_test("6.2 Probe B: Network object with signal_percent=None", False, str(e))

# 6.3 Probe C: Network with signal_dbm=None in 2.4/5GHz evaluations
try:
    probe_nets_c = [{"ssid": "TestAP", "bssid": "00:11:22:33:44:04", "channel": 1, "band": "2.4 GHz", "signal_dbm": None}]
    channel_analyzer.evaluate_24ghz_channels(probe_nets_c)
    record_test("6.3 Probe C: evaluate_24ghz_channels with signal_dbm=None", True)
except TypeError as te:
    record_test("6.3 Probe C: evaluate_24ghz_channels with signal_dbm=None", False, f"TypeError in rssi_to_linear_power: {te}")
except Exception as e:
    record_test("6.3 Probe C: evaluate_24ghz_channels with signal_dbm=None", False, str(e))

# 6.4 Probe D: generate_csv_report with analysis={'security_audit': None}
try:
    tmp_probe_d = os.path.join(tempfile.gettempdir(), "test_probe_d.csv")
    report_generator.generate_csv_report([], {"security_audit": None}, tmp_probe_d)
    if os.path.exists(tmp_probe_d):
        os.remove(tmp_probe_d)
    record_test("6.4 Probe D: generate_csv_report with security_audit=None", True)
except AttributeError as ae:
    record_test("6.4 Probe D: generate_csv_report with security_audit=None", False, f"AttributeError in report_generator.py: {ae}")
except Exception as e:
    record_test("6.4 Probe D: generate_csv_report with security_audit=None", False, str(e))

# 6.5 Probe E: generate_csv_report with network={'signal_dbm': None}
try:
    tmp_probe_e = os.path.join(tempfile.gettempdir(), "test_probe_e.csv")
    report_generator.generate_csv_report([{"ssid": "Net", "signal_dbm": None}], {}, tmp_probe_e)
    if os.path.exists(tmp_probe_e):
        os.remove(tmp_probe_e)
    record_test("6.5 Probe E: generate_csv_report with network signal_dbm=None", True)
except TypeError as te:
    record_test("6.5 Probe E: generate_csv_report with network signal_dbm=None", False, f"TypeError in evaluate_signal_level: {te}")
except Exception as e:
    record_test("6.5 Probe E: generate_csv_report with network signal_dbm=None", False, str(e))


print("\n" + "=" * 70)
print(f"SUMMARY: Total: {test_results['total']} | Passed: {test_results['passed']} | Failed: {test_results['failed']}")
print("=" * 70)
for fail in test_results["failures"]:
    print(f" - [FAIL] {fail['name']}: {fail['detail']}")

if test_results["failed"] > 0:
    sys.exit(1)
else:
    sys.exit(0)
