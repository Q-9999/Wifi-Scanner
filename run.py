import sys
import os
import socket
import webbrowser
import threading
import time
import uvicorn

def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def find_available_port(start_port: int = 8000) -> int:
    port = start_port
    while port < start_port + 20:
        if not is_port_in_use(port):
            return port
        port += 1
    return start_port

def open_browser(url: str):
    time.sleep(1.0)
    print(f"[MMQ./NetScanner] Dang mo giao dien Web tai dia chi / Opening Web UI at: {url}")
    webbrowser.open(url)

if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    port = find_available_port(8000)
    url = f"http://localhost:{port}"

    print(f" * Che do thu song / Wi-Fi Interface : Ket noi truc tiep card mang Windows WLAN")
    print(f" * Dia chi truy cap / Local Web URL  : {url}")
    print(f" * Chu ky cap nhat / Scan Interval   : Tu dong quet moi 2 giay khi mo giao dien")
    print(f" * Dinh dang bao cao / Report Format : File bang tinh CSV (Excel) va JSON")
    print("-" * 70)

    threading.Thread(target=open_browser, args=(url,), daemon=True).start()

    from server import app
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
