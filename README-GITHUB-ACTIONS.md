# 🚀 GitHub Actions 自動生成圖片清單

## ✅ 設定完成！

您的相簿網站現在使用 **GitHub Actions** 自動生成圖片索引，完全不會受到 GitHub API 限制！

---

## 📋 工作原理

### 1. **自動觸發**
當您 push 新圖片到 `images/` 資料夾時，GitHub Actions 會自動：
- 掃描所有 `images/` 目錄和子目錄
- 識別圖片檔案（jpg, png, gif, webp, heic 等）
- 識別影片檔案（mp4, mov, webm 等）
- 生成 `images-index.json` 索引檔案
- 自動 commit 並 push 回 repository

### 2. **前端讀取**
網站不再呼叫 GitHub API，而是：
- 直接讀取 `images-index.json` 檔案
- 快速、穩定、無限制
- 完全相同的使用者體驗

---

## 🎯 使用方式

### 上傳新圖片
```bash
# 1. 將圖片放到 images/ 資料夾
cp your-photo.jpg images/

# 2. Commit 並 push
git add images/
git commit -m "Add new photos"
git push

# 3. GitHub Actions 會自動運行並更新索引
# 等待約 30 秒，網站就會顯示新圖片！
```

### 創建新相簿
```bash
# 1. 創建新資料夾
mkdir images/我的新相簿

# 2. 放入圖片
cp photo1.jpg photo2.jpg images/我的新相簿/

# 3. Commit 並 push
git add images/
git commit -m "Create new album"
git push

# GitHub Actions 會自動掃描並加入側邊欄！
```

---

## 📁 檔案結構

### Workflow 檔案
```
.github/workflows/generate-images-list.yml
```
這是 GitHub Actions 的配置檔案，會在 push 時自動執行。

### 索引檔案
```
images-index.json
```
自動生成的圖片清單，包含所有圖片和相簿資訊。

**範例結構**：
```json
{
  "generated": "2025-10-09T12:00:00.000Z",
  "baseUrl": "https://cdn.jsdelivr.net/gh/denghongli1021/Album.github.io@main",
  "items": [
    {
      "type": "file",
      "name": "IMG_001.jpg",
      "path": "IMG_001.jpg",
      "isVideo": false,
      "isImage": true
    },
    {
      "type": "dir",
      "name": "京都X大阪X神戶",
      "path": "京都X大阪X神戶",
      "files": [
        {
          "type": "file",
          "name": "photo1.jpg",
          "path": "京都X大阪X神戶/photo1.jpg",
          "isVideo": false,
          "isImage": true
        }
      ]
    }
  ]
}
```

---

## ⚙️ 配置說明

### 開啟/關閉靜態索引

在 `script.js` 中：
```javascript
const CONFIG = {
    // ...
    useStaticIndex: true  // true = 使用靜態索引，false = 使用 API
};
```

- **`true`**：使用 GitHub Actions 生成的索引（推薦）✅
- **`false`**：使用 GitHub API（會受 rate limit 限制）

---

## 🔍 查看執行狀態

### 在 GitHub 查看
1. 進入您的 repository
2. 點擊 "Actions" 標籤
3. 查看 "Generate Images List" workflow
4. 可以看到每次執行的記錄和狀態

### 手動觸發
如果需要手動重新生成索引：
1. 到 Actions 頁面
2. 選擇 "Generate Images List"
3. 點擊 "Run workflow" 按鈕
4. 選擇 branch 並執行

---

## ✨ 優點

| 項目 | GitHub API | GitHub Actions |
|------|-----------|----------------|
| **請求限制** | 60次/小時 ❌ | 無限制 ✅ |
| **速度** | 需要多次請求 | 一次讀取 ⚡ |
| **穩定性** | 可能被限制 | 100%穩定 ✅ |
| **維護** | 無需維護 | 自動維護 ✅ |

---

## 🐛 疑難排解

### 問題：Actions 沒有執行
**解決方法**：
- 確認 push 的檔案在 `images/` 資料夾內
- 檢查 repository 的 Actions 是否啟用
- 查看 Actions 頁面的錯誤訊息

### 問題：網站顯示「無法載入圖片索引」
**解決方法**：
1. 確認 `images-index.json` 檔案存在
2. 手動觸發 workflow 重新生成
3. 檢查 JSON 格式是否正確

### 問題：新上傳的圖片沒顯示
**解決方法**：
1. 等待 30-60 秒讓 Actions 完成
2. 清除瀏覽器快取（Ctrl+Shift+R）
3. 檢查 Actions 是否執行成功

---

## 🎉 完成！

現在您的相簿網站：
- ✅ 不再受 API 限制
- ✅ 載入速度更快
- ✅ 完全自動化
- ✅ 無需手動維護

上傳新圖片後，GitHub Actions 會自動處理一切！🚀

---

## 📞 需要幫助？

如有任何問題，請檢查：
1. GitHub Actions 執行日誌
2. 瀏覽器 Console 錯誤訊息
3. `images-index.json` 檔案內容

**版本**: 2.1.1  
**最後更新**: 2025-10-09

