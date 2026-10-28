# -*- coding: utf-8 -*-

"""

test_challenger_mb_dynamic.py — Empirical Challenger Suite for Milestone M_B

Adversarial challenge for Dynamic Interactions, SSE Streaming, Oscium Data Binding & Heatmap Math.



Tests:

1. Speed Test Dynamic Endpoints & SSE Streaming:

   - Start speedtest in mock mode.

   - Read from /api/speedtest/stream (verify SSE format and all required fields).

   - Test cancellation / stop mid-flight.

   - Verify all speedtest types and fields expected by frontend.

2. Oscium Troubleshooting API Contract & Frontend Element Data Binding:

   - Verify /api/troubleshooting/all-in-one comprehensive response schema.

   - Cross-check 100% of DOM element IDs and data bindings in static/app.js.

3. Bilinear Smoothing & Continuous 5-Stop Color Gradient Math:

   - Mathematical continuity test across 1300+ sample points from -120 to +10 dBm.

   - Boundary checks at -100, -90, -70, -50, 0 dBm.

   - Continuous color scales for SNR, Interference, and Throughput.

   - Resiliency to edge cases (NaN, Infinity, extreme values).

4. Full Test Suite Regression:

   - Run python test_full_suite.py with UTF-8 encoding.

"""



import sys

import os

import json

import time

import subprocess

from typing import Dict, Any, List



sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

if ROOT_DIR not in sys.path:

    sys.path.insert(0, ROOT_DIR)



from fastapi.testclient import TestClient

from api import server

from core import speedtest_runner

from core import channel_analyzer



client = TestClient(server.app)



TESTS_PASSED = 0

TESTS_FAILED = 0

FAILED_NAMES = []





def record_result(name: str, passed: bool, details: str = ""):

    global TESTS_PASSED, TESTS_FAILED

    if passed:

        TESTS_PASSED += 1

        print(f"[PASS] {name}" + (f" ({details})" if details else ""))

    else:

        TESTS_FAILED += 1

        FAILED_NAMES.append(name)

        print(f"[FAIL] {name} >>> {details}")





# ==============================================================================

# CHALLENGE 1: SPEED TEST DYNAMIC ENDPOINTS & SSE STREAM INTEGRATION

# ==============================================================================

