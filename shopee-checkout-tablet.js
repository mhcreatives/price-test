(function () {
  'use strict';

  if (document.getElementById('sca-panel')) {
    document.getElementById('sca-panel').style.display = '';
    return;
  }

  const SK = 'shopee_auto_cfg';
  const DEF = {
    autoAddress: false, addressKeyword: '',
    autoPayment: false, paymentKeyword: '',
    autoVoucher: false, voucherCode: '',
    autoPlace: false, autoPlaceDelay: 5,
  };

  function load() {
    try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(SK) || '{}')); }
    catch (e) { return Object.assign({}, DEF); }
  }
  function save(s) { localStorage.setItem(SK, JSON.stringify(s)); }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function waitFor(sel, root, t) {
    root = root || document; t = t || 10000;
    const s = Date.now();
    while (Date.now() - s < t) {
      const e = root.querySelector(sel);
      if (e) return e;
      await sleep(200);
    }
    return null;
  }

  async function waitAll(sel, root, t) {
    root = root || document; t = t || 10000;
    const s = Date.now();
    while (Date.now() - s < t) {
      const els = root.querySelectorAll(sel);
      if (els.length) return [...els];
      await sleep(200);
    }
    return [];
  }

  function clk(e) {
    ['mouseover', 'mousedown'].forEach(ev => e.dispatchEvent(new MouseEvent(ev, { bubbles: true })));
    e.click();
    e.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }

  function setVal(inp, v) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, v);
    ['input', 'change'].forEach(ev => inp.dispatchEvent(new Event(ev, { bubbles: true })));
  }

  function injectStyles() {
    if (document.getElementById('sca-styles')) return;
    const st = document.createElement('style');
    st.id = 'sca-styles';
    st.textContent = `
      #sca-panel{position:fixed;bottom:20px;right:16px;width:310px;background:#fff;border:1px solid #e0e0e0;
        border-radius:12px;box-shadow:0 6px 28px rgba(0,0,0,.18);font-family:sans-serif;font-size:13px;
        z-index:2147483647;overflow:hidden}
      #sca-hdr{background:#ee4d2d;color:#fff;padding:12px 14px;display:flex;align-items:center;
        justify-content:space-between;cursor:pointer;user-select:none;-webkit-user-select:none}
      #sca-hdr span{font-weight:700;font-size:14px}
      #sca-body{padding:14px;max-height:75vh;overflow-y:auto;-webkit-overflow-scrolling:touch}
      .sca-row{margin-bottom:10px}
      .sca-lbl{display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:500;font-size:13px}
      .sca-inp{width:100%;margin-top:5px;padding:8px 10px;border:1px solid #ddd;border-radius:7px;
        font-size:13px;-webkit-appearance:none;appearance:none}
      .sca-range{width:100%;margin-top:4px;accent-color:#ee4d2d}
      #sca-run{width:100%;padding:11px;background:#ee4d2d;color:#fff;border:none;border-radius:8px;
        font-size:15px;font-weight:700;cursor:pointer;margin-top:6px;-webkit-tap-highlight-color:transparent}
      #sca-run:active{background:#d43f1f}
      #sca-status{margin-top:8px;padding:8px 10px;border-radius:7px;font-size:12px;
        background:#f5f5f5;color:#555;min-height:30px;line-height:1.4}
      .sca-div{border:none;border-top:1px solid #f0f0f0;margin:10px 0}
      .sca-sec{font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
      .sca-tog{position:relative;width:38px;height:22px;flex-shrink:0}
      .sca-tog input{opacity:0;width:0;height:0}
      .sca-sl{position:absolute;inset:0;border-radius:22px;background:#ccc;cursor:pointer;transition:.2s}
      .sca-sl:before{content:'';position:absolute;width:16px;height:16px;left:3px;bottom:3px;
        background:#fff;border-radius:50%;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
      .sca-tog input:checked+.sca-sl{background:#ee4d2d}
      .sca-tog input:checked+.sca-sl:before{transform:translateX(16px)}
    `;
    document.head.appendChild(st);
  }

  // ── Automation steps ──────────────────────────────────────────────────────

  async function doAddress(kw) {
    if (!kw) return;
    const btn = await waitFor('[class*="address" i] button,[class*="Address"] button');
    if (!btn) return;
    clk(btn);
    await sleep(800);
    const items = await waitAll('[class*="address-item" i],[class*="AddressItem"],[class*="address_item" i]');
    const t = items.find(el => el.textContent.toLowerCase().includes(kw.toLowerCase()));
    if (t) { clk(t); await sleep(500); }
  }

  async function doPayment(kw) {
    if (!kw) return;
    const opts = await waitAll('[class*="payment" i] [class*="option" i],[class*="payment-method" i]');
    const t = opts.find(el => el.textContent.toLowerCase().includes(kw.toLowerCase()));
    if (t) { clk(t); await sleep(500); }
  }

  async function doVoucher(code) {
    if (!code) return;
    const btn = await waitFor('[class*="voucher" i] button');
    if (btn) { clk(btn); await sleep(800); }
    const inp = await waitFor('input[placeholder*="voucher" i],input[placeholder*="code" i]');
    if (!inp) return;
    setVal(inp, code);
    await sleep(300);
    const applyBtn = await waitFor('button[class*="apply" i]');
    if (applyBtn) { clk(applyBtn); await sleep(800); }
  }

  async function doPlace(secs, onTick) {
    for (let i = secs; i > 0; i--) {
      onTick(`Placing order in ${i}s… tap ✕ to cancel`);
      await sleep(1000);
    }
    const btn = await waitFor('button[class*="place" i],button[class*="Place"]');
    if (btn) clk(btn);
  }

  // ── Panel ─────────────────────────────────────────────────────────────────

  injectStyles();
  const cfg = load();

  const panel = document.createElement('div');
  panel.id = 'sca-panel';

  const hdr = document.createElement('div');
  hdr.id = 'sca-hdr';
  hdr.innerHTML = '<span>🛒 Shopee Auto Checkout</span><span id="sca-chv">▲</span>';

  const body = document.createElement('div');
  body.id = 'sca-body';

  let bodyOpen = true;
  hdr.addEventListener('click', () => {
    bodyOpen = !bodyOpen;
    body.style.display = bodyOpen ? '' : 'none';
    document.getElementById('sca-chv').textContent = bodyOpen ? '▲' : '▼';
  });

  function togRow(label, key, subKey, placeholder) {
    const row = document.createElement('div');
    row.className = 'sca-row';
    const lbl = document.createElement('label');
    lbl.className = 'sca-lbl';
    const tog = document.createElement('label');
    tog.className = 'sca-tog';
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.checked = !!cfg[key];
    const sl = document.createElement('span');
    sl.className = 'sca-sl';
    tog.append(inp, sl);
    lbl.append(tog, label);
    row.append(lbl);
    if (subKey) {
      const sub = document.createElement('input');
      sub.type = 'text';
      sub.className = 'sca-inp';
      sub.placeholder = placeholder || '';
      sub.value = cfg[subKey] || '';
      sub.addEventListener('input', () => { cfg[subKey] = sub.value; save(cfg); });
      sub.disabled = !inp.checked;
      inp.addEventListener('change', () => { cfg[key] = inp.checked; save(cfg); sub.disabled = !inp.checked; });
      row.append(sub);
    } else {
      inp.addEventListener('change', () => { cfg[key] = inp.checked; save(cfg); });
    }
    return row;
  }

  function sec(t) {
    const p = document.createElement('p');
    p.className = 'sca-sec';
    p.textContent = t;
    return p;
  }
  function hr() {
    const h = document.createElement('hr');
    h.className = 'sca-div';
    return h;
  }

  body.append(sec('Shipping Address'));
  body.append(togRow('Auto-select address', 'autoAddress', 'addressKeyword', 'Keyword (e.g. "Makati", "Home")'));
  body.append(hr());
  body.append(sec('Payment Method'));
  body.append(togRow('Auto-select payment', 'autoPayment', 'paymentKeyword', 'e.g. "GCash", "COD", "ShopeePay"'));
  body.append(hr());
  body.append(sec('Voucher / Promo Code'));
  body.append(togRow('Auto-apply voucher', 'autoVoucher', 'voucherCode', 'Enter voucher code'));
  body.append(hr());
  body.append(sec('Place Order'));
  body.append(togRow('Auto-place order (countdown)', 'autoPlace', null, null));

  const delayRow = document.createElement('div');
  delayRow.className = 'sca-row';
  const delayInfo = document.createElement('span');
  delayInfo.style.cssText = 'font-size:12px;color:#888;display:block;margin-bottom:2px';
  delayInfo.textContent = `Countdown: ${cfg.autoPlaceDelay}s`;
  const range = document.createElement('input');
  range.type = 'range';
  range.className = 'sca-range';
  range.min = 0; range.max = 30; range.value = cfg.autoPlaceDelay;
  range.addEventListener('input', () => {
    cfg.autoPlaceDelay = +range.value;
    delayInfo.textContent = `Countdown: ${cfg.autoPlaceDelay}s`;
    save(cfg);
  });
  delayRow.append(delayInfo, range);
  body.append(delayRow);

  const runBtn = document.createElement('button');
  runBtn.id = 'sca-run';
  runBtn.textContent = '▶  Run Automation';

  const status = document.createElement('div');
  status.id = 'sca-status';
  status.textContent = 'Ready. Configure above and tap Run.';

  body.append(runBtn, status);

  function setStatus(msg, color) {
    status.style.color = color || '#555';
    status.textContent = msg;
  }

  let running = false;
  runBtn.addEventListener('click', async () => {
    if (running) return;
    running = true;
    runBtn.disabled = true;
    runBtn.textContent = '⏳  Running…';
    const s = load();
    try {
      if (s.autoAddress) { setStatus('Selecting address…'); await doAddress(s.addressKeyword); }
      if (s.autoPayment) { setStatus('Selecting payment…'); await doPayment(s.paymentKeyword); }
      if (s.autoVoucher) { setStatus('Applying voucher…'); await doVoucher(s.voucherCode); }
      if (s.autoPlace) {
        await doPlace(s.autoPlaceDelay, msg => setStatus(msg, '#e65100'));
        setStatus('Order placed!', '#388e3c');
      } else {
        setStatus('Done! Review and place your order.', '#388e3c');
      }
    } catch (err) {
      setStatus('Error: ' + err.message, '#c62828');
    } finally {
      running = false;
      runBtn.disabled = false;
      runBtn.textContent = '▶  Run Automation';
    }
  });

  panel.append(hdr, body);
  document.body.appendChild(panel);
})();
