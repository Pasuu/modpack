const { createApp, ref, reactive, computed, onMounted, watch } = Vue;

// API 基础配置
const API_BASE = '/api';

// 主应用组件
const App = {
    setup() {
        // ========== 状态定义 ==========
        const modpacks = ref([]);
        const loading = ref(true);
        const error = ref(null);
        const stats = reactive({
            total: 0,
            downloadable: 0,
            versions: 0,
            teams: 0
        });
        
        const searchQuery = ref('');
        const activeFilter = ref('all');
        const filterOptions = reactive({
            versions: [],
            tags: []
        });
        
        const currentPage = ref(1);
        const pageSize = ref(50);
        const totalPages = ref(1);
        const loadingMore = ref(false);
        
        const uploadModalVisible = ref(false);
        const selectedFile = ref(null);
        const uploadProgress = ref(0);
        const uploading = ref(false);
        const uploadResult = ref(null);
        
        const commentVisible = ref(false);
        
        // ========== 图片处理 ==========
        const getImageUrl = (originalUrl) => {
            console.log('原始URL:', originalUrl);
            if (!originalUrl) return '/img/default-modpack.png';
            if (originalUrl.startsWith('/') || originalUrl.startsWith('data:')) {
                return originalUrl;
            }
            
            // 修复损坏的 URL
            let fixedUrl = String(originalUrl);
            fixedUrl = fixedUrl.replace(/forgedcdn/g, 'forgecdn');
            fixedUrl = fixedUrl.replace(/\/93\/42\/6\//g, '/93/426/');
            fixedUrl = fixedUrl.replace(/263262895770502676/g, '636262895770502676');
            
            const result = `/api/image-proxy?url=${encodeURIComponent(fixedUrl)}`;
            return result;
        };
        
        const handleImageError = (event) => {
            console.log('图片加载失败:', event.target.src);
            event.target.src = '/img/default-modpack.png';
            event.target.onerror = null;
        };
        
        // ========== 下载链接处理 ==========
        const getDownloadUrl = (downloadPath) => {
            if (!downloadPath) return '#';
            if (downloadPath.startsWith('http://') || downloadPath.startsWith('https://')) {
                return downloadPath;
            }
            let cleanPath = downloadPath.startsWith('/') ? downloadPath : '/' + downloadPath;
            if (cleanPath.includes('/public/down/')) {
                return cleanPath;
            }
            return `/public/down${cleanPath}`;
        };
        
        // ========== 数据获取 ==========
        const fetchModpacks = async (reset = true) => {
            if (reset) {
                loading.value = true;
                currentPage.value = 1;
            } else {
                loadingMore.value = true;
            }
            
            try {
                const params = new URLSearchParams();
                params.append('page', currentPage.value);
                params.append('limit', pageSize.value);
                
                if (searchQuery.value) {
                    params.append('search', searchQuery.value);
                }
                
                if (activeFilter.value === 'download') {
                    params.append('download', 'true');
                } else if (activeFilter.value.startsWith('version:')) {
                    params.append('version', activeFilter.value.split(':')[1]);
                } else if (activeFilter.value.startsWith('tag:')) {
                    params.append('tag', activeFilter.value.split(':')[1]);
                }
                
                console.log('请求参数:', params.toString());
                const response = await axios.get(`${API_BASE}/modpacks?${params}`);
                console.log('获取到数据:', response.data);
                
                const processedData = response.data.data.map(item => ({
                    ...item,
                    tags_list: item.tags ? item.tags.split(',').map(t => t.trim()) : []
                }));
                
                if (reset) {
                    modpacks.value = processedData;
                } else {
                    modpacks.value = [...modpacks.value, ...processedData];
                }
                
                totalPages.value = response.data.totalPages;
            } catch (err) {
                console.error('获取数据失败:', err);
                error.value = err.message;
            } finally {
                loading.value = false;
                loadingMore.value = false;
            }
        };
        
        const fetchStats = async () => {
            try {
                const response = await axios.get(`${API_BASE}/modpacks/stats/summary`);
                Object.assign(stats, response.data);
                console.log('统计数据:', stats);
            } catch (err) {
                console.error('获取统计失败:', err);
            }
        };
        
        const fetchFilterOptions = async () => {
            try {
                const response = await axios.get(`${API_BASE}/modpacks/filters/options`);
                filterOptions.versions = response.data.versions;
                filterOptions.tags = response.data.tags;
                console.log('筛选选项:', filterOptions);
            } catch (err) {
                console.error('获取筛选选项失败:', err);
            }
        };
        
        // ========== 筛选和搜索 ==========
        const setFilter = (filter) => {
            activeFilter.value = filter;
            fetchModpacks(true);
        };
        
        const handleSearch = () => {
            fetchModpacks(true);
        };
        
        // ========== 滚动加载 ==========
        const loadMore = () => {
            if (currentPage.value < totalPages.value && !loadingMore.value) {
                currentPage.value++;
                fetchModpacks(false);
            }
        };
        
        const handleScroll = () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight;
            const clientHeight = window.innerHeight;
            
            if (scrollTop + clientHeight >= scrollHeight - 300) {
                loadMore();
            }
        };
        
        // ========== 上传功能 ==========
        const handleFileSelect = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            const validExtensions = ['.zip', '.rar', '.7z'];
            const ext = '.' + file.name.split('.').pop().toLowerCase();
            
            if (!validExtensions.includes(ext)) {
                uploadResult.value = { type: 'error', message: '不支持的文件类型！' };
                return;
            }
            
            if (file.size > 10 * 1024 * 1024) {
                uploadResult.value = { type: 'error', message: '文件太大！最大支持10MB' };
                return;
            }
            
            selectedFile.value = file;
            uploadResult.value = null;
        };
        
        const startUpload = async () => {
            if (!selectedFile.value) return;
            
            uploading.value = true;
            uploadProgress.value = 0;
            uploadResult.value = null;
            
            try {
                const formData = new FormData();
                formData.append('file', selectedFile.value);
                
                const response = await axios.post(`${API_BASE}/upload`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (progressEvent) => {
                        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        uploadProgress.value = percent;
                    }
                });
                
                uploadResult.value = { type: 'success', message: `上传成功！` };
                setTimeout(() => resetUploadForm(), 3000);
            } catch (err) {
                uploadResult.value = { type: 'error', message: err.message };
            } finally {
                uploading.value = false;
            }
        };
        
        const resetUploadForm = () => {
            selectedFile.value = null;
            uploadProgress.value = 0;
            uploadResult.value = null;
            const fileInput = document.getElementById('file-input');
            if (fileInput) fileInput.value = '';
        };
        
        const openUploadModal = () => {
            uploadModalVisible.value = true;
            resetUploadForm();
        };
        
        const closeUploadModal = () => {
            uploadModalVisible.value = false;
            resetUploadForm();
        };
        
        const toggleComment = () => {
            commentVisible.value = !commentVisible.value;
        };
        
        const formatFileSize = (bytes) => {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / 1048576).toFixed(1) + ' MB';
        };
        
        // ========== 监听器 ==========
        let searchTimeout;
        watch(searchQuery, () => {
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => handleSearch(), 300);
        });
        
        // ========== 生命周期 ==========
        onMounted(() => {
            console.log('App mounted, 开始加载数据...');
            fetchModpacks();
            fetchStats();
            fetchFilterOptions();
            window.addEventListener('scroll', handleScroll);
        });
        
        const hasMore = computed(() => currentPage.value < totalPages.value);
        
        // ========== 返回 ==========
        return {
            modpacks,
            loading,
            error,
            stats,
            searchQuery,
            activeFilter,
            filterOptions,
            currentPage,
            totalPages,
            loadingMore,
            hasMore,
            uploadModalVisible,
            selectedFile,
            uploadProgress,
            uploading,
            uploadResult,
            commentVisible,
            setFilter,
            handleSearch,
            loadMore,
            openUploadModal,
            closeUploadModal,
            handleFileSelect,
            startUpload,
            resetUploadForm,
            toggleComment,
            getImageUrl,
            handleImageError,
            getDownloadUrl,
            formatFileSize
        };
    },
    template: `
        <div>
<header>
    <div class="header-content">
        <div class="header-row">
            <div class="logo">
                <i class="fas fa-cubes logo-icon"></i>
                <div class="logo-text">
                    <h1>Minecraft 整合包汉化</h1>
                    <p>未经授权,不许转发</p>
                </div>
            </div>
            
            <div class="controls">
                <div class="search-row">
                    <div class="search-container">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text" v-model="searchQuery" placeholder="搜索包名称、标签或版本...">
                    </div>
                    <div class="nav-buttons">
                        <a href="/" class="nav-btn"><i class="fas fa-home"></i> 首页</a>
                        <a href="/submit.html" class="nav-btn"><i class="fas fa-plus-circle"></i> 提交汉化</a>
                        <a href="/my-submissions.html" class="nav-btn"><i class="fas fa-history"></i> 我的提交</a>
                    </div>
                </div>
                
                <div class="filters">
                    <button class="filter-btn" :class="{ active: activeFilter === 'all' }" @click="setFilter('all')">全部</button>
                    <button class="filter-btn" :class="{ active: activeFilter === 'download' }" @click="setFilter('download')">可下载</button>
                    
                    <template v-for="version in filterOptions.versions" :key="version">
                        <button class="filter-btn" :class="{ active: activeFilter === 'version:' + version }" @click="setFilter('version:' + version)">
                            {{ version }}
                        </button>
                    </template>
                    
                    <template v-for="tag in filterOptions.tags" :key="tag">
                        <button class="filter-btn" :class="{ active: activeFilter === 'tag:' + tag }" @click="setFilter('tag:' + tag)">
                            {{ tag }}
                        </button>
                    </template>
                </div>
            </div>
        </div>
    </div>
</header>
            <main>
                <div class="stats">
                    <div class="stat-card"><h3>{{ stats.total }}</h3><p>汉化包总数</p></div>
                    <div class="stat-card"><h3>{{ stats.downloadable }}</h3><p>可下载资源</p></div>
                    <div class="stat-card"><h3>{{ stats.teams }}</h3><p>汉化作者</p></div>
                    <div class="stat-card"><h3>{{ stats.versions }}</h3><p>不同版本</p></div>
                </div>
                
                <div v-if="loading" class="loading"><i class="fas fa-spinner"></i><p>正在加载整合包数据...</p></div>
                <div v-else-if="error" class="loading"><i class="fas fa-exclamation-triangle"></i><p>加载失败: {{ error }}</p></div>
                <div v-else class="modpacks-grid">
                    <div v-for="pack in modpacks" :key="pack.id" class="modpack-card">
                        <div class="card-header">
                            <img :src="getImageUrl(pack.img)" :alt="pack.name" class="modpack-img" loading="lazy" @error="handleImageError">
                            <h3 class="modpack-name">{{ pack.name }}</h3>
                        </div>
                        <div class="card-content">
                            <div class="modpack-meta">
                                <span class="version">{{ pack.gversion }}</span>
                                <span class="team">{{ pack.i18team }}</span>
                            </div>
                            <div class="i18n-version"><span>汉化版本:</span><span>{{ pack.i18version }}</span></div>
                            <div class="modpack-tags"><span v-for="tag in pack.tags_list" :key="tag" class="tag">{{ tag }}</span></div>
                            <div v-if="pack.isdownload" class="download-available"><i class="fas fa-download"></i> 可下载资源</div>
                            <div v-else class="download-not-available"><i class="fas fa-times-circle"></i> 无下载资源</div>
                           <div class="modpack-links" v-if="pack.link">
    <!-- CurseForge -->
    <a v-if="pack.link.curseforge" :href="'https://www.curseforge.com/minecraft/modpacks/' + pack.link.curseforge" class="link-btn" target="_blank">
        <img src="/img/curseforge.svg" alt="CurseForge" class="icon"> CurseForge
    </a>
    
    <!-- FTB -->
    <a v-if="pack.link.ftb" :href="'https://www.feed-the-beast.com/modpacks/' + pack.link.ftb" class="link-btn" target="_blank">
        <img src="/img/ftb.svg" alt="FTB" class="icon"> FTB
    </a>
    
    <!-- MC百科 -->
    <a v-if="pack.link.mcmod" :href="'https://www.mcmod.cn/modpack/' + pack.link.mcmod + '.html'" class="link-btn" target="_blank">
        <img src="/img/mcmod.svg" alt="MC百科" class="icon"> MC百科
    </a>
    
    <!-- GitHub -->
    <a v-if="pack.link.github" :href="'https://github.com/' + pack.link.github" class="link-btn" target="_blank">
        <i class="fab fa-github icon"></i> GitHub
    </a>
    
    <!-- B站主页 -->
    <a v-if="pack.link.bilibili" :href="'https://space.bilibili.com/' + pack.link.bilibili" class="link-btn" target="_blank">
        <img src="/img/bilibili-line-blue.svg" alt="B站主页" class="icon"> B站主页
    </a>
    
    <!-- B站视频 -->
    <a v-if="pack.link.bilibilidwvideo" :href="'https://www.bilibili.com/video/' + pack.link.bilibilidwvideo" class="link-btn" target="_blank">
        <img src="/img/bilibili-line-red.svg" alt="B站视频" class="icon"> B站视频
    </a>
    
    <!-- B站文章（红色）-->
    <a v-if="pack.link.bilibilidwred" :href="'https://www.bilibili.com/read/' + pack.link.bilibilidwred" class="link-btn" target="_blank">
        <img src="/img/bilibili-line-red.svg" alt="B站文章" class="icon"> B站文章
    </a>
    
    <!-- B站文章（黄色）-->
    <a v-if="pack.link.bilibilidwyellow" :href="'https://www.bilibili.com/read/' + pack.link.bilibilidwyellow" class="link-btn" target="_blank">
        <img src="/img/bilibili-line-yellow.svg" alt="B站文章" class="icon"> B站文章
    </a>
    
    <!-- 安逸君 -->
    <a v-if="pack.link.anyijun" href="https://anyijun.com/" class="link-btn" target="_blank">
        <img src="/img/anyijun.svg" alt="安逸君" class="icon"> 安逸君
    </a>
    
    <!-- CFPA -->
    <a v-if="pack.link.CFPAOrg" href="https://cfpa.site/" class="link-btn" target="_blank">
        <img src="/img/cfpa.svg" alt="CFPA" class="icon"> CFPA
    </a>
    
    <!-- GTNH -->
    <a v-if="pack.link.gtnh" href="https://gtnh.huijiwiki.com/wiki/%E9%A6%96%E9%A1%B5" class="link-btn" target="_blank">
        <img src="/img/gtnh.svg" alt="GTNH" class="icon"> GTNH
    </a>
    
    <!-- VM项目 -->
    <a v-if="pack.link.VM" :href="'https://vmct-cn.top/' + pack.link.VM" class="link-btn" target="_blank">
        <img src="/img/vm.svg" alt="VM项目" class="icon"> VM项目
    </a>
    
    <!-- VM主页 -->
    <a v-if="pack.link.VM0" href="https://vmct-cn.top/" class="link-btn" target="_blank">
        <img src="/img/vm.svg" alt="VM主页" class="icon"> VM主页
    </a>
    
    <!-- 百度网盘 -->
    <a v-if="pack.link.baidupan" :href="'https://pan.baidu.com/s/' + pack.link.baidupan" class="link-btn" target="_blank">
        <img src="/img/baiduyun.svg" alt="百度网盘" class="icon"> 百度网盘
    </a>
    
    <!-- Modrinth -->
    <a v-if="pack.link.modrinth" :href="'https://modrinth.com/modpack/' + pack.link.modrinth" class="link-btn" target="_blank">
        <i class="fas fa-cube"></i> Modrinth
    </a>
    
    <!-- 下载链接 -->
    <a v-if="pack.link.download" :href="getDownloadUrl(pack.link.download)" class="link-btn" download>
        <i class="fas fa-download"></i> 下载
    </a>
</div>
                        </div>
                    </div>
                </div>
                <div v-if="!loading && hasMore && !loadingMore" class="lazy-load-indicator"><i class="fas fa-spinner"></i> 滚动加载更多...</div>
                <div v-if="loadingMore" class="lazy-load-indicator"><i class="fas fa-spinner"></i> 正在加载更多...</div>
                <div v-if="!loading && modpacks.length === 0" class="no-results"><i class="fas fa-search"></i><p>没有找到匹配的整合包</p></div>
                <div id="comment-icon" @click="toggleComment"><i class="fa fa-comments"></i></div>
                <div id="upload-icon" @click="openUploadModal"><i class="fa fa-cloud-upload-alt"></i></div>
            </main>
            <footer><p>Copyright © 2025 Pasuu by Modpack.top</p></footer>
        </div>
    `
};

const app = createApp({ components: { App }, template: '<app />' });
app.mount('#app');