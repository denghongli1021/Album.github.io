const repoOwner = 'denghongli1021';
const repoName = 'Album.github.io';
let folderPath = 'images';

function loadAlbum(albumName) {
    folderPath = albumName;
    loadImages();
}

function createVideoThumbnail(videoUrl, callback) {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    
    video.addEventListener('loadeddata', function() {
        video.currentTime = 1; // 設定到第1秒來獲取縮圖
    });
    
    video.addEventListener('seeked', function() {
        const canvas = document.createElement('canvas');
        canvas.width = 250;
        canvas.height = 250;
        const ctx = canvas.getContext('2d');
        
        // 計算影片的縮放比例以填滿容器
        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = canvas.width / canvas.height;
        
        let drawWidth, drawHeight, drawX, drawY;
        
        if (videoAspect > canvasAspect) {
            // 影片比較寬，以高度為準
            drawHeight = canvas.height;
            drawWidth = drawHeight * videoAspect;
            drawX = (canvas.width - drawWidth) / 2;
            drawY = 0;
        } else {
            // 影片比較高，以寬度為準
            drawWidth = canvas.width;
            drawHeight = drawWidth / videoAspect;
            drawX = 0;
            drawY = (canvas.height - drawHeight) / 2;
        }
        
        ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
        
        canvas.toBlob(function(blob) {
            const thumbnailUrl = URL.createObjectURL(blob);
            callback(thumbnailUrl);
        }, 'image/jpeg', 0.8);
    });
    
    video.addEventListener('error', function() {
        // 如果無法生成縮圖，使用預設圖示
        callback(null);
    });
    
    video.src = videoUrl;
}

function isVideoFile(filename) {
    return filename.match(/\.(mp4|webm|ogg|mov|avi|mkv|wmv|flv|m4v)$/i);
}

function isImageFile(filename) {
    return filename.match(/\.(jpg|jpeg|png|gif|heic|heif|webp|bmp|tiff)$/i);
}

function openVideoModal(videoSrc) {
    const modal = document.getElementById('videoModal');
    const modalVideo = document.getElementById('modalVideo');
    
    modalVideo.src = videoSrc;
    modal.style.display = 'block';
    
    // 自動播放（某些瀏覽器可能需要用戶互動）
    modalVideo.play().catch(e => console.log('自動播放被阻止:', e));
}

function closeVideoModal() {
    const modal = document.getElementById('videoModal');
    const modalVideo = document.getElementById('modalVideo');
    
    modalVideo.pause();
    modalVideo.src = '';
    modal.style.display = 'none';
}

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

                    // jsDelivr URL
                    const jsDelivrUrl = `https://cdn.jsdelivr.net/gh/${repoOwner}/${repoName}@main/${path}/${file.name}`;

                    if (isVideoFile(file.name)) {
                        // 處理影片檔案
                        const video = document.createElement('video');
                        video.muted = true;
                        video.preload = 'metadata';
                        
                        // 添加播放圖示
                        const playIcon = document.createElement('div');
                        playIcon.classList.add('play-icon');
                        photoDiv.appendChild(playIcon);

                        // 添加媒體類型標籤
                        const mediaType = document.createElement('div');
                        mediaType.classList.add('media-type');
                        mediaType.textContent = 'VIDEO';
                        photoDiv.appendChild(mediaType);

                        // 生成縮圖
                        video.addEventListener('loadeddata', function() {
                            video.currentTime = 1;
                        });

                        video.addEventListener('seeked', function() {
                            const canvas = document.createElement('canvas');
                            canvas.width = 250;
                            canvas.height = 250;
                            const ctx = canvas.getContext('2d');
                            
                            const videoAspect = video.videoWidth / video.videoHeight;
                            const canvasAspect = 1; // 正方形
                            
                            let drawWidth, drawHeight, drawX, drawY;
                            
                            if (videoAspect > canvasAspect) {
                                drawHeight = canvas.height;
                                drawWidth = drawHeight * videoAspect;
                                drawX = (canvas.width - drawWidth) / 2;
                                drawY = 0;
                            } else {
                                drawWidth = canvas.width;
                                drawHeight = drawWidth / videoAspect;
                                drawX = 0;
                                drawY = (canvas.height - drawHeight) / 2;
                            }
                            
                            ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
                            
                            canvas.toBlob(function(blob) {
                                const img = document.createElement('img');
                                img.src = URL.createObjectURL(blob);
                                img.alt = file.name;
                                img.loading = "lazy";
                                photoDiv.insertBefore(img, photoDiv.firstChild);
                            }, 'image/jpeg', 0.8);
                        });

                        video.src = jsDelivrUrl;

                        // 點擊事件 - 開啟影片彈出視窗
                        photoDiv.addEventListener('click', function() {
                            openVideoModal(jsDelivrUrl);
                        });

                    } else {
                        // 處理圖片檔案（原有邏輯）
                        const img = document.createElement('img');
                        img.alt = file.name;
                        img.loading = "lazy";

                        // 添加媒體類型標籤
                        const mediaType = document.createElement('div');
                        mediaType.classList.add('media-type');
                        mediaType.textContent = 'PHOTO';
                        photoDiv.appendChild(mediaType);

                        if (file.name.match(/\.(heic|heif)$/i)) {
                            fetch(jsDelivrUrl)
                                .then(response => response.blob())
                                .then(blob => {
                                    heic2any({ blob: blob, toType: 'image/jpeg' })
                                        .then(convertedBlob => {
                                            img.src = URL.createObjectURL(convertedBlob);
                                        });
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

// 彈出視窗關閉事件
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('videoModal');
    const closeBtn = document.querySelector('.close');

    closeBtn.addEventListener('click', closeVideoModal);

    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeVideoModal();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeVideoModal();
        }
    });
});

window.onload = function () {
    loadAlbums();
    loadAlbum('images');
};

// YouTube Player
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