// 配置物件
const CONFIG = {
    repoOwner: 'denghongli1021',
    repoName: 'Album.github.io',
    cacheDuration: 5 * 60 * 1000, // 5分鐘
    retryAttempts: 2,
    imageLoadMargin: '100px',
    rateLimitThreshold: 10, // 當剩餘請求數低於此值時顯示警告
    slideshowInterval: 3000, // 幻燈片切換間隔（毫秒）
    useStaticIndex: false, // 預設使用 API，rate limit 時自動切換
    apiRateLimitHit: false // 記錄是否已達 API 限制
};

// 全域變數
let folderPath = 'images';
let currentMediaFiles = []; // 用於燈箱導航
let currentImageIndex = 0;
let slideshowTimer = null; // 幻燈片計時器
let allAlbumImages = []; // 所有相簿的圖片（用於隨機幻燈片）

// 快取管理
const cache = {
    albums: null,
    mediaFiles: new Map(),
    timestamp: null,
    rateLimit: { remaining: null, limit: null, reset: null },
    staticIndex: null // 靜態索引快取
};

// 載入相簿函數 - 新增 URL 更新
function loadAlbum(albumName, updateUrl = true) {
    folderPath = albumName;
    
    // 更新 URL hash
    if (updateUrl) {
        if (albumName === 'images') {
            window.location.hash = '';
        } else {
            window.location.hash = encodeURIComponent(albumName);
        }
    }
    
    loadImages();
}

// 新增: 從 URL 讀取相簿名稱
function getAlbumFromUrl() {
    const hash = window.location.hash.slice(1); // 移除 '#'
    return hash ? decodeURIComponent(hash) : 'images';
}

// ===== 載入靜態索引 =====
async function loadStaticIndex() {
    if (cache.staticIndex) {
        return cache.staticIndex;
    }
    
    try {
        const response = await fetch('images-index.json');
        if (!response.ok) {
            throw new Error('Failed to load images-index.json');
        }
        const data = await response.json();
        
        // 檢查索引是否有效
        if (!data.items || data.items.length === 0) {
            console.warn('⚠️ images-index.json 是空的，需要執行 GitHub Actions 生成');
            
            // 如果是因為 API 限制而切換到靜態模式，但索引是空的
            if (CONFIG.apiRateLimitHit) {
                showError('靜態索引尚未生成。請前往 GitHub Actions 手動執行 "Generate Images List" workflow。', false);
            }
            return null;
        }
        
        cache.staticIndex = data;
        return data;
    } catch (error) {
        console.error('Error loading static index:', error);
        return null;
    }
}

// 從靜態索引中獲取特定路徑的檔案
function getFilesFromStaticIndex(staticIndex, targetPath) {
    if (!staticIndex || !staticIndex.items) return [];
    
    if (targetPath === 'images') {
        // 返回根目錄的檔案
        return staticIndex.items.filter(item => item.type === 'file');
    }
    
    // 尋找子目錄
    const albumName = targetPath.replace('images/', '');
    const album = staticIndex.items.find(item => 
        item.type === 'dir' && item.name === albumName
    );
    
    return album ? album.files.filter(f => f.type === 'file') : [];
}

// 從靜態索引中獲取所有相簿
function getAlbumsFromStaticIndex(staticIndex) {
    if (!staticIndex || !staticIndex.items) return [];
    return staticIndex.items.filter(item => item.type === 'dir');
}

