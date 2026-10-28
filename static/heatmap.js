// MMQ./WifiScanner - Indoor Wi-Fi Raytracing Heatmap Planner Engine
// Based on NWC_WifiTool Heatmap Architecture (invasiono)
(() => {
  'use strict';

  const PX = 30;
  const W = 1200, H = 720;
  const CELL = 8;
  const COLS = W / CELL, ROWS = H / CELL;
  const NOISE = -95;
  const PL0 = { 2.4: 40, 5: 47 };
  const STORE = 'mmq_wifiscanner_heatmap_v2';

  const MATERIALS = {
    drywall:  { name: 'Tường thạch cao',               l24: 3,  l5: 4,  color: '#94a3b8', w: 5 },
    brick:    { name: 'Tường gạch tiêu chuẩn',         l24: 6,  l5: 9,  color: '#c2410c', w: 7 },
    concrete: { name: 'Tường bê tông cốt thép',        l24: 12, l5: 18, color: '#334155', w: 9 },
    glass:    { name: 'Vách kính / Cửa sổ kính',       l24: 2,  l5: 3,  color: '#0284c7', w: 4 },
    gdoor:    { name: 'Cửa kính cường lực',            l24: 3,  l5: 4,  color: '#0ea5e9', w: 6, door: true },
    wdoor:    { name: 'Cửa gỗ tự nhiên / gỗ công nghiệp', l24: 4,  l5: 6,  color: '#b45309', w: 6, door: true },
    mdoor:    { name: 'Cửa kim loại / Cửa chống cháy',  l24: 15, l5: 22, color: '#475569', w: 6, door: true },
  };

  const AP_COLORS = ['#0284c7', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

  const RATES = {
    5:   [[-50, 866], [-58, 650], [-63, 433], [-67, 325], [-72, 195], [-77, 117], [-82, 58], [-88, 13]],
    2.4: [[-50, 144], [-58, 130], [-63, 117], [-67, 86],  [-72, 58],  [-77, 29],  [-82, 13], [-88, 6.5]],
  };

  const QUALITY = [
    [-50, 'Rất mạnh (Tối ưu)', '#059669'],
    [-60, 'Mạnh (Mượt mà)', '#10b981'],
    [-67, 'Khá (Đạt chuẩn thoại)', '#16a34a'],
    [-72, 'Trung bình (Chấp nhận)', '#d97706'],
    [-80, 'Yếu (Dễ rớt gói)', '#ea580c'],
    [-88, 'Rất yếu (Mấp mé)', '#dc2626'],
  ];

  const TOOLS = [
    { id: 'select', label: 'Chọn / Di chuyển', key: 'V', hint: 'Bấm chọn đối tượng trên mặt bằng, kéo chuột để di chuyển. Bấm phím Delete để xóa đối tượng đang chọn.' },
    { id: 'wall',   label: 'Vẽ tường / Cửa', key: 'W', hint: 'Kéo chuột để vẽ một đoạn tường (giữ Shift để khóa góc ngang/dọc). Vẽ cửa đè lên tường để tự động cắt khoảng mở.' },
    { id: 'ap',     label: 'Bộ phát Wi-Fi (AP)', key: 'A', hint: 'Bấm chuột lên mặt bằng để đặt một bộ phát sóng Wi-Fi (Access Point).' },
    { id: 'laptop', label: 'Máy tính xách tay', key: 'L', hint: 'Bấm chuột để đặt máy tính xách tay và phân tích chất lượng sóng vô tuyến thu được.' },
    { id: 'pc',     label: 'Máy tính để bàn PC', key: 'P', hint: 'Bấm chuột để đặt máy tính để bàn và phân tích chất lượng sóng vô tuyến thu được.' },
    { id: 'erase',  label: 'Tẩy xóa đối tượng', key: 'E', hint: 'Bấm chuột vào bất kỳ bức tường, cửa, bộ phát hoặc máy tính nào để xóa bỏ.' },
  ];

  const state = {
    walls: [], aps: [], devices: [],
    tool: 'select', mat: 'drywall', sel: null,
    n: 3.0, thr: -67, source: 'all',
    show: { heat: true, cover: true, labels: true, grid: true },
    seq: 1,
  };

  const nid = () => state.seq++;
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lossOf = (w, band) => (band === 5 ? (MATERIALS[w.mat]?.l5 || 4) : (MATERIALS[w.mat]?.l24 || 3));
  const apColor = (ap) => AP_COLORS[(ap.ci || 0) % AP_COLORS.length];
  const hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  const quality = (r) => {
    for (const [t, label, color] of QUALITY) {
      if (r >= t) return { label, color };
    }
    return { label: 'Mất sóng', color: '#64748b' };
  };

  const phyRate = (r, band) => {
    const b = band === 5 ? 5 : 2.4;
    for (const [t, v] of RATES[b]) {
      if (r >= t) return v;
    }
    return 0;
  };

  const nextName = (prefix, arr) => {
    let n = 1;
    while (arr.some((x) => x.name === `${prefix}-${n}`)) n++;
    return `${prefix}-${n}`;
  };

  function save() {
    try {
      const { walls, aps, devices, n, thr, source, show, seq } = state;
      localStorage.setItem(STORE, JSON.stringify({ walls, aps, devices, n, thr, source, show, seq }));
    } catch (e) {}
  }

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE));
      if (d && Array.isArray(d.walls)) {
        Object.assign(state, {
          walls: d.walls, aps: d.aps || [], devices: d.devices || [],
          n: d.n ?? 3, thr: d.thr ?? -67, source: d.source || 'all', seq: d.seq || 1,
        });
        Object.assign(state.show, d.show || {});
        return true;
      }
    } catch (e) {}
    return false;
  }

  function hitT(px, py, dx, dy, w) {
    const ex = w.b.x - w.a.x, ey = w.b.y - w.a.y;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) return -1;
    const qx = w.a.x - px, qy = w.a.y - py;
    const t = (qx * ey - qy * ex) / den;
    const u = (qx * dy - qy * dx) / den;
    return (t > 1e-6 && t <= 1 && u >= 0 && u < 1) ? t : -1;
  }

  const baseLoss = (ap, d) => ap.power - (PL0[ap.band] || 40) - 10 * state.n * Math.log10(Math.max(d, 1));

  function rssi(ap, x, y, hits) {
    const dx = x - ap.x, dy = y - ap.y;
    const d = Math.hypot(dx, dy);
    let loss = 0;
    for (const w of state.walls) {
      const t = hitT(ap.x, ap.y, dx, dy, w);
      if (t > 0) {
        const L = lossOf(w, ap.band);
        loss += L;
        if (hits) hits.push({ w, t, x: ap.x + dx * t, y: ap.y + dy * t, loss: L });
      }
    }
    return baseLoss(ap, d) - loss;
  }

  const idealRadius = (ap) => Math.max(1, Math.pow(10, (ap.power - (PL0[ap.band] || 40) - state.thr) / (10 * state.n)));

  function coverage(ap) {
    const RAYS = 180, MAXD = 80, STEP = 0.1;
    const pts = [];
    let sum = 0;
    for (let i = 0; i < RAYS; i++) {
      const a = (i / RAYS) * Math.PI * 2;
      const dx = Math.cos(a), dy = Math.sin(a);
      const hits = [];
      for (const w of state.walls) {
        const t = hitT(ap.x, ap.y, dx * MAXD, dy * MAXD, w);
        if (t > 0) hits.push([t * MAXD, lossOf(w, ap.band)]);
      }
      hits.sort((p, q) => p[0] - q[0]);
      let hi = 0, loss = 0, r = 0;
      for (let d = STEP; d <= MAXD; d += STEP) {
        while (hi < hits.length && hits[hi][0] <= d) loss += hits[hi++][1];
        if (baseLoss(ap, d) - loss < state.thr) break;
        r = d;
      }
      pts.push({ x: ap.x + dx * r, y: ap.y + dy * r });
      sum += r;
    }
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      area += p.x * q.y - q.x * p.y;
    }
    area = Math.abs(area) / 2;
    const R = idealRadius(ap);
    const ideal = Math.PI * R * R;
    return { pts, avg: sum / RAYS, area, R, ideal, cut: clamp(1 - area / ideal, 0, 1) };
  }

  function deviceStatus(dev) {
    let best = null;
    for (const ap of state.aps) {
      const hits = [];
      const r = rssi(ap, dev.x, dev.y, hits);
      if (!best || r > best.rssi) best = { ap, rssi: r, hits };
    }
    if (!best) return null;
    best.dist = Math.hypot(dev.x - best.ap.x, dev.y - best.ap.y);
    best.snr = best.rssi - NOISE;
    best.q = quality(best.rssi);
    best.phy = phyRate(best.rssi, best.ap.band);
    best.tput = Math.round(best.phy * 0.55);
    best.wallDb = best.hits.reduce((s, h) => s + h.loss, 0);
    return best;
  }

  function bestAt(x, y) {
    let best = null;
    for (const ap of state.aps) {
      const r = rssi(ap, x, y);
      if (best === null || r > best) best = r;
    }
    return best;
  }

  function trimUnder(a, b) {
    const eps = 0.12;
    const out = [];
    for (const w of state.walls) {
      if (MATERIALS[w.mat]?.door) { out.push(w); continue; }
      const ex = w.b.x - w.a.x, ey = w.b.y - w.a.y, len = Math.hypot(ex, ey);
      if (len < 1e-6) { out.push(w); continue; }
      const ux = ex / len, uy = ey / len;
      const da = Math.abs((a.x - w.a.x) * uy - (a.y - w.a.y) * ux);
      const db = Math.abs((b.x - w.a.x) * uy - (b.y - w.a.y) * ux);
      if (da > eps || db > eps) { out.push(w); continue; }
      let t1 = (a.x - w.a.x) * ux + (a.y - w.a.y) * uy;
      let t2 = (b.x - w.a.x) * ux + (b.y - w.a.y) * uy;
      if (t1 > t2) [t1, t2] = [t2, t1];
      const lo = Math.max(0, t1), hi = Math.min(len, t2);
      if (hi - lo < 0.05) { out.push(w); continue; }
      if (lo > 0.05) out.push({ ...w, id: nid(), a: { ...w.a }, b: { x: w.a.x + ux * lo, y: w.a.y + uy * lo } });
      if (len - hi > 0.05) out.push({ ...w, id: nid(), a: { x: w.a.x + ux * hi, y: w.a.y + uy * hi }, b: { ...w.b } });
    }
    state.walls = out;
  }

  function addWall(a, b, mat) {
    if (MATERIALS[mat]?.door) trimUnder(a, b);
    const w = { id: nid(), a: { ...a }, b: { ...b }, mat };
    state.walls.push(w);
    return w;
  }

  function snapPt(p, free, from) {
    let x = p.x, y = p.y;
    if (from && !free) {
      const dx = x - from.x, dy = y - from.y, t = Math.tan(12 * Math.PI / 180);
      if (Math.abs(dy) < Math.abs(dx) * t) y = from.y;
      else if (Math.abs(dx) < Math.abs(dy) * t) x = from.x;
    }
    x = Math.round(x * 4) / 4;
    y = Math.round(y * 4) / 4;
    let bd = 0.3, bp = null;
    for (const w of state.walls) {
      for (const pt of [w.a, w.b]) {
        const d = Math.hypot(pt.x - x, pt.y - y);
        if (d < bd) { bd = d; bp = pt; }
      }
    }
    if (bp) { x = bp.x; y = bp.y; }
    return { x: clamp(x, 0, W / PX), y: clamp(y, 0, H / PX) };
  }

  function distPointSeg(p, a, b) {
    const ex = b.x - a.x, ey = b.y - a.y;
    const l2 = ex * ex + ey * ey;
    let t = l2 ? ((p.x - a.x) * ex + (p.y - a.y) * ey) / l2 : 0;
    t = clamp(t, 0, 1);
    return Math.hypot(p.x - (a.x + ex * t), p.y - (a.y + ey * t));
  }

  function hitTest(p) {
    for (let i = state.devices.length - 1; i >= 0; i--) {
      const d = state.devices[i];
      if (Math.hypot((d.x - p.x) * PX, (d.y - p.y) * PX) <= 18) return { type: 'device', id: d.id };
    }
    for (let i = state.aps.length - 1; i >= 0; i--) {
      const a = state.aps[i];
      if (Math.hypot((a.x - p.x) * PX, (a.y - p.y) * PX) <= 16) return { type: 'ap', id: a.id };
    }
    let best = null, bd = 9;
    for (const w of state.walls) {
      const d = distPointSeg(p, w.a, w.b) * PX - (MATERIALS[w.mat]?.door ? 3 : 0);
      if (d < bd) { bd = d; best = w; }
    }
    return best ? { type: 'wall', id: best.id } : null;
  }

  const findItem = (s) => {
    if (!s) return null;
    const arr = s.type === 'wall' ? state.walls : s.type === 'ap' ? state.aps : state.devices;
    return arr.find((x) => x.id === s.id) || null;
  };

  function removeItem(s) {
    if (!s) return;
    if (s.type === 'wall') state.walls = state.walls.filter((x) => x.id !== s.id);
    if (s.type === 'ap') state.aps = state.aps.filter((x) => x.id !== s.id);
    if (s.type === 'device') state.devices = state.devices.filter((x) => x.id !== s.id);
    if (state.sel && state.sel.id === s.id && state.sel.type === s.type) setSel(null);
    dirtyGeo();
    save();
  }

  function loadSample() {
    state.walls = []; state.aps = []; state.devices = []; state.seq = 1; state.sel = null;
    const wl = (x1, y1, x2, y2, mat) => addWall({ x: x1, y: y1 }, { x: x2, y: y2 }, mat);

    // Bao quanh bê tông
    wl(3, 3, 37, 3, 'concrete'); wl(37, 3, 37, 21, 'concrete');
    wl(37, 21, 3, 21, 'concrete'); wl(3, 21, 3, 3, 'concrete');

    // Hành lang giữa
    wl(3, 11, 37, 11, 'drywall'); wl(3, 13, 37, 13, 'drywall');

    // Các phòng chức năng
    [13, 23].forEach((x) => { wl(x, 3, x, 11, 'drywall'); wl(x, 13, x, 21, 'drywall'); });
    wl(23, 3, 23, 11, 'brick'); wl(23, 13, 23, 21, 'brick');
    wl(30, 3, 30, 11, 'glass'); wl(30, 13, 30, 21, 'drywall');

    // Cửa ra vào
    [[7, 8], [17, 18], [26, 27]].forEach(([a, b]) => {
      wl(a, 11, b, 11, 'wdoor'); wl(a, 13, b, 13, 'wdoor');
    });
    wl(33, 11, 34.5, 11, 'gdoor'); wl(33, 13, 34.5, 13, 'gdoor');
    wl(3, 11.25, 3, 12.75, 'gdoor');
    wl(37, 11.25, 37, 12.75, 'mdoor');

    state.aps.push({ id: nid(), x: 12, y: 12, name: 'AP-Chính-5G', power: 20, band: 5, ci: 0 });
    state.aps.push({ id: nid(), x: 28, y: 12, name: 'AP-Phụ-2.4G', power: 20, band: 2.4, ci: 1 });
    state.devices.push({ id: nid(), x: 7, y: 6.5, name: 'Laptop-Họp', kind: 'laptop' });
    state.devices.push({ id: nid(), x: 33.5, y: 17, name: 'PC-KếToán', kind: 'pc' });
    state.devices.push({ id: nid(), x: 18, y: 18, name: 'Laptop-KỹThuật', kind: 'laptop' });
  }

  let cv, ctx, off, offCtx, img;
  let geoDirty = true;
  let raf = 0;
  let covCache = new Map();
  let statuses = [];
  let drag = null;
  let hoverRssi = null;

  const hslToRgb = (h, s, l) => {
    h /= 360;
    const f = (n) => {
      const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return [f(0), f(8), f(4)];
  };
  const LUT = Array.from({ length: 61 }, (_, i) => hslToRgb((i / 60) * 125, 0.85, 0.5));
  const heatColor = (r) => {
    if (r < -90) return [30, 41, 59, 80];
    const v = clamp((r + 90) / 60, 0, 1);
    const c = LUT[Math.round(v * 60)];
    return [c[0], c[1], c[2], 150];
  };

  const heatAPs = () => {
    if (state.source === 'selected' && state.sel && state.sel.type === 'ap') {
      const a = findItem(state.sel);
      if (a) return [a];
    }
    return state.aps;
  };

  function buildHeat() {
    if (!img) return;
    const aps = heatAPs();
    const data = img.data;
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        const x = (i + 0.5) * CELL / PX, y = (j + 0.5) * CELL / PX;
        let best = -200;
        for (const ap of aps) {
          const r = rssi(ap, x, y);
          if (r > best) best = r;
        }
        const c = heatColor(best), k = (j * COLS + i) * 4;
        data[k] = c[0]; data[k + 1] = c[1]; data[k + 2] = c[2]; data[k + 3] = c[3];
      }
    }
    offCtx.putImageData(img, 0, 0);
  }

  const dirtyGeo = () => { geoDirty = true; schedule(); };
  function schedule() { if (!raf) raf = requestAnimationFrame(draw); }

  const rr = (x, y, w, h, r) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  };

  function pill(lines, x, y, accent) {
    ctx.font = '600 11px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
    const w = Math.max(...lines.map((t) => ctx.measureText(t).width)) + 12;
    const h = lines.length * 13 + 6;
    rr(x - w / 2, y, w, h, 6);
    ctx.fillStyle = 'rgba(255,255,255,.94)';
    ctx.fill();
    ctx.strokeStyle = accent || '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    lines.forEach((t, i) => {
      ctx.font = i === 0 ? '600 11px system-ui, sans-serif' : '500 10px system-ui, sans-serif';
      ctx.fillStyle = i === 0 ? '#0f172a' : '#475569';
      ctx.fillText(t, x, y + 4 + i * 13);
    });
  }

  function drawGrid() {
    ctx.lineWidth = 1;
    for (let m = 0; m <= W / PX; m++) {
      ctx.strokeStyle = m % 5 === 0 ? '#e2e8f0' : '#f1f5f9';
      ctx.beginPath(); ctx.moveTo(m * PX + 0.5, 0); ctx.lineTo(m * PX + 0.5, H); ctx.stroke();
    }
    for (let m = 0; m <= H / PX; m++) {
      ctx.strokeStyle = m % 5 === 0 ? '#e2e8f0' : '#f1f5f9';
      ctx.beginPath(); ctx.moveTo(0, m * PX + 0.5); ctx.lineTo(W, m * PX + 0.5); ctx.stroke();
    }
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 10px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    for (let m = 5; m < W / PX; m += 5) ctx.fillText(`${m} m`, m * PX + 3, 2);
    for (let m = 5; m < H / PX; m += 5) ctx.fillText(`${m} m`, 3, m * PX + 2);
  }

  function strokeWall(w, extra) {
    const m = MATERIALS[w.mat];
    if (!m) return;
    ctx.beginPath();
    ctx.moveTo(w.a.x * PX, w.a.y * PX);
    ctx.lineTo(w.b.x * PX, w.b.y * PX);
    ctx.lineCap = m.door ? 'butt' : 'round';
    ctx.setLineDash([]);
    if (extra) { ctx.strokeStyle = 'rgba(2,132,199,.35)'; ctx.lineWidth = m.w + 8; ctx.stroke(); }
    ctx.strokeStyle = m.color;
    ctx.lineWidth = m.w;
    ctx.stroke();
    if (m.door || w.mat === 'glass') {
      ctx.strokeStyle = m.door ? '#fff' : 'rgba(255,255,255,.75)';
      ctx.lineWidth = 1.5;
      if (m.door) ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawAP(ap) {
    const x = ap.x * PX, y = ap.y * PX, c = apColor(ap);
    const sel = state.sel && state.sel.type === 'ap' && state.sel.id === ap.id;
    if (sel) { ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fillStyle = hexA(c, 0.2); ctx.fill(); }
    ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(x, y + 4, 2, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2; ctx.lineCap = 'round';
    [4.5, 8.5].forEach((r) => {
      ctx.beginPath(); ctx.arc(x, y + 4, r, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke();
    });
    if (state.show.labels) pill([ap.name, `${ap.power} dBm · ${ap.band} GHz`], x, y + 17, c);
  }

  function drawDevice(dev, st) {
    const x = dev.x * PX, y = dev.y * PX;
    const q = st ? st.q : { label: 'Chưa nối AP', color: '#64748b' };
    const sel = state.sel && state.sel.type === 'device' && state.sel.id === dev.id;
    ctx.beginPath(); ctx.arc(x, y, sel ? 22 : 18, 0, Math.PI * 2);
    ctx.fillStyle = hexA(q.color, sel ? 0.3 : 0.16); ctx.fill();
    ctx.strokeStyle = q.color; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#0f172a';
    if (dev.kind === 'pc') {
      rr(x - 9, y - 10, 18, 13, 2); ctx.fill();
      ctx.fillStyle = q.color; ctx.fillRect(x - 7, y - 8, 14, 9);
      ctx.fillStyle = '#0f172a'; ctx.fillRect(x - 2, y + 3, 4, 4);
      rr(x - 6, y + 7, 12, 2.5, 1); ctx.fill();
    } else {
      rr(x - 8, y - 9, 16, 11, 2); ctx.fill();
      ctx.fillStyle = q.color; ctx.fillRect(x - 6, y - 7, 12, 7);
      ctx.fillStyle = '#475569'; rr(x - 11, y + 3, 22, 3.5, 1.5); ctx.fill();
    }
    if (state.show.labels) {
      pill([dev.name, st ? `${Math.round(st.rssi)} dBm · ${q.label}` : 'Ngoài vùng phủ'], x, y + 21, q.color);
    }
  }

  function draw() {
    raf = 0;
    const viewEl = $('#view-heatmap');
    if (!viewEl || viewEl.offsetParent === null) return;
    if (!ctx) return;

    if (geoDirty) {
      if (state.aps.length) buildHeat();
      covCache = new Map();
      for (const ap of state.aps) covCache.set(ap.id, coverage(ap));
      geoDirty = false;
    }
    statuses = state.devices.map((d) => ({ d, s: deviceStatus(d) }));

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    if (state.show.grid) drawGrid();

    if (state.show.heat && state.aps.length && off) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(off, 0, 0, W, H);
    }

    if (state.show.cover) {
      for (const ap of state.aps) {
        const cov = covCache.get(ap.id), c = apColor(ap);
        if (!cov) continue;

        ctx.beginPath(); ctx.arc(ap.x * PX, ap.y * PX, cov.R * PX, 0, Math.PI * 2);
        ctx.setLineDash([7, 6]); ctx.strokeStyle = hexA(c, 0.7); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        cov.pts.forEach((p, i) => (i ? ctx.lineTo(p.x * PX, p.y * PX) : ctx.moveTo(p.x * PX, p.y * PX)));
        ctx.closePath();
        ctx.fillStyle = hexA(c, 0.08); ctx.fill();
        ctx.strokeStyle = c; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke();
      }
    }

    for (const w of state.walls) {
      strokeWall(w, state.sel && state.sel.type === 'wall' && state.sel.id === w.id);
    }
    ctx.lineCap = 'butt';

    for (const { d, s } of statuses) {
      if (!s) continue;
      ctx.beginPath(); ctx.moveTo(d.x * PX, d.y * PX); ctx.lineTo(s.ap.x * PX, s.ap.y * PX);
      ctx.setLineDash([6, 5]); ctx.strokeStyle = s.q.color; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
      for (const h of s.hits) {
        ctx.beginPath(); ctx.arc(h.x * PX, h.y * PX, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = s.q.color; ctx.lineWidth = 2; ctx.stroke();
        if (state.show.labels) {
          ctx.font = '700 10px system-ui, sans-serif';
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#0f172a';
          ctx.fillText(`-${h.loss} dB`, h.x * PX + 7, h.y * PX - 8);
        }
      }
    }

    state.aps.forEach(drawAP);
    statuses.forEach(({ d, s }) => drawDevice(d, s));

    if (drag && drag.type === 'draw') {
      const m = MATERIALS[state.mat] || MATERIALS.drywall;
      ctx.beginPath(); ctx.moveTo(drag.a.x * PX, drag.a.y * PX); ctx.lineTo(drag.b.x * PX, drag.b.y * PX);
      ctx.strokeStyle = m.color; ctx.globalAlpha = 0.75; ctx.lineWidth = m.w; ctx.lineCap = 'round'; ctx.stroke();
      ctx.globalAlpha = 1;
      const len = Math.hypot(drag.b.x - drag.a.x, drag.b.y - drag.a.y);
      pill([`${len.toFixed(2)} m`], ((drag.a.x + drag.b.x) / 2) * PX, ((drag.a.y + drag.b.y) / 2) * PX + 10, m.color);
    }

    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(16, H - 16); ctx.lineTo(16 + 5 * PX, H - 16);
    ctx.moveTo(16, H - 21); ctx.lineTo(16, H - 11); ctx.moveTo(16 + 5 * PX, H - 21); ctx.lineTo(16 + 5 * PX, H - 11);
    ctx.stroke();
    ctx.fillStyle = '#475569'; ctx.font = '600 10px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('Thước đo 5 m', 16 + 5 * PX + 8, H - 10);

    renderPanels();
  }

  const setHTML = (el, html) => { if (el && el._h !== html) { el._h = html; el.innerHTML = html; } };

  function renderPanels() {
    const devEl = $('#hm-devices');
    if (devEl) {
      if (!statuses.length) {
        setHTML(devEl, '<p style="font-size:0.8rem; color:#64748b; padding:8px 0;">Hãy đặt Laptop hoặc máy tính PC lên mặt bằng để phân tích mức tín hiệu thu được.</p>');
      } else {
        setHTML(devEl, statuses.map(({ d, s }) => {
          const sel = state.sel && state.sel.type === 'device' && state.sel.id === d.id;
          const kind = d.kind === 'pc' ? 'Máy tính để bàn' : 'Máy tính xách tay';
          if (!s) {
            return `<div data-sel="device:${d.id}" class="hm-item-card ${sel ? 'selected' : ''}">
              <div style="font-size:0.85rem; font-weight:700; color:#0f172a;">${esc(d.name)} <span style="font-size:0.75rem; font-weight:400; color:#64748b;">(${kind})</span></div>
              <p style="margin-top:4px; font-size:0.78rem; color:#64748b;">Chưa có bộ phát nào trên mặt bằng.</p>
            </div>`;
          }
          const g = {};
          s.hits.forEach((h) => {
            const k = h.w.mat; g[k] = g[k] || { n: 0, db: 0 }; g[k].n++; g[k].db += h.loss;
          });
          const rows = Object.entries(g).map(([k, v]) =>
            `<li style="display:flex; justify-content:space-between;"><span>${v.n}x ${MATERIALS[k]?.name || k}</span><span style="font-weight:600; color:#0f172a;">-${v.db} dB</span></li>`).join('');
          const pct = clamp(((s.rssi + 95) / 65) * 100, 2, 100);

          return `<div data-sel="device:${d.id}" class="hm-item-card ${sel ? 'selected' : ''}">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
              <span style="font-size:0.86rem; font-weight:700; color:#0f172a;">${esc(d.name)} <span style="font-size:0.75rem; font-weight:400; color:#64748b;">(${kind})</span></span>
              <span style="border-radius:999px; padding:2px 8px; font-size:0.7rem; font-weight:700; background:${hexA(s.q.color, 0.12)}; color:${s.q.color};">${s.q.label}</span>
            </div>
            <div style="margin-top:6px; display:flex; align-items:baseline; gap:4px;">
              <span style="font-size:1.6rem; font-weight:700; color:#0f172a;">${Math.round(s.rssi)}</span>
              <span style="font-size:0.8rem; color:#64748b;">dBm</span>
            </div>
            <div style="margin-top:4px; height:6px; background:#e2e8f0; border-radius:999px; overflow:hidden;">
              <div style="height:100%; width:${pct}%; background:${s.q.color}; border-radius:999px;"></div>
            </div>
            <div style="margin-top:10px; display:grid; grid-template-columns: 1fr 1fr; gap:4px 8px; font-size:0.76rem;">
              <span style="color:#64748b;">Kết nối tới</span><span style="text-align:right; font-weight:600; color:#0f172a;">${esc(s.ap.name)} (${s.ap.band} GHz)</span>
              <span style="color:#64748b;">Tỷ số SNR</span><span style="text-align:right; font-weight:600; color:#0f172a;">${Math.round(s.snr)} dB</span>
              <span style="color:#64748b;">Khoảng cách</span><span style="text-align:right; font-weight:600; color:#0f172a;">${s.dist.toFixed(1)} m</span>
              <span style="color:#64748b;">Vật cản</span><span style="text-align:right; font-weight:600; color:#dc2626;">${s.hits.length} tường (-${s.wallDb} dB)</span>
              <span style="color:#64748b;">Tốc độ liên kết</span><span style="text-align:right; font-weight:600; color:#0284c7;">${s.phy ? s.phy + ' Mbps' : 'Mất liên kết'}</span>
              <span style="color:#64748b;">Thông lượng ước lượng</span><span style="text-align:right; font-weight:600; color:#059669;">${s.phy ? '~' + s.tput + ' Mbps' : '0 Mbps'}</span>
            </div>
            ${rows ? `<ul style="margin-top:8px; padding-top:8px; border-top:1px solid #f1f5f9; font-size:0.74rem; color:#64748b; line-height:1.4;">${rows}</ul>` : '<p style="margin-top:8px; padding-top:6px; border-top:1px solid #f1f5f9; font-size:0.74rem; color:#059669; font-weight:600;">Tầm nhìn thẳng (LOS), không có vật cản che chắn.</p>'}
          </div>`;
        }).join(''));
      }
    }

    const apsEl = $('#hm-aps');
    if (apsEl) {
      if (!state.aps.length) {
        setHTML(apsEl, '<p style="font-size:0.8rem; color:#64748b; padding:8px 0;">Hãy đặt bộ phát AP lên mặt bằng để theo dõi bán kính và diện tích phủ sóng.</p>');
      } else {
        setHTML(apsEl, state.aps.map((ap) => {
          const c = covCache.get(ap.id);
          if (!c) return '';
          const sel = state.sel && state.sel.type === 'ap' && state.sel.id === ap.id;
          const keep = Math.round((1 - c.cut) * 100);
          return `<div data-sel="ap:${ap.id}" class="hm-item-card ${sel ? 'selected' : ''}">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span style="font-size:0.86rem; font-weight:700; color:#0f172a;"><span style="display:inline-block; width:8px; height:8px; border-radius:999px; background:${apColor(ap)}; margin-right:6px;"></span>${esc(ap.name)}</span>
              <span style="font-size:0.75rem; color:#64748b; font-weight:600;">${ap.power} dBm &bull; ${ap.band} GHz</span>
            </div>
            <div style="margin-top:8px; display:grid; grid-template-columns: 1fr 1fr; gap:4px 8px; font-size:0.76rem;">
              <span style="color:#64748b;">Bán kính lý tưởng</span><span style="text-align:right; font-weight:600; color:#0f172a;">${c.R.toFixed(1)} m</span>
              <span style="color:#64748b;">Bán kính thực tế</span><span style="text-align:right; font-weight:700; color:${apColor(ap)};">${c.avg.toFixed(1)} m</span>
              <span style="color:#64748b;">Hiệu suất phủ sóng</span><span style="text-align:right; font-weight:700; color:#059669;">${keep}%</span>
            </div>
            <div style="margin-top:6px; height:6px; background:#e2e8f0; border-radius:999px; overflow:hidden;">
              <div style="height:100%; width:${keep}%; background:${apColor(ap)}; border-radius:999px;"></div>
            </div>
            <p style="margin-top:6px; font-size:0.72rem; color:#64748b;">Vật cản làm hao hụt khoảng ~${Math.round(c.cut * 100)}% diện tích phủ sóng lý thuyết ở ngưỡng ${state.thr} dBm.</p>
          </div>`;
        }).join(''));
      }
    }
  }

  function renderProps() {
    const el = $('#hm-props');
    if (!el) return;
    const it = findItem(state.sel);
    if (!it) {
      el.innerHTML = '<p style="font-size:0.8rem; color:#64748b; padding:8px 0;">Bấm chọn một bức tường, bộ phát AP hoặc thiết bị trên mặt bằng để hiệu chỉnh thông số.</p>';
      return;
    }
    const del = '<button type="button" data-act="del" class="btn btn-secondary btn-sm" style="width:100%; margin-top:10px; color:#dc2626; border-color:#fecaca; background:#fef2f2; font-weight:600;">Xóa đối tượng này</button>';
    if (state.sel.type === 'ap') {
      el.innerHTML = `
        <div style="font-size:0.85rem; font-weight:700; color:#0f172a; margin-bottom:8px;">Hiệu chỉnh Bộ phát Wi-Fi (AP)</div>
        <label class="hm-label" for="hm-p-name">Tên bộ phát</label>
        <input id="hm-p-name" data-f="name" class="hm-input" value="${esc(it.name)}" maxlength="24" />
        <label class="hm-label" for="hm-p-power">Công suất phát: <span id="hm-p-powerv" style="font-weight:700; color:#0284c7;">${it.power} dBm</span></label>
        <input id="hm-p-power" data-f="power" type="range" min="5" max="30" step="1" value="${it.power}" style="width:100%; accent-color:#0284c7;" />
        <label class="hm-label" for="hm-p-band">Dải tần vô tuyến</label>
        <select id="hm-p-band" data-f="band" class="hm-input">
          <option value="2.4" ${it.band === 2.4 ? 'selected' : ''}>2.4 GHz (Phủ rộng, xuyên tường tốt)</option>
          <option value="5" ${it.band === 5 ? 'selected' : ''}>5.0 GHz (Băng thông cao, xuyên tường vừa)</option>
        </select>${del}`;
    } else if (state.sel.type === 'device') {
      el.innerHTML = `
        <div style="font-size:0.85rem; font-weight:700; color:#0f172a; margin-bottom:8px;">Hiệu chỉnh Thiết bị người dùng</div>
        <label class="hm-label" for="hm-p-name">Tên thiết bị</label>
        <input id="hm-p-name" data-f="name" class="hm-input" value="${esc(it.name)}" maxlength="24" />
        <label class="hm-label" for="hm-p-kind">Loại phần cứng</label>
        <select id="hm-p-kind" data-f="kind" class="hm-input">
          <option value="laptop" ${it.kind === 'laptop' ? 'selected' : ''}>Máy tính xách tay (Laptop)</option>
          <option value="pc" ${it.kind === 'pc' ? 'selected' : ''}>Máy tính để bàn (Desktop PC)</option>
        </select>${del}`;
    } else {
      const len = Math.hypot(it.b.x - it.a.x, it.b.y - it.a.y);
      el.innerHTML = `
        <div style="font-size:0.85rem; font-weight:700; color:#0f172a; margin-bottom:8px;">${MATERIALS[it.mat]?.door ? 'Cửa đi' : 'Bức tường'} (${len.toFixed(2)} m)</div>
        <label class="hm-label" for="hm-p-mat">Vật liệu cấu thành</label>
        <select id="hm-p-mat" data-f="mat" class="hm-input">
          ${Object.entries(MATERIALS).map(([k, m]) => `<option value="${k}" ${it.mat === k ? 'selected' : ''}>${m.name} (-${m.l24} / -${m.l5} dB)</option>`).join('')}
        </select>${del}`;
    }
  }

  function setSel(s) {
    state.sel = s;
    renderProps();
    if (state.source === 'selected') geoDirty = true;
    schedule();
  }

  function renderTools() {
    const toolsEl = $('#hm-tools');
    if (toolsEl) {
      toolsEl.innerHTML = TOOLS.map((t) =>
        `<button type="button" class="hm-tool" data-tool="${t.id}" aria-pressed="${state.tool === t.id}">
           <span style="flex:1; text-align:left;">${t.label}</span>
           <span class="hm-kbd">${t.key}</span>
         </button>`).join('');
    }
    const matsEl = $('#hm-materials');
    if (matsEl) {
      matsEl.innerHTML = Object.entries(MATERIALS).map(([k, m]) =>
        `<button type="button" class="hm-mat" data-mat="${k}" aria-pressed="${state.mat === k}">
           <span style="display:inline-block; width:18px; height:8px; border-radius:4px; background:${m.color}; shrink:0;"></span>
           <span style="flex:1; text-align:left; font-size:0.76rem;">${m.name}</span>
           <span style="font-size:0.72rem; color:#64748b; font-weight:600;">-${m.l24}/-${m.l5}dB</span>
         </button>`).join('');
    }
    const hintEl = $('#hm-hint');
    if (hintEl) {
      const cur = TOOLS.find((t) => t.id === state.tool);
      if (cur) hintEl.textContent = cur.hint;
    }
    if (cv) {
      cv.style.cursor = state.tool === 'select' ? 'default' : state.tool === 'erase' ? 'pointer' : 'crosshair';
    }
  }

  function setTool(id) {
    state.tool = id;
    drag = null;
    renderTools();
    schedule();
  }

  const pos = (e) => {
    if (!cv) return { x: 0, y: 0 };
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * (W / r.width)) / PX, y: ((e.clientY - r.top) * (H / r.height)) / PX };
  };
  const inPlan = (p) => ({ x: clamp(Math.round(p.x * 20) / 20, 0, W / PX), y: clamp(Math.round(p.y * 20) / 20, 0, H / PX) });

  function setupEvents() {
    if (!cv) return;

    cv.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const p = pos(e);
      cv.setPointerCapture(e.pointerId);
      const t = state.tool;

      if (t === 'wall') {
        const s = snapPt(p, true, null);
        drag = { type: 'draw', a: s, b: s };
      } else if (t === 'ap') {
        const q = inPlan(p);
        const ap = { id: nid(), x: q.x, y: q.y, name: nextName('AP', state.aps), power: 20, band: 5, ci: state.aps.length };
        state.aps.push(ap);
        setSel({ type: 'ap', id: ap.id });
        dirtyGeo(); save();
      } else if (t === 'laptop' || t === 'pc') {
        const q = inPlan(p);
        const dev = { id: nid(), x: q.x, y: q.y, kind: t, name: nextName(t === 'pc' ? 'PC' : 'Laptop', state.devices) };
        state.devices.push(dev);
        setSel({ type: 'device', id: dev.id });
        schedule(); save();
      } else if (t === 'erase') {
        const h = hitTest(p);
        if (h) removeItem(h);
      } else {
        const h = hitTest(p);
        setSel(h);
        if (h) {
          const it = findItem(h);
          if (h.type === 'wall') {
            drag = { type: 'wmove', w: it, start: snapPt(p, true, null), a0: { ...it.a }, b0: { ...it.b } };
          } else {
            drag = { type: 'move', item: it, kind: h.type, ox: it.x - p.x, oy: it.y - p.y };
          }
        }
      }
    });

    cv.addEventListener('pointermove', (e) => {
      const p = pos(e);
      if (!drag) {
        const r = state.aps.length ? bestAt(p.x, p.y) : null;
        hoverRssi = r;
        const coordsEl = $('#hm-coords');
        if (coordsEl) {
          coordsEl.textContent = `${p.x.toFixed(1)} m, ${p.y.toFixed(1)} m` + (r !== null ? ` | Mức sóng tại đây: ${Math.round(r)} dBm` : '');
        }
        return;
      }
      if (drag.type === 'draw') {
        drag.b = snapPt(p, e.shiftKey, drag.a);
        schedule();
      } else if (drag.type === 'move') {
        const q = inPlan({ x: p.x + drag.ox, y: p.y + drag.oy });
        drag.item.x = q.x; drag.item.y = q.y;
        if (drag.kind === 'ap') geoDirty = true;
        schedule();
      } else if (drag.type === 'wmove') {
        const s = snapPt(p, true, null);
        const dx = s.x - drag.start.x, dy = s.y - drag.start.y;
        drag.w.a = { x: drag.a0.x + dx, y: drag.a0.y + dy };
        drag.w.b = { x: drag.b0.x + dx, y: drag.b0.y + dy };
        geoDirty = true;
        schedule();
      }
    });

    const endDrag = () => {
      if (!drag) return;
      if (drag.type === 'draw') {
        const len = Math.hypot(drag.b.x - drag.a.x, drag.b.y - drag.a.y);
        if (len >= 0.3) { addWall(drag.a, drag.b, state.mat); geoDirty = true; }
      }
      if (drag.type === 'wmove') renderProps();
      drag = null;
      save();
      schedule();
    };
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', () => { drag = null; schedule(); });

    document.addEventListener('keydown', (e) => {
      const viewEl = $('#view-heatmap');
      if (!viewEl || viewEl.offsetParent === null) return;
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'delete' || k === 'backspace') { if (state.sel) { removeItem(state.sel); e.preventDefault(); } return; }
      if (k === 'escape') { drag = null; setSel(null); return; }
      const t = TOOLS.find((x) => x.key.toLowerCase() === k);
      if (t && !e.ctrlKey && !e.metaKey) setTool(t.id);
    });

    const sec = $('#view-heatmap');
    if (sec) {
      sec.addEventListener('click', (e) => {
        const toolBtn = e.target.closest('[data-tool]');
        if (toolBtn) { setTool(toolBtn.dataset.tool); return; }
        const matBtn = e.target.closest('[data-mat]');
        if (matBtn) { state.mat = matBtn.dataset.mat; if (state.tool !== 'wall') state.tool = 'wall'; renderTools(); return; }
        const selEl = e.target.closest('[data-sel]');
        if (selEl) { const [type, id] = selEl.dataset.sel.split(':'); setSel({ type, id: +id }); return; }
        if (e.target.closest('[data-act="del"]')) removeItem(state.sel);
      });
    }

    const propsEl = $('#hm-props');
    if (propsEl) {
      propsEl.addEventListener('input', (e) => {
        const f = e.target.dataset.f;
        const it = findItem(state.sel);
        if (!f || !it) return;
        if (f === 'name') it.name = e.target.value.slice(0, 24);
        if (f === 'power') { it.power = +e.target.value; const pv = $('#hm-p-powerv'); if (pv) pv.textContent = `${it.power} dBm`; geoDirty = true; }
        if (f === 'band') { it.band = +e.target.value; geoDirty = true; }
        if (f === 'mat') { it.mat = e.target.value; geoDirty = true; }
        if (f === 'kind') it.kind = e.target.value;
        save();
        schedule();
      });
    }

    const nSlider = $('#hm-n');
    if (nSlider) {
      nSlider.addEventListener('input', (e) => {
        state.n = +e.target.value;
        const nv = $('#hm-n-v');
        if (nv) nv.textContent = state.n.toFixed(1);
        dirtyGeo(); save();
      });
    }

    const thrSel = $('#hm-thr');
    if (thrSel) {
      thrSel.addEventListener('change', (e) => { state.thr = +e.target.value; dirtyGeo(); save(); });
    }

    const srcSel = $('#hm-src');
    if (srcSel) {
      srcSel.addEventListener('change', (e) => { state.source = e.target.value; dirtyGeo(); save(); });
    }

    ['heat', 'cover', 'labels', 'grid'].forEach((k) => {
      const chk = $(`#hm-show-${k}`);
      if (chk) {
        chk.addEventListener('change', (e) => { state.show[k] = e.target.checked; schedule(); save(); });
      }
    });

    const btnSample = $('#hm-sample');
    if (btnSample) {
      btnSample.addEventListener('click', () => { loadSample(); syncControls(); renderProps(); dirtyGeo(); save(); });
    }

    const btnClear = $('#hm-clear');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (!confirm('Bạn có chắc muốn xóa sạch toàn bộ tường, bộ phát và thiết bị trên mặt bằng?')) return;
        state.walls = []; state.aps = []; state.devices = []; state.sel = null;
        renderProps(); dirtyGeo(); save();
      });
    }

    const btnExport = $('#hm-export');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        if (!cv) return;
        cv.toBlob((b) => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(b);
          a.download = 'MMQ-WifiScanner-Heatmap.png';
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        });
      });
    }

    const btnRealRefresh = $('#hm-real-refresh');
    if (btnRealRefresh) {
      btnRealRefresh.addEventListener('click', fetchReal);
    }
  }

  function syncControls() {
    const nEl = $('#hm-n'); if (nEl) nEl.value = state.n;
    const nvEl = $('#hm-n-v'); if (nvEl) nvEl.textContent = (+state.n).toFixed(1);
    const thrEl = $('#hm-thr'); if (thrEl) thrEl.value = String(state.thr);
    const srcEl = $('#hm-src'); if (srcEl) srcEl.value = state.source;
    ['heat', 'cover', 'labels', 'grid'].forEach((k) => {
      const chk = $(`#hm-show-${k}`);
      if (chk) chk.checked = !!state.show[k];
    });
  }

  async function fetchReal() {
    const el = $('#hm-real');
    if (!el) return;
    try {
      const r = await fetch('/api/scan');
      const data = await r.json();
      const w = data.interface || {};
      if (!w.ssid) {
        el.innerHTML = '<p style="color:#64748b;">Máy tính trạm hiện chưa kết nối đến mạng Wi-Fi nào.</p>';
        return;
      }
      const rssiVal = w.rssi || -60;
      const q = quality(rssiVal);
      el.innerHTML = `
        <div style="display:flex; align-items:baseline; gap:6px;">
          <span style="font-size:1.6rem; font-weight:700; color:#0f172a;">${rssiVal}</span>
          <span style="font-size:0.8rem; color:#64748b;">dBm</span>
          <span style="margin-left:auto; border-radius:999px; padding:2px 8px; font-size:0.7rem; font-weight:700; background:${hexA(q.color, 0.14)}; color:${q.color}">${q.label}</span>
        </div>
        <p style="margin-top:6px; font-size:0.8rem; color:#334155; font-weight:600;">
          SSID: <b>${esc(w.ssid)}</b> | Dải tần: <b>${esc(w.band || '5 GHz')}</b> | Kênh: <b>${w.channel || '?'}</b> | Tín hiệu: <b>${w.signal || 90}%</b>
        </p>
        <p style="margin-top:6px; font-size:0.74rem; color:#64748b; line-height:1.4;">
          Mẹo chuẩn đoán: Đặt một thiết bị Laptop hoặc PC lên mặt bằng tại đúng vị trí bạn đang ngồi và đối sánh mức sóng mô phỏng với chỉ số thực tế ở trên để hiệu chỉnh hệ số suy hao n.
        </p>`;
    } catch (err) {
      el.innerHTML = '<p style="color:#64748b;">Đang đọc thông số card mạng Wi-Fi...</p>';
    }
  }

  function renderMarkup() {
    const sec = $('#view-heatmap');
    if (!sec) return;
    sec.innerHTML = `
      <div style="display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:12px; margin-bottom:16px;">
        <div>
          <h3 id="hm-title" style="font-size:1.15rem; font-weight:700; color:#0f172a;">Bản Đồ Nhiệt Mô Phỏng Sóng Vô Tuyến Raytracing</h3>
          <p style="font-size:0.82rem; color:#64748b; margin-top:2px;">Vẽ tường, cửa, đặt bộ phát sóng và thiết bị người dùng để phân tích chính xác mức suy hao vật lý và diện tích phủ sóng.</p>
        </div>
        <div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px;">
          <button id="hm-sample" type="button" class="btn btn-secondary btn-sm" style="font-size:0.78rem;">Nạp mặt bằng văn phòng mẫu</button>
          <button id="hm-export" type="button" class="btn btn-secondary btn-sm" style="font-size:0.78rem;">Xuất ảnh sơ đồ PNG</button>
          <button id="hm-clear" type="button" class="btn btn-secondary btn-sm" style="font-size:0.78rem; color:#dc2626; border-color:#fecaca;">Xóa sạch mặt bằng</button>
        </div>
      </div>

      <div class="hm-layout">
        <!-- CỘT TRÁI: CÔNG CỤ & THAM SỐ -->
        <aside>
          <div class="hm-card">
            <div class="hm-card-title">Hộp công cụ thao tác</div>
            <div id="hm-tools"></div>
          </div>

          <div class="hm-card">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
              <div class="hm-card-title" style="margin-bottom:0;">Vật liệu tường và cửa</div>
              <span style="font-size:0.7rem; color:#64748b;">Suy hao 2.4/5GHz</span>
            </div>
            <div id="hm-materials"></div>
          </div>

          <div class="hm-card">
            <div class="hm-card-title">Tham số suy hao & Hiển thị</div>
            <label class="hm-label" for="hm-n">Hệ số suy hao môi trường (n): <span id="hm-n-v" style="font-weight:700; color:#0284c7;">3.0</span></label>
            <input id="hm-n" type="range" min="2" max="4" step="0.1" value="3" style="width:100%; accent-color:#0284c7;" />

            <label class="hm-label" for="hm-thr">Ngưỡng phủ sóng hiệu dụng</label>
            <select id="hm-thr" class="hm-input">
              <option value="-65">-65 dBm (Xuất sắc - Chuẩn VoWiFi/Video HD)</option>
              <option value="-67" selected>-67 dBm (Tốt - Văn phòng tiêu chuẩn)</option>
              <option value="-70">-70 dBm (Khá - Dữ liệu ổn định)</option>
              <option value="-75">-75 dBm (Trung bình - Mức sàn duyệt web)</option>
              <option value="-80">-80 dBm (Rìa sóng - Dễ gián đoạn)</option>
            </select>

            <label class="hm-label" for="hm-src">Nguồn hiển thị bản đồ nhiệt</label>
            <select id="hm-src" class="hm-input">
              <option value="all" selected>Tất cả bộ phát AP (Tín hiệu mạnh nhất)</option>
              <option value="selected">Chỉ hiển thị bộ phát AP đang chọn</option>
            </select>

            <div style="margin-top:12px; display:grid; gap:6px; font-size:0.78rem; color:#334155;">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;"><input id="hm-show-heat" type="checkbox" checked style="accent-color:#0284c7;" /> Hiển thị dải màu bản đồ nhiệt</label>
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;"><input id="hm-show-cover" type="checkbox" checked style="accent-color:#0284c7;" /> Vùng phủ sóng (Bán kính thực tế & suy hao)</label>
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;"><input id="hm-show-labels" type="checkbox" checked style="accent-color:#0284c7;" /> Nhãn tên và mức suy hao từng bức tường</label>
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;"><input id="hm-show-grid" type="checkbox" checked style="accent-color:#0284c7;" /> Lưới tọa độ tỉ lệ thực</label>
            </div>
          </div>
        </aside>

        <!-- CỘT GIỮA: KHUNG CANVAS BẢN ĐỒ NHIỆT -->
        <div class="hm-card" style="padding:12px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; font-size:0.76rem; color:#64748b;">
            <span id="hm-hint" style="font-weight:500;">Bấm chuột để chọn hoặc vẽ đối tượng.</span>
            <span id="hm-coords" style="font-family:monospace; color:#0f172a; font-weight:600;">--</span>
          </div>

          <canvas id="hm-canvas" width="1200" height="720"></canvas>

          <div style="margin-top:12px; display:flex; flex-wrap:wrap; align-items:center; gap:12px;">
            <span style="font-size:0.76rem; font-weight:600; color:#334155;">Cường độ:</span>
            <div style="flex:1; min-width:220px;">
              <div class="hm-legend-bar"></div>
              <div style="margin-top:3px; display:flex; justify-content:space-between; font-family:monospace; font-size:0.68rem; color:#64748b;">
                <span>-90 dBm</span><span>-80</span><span>-70</span><span>-60</span><span>-50</span><span>-40</span><span>-30 dBm</span>
              </div>
            </div>
            <span style="font-size:0.7rem; color:#64748b;">Màu xám sẫm = dưới -90 dBm (Khu vực mất sóng hoàn toàn)</span>
          </div>
        </div>

        <!-- CỘT PHẢI: BẢNG THÔNG SỐ VÀ LIÊN KẾT THỰC TẾ -->
        <aside>
          <div class="hm-card">
            <div class="hm-card-title">Đối tượng đang chọn</div>
            <div id="hm-props"></div>
          </div>

          <div class="hm-card">
            <div class="hm-card-title">Trạng thái thiết bị người dùng</div>
            <div id="hm-devices" style="display:grid; gap:8px;"></div>
          </div>

          <div class="hm-card">
            <div class="hm-card-title">Phạm vi phủ sóng các bộ phát</div>
            <div id="hm-aps" style="display:grid; gap:8px;"></div>
          </div>

          <div class="hm-card">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
              <div class="hm-card-title" style="margin-bottom:0;">Tín hiệu Card Wi-Fi thực tế</div>
              <button id="hm-real-refresh" type="button" class="btn btn-secondary btn-sm" style="font-size:0.7rem; padding:3px 8px;">Làm mới</button>
            </div>
            <div id="hm-real" style="font-size:0.78rem; color:#64748b;">Đang đọc thông số...</div>
          </div>
        </aside>
      </div>
    `;

    cv = $('#hm-canvas');
    if (cv) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.style.aspectRatio = `${W} / ${H}`;
      ctx = cv.getContext('2d');
    }

    off = document.createElement('canvas');
    off.width = COLS; off.height = ROWS;
    offCtx = off.getContext('2d');
    img = offCtx.createImageData(COLS, ROWS);
  }

  function init() {
    renderMarkup();
    if (!load()) loadSample();
    syncControls();
    renderTools();
    renderProps();
    setupEvents();
    dirtyGeo();
    fetchReal();
  }

  window.initInvasionoHeatmap = init;
  window.refreshInvasionoHeatmap = () => {
    if (!cv) init();
    else {
      dirtyGeo();
      fetchReal();
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(init, 100);
  });
})();
