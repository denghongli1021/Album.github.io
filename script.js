// 全域變數
const repoOwner = 'denghongli1021';
const repoName = 'Album.github.io';
let folderPath = 'images';

// 載入相簿函數
function loadAlbum(albumName) {
    folderPath = albumName;
    loadImages();
}

// 改良的影片縮圖生成函數
function createVideoThumbnail(videoUrl, photoDiv) {
    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.classList.add('video-thumbnail');
    
    // 載入中動畫
    const spinner = document.createElement('div');
    spinner.classList.add('loading-spinner');
    thumbnailContainer.appendChild(spinner);
    
    // 建立影片元素用於縮圖
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';
    
    let thumbnailGenerated = false;
    
    // 多個時間點嘗試生成縮圖
    const timePoints = [1, 0.5, 2, 3, 0.1];
    let currentTimeIndex = 0;
    
    function tryGenerateThumbnail() {
        if (thumbnailGenerated || currentTimeIndex >= timePoints.length) return;
        
        video.currentTime = timePoints[currentTimeIndex];
        currentTimeIndex++;
    }
    
    video.addEventListener('loadeddata', function() {
        tryGenerateThumbnail();
    });
    
    video.addEventListener('seeked', function() {
        if (thumbnailGenerated) return;
        
        try {
            // 移除載入動畫
            if (spinner.parentNode) {
                spinner.parentNode.removeChild(spinner);
            }
            
            // 顯示影片幀作為縮圖
            video.classList.add('loaded');
            thumbnailContainer.classList.add('loaded');
            thumbnailContainer.appendChild(video);
            thumbnailGenerated = true;
            
        } catch (error) {
            console.warn('無法生成影片縮圖:', error);
            // 如果失敗，嘗試下一個時間點
            setTimeout(() => {
                if (!thumbnailGenerated) {
                    tryGenerateThumbnail();
                }
            }, 100);
        }
    });
    
    video.addEventListener('error', function(e) {
        console.warn('影片載入錯誤:', e);
        // 移除載入動畫，顯示預設背景
        if (spinner.parentNode) {
            spinner.parentNode.removeChild(spinner);
        }
        
        // 顯示影片圖示
        const videoIcon = document.createElement('div');
        videoIcon.innerHTML = '🎬';
        videoIcon.style.fontSize = '48px';
        videoIcon.style.opacity = '0.7';
        thumbnailContainer.appendChild(videoIcon);
    });
    
    // 設置影片源
    video.src = videoUrl;
    
    return thumbnailContainer;
}

// 檢查檔案類型函數
function isVideoFile(filename) {
    return filename.match(/\.(mp4|webm|ogg|mov|avi|mkv|wmv|flv|m4v)$/i);
}

function isImageFile(filename) {
    return filename.match(/\.(jpg|jpeg|png|gif|heic|heif|webp|bmp|tiff)$/i);
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

// 載入圖片和影片
function loadImages() {
    const path = folderPath === 'images' ? 'images' : `images/${folderPath}`;
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`;

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            const gallery = document.getElementById('gallery');
            gallery.innerHTML = '';

            data.forEach(file => {
                if (file.type === 'file' && (isImageFile(file.name) || isVideoFile(file.name))) {
                    const photoDiv = document.createElement('div');
                    photoDiv.classList.add('photo');

                    const jsDelivrUrl = `https://cdn.jsdelivr.net/gh/${repoOwner}/${repoName}@main/${path}/${file.name}`;

                    if (isVideoFile(file.name)) {
                        // 處理影片檔案
                        const thumbnailContainer = createVideoThumbnail(jsDelivrUrl, photoDiv);
                        photoDiv.appendChild(thumbnailContainer);

                        // 添加播放圖示
                        const playIcon = document.createElement('div');
                        playIcon.classList.add('play-icon');
                        photoDiv.appendChild(playIcon);

                        // 添加媒體類型標籤
                        const mediaType = document.createElement('div');
                        mediaType.classList.add('media-type', 'video');
                        mediaType.textContent = 'VIDEO';
                        photoDiv.appendChild(mediaType);

                        // 點擊事件
                        photoDiv.addEventListener('click', function() {
                            openVideoModal(jsDelivrUrl);
                        });

                    } else {
                        // 處理圖片檔案
                        const img = document.createElement('img');
                        img.alt = file.name;
                        img.loading = "lazy";

                        // 添加媒體類型標籤
                        const mediaType = document.createElement('div');
                        mediaType.classList.add('media-type', 'photo');
                        mediaType.textContent = '';
                        photoDiv.appendChild(mediaType);

                        if (file.name.match(/\.(heic|heif)$/i)) {
                            fetch(jsDelivrUrl)
                                .then(response => response.blob())
                                .then(blob => {
                                    // 這裡需要 heic2any 庫來處理 HEIC 檔案
                                    if (typeof heic2any !== 'undefined') {
                                        heic2any({ blob: blob, toType: 'image/jpeg' })
                                            .then(convertedBlob => {
                                                img.src = URL.createObjectURL(convertedBlob);
                                            });
                                    } else {
                                        img.src = jsDelivrUrl; // 退回到原始 URL
                                    }
                                });
                        } else {
                            img.src = jsDelivrUrl;
                        }

                        photoDiv.appendChild(img);
                    }

                    gallery.appendChild(photoDiv);
                }
            });
        })
        .catch(error => {
            console.error('Error loading media files:', error);
        });
}

// 載入相簿列表
function loadAlbums() {
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/images`;

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            const albumList = document.getElementById('album-list');
            albumList.innerHTML = '';
            
            const albumLink = document.createElement('a');
            albumLink.href = '#';
            albumLink.textContent = "Home";
            albumLink.onclick = function () {
                loadAlbum('images');
            };
            albumList.appendChild(albumLink);
            
            data.forEach(item => {
                if (item.type === 'dir') {
                    const albumLink = document.createElement('a');
                    albumLink.href = '#';
                    albumLink.textContent = item.name;
                    if (albumLink.textContent === '京都X大阪X神戶') {
                        albumLink.title = '20250120-20250129';
                    }
                    albumLink.onclick = function () {
                        loadAlbum(item.name);
                    };
                    albumList.appendChild(albumLink);
                }
            });
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

// 事件監聽器設置
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('videoModal');
    const closeBtn = document.querySelector('.close');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeVideoModal);
    }

    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeVideoModal();
            }
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeVideoModal();
        }
    });
});

// 頁面載入完成後執行
window.onload = function () {
    loadAlbums();
    loadAlbum('images');
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
            onReady: function (event) {
                event.target.setShuffle(true);
                event.target.nextVideo();
                event.target.playVideo();
            }
        }
    });
}