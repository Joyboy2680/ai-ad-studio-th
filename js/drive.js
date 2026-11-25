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

/**
 * Ready-to-use Google Apps Script code that users can paste into script.new
 * and deploy as a Web App ("Execute as: Me", "Who has access: Anyone")
 * to save generated product images directly into Google Drive.
 */
export const APPS_SCRIPT_TEMPLATE = `function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var folderName = payload.folderName || 'AI Ad Studio TH - UGC Images';
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    var bytes = Utilities.base64Decode(payload.base64);
    var blob = Utilities.newBlob(bytes, payload.mimeType || 'image/png', payload.filename || 'ugc-4grid.png');
    var file = folder.createFile(blob);

    var out = {
      ok: true,
      fileId: file.getId(),
      fileName: file.getName(),
      webViewLink: file.getUrl(),
      folderUrl: folder.getUrl()
    };
    return ContentService.createTextOutput(JSON.stringify(out))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
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
