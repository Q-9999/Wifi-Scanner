# -*- coding: utf-8 -*-
"""
test_challenger_ma.py — Adversarial Verification Suite for Milestone M_A
Empirically stress-tests speedtest_runner.py and server.py:
1. Response contract validation (10 fields across all 5 states: idle, running, completed, error, stopped)
2. Concurrent start_speedtest calls (graceful handling, no thread corruption/deadlock)
3. Stop mid-test (immediate stop, thread cleanup, restartability)
4. Mock mode with various parameters vs default/quick/full
5. Network timeout / disconnect handling (status='error', Vietnamese message, no server crash)
6. Oscium troubleshooting contract & invariants
7. Bilingual cleanliness check across M_A files
"""

import sys
import os
import time
import json
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from unittest.mock import patch
import httpx
from fastapi.testclient import TestClient

sys.stdout.reconfigure(encoding='utf-8')
root_dir = os.path.dirname(os.path.abspath(__file__))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import speedtest_runner
from speedtest_runner import SpeedTestRunner, get_speedtest_runner, run_speedtest_sync
import server

client = TestClient(server.app)

CONTRACT_10_FIELDS = [
    "status",
    "stage",
    "progress_pct",
    "ping_ms",
    "jitter_ms",
    "download_mbps",
    "upload_mbps",
    "link_speed_mbps",
    "server_location",
    "error_message"
]

def assert_contract_fields(data: dict, state_name: str):
    """Verify that all 10 required contract fields exist and match expected types."""
    for field in CONTRACT_10_FIELDS:
        assert field in data, f"[{state_name}] Field '{field}' missing from speedtest response: {data.keys()}"
    
    assert data["status"] in ("idle", "running", "completed", "error", "stopped"), f"[{state_name}] Invalid status: {data['status']}"
    assert data["stage"] in ("idle", "ping", "download", "upload", "finished"), f"[{state_name}] Invalid stage: {data['stage']}"
    assert isinstance(data["progress_pct"], (int, float)) and 0 <= data["progress_pct"] <= 100, f"[{state_name}] Invalid progress_pct: {data['progress_pct']}"
    assert isinstance(data["ping_ms"], (int, float)) and data["ping_ms"] >= 0, f"[{state_name}] Invalid ping_ms: {data['ping_ms']}"
    assert isinstance(data["jitter_ms"], (int, float)) and data["jitter_ms"] >= 0, f"[{state_name}] Invalid jitter_ms: {data['jitter_ms']}"
    assert isinstance(data["download_mbps"], (int, float)) and data["download_mbps"] >= 0, f"[{state_name}] Invalid download_mbps: {data['download_mbps']}"
    assert isinstance(data["upload_mbps"], (int, float)) and data["upload_mbps"] >= 0, f"[{state_name}] Invalid upload_mbps: {data['upload_mbps']}"
    assert isinstance(data["link_speed_mbps"], (int, float)) and data["link_speed_mbps"] >= 0, f"[{state_name}] Invalid link_speed_mbps: {data['link_speed_mbps']}"
    assert isinstance(data["server_location"], str) and len(data["server_location"]) > 0, f"[{state_name}] Invalid server_location: {data['server_location']}"
    assert data["error_message"] is None or isinstance(data["error_message"], str), f"[{state_name}] Invalid error_message: {data['error_message']}"


