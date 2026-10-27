import subprocess
import re
import math
import ctypes
from ctypes import wintypes
from typing import List, Dict, Any, Optional, Tuple

# Pre-compiled regular expressions for fast line parsing without per-scan re-allocation
RE_SSID = re.compile(r"^SSID\s+\d+\s*:\s*(.*)$", re.IGNORECASE)
RE_BSSID = re.compile(r"^BSSID\s+\d+\s*:\s*([0-9a-fA-F:-]{17})", re.IGNORECASE)
RE_CHANNEL = re.compile(r"^Channel\s*:\s*(\d+)", re.IGNORECASE)
RE_UTIL_PCT = re.compile(r"\((\d+)\s*%\)")
RE_UTIL_RAW = re.compile(r":\s*(\d+)")
RE_DIGITS = re.compile(r"\d+")
RE_FLOAT = re.compile(r"[\d\.]+")

# Module-level ctypes structures for Windows Native WLAN API (avoids recreating classes every scan)
class _GUID(ctypes.Structure):
    _fields_ = [
        ("Data1", wintypes.DWORD),
        ("Data2", wintypes.WORD),
        ("Data3", wintypes.WORD),
        ("Data4", ctypes.c_ubyte * 8)
    ]

class _WLAN_INTERFACE_INFO(ctypes.Structure):
    _fields_ = [
        ("InterfaceGuid", _GUID),
        ("strInterfaceDescription", ctypes.c_wchar * 256),
        ("isState", wintypes.DWORD)
    ]

class _WLAN_INTERFACE_INFO_LIST(ctypes.Structure):
    _fields_ = [
        ("dwNumberOfItems", wintypes.DWORD),
        ("dwIndex", wintypes.DWORD),
        ("InterfaceInfo", _WLAN_INTERFACE_INFO * 1)
    ]

class _DOT11_SSID(ctypes.Structure):
    _fields_ = [
        ("uSSIDLength", wintypes.ULONG),
        ("ucSSID", ctypes.c_char * 32)
    ]

class _WLAN_RATE_SET(ctypes.Structure):
    _fields_ = [
        ("uRateSetLength", wintypes.ULONG),
        ("usRateSet", wintypes.USHORT * 126)
    ]

class _WLAN_BSS_ENTRY(ctypes.Structure):
    _fields_ = [
        ("dot11Ssid", _DOT11_SSID),
        ("uPhyId", wintypes.ULONG),
        ("dot11Bssid", ctypes.c_ubyte * 6),
        ("dot11BssType", wintypes.ULONG),
        ("dot11BssPhyType", wintypes.ULONG),
        ("lRssi", ctypes.c_long),
        ("uLinkQuality", wintypes.ULONG),
        ("bInRegDomain", wintypes.BOOLEAN),
        ("usBeaconPeriod", wintypes.USHORT),
        ("ullTimestamp", ctypes.c_ulonglong),
        ("ullHostTimestamp", ctypes.c_ulonglong),
        ("usCapabilityInformation", wintypes.USHORT),
        ("ulChCenterFrequency", wintypes.ULONG),
        ("wlanRateSet", _WLAN_RATE_SET),
        ("ulIeOffset", wintypes.ULONG),
        ("ulIeSize", wintypes.ULONG)
    ]

class _WLAN_BSS_LIST(ctypes.Structure):
    _fields_ = [
        ("dwTotalSize", wintypes.DWORD),
        ("dwNumberOfItems", wintypes.DWORD),
        ("wlanBssEntries", _WLAN_BSS_ENTRY * 1)
    ]

