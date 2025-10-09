# 🚀 GitHub Actions 設定指南

## ⚠️ 重要：首次設定必讀

如果您看到側邊欄沒有顯示相簿，可能是因為 `images-index.json` 尚未生成。請按照以下步驟操作：

---

## 📋 快速設定步驟

### 步驟 1：確認 Workflow 檔案已上傳
```bash
# 確認檔案存在
ls .github/workflows/generate-images-list.yml

# 如果存在，push 到 GitHub
git add .github/workflows/
git commit -m "Add GitHub Actions workflow"
git push
```

### 步驟 2：設定 Repository 權限（必須！）

1. 前往 GitHub repository
2. 點擊 **Settings** （設定）
3. 左側選單點擊 **Actions** → **General**
4. 滾動到最底部找到 **Workflow permissions**
5. 選擇 ✅ **Read and write permissions**
6. 點擊 **Save** 儲存

![重要設定]
```
Settings → Actions → General → Workflow permissions
⚠️ 必須選擇：Read and write permissions
```

### 步驟 3：手動執行 Workflow（首次必須）

1. 前往 GitHub repository
2. 點擊 **Actions** 標籤
3. 左側選單點擊 **Generate Images List**
4. 右側點擊 **Run workflow** 按鈕
5. 選擇 `main` branch
6. 點擊綠色的 **Run workflow** 按鈕

### 步驟 4：等待執行完成

- ⏱️ 通常需要 30-60 秒
- ✅ 成功後會顯示綠色勾勾
- 📝 會有新的 commit："🤖 Auto-update images index"

### 步驟 5：檢查結果

1. **檢查 images-index.json**
   ```bash
   git pull
   cat images-index.json
   ```
   
   應該看到類似：
   ```json
   {
     "generated": "2025-10-09T...",
     "baseUrl": "https://cdn.jsdelivr.net/gh/...",
     "items": [
       {
         "type": "dir",
         "name": "京都X大阪X神戶",
         ...
       }
     ]
   }
   ```

2. **重新整理網站**
   - 按 `Ctrl + Shift + R` 強制重新整理
   - 側邊欄應該會顯示所有相簿

---

## 🔍 疑難排解

### 問題 1：Actions 執行失敗（403 錯誤）

**錯誤訊息**：
```
remote: Permission to ... denied to github-actions[bot].
fatal: unable to access '...': The requested URL returned error: 403
```

**解決方法**：
1. 確認已加入 `permissions: contents: write`（已經加入）
2. 檢查 Repository Settings → Actions → Workflow permissions
3. 必須選擇 "Read and write permissions"

### 問題 2：側邊欄仍然沒有相簿

**可能原因**：
1. `images-index.json` 仍然是空的
2. Actions 還沒執行
3. 瀏覽器快取

**解決方法**：
```bash
# 1. 檢查檔案內容
cat images-index.json

# 2. 如果 items 是空陣列 []，手動執行 Actions

# 3. 清除瀏覽器快取
# 按 Ctrl+Shift+R 或 F12 → Application → Clear storage
```

### 問題 3：Actions 沒有自動執行

**原因**：
- Workflow 設定為在 `images/**` 變更時觸發
- 如果只修改了程式碼，不會自動執行

**解決方法**：
- 手動觸發（步驟 3）
- 或上傳/修改圖片：
  ```bash
  touch images/trigger.txt
  git add images/
  git commit -m "Trigger Actions"
  git push
  ```

---

## 🎯 驗證設定成功

### 測試完整流程

1. **上傳新圖片**
   ```bash
   cp test.jpg images/
   git add images/
   git commit -m "Test: Add new image"
   git push
   ```

2. **等待 Actions 執行**
   - 前往 Actions 頁面
   - 應該看到新的 workflow run
   - 等待綠色勾勾

3. **檢查結果**
   ```bash
   git pull
   # 應該看到新的 commit：🤖 Auto-update images index
   ```

4. **重新整理網站**
   - 應該看到新圖片
   - 側邊欄正常顯示

---

## 📊 當前模式說明

### 智能雙模式運作

```
網站啟動
    ↓
嘗試使用 API
    ↓
API 成功？
 ├─ 是 → ✅ 使用 API（即時更新）
 └─ 否 (403) → 🔄 切換到靜態索引
              ↓
         索引存在且有效？
          ├─ 是 → ✅ 使用靜態索引
          └─ 否 → ❌ 顯示錯誤訊息
                     「請執行 GitHub Actions」
```

### 如何確認當前使用的模式

打開瀏覽器 Console（F12）：
```javascript
// 查看配置
console.log('使用靜態索引:', CONFIG.useStaticIndex);
console.log('API 達限制:', CONFIG.apiRateLimitHit);

// 查看快取
console.log('靜態索引:', cache.staticIndex);

// 查看相簿
console.log('相簿快取:', cache.albums);
```

---

## ✅ 完成檢查清單

設定完成後，確認以下項目：

- [ ] `.github/workflows/generate-images-list.yml` 已上傳
- [ ] Repository Settings → Actions → Workflow permissions 設為 "Read and write"
- [ ] 手動執行過一次 "Generate Images List" workflow
- [ ] Workflow 執行成功（綠色勾勾）
- [ ] `images-index.json` 包含相簿資料（不是空陣列）
- [ ] 網站側邊欄正常顯示所有相簿
- [ ] 可以正常瀏覽圖片

---

## 🔄 日常使用

設定完成後，以後只需要：

```bash
# 上傳新圖片
cp new-photos/* images/某個相簿/
git add images/
git commit -m "Add new photos"
git push

# GitHub Actions 會自動：
# 1. 偵測到 images/ 變更
# 2. 執行 workflow
# 3. 更新 images-index.json
# 4. 自動 commit 並 push

# 30-60 秒後，網站自動顯示新圖片！
```

---

## 📞 需要幫助？

### 查看 Actions 日誌

1. 前往 Actions 頁面
2. 點擊執行失敗的 workflow
3. 展開各個步驟查看詳細錯誤

### 常見日誌關鍵字

- ✅ `images-index.json generated successfully` - 成功
- ❌ `Permission denied` - 權限問題
- ❌ `images directory not found` - 目錄不存在

---

## 🎉 完成！

設定完成後，您的相簿網站就可以：
- 🚀 優先使用 API（即時更新）
- 🔄 API 達限制時自動切換
- 🤖 自動維護靜態索引
- ♾️ 永不中斷服務

**版本**: 2.1.2  
**最後更新**: 2025-10-09