// ===== 隨機幻燈片功能 =====
async function loadRandomSlideshow() {
    // 顯示載入指示器
    showLoadingIndicator();
    
    try {
        if (shouldUseStaticIndex()) {
            // 使用靜態索引
            const staticIndex = await loadStaticIndex();
            if (!staticIndex) {
                showError('無法載入圖片索引');
                return;
            }
            
            allAlbumImages = [];
            
            // 收集所有圖片
            const collectImages = (items, basePath = 'images') => {
                for (const item of items) {
                    if (item.type === 'file' && item.isImage) {
                        allAlbumImages.push({
                            name: item.name,
                            path: item.path,
                            albumPath: basePath
                        });
                    } else if (item.type === 'dir' && item.files) {
                        collectImages(item.files, `images/${item.name}`);
                    }
                }
            };
            
            collectImages(staticIndex.items);
            
        } else {
            // 使用 API（原始方法）
            const apiUrl = `https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repoName}/contents/images`;
            const response = await fetch(apiUrl);
            checkRateLimit(response.headers);
            
            if (!response.ok) {
                // 如果是 403 錯誤，嘗試切換到靜態索引
                if (handleApiError(null, response.status)) {
                    return loadRandomSlideshow(); // 重試使用靜態索引
                }
                showError('無法載入相簿列表');
                return;
            }
            
            const albums = await response.json();
            allAlbumImages = [];
            
            const imagePromises = [];
            
            imagePromises.push(
                fetch(`https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repoName}/contents/images`)
                    .then(res => res.json())
                    .then(files => files.filter(f => f.type === 'file' && isImageFile(f.name)))
            );
            
            for (const album of albums) {
                if (album.type === 'dir') {
                    imagePromises.push(
                        fetch(`https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repoName}/contents/images/${album.name}`)
                            .then(res => res.json())
                            .then(files => files.filter(f => f.type === 'file' && isImageFile(f.name))
                                .map(f => ({ ...f, albumPath: `images/${album.name}` })))
                            .catch(() => [])
                    );
                }
            }
            
            const allResults = await Promise.all(imagePromises);
            allResults.forEach((images) => {
                images.forEach(img => {
                    if (!img.albumPath) {
                        img.albumPath = 'images';
                    }
                    allAlbumImages.push(img);
                });
            });
        }
        
        if (allAlbumImages.length === 0) {
            showError('沒有找到任何圖片', false);
            return;
        }
        
        // 隨機打亂圖片順序
        shuffleArray(allAlbumImages);
        
        // 開始播放隨機幻燈片
        currentMediaFiles = allAlbumImages;
        currentImageIndex = 0;
        openImageLightbox(0);
        toggleSlideshowMode(true);
        
    } catch (error) {
        console.error('載入隨機幻燈片失敗:', error);
        showError('載入失敗，請重試');
    }
}

// Fisher-Yates 洗牌演算法
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ===== 幻燈片播放功能 =====

function toggleSlideshowMode(start) {
    const slideshowBtn = document.getElementById('slideshowToggle');
    const lightbox = document.getElementById('imageLightbox');
    
    if (start) {
        // 開始幻燈片
        slideshowTimer = setInterval(() => {
            navigateLightbox(1);
        }, CONFIG.slideshowInterval);
        
        if (slideshowBtn) {
            slideshowBtn.innerHTML = '⏸';
            slideshowBtn.setAttribute('aria-label', '暫停幻燈片');
        }
        lightbox?.classList.add('slideshow-mode');
    } else {
        // 停止幻燈片
        if (slideshowTimer) {
            clearInterval(slideshowTimer);
            slideshowTimer = null;
        }
        
        if (slideshowBtn) {
            slideshowBtn.innerHTML = '▶️';
            slideshowBtn.setAttribute('aria-label', '開始幻燈片');
        }
        lightbox?.classList.remove('slideshow-mode');
    }
}

function toggleSlideshow() {
    if (slideshowTimer) {
        toggleSlideshowMode(false);
    } else {
        toggleSlideshowMode(true);
    }
}