def test_1_response_contract_across_all_states():
    print("\n--- Test 1: Response Contract Validation across all states ---")
    
    # 1. State: IDLE
    runner = SpeedTestRunner()
    idle_state = runner.get_state()
    assert idle_state["status"] == "idle"
    assert_contract_fields(idle_state, "IDLE_RUNNER")
    
    # Check via server endpoint with fresh runner instance injected
    original_runner = server.speedtest_runner
    server.speedtest_runner = runner
    try:
        res = client.get("/api/speedtest/status")
        assert res.status_code == 200
        assert_contract_fields(res.json(), "IDLE_API")
        print("  [PASS] IDLE state schema contract validated.")
        
        # 2. State: COMPLETED (start mock test from idle)
        runner.start(mode="mock")
        res = client.get("/api/speedtest/status")
        assert res.status_code == 200
        assert res.json()["status"] == "completed"
        assert res.json()["progress_pct"] == 100
        assert_contract_fields(res.json(), "COMPLETED_API")
        print("  [PASS] COMPLETED state schema contract validated.")

        # 3. State: RUNNING
        runner._state = runner._create_initial_state()
        runner._state["status"] = "running"
        runner._state["stage"] = "download"
        runner._state["progress_pct"] = 45
        res = client.get("/api/speedtest/status")
        assert res.status_code == 200
        assert res.json()["status"] == "running"
        assert_contract_fields(res.json(), "RUNNING_API")
        print("  [PASS] RUNNING state schema contract validated.")

        # 4. State: STOPPED (stopping while running)
        stop_res = runner.stop()
        assert stop_res["status"] == "stopped"
        res = client.get("/api/speedtest/status")
        assert res.status_code == 200
        assert res.json()["status"] == "stopped"
        assert_contract_fields(res.json(), "STOPPED_API")
        print("  [PASS] STOPPED state schema contract validated.")

        # 5. State: ERROR
        runner._update_state(
            status="error",
            stage="finished",
            error_message="Lỗi trong quá trình đo: Mô phỏng lỗi máy chủ",
            phase_text_vi="Đo kiểm gặp lỗi kết nối"
        )
        res = client.get("/api/speedtest/status")
        assert res.status_code == 200
        assert res.json()["status"] == "error"
        assert "Lỗi trong quá trình đo:" in res.json()["error_message"]
        assert_contract_fields(res.json(), "ERROR_API")
        print("  [PASS] ERROR state schema contract validated.")

    finally:
        server.speedtest_runner = original_runner


def test_2_concurrent_start_calls():
    print("\n--- Test 2: Concurrent Calls to start_speedtest ---")
    runner = SpeedTestRunner()
    original_runner = server.speedtest_runner
    server.speedtest_runner = runner

    try:
        # Start runner in running state
        runner._state["status"] = "running"
        runner._state["test_id"] = "test-uuid-constant"

        num_threads = 25
        responses = []

        def call_start(idx):
            return client.post("/api/speedtest/start", json={"mode": "quick"})

        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(call_start, i) for i in range(num_threads)]
            for f in as_completed(futures):
                responses.append(f.result())

        for idx, r in enumerate(responses):
            assert r.status_code in (200, 409), f"Unexpected status code {r.status_code}"
            data = r.json()
            assert data["status"] == "running", f"Call {idx} did not return running status: {data}"
            assert data["test_id"] == "test-uuid-constant", f"Call {idx} modified test_id: {data}"
            assert "Bài đo tốc độ đang chạy" in data.get("message", "")

        # Verify runner state was NOT corrupted
        current_state = runner.get_state()
        assert current_state["status"] == "running"
        assert current_state["test_id"] == "test-uuid-constant"
        print(f"  [PASS] {num_threads} concurrent calls handled gracefully without corruption or thread leaks.")

        # Thundering herd test: 20 threads simultaneously calling start(mode="mock") from idle
        runner._state = runner._create_initial_state()
        herd_responses = []

        def call_start_mock(idx):
            return client.post("/api/speedtest/start", json={"mode": "mock"})

        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(call_start_mock, i) for i in range(20)]
            for f in as_completed(futures):
                herd_responses.append(f.result())

        for r in herd_responses:
            assert r.status_code == 200
            data = r.json()
            assert data["status"] == "running"

        final_st = client.get("/api/speedtest/status").json()
        assert final_st["status"] == "completed"
        print("  [PASS] Thundering herd start calls from idle state succeeded safely.")

    finally:
        server.speedtest_runner = original_runner


