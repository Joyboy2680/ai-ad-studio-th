/* ==========================================================================
   AI Ad Studio TH — Modular Menu Bar & Add-ons Registry
   Designed so extra features/plugins can be registered cleanly in HOOK_TEMPLATES
   or pinned dynamically by the user via custom menu shortcuts.
   ========================================================================== */

export const STORAGE_CUSTOM_ADDONS = 'ai_ad_studio_th_custom_menu_addons';

export const HOOK_TEMPLATES = [
  {
    tag: 'หยุดนิ้ว 0–2 วิ',
    text: 'หยุดเลื่อนก่อน! ใครเจอปัญหานี้ทุกวันบ้าง บอกเลยตัวนี้จบจริง!'
  },
  {
    tag: 'รีวิว POV ใช้จริง',
    text: 'ใช้มาครบ 7 วันแบบไม่คาดหวัง แต่ผลลัพธ์คือจึ้งเกินราคาไปมาก!'
  },
  {
    tag: 'จับผิด / เทียบชัดๆ',
    text: 'ทำไมอันเก่าถึงพังไว? ดูความต่างของตัวนี้กับของทั่วไปแบบชัดๆ 3 วินาที'
  },
  {
    tag: 'คุ้มค่า / ปิดตะกร้า',
    text: 'โปรรอบนี้ลดแรงมาก เฉลี่ยแค่วันละไม่กี่บาท กดดูตะกร้าซ้ายล่างก่อนของหมด!'
  }
];

