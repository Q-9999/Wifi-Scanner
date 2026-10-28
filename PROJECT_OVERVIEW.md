# MMQ. / NetScanner - Tong Quan Kien Truc & Huong Dan Toan Dien

Tai lieu tom tat toan bo he thong cong cu khao sat song Wi-Fi, phan tich pho tan RF, chan doan su co chuyen sau va quy hoach ban do nhiet mat bang 2D/2.5D. Khi bat dau mot phien lam viec moi, chi can doc file nay la nam duoc toan bo kien truc, luong du lieu, cac tinh nang chinh va cach van hanh.

---

## 1. Muc Tieu & Triet Ly Thiet Ke

1. **Giao Dien Bang Dieu Khien Phan Tich Hien Dai (Modern SaaS Analytics Dashboard)**:
   - Tham chieu phong cach uupm.cc SaaS Analytics Dashboard.
   - Thiet ke giao dien the kinh mo, nen chuyen sac toi giam moi mat, thanh the chi so KPI tong quan voi do thi mini va thanh tien trinh truc quan.
   - Ho tro chuyen doi giao dien Sang va Toi (Light / Dark Mode) va da ngon ngu Viet - Anh (Bilingual VI/EN).

2. **Quy Hoach Mat Bang & Ban Do Nhiet 5 Che Do Chuan Ekahau (Ekahau Wi-Fi Design Solutions)**:
   - Tham chieu tieu chuan thiet ke mang khong day chuyen nghiep cua Ekahau.
   - 5 che do ban do nhiet: Song Chinh (Primary Signal RSSI), Song Phu Chuyen Vung (Secondary Roaming Overlap), Ty So Tin Hieu Tren Nhieu (SNR dB), Nhieu Tranh Chap Kenh (Interference Contention Count), Toc Do & Dung Luong (Data Rate & Capacity Mbps).
   - Thanh truot cat nguong SLA (SLA Cutoff Slider tu -85 den -50 dBm) voi hieu ung phu mo va gach cheo canh bao goc khuat song khong dat tieu chuan.
   - Tuy chon cong suat phat AP (Tx Power 14, 17, 20, 23 dBm) va loai anten (Omni 3 dBi, High-Gain 6 dBi, Directional 9 dBi) de tinh toan cong suat phat buc xa hieu dung EIRP.
   - Ho tro 3 bang tan: 2.4 GHz, 5.0 GHz va 6.0 GHz (Wi-Fi 6E/7).
   - Dau do thong so song tai cho (Live Point Probe) hien thi chi so ngay tai vi tri con tro chuot tren ban ve.

3. **Bo Cong Cu Chan Doan & Xu Ly Su Co Toan Dien Chuan Oscium (Oscium All-in-One Troubleshooting Bundle)**:
   - Tham chieu bo giai phap khao sat va chan doan mang khong day cua Oscium.
   - Bang kiem tra chan doan toan dien 6 diem (Oscium 6-Point Health Check) danh gia tu Tang 1 (Phan cung RF) den Tang 2 (Goi tin MAC, Chuyen vung Roaming va An ninh WLAN) kem diem suc khoe mang (Network Health Score 0-100) va loi khuyen khac phuc cu the.
   - Bo nhan dien nguon nhieu phi Wi-Fi (Non-Wi-Fi RF Interference Signatures): Lo vi song 2.45 GHz, Tai nghe/chuot Bluetooth FHSS, Camera giam sat analog phat lien tuc, va Song radar thoi tiet/quan su DFS tren dai 5 GHz UNII-2.
   - Bo do huong tin hieu bo phat thuc dia (Oscium Device Finder) voi dong ho do cong suat song tuc thoi, thuoc do do tiem can (%) va khoang cach vat ly uoc tinh.

---

## 2. Cau Truc Thu Muc & Cac File Ma Nguon Chinh

