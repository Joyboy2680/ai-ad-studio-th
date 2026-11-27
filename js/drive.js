/* ==========================================================================
   AI Ad Studio TH — Google Drive Upload Integration
   Supports:
   1) Google Apps Script Web App Webhook (Zero GCP setup — paste once & save!)
   2) Direct Google Drive API v3 via Google Identity Services (OAuth Client ID)
   ========================================================================== */

export const STORAGE_DRIVE_WEBHOOK = 'ai_ad_studio_th_drive_webhook';
export const STORAGE_DRIVE_CLIENT_ID = 'ai_ad_studio_th_drive_client_id';
export const STORAGE_DRIVE_FOLDER = 'ai_ad_studio_th_drive_folder';
export const STORAGE_DRIVE_HISTORY = 'ai_ad_studio_th_drive_history';

export const STORAGE_SHEET_URL = 'ai_ad_studio_th_sheet_url';
export const STORAGE_SHEET_TAB = 'ai_ad_studio_th_sheet_tab';
export const STORAGE_SHEET_AUTOLOG = 'ai_ad_studio_th_sheet_autolog';
export const STORAGE_SHEET_HISTORY = 'ai_ad_studio_th_sheet_history';

/**
 * Ready-to-use Google Apps Script code that users can paste into script.new
 * and deploy as a Web App ("Execute as: Me", "Who has access: Anyone")
 * to BOTH save generated images/videos to Google Drive AND log every session to Google Sheets.
 */
export const APPS_SCRIPT_TEMPLATE = `function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);

    // 1) Google Sheet Session Logging Mode
    if (payload.action === 'log_sheet') {
      var ss = getOrCreateSpreadsheet_(payload.sheetUrl, payload.defaultSheetName || 'AI Ad Studio TH - Logs');
      var tabName = (payload.sheetTab || 'Studio Logs').trim();
      var sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);

      if (sheet.getLastRow() === 0 && payload.headers && payload.headers.length) {
        sheet.appendRow(payload.headers);
        var hdrRange = sheet.getRange(1, 1, 1, payload.headers.length);
        hdrRange.setFontWeight('bold').setBackground('#18181b').setFontColor('#f4f4f5');
        sheet.setFrozenRows(1);
      }

      if (payload.rowValues && payload.rowValues.length) {
        sheet.appendRow(payload.rowValues);
      }

      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        action: 'log_sheet',
        spreadsheetId: ss.getId(),
        sheetName: sheet.getName(),
        sheetUrl: ss.getUrl(),
        rowNumber: sheet.getLastRow()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2) Google Drive File Upload Mode (Images & Videos)
    var folderName = payload.folderName || 'AI Ad Studio TH - UGC Images';
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    var bytes = Utilities.base64Decode(payload.base64);
    var blob = Utilities.newBlob(bytes, payload.mimeType || 'image/png', payload.filename || 'ugc-4grid.png');
    var file = folder.createFile(blob);

    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      action: 'upload_drive',
      fileId: file.getId(),
      fileName: file.getName(),
      webViewLink: file.getUrl(),
      folderUrl: folder.getUrl()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSpreadsheet_(sheetUrlOrId, defaultName) {
  var raw = (sheetUrlOrId || '').trim();
  if (raw) {
    var match = raw.match(/\\/d\\/([a-zA-Z0-9-_]+)/);
    var id = match ? match[1] : raw;
    return SpreadsheetApp.openById(id);
  }
  var props = PropertiesService.getScriptProperties();
  var savedId = props.getProperty('DEFAULT_SHEET_ID');
  if (savedId) {
    try { return SpreadsheetApp.openById(savedId); } catch (e) {}
  }
  var files = DriveApp.getFilesByName(defaultName);
  if (files.hasNext()) {
    var f = files.next();
    props.setProperty('DEFAULT_SHEET_ID', f.getId());
    return SpreadsheetApp.openById(f.getId());
  }
  var created = SpreadsheetApp.create(defaultName);
  props.setProperty('DEFAULT_SHEET_ID', created.getId());
  return created;
}`;

/**
 * Uploads base64 image to Google Drive via user's Google Apps Script Web App URL.
 * Uses text/plain content-type so the browser avoids CORS preflight issues on script.google.com.
 */
export async function uploadViaAppsScript({
  webhookUrl,
  base64,
  mimeType = 'image/png',
  filename,
  folderName = 'AI Ad Studio TH - UGC Images'
}) {
  const cleanUrl = (webhookUrl || '').trim();
  if (!cleanUrl || !cleanUrl.startsWith('https://')) {
    throw new Error('กรุณาวาง URL ของ Google Apps Script Web App ที่ถูกต้อง (ขึ้นต้นด้วย https://)');
  }

  const res = await fetch(cleanUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      base64,
      mimeType,
      filename,
      folderName
    })
  });

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      'Apps Script ไม่ได้ส่งค่า JSON กลับมา กรุณาตรวจว่า Deploy เป็น "Web app" และตั้ง Who has access = "Anyone"'
    );
  }

  if (!data?.ok) {
    throw new Error(data?.error || 'บันทึกไฟล์ผ่าน Apps Script ไม่สำเร็จ');
  }

  return {
    fileId: data.fileId,
    fileName: data.fileName || filename,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.fileId}/view`,
    folderUrl: data.folderUrl || '',
    method: 'Apps Script'
  };
}

/**
 * Dynamically loads Google Identity Services script for OAuth 2.0 Drive API v3 upload.
 */
function loadGisScript() {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-gis-sdk="1"]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error('โหลด Google Identity SDK ไม่สำเร็จ')), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.dataset.gisSdk = '1';
    s.onload = resolve;
    s.onerror = () => reject(new Error('ไม่สามารถโหลด Google Identity Services SDK ได้'));
    document.head.appendChild(s);
  });
}

let cachedAccessToken = '';
let tokenExpiresAt = 0;

async function getDriveAccessToken(clientId) {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 30_000) {
    return cachedAccessToken;
  }
  await loadGisScript();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (resp) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
          return;
        }
        cachedAccessToken = resp.access_token;
        tokenExpiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
        resolve(cachedAccessToken);
      }
    });
    client.requestAccessToken({ prompt: cachedAccessToken ? '' : 'consent' });
  });
}

async function ensureDriveFolder(token, folderName) {
  const q = encodeURIComponent(
    `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (searchRes.ok) {
    const found = await searchRes.json();
    if (found?.files?.length) {
      return found.files[0].id;
    }
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });
  if (!createRes.ok) return null;
  const created = await createRes.json();
  return created?.id || null;
}