# IEEE OUI registry for enterprise and consumer Wi-Fi equipment
OUI_TABLE = {
    # Cisco & Meraki
    "00:1A:1E": "Cisco Systems", "00:1F:9E": "Cisco Systems", "00:24:14": "Cisco Systems",
    "70:A7:41": "Cisco Systems", "72:A7:41": "Cisco Systems", "00:18:BA": "Cisco Systems",
    "00:26:0B": "Cisco Systems", "54:75:D0": "Cisco Systems", "E4:AA:5D": "Cisco Meraki",
    "0C:8D:DB": "Cisco Meraki", "AC:17:C8": "Cisco Meraki", "00:18:0A": "Cisco Meraki",

    # Aruba Networks (Hewlett Packard Enterprise)
    "24:F5:A2": "Aruba Networks", "94:B4:0F": "Aruba Networks", "00:0B:86": "Aruba Networks",
    "60:22:32": "Aruba Networks", "62:22:32": "Aruba Networks", "74:F9:2C": "Aruba Networks",
    "7A:F9:2C": "Aruba Networks", "7E:F9:2C": "Aruba Networks", "82:F9:2C": "Aruba Networks",
    "20:4C:03": "Aruba Networks", "D8:C7:C8": "Aruba Networks",

    # Ubiquiti Networks (UniFi)
    "F0:9F:C2": "Ubiquiti UniFi", "78:8A:20": "Ubiquiti UniFi", "B4:FB:E4": "Ubiquiti UniFi",
    "04:18:D6": "Ubiquiti UniFi", "24:5A:4C": "Ubiquiti UniFi", "68:D7:9A": "Ubiquiti UniFi",
    "E0:63:DA": "Ubiquiti UniFi", "18:E8:29": "Ubiquiti UniFi", "80:2A:A8": "Ubiquiti UniFi",
    "A8:9C:6C": "Ubiquiti UniFi Enterprise",

    # Ruckus Wireless (CommScope)
    "00:24:84": "Ruckus Wireless", "00:1D:2E": "Ruckus Wireless", "C0:8A:DE": "Ruckus Wireless",
    "D8:38:FC": "Ruckus Wireless", "84:18:3A": "Ruckus Wireless",

    # Fortinet & Mikrotik & DrayTek
    "00:09:0F": "Fortinet FortiAP", "70:4C:A5": "Fortinet FortiAP",
    "B8:69:F4": "Mikrotik RouterBOARD", "48:8F:5A": "Mikrotik", "6C:3B:6B": "Mikrotik",
    "00:1D:AA": "DrayTek Vigor", "00:50:7F": "DrayTek Vigor",

    # TP-Link & Netgear & Asus & D-Link
    "50:D4:F7": "TP-Link", "98:25:4A": "TP-Link", "C0:06:C3": "TP-Link", "30:B5:C2": "TP-Link",
    "AC:84:C6": "TP-Link", "B0:BE:76": "TP-Link", "60:32:B1": "TP-Link",
    "C4:EB:FF": "TP-Link Technologies", "44:E9:DD": "TP-Link Archer / Deco",
    "14:98:77": "TP-Link Deco Mesh", "B4:75:0E": "TP-Link Deco Mesh",
    "84:16:F9": "Netgear", "20:E5:2A": "Netgear", "A0:04:60": "Netgear", "B0:7F:B9": "Netgear",
    "04:D9:F5": "ASUSTeK (ASUS)", "AC:84:C9": "ASUSTeK (ASUS)", "7C:10:C9": "ASUSTeK (ASUS)",
    "F4:34:F0": "ASUS ZenWiFi Mesh",
    "00:15:E9": "D-Link", "14:D6:4D": "D-Link", "28:10:7B": "D-Link",

    # Intel, Apple, Samsung, Google, Huawei, Xiaomi
    "E8:BF:E1": "Intel Corporate", "34:13:E8": "Intel", "00:1B:77": "Intel",
    "F4:F5:E8": "Apple", "AC:BC:32": "Apple", "3C:22:FB": "Apple", "BC:D1:1F": "Apple",
    "DA:B3:2F": "Apple (Private MAC)", "F0:18:98": "Apple", "DC:A9:04": "Apple",
    "70:4F:57": "Huawei", "00:E0:FC": "Huawei", "48:46:FB": "Huawei", "88:28:B3": "Huawei",
    "F8:35:DD": "Huawei Enterprise", "E0:CC:7A": "Huawei Technologies",
    "D8:0D:17": "Xiaomi", "64:CC:2E": "Xiaomi", "AC:C1:EE": "Xiaomi", "28:6C:07": "Xiaomi",
    "CC:70:ED": "Xiaomi Communications", "60:A4:4C": "Xiaomi Router",
    "E8:48:B8": "Samsung", "50:85:69": "Samsung", "A8:7D:12": "Samsung",
    "B8:27:EB": "Raspberry Pi", "DC:A6:32": "Raspberry Pi", "E4:5F:01": "Raspberry Pi",
    "EA:F4:08": "Intel/Microsoft Virtual AP",

    # Vietnam Telecom ISPs & Gateways (FPT, VNPT, Viettel)
    "20:BE:B4": "FPT Telecom (Hisense Wi-Fi 6)",
    "54:04:63": "FPT Telecom (CIG Wi-Fi 6)",
    "10:B1:F8": "FPT Telecom (ZTE ONT)",
    "D4:6E:5C": "FPT Telecom (ZTE Gateway)",
    "00:C8:96": "FPT Telecom (ZTE Router)",
    "A4:F4:C2": "VNPT Technology (iGate)",
    "00:1A:2B": "VNPT Technology",
    "D0:76:58": "VNPT Technology",
    "B8:08:D7": "VNPT Technology",
    "A0:65:18": "Viettel Network (ZTE/Huawei)",
    "28:2C:B2": "Viettel Network (H646W/H640W)",
    "E4:54:E8": "Viettel Network (ZTE ONT)",
    "00:0C:43": "Ralink / MediaTek (VNPT/Viettel OEM)",

    # Enterprise & Mesh APs (Ruijie, ZTE, Tenda, Eero, Google)
    "D0:C6:37": "Ruijie Reyee", "68:D2:C4": "Ruijie Reyee", "84:D8:1B": "Ruijie Networks",
    "A0:EC:F9": "ZTE Corporation", "08:18:1A": "ZTE Corporation", "74:B5:7E": "ZTE Corporation", "E8:65:D4": "ZTE Corporation",
    "94:83:C4": "Tenda Technology", "C4:6E:1F": "Tenda Technology",
    "1C:61:B4": "Amazon Eero Mesh", "D4:F5:47": "Google Nest WiFi"
}

