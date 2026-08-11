# NephroSystem Patient Portal

病人查詢入口的新版本。前端改為 React/Vite，部署於 Cloudflare Pages；敏感資料只由 Pages Functions 與 Supabase Edge Function 處理。瀏覽器不會取得 Supabase 高權限金鑰。

目前的 `app.py` 仍保留作為切換期間的 Streamlit 備援。新站正式驗證完成前，不要停用舊站。

## 病人登入設計

- 身分證字號加目前密碼登入。
- 手機末四碼可長期作為目前密碼，不會強迫高齡使用者首次登入就改密碼。
- 登入後只以柔和提示提供「設定自訂密碼」選項。
- 忘記密碼引導至診所官方 LINE，由診所協助。
- 登入錯誤使用一致訊息，不揭露病人帳號是否存在。
- 同一身分與來源連續失敗會暫時鎖定，避免暴力嘗試。

## 架構與固定成本

```text
病人瀏覽器
  -> Cloudflare Pages（靜態前端，Free）
  -> Pages Functions（同源 BFF，Free）
  -> Supabase Edge Function + Database（Free）
```

這個配置不需要常駐伺服器，目標是固定平台成本為零。實際使用量仍需留在 Cloudflare 與 Supabase Free plan 的額度內；若將來流量接近額度，先加警示，不自動升級付費方案。

## 本機開發

需求：Node.js 22、pnpm 11。

1. 複製 `.env.example` 為 `.env.local`，填入診所官方 LINE 網址；Turnstile 可先留空。
2. 複製 `.dev.vars.example` 為 `.dev.vars`，填入 Supabase 與 Portal secrets。
3. 執行 `pnpm install`。
4. 執行 `pnpm build`，再以 `pnpm pages:dev` 啟動完整 Pages Functions 環境。

`.env*` 與 `.dev.vars` 已被 Git 忽略，不要將實際金鑰提交到版本庫。

## 驗證

```text
pnpm check
pnpm test
pnpm build
```

GitHub Actions 也會在每次 push 與 pull request 執行相同檢查。

## 部署順序

完整步驟見 [docs/deployment.md](docs/deployment.md)。順序是：先部署資料庫安全變更與 Edge Function，再設定 Cloudflare secrets、部署新站、用測試病人驗證，最後才把 NephroSystem 的 Portal URL 切到新站。

## 回復舊站

如果新站切換後出現問題，先把 NephroSystem 的 Portal URL 指回 Streamlit 舊站。`app.py` 與既有 keep-alive workflow 在切換驗證期內都保留；確認新站穩定後才移除 keep-alive。