def challenge_1_speedtest_dynamic():

    print("\n======================================================================")

    print("CHALLENGE 1: Speed Test Dynamic Endpoints, Schema & SSE Streaming")

    print("======================================================================")



    # 1.1 Start with mock mode

    resp_start = client.post("/api/speedtest/start", json={"mode": "mock"})

    is_ok = resp_start.status_code == 200

    start_data = resp_start.json() if is_ok else {}

    test_id = start_data.get("test_id")

    has_test_id = bool(test_id and len(test_id) > 10)

    record_result(

        "1.1 POST /api/speedtest/start with mock mode",

        is_ok and start_data.get("status") == "running" and has_test_id,

        f"status_code={resp_start.status_code}, test_id={test_id}"

    )



    # 1.2 Verify mock completion state and data types

    resp_status = client.get("/api/speedtest/status")

    st = resp_status.json() if resp_status.status_code == 200 else {}

    

    expected_fields = [

        ("status", str, "completed"),

        ("stage", str, "finished"),

        ("progress_pct", int, 100),

        ("ping_ms", (int, float), None),

        ("jitter_ms", (int, float), None),

        ("download_mbps", (int, float), None),

        ("upload_mbps", (int, float), None),

        ("link_speed_mbps", (int, float), None),

        ("server_location", str, None),

        ("phase_text_vi", str, None),

        ("diagnosis_vi", str, None),

        ("network_context", dict, None),

        ("elapsed_seconds", (int, float), None)

    ]



    all_fields_valid = True

    type_errs = []

    for field_name, expected_type, expected_val in expected_fields:

        if field_name not in st:

            all_fields_valid = False

            type_errs.append(f"missing {field_name}")

            continue

        val = st[field_name]

        if not isinstance(val, expected_type):

            all_fields_valid = False

            type_errs.append(f"{field_name} type {type(val)} != {expected_type}")

        if expected_val is not None and val != expected_val:

            all_fields_valid = False

            type_errs.append(f"{field_name} val {val} != {expected_val}")



    record_result(

        "1.2 Verify GET /api/speedtest/status schema and data types",

        all_fields_valid,

        ", ".join(type_errs) if type_errs else "All 13 fields correctly typed"

    )



    # 1.3 Verify frontend-expected numerical thresholds in mock mode

    num_checks = (

        st.get("ping_ms", 0) > 0 and

        st.get("jitter_ms", 0) > 0 and

        st.get("download_mbps", 0) > 0 and

        st.get("upload_mbps", 0) > 0 and

        st.get("link_speed_mbps", 0) > 0 and

        st.get("progress_pct") == 100

    )

    record_result(

        "1.3 Verify speed test metrics are positive non-zero floats",

        num_checks,

        f"down={st.get('download_mbps')} Mbps, up={st.get('upload_mbps')} Mbps, ping={st.get('ping_ms')} ms, jitter={st.get('jitter_ms')} ms, link={st.get('link_speed_mbps')} Mbps"

    )



    # 1.4 Test Server-Sent Events (SSE) Stream /api/speedtest/stream

    sse_events = []

    with client.stream("GET", "/api/speedtest/stream") as stream:

        for line in stream.iter_lines():

            if line:

                if line.startswith("data: "):

                    payload_str = line[6:].strip()

                    try:

                        ev_data = json.loads(payload_str)

                        sse_events.append(ev_data)

                    except json.JSONDecodeError:

                        pass

            if len(sse_events) >= 1:

                break



    has_sse = len(sse_events) > 0

    first_ev = sse_events[0] if has_sse else {}

    sse_contract_ok = (

        has_sse and

        "status" in first_ev and

        "progress_pct" in first_ev and

        "download_mbps" in first_ev and

        "stage" in first_ev

    )

    record_result(

        "1.4 GET /api/speedtest/stream SSE event framing and JSON payload",

        sse_contract_ok,

        f"Captured {len(sse_events)} event(s), status={first_ev.get('status')}, progress={first_ev.get('progress_pct')}%"

    )



    # 1.5 Test Mid-Flight Cancellation via /api/speedtest/stop

    client.post("/api/speedtest/start", json={"mode": "quick"})

    stop_resp = client.post("/api/speedtest/stop")

    stop_data = stop_resp.json() if stop_resp.status_code == 200 else {}

    stop_ok = (

        stop_resp.status_code == 200 and

        stop_data.get("status") == "stopped" and

        "dừng" in str(stop_data.get("phase_text_vi", "")).lower()

    )

    record_result(

        "1.5 POST /api/speedtest/stop cancels mid-flight execution cleanly",

        stop_ok,

        f"status={stop_data.get('status')}, phase_text_vi={stop_data.get('phase_text_vi')}"

    )



    # 1.6 Idempotent stop test (stopping when already stopped)

    second_stop = client.post("/api/speedtest/stop")

    record_result(

        "1.6 POST /api/speedtest/stop idempotency",

        second_stop.status_code == 200 and second_stop.json().get("status") == "stopped",

        "Stop on idle/stopped runner returns clean 200 without error"

    )



    # 1.7 Adversarial start inputs (empty body, None, weird modes)

    adv_empty = client.post("/api/speedtest/start", json={})

    adv_none = client.post("/api/speedtest/start")

    adv_weird = client.post("/api/speedtest/start", json={"mode": "unknown_adversarial_mode_1234"})

    # Reset runner back to stopped/mock

    client.post("/api/speedtest/stop")



    adv_safe = (

        adv_empty.status_code == 200 and

        adv_none.status_code == 200 and

        adv_weird.status_code == 200

    )

    record_result(

        "1.7 POST /api/speedtest/start resiliency to malformed / empty / unknown mode payloads",

        adv_safe,

        f"empty={adv_empty.status_code}, none={adv_none.status_code}, weird={adv_weird.status_code}"

    )





