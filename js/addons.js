/* ==========================================================================
   AI Ad Studio TH — Vertical Sidebar Menu, Add-ons Hub & Unified Settings
   ========================================================================== */

export const STORAGE_CUSTOM_ADDONS = 'ai_ad_studio_th_custom_menu_addons';
export const STORAGE_ANIMATIONS_ENABLED = 'ai_ad_studio_th_animations_enabled';

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
  onExportCsv,
  onShowToast
}) {
  const menuBar = document.getElementById('studioMenuBar');
  const sidebarEl = document.getElementById('studioSidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const mobileToggleBtn = document.getElementById('mobileSidebarToggle');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');

  const customContainer = document.getElementById('customMenuSlots');
  const addonsPanel = document.getElementById('addonsDrawerPanel');
  const openAddonsBtn = document.getElementById('openAddonsHubBtn');
  const closeAddonsBtn = document.getElementById('closeAddonsHubBtn');
  const hooksGrid = document.getElementById('addonHooksGrid');

  const settingsPanel = document.getElementById('settingsPanelCard');
  const topbarSettingsBtn = document.getElementById('topbarSettingsBtn');
  const openSettingsPanelBtn = document.getElementById('openSettingsPanelBtn');
  const closeSettingsPanelBtn = document.getElementById('closeSettingsPanelBtn');

  if (!menuBar) return;

  // Mobile Off-Canvas Sidebar Helpers
  const openMobileSidebar = () => {
    sidebarEl?.classList.add('open');
    sidebarBackdrop?.classList.remove('hidden');
  };
  const closeMobileSidebar = () => {
    sidebarEl?.classList.remove('open');
    sidebarBackdrop?.classList.add('hidden');
  };

  mobileToggleBtn?.addEventListener('click', openMobileSidebar);
  sidebarCloseBtn?.addEventListener('click', closeMobileSidebar);
  sidebarBackdrop?.addEventListener('click', closeMobileSidebar);

  // Highlight active sidebar button
  const menuBtns = menuBar.querySelectorAll('[data-menu-tab], [data-menu-action]');
  const setActiveMenuBtn = (targetBtn) => {
    menuBtns.forEach((b) => b.classList.remove('active'));
    targetBtn?.classList.add('active');
  };

  function toggleSettingsPanel(forceState = null) {
    if (!settingsPanel) return;
    const isHidden = settingsPanel.classList.contains('hidden');
    const willOpen = forceState !== null ? forceState : isHidden;
    settingsPanel.classList.toggle('hidden', !willOpen);
    openSettingsPanelBtn?.classList.toggle('active', willOpen);
    topbarSettingsBtn?.classList.toggle('active', willOpen);
    if (willOpen) {
      addonsPanel?.classList.add('hidden');
      openAddonsBtn?.classList.remove('active');
      syncSettingsMirrorsFromPrimary();
      settingsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  menuBar.querySelectorAll('[data-menu-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.menuTab;
      setActiveMenuBtn(btn);
      onSwitchTab?.(tabId);
      closeMobileSidebar();
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
        closeMobileSidebar();
      } else if (action === 'toggle-settings') {
        setActiveMenuBtn(btn);
        toggleSettingsPanel();
        closeMobileSidebar();
      } else if (action === 'toggle-addons') {
        const isHidden = addonsPanel?.classList.contains('hidden');
        if (addonsPanel) {
          addonsPanel.classList.toggle('hidden', !isHidden);
          if (isHidden) {
            settingsPanel?.classList.add('hidden');
            openSettingsPanelBtn?.classList.remove('active');
            const subTab = btn.dataset.addonTab;
            if (subTab) activateAddonSubTab(subTab);
            setActiveMenuBtn(btn);
            addonsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            btn.classList.remove('active');
          }
        }
        closeMobileSidebar();
      }
    });
  });

  topbarSettingsBtn?.addEventListener('click', () => toggleSettingsPanel());
  closeSettingsPanelBtn?.addEventListener('click', () => toggleSettingsPanel(false));

  // Add-ons Hub Sub-Tabs
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
      settingsPanel?.classList.add('hidden');
      openSettingsPanelBtn?.classList.remove('active');
      activateAddonSubTab('hooks');
      addonsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    closeMobileSidebar();
  });

  closeAddonsBtn?.addEventListener('click', () => {
    addonsPanel?.classList.add('hidden');
    openAddonsBtn?.classList.remove('active');
  });

  // Add-on 1: Viral Thai Hooks Library
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

  // Add-on 2: Affiliate Commission & ROI Calculator
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

  // Add-on 3: Dynamic Custom Sidebar Menu Shortcuts
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
            class="side-nav-item menu-pill-custom"
            title="${item.url.replace(/"/g, '&quot;')}"
          >
            <span class="side-nav-icon">🔌</span>
            <span class="side-nav-label">${item.name.replace(/</g, '&lt;')}</span>
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
    onShowToast?.(`เพิ่มปุ่ม "${name}" บนแถบเมนูด้านข้างเรียบร้อยแล้ว!`, 'success');
  });

  persistAndRenderCustomAddons();

  // Unified Settings Panel Bidirectional Mirrors
  const primaryApiKey = document.getElementById('apiKeyInput');
  const settingsApiKey = document.getElementById('settingsApiKeyInput');
  const primaryModel = document.getElementById('modelSelect');
  const settingsModel = document.getElementById('settingsModelSelect');
  const primaryWebhook = document.getElementById('sheetWebhookInput');
  const settingsWebhook = document.getElementById('settingsWebhookInput');
  const primarySheetUrl = document.getElementById('sheetUrlInput');
  const settingsSheetUrl = document.getElementById('settingsSheetUrlInput');
  const primaryAutoSave = document.getElementById('autoSaveSheetToggle');
  const settingsAutoSave = document.getElementById('settingsAutoSaveToggle');
  const settingsAnimToggle = document.getElementById('settingsAnimationsToggle');
  const primaryLockToggle = document.getElementById('lockCharacterToggle');
  const settingsLockToggle = document.getElementById('settingsLockDefaultToggle');
  const settingsExportCsvBtn = document.getElementById('settingsExportCsvBtn');
  const settingsClearCacheBtn = document.getElementById('settingsClearCacheBtn');

  function syncSettingsMirrorsFromPrimary() {
    if (settingsApiKey && primaryApiKey) settingsApiKey.value = primaryApiKey.value;
    if (settingsModel && primaryModel) settingsModel.value = primaryModel.value;
    if (settingsWebhook && primaryWebhook) settingsWebhook.value = primaryWebhook.value;
    if (settingsSheetUrl && primarySheetUrl) settingsSheetUrl.value = primarySheetUrl.value;
    if (settingsAutoSave && primaryAutoSave) settingsAutoSave.checked = primaryAutoSave.checked;
    if (settingsLockToggle && primaryLockToggle) settingsLockToggle.checked = primaryLockToggle.checked;
  }

  settingsApiKey?.addEventListener('input', () => {
    if (primaryApiKey) {
      primaryApiKey.value = settingsApiKey.value;
      primaryApiKey.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  settingsModel?.addEventListener('change', () => {
    if (primaryModel) {
      primaryModel.value = settingsModel.value;
      primaryModel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  settingsWebhook?.addEventListener('input', () => {
    if (primaryWebhook) {
      primaryWebhook.value = settingsWebhook.value;
      primaryWebhook.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  settingsSheetUrl?.addEventListener('input', () => {
    if (primarySheetUrl) {
      primarySheetUrl.value = settingsSheetUrl.value;
      primarySheetUrl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  settingsAutoSave?.addEventListener('change', () => {
    if (primaryAutoSave) {
      primaryAutoSave.checked = settingsAutoSave.checked;
      primaryAutoSave.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  settingsLockToggle?.addEventListener('change', () => {
    if (primaryLockToggle) {
      primaryLockToggle.checked = settingsLockToggle.checked;
      primaryLockToggle.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Animation toggle persisted
  const savedAnim = localStorage.getItem(STORAGE_ANIMATIONS_ENABLED);
  const animOn = savedAnim === null ? true : savedAnim === 'true';
  document.body.classList.toggle('reduce-animations', !animOn);
  if (settingsAnimToggle) {
    settingsAnimToggle.checked = animOn;
    settingsAnimToggle.addEventListener('change', () => {
      const enabled = settingsAnimToggle.checked;
      localStorage.setItem(STORAGE_ANIMATIONS_ENABLED, String(enabled));
      document.body.classList.toggle('reduce-animations', !enabled);
      onShowToast?.(
        enabled ? 'เปิดแอนิเมชันนุ่มนวลแล้ว' : 'เปลี่ยนเป็นโหมดประหยัดแอนิเมชันแล้ว',
        'info'
      );
    });
  }

  settingsExportCsvBtn?.addEventListener('click', () => {
    onExportCsv?.();
  });

  settingsClearCacheBtn?.addEventListener('click', () => {
    const keysToClear = [
      'ai_ad_studio_th_drive_history',
      'ai_ad_studio_th_sheet_history'
    ];
    keysToClear.forEach((k) => localStorage.removeItem(k));
    onShowToast?.('ล้างประวัติที่จำไว้ในเบราว์เซอร์แล้ว (รีเฟรชเพื่ออัปเดตตัวนับ)', 'info');
  });

  syncSettingsMirrorsFromPrimary();
}