// 顯示載入指示器
function showLoadingIndicator() {
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p class="loading-text">載入中...</p>
        </div>
    `;
}

// 顯示錯誤訊息
function showError(message, canRetry = true) {
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = `
        <div class="error-container">
            <div class="error-icon">⚠️</div>
            <p class="error-message">${message}</p>
            ${canRetry ? '<button class="retry-btn" onclick="location.reload()">重新載入</button>' : ''}
        </div>
    `;
}

// 檢查並更新 API rate limit
function checkRateLimit(headers) {
    if (headers) {
        cache.rateLimit.remaining = parseInt(headers.get('X-RateLimit-Remaining'));
        cache.rateLimit.limit = parseInt(headers.get('X-RateLimit-Limit'));
        cache.rateLimit.reset = parseInt(headers.get('X-RateLimit-Reset'));
        
        if (cache.rateLimit.remaining !== null && cache.rateLimit.remaining <= CONFIG.rateLimitThreshold) {
            const resetTime = new Date(cache.rateLimit.reset * 1000);
            // 只在 Console 顯示警告
            console.warn(`⚠️ API 請求即將達到限制 (剩餘: ${cache.rateLimit.remaining})`);
            console.warn(`⏰ 重置時間: ${resetTime.toLocaleString('zh-TW')}`);
        }
    }
}

// 處理 API 錯誤並自動切換到靜態索引
function handleApiError(error, statusCode) {
    if (statusCode === 403 && !CONFIG.apiRateLimitHit) {
        console.log('🔄 API rate limit 達到，自動切換到靜態索引模式');
        CONFIG.apiRateLimitHit = true;
        
        // 只在 Console 顯示通知
        const resetTime = cache.rateLimit.reset 
            ? new Date(cache.rateLimit.reset * 1000).toLocaleString('zh-TW')
            : '稍後';
        console.info(`✅ 已自動切換到離線模式，API 將於 ${resetTime} 重置`);
        
        return true; // 表示應該重試使用靜態索引
    }
    return false; // 不需要重試
}

// 檢查是否應該使用靜態索引
function shouldUseStaticIndex() {
    return CONFIG.useStaticIndex || CONFIG.apiRateLimitHit;
}

// 移除頁面上的 rate limit 警告功能（改為只在 Console 顯示）

// 優化的圖片 IntersectionObserver（統一管理）
const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            const src = img.dataset.src;
            if (src) {
                loadImageWithFallback(img, src);
                imageObserver.unobserve(img);
            }
        }
    });
}, { 
    rootMargin: CONFIG.imageLoadMargin,
    threshold: 0.01 
});

// 優化的影片縮圖函數
function createVideoThumbnail(videoUrl, photoDiv) {
    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.classList.add('video-thumbnail');
    
    const loadingIcon = document.createElement('div');
    loadingIcon.innerHTML = '🎬';
    loadingIcon.style.cssText = 'font-size:48px;opacity:0.7;color:white';
    loadingIcon.classList.add('video-placeholder');
    thumbnailContainer.appendChild(loadingIcon);
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                generateThumbnail(videoUrl, thumbnailContainer, loadingIcon);
                observer.unobserve(entry.target);
            }
        });
    }, { rootMargin: CONFIG.imageLoadMargin });
    
    observer.observe(thumbnailContainer);
    
    return thumbnailContainer;
}

function generateThumbnail(videoUrl, container, placeholder) {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';
    video.style.display = 'none';
    video.currentTime = 1;
    
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    canvas.style.cssText = 'width:100%;height:100%;object-fit:cover';
    
    let thumbnailGenerated = false;
    
    video.addEventListener('loadeddata', () => video.currentTime = 1);
    
    video.addEventListener('seeked', function() {
        if (thumbnailGenerated) return;
        
        try {
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth || 320;
            canvas.height = video.videoHeight || 180;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            if (placeholder.parentNode) {
                placeholder.remove();
            }
            container.appendChild(canvas);
            thumbnailGenerated = true;
            video.remove();
        } catch (error) {
            console.warn('縮圖生成失敗:', error);
            showFallbackIcon(container, placeholder);
        }
    });
    
    video.addEventListener('error', () => showFallbackIcon(container, placeholder));
    
    container.appendChild(video);
    
    setTimeout(() => {
        if (!thumbnailGenerated) {
            showFallbackIcon(container, placeholder);
            video.remove();
        }
    }, 5000);
}

function showFallbackIcon(container, placeholder) {
    if (!placeholder.parentNode) {
        placeholder.style.color = '#999';
        container.appendChild(placeholder);
    }
}

// 檢查檔案類型
function isVideoFile(filename) {
    return /\.(mp4|webm|ogg|mov|avi|mkv|wmv|flv|m4v)$/i.test(filename);
}

function isImageFile(filename) {
    return /\.(jpg|jpeg|jfif|png|gif|heic|heif|webp|bmp|tiff)$/i.test(filename);
}

// 影片彈出視窗控制
function openVideoModal(videoSrc) {
    const modal = document.getElementById('videoModal');
    const modalVideo = document.getElementById('modalVideo');
    
    modalVideo.src = videoSrc;
    modal.style.display = 'block';
    modalVideo.play().catch(e => console.log('自動播放被阻止:', e));
}

function closeVideoModal() {
    const modal = document.getElementById('videoModal');
    const modalVideo = document.getElementById('modalVideo');
    
    modalVideo.pause();
    modalVideo.src = '';
    modal.style.display = 'none';
}

// 優化的圖片載入函數（帶錯誤處理和重試）
function loadImageWithFallback(img, jsDelivrUrl) {
    const rawUrl = jsDelivrUrl.replace('cdn.jsdelivr.net/gh', 'raw.githubusercontent.com').replace('@main', 'main');
    
    const tryLoad = (url, attempt = 0) => {
        return new Promise((resolve, reject) => {
            const tempImg = new Image();
            tempImg.onload = () => {
                img.src = url;
                img.style.opacity = '1';
                resolve();
            };
            tempImg.onerror = () => {
                if (attempt < CONFIG.retryAttempts) {
                    setTimeout(() => tryLoad(url, attempt + 1), 1000 * (attempt + 1));
                } else {
                    reject();
                }
            };
            tempImg.src = url;
        });
    };
    
    // 先試 CDN,失敗後試 Raw
    tryLoad(jsDelivrUrl).catch(() => tryLoad(rawUrl).catch(() => {
        console.warn('圖片載入失敗:', img.alt);
        img.style.opacity = '0.3';
        img.parentElement.classList.add('load-error');
    }));
}

// 優化的批次載入
async function loadImages() {
    const path = folderPath === 'images' ? 'images' : `images/${folderPath}`;
    const cacheKey = path;
    
    // 檢查快取
    if (cache.mediaFiles.has(cacheKey) && 
        cache.timestamp && 
        Date.now() - cache.timestamp < CONFIG.cacheDuration) {
        renderMedia(cache.mediaFiles.get(cacheKey), path);
        return;
    }
    
    // 顯示載入指示器
    showLoadingIndicator();

    try {
        let mediaFiles = [];
        
        if (shouldUseStaticIndex()) {
            // 使用靜態索引（不呼叫 API）
            const staticIndex = await loadStaticIndex();
            if (!staticIndex) {
                showError('無法載入圖片索引，請確認 images-index.json 存在');
                return;
            }
            
            const files = getFilesFromStaticIndex(staticIndex, path);
            mediaFiles = files.map(file => ({
                type: 'file',
                name: file.name,
                path: file.path,
                isVideo: file.isVideo,
                isImage: file.isImage
            }));
            
        } else {
            // 使用 API（原始方法）
            const apiUrl = `https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repoName}/contents/${path}`;
            const response = await fetch(apiUrl);
            
            // 檢查 rate limit
            checkRateLimit(response.headers);
            
            if (!response.ok) {
                // 如果是 403 錯誤，嘗試切換到靜態索引
                if (handleApiError(null, response.status)) {
                    return loadImages(); // 重試使用靜態索引
                }
                
                const errorData = await response.json().catch(() => ({}));
                let errorMessage = '載入失敗';
                
                switch (response.status) {
                    case 403:
                        errorMessage = 'API 請求次數已達上限，正在切換到離線模式...';
                        break;
                    case 404:
                        errorMessage = '找不到此相簿';
                        break;
                    case 500:
                    case 502:
                    case 503:
                        errorMessage = 'GitHub 伺服器暫時無法回應';
                        break;
                    default:
                        errorMessage = errorData.message || '載入失敗，請重新整理頁面';
                }
                
                showError(errorMessage);
                return;
            }
            
            const data = await response.json();
            mediaFiles = data.filter(file => 
                file.type === 'file' && (isImageFile(file.name) || isVideoFile(file.name))
            );
        }
        
        if (mediaFiles.length === 0) {
            showError('此相簿沒有任何照片或影片', false);
            return;
        }
        
        // 存入快取
        cache.mediaFiles.set(cacheKey, mediaFiles);
        cache.timestamp = Date.now();
        currentMediaFiles = mediaFiles;
        
        renderMedia(mediaFiles, path);
    } catch (error) {
        console.error('Error loading media files:', error);
        showError('載入失敗，請重試');
    }
}

// 優化的渲染函數（使用 DocumentFragment 減少 DOM 操作）
function renderMedia(files, path) {
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = '';
    const fragment = document.createDocumentFragment();

    // 計算圖片的實際索引（排除影片）
    let imageIndex = 0;

    files.forEach((file, index) => {
        const photoDiv = document.createElement('div');
        photoDiv.classList.add('photo');
        photoDiv.setAttribute('role', 'button');
        photoDiv.setAttribute('tabindex', '0');

        const jsDelivrUrl = `https://cdn.jsdelivr.net/gh/${CONFIG.repoOwner}/${CONFIG.repoName}@main/${path}/${file.name}`;

        if (isVideoFile(file.name)) {
            // 處理影片
            const thumbnailContainer = createVideoThumbnail(jsDelivrUrl, photoDiv);
            photoDiv.appendChild(thumbnailContainer);

            const playIcon = document.createElement('div');
            playIcon.classList.add('play-icon');
            playIcon.setAttribute('aria-hidden', 'true');
            photoDiv.appendChild(playIcon);

            const mediaType = document.createElement('div');
            mediaType.className = 'media-type video';
            mediaType.textContent = 'VIDEO';
            mediaType.setAttribute('aria-hidden', 'true');
            photoDiv.appendChild(mediaType);

            photoDiv.setAttribute('aria-label', `播放影片：${file.name}`);
            photoDiv.addEventListener('click', () => openVideoModal(jsDelivrUrl));
            photoDiv.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openVideoModal(jsDelivrUrl);
                }
            });

        } else {
            // 處理圖片（延遲載入）
            const currentImageIndex = imageIndex++;
            const img = document.createElement('img');
            img.alt = `相片：${file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')}`;
            img.dataset.src = jsDelivrUrl;
            img.dataset.index = currentImageIndex;
            img.style.cssText = 'opacity:0;transition:opacity 0.3s ease;background:#f0f0f0';

            const mediaType = document.createElement('div');
            mediaType.className = 'media-type photo';
            mediaType.textContent = 'PHOTO';
            mediaType.setAttribute('aria-hidden', 'true');
            photoDiv.appendChild(mediaType);

            photoDiv.setAttribute('aria-label', `查看相片：${file.name}`);
            photoDiv.addEventListener('click', () => openImageLightbox(currentImageIndex));
            photoDiv.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openImageLightbox(currentImageIndex);
                }
            });

            // HEIC 檔案特殊處理
            if (/\.(heic|heif)$/i.test(file.name)) {
                fetch(jsDelivrUrl)
                    .then(response => response.blob())
                    .then(blob => {
                        if (typeof heic2any !== 'undefined') {
                            return heic2any({ blob, toType: 'image/jpeg' });
                        }
                        throw new Error('heic2any not available');
                    })
                    .then(convertedBlob => {
                        img.src = URL.createObjectURL(convertedBlob);
                        img.style.opacity = '1';
                    })
                    .catch(() => {
                        img.dataset.src = jsDelivrUrl.replace('cdn.jsdelivr.net/gh', 'raw.githubusercontent.com').replace('@main', 'main');
                        imageObserver.observe(img);
                    });
            } else {
                // 使用 IntersectionObserver 延遲載入
                imageObserver.observe(img);
            }

            photoDiv.appendChild(img);
        }

        fragment.appendChild(photoDiv);
    });

    gallery.appendChild(fragment);
}

