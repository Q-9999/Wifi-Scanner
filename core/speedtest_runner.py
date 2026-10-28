# -*- coding: utf-8 -*-
"""
Module: speedtest_runner.py
Mo ta: Bo thuc thi do kiem toc do mang Wi-Fi (Download, Upload, Ping, Jitter)
       dua tren ha tang Cloudflare Anycast Speed CDN bang thu vien httpx.
       Ho tro che do chay that (live/quick/full) va che do kiem thu gia lap (mock).
"""

import time
import uuid
import threading
from typing import Dict, Any, Optional, List
import httpx

try:
    from . import wifi_scanner
except ImportError:
    try:
        from core import wifi_scanner
    except ImportError:
        import wifi_scanner

BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

CF_SPEED_BASE = "https://speed.cloudflare.com"
CF_DOWN_URL = f"{CF_SPEED_BASE}/__down"
CF_UP_URL = f"{CF_SPEED_BASE}/__up"


class SpeedTestRunner:
    """Dieu phoi va quan ly tien trinh do toc do mang Wi-Fi bat dong bo"""

    def __init__(self):
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._worker_thread: Optional[threading.Thread] = None
        self._state: Dict[str, Any] = self._create_initial_state()

    def _create_initial_state(self) -> Dict[str, Any]:
        return {
            "status": "idle",
            "stage": "idle",
            "progress_pct": 0,
            "ping_ms": 0.0,
            "jitter_ms": 0.0,
            "download_mbps": 0.0,
            "upload_mbps": 0.0,
            "link_speed_mbps": 0.0,
            "server_location": "Chưa xác định",
            "error_message": None,
            "test_id": None,
            "phase_text_vi": "Chưa thực hiện đo kiểm",
            "elapsed_seconds": 0.0,
            "diagnosis_vi": None,
            "network_context": {},
            "version": 0
        }

    def get_state(self) -> Dict[str, Any]:
        with self._lock:
            return dict(self._state)

    def _update_state(self, **kwargs):
        with self._lock:
            self._state.update(kwargs)
            self._state["version"] = self._state.get("version", 0) + 1

    def stop(self) -> Dict[str, Any]:
        """Yeu cau dung tien trinh do dang chay"""
        self._stop_event.set()
        with self._lock:
            if self._state["status"] == "running":
                self._state["status"] = "stopped"
                self._state["phase_text_vi"] = "Người dùng đã dừng bài đo"
                self._state["error_message"] = "Đã dừng bài đo kiểm"
                self._state["version"] = self._state.get("version", 0) + 1
            return dict(self._state)

    def start(self, mode: str = "quick") -> Dict[str, Any]:
        """Khoi dong bai do kiem toc do mang"""
        with self._lock:
            if self._state["status"] == "running":
                return {
                    "status": "running",
                    "test_id": self._state["test_id"],
                    "message": "Bài đo tốc độ đang chạy"
                }

            test_id = str(uuid.uuid4())
            self._stop_event.clear()
            self._state = self._create_initial_state()
            self._state["status"] = "running"
            self._state["stage"] = "ping"
            self._state["test_id"] = test_id
            self._state["phase_text_vi"] = "Đang khởi tạo bài đo..."
            self._state["version"] = 1

        # Che do kiem thu gia lap (mock): Thuc hien dong bo ngay lap tuc (< 0.05 giay)
        if mode == "mock":
            self._run_mock_test(test_id)
            return {"status": "running", "test_id": test_id}

        # Che do do live: Chay tren luong ngam (daemon thread)
        self._worker_thread = threading.Thread(
            target=self._run_live_test,
            args=(test_id, mode),
            daemon=True
        )
        self._worker_thread.start()
        return {"status": "running", "test_id": test_id}

    def _run_mock_test(self, test_id: str):
        """Gia lap ket qua tat dinh trong < 0.05 giay phuc vu test tu dong"""
        iface = wifi_scanner.get_connected_interface_info()
        link_speed = max(iface.get("rx_rate") or 0.0, iface.get("tx_rate") or 0.0)
        if link_speed <= 0.0:
            link_speed = 866.7

        self._update_state(
            status="completed",
            stage="finished",
            progress_pct=100,
            ping_ms=24.5,
            jitter_ms=3.2,
            download_mbps=95.8,
            upload_mbps=42.1,
            link_speed_mbps=link_speed,
            server_location="Cloudflare Anycast CDN (Khu vực giả lập: TP. Hồ Chí Minh)",
            error_message=None,
            phase_text_vi="Đo kiểm tốc độ hoàn tất (Chế độ kiểm thử nhanh)",
            elapsed_seconds=0.04,
            diagnosis_vi="Kết nối Internet hoạt động rất tốt (Dữ liệu kiểm thử giả lập).",
            network_context={
                "ssid": iface.get("ssid") or "Wi-Fi Giả Lập",
                "band": iface.get("band") or "5 GHz",
                "channel": iface.get("channel") or 60,
                "signal_percent": iface.get("signal") or 90
            }
        )

    def _run_live_test(self, test_id: str, mode: str):
        t_start = time.time()
        headers = {
            "User-Agent": BROWSER_USER_AGENT,
            "Accept": "*/*",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
        }

        try:
            with httpx.Client(headers=headers, timeout=12.0, follow_redirects=True) as client:
                # GIAI ĐOẠN 1: ĐO ĐỘ TRỄ (PING) & BIẾN ĐỘNG ĐỘ TRỄ (JITTER)
                self._update_state(
                    stage="ping",
                    phase_text_vi="Đang đo độ trễ và biến động độ trễ...",
                    progress_pct=5
                )

                # Warmup connection
                try:
                    client.get(f"{CF_DOWN_URL}?bytes=0")
                except Exception:
                    pass

                ping_samples: List[float] = []
                num_pings = 5 if mode == "quick" else 8
                last_resp_headers: Dict[str, str] = {}

                for i in range(num_pings):
                    if self._stop_event.is_set():
                        return
                    t0 = time.perf_counter()
                    resp = client.get(f"{CF_DOWN_URL}?bytes=0")
                    t1 = time.perf_counter()
                    if resp.status_code == 200:
                        ping_samples.append((t1 - t0) * 1000.0)
                        last_resp_headers = dict(resp.headers)
                    pct = 5 + int(((i + 1) / num_pings) * 20)
                    self._update_state(progress_pct=pct)
                    time.sleep(0.04)

                if not ping_samples:
                    raise Exception("Không nhận được phản hồi từ máy chủ đo kiểm Cloudflare.")

                avg_ping = round(sum(ping_samples) / len(ping_samples), 2)
                diffs = [abs(ping_samples[j] - ping_samples[j - 1]) for j in range(1, len(ping_samples))]
                jitter = round(sum(diffs) / len(diffs), 2) if diffs else 0.0

                server_loc = self._extract_location(last_resp_headers)
                self._update_state(
                    ping_ms=avg_ping,
                    jitter_ms=jitter,
                    server_location=server_loc,
                    progress_pct=25
                )

                # GIAI ĐOẠN 2: ĐO TỐC ĐỘ TẢI VỀ (DOWNLOAD)
                self._update_state(
                    stage="download",
                    phase_text_vi="Đang đo tốc độ tải về (Download)...",
                    progress_pct=26
                )

                down_bytes_target = 5_000_000 if mode == "quick" else 10_000_000
                t_down_start = time.perf_counter()
                bytes_received = 0

                with client.stream("GET", f"{CF_DOWN_URL}?bytes={down_bytes_target}") as resp:
                    if resp.status_code != 200:
                        raise Exception(f"Lỗi phản hồi tải về từ máy chủ: {resp.status_code}")
                    for chunk in resp.iter_bytes(chunk_size=65536):
                        if self._stop_event.is_set():
                            return
                        bytes_received += len(chunk)
                        dt = max(0.001, time.perf_counter() - t_down_start)
                        cur_mbps = round((bytes_received * 8) / (dt * 1_000_000), 2)
                        down_pct = 25 + int((bytes_received / down_bytes_target) * 45)
                        self._update_state(
                            download_mbps=cur_mbps,
                            progress_pct=min(70, down_pct)
                        )

                total_down_time = max(0.001, time.perf_counter() - t_down_start)
                final_download_mbps = round((bytes_received * 8) / (total_down_time * 1_000_000), 2)
                self._update_state(download_mbps=final_download_mbps, progress_pct=70)

                # GIAI ĐOẠN 3: ĐO TỐC ĐỘ TẢI LÊN (UPLOAD)
                self._update_state(
                    stage="upload",
                    phase_text_vi="Đang đo tốc độ tải lên (Upload)...",
                    progress_pct=71
                )

                up_size = 2_097_152 if mode == "quick" else 5_242_880
                upload_payload = b"0" * up_size

                t_up_start = time.perf_counter()
                up_resp = client.post(CF_UP_URL, content=upload_payload)
                t_up_end = time.perf_counter()

                if up_resp.status_code != 200:
                    raise Exception(f"Lỗi phản hồi tải lên từ máy chủ: {up_resp.status_code}")

                total_up_time = max(0.001, t_up_end - t_up_start)
                final_upload_mbps = round((up_size * 8) / (total_up_time * 1_000_000), 2)
                self._update_state(upload_mbps=final_upload_mbps, progress_pct=95)

            # GIAI ĐOẠN 4: GẮN KẾT THÔNG SỐ CARD WI-FI & ĐÁNH GIÁ TỔNG QUAN
            self._update_state(
                stage="finished",
                phase_text_vi="Đang tổng hợp kết quả đo kiểm...",
                progress_pct=98
            )

            iface = wifi_scanner.get_connected_interface_info()
            link_speed = max(iface.get("rx_rate") or 0.0, iface.get("tx_rate") or 0.0)
            signal_pct = iface.get("signal") or 0

            diagnosis = self._generate_diagnosis(
                final_download_mbps,
                final_upload_mbps,
                avg_ping,
                link_speed,
                signal_pct
            )

            total_elapsed = round(time.time() - t_start, 2)
            self._update_state(
                status="completed",
                stage="finished",
                progress_pct=100,
                link_speed_mbps=link_speed,
                phase_text_vi="Đo kiểm tốc độ hoàn tất",
                elapsed_seconds=total_elapsed,
                diagnosis_vi=diagnosis,
                network_context={
                    "ssid": iface.get("ssid"),
                    "band": iface.get("band"),
                    "channel": iface.get("channel"),
                    "signal_percent": signal_pct
                }
            )

        except Exception as e:
            if not self._stop_event.is_set():
                self._update_state(
                    status="error",
                    stage="finished",
                    error_message=f"Lỗi trong quá trình đo: {str(e)}",
                    phase_text_vi="Đo kiểm gặp lỗi kết nối"
                )

    def _extract_location(self, headers: Dict[str, str]) -> str:
        city = headers.get("city")
        country = headers.get("country")
        colo = headers.get("colo")
        if not colo:
            cf_ray = headers.get("cf-ray", "")
            if "-" in cf_ray:
                colo = cf_ray.split("-")[-1].strip().upper()

        colo_names = {
            "HAN": "Hà Nội",
            "SGN": "TP. Hồ Chí Minh",
            "DAD": "Đà Nẵng",
            "SIN": "Singapore (Anycast)",
            "HKG": "Hồng Kông (Anycast)"
        }
        pop_desc = colo_names.get(colo, f"PoP {colo}" if colo else "Anycast Edge")
        if city and country:
            return f"{city}, {country} (Cloudflare {pop_desc})"
        elif country:
            return f"Việt Nam (Cloudflare {pop_desc})"
        return f"Cloudflare CDN Anycast Edge ({pop_desc})"

    def _generate_diagnosis(self, down: float, up: float, ping: float, link: float, signal: int) -> str:
        if link > 0 and down > link * 0.85:
            return (
                f"Tốc độ tải về ({down:.1f} Mbps) đã khai thác tối đa năng lực kết nối của card mạng Wi-Fi ({link:.1f} Mbps). "
                f"Đường truyền hoạt động tối ưu."
            )
        elif link > 0 and link < 30.0:
            return (
                f"CẢNH BÁO NGHẼN SÓNG: Tốc độ liên kết Wi-Fi quá thấp ({link:.1f} Mbps) do tín hiệu yếu ({signal}%). "
                f"Băng thông Internet bị giới hạn bởi kết nối Wi-Fi cục bộ. Hãy di chuyển lại gần bộ phát hoặc đổi sang kênh thông thoáng."
            )
        elif ping > 120.0:
            return (
                f"Độ trễ mạng khá cao ({ping:.1f} ms). Tốc độ tải về: {down:.1f} Mbps, tải lên: {up:.1f} Mbps. "
                f"Đường truyền phù hợp tải dữ liệu nhưng có thể gián đoạn khi chơi game trực tuyến hoặc họp video."
            )
        else:
            return (
                f"Kết nối mạng rất tốt. Tốc độ tải về: {down:.1f} Mbps, tải lên: {up:.1f} Mbps, "
                f"độ trễ: {ping:.1f} ms. Liên kết Wi-Fi vật lý ({link:.1f} Mbps) ổn định và đáp ứng tốt mọi tác vụ."
            )


# Singleton instance
_speedtest_runner = SpeedTestRunner()


def get_speedtest_runner() -> SpeedTestRunner:
    return _speedtest_runner


def run_speedtest_sync(mode: str = "mock") -> Dict[str, Any]:
    """Ham tien ich thuc thi dong bo tra ve ket qua ngay (cho test suite)"""
    runner = SpeedTestRunner()
    runner.start(mode=mode)
    return runner.get_state()