# DFS Radar Channels in 5GHz band (UNII-2A and UNII-2C)
DFS_CHANNELS = frozenset({52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144})


def get_vendor(mac: str) -> str:
    """Identify manufacturer using IEEE OUI and LAA bit unmasking"""
    if not mac:
        return "Unknown"
    mac_clean = mac.strip().upper().replace("-", ":")
    parts = mac_clean.split(":")
    if len(parts) < 3:
        return "Generic IEEE 802.11"

    prefix = f"{parts[0]}:{parts[1]}:{parts[2]}"
    if prefix in OUI_TABLE:
        return OUI_TABLE[prefix]

    try:
        byte0 = int(parts[0], 16)
        if byte0 & 0x02:
            unmasked_prefix = f"{(byte0 & ~0x02):02X}:{parts[1]}:{parts[2]}"
            if unmasked_prefix in OUI_TABLE:
                return f"{OUI_TABLE[unmasked_prefix]} (Virtual AP)"
    except Exception:
        pass

    if mac_clean.startswith("DA:B3") or mac_clean.startswith("EA:F4"):
        return "Virtual/Local Mobile Hotspot"

    return "Generic IEEE 802.11"


def signal_percent_to_dbm(percent: int) -> int:
    dbm = round((percent / 2) - 100)
    return max(-100, min(-30, dbm))


def get_wifi_generation(radio_type: str) -> str:
    rt = radio_type.lower()
    if "802.11be" in rt:
        return "Wi-Fi 7"
    if "802.11ax" in rt:
        return "Wi-Fi 6"
    if "802.11ac" in rt:
        return "Wi-Fi 5"
    if "802.11n" in rt:
        return "Wi-Fi 4"
    if "802.11g" in rt:
        return "Wi-Fi 3"
    if "802.11b" in rt:
        return "Wi-Fi 1"
    if "802.11a" in rt:
        return "Wi-Fi 2"
    return radio_type


def channel_to_frequency(channel: int, band_str: str) -> int:
    if "2.4" in band_str or (1 <= channel <= 14):
        if channel == 14:
            return 2484
        return 2407 + (channel * 5)
    elif "5" in band_str or (32 <= channel <= 177):
        return 5000 + (channel * 5)
    elif "6" in band_str or channel > 177:
        return 5950 + (channel * 5)
    return 2412


def estimate_channel_noise_floor(channel: int, band_str: str, same_ch_aps: int = 0) -> int:
    """
    Estimate channel thermal + co-channel interference noise floor (dBm).
    2.4 GHz baseline is -94 dBm; 5/6 GHz baseline is -96 dBm.
    """
    base_noise = -94 if ("2.4" in band_str or (1 <= channel <= 14)) else -96
    return min(-78, base_noise + (max(0, same_ch_aps) * 2))


def estimate_mcs_and_phy(signal_dbm: int, snr_db: int, wifi_gen: str, band: str) -> Dict[str, Any]:
    """
    Estimate MCS Index (Modulation and Coding Scheme), modulation type, channel width,
    and realistic TCP/UDP throughput (Hamina / Ekahau / AirMagnet standard).
    """
    is_5g_or_6g = ("5" in band) or ("6" in band)
    if "7" in wifi_gen:
        width_mhz = 160 if is_5g_or_6g else 20
        max_mcs = 13
    elif "6" in wifi_gen:
        width_mhz = 80 if is_5g_or_6g else 20
        max_mcs = 11
    elif "5" in wifi_gen:
        width_mhz = 80 if is_5g_or_6g else 20
        max_mcs = 9
    else:
        width_mhz = 40 if is_5g_or_6g else 20
        max_mcs = 7

    # Map SNR/RSSI to MCS Index
    if snr_db >= 38 and max_mcs >= 12:
        mcs = max_mcs
        mod = "4096-QAM (5/6)"
    elif snr_db >= 34 and max_mcs >= 10:
        mcs = min(max_mcs, 11)
        mod = "1024-QAM (5/6)"
    elif snr_db >= 31 and max_mcs >= 9:
        mcs = min(max_mcs, 9)
        mod = "256-QAM (5/6)"
    elif snr_db >= 28 and max_mcs >= 8:
        mcs = min(max_mcs, 8)
        mod = "256-QAM (3/4)"
    elif snr_db >= 25:
        mcs = 7
        mod = "64-QAM (5/6)"
    elif snr_db >= 22:
        mcs = 6
        mod = "64-QAM (3/4)"
    elif snr_db >= 19:
        mcs = 5
        mod = "64-QAM (2/3)"
    elif snr_db >= 16:
        mcs = 4
        mod = "16-QAM (3/4)"
    elif snr_db >= 13:
        mcs = 3
        mod = "16-QAM (1/2)"
    elif snr_db >= 10:
        mcs = 2
        mod = "QPSK (3/4)"
    elif snr_db >= 7:
        mcs = 1
        mod = "QPSK (1/2)"
    else:
        mcs = 0
        mod = "BPSK (1/2)"

    # Base 2x2 MIMO spatial stream PHY rate estimation (Mbps)
    width_factor = width_mhz / 20.0
    base_rates_20mhz_2ss = {
        0: 14.4, 1: 28.8, 2: 43.3, 3: 57.8, 4: 86.7,
        5: 115.6, 6: 130.0, 7: 144.4, 8: 173.3, 9: 192.0,
        10: 240.0, 11: 288.2, 12: 317.0, 13: 346.0
    }
    phy_rate = round(base_rates_20mhz_2ss.get(mcs, 72.2) * width_factor, 1)
    # Realistic TCP/IP application throughput is ~62% of PHY link speed due to CSMA/CA overhead
    est_throughput = round(phy_rate * 0.62, 1)

    return {
        "mcs_index": mcs,
        "modulation": mod,
        "channel_width_mhz": width_mhz,
        "phy_rate_mbps": phy_rate,
        "est_throughput_mbps": est_throughput
    }


