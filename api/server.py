import os
import sys
import time
import json
import asyncio
import threading
from collections import deque
from datetime import datetime
from typing import List, Dict, Any, Optional, Set

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

API_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(API_DIR, ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from core.wifi_scanner import scan_wifi_networks, scan_wifi_with_interface, get_connected_interface_info
from core.channel_analyzer import analyze_wifi_environment
from core.report_generator import export_report
from core.vowifi_analyzer import measure_network_quality
from core.ai_planner import optimize_ap_placement, generate_heatmap_grid
from core.speedtest_runner import get_speedtest_runner, run_speedtest_sync

REPORTS_DIR = os.path.join(ROOT_DIR, "reports")
STATIC_DIR = os.path.join(ROOT_DIR, "static")
os.makedirs(REPORTS_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

app = FastAPI(title="Hệ thống Phân tích và Quy hoạch Mạng không dây", version="3.0.0")
speedtest_runner = get_speedtest_runner()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScanStateManager:
    """Thread-safe holder for Wi-Fi scan state, bounded RSSI history deques, and live clients."""

    def __init__(self, history_maxlen: int = 20, max_tracked_bssids: int = 35):
        self.history_maxlen = history_maxlen
        self.max_tracked_bssids = max_tracked_bssids
        self.ws_lock = threading.Lock()
        self.stop_event = threading.Event()
        self.active_websockets: Set[WebSocket] = set()
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self._signal_deques: Dict[str, Dict[str, Any]] = {}
        self.state: Dict[str, Any] = {
            "timestamp": 0.0,
            "scan_count": 0,
            "networks": [],
            "clusters": [],
            "threats": {"status": "SECURE", "total_threats": 0, "critical_count": 0, "warning_count": 0, "sticky_client_count": 0},
            "analysis": {},
            "interface": {},
            "signal_history": {},
            "last_broadcast_json": None,
        }

    def update_scan(self) -> str:
        """Run a single-pass Wi-Fi scan and update state + cached JSON payload."""
        networks, interface_info, clusters, threats = scan_wifi_with_interface()
        analysis = analyze_wifi_environment(networks, connected_interface=interface_info, security_threats=threats)

        now_time = datetime.now().strftime("%H:%M:%S")
        now_ts = time.time()
        active_bssids = set()

        for net in networks:
            bssid = net.get("bssid")
            if not bssid:
                continue
            active_bssids.add(bssid)
            entry = self._signal_deques.get(bssid)
            if entry is None:
                entry = {
                    "ssid": net.get("ssid", "[Mạng ẩn]"),
                    "channel": net.get("channel", 1),
                    "band": net.get("band", "2.4 GHz"),
                    "history": deque(maxlen=self.history_maxlen),
                }
                self._signal_deques[bssid] = entry
            entry["history"].append({"time": now_time, "dbm": net.get("signal_dbm", -100)})

        if len(self._signal_deques) > self.max_tracked_bssids:
            stale_keys = [k for k in self._signal_deques if k not in active_bssids]
            for k in stale_keys[:15]:
                self._signal_deques.pop(k, None)

        serialized_hist = {
            bssid: {
                "ssid": entry["ssid"],
                "channel": entry["channel"],
                "band": entry["band"],
                "history": list(entry["history"]),
            }
            for bssid, entry in self._signal_deques.items()
        }

        self.state["timestamp"] = now_ts
        self.state["scan_count"] += 1
        self.state["networks"] = networks
        self.state["clusters"] = clusters
        self.state["threats"] = threats
        self.state["analysis"] = analysis
        self.state["interface"] = interface_info
        self.state["signal_history"] = serialized_hist

        broadcast_payload = {
            "type": "live_update",
            "scan_count": self.state["scan_count"],
            "timestamp": now_time,
            "total_networks": len(networks),
            "interface": interface_info,
            "networks": networks,
            "clusters": clusters,
            "threats": threats,
            "analysis": analysis,
            "signal_history": serialized_hist,
        }
        payload_str = json.dumps(broadcast_payload, ensure_ascii=False)
        self.state["last_broadcast_json"] = payload_str
        return payload_str

    def broadcast(self, payload_str: str) -> None:
        if not self.active_websockets:
            return
        active_loop = self.loop or loop
        with self.ws_lock:
            dead_sockets = set()
            for ws in list(self.active_websockets):
                try:
                    if active_loop and active_loop.is_running():
                        asyncio.run_coroutine_threadsafe(ws.send_text(payload_str), active_loop)
                    else:
                        asyncio.run(ws.send_text(payload_str))
                except Exception:
                    dead_sockets.add(ws)
            self.active_websockets.difference_update(dead_sockets)


state_manager = ScanStateManager()
global_state: Dict[str, Any] = state_manager.state
active_websockets: Set[WebSocket] = state_manager.active_websockets
ws_lock = state_manager.ws_lock
loop = None


def broadcast_data(payload_str: str):
    state_manager.broadcast(payload_str)


def _update_scan_state() -> str:
    """Run a single-pass Wi-Fi scan and update global_state + cached JSON payload"""
    return state_manager.update_scan()


def background_scanner_worker():
    try:
        print("[Hệ thống] Trình quét sóng Wi-Fi chạy nền đã sẵn sàng.")
    except Exception:
        pass
    while not state_manager.stop_event.is_set():
        try:
            with ws_lock:
                has_active_clients = len(active_websockets) > 0

            wait_sec = 3.0 if (not has_active_clients and global_state["scan_count"] > 2) else 1.2
            if state_manager.stop_event.wait(wait_sec):
                break

            t0 = time.time()
            payload_str = _update_scan_state()
            broadcast_data(payload_str)

            elapsed = time.time() - t0
            if state_manager.stop_event.wait(max(0.3, 2.0 - elapsed)):
                break
        except Exception:
            if state_manager.stop_event.wait(2.0):
                break


scan_thread = threading.Thread(target=background_scanner_worker, daemon=True)
scan_thread.start()


@app.on_event("startup")
async def startup_event():
    global loop
    loop = asyncio.get_running_loop()
    state_manager.loop = loop
    state_manager.stop_event.clear()


@app.on_event("shutdown")
async def shutdown_event():
    state_manager.stop_event.set()


@app.websocket("/ws/live")
async def websocket_live_stream(websocket: WebSocket):
    await websocket.accept()
    with ws_lock:
        active_websockets.add(websocket)

    if not global_state["last_broadcast_json"]:
        try:
            _update_scan_state()
        except Exception:
            pass

    if global_state["last_broadcast_json"]:
        await websocket.send_text(global_state["last_broadcast_json"])

    try:
        while not state_manager.stop_event.is_set():
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
                if msg == "ping":
                    await websocket.send_text('{"type":"pong"}')
            except asyncio.TimeoutError:
                await websocket.send_text('{"type":"heartbeat"}')
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        with ws_lock:
            active_websockets.discard(websocket)


@app.get("/api/stream/live")
async def stream_live_events(request: Request):
    async def event_generator():
        last_sent_count = -1
        for _ in range(7200):
            if state_manager.stop_event.is_set() or await request.is_disconnected():
                break
            if global_state["scan_count"] != last_sent_count and global_state["last_broadcast_json"]:
                last_sent_count = global_state["scan_count"]
                yield f"data: {global_state['last_broadcast_json']}\n\n"
            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.get("/api/scan")
def get_scan(force: bool = False):
    if not global_state["networks"] or force:
        _update_scan_state()

    return {
        "status": "success",
        "scan_count": global_state["scan_count"],
        "timestamp": datetime.fromtimestamp(global_state["timestamp"]).strftime("%Y-%m-%d %H:%M:%S"),
        "total_networks": len(global_state["networks"]),
        "interface": global_state["interface"],
        "networks": global_state["networks"],
        "clusters": global_state.get("clusters", []),
        "threats": global_state.get("threats", {}),
        "analysis": global_state["analysis"],
        "signal_history": global_state["signal_history"]
    }


@app.get("/api/clusters")
def get_clusters():
    return {
        "status": "success",
        "total_clusters": len(global_state.get("clusters", [])),
        "clusters": global_state.get("clusters", []),
        "threats": global_state.get("threats", {})
    }


class SpeedTestStartRequest(BaseModel):
    mode: Optional[str] = "quick"


@app.post("/api/speedtest/start")
def start_speedtest(req: Optional[SpeedTestStartRequest] = None):
    mode = (req.mode if req else "quick") or "quick"
    return speedtest_runner.start(mode=mode)


@app.get("/api/speedtest/status")
def get_speedtest_status():
    st = speedtest_runner.get_state()
    return {
        "status": st["status"],
        "stage": st["stage"],
        "progress_pct": st["progress_pct"],
        "ping_ms": st["ping_ms"],
        "jitter_ms": st["jitter_ms"],
        "download_mbps": st["download_mbps"],
        "upload_mbps": st["upload_mbps"],
        "link_speed_mbps": st["link_speed_mbps"],
        "server_location": st["server_location"],
        "error_message": st["error_message"],
        "test_id": st.get("test_id"),
        "phase_text_vi": st.get("phase_text_vi"),
        "elapsed_seconds": st.get("elapsed_seconds", 0.0),
        "diagnosis_vi": st.get("diagnosis_vi"),
        "network_context": st.get("network_context", {})
    }


@app.post("/api/speedtest/stop")
def stop_speedtest():
    return speedtest_runner.stop()


@app.get("/api/speedtest/stream")
async def speedtest_stream(request: Request):
    async def speed_event_generator():
        last_ver = -1
        idle_count = 0
        for _ in range(2000):
            if state_manager.stop_event.is_set() or await request.is_disconnected():
                break
            cur_state = speedtest_runner.get_state()
            ver = cur_state.get("version", 0)
            if ver != last_ver:
                last_ver = ver
                yield f"data: {json.dumps(cur_state, ensure_ascii=False)}\n\n"
                idle_count = 0
            else:
                idle_count += 1

            if cur_state.get("status") in ("completed", "error", "stopped") and idle_count > 5:
                break

            await asyncio.sleep(0.15)

    return StreamingResponse(
        speed_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.get("/api/channel-recommendations")
def get_channel_recommendations():
    networks = global_state["networks"] or scan_wifi_networks()
    analysis = global_state["analysis"] or analyze_wifi_environment(networks)
    return {
        "status": "success",
        "global_score": analysis.get("global_score", 0),
        "avg_snr_db": analysis.get("avg_snr_db", 0),
        "evaluation_24ghz": analysis.get("evaluation_24ghz", {}),
        "evaluation_5ghz": analysis.get("evaluation_5ghz", {}),
        "evaluation_6ghz": analysis.get("evaluation_6ghz", {}),
        "channels_24ghz": analysis.get("channels_24ghz", []),
        "channels_5ghz": analysis.get("channels_5ghz", []),
        "channels_6ghz": analysis.get("channels_6ghz", []),
        "summary": analysis.get("summary", {}),
        "airtime_breakdown": analysis.get("airtime_breakdown", {}),
        "roaming_audit": analysis.get("roaming_audit", []),
        "troubleshooting_suite": analysis.get("troubleshooting_suite", {})
    }


class AutoPickRequest(BaseModel):
    environment_type: Optional[str] = "office"
    prefer_dfs: Optional[bool] = False
    target_band: Optional[str] = "both"


@app.post("/api/channel-autopick")
def autopick_channel(req: Optional[AutoPickRequest] = None):
    networks = global_state["networks"] or scan_wifi_networks()
    analysis = global_state["analysis"] or analyze_wifi_environment(networks)

    rec_24 = analysis["evaluation_24ghz"]
    rec_5 = analysis["evaluation_5ghz"]
    rec_6 = analysis.get("evaluation_6ghz", {})

    reasons_24 = rec_24.get("reasons_breakdown_vi", rec_24.get("reasons_breakdown", []))
    reasons_5 = rec_5.get("reasons_breakdown_vi", rec_5.get("reasons_breakdown", []))
    reasons_6 = rec_6.get("reasons_breakdown_vi", [])

    advice_items = [
        f"Thiết lập kênh chính 2.4 GHz thành kênh {rec_24['recommended_channel']} (độ rộng 20 MHz) để tránh nhiễu lấn kênh ACI.",
        f"Thiết lập kênh 5 GHz thành kênh {rec_5['recommended_channel']} với độ rộng 80 MHz trên khối {rec_5.get('recommended_80mhz_block', '')}.",
        f"Nếu dùng bộ phát Wi-Fi 6E hoặc Wi-Fi 7 (6 GHz), ưu tiên kênh PSC {rec_6.get('recommended_channel', 37)} trên khối 160 MHz {rec_6.get('recommended_160mhz_block', 'UNII-5 Block B (33-61)')}.",
        "Tắt các tốc độ phát sóng cũ 802.11b (1, 2, 5.5, 11 Mbps) để giải phóng thời lượng phát sóng.",
        "Bật tính năng chuyển vùng nhanh 802.11k/v nếu dùng hệ thống nhiều bộ phát Mesh."
    ]

    return {
        "autopick_timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "recommendations": {
            "band_24ghz": {
                "picked_channel": rec_24["recommended_channel"],
                "score": rec_24["recommended_score"],
                "channel_width": "20 MHz",
                "technical_rationale": rec_24["recommendation_reason"],
                "reasons": reasons_24,
                "reasons_vi": reasons_24,
                "reasons_en": reasons_24,
                "alternatives": [
                    item for item in rec_24.get("ranked_preferred", [])
                    if item["channel"] != rec_24["recommended_channel"]
                ]
            },
            "band_5ghz": {
                "picked_channel": rec_5["recommended_channel"],
                "score": rec_5["recommended_score"],
                "recommended_80mhz_block": rec_5.get("recommended_80mhz_block"),
                "recommended_80mhz_channels": rec_5.get("recommended_80mhz_channels"),
                "channel_width": "80 MHz",
                "technical_rationale": rec_5["recommendation_reason"],
                "reasons": reasons_5,
                "reasons_vi": reasons_5,
                "reasons_en": reasons_5,
                "best_80mhz_block": rec_5.get("best_80mhz_block")
            },
            "band_6ghz": {
                "picked_channel": rec_6.get("recommended_channel", 37),
                "score": rec_6.get("recommended_score", 95),
                "recommended_160mhz_block": rec_6.get("recommended_160mhz_block", "UNII-5 Block B (33-61)"),
                "channel_width": "160 MHz",
                "reasons_vi": reasons_6,
                "reasons_en": reasons_6
            }
        },
        "system_advice": advice_items,
        "system_advice_vi": advice_items,
        "system_advice_en": advice_items
    }


@app.get("/api/vowifi-mos")
def get_vowifi_mos(target: str = "8.8.8.8", count: int = 5):
    return measure_network_quality(target_host=target, ping_count=max(1, min(count, 10)))


@app.get("/api/troubleshooting/all-in-one")
def get_all_in_one_troubleshooting(target: str = "8.8.8.8"):
    networks = global_state["networks"] or scan_wifi_networks()
    interface_info = global_state.get("interface")
    if not interface_info or not isinstance(interface_info, dict) or not interface_info.get("interface_name"):
        try:
            # Uses top-level get_connected_interface_info import
            interface_info = get_connected_interface_info()
        except Exception:
            interface_info = interface_info or {}

    threats = global_state.get("threats")

    analysis = global_state.get("analysis")
    ts_cached = (analysis or {}).get("troubleshooting_suite", {})
    if not analysis or "adapter_diagnostics" not in ts_cached or "automated_root_cause" not in ts_cached:
        analysis = analyze_wifi_environment(networks, connected_interface=interface_info, security_threats=threats)

    path_quality = measure_network_quality(target_host=target, ping_count=3)
    return {
        "status": "success",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "global_score": analysis.get("global_score", 0),
        "avg_snr_db": analysis.get("avg_snr_db", 0),
        "connected_interface": interface_info,
        "troubleshooting_suite": analysis.get("troubleshooting_suite", {}),
        "airtime_breakdown": analysis.get("airtime_breakdown", {}),
        "roaming_audit": analysis.get("roaming_audit", []),
        "path_quality": path_quality
    }


class AIPlannerRequest(BaseModel):
    width_m: float = 20.0
    height_m: float = 15.0
    walls: List[Dict[str, Any]] = []
    max_aps: Optional[int] = 3
    freq_ghz: Optional[float] = 2.4
    sla_profile: Optional[str] = "voice"


@app.post("/api/ai-planner/optimize")
def ai_planner_optimize(req: AIPlannerRequest):
    try:
        w_m = max(4.0, float(req.width_m or 12.0))
        h_m = max(4.0, float(req.height_m or 8.0))
        clean_walls = req.walls if isinstance(req.walls, list) else []
        max_aps = min(5, max(1, req.max_aps or 3))
        freq = float(req.freq_ghz or 2.4)
        sla = str(req.sla_profile or "voice")
        return optimize_ap_placement(
            width_m=w_m,
            height_m=h_m,
            walls=clean_walls,
            max_aps=max_aps,
            freq_ghz=freq,
            sla_profile=sla
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi tính toán sơ đồ mặt bằng: {str(e)}")


class HeatmapCalculateRequest(BaseModel):
    width_m: float = 20.0
    height_m: float = 15.0
    aps: List[Dict[str, Any]] = []
    walls: List[Dict[str, Any]] = []
    resolution: Optional[int] = 28
    tx_power: Optional[float] = 20.0
    freq_ghz: Optional[float] = 2.4
    sla_profile: Optional[str] = "voice"


@app.post("/api/ai-planner/calculate-heatmap")
def ai_planner_heatmap(req: HeatmapCalculateRequest):
    return generate_heatmap_grid(
        width_m=req.width_m,
        height_m=req.height_m,
        aps=req.aps,
        walls=req.walls,
        resolution=min(40, max(15, req.resolution or 28)),
        freq_ghz=float(req.freq_ghz or 2.4),
        sla_profile=str(req.sla_profile or "voice"),
        tx_power=float(req.tx_power or 20.0)
    )


class ReportExportRequest(BaseModel):
    format: Optional[str] = "csv"


@app.post("/api/export-report")
def export_report_endpoint(req: Optional[ReportExportRequest] = None):
    networks = global_state["networks"] or scan_wifi_networks()
    analysis = global_state["analysis"] or analyze_wifi_environment(networks)

    fmt = ((req.format if req else None) or "csv").lower().strip()
    try:
        filepath = export_report(fmt, networks, analysis, output_dir=REPORTS_DIR)
        filename = os.path.basename(filepath)
        return {
            "status": "success",
            "format": fmt,
            "filename": filename,
            "download_url": f"/api/reports/download/{filename}",
            "file_size_bytes": os.path.getsize(filepath)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reports/download/{filename}")
def download_report(filename: str):
    clean_name = os.path.basename(filename)
    filepath = os.path.join(REPORTS_DIR, clean_name)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Tệp tin báo cáo không tồn tại")

    media_types = {
        ".csv": "text/csv; charset=utf-8",
        ".json": "application/json",
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }
    _, ext = os.path.splitext(clean_name)
    media_type = media_types.get(ext.lower(), "application/octet-stream")

    return FileResponse(
        path=filepath,
        filename=clean_name,
        media_type=media_type
    )


@app.get("/api/reports/list")
def list_reports():
    files = []
    if os.path.exists(REPORTS_DIR):
        for f in os.listdir(REPORTS_DIR):
            fpath = os.path.join(REPORTS_DIR, f)
            if os.path.isfile(fpath):
                stat = os.stat(fpath)
                _, ext = os.path.splitext(f)
                files.append({
                    "filename": f,
                    "format": ext.replace(".", "").upper(),
                    "size_bytes": stat.st_size,
                    "created_at": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
                    "download_url": f"/api/reports/download/{f}"
                })
    files.sort(key=lambda x: x["created_at"], reverse=True)
    return {"reports": files}


@app.delete("/api/reports/{filename}")
def delete_report(filename: str):
    clean_name = os.path.basename(filename)
    filepath = os.path.join(REPORTS_DIR, clean_name)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Tệp tin báo cáo không tồn tại")
    try:
        os.remove(filepath)
        return {"status": "success", "deleted": clean_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/reports/clear-all")
def clear_all_reports():
    count = 0
    if os.path.exists(REPORTS_DIR):
        for f in os.listdir(REPORTS_DIR):
            fpath = os.path.join(REPORTS_DIR, f)
            if os.path.isfile(fpath):
                try:
                    os.remove(fpath)
                    count += 1
                except Exception:
                    pass
    return {"status": "success", "cleared_count": count}


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def serve_index():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(
            index_file,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    return HTMLResponse("<h1>Hệ thống Phân tích Mạng Wi-Fi</h1><p>Đang tải giao diện...</p>")


if __name__ == "__main__":
    import uvicorn
    print("[Hệ thống] Đang khởi động máy chủ tại địa chỉ http://localhost:8000 ...")
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)
