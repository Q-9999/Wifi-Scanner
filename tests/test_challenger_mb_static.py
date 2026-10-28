# -*- coding: utf-8 -*-
"""
test_challenger_mb_static.py — Adversarial Verification Suite for Milestone M_B
Empirical verification of Frontend UI/UX, Heatmap & Speed Test Interface:
1. Zero Emojis across all static assets using exhaustive unicode regex and HTML entities.
2. Zero <i data-lucide> tags and neutralized Lucide script tag.
3. Pure Light Mode validation in static/styles.css and absence of [data-theme="light"]/dark modes.
4. Completeness and validity of required DOM elements in static/index.html:
   - Speed Test: container, gauges, start/stop buttons, PHY comparison, stage badges.
   - Oscium 6-block dashboard: health score, adapter diagnostics, 3-hop latency, 6-standard checklist, RF interferers, automated root cause.
   - Wi-Fi Heatmap: AP property inspector, distance calibration modal, floorplan image opacity slider, canvas.
5. static/app.js syntax check (Node.js) and DOM handler binding validation.
6. Execution of backend test suites to ensure zero regressions.
"""

import sys
import os
import re
import subprocess
from html.parser import HTMLParser

sys.stdout.reconfigure(encoding='utf-8')
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
STATIC_DIR = os.path.join(ROOT_DIR, "static")

STATIC_FILES = [
    os.path.join(STATIC_DIR, "index.html"),
    os.path.join(STATIC_DIR, "styles.css"),
    os.path.join(STATIC_DIR, "app.js"),
    os.path.join(STATIC_DIR, "lucide.min.js"),
]

TEST_RESULTS = []

def record_result(test_name: str, passed: bool, details: str = ""):
    status = "PASS" if passed else "FAIL"
    TEST_RESULTS.append({"name": test_name, "passed": passed, "details": details})
    print(f"[{status}] {test_name}" + (f": {details}" if details else ""))
    if not passed:
        print(f"  >>> FAILURE IN: {test_name} — {details}")

# ==============================================================================
# CHALLENGE 1: EXHAUSTIVE ZERO-EMOJI AUDIT
# ==============================================================================
def challenge_1_zero_emojis():
    print("\n--- CHALLENGE 1: Exhaustive Zero-Emoji Audit across Static Files ---")
    
    emoji_pattern = re.compile(
        r'[\U00010000-\U0010ffff]|[\u2600-\u27bf]|[\u2300-\u23ff]|[\u2b50-\u2b55]|[\u200d]|[\ufe00-\ufe0f]'
    )
    html_entity_pattern = re.compile(
        r'&#(?:x1[fF][0-9a-fA-F]{3}|12[89][0-9]{4});'
    )
    
    total_violations = 0
    file_violations = {}

    for file_path in STATIC_FILES:
        rel_path = os.path.relpath(file_path, ROOT_DIR)
        if not os.path.exists(file_path):
            record_result(f"File Existence ({rel_path})", False, "File does not exist")
            continue
            
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        matches = []
        for line_idx, line in enumerate(content.splitlines(), start=1):
            for m in emoji_pattern.finditer(line):
                char = m.group()
                cp = f"U+{ord(char):04X}"
                matches.append((line_idx, cp, line.strip()[:60]))
            for m in html_entity_pattern.finditer(line):
                matches.append((line_idx, m.group(), line.strip()[:60]))

        if matches:
            total_violations += len(matches)
            file_violations[rel_path] = matches
            print(f"  [!] Found {len(matches)} emoji violations in {rel_path}:")
            for line_idx, char, sample in matches[:5]:
                print(f"      Line {line_idx}: {char} in '{sample}'")
            if len(matches) > 5:
                print(f"      ... and {len(matches) - 5} more")

    passed = (total_violations == 0)
    record_result("Zero Emojis Across Static Assets", passed,
                  f"Total violations found: {total_violations}")

