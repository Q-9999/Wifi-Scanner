import os
import time
import json
import asyncio
import threading
from datetime import datetime
from typing import List, Dict, Any, Optional, Set

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from wifi_scanner import scan_wifi_networks, scan_wifi_with_interface
from channel_analyzer import analyze_wifi_environment
from report_generator import export_report
from vowifi_analyzer import measure_network_quality
from ai_planner import optimize_ap_placement, generate_heatmap_grid

REPORTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reports")
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(REPORTS_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

app = FastAPI(title="MMQ./NetScanner - Wi-Fi Scanner, Spectrum & Floorplan Suite", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global continuous scan state with pre-serialized JSON cache to reduce memory/CPU allocations
global_state: Dict[str, Any] = {
    "timestamp": 0.0,
    "scan_count": 0,
    "networks": [],
    "clusters": [],
    "threats": {"status": "SECURE", "total_threats": 0, "critical_count": 0, "warning_count": 0, "sticky_client_count": 0},
    "analysis": {},
    "interface": {},
    "signal_history": {},
    "last_broadcast_json": None
}

active_websockets: Set[WebSocket] = set()
ws_lock = threading.Lock()
loop = None


def broadcast_data(payload_str: str):
    if not active_websockets:
        return
    with ws_lock:
        dead_sockets = set()
        for ws in list(active_websockets):
            try:
                if loop and loop.is_running():
                    asyncio.run_coroutine_threadsafe(ws.send_text(payload_str), loop)
                else:
                    asyncio.run(ws.send_text(payload_str))
            except Exception:
                dead_sockets.add(ws)
        active_websockets.difference_update(dead_sockets)


def _update_scan_state() -> str:
    """Run a single-pass Wi-Fi scan and update global_state + cached JSON payload"""
    networks, interface_info, clusters, threats = scan_wifi_with_interface()
    analysis = analyze_wifi_environment(networks)

    now_time = datetime.now().strftime("%H:%M:%S")
    now_ts = time.time()

    active_bssids = set()
    sig_hist = global_state["signal_history"]
    for net in networks:
        bssid = net.get("bssid")
        if not bssid:
            continue
        active_bssids.add(bssid)
        entry = sig_hist.get(bssid)
        if entry is None:
            entry = {
                "ssid": net.get("ssid", "[Hidden]"),
                "channel": net.get("channel", 1),
                "band": net.get("band", "2.4 GHz"),
                "history": []
            }
            sig_hist[bssid] = entry
        hist = entry["history"]
        hist.append({
            "time": now_time,
            "dbm": net.get("signal_dbm", -100)
        })
        if len(hist) > 20:
            del hist[:-20]

    # Prune inactive BSSIDs to cap memory footprint
    if len(sig_hist) > 35:
        stale_keys = [k for k in sig_hist if k not in active_bssids]
        for k in stale_keys[:15]:
            sig_hist.pop(k, None)

    global_state["timestamp"] = now_ts
    global_state["scan_count"] += 1
    global_state["networks"] = networks
    global_state["clusters"] = clusters
    global_state["threats"] = threats
    global_state["analysis"] = analysis
    global_state["interface"] = interface_info

    broadcast_payload = {
        "type": "live_update",
        "scan_count": global_state["scan_count"],
        "timestamp": now_time,
        "total_networks": len(networks),
        "interface": interface_info,
        "networks": networks,
        "clusters": clusters,
        "threats": threats,
        "analysis": analysis,
        "signal_history": sig_hist
    }
    payload_str = json.dumps(broadcast_payload, ensure_ascii=False)
    global_state["last_broadcast_json"] = payload_str
    return payload_str


def background_scanner_worker():
    print("[MMQ./NetScanner] Bo quet song Wi-Fi nen da san sang (Background Wi-Fi Scanner Active).")
    while True:
        try:
            with ws_lock:
                has_active_clients = len(active_websockets) > 0

            if not has_active_clients and global_state["scan_count"] > 2:
                time.sleep(3.0)
            else:
                time.sleep(1.2)

            t0 = time.time()
            payload_str = _update_scan_state()
            broadcast_data(payload_str)

            elapsed = time.time() - t0
            time.sleep(max(0.3, 2.0 - elapsed))
        except Exception:
            time.sleep(2.0)


scan_thread = threading.Thread(target=background_scanner_worker, daemon=True)
scan_thread.start()


@app.on_event("startup")
async def startup_event():
    global loop
    loop = asyncio.get_running_loop()


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
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text('{"type":"pong"}')
    except WebSocketDisconnect:
        with ws_lock:
            active_websockets.discard(websocket)
    except Exception:
        with ws_lock:
            active_websockets.discard(websocket)


@app.get("/api/stream/live")
async def stream_live_events():
    async def event_generator():
        last_sent_count = -1
        while True:
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

    return {
        "autopick_timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "recommendations": {
            "band_24ghz": {
                "picked_channel": rec_24["recommended_channel"],
                "score": rec_24["recommended_score"],
                "channel_width": "20 MHz",
                "technical_rationale": rec_24["recommendation_reason"],
                "reasons": rec_24.get("reasons_breakdown_vi", rec_24["reasons_breakdown"]),
                "reasons_vi": rec_24.get("reasons_breakdown_vi", rec_24["reasons_breakdown"]),
                "reasons_en": rec_24.get("reasons_breakdown_en", rec_24["reasons_breakdown"]),
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
                "reasons": rec_5.get("reasons_breakdown_vi", rec_5["reasons_breakdown"]),
                "reasons_vi": rec_5.get("reasons_breakdown_vi", rec_5["reasons_breakdown"]),
                "reasons_en": rec_5.get("reasons_breakdown_en", rec_5["reasons_breakdown"]),
                "best_80mhz_block": rec_5.get("best_80mhz_block")
            },
            "band_6ghz": {
                "picked_channel": rec_6.get("recommended_channel", 37),
                "score": rec_6.get("recommended_score", 95),
                "recommended_160mhz_block": rec_6.get("recommended_160mhz_block", "UNII-5 Block B (33-61)"),
                "channel_width": "160 MHz",
                "reasons_vi": rec_6.get("reasons_breakdown_vi", []),
                "reasons_en": rec_6.get("reasons_breakdown_en", [])
            }
        },
        "system_advice": [
            f"Thiết lập kênh chính 2.4 GHz thành kênh {rec_24['recommended_channel']} (độ rộng 20MHz) để tránh nhiễu lấn kênh ACI.",
            f"Thiết lập kênh 5 GHz thành kênh {rec_5['recommended_channel']} với độ rộng 80MHz trên khối {rec_5['recommended_80mhz_block']}.",
            f"Nếu dùng bộ phát Wi-Fi 6E/7 (6 GHz), ưu tiên kênh PSC {rec_6.get('recommended_channel', 37)} trên khối 160MHz {rec_6.get('recommended_160mhz_block', 'UNII-5 Block B (33-61)')}.",
            "Tắt các tốc độ phát sóng cũ 802.11b (1, 2, 5.5, 11 Mbps) để giải phóng thời lượng phát sóng (Airtime).",
            "Bật tính năng chuyển vùng nhanh 802.11k/v nếu dùng hệ thống nhiều bộ phát Mesh."
        ],
        "system_advice_vi": [
            f"Thiết lập kênh chính 2.4 GHz thành kênh {rec_24['recommended_channel']} (độ rộng 20MHz) để tránh nhiễu lấn kênh ACI.",
            f"Thiết lập kênh 5 GHz thành kênh {rec_5['recommended_channel']} với độ rộng 80MHz trên khối {rec_5['recommended_80mhz_block']}.",
            f"Nếu dùng bộ phát Wi-Fi 6E/7 (6 GHz), ưu tiên kênh PSC {rec_6.get('recommended_channel', 37)} trên khối 160MHz {rec_6.get('recommended_160mhz_block', 'UNII-5 Block B (33-61)')}.",
            "Tắt các tốc độ phát sóng cũ 802.11b (1, 2, 5.5, 11 Mbps) để giải phóng thời lượng phát sóng (Airtime).",
            "Bật tính năng chuyển vùng nhanh 802.11k/v nếu dùng hệ thống nhiều bộ phát Mesh."
        ],
        "system_advice_en": [
            f"Lock 2.4 GHz channel width to 20 MHz on Channel {rec_24['recommended_channel']} to prevent Adjacent Channel Interference (ACI).",
            f"Set 5 GHz to Channel {rec_5['recommended_channel']} (80 MHz width) on block {rec_5['recommended_80mhz_block']} for high speed.",
            f"For Wi-Fi 6E/7 (6 GHz), select PSC Channel {rec_6.get('recommended_channel', 37)} on 160 MHz block {rec_6.get('recommended_160mhz_block', 'UNII-5 Block B (33-61)')}.",
            "Disable legacy 802.11b rates (1, 2, 5.5, 11 Mbps) to save broadcast airtime.",
            "Enable 802.11k/v roaming assistance when running Mesh or multiple Access Points."
        ]
    }


@app.get("/api/vowifi-mos")
def get_vowifi_mos(target: str = "8.8.8.8", count: int = 5):
    return measure_network_quality(target_host=target, ping_count=max(1, min(count, 10)))


@app.get("/api/troubleshooting/all-in-one")
def get_all_in_one_troubleshooting(target: str = "8.8.8.8"):
    networks = global_state["networks"] or scan_wifi_networks()
    analysis = global_state["analysis"] or analyze_wifi_environment(networks)
    path_quality = measure_network_quality(target_host=target, ping_count=3)
    return {
        "status": "success",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "global_score": analysis.get("global_score", 0),
        "avg_snr_db": analysis.get("avg_snr_db", 0),
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
        raise HTTPException(status_code=500, detail=f"Floorplan calculation error: {str(e)}")


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
        raise HTTPException(status_code=404, detail="Report file not found")

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
        raise HTTPException(status_code=404, detail="File không tồn tại")
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
    return HTMLResponse("<h1>MMQ./NetScanner Localhost</h1><p>Frontend loading...</p>")


if __name__ == "__main__":
    import uvicorn
    print("[MMQ./NetScanner] Dang khoi dong may chu tai dia chi http://localhost:8000 ...")
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False)