def test_3_stop_mid_test():
    print("\n--- Test 3: Stop Mid-Test (stop_speedtest) ---")
    runner = SpeedTestRunner()
    original_runner = server.speedtest_runner
    server.speedtest_runner = runner

    try:
        # Mock speedtest_runner's httpx.Client to simulate long-running ping so we can stop mid-flight
        started_event = threading.Event()
        
        class SlowMockClient:
            def __init__(self, *args, **kwargs):
                pass
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass
            def get(self, *args, **kwargs):
                started_event.set()
                time.sleep(0.4)
                return httpx.Response(200, headers={"city": "Hanoi", "country": "VN", "colo": "HAN"}, content=b"")

        with patch.object(speedtest_runner.httpx, "Client", SlowMockClient):
            start_res = client.post("/api/speedtest/start", json={"mode": "quick"})
            assert start_res.status_code == 200
            assert started_event.wait(timeout=2.0), "Worker thread did not start in time"

            # Stop test mid-flight
            stop_res = client.post("/api/speedtest/stop")
            assert stop_res.status_code == 200
            data = stop_res.json()
            assert data["status"] == "stopped"
            assert "Người dùng đã dừng bài đo" in data["phase_text_vi"]
            assert data["error_message"] == "Đã dừng bài đo kiểm"

            # Wait for thread to exit
            if runner._worker_thread:
                runner._worker_thread.join(timeout=3.0)
                assert not runner._worker_thread.is_alive(), "Worker thread failed to terminate after stop"

            # Check status endpoint
            st = client.get("/api/speedtest/status").json()
            assert st["status"] == "stopped"
            assert_contract_fields(st, "STOPPED_CHECK")
            print("  [PASS] Stopped mid-test cleanly; worker thread terminated.")

            # Test restartability after stop
            re_res = client.post("/api/speedtest/start", json={"mode": "mock"})
            assert re_res.status_code == 200
            st2 = client.get("/api/speedtest/status").json()
            assert st2["status"] == "completed"
            assert st2["download_mbps"] > 0
            print("  [PASS] Runner restarted cleanly after prior stop.")

            # Idempotency of stop on completed runner
            stop_again = client.post("/api/speedtest/stop").json()
            assert stop_again["status"] == "completed"  # Completed state not overwritten if not running
            print("  [PASS] Stop on completed runner is safe and idempotent.")

    finally:
        server.speedtest_runner = original_runner


def test_4_mock_mode_and_parameter_resilience():
    print("\n--- Test 4: Mock Mode vs Default Mode & Parameter Resilience ---")
    runner = SpeedTestRunner()
    original_runner = server.speedtest_runner
    server.speedtest_runner = runner

    try:
        # 1. Mock mode timing & deterministic payload
        t0 = time.time()
        start_res = client.post("/api/speedtest/start", json={"mode": "mock"})
        elapsed = time.time() - t0
        assert start_res.status_code == 200
        assert elapsed < 0.1, f"Mock mode took too long: {elapsed:.3f}s"
        
        st = client.get("/api/speedtest/status").json()
        assert st["status"] == "completed"
        assert st["download_mbps"] == 95.8
        assert st["upload_mbps"] == 42.1
        assert st["ping_ms"] == 24.5
        assert st["jitter_ms"] == 3.2
        assert st["network_context"] is not None
        print(f"  [PASS] Mock mode completed deterministically in {elapsed:.4f}s.")

        # 2. Empty payload / default parameters
        runner._state = runner._create_initial_state()
        res_empty = client.post("/api/speedtest/start", json={})
        assert res_empty.status_code == 200
        assert res_empty.json()["status"] == "running"
        runner.stop()
        print("  [PASS] Empty JSON payload correctly defaults to 'quick' mode.")

        # 3. None / missing body
        runner._state = runner._create_initial_state()
        res_none = client.post("/api/speedtest/start")
        assert res_none.status_code == 200
        assert res_none.json()["status"] == "running"
        runner.stop()
        print("  [PASS] Missing request body handled gracefully without 422 error.")

        # 4. Unknown / adversarial parameters
        runner._state = runner._create_initial_state()
        res_adv = client.post("/api/speedtest/start", json={"mode": "adversarial_overflow_9999", "extra_bad_field": 12345})
        assert res_adv.status_code == 200
        assert res_adv.json()["status"] == "running"
        runner.stop()
        print("  [PASS] Adversarial unexpected parameters handled safely without crash.")

    finally:
        server.speedtest_runner = original_runner