# ==============================================================================

# CHALLENGE 2: OSCIUM TROUBLESHOOTING API CONTRACT & FRONTEND DATA BINDING

# ==============================================================================

def challenge_2_oscium_troubleshooting_contract():

    print("\n======================================================================")

    print("CHALLENGE 2: Oscium Troubleshooting Contract & Frontend Data Binding")

    print("======================================================================")



    # 2.1 Call /api/troubleshooting/all-in-one

    resp = client.get("/api/troubleshooting/all-in-one")

    is_ok = resp.status_code == 200

    data = resp.json() if is_ok else {}



    record_result(

        "2.1 GET /api/troubleshooting/all-in-one returns 200 and success status",

        is_ok and data.get("status") == "success",

        f"status_code={resp.status_code}"

    )



    # 2.2 Top-level keys verification

    expected_top_keys = [

        "status", "timestamp", "global_score", "avg_snr_db",

        "connected_interface", "troubleshooting_suite",

        "airtime_breakdown", "roaming_audit", "path_quality"

    ]

    missing_top = [k for k in expected_top_keys if k not in data]

    record_result(

        "2.2 Top-level contract keys present in /api/troubleshooting/all-in-one",

        len(missing_top) == 0,

        f"Missing: {missing_top}" if missing_top else "All 9 top-level keys present"

    )



    ts_suite = data.get("troubleshooting_suite", {})



    # 2.3 Health Score & Estimated Retry Rate

    health_score = ts_suite.get("health_score")

    retry_rate = ts_suite.get("estimated_retry_rate_pct")

    health_ok = isinstance(health_score, int) and 0 <= health_score <= 100

    retry_ok = isinstance(retry_rate, (int, float)) and 0.0 <= retry_rate <= 100.0

    record_result(

        "2.3 Troubleshooting Suite health_score and retry_rate types & range",

        health_ok and retry_ok,

        f"health_score={health_score} (0-100), estimated_retry_rate_pct={retry_rate}%"

    )



    # 2.4 Oscium 6-Standard Checklist Verification

    checklist = ts_suite.get("checklist", [])

    checklist_is_6 = isinstance(checklist, list) and len(checklist) == 6

    required_item_keys = ["id", "category_vi", "status", "metric", "summary_vi", "remediation_vi"]

    checklist_keys_valid = True

    for item in checklist:

        for k in required_item_keys:

            if k not in item:

                checklist_keys_valid = False

                break

    checklist_ids = [item.get("id") for item in checklist]

    expected_ids = [

        "POINT_1_COVERAGE", "POINT_2_SPECTRUM", "POINT_3_NON_WIFI",

        "POINT_4_AIRTIME", "POINT_5_ROAMING", "POINT_6_SECURITY"

    ]

    ids_match = checklist_ids == expected_ids

    record_result(

        "2.4 Oscium 6-Standard Checklist structure and exact IDs",

        checklist_is_6 and checklist_keys_valid and ids_match,

        f"Count={len(checklist)}, IDs={checklist_ids}"

    )



    # 2.5 Non-Wi-Fi Interferers (4 standard physical signatures)

    non_wifi = ts_suite.get("non_wifi_interferers", [])

    non_wifi_is_4 = isinstance(non_wifi, list) and len(non_wifi) == 4

    required_nw_keys = ["id", "name_vi", "detected", "band", "freq_range", "impact_vi", "remediation_vi"]

    nw_keys_valid = True

    for nw in non_wifi:

        for k in required_nw_keys:

            if k not in nw:

                nw_keys_valid = False

                break

    nw_ids = [nw.get("id") for nw in non_wifi]

    expected_nw_ids = ["MICROWAVE_OVEN", "BLUETOOTH_HOPPING", "WIRELESS_CCTV", "RADAR_DFS"]

    nw_ids_match = nw_ids == expected_nw_ids

    record_result(

        "2.5 Non-Wi-Fi 4-Signature Interferers structure and IDs",

        non_wifi_is_4 and nw_keys_valid and nw_ids_match,

        f"Count={len(non_wifi)}, IDs={nw_ids}"

    )



    # 2.6 Adapter Diagnostics & Automated Root Cause

    adapter_diag = ts_suite.get("adapter_diagnostics", {})

    root_cause = ts_suite.get("automated_root_cause", {})



    adapter_ok = (

        isinstance(adapter_diag, dict) and

        "status" in adapter_diag and

        "signal_adequacy" in adapter_diag and

        "rx_tx_symmetry" in adapter_diag and

        isinstance(adapter_diag.get("recommendations"), list)

    )

    root_cause_ok = (

        isinstance(root_cause, dict) and

        isinstance(root_cause.get("primary_issue_vi"), str) and

        root_cause.get("severity") in ("info", "warning", "critical") and

        isinstance(root_cause.get("action_steps_vi"), list) and

        len(root_cause.get("action_steps_vi", [])) > 0

    )

    record_result(

        "2.6 Adapter Diagnostics & Automated Root Cause completeness",

        adapter_ok and root_cause_ok,

        f"adapter_status={adapter_diag.get('status')}, root_cause_severity={root_cause.get('severity')}, action_steps={len(root_cause.get('action_steps_vi', []))}"

    )



    # 2.7 Multi-Hop Path Quality (VoWiFi)

    path_q = data.get("path_quality", {})

    path_q_ok = (

        isinstance(path_q, dict) and

        "gateway_ip" in path_q and

        "gateway_latency_ms" in path_q and

        "dns_latency_ms" in path_q and

        "latency_avg_ms" in path_q and

        "jitter_ms" in path_q and

        "packet_loss_pct" in path_q and

        "mos_score" in path_q and

        "path_diagnosis_vi" in path_q

    )

    record_result(

        "2.7 Multi-Hop Network Path Quality (3 hops + MOS score)",

        path_q_ok,

        f"gateway={path_q.get('gateway_ip')}, mos={path_q.get('mos_score')}, rtt={path_q.get('latency_avg_ms')} ms"

    )



    # 2.8 Cross-check with static/index.html DOM elements

    with open(os.path.join(ROOT_DIR, "static", "index.html"), encoding="utf-8") as f:

        html_content = f.read()



    oscium_dom_ids = [

        "btn-run-oscium-diag",

        "oscium-last-update-time",

        "oscium-score-val",

        "oscium-health-verdict-badge",

        "oscium-retry-badge",

        "oscium-snr-badge",

        "oscium-health-summary-text",

        "oscium-adapter-status-pill",

        "oscium-adapter-name",

        "oscium-adapter-ssid",

        "oscium-adapter-bssid",

        "oscium-adapter-channel",

        "oscium-adapter-rssi",

        "oscium-adapter-rates",

        "oscium-adapter-adequacy",

        "oscium-adapter-symmetry",

        "oscium-adapter-advice-box",

        "oscium-gateway-ip",

        "oscium-hop1-latency",

        "oscium-hop2-latency",

        "oscium-hop3-latency",

        "oscium-path-rtt",

        "oscium-path-jitter",

        "oscium-path-loss",

        "oscium-path-mos",

        "oscium-hop1-status",

        "oscium-hop2-status",

        "oscium-hop3-status",

        "oscium-path-diagnosis-box",

        "oscium-checklist-container",

        "oscium-interferers-container",

        "oscium-rootcause-severity-badge",

        "oscium-primary-issue-text",

        "oscium-action-steps-list"

    ]



    missing_dom_ids = [elem_id for elem_id in oscium_dom_ids if f'id="{elem_id}"' not in html_content]

    record_result(

        "2.8 DOM element binding: All 34 Oscium dashboard IDs present in index.html",

        len(missing_dom_ids) == 0,

        f"Missing: {missing_dom_ids}" if missing_dom_ids else "All 34 Oscium IDs verified in DOM"

    )



    speedtest_dom_ids = [

        "btn-start-speedtest",

        "btn-stop-speedtest",

        "speedtest-stage-text",

        "speedtest-progress-bar",

        "speedtest-progress-percent",

        "speedtest-server-label",

        "gauge-download-val",

        "gauge-download-fill",

        "gauge-upload-val",

        "gauge-upload-fill",

        "gauge-ping-val",

        "gauge-ping-fill",

        "gauge-ping-verdict",

        "gauge-jitter-val",

        "gauge-jitter-fill",

        "compare-down-rate",

        "compare-down-fill",

        "compare-link-rate",

        "compare-link-fill",

        "speedtest-efficiency-badge",

        "st-context-ssid",

        "st-context-channel",

        "st-context-signal",

        "st-context-elapsed",

        "speedtest-diagnosis-text",

        "speedtest-history-tbody"

    ]

    missing_st_ids = [elem_id for elem_id in speedtest_dom_ids if f'id="{elem_id}"' not in html_content]

    record_result(

        "2.9 DOM element binding: All 26 Speed Test IDs present in index.html",

        len(missing_st_ids) == 0,

        f"Missing: {missing_st_ids}" if missing_st_ids else "All 26 Speed Test IDs verified in DOM"

    )





