/* ==========================================================================
   AI Ad Studio TH — SPA Page Router, Vertical Sidebar, Add-ons & Settings
   Home page = สตูดิโอผลลัพธ์พร้อมใช้งาน (#studio)
   Every other sidebar function switches cleanly to its own dedicated page.
   ========================================================================== */

export const STORAGE_CUSTOM_ADDONS = 'ai_ad_studio_th_custom_menu_addons';
export const STORAGE_ANIMATIONS_ENABLED = 'ai_ad_studio_th_animations_enabled';
export const STORAGE_THEME = 'ai_ad_studio_th_theme';

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

const PAGE_META = {
  input: {
    title: 'AI Auto-Fill จากลิงก์ & ข้อมูลสินค้า',
    badge: 'ขั้นที่ 1',
    sub: 'วางลิงก์ดึงรูปสินค้าหลายมุม • อัปโหลด Ingredient 1+2 • เลือกโหมด Google Flow & แนวคลิป 10 วิ'
  },
  studio: {
    title: 'สตูดิโอผลลัพธ์พร้อมใช้งาน',
    badge: 'หน้าหลัก',
    sub: 'สไลด์คลิป 10 วิ • พรอมภาพนิ่ง Imagen • แคปชั่น & # • ไทม์ไลน์ • ภาพ UGC 4 ช่อง'
  },
  'ugc-grid': {
    title: 'สร้างภาพสินค้า UGC ตาราง 4 ช่อง (1:1)',
    badge: 'UGC 1:1',
    sub: 'สร้าง Prompt ภาพรีวิวไม่มีเส้นคั่น → เปิดเว็บ Gemini สร้างรูป → นำรูปกลับมาส่งเข้า Drive'
  },
  imagen: {
    title: 'พรอมภาพนิ่งโฆษณา Imagen (3 ช็อต)',
    badge: 'Imagen 3',
    sub: 'ชุดพรอมภาพนิ่งขายสินค้าคมชัด พร้อมคัดลอกใช้งานได้ทันที'
  },
  captions: {
    title: 'แคปชั่นขายของ & แฮชแท็กพร้อมโพสต์',
    badge: 'Captions & #',
    sub: 'แคปชั่นแยกแพลตฟอร์ม TikTok / Reels / Facebook พร้อมแฮชแท็กขายดี'
  },
  sheet: {
    title: 'บันทึกประวัติข้อมูลลง Google Sheet',
    badge: 'Google Sheet',
    sub: 'ซิงก์ข้อมูลสินค้า & พรอมครบ 18 คอลัมน์ลง Google Sheet อัตโนมัติ หรือ Export .CSV'
  },
  hooks: {
    title: 'คลัง Hook & CTA หยุดนิ้ว 3 วินาที',
    badge: 'Add-on',
    sub: 'เลือกประโยคเปิดคลิปไวรัลแล้วกดแทรกเข้าจุดเด่นสินค้าได้ในคลิกเดียว'
  },
  roi: {
    title: 'คำนวณค่าคอมมิชชั่น & ROI นายหน้า',
    badge: 'Add-on',
    sub: 'ประเมินรายได้ต่อชิ้น ต่อวัน และต่อเดือนจากราคาสินค้าและค่าคอมมิชชั่น'
  },
  custom: {
    title: 'จัดการฟังก์ชันเสริม & ปุ่มเมนูลัด',
    badge: 'ส่วนขยาย +',
    sub: 'เพิ่มลิงก์เครื่องมือเสริมที่ใช้งานประจำขึ้นบนแถบเมนูด้านข้าง'
  },
  settings: {
    title: 'ตั้งค่าสตูดิโอ & การเชื่อมต่อทั้งหมด',
    badge: 'Settings',
    sub: 'จัดการ Gemini API Key, โมเดลหลัก, Google Drive / Sheet และโหมดแอนิเมชัน'
  }
};