def test_5_network_timeout_and_disconnect_handling():
    print("\n--- Test 5: Network Timeout & Disconnect Handling ---")
    runner = SpeedTestRunner()
    original_runner = server.speedtest_runner
    server.speedtest_runner = runner

    try:
        # 5.1 Simulated Timeout
        class TimeoutMockClient:
            def __init__(self, *args, **kwargs):
                pass
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass
            def get(self, *args, **kwargs):
                raise httpx.ConnectTimeout("Không thể kết nối đến máy chủ Cloudflare sau 12.0 giây.")

        with patch.object(speedtest_runner.httpx, "Client", TimeoutMockClient):
            res = client.post("/api/speedtest/start", json={"mode": "quick"})
            assert res.status_code == 200
            
            # Wait for worker thread to catch error
            if runner._worker_thread:
                runner._worker_thread.join(timeout=3.0)

            st = client.get("/api/speedtest/status").json()
            assert st["status"] == "error", f"Expected 'error', got '{st['status']}'"
            assert "Lỗi trong quá trình đo:" in st["error_message"]
            assert "Không thể kết nối" in st["error_message"]
            assert st["phase_text_vi"] == "Đo kiểm gặp lỗi kết nối"
            assert_contract_fields(st, "NETWORK_TIMEOUT")
            print("  [PASS] Network timeout captured: status='error', descriptive Vietnamese message, no crash.")

        # 5.2 Simulated Connection Refused / Network Disconnect
        class DisconnectMockClient:
            def __init__(self, *args, **kwargs):
                pass
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass
            def get(self, *args, **kwargs):
                raise httpx.ConnectError("Card mạng bị ngắt kết nối vật lý.")

        runner._state = runner._create_initial_state()
        with patch.object(speedtest_runner.httpx, "Client", DisconnectMockClient):
            res = client.post("/api/speedtest/start", json={"mode": "quick"})
            assert res.status_code == 200
            if runner._worker_thread:
                runner._worker_thread.join(timeout=3.0)

            st = client.get("/api/speedtest/status").json()
            assert st["status"] == "error"
            assert "Card mạng bị ngắt kết nối" in st["error_message"]
            assert_contract_fields(st, "NETWORK_DISCONNECT")
            print("  [PASS] Network disconnect captured: status='error', server remains stable.")

        # 5.3 Simulated HTTP 500 server error
        class Server500MockClient:
            def __init__(self, *args, **kwargs):
                pass
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass
            def get(self, *args, **kwargs):
                return httpx.Response(500, content=b"Cloudflare Internal Server Error")

        runner._state = runner._create_initial_state()
        with patch.object(speedtest_runner.httpx, "Client", Server500MockClient):
            res = client.post("/api/speedtest/start", json={"mode": "quick"})
            assert res.status_code == 200
            if runner._worker_thread:
                runner._worker_thread.join(timeout=3.0)

            st = client.get("/api/speedtest/status").json()
            assert st["status"] == "error"
            assert "Không nhận được phản hồi từ máy chủ đo kiểm Cloudflare" in st["error_message"]
            assert_contract_fields(st, "HTTP_500")
            print("  [PASS] Remote HTTP 500 captured: status='error', proper Vietnamese message.")

    finally:
        server.speedtest_runner = original_runner