- `server.py`:
  - May chu FastAPI cung cap cac diem cuoi REST API va WebSocket phat truc tiep du lieu quet song.
  - Phuc vu giao dien web tinh tai cong 8000 (http://localhost:8000).
- `wifi_scanner.py`:
  - Module quet song Wi-Fi tren he dieu hanh Windows su dung goi lenh wlanapi.dll truc tiep.
  - Tinh toan RSSI, SNR, Noise Floor, MCS Index, toc do truyen du lieu va tra cuu nha san xuat tu IEEE OUI.
  - Gom cum cac dia chi MAC (BSSID) thanh thiet bi vat ly va giai ma ten mang an (Hidden SSID).
- `channel_analyzer.py`:
  - Bo phan tich danh gia kenh tren ca 3 bang tan 2.4 GHz, 5 GHz va 6 GHz.
  - Tinh toan thoi luong chiem dung song (Airtime Breakdown) va ty le gui lai goi tin (Frame Retry Rate %).
  - Xay dung bo chan doan Oscium 6 diem, danh sach nguon nhieu phi Wi-Fi va danh gia he thong chuyen vung da tram (Roaming Audit).
- `ai_planner.py`:
  - Dong co tinh toan truyen song khong day RF dua tren mo hinh suy hao Log-Distance va ITU-R P.1238.
  - Tinh toan ma tran ban do nhiet 5 che do (Primary, Secondary, SNR, Interference, Throughput).
  - Ho tro tinh suy hao qua 6 loai vat lieu tuong (gach, be tong, go, kinh, cua, kim loai).
  - Thuat toan tu dong toi uu vi tri dat bo phat Router / Access Point.
- `vowifi_analyzer.py`:
  - Module do kiem chat luong cuoc goi thoai VoWiFi theo tieu chuan ITU-T G.107 E-Model.
  - Tinh toan do tre RTT, do bien thien tre Jitter, ty le rot goi va quy doi ra diem MOS (1.0 - 4.5).
  - Kiem toan do tre da chang: Chieu 1 (Router noi bo Gateway), Chieu 2 (Internet Cloud WAN), Chieu 3 (Phan giai ten mien DNS).
- `report_exporter.py`:
  - Xuat bao cao khao sat dinh dang CSV va JSON theo quy chuan dat ten: NetScanner_Report_[MM-DD-YYYY]_[ID-01].csv luu trong thu muc reports/.
- `static/index.html`:
  - Giao dien nguoi dung duy nhat gom 7 the tab: Quet Song (Survey), Pho Song RF (Spectrum), Toi Uu Kenh & Chan Doan Oscium (Optimizer), Thoai VoWiFi & MOS, Quy Hoach AP & Ban Do Nhiet Ekahau (Planner), Danh Gia An Ninh (Security Audit), Kho Bao Cao (Reports).
- `static/app.js`:
  - Toan bo logic giao dien nguoi dung, ve do thi tren Canvas, ket noi WebSocket, tuong tac ve mat bang, tinh toan SLA Cutoff, va dong bo song ngu Viet - Anh.
- `static/styles.css`:
  - Toan bo quy tac dinh kieu giao dien theo phong cach SaaS Analytics Dashboard (uupm.cc) voi hieu ung the kinh mo, do bong vien, mau sac do thi sac net.
- `test_full_suite.py`:
  - Bo kiem thu tu dong kiem tra toan dien quet song thuc te tren phan cung may tinh, thuat toan tinh toan RF, chan doan Oscium va cac diem cuoi API.

---

## 3. Cac Tinh Nang Chinh & Quy Trinh Hoat Dong

### Tab 1: Quet Song & Gom Cum Phan Cung (Survey)
- Hien thi bang danh sach cac tram phat BSSID quet duoc trong khu vuc.
- Che do xem Gom nhom theo thiet bi vat ly (Hardware Grouping): tu dong phat hien cac BSSID thuoc cung 1 thiet bi phat song da bang tan (2.4G + 5G + Mesh Backhaul).
- Tu dong nhan dien va giai ma ten cac mang an (Hidden SSID) neu chung phat ra tu cung mot thiet bi voi mang co ten.
- Nut Bo do huong tin hieu AP (Oscium Device Finder) cho phep theo doi cong suat dBm lien tuc va uoc tinh khoang cach den tram phat.

### Tab 2: Pho Song RF, Thac Nuoc & Bo Phan Loai Nhieu (Spectrum)
- Do thi pho song hinh chuong OFDM truc quan tren bang tan 2.4 GHz va 5 GHz.
- Do thi bien thien cuong do song RSSI theo thoi gian thuc.
- Bieu do thac nuoc mat do pho (Spectrogram Waterfall) giup phat hien kenh bi chiem dung lien tuc.
- Bo phan loai nguon nhieu pho tan Tang 1 & Tang 2 (Oscium Wi-Spy Classifier): phat hien kenh ke ACI, kenh rong 40MHz tren 2.4GHz, kenh radar DFS va ty le gui lai goi tin Retry.

### Tab 3: Toi Uu Kenh & Chan Doan Toan Dien Oscium (Optimizer)
- Bang kiem tra chan doan toan dien 6 diem (Oscium 6-Point Health Check):
  1. Cuong do song & Vung phu (Primary RSSI target >= -65 dBm)
  2. Pho tan & Can nhieu kenh (Channel interference & ACI)
  3. Nguon nhieu phi Wi-Fi (Lo vi song, Bluetooth, Camera, Radar DFS)
  4. Thoi luong song & Gui lai goi tin (Free airtime & Retry rate)
  5. Chuyen vung & Tram bam song yeu (Roaming redundancy & Sticky client)
  6. An toan ma hoa & Mang mo (WLAN security & Open APs)
- Diem suc khoe mang (Network Health Score 0-100) kem huong dan khac phuc cu the.
- Bang cham diem kenh 2.4 GHz, 5 GHz va 6 GHz de xuat kenh tot nhat cho Router.
- Kiem toan he thong Mesh / Da tram phat va thoi gian ranh cua song (Airtime utilization).

### Tab 4: Thoai VoWiFi & Diem MOS ITU-T G.107 (VoWiFi)
- Do do tre RTT, do bien thien truyen dan Jitter va ty le rot goi.
- Tinh toan diem chat luong cuoc goi MOS (1.0 - 4.5) danh gia do san sang cho cuoc goi am thanh chat luong cao.
- Tach biet do tre noi mang (Router Gateway) voi do tre Internet (Cloud WAN) va thoi gian phan giai ten mien DNS.

### Tab 5: Quy Hoach AP & Ban Do Nhiet Chuoi Ekahau (Planner)
- Cong cu ve mat bang truc quan 2D va phoi canh 2.5D: Ve khung phong nhanh, ve tuong le, chon va keo sua, dat them AP, thuoc do suy hao tia song, va xoa doi tuong.
- Ho tro 6 loai vat lieu tuong cuyen biet (tuong gach, be tong, vach go, cua kinh, cua phong, loi kim loai).
- Chon 3 bang tan mo phong: 2.4 GHz, 5.0 GHz, 6.0 GHz Wi-Fi 6E/7.
- 5 che do ban do nhiet chuyen sau:
  1. Song Chinh (Primary Signal dBm)
  2. Song Phu Chuyen Vung (Secondary Roaming dBm)
  3. Ty So Tin Hieu Tren Nhieu (SNR dB)
  4. Nhieu Tranh Chap Kenh (Interference CCI)
  5. Toc Do & Dung Luong (Data Rate Mbps & Client Capacity)
- Thanh truot cat nguong SLA (SLA Cutoff Slider) tu -85 den -50 dBm: Vung song duoi nguong SLA tu dong bi phu toi va ve soc gach cheo canh bao goc khuat, kem ty le % dien tich dat tieu chuan cap nhat tuc thi.
- Tuy chon cong suat phat AP (14, 17, 20, 23 dBm) va loai anten (3, 6, 9 dBi).
- Nut nap truc tiep cac AP dang quet thuc te vao mat bang de mo phong vung song ngay lap tuc.
- Nut tu dong tinh toan vi tri toi uu de lap dat router.

### Tab 6: Danh Gia An Ninh & Mang Mo (Security Audit)
- Canh bao cac tram phat khong dat mat khau (Open / Unencrypted).
- Thong ke ty le cac chuan ma hoa WPA2, WPA3, WEP va Doanh nghiep (Enterprise).
- Huong dan khac phuc chi tiet bang tieng Viet de phong tranh tan cong nghe len goi tin (Packet Sniffing) va tram phat gia mao (Evil Twin).

### Tab 7: Kho Bao Cao (Reports)
- Xuat bao cao ky thuat chuan hoa sang CSV hoac JSON voi dinh dang ten: `NetScanner_Report_[MM-DD-YYYY]_[ID-01].csv`.
- File duoc ma hoa UTF-8 co BOM giup mo tren Microsoft Excel hien thi tron ven tieng Viet co dau.

---

## 4. Huong Dan Khoi Chay Ung Dung

1. **Khoi dong may chu backend**:
   Chay lenh sau trong terminal:
   ```powershell
   python server.py
   ```
   May chu se khoi dong tai dia chi: `http://localhost:8000`

2. **Mo tren trinh duyet**:
   Truy cap: `http://localhost:8000`

3. **Chay kiem thu toan bo tinh nang**:
   ```powershell
   python test_full_suite.py
   ```

---

## 5. Quy Chuan Phat Trien & Dong Bo GitHub

- Kho chua GitHub: `https://github.com/Q-9999/Wifi-Scanner`
- Nhanh chinh: `main`
- Toan bo ma nguon, giao dien, thuat toan va tai lieu deu duoc toi uu gon gang, khong dung tu ngu AI hoa, khong dung dau ngoac kep trong van ban giai thich, giu ngon ngu thuan tuy chuyen nganh mang may tinh va song ngu Viet - Anh.
