// ==UserScript==
// @name         Shopee Checkout Automator
// @namespace    https://shopee.ph/
// @version      1.0.0
// @description  Automates Shopee checkout: address selection, payment method, vouchers, and order placement
// @author       mhcreatives
// @match        https://shopee.ph/checkout
// @match        https://shopee.ph/checkout*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ─── Config helpers ───────────────────────────────────────────────────────
  const cfg = {
    get: (key, fallback) => {
      try { return JSON.parse(GM_getValue(key, JSON.stringify(fallback))); }
      catch { return fallback; }
    },
    set: (key, val) => GM_setValue(key, JSON.stringify(val)),
  };

  const DEFAULTS = {
    autoAddress: false,
    addressKeyword: '',       // partial match against address text
    autoPayment: false,
    paymentKeyword: '',       // e.g. "GCash", "COD", "ShopeePay"
    autoVoucher: false,
    voucherCode: '',
    autoPlace: false,
    autoPlaceDelay: 5,        // seconds countdown before placing order
    panelVisible: true,
  };

  function loadSettings() {
    return Object.fromEntries(
      Object.entries(DEFAULTS).map(([k, v]) => [k, cfg.get(k, v)])
    );
  }

  function saveSettings(settings) {
    Object.entries(settings).forEach(([k, v]) => cfg.set(k, v));
  }

  // ─── Utility ──────────────────────────────────────────────────────────────
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function waitFor(selector, root = document, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = root.querySelector(selector);
      if (el) return el;
      await sleep(200);
    }
    return null;
  }

  async function waitForAll(selector, root = document, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const els = root.querySelectorAll(selector);
      if (els.length) return Array.from(els);
      await sleep(200);
    }
    return [];
  }

  function click(el) {
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.click();
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }

  function simulateInput(input, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    nativeInputValueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function log(msg, type = 'info') {
    const colors = { info: '#2196f3', success: '#4caf50', warn: '#ff9800', error: '#f44336' };
    console.log(`%c[Shopee Auto] ${msg}`, `color:${colors[type]};font-weight:bold`);
  }

  // ─── Automation steps ─────────────────────────────────────────────────────
  async function autoSelectAddress(keyword) {
    if (!keyword) return log('No address keyword set, skipping.', 'warn');

    // Look for the address section change button
    const changeBtn = await waitFor(
      '[class*="address"] button, [class*="Address"] button, button[class*="change"]',
    );
    if (!changeBtn) return log('Address change button not found.', 'warn');

    click(changeBtn);
    await sleep(800);

    const addressItems = await waitForAll(
      '[class*="address-item"], [class*="AddressItem"], [class*="address_item"]'
    );

    if (!addressItems.length) return log('No address items found.', 'warn');

    const kw = keyword.toLowerCase();
    const target = addressItems.find(el => el.textContent.toLowerCase().includes(kw));
    if (!target) {
      log(`No address matching "${keyword}" found.`, 'warn');
      return;
    }

    click(target);
    await sleep(500);
    log(`Address selected: "${keyword}"`, 'success');
  }

  async function autoSelectPayment(keyword) {
    if (!keyword) return log('No payment keyword set, skipping.', 'warn');

    const kw = keyword.toLowerCase();
    const paymentOptions = await waitForAll(
      '[class*="payment"] [class*="option"], [class*="Payment"] [class*="option"], [class*="payment-method"]'
    );

    const target = paymentOptions.find(el => el.textContent.toLowerCase().includes(kw));
    if (!target) {
      log(`No payment method matching "${keyword}" found.`, 'warn');
      return;
    }

    click(target);
    await sleep(500);
    log(`Payment selected: "${keyword}"`, 'success');
  }

  async function autoApplyVoucher(code) {
    if (!code) return log('No voucher code set, skipping.', 'warn');

    // Click "Select Voucher" or similar
    const voucherBtn = await waitFor(
      '[class*="voucher"] button, button[class*="voucher"]'
    );
    if (voucherBtn) {
      click(voucherBtn);
      await sleep(800);
    }

    const voucherInput = await waitFor('input[placeholder*="voucher" i], input[placeholder*="code" i]');
    if (!voucherInput) return log('Voucher input not found.', 'warn');

    simulateInput(voucherInput, code);
    await sleep(300);

    const applyBtn = await waitFor('button[class*="apply" i], button[class*="Apply"]');
    if (!applyBtn) return log('Voucher apply button not found.', 'warn');

    click(applyBtn);
    await sleep(800);
    log(`Voucher applied: "${code}"`, 'success');
  }

  async function autoPlaceOrder(delaySecs) {
    for (let i = delaySecs; i > 0; i--) {
      updateStatus(`Placing order in ${i}s… (close panel to cancel)`, 'warn');
      await sleep(1000);
    }

    const placeBtn = await waitFor(
      'button[class*="place" i], button[class*="Place"], button[class*="order" i]:not([disabled])'
    );
    if (!placeBtn) return log('Place order button not found.', 'error');

    click(placeBtn);
    log('Order placed!', 'success');
    updateStatus('Order placed!', 'success');
  }

  // ─── UI ───────────────────────────────────────────────────────────────────
  GM_addStyle(`
    #sca-panel {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 320px;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      box-shadow: 0 4px 24px rgba(0,0,0,.15);
      font-family: 'Segoe UI', sans-serif;
      font-size: 13px;
      z-index: 99999;
      overflow: hidden;
      transition: height .2s;
    }
    #sca-header {
      background: #ee4d2d;
      color: #fff;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      user-select: none;
    }
    #sca-header span { font-weight: 600; font-size: 14px; }
    #sca-body { padding: 14px; max-height: 70vh; overflow-y: auto; }
    .sca-row { margin-bottom: 10px; }
    .sca-row label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 500; }
    .sca-row input[type=text] {
      width: 100%; margin-top: 4px; padding: 6px 8px;
      border: 1px solid #ddd; border-radius: 6px; font-size: 12px;
    }
    .sca-row input[type=range] { width: 100%; }
    #sca-run {
      width: 100%; padding: 9px; background: #ee4d2d; color: #fff;
      border: none; border-radius: 6px; font-size: 14px; font-weight: 600;
      cursor: pointer; margin-top: 6px;
    }
    #sca-run:hover { background: #d43f1f; }
    #sca-status {
      margin-top: 8px; padding: 6px 8px; border-radius: 6px;
      font-size: 12px; background: #f5f5f5; color: #555;
      min-height: 28px;
    }
    .sca-divider { border: none; border-top: 1px solid #f0f0f0; margin: 10px 0; }
    .sca-section-title { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
    .sca-toggle { position:relative; width:34px; height:18px; flex-shrink:0; }
    .sca-toggle input { opacity:0; width:0; height:0; }
    .sca-slider {
      position:absolute; inset:0; border-radius:18px; background:#ccc;
      cursor:pointer; transition:.2s;
    }
    .sca-slider:before {
      content:''; position:absolute; width:14px; height:14px;
      left:2px; bottom:2px; background:#fff; border-radius:50%; transition:.2s;
    }
    .sca-toggle input:checked + .sca-slider { background:#ee4d2d; }
    .sca-toggle input:checked + .sca-slider:before { transform:translateX(16px); }
  `);

  let panelEl, statusEl, settings;
  let running = false;

  function toggle(key, inputEl) {
    settings[key] = inputEl.checked;
    saveSettings(settings);
  }

  function updateStatus(msg, type = 'info') {
    if (!statusEl) return;
    const colors = { info: '#555', success: '#388e3c', warn: '#e65100', error: '#c62828' };
    statusEl.style.color = colors[type] || '#555';
    statusEl.textContent = msg;
  }

  function buildToggleRow(labelText, settingKey, subKey, subPlaceholder) {
    const row = document.createElement('div');
    row.className = 'sca-row';

    const lbl = document.createElement('label');
    const tog = document.createElement('label');
    tog.className = 'sca-toggle';
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.checked = settings[settingKey];
    const slider = document.createElement('span');
    slider.className = 'sca-slider';
    tog.append(inp, slider);

    lbl.append(tog, labelText);
    row.append(lbl);

    if (subKey) {
      const sub = document.createElement('input');
      sub.type = 'text';
      sub.placeholder = subPlaceholder || '';
      sub.value = settings[subKey] || '';
      sub.addEventListener('input', () => {
        settings[subKey] = sub.value;
        saveSettings(settings);
      });
      row.append(sub);

      inp.addEventListener('change', () => { toggle(settingKey, inp); sub.disabled = !inp.checked; });
      sub.disabled = !inp.checked;
    } else {
      inp.addEventListener('change', () => toggle(settingKey, inp));
    }

    return row;
  }

  function buildPanel() {
    settings = loadSettings();

    panelEl = document.createElement('div');
    panelEl.id = 'sca-panel';

    // Header
    const header = document.createElement('div');
    header.id = 'sca-header';
    header.innerHTML = '<span>🛒 Shopee Auto Checkout</span><span id="sca-chevron">▲</span>';
    let bodyVisible = settings.panelVisible !== false;

    const body = document.createElement('div');
    body.id = 'sca-body';

    header.addEventListener('click', () => {
      bodyVisible = !bodyVisible;
      body.style.display = bodyVisible ? '' : 'none';
      document.getElementById('sca-chevron').textContent = bodyVisible ? '▲' : '▼';
      settings.panelVisible = bodyVisible;
      saveSettings(settings);
    });

    if (!bodyVisible) body.style.display = 'none';

    // Address
    const addrTitle = document.createElement('p');
    addrTitle.className = 'sca-section-title';
    addrTitle.textContent = 'Shipping Address';
    body.append(addrTitle);
    body.append(buildToggleRow('Auto-select address', 'autoAddress', 'addressKeyword', 'Address keyword (e.g. "Makati")'));

    body.append(Object.assign(document.createElement('hr'), { className: 'sca-divider' }));

    // Payment
    const payTitle = document.createElement('p');
    payTitle.className = 'sca-section-title';
    payTitle.textContent = 'Payment Method';
    body.append(payTitle);
    body.append(buildToggleRow('Auto-select payment', 'autoPayment', 'paymentKeyword', 'Payment keyword (e.g. "GCash", "COD")'));

    body.append(Object.assign(document.createElement('hr'), { className: 'sca-divider' }));

    // Voucher
    const voucherTitle = document.createElement('p');
    voucherTitle.className = 'sca-section-title';
    voucherTitle.textContent = 'Voucher / Promo Code';
    body.append(voucherTitle);
    body.append(buildToggleRow('Auto-apply voucher', 'autoVoucher', 'voucherCode', 'Voucher code'));

    body.append(Object.assign(document.createElement('hr'), { className: 'sca-divider' }));

    // Auto place order
    const orderTitle = document.createElement('p');
    orderTitle.className = 'sca-section-title';
    orderTitle.textContent = 'Place Order';
    body.append(orderTitle);

    const placeRow = buildToggleRow('Auto-place order (with countdown)', 'autoPlace', null, null);
    body.append(placeRow);

    const delayRow = document.createElement('div');
    delayRow.className = 'sca-row';
    const delayLabel = document.createElement('label');
    delayLabel.style.justifyContent = 'space-between';
    const delaySpan = document.createElement('span');
    delaySpan.textContent = `Countdown: ${settings.autoPlaceDelay}s`;
    const delayRange = document.createElement('input');
    delayRange.type = 'range';
    delayRange.min = 0;
    delayRange.max = 30;
    delayRange.value = settings.autoPlaceDelay;
    delayRange.addEventListener('input', () => {
      settings.autoPlaceDelay = parseInt(delayRange.value);
      delaySpan.textContent = `Countdown: ${settings.autoPlaceDelay}s`;
      saveSettings(settings);
    });
    delayLabel.append(delaySpan);
    delayRow.append(delayLabel, delayRange);
    body.append(delayRow);

    // Run button
    const runBtn = document.createElement('button');
    runBtn.id = 'sca-run';
    runBtn.textContent = '▶ Run Automation';
    runBtn.addEventListener('click', runAutomation);
    body.append(runBtn);

    // Status
    statusEl = document.createElement('div');
    statusEl.id = 'sca-status';
    statusEl.textContent = 'Ready. Configure options above and click Run.';
    body.append(statusEl);

    panelEl.append(header, body);
    document.body.appendChild(panelEl);
  }

  async function runAutomation() {
    if (running) return;
    running = true;
    settings = loadSettings();

    const runBtn = document.getElementById('sca-run');
    runBtn.disabled = true;
    runBtn.textContent = '⏳ Running…';

    try {
      updateStatus('Starting automation…');
      await sleep(500);

      if (settings.autoAddress) {
        updateStatus('Selecting address…');
        await autoSelectAddress(settings.addressKeyword);
        await sleep(600);
      }

      if (settings.autoPayment) {
        updateStatus('Selecting payment method…');
        await autoSelectPayment(settings.paymentKeyword);
        await sleep(600);
      }

      if (settings.autoVoucher) {
        updateStatus('Applying voucher…');
        await autoApplyVoucher(settings.voucherCode);
        await sleep(600);
      }

      if (settings.autoPlace) {
        await autoPlaceOrder(settings.autoPlaceDelay);
      } else {
        updateStatus('Done! Review your order and place it manually.', 'success');
      }
    } catch (err) {
      log('Automation error: ' + err.message, 'error');
      updateStatus('Error: ' + err.message, 'error');
    } finally {
      running = false;
      runBtn.disabled = false;
      runBtn.textContent = '▶ Run Automation';
    }
  }

  // Wait for page to be ready before injecting panel
  async function init() {
    await waitFor('[class*="checkout"], [class*="Checkout"]', document, 15000);
    await sleep(1000);
    buildPanel();
    log('Shopee Checkout Automator loaded.', 'success');
  }

  init();
})();