// 圖片燈箱功能
function openImageLightbox(index) {
    currentImageIndex = index;
    const lightbox = document.getElementById('imageLightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxCaption = document.getElementById('lightboxCaption');
    
    const imageFiles = currentMediaFiles.filter(file => isImageFile(file.name));
    if (index >= 0 && index < imageFiles.length) {
        const file = imageFiles[index];
        // 使用 albumPath 如果存在（隨機幻燈片），否則使用當前 folderPath
        const path = file.albumPath || (folderPath === 'images' ? 'images' : `images/${folderPath}`);
        const imageUrl = `https://cdn.jsdelivr.net/gh/${CONFIG.repoOwner}/${CONFIG.repoName}@main/${path}/${file.name}`;
        
        lightboxImg.src = imageUrl;
        lightboxCaption.textContent = file.name;
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // 更新導航按鈕狀態
        updateLightboxNavigation(imageFiles.length);
    }
}

function closeLightbox() {
    const lightbox = document.getElementById('imageLightbox');
    lightbox.style.display = 'none';
    document.body.style.overflow = 'auto';
    
    // 停止幻燈片
    if (slideshowTimer) {
        toggleSlideshowMode(false);
    }
}

function navigateLightbox(direction) {
    const imageFiles = currentMediaFiles.filter(file => isImageFile(file.name));
    currentImageIndex += direction;
    
    if (currentImageIndex < 0) {
        currentImageIndex = imageFiles.length - 1;
    } else if (currentImageIndex >= imageFiles.length) {
        currentImageIndex = 0;
    }
    
    openImageLightbox(currentImageIndex);
}

function updateLightboxNavigation(totalImages) {
    const counter = document.getElementById('lightboxCounter');
    const imageFiles = currentMediaFiles.filter(file => isImageFile(file.name));
    const actualIndex = imageFiles.findIndex((f, i) => i === currentImageIndex);
    counter.textContent = `${actualIndex + 1} / ${totalImages}`;
}

// 優化的相簿列表載入（使用快取）
async function loadAlbums() {
    if (cache.albums && cache.timestamp && Date.now() - cache.timestamp < CONFIG.cacheDuration) {
        renderAlbums(cache.albums);
        return;
    }

    try {
        let albums = [];
        
        if (shouldUseStaticIndex()) {
            // 使用靜態索引（不呼叫 API）
            const staticIndex = await loadStaticIndex();
            if (staticIndex) {
                albums = getAlbumsFromStaticIndex(staticIndex);
                console.log(`📁 從靜態索引載入 ${albums.length} 個相簿`);
            } else if (!CONFIG.apiRateLimitHit) {
                // 如果不是因為 API 限制，而是手動設定使用靜態索引但索引無效
                // 回退到 API 模式
                console.log('🔄 靜態索引無效，回退到 API 模式');
                CONFIG.useStaticIndex = false;
                return loadAlbums();
            }
        } else {
            // 使用 API（原始方法）
            const apiUrl = `https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repoName}/contents/images`;
            const response = await fetch(apiUrl);
            
            // 檢查 rate limit
            checkRateLimit(response.headers);
            
            if (!response.ok) {
                // 如果是 403 錯誤，嘗試切換到靜態索引
                if (handleApiError(null, response.status)) {
                    return loadAlbums(); // 重試使用靜態索引
                }
                console.error('Failed to load albums');
                return;
            }
            
            albums = await response.json();
        }
        
        cache.albums = albums;
        cache.timestamp = Date.now();
        renderAlbums(albums);
    } catch (error) {
        console.error('Error loading albums:', error);
    }
}

function renderAlbums(data) {
    const albumList = document.getElementById('album-list');
    albumList.innerHTML = '';
    
    const homeLink = document.createElement('a');
    homeLink.href = '#';
    homeLink.textContent = "Home";
    homeLink.onclick = () => loadAlbum('images');
    albumList.appendChild(homeLink);
    
    // 加入隨機幻燈片選項
    const slideshowLink = document.createElement('a');
    slideshowLink.href = '#';
    slideshowLink.textContent = "🎬 Random Slideshow";
    slideshowLink.style.cssText = 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;';
    slideshowLink.onclick = (e) => {
        e.preventDefault();
        loadRandomSlideshow();
    };
    albumList.appendChild(slideshowLink);
    
    // 處理相簿列表
    if (!data || data.length === 0) {
        console.warn('⚠️ 沒有相簿資料');
        return;
    }
    
    console.log(`📋 準備渲染 ${data.length} 個項目`);
    
    data.forEach(item => {
        // 相容兩種格式：API 格式和靜態索引格式
        const isDir = item.type === 'dir' || item.type === 'directory';
        
        if (isDir) {
            const albumLink = document.createElement('a');
            albumLink.href = `#${encodeURIComponent(item.name)}`;
            albumLink.textContent = item.name;
            
            // 特殊標題
            if (item.name === '京都X大阪X神戶') {
                albumLink.title = '20250120-20250129';
            }
            
            albumLink.onclick = (e) => {
                e.preventDefault();
                loadAlbum(item.name);
            };
            
            albumList.appendChild(albumLink);
            console.log(`✅ 加入相簿: ${item.name}`);
        }
    });
    
    console.log(`✅ 渲染完成，共 ${albumList.children.length - 2} 個相簿`); // -2 是 Home 和 Random Slideshow
}

// 側邊欄切換
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const button = document.getElementById('toggleBtn');
    const isOpen = sidebar.style.left === '0px';

    if (isOpen) {
        sidebar.style.left = '-250px';
        sidebar.classList.add('hide');
        button.innerHTML = '&#x3E;';
        button.style.left = '20px';
        button.setAttribute('aria-label', '開啟選單');
        button.setAttribute('aria-expanded', 'false');
    } else {
        sidebar.style.left = '0px';
        sidebar.classList.remove('hide');
        button.innerHTML = '&#x3C;';
        button.style.left = '230px';
        button.setAttribute('aria-label', '關閉選單');
        button.setAttribute('aria-expanded', 'true');
    }
}