export function initMenuBarAndAddons({
  onSwitchTab,
  onOpenSheetDrawer,
  onApplyHookText,
  onShowToast
}) {
  const menuBar = document.getElementById('studioMenuBar');
  const customContainer = document.getElementById('customMenuSlots');
  const addonsPanel = document.getElementById('addonsDrawerPanel');
  const openAddonsBtn = document.getElementById('openAddonsHubBtn');
  const closeAddonsBtn = document.getElementById('closeAddonsHubBtn');
  const hooksGrid = document.getElementById('addonHooksGrid');

  if (!menuBar) return;

  // 1) Highlight & route built-in workspace quick-jump menu items
  const menuBtns = menuBar.querySelectorAll('[data-menu-tab], [data-menu-action]');
  const setActiveMenuBtn = (targetBtn) => {
    menuBtns.forEach((b) => b.classList.remove('active'));
    targetBtn?.classList.add('active');
  };

  menuBar.querySelectorAll('[data-menu-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.menuTab;
      setActiveMenuBtn(btn);
      onSwitchTab?.(tabId);
      document
        .querySelector('.panel-right')
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  menuBar.querySelectorAll('[data-menu-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.menuAction;
      if (action === 'toggle-sheet') {
        setActiveMenuBtn(btn);
        onOpenSheetDrawer?.();
      } else if (action === 'toggle-addons') {
        const isHidden = addonsPanel?.classList.contains('hidden');
        if (addonsPanel) {
          addonsPanel.classList.toggle('hidden', !isHidden);
          if (isHidden) {
            const subTab = btn.dataset.addonTab;
            if (subTab) activateAddonSubTab(subTab);
            setActiveMenuBtn(btn);
            addonsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            btn.classList.remove('active');
          }
        }
      }
    });
  });

  // 2) Add-ons Hub Sub-Tabs (Hook Library | ROI Calculator | Custom Menu Slot Manager)
  const addonTabBtns = document.querySelectorAll('[data-addon-panel]');
  const addonPanels = document.querySelectorAll('.addon-subpanel');

  function activateAddonSubTab(panelId) {
    addonTabBtns.forEach((b) =>
      b.classList.toggle('active', b.dataset.addonPanel === panelId)
    );
    addonPanels.forEach((p) =>
      p.classList.toggle('active', p.id === `addonPanel-${panelId}`)
    );
  }

  addonTabBtns.forEach((btn) => {
    btn.addEventListener('click', () => activateAddonSubTab(btn.dataset.addonPanel));
  });

  openAddonsBtn?.addEventListener('click', () => {
    if (!addonsPanel) return;
    const willOpen = addonsPanel.classList.contains('hidden');
    addonsPanel.classList.toggle('hidden', !willOpen);
    openAddonsBtn.classList.toggle('active', willOpen);
    if (willOpen) {
      activateAddonSubTab('hooks');
      addonsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  closeAddonsBtn?.addEventListener('click', () => {
    addonsPanel?.classList.add('hidden');
    openAddonsBtn?.classList.remove('active');
  });

  // 3) Add-on Tool 1: Viral Thai Hooks Library
  if (hooksGrid) {
    hooksGrid.innerHTML = HOOK_TEMPLATES.map(
      (h, idx) => `
      <div class="addon-hook-card">
        <span class="tech-pill">${h.tag}</span>
        <p class="addon-hook-text">“${h.text}”</p>
        <div class="addon-hook-actions">
          <button type="button" class="btn-copy-sm" data-hook-apply="${idx}">แทรกใส่จุดเด่นสินค้า</button>
          <button type="button" class="btn-copy-sm" data-hook-copy="${idx}">คัดลอก</button>
        </div>
      </div>
    `
    ).join('');

    hooksGrid.querySelectorAll('[data-hook-apply]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = HOOK_TEMPLATES[Number(btn.dataset.hookApply)];
        if (item) {
          onApplyHookText?.(item.text);
          onShowToast?.('เพิ่ม Hook ลงในจุดเด่นสินค้าแล้ว!', 'success');
        }
      });
    });

    hooksGrid.querySelectorAll('[data-hook-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const item = HOOK_TEMPLATES[Number(btn.dataset.hookCopy)];
        if (!item) return;
        try {
          await navigator.clipboard.writeText(item.text);
        } catch {}
        onShowToast?.('คัดลอกข้อความ Hook แล้ว!', 'success');
      });
    });
  }

  // 4) Add-on Tool 2: Affiliate Commission & ROI Calculator
  const roiPrice = document.getElementById('roiPriceInput');
  const roiRate = document.getElementById('roiRateInput');
  const roiOrders = document.getElementById('roiOrdersInput');
  const roiPerOrderOut = document.getElementById('roiPerOrderOut');
  const roiDailyOut = document.getElementById('roiDailyOut');
  const roiMonthlyOut = document.getElementById('roiMonthlyOut');

  function recalcRoi() {
    const p = Math.max(0, Number(roiPrice?.value || 0));
    const r = Math.max(0, Number(roiRate?.value || 0));
    const o = Math.max(0, Number(roiOrders?.value || 0));
    const perOrder = p * (r / 100);
    const daily = perOrder * o;
    const monthly = daily * 30;
    const fmt = (n) =>
      new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Math.round(n));
    if (roiPerOrderOut) roiPerOrderOut.textContent = `฿${fmt(perOrder)} / ชิ้น`;
    if (roiDailyOut) roiDailyOut.textContent = `฿${fmt(daily)} / วัน`;
    if (roiMonthlyOut) roiMonthlyOut.textContent = `฿${fmt(monthly)} / เดือน`;
  }

  [roiPrice, roiRate, roiOrders].forEach((inp) => {
    inp?.addEventListener('input', recalcRoi);
  });
  recalcRoi();

  // 5) Add-on Tool 3: Dynamic Custom Menu Shortcuts (user-extensible slots)
  let customAddons = [];
  try {
    customAddons = JSON.parse(localStorage.getItem(STORAGE_CUSTOM_ADDONS) || '[]');
  } catch {
    customAddons = [];
  }

  const customNameInput = document.getElementById('customAddonNameInput');
  const customUrlInput = document.getElementById('customAddonUrlInput');
  const customAddBtn = document.getElementById('customAddonAddBtn');
  const customManageList = document.getElementById('customAddonManageList');

  function persistAndRenderCustomAddons() {
    localStorage.setItem(STORAGE_CUSTOM_ADDONS, JSON.stringify(customAddons));

    if (customContainer) {
      customContainer.innerHTML = customAddons
        .map(
          (item) => `
          <a
            href="${item.url.replace(/"/g, '&quot;')}"
            target="_blank"
            rel="noopener noreferrer"
            class="menu-pill menu-pill-custom"
            title="${item.url.replace(/"/g, '&quot;')}"
          >
            <span>🔌 ${item.name.replace(/</g, '&lt;')}</span>
          </a>
        `
        )
        .join('');
    }

    if (customManageList) {
      customManageList.innerHTML = customAddons.length
        ? customAddons
            .map(
              (item, idx) => `
            <div class="drive-history-item">
              <span>🔌 <strong>${item.name.replace(/</g, '&lt;')}</strong> — <code>${item.url.replace(/</g, '&lt;')}</code></span>
              <button type="button" class="btn-copy-sm" data-del-addon="${idx}">ลบ</button>
            </div>
          `
            )
            .join('')
        : '<div class="field-hint">ยังไม่มีเมนูลัดที่เพิ่มเอง — เพิ่มลิงก์เครื่องมือเสริม (เช่น CapCut, Shopee Seller, Google Trends) ด้านบนได้เลย</div>';

      customManageList.querySelectorAll('[data-del-addon]').forEach((btn) => {
        btn.addEventListener('click', () => {
          customAddons.splice(Number(btn.dataset.delAddon), 1);
          persistAndRenderCustomAddons();
          onShowToast?.('ลบเมนูลัดฟังก์ชันเสริมแล้ว', 'info');
        });
      });
    }
  }

  customAddBtn?.addEventListener('click', () => {
    const name = (customNameInput?.value || '').trim();
    let url = (customUrlInput?.value || '').trim();
    if (!name || !url) {
      onShowToast?.('กรุณาใส่ชื่อปุ่มเมนู และลิงก์ URL ของฟังก์ชันเสริม', 'warn');
      return;
    }
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/') && !url.startsWith('./')) {
      url = `https://${url}`;
    }
    customAddons.push({ name: name.slice(0, 28), url });
    if (customNameInput) customNameInput.value = '';
    if (customUrlInput) customUrlInput.value = '';
    persistAndRenderCustomAddons();
    onShowToast?.(`เพิ่มปุ่ม "${name}" บนแถบเมนูเรียบร้อยแล้ว!`, 'success');
  });

  persistAndRenderCustomAddons();
}