/**
 * Uploads base64 image directly to Google Drive API v3 using OAuth 2.0 Client ID.
 */
export async function uploadViaOAuthDrive({
  clientId,
  base64,
  mimeType = 'image/png',
  filename,
  folderName = 'AI Ad Studio TH - UGC Images'
}) {
  const cleanId = (clientId || '').trim();
  if (!cleanId) {
    throw new Error('กรุณาใส่ Google OAuth Client ID ก่อนเชื่อมต่อ Google Drive API');
  }

  const token = await getDriveAccessToken(cleanId);
  const folderId = await ensureDriveFolder(token, folderName);

  const metadata = {
    name: filename,
    mimeType,
    ...(folderId ? { parents: [folderId] } : {})
  };

  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i += 1) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const imageBlob = new Blob([bytes], { type: mimeType });

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', imageBlob);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    }
  );

  const uploaded = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok) {
    throw new Error(uploaded?.error?.message || `Google Drive Upload Error (HTTP ${uploadRes.status})`);
  }

  return {
    fileId: uploaded.id,
    fileName: uploaded.name || filename,
    webViewLink: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
    folderUrl: folderId ? `https://drive.google.com/drive/folders/${folderId}` : '',
    method: 'Drive OAuth API'
  };
}

export const SHEET_HEADERS = [
  'วัน-เวลา',
  'ชื่อสินค้า',
  'ลิงก์สินค้า',
  'จุดเด่น / สรรพคุณ',
  'ราคา / โปรโมชัน',
  'กลุ่มเป้าหมาย',
  'โหมด Google Flow',
  'สไตล์คลิป (10 วิ)',
  'ล็อกตัวละคร',
  'Shot 1 (0–2s)',
  'Shot 2 (2–5s)',
  'Shot 3 (5–8s)',
  'Shot 4 (8–10s)',
  'Imagen Prompts (3 ช็อต)',
  'แคปชั่น & แฮชแท็ก',
  'UGC 4-Panel 1:1 Prompt',
  'ลิงก์ไฟล์ Drive ล่าสุด',
  'Engine / โมเดล'
];

/**
 * Appends a structured session row into Google Sheets via the shared Apps Script Web App URL.
 */
export async function logToGoogleSheetViaAppsScript({
  webhookUrl,
  sheetUrl = '',
  sheetTab = 'Studio Logs',
  rowValues
}) {
  const cleanUrl = (webhookUrl || '').trim();
  if (!cleanUrl || !cleanUrl.startsWith('https://')) {
    throw new Error('กรุณาวาง URL ของ Google Apps Script Web App (ขึ้นต้นด้วย https://)');
  }

  const res = await fetch(cleanUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'log_sheet',
      sheetUrl: (sheetUrl || '').trim(),
      sheetTab: (sheetTab || 'Studio Logs').trim(),
      defaultSheetName: 'AI Ad Studio TH - Logs',
      headers: SHEET_HEADERS,
      rowValues
    })
  });

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      'Apps Script ไม่ได้ส่งค่า JSON กลับมา กรุณาตรวจว่า Deploy เป็น "Web app" และตั้ง Who has access = "Anyone"'
    );
  }

  if (!data?.ok) {
    const errMsg = String(data?.error || 'บันทึกเข้า Google Sheet ไม่สำเร็จ');
    if (errMsg.toLowerCase().includes('empty') || errMsg.toLowerCase().includes('undefined')) {
      throw new Error(
        'Apps Script ของคุณเป็นเวอร์ชันเก่า — กรุณาอัปเดตโค้ดใหม่จากปุ่ม "ดูโค้ด Apps Script" แล้ว Deploy ใหม่'
      );
    }
    throw new Error(errMsg);
  }

  return {
    spreadsheetId: data.spreadsheetId || '',
    sheetName: data.sheetName || sheetTab,
    sheetUrl: data.sheetUrl || sheetUrl || '',
    rowNumber: data.rowNumber || 0
  };
}

/**
 * Converts stored session records into a UTF-8 BOM CSV string ready to open in Google Sheets / Excel.
 */
export function buildSessionsCsv(records = []) {
  const escapeCell = (val) => {
    const str = String(val ?? '');
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    SHEET_HEADERS.map(escapeCell).join(','),
    ...records.map((rec) =>
      (Array.isArray(rec.rowValues) ? rec.rowValues : []).map(escapeCell).join(',')
    )
  ];
  return '\uFEFF' + lines.join('\r\n');
}

