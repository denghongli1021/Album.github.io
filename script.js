// 全域變數
const repoOwner = 'denghongli1021';
const repoName = 'Album.github.io';
let folderPath = 'images';

// 快取管理
const cache = {
    albums: null,
    mediaFiles: new Map(),
    timestamp: null,
    CACHE_DURATION: 5 * 60 * 1000 // 5分鐘
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
    rootMargin: '100px', // 提前100px開始載入
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
    }, { rootMargin: '100px' });
    
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
function loadImageWithFallback(img, jsDelivrUrl, retries = 2) {
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
                if (attempt < retries) {
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
    }));
}

// 優化的批次載入
async function loadImages() {
    const path = folderPath === 'images' ? 'images' : `images/${folderPath}`;
    const cacheKey = path;
    
    // 檢查快取
    if (cache.mediaFiles.has(cacheKey) && 
        cache.timestamp && 
        Date.now() - cache.timestamp < cache.CACHE_DURATION) {
        renderMedia(cache.mediaFiles.get(cacheKey), path);
        return;
    }
    
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('API 請求失敗');
        
        const data = await response.json();
        const mediaFiles = data.filter(file => 
            file.type === 'file' && (isImageFile(file.name) || isVideoFile(file.name))
        );
        
        // 存入快取
        cache.mediaFiles.set(cacheKey, mediaFiles);
        cache.timestamp = Date.now();
        
        renderMedia(mediaFiles, path);
    } catch (error) {
        console.error('Error loading media files:', error);
        document.getElementById('gallery').innerHTML = '<p style="color:#999;text-align:center">載入失敗,請重新整理頁面</p>';
    }
}

// 優化的渲染函數（使用 DocumentFragment 減少 DOM 操作）
function renderMedia(files, path) {
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = '';
    const fragment = document.createDocumentFragment();

    files.forEach(file => {
        const photoDiv = document.createElement('div');
        photoDiv.classList.add('photo');

        const jsDelivrUrl = `https://cdn.jsdelivr.net/gh/${repoOwner}/${repoName}@main/${path}/${file.name}`;

        if (isVideoFile(file.name)) {
            // 處理影片
            const thumbnailContainer = createVideoThumbnail(jsDelivrUrl, photoDiv);
            photoDiv.appendChild(thumbnailContainer);

            const playIcon = document.createElement('div');
            playIcon.classList.add('play-icon');
            photoDiv.appendChild(playIcon);

            const mediaType = document.createElement('div');
            mediaType.className = 'media-type video';
            mediaType.textContent = 'VIDEO';
            photoDiv.appendChild(mediaType);

            photoDiv.addEventListener('click', () => openVideoModal(jsDelivrUrl));

        } else {
            // 處理圖片（延遲載入）
            const img = document.createElement('img');
            img.alt = file.name;
            img.dataset.src = jsDelivrUrl;
            img.style.cssText = 'opacity:0;transition:opacity 0.3s ease;background:#f0f0f0';

            const mediaType = document.createElement('div');
            mediaType.className = 'media-type photo';
            mediaType.textContent = 'PHOTO';
            photoDiv.appendChild(mediaType);

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

// 優化的相簿列表載入（使用快取）
async function loadAlbums() {
    if (cache.albums && cache.timestamp && Date.now() - cache.timestamp < cache.CACHE_DURATION) {
        renderAlbums(cache.albums);
        return;
    }
    
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/images`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        cache.albums = data;
        cache.timestamp = Date.now();
        renderAlbums(data);
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
    
    data.forEach(item => {
        if (item.type === 'dir') {
            const albumLink = document.createElement('a');
            albumLink.href = `#${encodeURIComponent(item.name)}`;
            albumLink.textContent = item.name;
            if (item.name === '京都X大阪X神戶') {
                albumLink.title = '20250120-20250129';
            }
            albumLink.onclick = (e) => {
                e.preventDefault();
                loadAlbum(item.name);
            };
            albumList.appendChild(albumLink);
        }
    });
}

// 側邊欄切換
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const button = document.getElementById('toggleBtn');

    if (sidebar.style.left === '0px') {
        sidebar.style.left = '-250px';
        sidebar.classList.add('hide');
        button.innerHTML = '&#x3E;';
        button.style.left = '20px';
    } else {
        sidebar.style.left = '0px';
        sidebar.classList.remove('hide');
        button.innerHTML = '&#x3C;';
        button.style.left = '230px';
    }
}

// 新增: 監聽 URL 變化
window.addEventListener('hashchange', () => {
    const albumName = getAlbumFromUrl();
    loadAlbum(albumName, false); // false 表示不要再次更新 URL
});

// 事件監聽器設置
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('videoModal');
    const closeBtn = document.querySelector('.close');

    closeBtn?.addEventListener('click', closeVideoModal);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeVideoModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeVideoModal();
    });
});

// 頁面載入完成後執行
window.onload = () => {
    loadAlbums();
    
    // 從 URL 讀取相簿名稱並載入
    const albumName = getAlbumFromUrl();
    loadAlbum(albumName, false);
};

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