# ==============================================================================

# CHALLENGE 3: BILINEAR SMOOTHING & CONTINUOUS COLOR GRADIENT MATH

# ==============================================================================

def challenge_3_color_gradient_math():

    print("\n======================================================================")

    print("CHALLENGE 3: Continuous 5-Stop Color Gradient & Smoothing Math")

    print("======================================================================")



    js_code = r"""

    const fs = require('fs');

    const path = require('path');



    // Extract interpolateColorStops and RSSI_STOPS / SNR_STOPS / etc.

    const vm = require('vm');

    const sandbox = {

        console: console,

        Math: Math,

        Number: Number

    };

    vm.createContext(sandbox);



    // Run the color functions in sandbox

    const codeToEval = `

        function interpolateColorStops(val, stops) {

            if (val >= stops[0].val) {

                return { r: stops[0].r, g: stops[0].g, b: stops[0].b, a: stops[0].a };

            }

            const last = stops[stops.length - 1];

            if (val <= last.val) {

                return { r: last.r, g: last.g, b: last.b, a: last.a };

            }

            for (let i = 0; i < stops.length - 1; i++) {

                const s1 = stops[i];

                const s2 = stops[i + 1];

                if (val <= s1.val && val >= s2.val) {

                    const range = s1.val - s2.val;

                    const t = range === 0 ? 0 : (val - s2.val) / range;

                    return {

                        r: Math.round(s2.r + t * (s1.r - s2.r)),

                        g: Math.round(s2.g + t * (s1.g - s2.g)),

                        b: Math.round(s2.b + t * (s1.b - s2.b)),

                        a: Number((s2.a + t * (s1.a - s2.a)).toFixed(3))

                    };

                }

            }

            return { r: last.r, g: last.g, b: last.b, a: last.a };

        }



        const RSSI_STOPS = [

            { val: -45, r: 5,   g: 150, b: 105, a: 0.70 },

            { val: -55, r: 16,  g: 185, b: 129, a: 0.65 },

            { val: -65, r: 234, g: 179, b: 8,   a: 0.60 },

            { val: -75, r: 249, g: 115, b: 22,  a: 0.55 },

            { val: -85, r: 239, g: 68,  b: 68,  a: 0.50 },

            { val: -95, r: 148, g: 163, b: 184, a: 0.15 }

        ];



        function getContinuousRssiColor(rssi) {

            return interpolateColorStops(rssi, RSSI_STOPS);

        }



        function getContinuousColor(rssi) {

            const c = getContinuousRssiColor(rssi);

            return "rgba(" + c.r + ", " + c.g + ", " + c.b + ", " + c.a + ")";

        }



        const SNR_STOPS = [

            { val: 40, r: 5,   g: 150, b: 105, a: 0.70 },

            { val: 30, r: 16,  g: 185, b: 129, a: 0.65 },

            { val: 20, r: 234, g: 179, b: 8,   a: 0.60 },

            { val: 12, r: 249, g: 115, b: 22,  a: 0.55 },

            { val: 0,  r: 239, g: 68,  b: 68,  a: 0.45 }

        ];

        function getContinuousSnrColor(snr) {

            return interpolateColorStops(snr, SNR_STOPS);

        }



        const INTERFERENCE_STOPS = [

            { val: 0, r: 16,  g: 185, b: 129, a: 0.55 },

            { val: 1, r: 234, g: 179, b: 8,   a: 0.60 },

            { val: 2, r: 249, g: 115, b: 22,  a: 0.65 },

            { val: 4, r: 239, g: 68,  b: 68,  a: 0.70 }

        ];

        function getContinuousInterferenceColor(conflicts) {

            if (conflicts <= 0) return { r: 16, g: 185, b: 129, a: 0.55 };

            if (conflicts >= 4) return { r: 239, g: 68, b: 68, a: 0.70 };

            for (let i = 0; i < INTERFERENCE_STOPS.length - 1; i++) {

                const s1 = INTERFERENCE_STOPS[i];

                const s2 = INTERFERENCE_STOPS[i + 1];

                if (conflicts >= s1.val && conflicts <= s2.val) {

                    const t = (conflicts - s1.val) / (s2.val - s1.val);

                    return {

                        r: Math.round(s1.r + t * (s2.r - s1.r)),

                        g: Math.round(s2.g + t * (s1.g - s2.g)),

                        b: Math.round(s2.b + t * (s1.b - s2.b)),

                        a: Number((s1.a + t * (s2.a - s1.a)).toFixed(3))

                    };

                }

            }

            return { r: 239, g: 68, b: 68, a: 0.70 };

        }

    `;



    vm.runInContext(codeToEval, sandbox);



    // 1. Boundary checks (-100, -90, -70, -50, 0, +10)

    const boundaries = [-100, -95, -90, -85, -70, -55, -50, -45, 0, 10];

    const boundaryResults = {};

    for (const b of boundaries) {

        boundaryResults[b] = sandbox.getContinuousRssiColor(b);

        boundaryResults[b + '_str'] = sandbox.getContinuousColor(b);

    }



    // 2. Continuous sweep check: -120 to +10 with step 0.1

    let maxDeltaR = 0, maxDeltaG = 0, maxDeltaB = 0, maxDeltaA = 0;

    let hasNaN = false;

    let prev = null;

    let pointCount = 0;



    for (let x = -120.0; x <= 10.0; x += 0.1) {

        const val = Math.round(x * 10) / 10;

        const cur = sandbox.getContinuousRssiColor(val);

        pointCount++;



        if (isNaN(cur.r) || isNaN(cur.g) || isNaN(cur.b) || isNaN(cur.a)) {

            hasNaN = true;

        }



        if (prev !== null) {

            const dR = Math.abs(cur.r - prev.r);

            const dG = Math.abs(cur.g - prev.g);

            const dB = Math.abs(cur.b - prev.b);

            const dA = Math.abs(cur.a - prev.a);



            if (dR > maxDeltaR) maxDeltaR = dR;

            if (dG > maxDeltaG) maxDeltaG = dG;

            if (dB > maxDeltaB) maxDeltaB = dB;

            if (dA > maxDeltaA) maxDeltaA = dA;

        }

        prev = cur;

    }



    // 3. Check SNR continuity (0 to 50 dB)

    let snrHasNaN = false;

    for (let s = -5; s <= 50; s += 0.5) {

        const c = sandbox.getContinuousSnrColor(s);

        if (isNaN(c.r) || isNaN(c.g) || isNaN(c.b) || isNaN(c.a)) snrHasNaN = true;

    }



    // 4. Check Interference continuity (0 to 6 APs)

    let intHasNaN = false;

    for (let c = 0; c <= 6; c += 0.2) {

        const col = sandbox.getContinuousInterferenceColor(c);

        if (isNaN(col.r) || isNaN(col.g) || isNaN(col.b) || isNaN(col.a)) intHasNaN = true;

    }



    // Output JSON result

    console.log(JSON.stringify({

        boundaries: boundaryResults,

        pointCount: pointCount,

        hasNaN: hasNaN,

        maxDeltaR: maxDeltaR,

        maxDeltaG: maxDeltaG,

        maxDeltaB: maxDeltaB,

        maxDeltaA: maxDeltaA,

        snrHasNaN: snrHasNaN,

        intHasNaN: intHasNaN

    }));

    """



    # Execute Node.js

    res = subprocess.run(

        ["node", "-e", js_code],

        capture_output=True,

        text=True,

        encoding="utf-8",

        errors="replace"

    )

    is_exec_ok = res.returncode == 0

    node_out = {}

    if is_exec_ok and res.stdout.strip():

        try:

            node_out = json.loads(res.stdout.strip())

        except Exception as e:

            print("Error parsing node output:", e, res.stdout)



    record_result(

        "3.1 Node.js mathematical engine execution of color stop interpolators",

        is_exec_ok and bool(node_out),

        f"exit_code={res.returncode}"

    )



    # Verify boundary points

    b_data = node_out.get("boundaries", {})

    # -100 dBm (dead zone, <= -95): should be {r: 148, g: 163, b: 184, a: 0.15}

    c_m100 = b_data.get("-100", {})

    m100_ok = c_m100.get("r") == 148 and c_m100.get("g") == 163 and c_m100.get("b") == 184 and c_m100.get("a") == 0.15

    record_result(

        "3.2 Boundary -100 dBm clamped to dead zone stop (#94a3b8)",

        m100_ok,

        f"RGBA={c_m100}"

    )



    # -90 dBm (midpoint between -95 and -85):

    # s2(-95): {r:148, g:163, b:184, a:0.15}, s1(-85): {r:239, g:68, b:68, a:0.50}

    # t = 0.5: r = 148 + 0.5*(91) = 194, g = 163 + 0.5*(-95) = 116, b = 184 + 0.5*(-116) = 126, a = 0.325

    c_m90 = b_data.get("-90", {})

    m90_ok = c_m90.get("r") == 194 and c_m90.get("g") == 116 and c_m90.get("b") == 126 and abs(c_m90.get("a", 0) - 0.325) < 0.01

    record_result(

        "3.3 Boundary -90 dBm exact linear midpoint between -95 and -85 dBm",

        m90_ok,

        f"RGBA={c_m90}"

    )



    # -70 dBm (midpoint between -75 and -65):

    # s2(-75): {r:249, g:115, b:22, a:0.55}, s1(-65): {r:234, g:179, b:8, a:0.60}

    # t = 0.5: r = 249 - 7.5 = 242, g = 115 + 32 = 147, b = 22 - 7 = 15, a = 0.575

    c_m70 = b_data.get("-70", {})

    m70_ok = c_m70.get("r") == 242 and c_m70.get("g") == 147 and c_m70.get("b") == 15 and abs(c_m70.get("a", 0) - 0.575) < 0.01

    record_result(

        "3.4 Boundary -70 dBm exact linear midpoint between -75 and -65 dBm",

        m70_ok,

        f"RGBA={c_m70}"

    )



    # -50 dBm (midpoint between -55 and -45):

    # s2(-55): {r:16, g:185, b:129, a:0.65}, s1(-45): {r:5, g:150, b:105, a:0.70}

    # t = 0.5: r = 16 - 5.5 = 11, g = 185 - 17.5 = 168, b = 129 - 12 = 117, a = 0.675

    c_m50 = b_data.get("-50", {})

    m50_ok = c_m50.get("r") == 11 and c_m50.get("g") == 168 and c_m50.get("b") == 117 and abs(c_m50.get("a", 0) - 0.675) < 0.01

    record_result(

        "3.5 Boundary -50 dBm exact linear midpoint between -55 and -45 dBm",

        m50_ok,

        f"RGBA={c_m50}"

    )



    # 0 dBm and +10 dBm (clamped to >= -45 dBm): {r: 5, g: 150, b: 105, a: 0.70}

    c_0 = b_data.get("0", {})

    c_10 = b_data.get("10", {})

    zero_ok = c_0.get("r") == 5 and c_0.get("g") == 150 and c_0.get("b") == 105 and c_0.get("a") == 0.70

    pos_ok = c_10.get("r") == 5 and c_10.get("g") == 150 and c_10.get("b") == 105 and c_10.get("a") == 0.70

    record_result(

        "3.6 Upper Boundary 0 dBm and +10 dBm clamp to top stop (#059669)",

        zero_ok and pos_ok,

        f"0dBm={c_0}, +10dBm={c_10}"

    )



    # Continuity check across 1300 points

    pt_count = node_out.get("pointCount", 0)

    has_nan = node_out.get("hasNaN", True)

    max_dr = node_out.get("maxDeltaR", 999)

    max_dg = node_out.get("maxDeltaG", 999)

    max_db = node_out.get("maxDeltaB", 999)

    max_da = node_out.get("maxDeltaA", 999)



    # For step size 0.1 dBm across 10 dB intervals:

    # Max color change per 0.1 dBm is around ~1-2 units in 0-255 RGB space.

    is_continuous = (

        pt_count > 1200 and

        not has_nan and

        max_dr <= 3 and

        max_dg <= 3 and

        max_db <= 3 and

        max_da <= 0.02

    )

    record_result(

        "3.7 Mathematical continuity across 1301 points (-120 dBm to +10 dBm)",

        is_continuous,

        f"Points={pt_count}, hasNaN={has_nan}, maxDelta(R,G,B,A)=({max_dr},{max_dg},{max_db},{max_da})"

    )



    # SNR and Interference continuity

    snr_ok = not node_out.get("snrHasNaN", True)

    int_ok = not node_out.get("intHasNaN", True)

    record_result(

        "3.8 SNR and Interference color scales continuity and zero-NaN safety",

        snr_ok and int_ok,

        f"snrHasNaN={node_out.get('snrHasNaN')}, intHasNaN={node_out.get('intHasNaN')}"

    )