export function initMenuBarAndAddons({
  onSwitchTab,
  onApplyHookText,
  onExportCsv,
  onShowToast
}) {
  const menuBar = document.getElementById('studioMenuBar');
  const sidebarEl = document.getElementById('studioSidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const mobileToggleBtn = document.getElementById('mobileSidebarToggle');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');

  const studioGrid = document.getElementById('studioGrid');
  const sheetConfigDrawer = document.getElementById('sheetConfigDrawer');
  const addonsPanel = document.getElementById('addonsDrawerPanel');
  const settingsPanel = document.getElementById('settingsPanelCard');
  const hooksGrid = document.getElementById('addonHooksGrid');

  const backToHomeBtn = document.getElementById('backToHomeBtn');
  const goToInputPageBtn = document.getElementById('goToInputPageBtn');
  const topbarSettingsBtn = document.getElementById('topbarSettingsBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeToggleIcon = document.getElementById('themeToggleIcon');
  const themeToggleText = document.getElementById('themeToggleText');
  const workflowStepper = document.getElementById('workflowStepper');
  const closeSettingsPanelBtn = document.getElementById('closeSettingsPanelBtn');
  const closeAddonsHubBtn = document.getElementById('closeAddonsHubBtn');
  const pageTitleEl = document.getElementById('workspacePageTitle');
  const pageBadgeEl = document.getElementById('workspacePageBadge');
  const pageSubEl = document.getElementById('workspacePageSub');
  const customContainer = document.getElementById('customMenuSlots');

  if (!menuBar) return { navigateToPage: () => {} };

  // Light / Dark Theme Toggle (persisted in localStorage)
  function applyTheme(theme, { notify = false } = {}) {
    const isLight = theme === 'light';
    document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
    if (themeToggleIcon) themeToggleIcon.textContent = isLight ? '🌙' : '☀️';
    if (themeToggleText) themeToggleText.textContent = isLight ? 'มืด' : 'สว่าง';
    try {
      localStorage.setItem(STORAGE_THEME, isLight ? 'light' : 'dark');
    } catch {
      /* ignore storage errors */
    }
    if (notify) {
      onShowToast?.(isLight ? '☀️ เปลี่ยนเป็นโหมดสว่าง (Daylight Studio)' : '🌙 เปลี่ยนเป็นโหมดมืด (Obsidian Studio)', 'info');
    }
  }

  let savedTheme = 'dark';
  try {
    savedTheme = localStorage.getItem(STORAGE_THEME) || 'dark';
  } catch {
    savedTheme = 'dark';
  }
  applyTheme(savedTheme);

  themeToggleBtn?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    applyTheme(current === 'light' ? 'dark' : 'light', { notify: true });
  });

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

  // SPA Multi-Page Router
  let currentPage = 'studio';

  function navigateToPage(pageId, { updateHash = true } = {}) {
    const target = PAGE_META[pageId] ? pageId : 'studio';
    currentPage = target;

    // 1. Update sidebar active highlight
    menuBar.querySelectorAll('[data-page]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.page === target);
    });
    topbarSettingsBtn?.classList.toggle('active', target === 'settings');

    // 1b. Update 2-step workflow stepper visibility & active state
    if (workflowStepper) {
      const showStepper = ['input', 'studio', 'ugc-grid', 'imagen', 'captions'].includes(target);
      workflowStepper.classList.toggle('hidden', !showStepper);
      const isStep1 = target === 'input';
      workflowStepper.querySelectorAll('[data-step-page]').forEach((btn) => {
        const isBtn1 = btn.dataset.stepPage === 'input';
        btn.classList.toggle('active', isStep1 ? isBtn1 : !isBtn1);
        btn.classList.toggle('done', !isStep1 && isBtn1);
      });
    }

    // 2. Update top header title, badge, subtitle & Back-to-Home button
    const meta = PAGE_META[target];
    if (pageTitleEl) pageTitleEl.textContent = meta.title;
    if (pageBadgeEl) pageBadgeEl.textContent = meta.badge;
    if (pageSubEl) pageSubEl.textContent = meta.sub;
    backToHomeBtn?.classList.toggle('hidden', target === 'studio');

    // 3. Reset all page containers before showing the active page
    studioGrid?.classList.add('hidden');
    studioGrid?.classList.remove('page-focus-input', 'page-focus-output', 'page-focus-sheet');
    addonsPanel?.classList.add('hidden');
    settingsPanel?.classList.add('hidden');

    if (target === 'input') {
      // Dedicated full-width Input & AI Auto-Fill page (Step 1 before Studio Results)
      studioGrid?.classList.remove('hidden');
      studioGrid?.classList.add('page-focus-input');
      sheetConfigDrawer?.classList.add('hidden');
    } else if (target === 'studio') {
      // Main Home Page: Dedicated clean full-width Studio Results workspace
      studioGrid?.classList.remove('hidden');
      studioGrid?.classList.add('page-focus-output');
      sheetConfigDrawer?.classList.add('hidden');
      onSwitchTab?.('slides');
    } else if (target === 'ugc-grid' || target === 'imagen' || target === 'captions') {
      // Dedicated full-width page for UGC 4-Grid / Imagen / Captions
      studioGrid?.classList.remove('hidden');
      studioGrid?.classList.add('page-focus-output');
      sheetConfigDrawer?.classList.add('hidden');
      onSwitchTab?.(target);
    } else if (target === 'sheet') {
      // Dedicated full-width Google Sheet Log page
      studioGrid?.classList.remove('hidden');
      studioGrid?.classList.add('page-focus-sheet');
      sheetConfigDrawer?.classList.remove('hidden');
    } else if (target === 'hooks' || target === 'roi' || target === 'custom') {
      // Dedicated full-width Add-on page
      addonsPanel?.classList.remove('hidden');
      activateAddonSubTab(target);
    } else if (target === 'settings') {
      // Dedicated full-width Settings page
      settingsPanel?.classList.remove('hidden');
      syncSettingsMirrorsFromPrimary();
    }

    if (updateHash) {
      const nextHash = `#${target}`;
      if (window.location.hash !== nextHash) {
        try {
          window.history.pushState(null, '', nextHash);
        } catch {
          window.location.hash = nextHash;
        }
      }
    }

    closeMobileSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Bind all sidebar page links
  menuBar.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => navigateToPage(btn.dataset.page));
  });

  // Bind 2-step workflow stepper buttons
  workflowStepper?.querySelectorAll('[data-step-page]').forEach((btn) => {
    btn.addEventListener('click', () => navigateToPage(btn.dataset.stepPage));
  });

  // Bind Add-on sub-tabs to sync URL/sidebar highlight as well
  addonTabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const panelId = btn.dataset.addonPanel;
      if (PAGE_META[panelId]) {
        navigateToPage(panelId);
      } else {
        activateAddonSubTab(panelId);
      }
    });
  });

  // Quick-jump buttons
  goToInputPageBtn?.addEventListener('click', () => navigateToPage('input'));
  backToHomeBtn?.addEventListener('click', () => navigateToPage('studio'));
  closeSettingsPanelBtn?.addEventListener('click', () => navigateToPage('studio'));
  closeAddonsHubBtn?.addEventListener('click', () => navigateToPage('studio'));
  topbarSettingsBtn?.addEventListener('click', () => {
    navigateToPage(currentPage === 'settings' ? 'studio' : 'settings');
  });

  // Support browser Back/Forward hash navigation
  window.addEventListener('hashchange', () => {
    const hashPage = (window.location.hash || '').replace(/^#/, '');
    if (PAGE_META[hashPage] && hashPage !== currentPage) {
      navigateToPage(hashPage, { updateHash: false });
    } else if (!hashPage && currentPage !== 'studio') {
      navigateToPage('studio', { updateHash: false });
    }
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
          onShowToast?.('เพิ่ม Hook ลงในจุดเด่นสินค้าแล้ว! (กลับหน้าหลักเพื่อกดสร้างพรอมได้เลย)', 'success');
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

  // Initialize starting page from URL hash (defaults to Home: studio)
  const initialHash = (window.location.hash || '').replace(/^#/, '');
  navigateToPage(PAGE_META[initialHash] ? initialHash : 'studio', { updateHash: false });

  return { navigateToPage };
}