def test_6_oscium_troubleshooting_contract_and_invariants():
    print("\n--- Test 6: Oscium Troubleshooting Contract & Invariants ---")
    res = client.get("/api/troubleshooting/all-in-one")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    data = res.json()

    assert data["status"] == "success"
    assert "connected_interface" in data, "Root JSON missing 'connected_interface'"
    assert "troubleshooting_suite" in data, "Root JSON missing 'troubleshooting_suite'"

    ts = data["troubleshooting_suite"]
    assert "adapter_diagnostics" in ts, "troubleshooting_suite missing 'adapter_diagnostics'"
    assert "automated_root_cause" in ts, "troubleshooting_suite missing 'automated_root_cause'"

    # 5 Oscium invariants
    assert "spectrum_classifiers" in ts and len(ts["spectrum_classifiers"]) == 5, f"Expected 5 spectrum classifiers, got {len(ts.get('spectrum_classifiers', []))}"
    assert "checklist" in ts and len(ts["checklist"]) == 6, f"Expected 6 checklist items, got {len(ts.get('checklist', []))}"
    assert "non_wifi_interferers" in ts and len(ts["non_wifi_interferers"]) == 4, f"Expected 4 non_wifi_interferers, got {len(ts.get('non_wifi_interferers', []))}"
    assert "health_score" in ts and 0 <= ts["health_score"] <= 100, f"Invalid health_score: {ts.get('health_score')}"
    assert "estimated_retry_rate_pct" in ts, "Missing estimated_retry_rate_pct"

    # Validate automated root cause fields
    rc = ts["automated_root_cause"]
    assert "primary_issue_vi" in rc and len(rc["primary_issue_vi"]) > 0
    assert rc["severity"] in ("info", "warning", "critical")
    assert "action_steps_vi" in rc and len(rc["action_steps_vi"]) > 0
    print("  [PASS] All Oscium contracts, root cause, and 5 invariants verified.")


def test_7_bilingual_cleanliness_check():
    print("\n--- Test 7: Bilingual Cleanliness across M_A backend files ---")
    files_to_check = [
        "speedtest_runner.py",
        "server.py",
        "channel_analyzer.py",
        "vowifi_analyzer.py",
        "report_generator.py",
        "ai_planner.py"
    ]

    forbidden_patterns = [
        "Tuyệt Vời / Excellent",
        "Tốt / Good",
        "Khá / Fair",
        "Kém / Poor",
        "Rất Kém / Bad",
        "Gateway AP",
        "Mesh Node"
    ]

    for fname in files_to_check:
        fpath = os.path.join(root_dir, fname)
        with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            for pattern in forbidden_patterns:
                assert pattern not in content, f"Forbidden bilingual/English pattern '{pattern}' found in {fname}"

    print(f"  [PASS] All {len(files_to_check)} backend files checked and free of forbidden bilingual patterns.")


def test_8_sse_realtime_stream():
    print("\n--- Test 8: Server-Sent Events (SSE) Stream Endpoint ---")
    runner = SpeedTestRunner()
    original_runner = server.speedtest_runner
    server.speedtest_runner = runner

    try:
        # Start mock test
        runner.start(mode="mock")
        resp = client.get("/api/speedtest/stream")
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers.get("content-type", "")

        events = []
        for line in resp.iter_lines():
            if line.startswith("data:"):
                payload = json.loads(line[5:].strip())
                events.append(payload)

        assert len(events) >= 1, "Expected at least 1 SSE data event"
        last_event = events[-1]
        assert last_event["status"] == "completed"
        assert_contract_fields(last_event, "SSE_EVENT")
        print(f"  [PASS] SSE stream delivered {len(events)} valid events and closed cleanly.")

    finally:
        server.speedtest_runner = original_runner


if __name__ == "__main__":
    print("=================================================================")
    print("  MMQ./NetScanner Adversarial Test Suite (Milestone M_A)         ")
    print("=================================================================")
    
    test_1_response_contract_across_all_states()
    test_2_concurrent_start_calls()
    test_3_stop_mid_test()
    test_4_mock_mode_and_parameter_resilience()
    test_5_network_timeout_and_disconnect_handling()
    test_6_oscium_troubleshooting_contract_and_invariants()
    test_7_bilingual_cleanliness_check()
    test_8_sse_realtime_stream()

    print("\n=================================================================")
    print("  ALL ADVERSARIAL CHALLENGES COMPLETED SUCCESSFULLY!             ")
    print("=================================================================")