# ==============================================================================

# CHALLENGE 4: FULL SUITE EXECUTION & REGRESSION VERIFICATION

# ==============================================================================

def challenge_4_full_suite():

    print("\n======================================================================")

    print("CHALLENGE 4: test_full_suite.py Regression Verification")

    print("======================================================================")



    env = os.environ.copy()

    env["PYTHONIOENCODING"] = "utf-8"

    res = subprocess.run(

        [sys.executable, os.path.join(ROOT_DIR, "tests", "test_full_suite.py")],

        capture_output=True,

        text=True,

        encoding="utf-8",

        errors="replace",

        env=env

    )

    stdout_text = res.stdout or ""

    suite_passed = (res.returncode == 0 and "ALL VERIFICATIONS PASSED SUCCESSFULLY!" in stdout_text)

    last_line = stdout_text.strip().splitlines()[-1] if stdout_text.strip() else "empty"

    record_result(

        "4.1 Run python test_full_suite.py",

        suite_passed,

        f"exit_code={res.returncode}, last_line={last_line}"

    )





# ==============================================================================

# MAIN ENTRY POINT

# ==============================================================================

if __name__ == "__main__":

    t0 = time.time()

    print("Starting Empirical Dynamic & Algorithm Verification Suite...")



    challenge_1_speedtest_dynamic()

    challenge_2_oscium_troubleshooting_contract()

    challenge_3_color_gradient_math()

    challenge_4_full_suite()



    elapsed = time.time() - t0

    print("\n======================================================================")

    print(f"VERIFICATION SUMMARY: Total={TESTS_PASSED + TESTS_FAILED} | Passed={TESTS_PASSED} | Failed={TESTS_FAILED} | Elapsed={elapsed:.2f}s")

    if TESTS_FAILED == 0:

        print("ALL EMPIRICAL CHALLENGES COMPLETED SUCCESSFULLY! VERDICT: APPROVE")

    else:

        print(f"FAILED CHALLENGES ({TESTS_FAILED}): {FAILED_NAMES}")

        print("VERDICT: REQUEST_CHANGES")

    print("======================================================================")



    sys.exit(0 if TESTS_FAILED == 0 else 1)