// 新增: 監聽 URL 變化
window.addEventListener('hashchange', () => {
    const albumName = getAlbumFromUrl();
    loadAlbum(albumName, false); // false 表示不要再次更新 URL
});

// 統一的事件監聽器設置
document.addEventListener('DOMContentLoaded', () => {
    // 影片彈窗事件
    const videoModal = document.getElementById('videoModal');
    const videoCloseBtn = videoModal?.querySelector('.close');

    videoCloseBtn?.addEventListener('click', closeVideoModal);
    videoModal?.addEventListener('click', (e) => {
        if (e.target === videoModal) closeVideoModal();
    });

    // 圖片燈箱事件
    const imageLightbox = document.getElementById('imageLightbox');
    const lightboxClose = document.getElementById('lightboxClose');
    const lightboxPrev = document.getElementById('lightboxPrev');
    const lightboxNext = document.getElementById('lightboxNext');

    lightboxClose?.addEventListener('click', closeLightbox);
    lightboxPrev?.addEventListener('click', () => navigateLightbox(-1));
    lightboxNext?.addEventListener('click', () => navigateLightbox(1));
    
    imageLightbox?.addEventListener('click', (e) => {
        if (e.target === imageLightbox) closeLightbox();
    });

    // 鍵盤導航
    document.addEventListener('keydown', (e) => {
        const videoModalOpen = videoModal?.style.display === 'block';
        const lightboxOpen = imageLightbox?.style.display === 'flex';
        
        if (e.key === 'Escape') {
            if (videoModalOpen) closeVideoModal();
            if (lightboxOpen) closeLightbox();
        }
        
        if (lightboxOpen) {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                navigateLightbox(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                navigateLightbox(1);
            }
        }
    });

    // 初始化頁面
    loadAlbums();
    const albumName = getAlbumFromUrl();
    loadAlbum(albumName, false);
});

// YouTube Player 設定
let player;
function onYouTubeIframeAPIReady() {
    player = new YT.Player('music-player', {
        height: '150',
        width: '220',
        videoId: 'kaiTMtspyIk',
        playerVars: {
            listType: 'playlist',
            list: 'PLAVG7PECd7A0D9SdtL6QW94W41D3uzVtz',
            autoplay: 1,
            loop: 1,
            controls: 1,
            modestbranding: 1,
            shuffle: 1
        },
        events: {
            onReady: (event) => {
                event.target.setShuffle(true);
                event.target.nextVideo();
                event.target.playVideo();
            }
        }
    });
}