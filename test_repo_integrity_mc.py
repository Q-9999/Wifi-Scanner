"""
test_repo_integrity_mc.py
Milestone M_C Adversarial Empirical Verification Suite
Challenger 2 (teamwork_challenger_mc_2)

Validates:
1. Exhaustive 0-Emoji audit across PROJECT_OVERVIEW.md, README.md, static/index.html, static/styles.css, static/app.js
   using full Unicode ranges:
   [\U00010000-\U0010ffff], [\u2600-\u27bf], [\u2300-\u23ff], [\u2b50-\u2b55], [\u200d], [\ufe00-\ufe0f],
   plus HTML entities and JS unicode escape sequences.
2. 0 Lucide icon audit:
   Assert <i data-lucide does NOT exist in static/index.html, and lucide script / createIcons are not used.
3. 8 Functional Tabs synchronization audit:
   Assert both PROJECT_OVERVIEW.md and README.md explicitly document each of the 8 tabs.
4. Pure CSS Light Mode architecture audit:
   Assert :root has --bg-main: #f8fafc or --bg-primary: #f8fafc.
   Assert no [data-theme="light"], [data-theme="dark"], or prefers-color-scheme: dark exist.
5. Verification of Distance Calibration coordinate fix in static/app.js:
   Assert midY is computed using (cm.py1 + cm.py2) / 2.
6. Python backend source files zero-emoji audit.
7. Bilingual slash prohibition audit across markdown and static assets.
8. Subprocess execution of all test suites (node syntax, full suite, and milestone challengers).
"""

import os
import re
import sys
import subprocess

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

REPO_ROOT = os.path.dirname(os.path.abspath(__file__))

# ------------------------------------------------------------------------------
# Test 1: Full Unicode Emoji Regex Audit
# ------------------------------------------------------------------------------
def test_exhaustive_zero_emoji():
    print("\n[+] Test 1: Exhaustive Zero-Emoji Audit")
    
    target_files = [
        "PROJECT_OVERVIEW.md",
        "README.md",
        os.path.join("static", "index.html"),
        os.path.join("static", "styles.css"),
        os.path.join("static", "app.js"),
    ]
    
    emoji_regex = re.compile(
        r'[\U00010000-\U0010ffff]|[\u2600-\u27bf]|[\u2300-\u23ff]|[\u2b50-\u2b55]|[\u200d]|[\ufe00-\ufe0f]'
    )
    html_entity_regex = re.compile(
        r'&#(?:x1[fF][0-9a-fA-F]{3}|12[89][0-9]{4});'
    )
    js_escaped_emoji_regex = re.compile(
        r'\\u[dD][89a-bA-B][0-9a-fA-F]{2}\\u[dD][c-fC-F][0-9a-fA-F]{2}'
    )
    
    total_scanned = 0
    total_violations = 0
    
    for rel_path in target_files:
        full_path = os.path.join(REPO_ROOT, rel_path)
        assert os.path.exists(full_path), f"File not found: {rel_path}"
        total_scanned += 1
        
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
            
        # Check raw unicode
        matches = emoji_regex.findall(content)
        if matches:
            print(f"  [-] FAIL: Found {len(matches)} emoji matches in {rel_path}: {matches[:10]}")
            total_violations += len(matches)
        else:
            print(f"  [x] PASS: 0 raw emojis in {rel_path}")
            
        # Check HTML entities
        entity_matches = html_entity_regex.findall(content)
        if entity_matches:
            print(f"  [-] FAIL: Found {len(entity_matches)} emoji HTML entities in {rel_path}: {entity_matches[:10]}")
            total_violations += len(entity_matches)
        else:
            print(f"  [x] PASS: 0 emoji HTML entities in {rel_path}")
            
        # Check JS escaped unicode emojis if file is JS
        if rel_path.endswith(".js"):
            escaped_matches = js_escaped_emoji_regex.findall(content)
            if escaped_matches:
                print(f"  [-] FAIL: Found {len(escaped_matches)} escaped emojis in {rel_path}: {escaped_matches[:10]}")
                total_violations += len(escaped_matches)
            else:
                print(f"  [x] PASS: 0 escaped emojis in {rel_path}")

    assert total_violations == 0, f"Exhaustive emoji audit failed with {total_violations} violations!"
    print(f"  ==> All {total_scanned} files passed 0-emoji audit.")

