const repoOwner = 'denghongli1021'; // 請替換為你的 GitHub 用戶名
        const repoName = 'Album.github.io'; // 請替換為你的儲存庫名稱
        const folderPath = 'images'; // 你的圖片資料夾名稱

        // 這是 GitHub API 用來列出儲存庫中某個資料夾的檔案
        const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${folderPath}`;

        // 使用 fetch API 來獲取圖片列表
        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                const gallery = document.getElementById('gallery');

                // 遍歷 API 回應並將圖片顯示在網頁上
                data.forEach(file => {
                    if (file.type === 'file' && file.name.match(/\.(jpg|jpeg|png|gif)$/)) {
                        const photoDiv = document.createElement('div');
                        photoDiv.classList.add('photo');

                        const img = document.createElement('img');
                        img.src = file.download_url; // 下載圖片的 URL
                        img.alt = file.name;

                        // 測試下載 URL 是否正確
                        console.log('Downloading:', file.name, 'URL:', file.download_url);

                        photoDiv.appendChild(img);
                        gallery.appendChild(photoDiv);
                    }
                });
            })
            .catch(error => {
                console.error('Error fetching files from GitHub API:', error);
            });