# ==============================================================================
# CHALLENGE 2: ZERO LUCIDE ICONS & NEUTRALIZED SCRIPT AUDIT
# ==============================================================================
def challenge_2_zero_lucide():
    print("\n--- CHALLENGE 2: Zero Lucide Icons & Neutralized Script Audit ---")
    
    lucide_tag_pattern = re.compile(r'<i\s+[^>]*data-lucide', re.IGNORECASE)
    data_lucide_pattern = re.compile(r'data-lucide\s*=', re.IGNORECASE)
    
    total_tags = 0
    total_attributes = 0

    for file_path in STATIC_FILES:
        rel_path = os.path.relpath(file_path, ROOT_DIR)
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        tags = lucide_tag_pattern.findall(content)
        attrs = data_lucide_pattern.findall(content)
        total_tags += len(tags)
        total_attributes += len(attrs)
        
        if tags or attrs:
            print(f"  [!] Found {len(tags)} <i data-lucide> tags and {len(attrs)} data-lucide attributes in {rel_path}")

    record_result("Zero <i data-lucide> Tags", total_tags == 0, f"Found: {total_tags}")
    record_result("Zero data-lucide Attributes", total_attributes == 0, f"Found: {total_attributes}")

    # Check static/index.html for active lucide script
    index_path = os.path.join(STATIC_DIR, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        html = f.read()

    has_active_lucide_script = bool(re.search(r'<script\s+[^>]*src=[\'"][^\'"]*lucide\.min\.js[\'"]', html))
    record_result("Index HTML Lucide Script Removed", not has_active_lucide_script,
                  f"Script tag present: {has_active_lucide_script}")

    # Check static/lucide.min.js content
    lucide_js_path = os.path.join(STATIC_DIR, "lucide.min.js")
    with open(lucide_js_path, "r", encoding="utf-8") as f:
        lucide_content = f.read()

    is_neutralized = ("createIcons" not in lucide_content or len(lucide_content.strip()) < 200)
    record_result("Lucide Script Neutralized", is_neutralized,
                  f"Length: {len(lucide_content.strip())} chars; createIcons present: {'createIcons' in lucide_content}")

# ==============================================================================
# CHALLENGE 3: PURE LIGHT MODE & REMOVAL OF DARK MODE
# ==============================================================================
def challenge_3_pure_light_mode():
    print("\n--- CHALLENGE 3: Pure Light Mode & Removal of Dark Mode ---")
    
    css_path = os.path.join(STATIC_DIR, "styles.css")
    with open(css_path, "r", encoding="utf-8") as f:
        css = f.read()

    # 1. Assert [data-theme="light"] is completely gone
    data_theme_light_count = len(re.findall(r'\[data-theme=["\']light["\']\]', css))
    record_result("CSS [data-theme='light'] Completely Absent", data_theme_light_count == 0,
                  f"Found {data_theme_light_count} occurrences")

    # 2. Check for [data-theme="dark"]
    data_theme_dark_count = len(re.findall(r'\[data-theme=["\']dark["\']\]', css))
    record_result("CSS [data-theme='dark'] Completely Absent", data_theme_dark_count == 0,
                  f"Found {data_theme_dark_count} occurrences")

    # 3. Check :root defines light mode variables
    root_match = re.search(r':root\s*\{([^}]+)\}', css, re.DOTALL)
    if root_match:
        root_block = root_match.group(1)
        
        # Check color-scheme: light
        has_color_scheme_light = "color-scheme: light" in root_block
        record_result(":root defines color-scheme: light", has_color_scheme_light, "Found" if has_color_scheme_light else "Missing")

        # Check background variables: --bg-main or --bg-primary
        bg_match = re.search(r'--(?:bg-main|bg-primary)\s*:\s*([^;]+);', root_block)
        bg_val = bg_match.group(1).strip() if bg_match else ""
        is_light_bg = any(c in bg_val.lower() for c in ["#f8fafc", "#f", "#e", "#fff", "white"])
        record_result(":root defines Light Background (--bg-main)", is_light_bg, f"Value: {bg_val}")

        # Check card background: --bg-card or --card-bg
        card_match = re.search(r'--(?:bg-card|card-bg)\s*:\s*([^;]+);', root_block)
        card_val = card_match.group(1).strip() if card_match else ""
        is_light_card = any(c in card_val.lower() for c in ["#ffffff", "#fff", "white", "#f"])
        record_result(":root defines Light Card Background (--bg-card)", is_light_card, f"Value: {card_val}")

        # Check text color: --text-primary
        text_match = re.search(r'--text-primary\s*:\s*([^;]+);', root_block)
        text_val = text_match.group(1).strip() if text_match else ""
        is_dark_text = any(c in text_val.lower() for c in ["#0f172a", "#1e293b", "#000", "#1", "#2", "#3", "black"])
        record_result(":root defines Dark Text (--text-primary)", is_dark_text, f"Value: {text_val}")
    else:
        record_result(":root Block Exists in CSS", False, ":root block not found")

    # 4. Check index.html for theme toggle and language toggle removal
    index_path = os.path.join(STATIC_DIR, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        html = f.read()

    has_theme_toggle = bool(re.search(r'id=[\'"](?:btn-)?theme-toggle[\'"]', html))
    record_result("Theme Toggle Removed from index.html", not has_theme_toggle,
                  f"Found theme-toggle: {has_theme_toggle}")

    has_lang_toggle = bool(re.search(r'id=[\'"](?:btn-)?lang-toggle[\'"]', html))
    record_result("Language Toggle Removed from index.html", not has_lang_toggle,
                  f"Found lang-toggle: {has_lang_toggle}")

# ==============================================================================
# CHALLENGE 4: REQUIRED DOM ELEMENTS IN INDEX.HTML
# ==============================================================================
class DOMIdParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.classes = set()

    def handle_starttag(self, tag, attrs):
        for attr, val in attrs:
            if attr == "id" and val:
                self.ids.add(val)
            elif attr == "class" and val:
                for c in val.split():
                    self.classes.add(c)

def challenge_4_dom_elements():
    print("\n--- CHALLENGE 4: Required DOM Elements in index.html ---")
    
    index_path = os.path.join(STATIC_DIR, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        html = f.read()

    parser = DOMIdParser()
    parser.feed(html)
    all_ids = parser.ids

    # 1. Speed Test Elements
    speedtest_required_ids = [
        "tab-speedtest",
        # Gauges (values & fills)
        "gauge-download-val",
        "gauge-download-fill",
        "gauge-upload-val",
        "gauge-upload-fill",
        "gauge-ping-val",
        "gauge-ping-fill",
        "gauge-jitter-val",
        "gauge-jitter-fill",
        # Speed test controls & progress
        "speedtest-server-label",
        "speedtest-stage-text",
        "speedtest-progress-bar",
        "speedtest-progress-percent",
        # PHY Comparison card
        "speedtest-efficiency-badge",
        "compare-down-rate",
        "compare-link-rate",
        "compare-down-fill",
        "compare-link-fill",
        "st-context-ssid",
        "st-context-channel",
        "st-context-signal",
        "st-context-elapsed",
        "speedtest-diagnosis-text",
        # History table
        "speedtest-history-tbody",
    ]
    # Button check (either btn-start-speedtest or btn-speedtest-start)
    has_start_btn = ("btn-start-speedtest" in all_ids or "btn-speedtest-start" in all_ids)
    has_stop_btn = ("btn-stop-speedtest" in all_ids or "btn-speedtest-stop" in all_ids)

    record_result("Speed Test Start Button Exists", has_start_btn,
                  f"btn-start-speedtest: {'btn-start-speedtest' in all_ids}, btn-speedtest-start: {'btn-speedtest-start' in all_ids}")
    record_result("Speed Test Stop Button Exists", has_stop_btn,
                  f"btn-stop-speedtest: {'btn-stop-speedtest' in all_ids}, btn-speedtest-stop: {'btn-speedtest-stop' in all_ids}")

    for elem_id in speedtest_required_ids:
        record_result(f"Speed Test DOM ID: #{elem_id}", elem_id in all_ids,
                      "Found" if elem_id in all_ids else "MISSING")

    # 2. Oscium 6 Cards in #tab-optimizer
    oscium_required_ids = [
        # Block 1: Health score
        "oscium-score-val",
        "oscium-health-verdict-badge",
        "oscium-retry-badge",
        "oscium-snr-badge",
        "oscium-health-summary-text",
        "btn-run-oscium-diag",
        # Block 2: Adapter hardware
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
        # Block 3: Sơ đồ 3 chặng
        "oscium-path-status-pill",
        "oscium-hop1-latency",
        "oscium-hop2-latency",
        "oscium-hop3-latency",
        "oscium-path-rtt",
        "oscium-path-jitter",
        "oscium-path-loss",
        "oscium-path-mos",
        "oscium-path-diagnosis-box",
        # Block 4: Checklist
        "oscium-checklist-container",
        # Block 5: Interferers
        "oscium-interferers-container",
        # Block 6: Root cause
        "oscium-rootcause-severity-badge",
        "oscium-primary-issue-text",
        "oscium-action-steps-list",
    ]

    for elem_id in oscium_required_ids:
        record_result(f"Oscium DOM ID: #{elem_id}", elem_id in all_ids,
                      "Found" if elem_id in all_ids else "MISSING")

    # 3. Wi-Fi Heatmap / AP Inspector / Calibration
    heatmap_required_ids = [
        "planner-ap-inspector",
        "inspector-ap-name",
        "inspector-ap-ch24",
        "inspector-ap-ch5",
        "inspector-ap-ch6",
        "inspector-ap-txpower",
        "inspector-ap-antenna",
        "inspector-ap-enabled",
        "planner-calibration-modal",
        "calib-pixel-length",
        "calib-real-meters",
        "planner-image-opacity",
        "planner-image-opacity-group",
        "canvas-floorplan-heatmap",
    ]

    for elem_id in heatmap_required_ids:
        record_result(f"Heatmap DOM ID: #{elem_id}", elem_id in all_ids,
                      "Found" if elem_id in all_ids else "MISSING")

# ==============================================================================
# CHALLENGE 5: STATIC APP.JS SYNTAX & HANDLER VALIDATION
# ==============================================================================
def challenge_5_app_js_syntax():
    print("\n--- CHALLENGE 5: app.js Syntax & Function Validation ---")
    
    app_js_path = os.path.join(STATIC_DIR, "app.js")
    
    # 1. Run node --check
    try:
        res = subprocess.run(["node", "--check", app_js_path],
                             capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15)
        passed = (res.returncode == 0)
        record_result("Node.js Syntax Check (node --check static/app.js)", passed,
                      "Valid JavaScript syntax" if passed else res.stderr.strip()[:200])
    except Exception as e:
        record_result("Node.js Syntax Check", False, f"Could not execute node: {e}")

    # 2. Check for global window functions referenced in HTML onclick attributes
    with open(app_js_path, "r", encoding="utf-8") as f:
        js = f.read()

    required_window_funcs = [
        "window.refreshOsciumDiagnostics",
        "window.startSpeedTest",
        "window.stopSpeedTest",
        "window.setSpeedTestMode",
        "window.applyApInspectorChanges",
        "window.deleteSelectedApFromInspector",
        "window.closeApInspector",
        "window.setFloorplanImageOpacity",
        "window.clearFloorplanImage",
        "window.applyDistanceCalibration",
        "window.cancelDistanceCalibration",
    ]

    for func in required_window_funcs:
        found = (func in js or func.replace("window.", "") in js)
        record_result(f"Global Function Defined: {func}", found,
                      "Defined" if found else "NOT FOUND in app.js")

    # 3. Verify no unhandled exceptions on removed theme toggle elements
    theme_listeners = re.findall(r'document\.getElementById\(["\'](?:btn-)?theme-toggle["\']\)\.addEventListener', js)
    record_result("No Unguarded Theme-Toggle addEventListener in app.js", len(theme_listeners) == 0,
                  f"Unguarded occurrences: {len(theme_listeners)}")

    # 4. Check smooth bilinear heatmap rendering pipeline in app.js
    has_offscreen_canvas = "renderSmoothHeatmapBuffer" in js
    has_image_smoothing = "imageSmoothingEnabled" in js
    record_result("Bilinear Smooth Heatmap Pipeline in app.js", has_offscreen_canvas and has_image_smoothing,
                  f"Buffer: {has_offscreen_canvas}, Smoothing: {has_image_smoothing}")

# ==============================================================================
# CHALLENGE 6: REGRESSION TEST SUITE EXECUTION
# ==============================================================================
def challenge_6_regression_test_suite():
    print("\n--- CHALLENGE 6: Regression Test Suite Execution ---")
    
    test_files = [
        ("test_full_suite.py", "Project Full Test Suite"),
        ("test_challenger_ma.py", "Milestone M_A Challenger Suite"),
    ]

    for test_file, desc in test_files:
        path = os.path.join(ROOT_DIR, "tests", test_file)
        if not os.path.exists(path):
            record_result(f"Regression Suite: {desc}", False, f"File {test_file} not found")
            continue

        try:
            res = subprocess.run([sys.executable, os.path.join(ROOT_DIR, "tests", test_file)],
                                 capture_output=True, text=True, encoding="utf-8", errors="replace",
                                 timeout=90, cwd=ROOT_DIR)
            passed = (res.returncode == 0)
            detail = "Passed successfully (return code 0)" if passed else f"Exit {res.returncode}: {res.stderr[-300:] or res.stdout[-300:]}"
            record_result(f"Regression Suite: {desc}", passed, detail)
        except Exception as e:
            record_result(f"Regression Suite: {desc}", False, f"Execution failed: {e}")

# ==============================================================================
# MAIN RUNNER
# ==============================================================================
def main():
    print("================================================================================")
    print("CHALLENGER 1 (Milestone M_B): Empirical Static Asset & UI Adversarial Suite")
    print("================================================================================")
    
    challenge_1_zero_emojis()
    challenge_2_zero_lucide()
    challenge_3_pure_light_mode()
    challenge_4_dom_elements()
    challenge_5_app_js_syntax()
    challenge_6_regression_test_suite()

    print("\n================================================================================")
    print("FINAL CHALLENGER VERIFICATION SUMMARY")
    print("================================================================================")
    total = len(TEST_RESULTS)
    passed = sum(1 for r in TEST_RESULTS if r["passed"])
    failed = total - passed

    print(f"Total Checks: {total} | Passed: {passed} | Failed: {failed}")
    if failed == 0:
        print(">>> VERDICT: ALL ADVERSARIAL CHECKS PASSED. RECOMMEND APPROVAL! <<<")
        return 0
    else:
        print(f">>> VERDICT: {failed} CHECKS FAILED. RECOMMEND REQUEST_CHANGES! <<<")
        for r in TEST_RESULTS:
            if not r["passed"]:
                print(f"  - FAIL: {r['name']} ({r['details']})")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