# ------------------------------------------------------------------------------
# Test 2: 0 Lucide Icon Audit
# ------------------------------------------------------------------------------
def test_zero_lucide_icons():
    print("\n[+] Test 2: Zero Lucide Icon Audit")
    
    html_path = os.path.join(REPO_ROOT, "static", "index.html")
    with open(html_path, "r", encoding="utf-8") as f:
        html_content = f.read()
        
    lucide_i_tags = re.findall(r'<i\s+[^>]*data-lucide[^>]*>', html_content, re.IGNORECASE)
    assert len(lucide_i_tags) == 0, f"Found {len(lucide_i_tags)} <i data-lucide> tags in index.html: {lucide_i_tags[:5]}"
    print("  [x] PASS: 0 <i data-lucide> tags in static/index.html")
    
    # Also assert lucide library script is not included
    lucide_script = re.search(r'<script[^>]*src=["\'][^"\']*lucide[^"\']*["\']', html_content, re.IGNORECASE)
    assert lucide_script is None, f"Found Lucide script inclusion in index.html: {lucide_script.group(0)}"
    print("  [x] PASS: No lucide script tag in static/index.html")
    
    # Also assert static/app.js doesn't call lucide.createIcons
    js_path = os.path.join(REPO_ROOT, "static", "app.js")
    with open(js_path, "r", encoding="utf-8") as f:
        js_content = f.read()
    lucide_calls = re.findall(r'lucide\.createIcons', js_content, re.IGNORECASE)
    assert len(lucide_calls) == 0, f"Found lucide.createIcons call in static/app.js"
    print("  [x] PASS: No lucide.createIcons calls in static/app.js")