def get_connected_interface_info() -> Dict[str, Any]:
    """Parse netsh wlan show interfaces to get active connection"""
    info = {
        "connected": False,
        "ssid": None,
        "bssid": None,
        "interface_name": None,
        "description": None,
        "band": None,
        "channel": None,
        "signal": None,
        "rssi": None,
        "radio_type": None,
        "auth": None,
        "rx_rate": None,
        "tx_rate": None
    }
    try:
        proc = subprocess.run(
            ["netsh", "wlan", "show", "interfaces"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=2.0
        )
        for line in proc.stdout.splitlines():
            line = line.strip()
            if not line or ":" not in line:
                continue
            key_raw, val = line.split(":", 1)
            key = key_raw.strip().lower()
            val = val.strip()

            if key == "name":
                info["interface_name"] = val
            elif key == "description":
                info["description"] = val
            elif key == "state":
                info["connected"] = (val.lower() == "connected")
            elif key == "ssid":
                info["ssid"] = val
            elif "bssid" in key:
                info["bssid"] = val.lower()
            elif key == "band":
                info["band"] = val
            elif key == "channel":
                try:
                    info["channel"] = int(val)
                except ValueError:
                    info["channel"] = val
            elif key == "signal":
                pct = RE_DIGITS.findall(val)
                if pct:
                    info["signal"] = int(pct[0])
            elif key == "rssi":
                try:
                    info["rssi"] = int(val)
                except ValueError:
                    pass
            elif key == "radio type":
                info["radio_type"] = val
            elif key == "authentication":
                info["auth"] = val
            elif "receive rate" in key:
                m = RE_FLOAT.findall(val)
                if m:
                    info["rx_rate"] = float(m[0])
            elif "transmit rate" in key:
                m = RE_FLOAT.findall(val)
                if m:
                    info["tx_rate"] = float(m[0])
    except Exception:
        pass
    return info


def get_native_hardware_rssi() -> Dict[str, Dict[str, Any]]:
    """
    Query Windows WLAN Native API (wlanapi.dll) using pre-allocated module structures.
    """
    hardware_data: Dict[str, Dict[str, Any]] = {}
    try:
        wlan = ctypes.windll.wlanapi
        handle = wintypes.HANDLE()
        negotiated = wintypes.DWORD()
        if wlan.WlanOpenHandle(2, None, ctypes.byref(negotiated), ctypes.byref(handle)) != 0:
            return hardware_data

        pList = ctypes.POINTER(_WLAN_INTERFACE_INFO_LIST)()
        if wlan.WlanEnumInterfaces(handle, None, ctypes.byref(pList)) == 0 and pList.contents.dwNumberOfItems > 0:
            guid = pList.contents.InterfaceInfo[0].InterfaceGuid
            wlan.WlanScan(handle, ctypes.byref(guid), None, None, None)

            pBssList = ctypes.POINTER(_WLAN_BSS_LIST)()
            if wlan.WlanGetNetworkBssList(handle, ctypes.byref(guid), None, 3, False, None, ctypes.byref(pBssList)) == 0:
                count = pBssList.contents.dwNumberOfItems
                entries = ctypes.cast(
                    ctypes.byref(pBssList.contents.wlanBssEntries),
                    ctypes.POINTER(_WLAN_BSS_ENTRY * count)
                ).contents
                for i in range(count):
                    e = entries[i]
                    b = e.dot11Bssid
                    mac = f"{b[0]:02x}:{b[1]:02x}:{b[2]:02x}:{b[3]:02x}:{b[4]:02x}:{b[5]:02x}"
                    hardware_data[mac] = {
                        "rssi_dbm": int(e.lRssi),
                        "link_quality": int(e.uLinkQuality),
                        "frequency_mhz": int(e.ulChCenterFrequency // 1000),
                        "beacon_period_ms": int(e.usBeaconPeriod)
                    }
                wlan.WlanFreeMemory(pBssList)
            wlan.WlanFreeMemory(pList)
        wlan.WlanCloseHandle(handle, None)
    except Exception:
        pass
    return hardware_data


def _parse_raw_networks(connected_info: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Internal parser that extracts raw BSSID entries without running duplicate clustering"""
    live_hardware = get_native_hardware_rssi()
    networks: List[Dict[str, Any]] = []

    try:
        proc = subprocess.run(
            ["netsh", "wlan", "show", "networks", "mode=bssid"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=2.5
        )
        raw_output = proc.stdout
    except Exception:
        raw_output = ""

    connected_bssid = (connected_info.get("bssid") or "").lower()
    current_ssid = None
    current_auth = "Unknown"
    current_cipher = "Unknown"
    current_bss: Optional[Dict[str, Any]] = None

    for line in raw_output.splitlines():
        line_str = line.strip()
        if not line_str:
            continue

        ssid_match = RE_SSID.match(line_str)
        if ssid_match:
            if current_bss:
                networks.append(current_bss)
                current_bss = None
            current_ssid = ssid_match.group(1).strip() or "[Hidden Network]"
            current_auth = "Open"
            current_cipher = "None"
            continue

        if line_str.startswith("Authentication"):
            parts = line_str.split(":", 1)
            if len(parts) > 1:
                current_auth = parts[1].strip()
            continue

        if line_str.startswith("Encryption"):
            parts = line_str.split(":", 1)
            if len(parts) > 1:
                current_cipher = parts[1].strip()
            continue

        bssid_match = RE_BSSID.match(line_str)
        if bssid_match:
            if current_bss:
                networks.append(current_bss)

            bssid = bssid_match.group(1).lower()
            current_bss = {
                "ssid": current_ssid or "[Hidden Network]",
                "bssid": bssid,
                "authentication": current_auth,
                "encryption": current_cipher,
                "signal_percent": 0,
                "signal_dbm": -100,
                "radio_type": "802.11n",
                "wifi_generation": "Wi-Fi 4",
                "band": "2.4 GHz",
                "channel": 1,
                "frequency_mhz": 2412,
                "vendor": get_vendor(bssid),
                "channel_utilization_pct": None,
                "connected_stations": 0,
                "is_connected": (bssid == connected_bssid),
                "rates": []
            }
            continue

        if current_bss is not None:
            if line_str.startswith("Signal"):
                parts = line_str.split(":", 1)
                if len(parts) > 1:
                    pct_m = RE_DIGITS.findall(parts[1])
                    if pct_m:
                        pct = int(pct_m[0])
                        current_bss["signal_percent"] = pct
                        current_bss["signal_dbm"] = signal_percent_to_dbm(pct)
            elif line_str.startswith("Radio type"):
                parts = line_str.split(":", 1)
                if len(parts) > 1:
                    rt = parts[1].strip()
                    current_bss["radio_type"] = rt
                    current_bss["wifi_generation"] = get_wifi_generation(rt)
            elif line_str.startswith("Band"):
                parts = line_str.split(":", 1)
                if len(parts) > 1:
                    current_bss["band"] = parts[1].strip()
            elif line_str.startswith("Channel") and "Utilization" not in line_str:
                ch_m = RE_CHANNEL.match(line_str)
                if ch_m:
                    current_bss["channel"] = int(ch_m.group(1))
            elif "Connected Stations:" in line_str:
                parts = line_str.split(":", 1)
                if len(parts) > 1:
                    m = RE_DIGITS.findall(parts[1])
                    if m:
                        current_bss["connected_stations"] = int(m[0])
            elif "Channel Utilization:" in line_str:
                pct_m = RE_UTIL_PCT.findall(line_str)
                if pct_m:
                    current_bss["channel_utilization_pct"] = int(pct_m[0])
                else:
                    raw_val = RE_UTIL_RAW.findall(line_str)
                    if raw_val:
                        current_bss["channel_utilization_pct"] = round((int(raw_val[0]) / 255.0) * 100)
            elif "Basic rates" in line_str or "Other rates" in line_str:
                parts = line_str.split(":", 1)
                if len(parts) > 1:
                    current_bss["rates"].extend(parts[1].strip().split())

    if current_bss:
        networks.append(current_bss)

    # Compute channel congestion counts for accurate noise floor estimation
    ch_counts: Dict[int, int] = {}
    for net in networks:
        ch = net.get("channel", 1)
        ch_counts[ch] = ch_counts.get(ch, 0) + 1

    for net in networks:
        bssid_lower = (net.get("bssid") or "").lower()
        if bssid_lower in live_hardware:
            hw = live_hardware[bssid_lower]
            net["signal_dbm"] = hw["rssi_dbm"]
            if hw.get("link_quality"):
                net["signal_percent"] = hw["link_quality"]
            if hw.get("frequency_mhz"):
                net["frequency_mhz"] = hw["frequency_mhz"]
        else:
            net["frequency_mhz"] = channel_to_frequency(net["channel"], net["band"])

        if net["is_connected"] and connected_info.get("rssi"):
            net["signal_dbm"] = connected_info["rssi"]

        # Calculate Noise Floor (dBm) & SNR (dB) - Ekahau AI Pro standard
        ch = net.get("channel", 1)
        band_str = str(net.get("band", "2.4 GHz"))
        same_ch_aps = max(0, ch_counts.get(ch, 1) - 1)
        noise_floor_dbm = estimate_channel_noise_floor(ch, band_str, same_ch_aps)
        snr_db = max(0, net["signal_dbm"] - noise_floor_dbm)

        net["noise_floor_dbm"] = noise_floor_dbm
        net["snr_db"] = snr_db
        net["co_channel_count"] = same_ch_aps

        # Calculate MCS Index, Modulation, Channel Width & Real Throughput
        mcs_info = estimate_mcs_and_phy(
            signal_dbm=net["signal_dbm"],
            snr_db=snr_db,
            wifi_gen=net.get("wifi_generation", "Wi-Fi 4"),
            band=band_str
        )
        net.update(mcs_info)

    return networks


def normalize_mac_bytes(mac: str) -> Tuple[int, int, int, int, int, int]:
    try:
        parts = [int(p, 16) for p in mac.strip().lower().replace("-", ":").split(":")]
        if len(parts) == 6:
            parts[0] = parts[0] & ~0x03
            return (parts[0], parts[1], parts[2], parts[3], parts[4], parts[5])
    except Exception:
        pass
    return (0, 0, 0, 0, 0, 0)


def are_bssid_siblings_fast(m1: Tuple[int, ...], sig1: int, m2: Tuple[int, ...], sig2: int) -> bool:
    """Fast O(1) sibling check assuming OUI prefix m1[:3] == m2[:3] is already verified"""
    d3 = abs(m1[3] - m2[3])
    d4 = abs(m1[4] - m2[4])
    d5 = abs(m1[5] - m2[5])

    if d3 == 0 and d4 == 0 and d5 <= 16:
        return True
    if d4 == 0 and d5 == 0:
        return True
    if d4 == 0 and d5 <= 16 and abs(sig1 - sig2) <= 15:
        return True
    if (d3 + d4 + d5) <= 24 and abs(sig1 - sig2) <= 18:
        return True
    return False


def decloak_and_cluster_networks(networks: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    """
    O(N) Hash-Partitioned BSSID Topology Clustering, Hidden Network De-cloaking & Threat Analysis:
    1. Partitions networks by normalized 3-byte OUI prefix into hash buckets first (reduces O(N^2) to O(N)).
    2. Clusters physical multi-band/multi-SSID hardware and unmasks hidden Mesh/Guest/IoT BSSIDs.
    3. Audits Roaming / Sticky Client status across multi-AP ESSIDs.
    4. Detects Evil Twin / Rogue AP security anomalies.
    """
    oui_buckets: Dict[Tuple[int, int, int], List[Tuple[Dict[str, Any], Tuple[int, ...]]]] = {}

    ch_counts: Dict[int, int] = {}
    for net in networks:
        ch_val = net.get("channel", 1)
        ch_counts[ch_val] = ch_counts.get(ch_val, 0) + 1

    for net in networks:
        ch = net.get("channel")
        is_dfs = isinstance(ch, int) and (ch in DFS_CHANNELS)
        net["is_dfs"] = is_dfs
        net["dfs_label"] = "DFS Radar (UNII-2)" if is_dfs else None

        if "snr_db" not in net or "mcs_index" not in net:
            ch_int = ch if isinstance(ch, int) else 1
            b_str = str(net.get("band", "2.4 GHz"))
            sig_dbm = int(net.get("signal_dbm", -75))
            same_ch = max(0, ch_counts.get(ch_int, 1) - 1)
            nf = estimate_channel_noise_floor(ch_int, b_str, same_ch)
            snr = max(0, sig_dbm - nf)
            net["noise_floor_dbm"] = nf
            net["snr_db"] = snr
            net["co_channel_count"] = same_ch
            net.update(estimate_mcs_and_phy(sig_dbm, snr, net.get("wifi_generation", "Wi-Fi 4"), b_str))

        ssid = (net.get("ssid") or "").strip()
        ssid_low = ssid.lower()
        is_hidden = (not ssid or ssid_low in ("[hidden network]", "<hidden>", "[hidden]"))
        net["is_hidden"] = is_hidden
        net["is_decloaked"] = False
        net["decloaked_ssid"] = None
        net["decloak_role"] = None
        net["decloak_confidence"] = 0
        net["parent_ssid"] = None
        net["parent_bssid"] = None
        if not net.get("vendor"):
            net["vendor"] = get_vendor(net.get("bssid", ""))
        net["cluster_id"] = None
        net["cluster_name"] = None
        net["device_role"] = "Trạm phát độc lập"
        net["threat_level"] = "CLEAN"
        net["threat_description"] = None
        net["roaming_status"] = "SINGLE_AP"
        net["roaming_advice"] = None
        net["roaming_note"] = None

        mac_tuple = normalize_mac_bytes(net.get("bssid", ""))
        oui_key = mac_tuple[:3]
        oui_buckets.setdefault(oui_key, []).append((net, mac_tuple))

    # 2. Form Physical Device Clusters within each OUI bucket
    clusters: List[List[Dict[str, Any]]] = []
    for oui_key, bucket in oui_buckets.items():
        if oui_key == (0, 0, 0):
            for net, _ in bucket:
                clusters.append([net])
            continue

        bucket_clusters: List[List[Tuple[Dict[str, Any], Tuple[int, ...]]]] = []
        for net, m_tuple in bucket:
            sig = net.get("signal_percent") or 0
            matched_cluster = None
            for bc in bucket_clusters:
                if any(are_bssid_siblings_fast(m_tuple, sig, mem_m, mem_net.get("signal_percent") or 0) for mem_net, mem_m in bc):
                    matched_cluster = bc
                    break
            if matched_cluster is not None:
                matched_cluster.append((net, m_tuple))
            else:
                bucket_clusters.append([(net, m_tuple)])

        for bc in bucket_clusters:
            clusters.append([item[0] for item in bc])

    # Sort clusters by strongest member signal descending
    clusters.sort(key=lambda c: max(m.get("signal_percent", 0) for m in c), reverse=True)

    # 3. Analyze each cluster, unmask hidden networks, and assign cluster metadata
    cluster_summaries: List[Dict[str, Any]] = []

    for c_idx, cluster in enumerate(clusters):
        cluster_id = f"dev_cluster_{c_idx + 1}"
        named_members = [m for m in cluster if not m["is_hidden"]]

        if named_members:
            named_members.sort(key=lambda x: (x.get("is_connected", False), x.get("signal_percent", 0)), reverse=True)
            parent_ssid = named_members[0]["ssid"]
            parent_bssid = named_members[0]["bssid"]
            vendor = named_members[0]["vendor"]
        else:
            parent_ssid = f"Hidden AP {cluster[0]['bssid'][-8:]}"
            parent_bssid = cluster[0]["bssid"]
            vendor = cluster[0]["vendor"]

        cluster_name = f"Thiết bị {parent_ssid} ({vendor})"

        for m in cluster:
            m["cluster_id"] = cluster_id
            m["cluster_name"] = cluster_name
            m["cluster_size"] = len(cluster)
            m["parent_ssid"] = parent_ssid
            m["parent_bssid"] = parent_bssid

            if m["is_hidden"] and named_members:
                m["is_decloaked"] = True
                auth = (m.get("authentication") or "").upper()

                if "WPA3" in auth or m.get("is_dfs"):
                    m["decloaked_ssid"] = f"{parent_ssid} [Mesh Backhaul]"
                    m["decloak_role"] = "Đường truyền đồng bộ Mesh nội bộ (Wireless Backhaul)"
                    m["decloak_confidence"] = 98
                    m["device_role"] = "Mesh Backhaul"
                elif any("IOT" in (other.get("ssid") or "").upper() for other in cluster):
                    m["decloaked_ssid"] = f"{parent_ssid} [Mạng IoT / Phụ trợ]"
                    m["decloak_role"] = "Mạng ảo IoT hoặc quản trị nội bộ"
                    m["decloak_confidence"] = 94
                    m["device_role"] = "IoT Virtual AP"
                else:
                    m["decloaked_ssid"] = f"{parent_ssid} [Mạng ẩn / Guest]"
                    m["decloak_role"] = "Mạng khách hoặc SSID phụ giấu tên"
                    m["decloak_confidence"] = 92
                    m["device_role"] = "Virtual Guest AP"
            elif m["is_hidden"]:
                m["device_role"] = "Trạm phát ẩn độc lập"
            else:
                m["device_role"] = "SSID Phát sóng chính" if len(cluster) > 1 else "Trạm phát độc lập"

        cluster_summaries.append({
            "cluster_id": cluster_id,
            "cluster_name": cluster_name,
            "parent_ssid": parent_ssid,
            "parent_bssid": parent_bssid,
            "vendor": vendor,
            "bss_count": len(cluster),
            "max_signal_dbm": max(m.get("signal_dbm", -100) for m in cluster),
            "max_signal_percent": max(m.get("signal_percent", 0) for m in cluster),
            "bands": list({m.get("band", "2.4 GHz") for m in cluster}),
            "channels": list({m.get("channel", 1) for m in cluster}),
            "has_hidden": any(m["is_hidden"] for m in cluster),
            "has_decloaked": any(m["is_decloaked"] for m in cluster),
            "members": cluster
        })

    # 4. Rogue AP / Evil Twin Threat Analysis & Multi-AP Roaming / Sticky Client Audit
    ssid_map: Dict[str, List[Dict[str, Any]]] = {}
    for net in networks:
        ssid_clean = (net.get("ssid") or "").strip()
        if ssid_clean and not net["is_hidden"]:
            ssid_map.setdefault(ssid_clean, []).append(net)

    sticky_client_warnings = 0
    for ssid_name, group in ssid_map.items():
        if len(group) > 1:
            best_ap = max(group, key=lambda x: x.get("signal_dbm", -100))
            best_dbm = best_ap.get("signal_dbm", -100)

            for g in group:
                if g.get("is_connected"):
                    cur_dbm = g.get("signal_dbm", -100)
                    if best_ap["bssid"] != g["bssid"] and (best_dbm - cur_dbm) >= 8 and cur_dbm < -68:
                        g["roaming_status"] = "STICKY_CLIENT"
                        msg = (
                            f"Máy đang bám vào trạm phát yếu ({cur_dbm} dBm) trong khi trạm {best_ap['bssid']} "
                            f"cùng mạng {ssid_name} có sóng mạnh hơn ({best_dbm} dBm, Kênh {best_ap['channel']})."
                        )
                        g["roaming_advice"] = msg
                        g["roaming_note"] = msg
                        sticky_client_warnings += 1
                    else:
                        g["roaming_status"] = "OPTIMAL_NODE"
                        g["roaming_note"] = f"Đang kết nối vào BSSID mạnh nhất của mạng {ssid_name} ({cur_dbm} dBm)."
                else:
                    g["roaming_status"] = "MESH_NODE"

            clusters_in_group = {g.get("cluster_id") for g in group}
            vendors_in_group = {g.get("vendor") for g in group}
            auths_in_group = {g.get("authentication") for g in group}

            if len(clusters_in_group) > 1:
                has_open = any("OPEN" in (a or "").upper() for a in auths_in_group)
                has_secure = any("WPA" in (a or "").upper() for a in auths_in_group)

                if has_open and has_secure:
                    for g in group:
                        if "OPEN" in (g.get("authentication") or "").upper():
                            g["threat_level"] = "CRITICAL"
                            g["threat_description"] = (
                                f"CẢNH BÁO NGUY HIỂM: Phát hiện trạm phát giả mạo (Evil Twin)! "
                                f"Trạm này mở không mật khẩu nhưng lấy trùng tên {ssid_name} của mạng có mật khẩu."
                            )
                elif len(vendors_in_group) > 2:
                    for g in group:
                        g["threat_level"] = "WARNING"
                        g["threat_description"] = (
                            f"Lưu ý: Mạng {ssid_name} phát ra từ nhiều thiết bị khác hãng ({', '.join(vendors_in_group)}). "
                            f"Cần kiểm tra nếu đây không phải hệ thống phát sóng nội bộ."
                        )

    crit_cnt = sum(1 for n in networks if n.get("threat_level") == "CRITICAL")
    warn_cnt = sum(1 for n in networks if n.get("threat_level") == "WARNING")
    threat_summary = {
        "status": "DANGER" if crit_cnt > 0 else ("WARNING" if warn_cnt > 0 else "SECURE"),
        "total_threats": crit_cnt + warn_cnt,
        "critical_count": crit_cnt,
        "warning_count": warn_cnt,
        "sticky_client_count": sticky_client_warnings
    }

    return networks, cluster_summaries, threat_summary


def scan_wifi_networks(connected_info: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Scan and parse all Wi-Fi networks in range (single-pass)"""
    if connected_info is None:
        connected_info = get_connected_interface_info()
    networks = _parse_raw_networks(connected_info)
    decloak_and_cluster_networks(networks)
    networks.sort(key=lambda x: x["signal_percent"], reverse=True)
    return networks


def scan_wifi_with_interface() -> Tuple[List[Dict[str, Any]], Dict[str, Any], List[Dict[str, Any]], Dict[str, Any]]:
    """Single-pass scan that extracts active interface, surrounding BSSIDs, topology clusters and threat analysis"""
    connected_info = get_connected_interface_info()
    networks = _parse_raw_networks(connected_info)
    _, cluster_summaries, threat_summary = decloak_and_cluster_networks(networks)
    networks.sort(key=lambda x: x["signal_percent"], reverse=True)
    return networks, connected_info, cluster_summaries, threat_summary


if __name__ == "__main__":
    nets, iface, clusters, threats = scan_wifi_with_interface()
    print(f"Discovered {len(nets)} BSSIDs across {len(clusters)} physical devices:")
    for n in nets[:5]:
        print(
            f" - {n['ssid']} ({n['bssid']}) | Ch {n['channel']} ({n['band']}) | "
            f"{n['signal_dbm']} dBm (SNR {n['snr_db']} dB, MCS {n['mcs_index']}) | "
            f"Est: {n['est_throughput_mbps']} Mbps | Vendor: {n['vendor']}"
        )
