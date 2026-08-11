# 零固定成本部署清單

以下步驟會改動正式環境。先使用測試病人驗證，不要用真實病人的資料做除錯。

## 1. 準備 secrets

各自產生不同的長隨機值，至少 32 bytes：

- `PORTAL_SESSION_SECRET`：Cloudflare session 簽章。
- `PORTAL_BFF_SECRET`：Cloudflare 與 Supabase Edge Function 之間的驗證；兩邊必須相同。
- `PORTAL_RATE_LIMIT_SECRET`：Supabase 內將來源 IP 做不可逆雜湊。
- `CLINIC_SECRET`：必須沿用 NephroSystem 目前產生 `cloud_id` 與手機末四碼雜湊時使用的值，不能重新產生。

## 2. Supabase

專案：`jwaziwtvfbxotjafxfix`

1. 先審閱並套用 `supabase/migrations/202608110000_cloud_schema_baseline.sql`。
2. 套用 `supabase/migrations/202608110001_portal_security.sql`。這一步會移除瀏覽器匿名讀取分享資料的權限，之後分享連結必須由新 BFF 處理。
3. 設定 Edge Function secrets：`CLINIC_SECRET`、`PORTAL_BFF_SECRET`、`PORTAL_RATE_LIMIT_SECRET`。
4. 部署 `portal-auth`；其 `verify_jwt = false` 已在 `supabase/config.toml` 設定，實際請求另以 `PORTAL_BFF_SECRET` 驗證。

不要把 Supabase secret key 放在前端環境變數或 `VITE_*` 變數。

## 3. Cloudflare Pages

建立連到 Portal GitHub repository 的獨立 Pages 專案（不要覆蓋承載官網的 `sunnyease-clinic`）：

- Project name：`sunnyease-portal`
- Production domain：`portal.sunnyease.tw`

- Build command：`pnpm build`
- Build output：`dist`
- Node.js：22

設定公開 build variables：

- `VITE_OFFICIAL_LINE_URL=https://sunnyease.tw/line`：診所官方 LINE 網址；程式內也有相同預設值。
- `VITE_TURNSTILE_SITE_KEY`：若啟用 Turnstile才填入。

設定加密 secrets：

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`（建議使用 `sb_secret_...`）
- `SUPABASE_ANON_KEY`（可使用 `sb_publishable_...`）
- `PORTAL_SESSION_SECRET`
- `PORTAL_BFF_SECRET`
- `TURNSTILE_SECRET_KEY`（若啟用 Turnstile才填入）

一般 variable：

- `PORTAL_SESSION_TTL_SECONDS=28800`

## 4. 上線前驗證

使用專用測試病人逐項確認：

- 手機末四碼可登入，且不被強迫改密碼。
- 略過改密碼仍可正常使用。
- 自訂密碼設定成功，重新登入成功。
- 錯誤密碼不洩漏帳號是否存在。
- 忘記密碼會開啟診所官方 LINE。
- 單一病人趨勢、報告與目標值正確。
- 分享連結驗證、多人選擇、過期分享皆正確。
- 手機版字級、按鈕與圖表可正常操作。

## 5. 切換與回復

1. 將 NephroSystem 設定中的 `PORTAL_URL` 改為 Cloudflare Pages 網址。
2. 觀察正式登入與錯誤紀錄，確認至少一個完整門診週期。
3. 穩定後才停用 `.github/workflows/keep_alive.yml`；新架構不需要定時喚醒 Streamlit。
4. 若有異常，立即把 `PORTAL_URL` 指回舊 Streamlit 網址。資料來源一直是 NephroSystem 同步到 Supabase，不需要做反向還原。

## 6. Free plan 防護

- Cloudflare 與 Supabase 都維持 Free plan，不啟用會自動產生固定月費的資源。
- 每月查看兩邊用量；接近額度時先告警與評估，不直接升級。
- NephroSystem 原有同步與病人正常使用會產生 Supabase 活動；不另外新增付費 keep-alive 服務。