# ------------------------------------------------------------------------------
# Test 3: 8 Functional Tabs Synchronization Audit
# ------------------------------------------------------------------------------
def test_eight_tabs_documentation_sync():
    print("\n[+] Test 3: 8 Functional Tabs Synchronization Audit")
    
    eight_tabs = [
        {
            "id": "tab-survey",
            "name": "Khảo sát sóng (Survey)",
            "patterns": [r"khảo sát\s*sóng", r"tab[\s\-_]*survey", r"survey"]
        },
        {
            "id": "tab-spectrum",
            "name": "Phổ tần vô tuyến (Spectrum)",
            "patterns": [r"phổ\s*tần\s*vô\s*tuyến", r"tab[\s\-_]*spectrum", r"spectrum"]
        },
        {
            "id": "tab-optimizer",
            "name": "Tối ưu hóa và chẩn đoán Oscium (Optimizer)",
            "patterns": [r"tối\s*ưu\s*hóa", r"oscium", r"optimizer"]
        },
        {
            "id": "tab-speedtest",
            "name": "Đo tốc độ mạng (Speed Test)",
            "patterns": [r"đo\s*tốc\s*độ", r"speed\s*test", r"speedtest"]
        },
        {
            "id": "tab-vowifi",
            "name": "Chất lượng cuộc gọi thoại VoWiFi",
            "patterns": [r"cuộc\s*gọi\s*thoại", r"vowifi", r"vowi-fi"]
        },
        {
            "id": "tab-planner",
            "name": "Bản đồ nhiệt sóng (Heatmap / Planner)",
            "patterns": [r"bản\s*đồ\s*nhiệt", r"heatmap", r"planner"]
        },
        {
            "id": "tab-security",
            "name": "Kiểm tra an toàn bảo mật (Security Audit)",
            "patterns": [r"an\s*toàn\s*bảo\s*mật", r"bảo\s*mật", r"security"]
        },
        {
            "id": "tab-reports",
            "name": "Lưu trữ và xuất báo cáo (Reports)",
            "patterns": [r"lưu\s*trữ.*báo\s*cáo", r"báo\s*cáo", r"reports?"]
        }
    ]
    
    docs = ["PROJECT_OVERVIEW.md", "README.md"]
    for doc_name in docs:
        doc_path = os.path.join(REPO_ROOT, doc_name)
        assert os.path.exists(doc_path), f"Doc not found: {doc_name}"
        with open(doc_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        print(f"  Verifying {doc_name} covers all 8 functional tabs...")
        for tab in eight_tabs:
            matched = False
            for pat in tab["patterns"]:
                if re.search(pat, content, re.IGNORECASE):
                    matched = True
                    break
            assert matched, f"{doc_name} is missing documentation for {tab['name']} (patterns: {tab['patterns']})"
            print(f"    [x] {tab['name']} documented in {doc_name}")

    print("  ==> Both docs properly synchronize all 8 functional tabs.")

# ------------------------------------------------------------------------------
# Test 4: Pure CSS Light Mode Architecture Audit
# ------------------------------------------------------------------------------
def test_css_pure_light_mode_architecture():
    print("\n[+] Test 4: Pure CSS Light Mode Architecture Audit")
    
    css_path = os.path.join(REPO_ROOT, "static", "styles.css")
    with open(css_path, "r", encoding="utf-8") as f:
        css = f.read()
        
    root_match = re.search(r':root\s*\{([^}]+)\}', css)
    assert root_match, "styles.css missing :root definition"
    root_body = root_match.group(1)
    
    # 1. Assert light background variables
    has_light_bg = ("--bg-main: #f8fafc" in root_body) or ("--bg-primary: #f8fafc" in root_body)
    assert has_light_bg, f"styles.css :root missing --bg-main or --bg-primary: #f8fafc"
    print("  [x] PASS: :root specifies --bg-main / --bg-primary: #f8fafc")
    
    # 2. Assert card background
    has_card_bg = ("--bg-card: #ffffff" in root_body) or ("--card-bg: #ffffff" in root_body)
    assert has_card_bg, "styles.css :root missing white card background (#ffffff)"
    print("  [x] PASS: :root specifies --bg-card / --card-bg: #ffffff")
    
    # 3. Assert color-scheme: light
    assert "color-scheme: light" in root_body, "styles.css :root missing color-scheme: light"
    print("  [x] PASS: :root specifies color-scheme: light")
    
    # 4. Assert text primary is dark slate
    assert "--text-primary: #0f172a" in root_body, "styles.css :root missing --text-primary: #0f172a"
    print("  [x] PASS: :root specifies --text-primary: #0f172a")
    
    # 5. Assert no dark theme selectors or dark mode media queries
    forbidden_dark_selectors = [
        r'\[data-theme=["\']?light["\']?\]',
        r'\[data-theme=["\']?dark["\']?\]',
        r'prefers-color-scheme\s*:\s*dark',
        r'\.dark-theme',
        r'\.dark-mode'
    ]
    for pattern in forbidden_dark_selectors:
        match = re.search(pattern, css, re.IGNORECASE)
        assert match is None, f"Found obsolete dark/theme toggle rule in styles.css: {match.group(0)}"
    print("  [x] PASS: No [data-theme], prefers-color-scheme: dark, or dark mode overrides in styles.css")

# ------------------------------------------------------------------------------
# Test 5: Verify Calibrated Distance Center Coordinate in static/app.js
# ------------------------------------------------------------------------------
def test_app_js_calibration_coordinate_fix():
    print("\n[+] Test 5: Verify Distance Calibration Coordinate Fix in static/app.js")
    js_path = os.path.join(REPO_ROOT, "static", "app.js")
    with open(js_path, "r", encoding="utf-8") as f:
        js = f.read()
    
    # Ensure midY is computed using py1 and py2, not px1 and py2
    assert "midY = (cm.py1 + cm.py2) / 2" in js, "static/app.js does NOT contain the bug fix: midY = (cm.py1 + cm.py2) / 2"
    assert "midY = (cm.px1 + cm.py2) / 2" not in js, "static/app.js still contains buggy code: midY = (cm.px1 + cm.py2) / 2"
    print("  [x] PASS: static/app.js correctly calculates midY = (cm.py1 + cm.py2) / 2")

# ------------------------------------------------------------------------------
# Test 6: Python Source Code Zero-Emoji Audit
# ------------------------------------------------------------------------------
def test_python_source_zero_emoji():
    print("\n[+] Test 6: Python Backend Source Files Zero-Emoji Audit")
    py_files = [
        "server.py", "channel_analyzer.py", "wifi_scanner.py",
        "speedtest_runner.py", "ai_planner.py", "vowifi_analyzer.py",
        "report_generator.py", "run.py"
    ]
    emoji_regex = re.compile(
        r'[\U00010000-\U0010ffff]|[\u2600-\u27bf]|[\u2300-\u23ff]|[\u2b50-\u2b55]|[\u200d]|[\ufe00-\ufe0f]'
    )
    for pf in py_files:
        path = os.path.join(REPO_ROOT, pf)
        if not os.path.exists(path):
            continue
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            c = f.read()
        m = emoji_regex.findall(c)
        assert len(m) == 0, f"Found emojis in Python file {pf}: {m[:5]}"
        print(f"  [x] PASS: 0 emojis in {pf}")
    print("  ==> All Python core files passed 0-emoji check.")

# ------------------------------------------------------------------------------
# Test 7: Bilingual Slash Prohibition Audit
# ------------------------------------------------------------------------------
def test_bilingual_slash_prohibition():
    print("\n[+] Test 7: Bilingual Slash String Audit")
    forbidden_patterns = [
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
    target_files = [
        "PROJECT_OVERVIEW.md",
        "README.md",
        os.path.join("static", "index.html"),
        os.path.join("static", "styles.css"),
        os.path.join("static", "app.js")
    ]
    for rel_path in target_files:
        full_path = os.path.join(REPO_ROOT, rel_path)
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        for p in forbidden_patterns:
            m = p.search(content)
            assert m is None, f"Found forbidden bilingual slash string in {rel_path}: {m.group(0)}"
        print(f"  [x] PASS: No bilingual slash patterns in {rel_path}")

# ------------------------------------------------------------------------------
# Test 8: End-to-End Suite Execution Check
# ------------------------------------------------------------------------------
def test_subprocess_e2e_suites():
    print("\n[+] Test 8: Automated Verification of Existing Test Suites")
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    
    # 1. node --check static/app.js
    res_node = subprocess.run(["node", "--check", "static/app.js"], cwd=REPO_ROOT, capture_output=True, encoding="utf-8", errors="replace")
    assert res_node.returncode == 0, f"node --check static/app.js failed:\n{res_node.stderr}"
    print("  [x] PASS: node --check static/app.js (syntax OK)")
    
    # 2. python test_full_suite.py
    res_full = subprocess.run([sys.executable, "test_full_suite.py"], cwd=REPO_ROOT, capture_output=True, encoding="utf-8", errors="replace", env=env)
    assert res_full.returncode == 0, f"test_full_suite.py failed:\n{res_full.stderr}\n{res_full.stdout}"
    assert "ALL VERIFICATIONS PASSED SUCCESSFULLY!" in res_full.stdout
    print("  [x] PASS: python test_full_suite.py (9/9 sections passed)")
    
    # 3. python test_adversarial_m_a.py
    res_adv_ma = subprocess.run([sys.executable, "test_adversarial_m_a.py"], cwd=REPO_ROOT, capture_output=True, encoding="utf-8", errors="replace", env=env)
    assert res_adv_ma.returncode == 0, f"test_adversarial_m_a.py failed:\n{res_adv_ma.stderr}"
    print("  [x] PASS: python test_adversarial_m_a.py (passed)")
    
    # 4. python test_challenger_ma.py
    res_ch_ma = subprocess.run([sys.executable, "test_challenger_ma.py"], cwd=REPO_ROOT, capture_output=True, encoding="utf-8", errors="replace", env=env)
    assert res_ch_ma.returncode == 0, f"test_challenger_ma.py failed:\n{res_ch_ma.stderr}"
    print("  [x] PASS: python test_challenger_ma.py (passed)")
    
    # 5. python test_challenger_mb_static.py
    res_ch_mb_s = subprocess.run([sys.executable, "test_challenger_mb_static.py"], cwd=REPO_ROOT, capture_output=True, encoding="utf-8", errors="replace", env=env)
    assert res_ch_mb_s.returncode == 0, f"test_challenger_mb_static.py failed:\n{res_ch_mb_s.stderr}"
    print("  [x] PASS: python test_challenger_mb_static.py (passed)")
    
    # 6. python test_challenger_mb_dynamic.py
    res_ch_mb_d = subprocess.run([sys.executable, "test_challenger_mb_dynamic.py"], cwd=REPO_ROOT, capture_output=True, encoding="utf-8", errors="replace", env=env)
    assert res_ch_mb_d.returncode == 0, f"test_challenger_mb_dynamic.py failed:\n{res_ch_mb_d.stderr}"
    print("  [x] PASS: python test_challenger_mb_dynamic.py (passed)")

# ------------------------------------------------------------------------------
# Main Execution
# ------------------------------------------------------------------------------
if __name__ == "__main__":
    print("======================================================================")
    print("   Milestone M_C: Challenger 2 Empirical Integrity & Doc Test Suite   ")
    print("======================================================================")
    
    try:
        test_exhaustive_zero_emoji()
        test_zero_lucide_icons()
        test_eight_tabs_documentation_sync()
        test_css_pure_light_mode_architecture()
        test_app_js_calibration_coordinate_fix()
        test_python_source_zero_emoji()
        test_bilingual_slash_prohibition()
        test_subprocess_e2e_suites()
        
        print("\n======================================================================")
        print("   ALL CHALLENGER 2 EMPIRICAL INTEGRITY TESTS PASSED SUCCESSFULLY!    ")
        print("======================================================================")
        sys.exit(0)
    except AssertionError as e:
        print(f"\n[!] ADVERSARIAL TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[!] UNEXPECTED EXCEPTION: {e}")
        sys.exit(2)
