const { createApp, ref, reactive, computed, onMounted, watch } = Vue;

const API_BASE = '/api';

// 缓存配置
const CACHE_CONFIG = {
    HOME: 24 * 60 * 60 * 1000,      // 首页：24小时
    SEARCH: 12 * 60 * 60 * 1000,        // 搜索：12小时
    FILTER: 6 * 60 * 60 * 1000         // 筛选：6小时
};

// 应用版本号
const APP_VERSION = '1.0.0';

const App = {
    setup() {
        const modpacks = ref([]);
        const loading = ref(true);
        const searchQuery = ref('');
        
        const filters = reactive({
            version: null,
            loader: null,
            tags: []
        });
        
        const filterOptions = reactive({
            versions: [],
            loaders: ['Forge', 'Fabric', 'NeoForge'],
            tags: []
        });
        
        const currentPage = ref(1);
        const totalPages = ref(1);
        const loadingMore = ref(false);
        
        // 按大版本分组
        const versionGroups = computed(() => {
            const groups = {
                '1.21': [],
                '1.20': [],
                '1.19': [],
                '1.18': [],
                '1.16': [],
                '1.12': [],
                '其他': []
            };
            
            const uniqueVersions = [...new Set(filterOptions.versions)];
            
            uniqueVersions.forEach(v => {
                const major = v.split('.')[0] + '.' + v.split('.')[1];
                if (major === '1.21') groups['1.21'].push(v);
                else if (major === '1.20') groups['1.20'].push(v);
                else if (major === '1.19') groups['1.19'].push(v);
                else if (major === '1.18') groups['1.18'].push(v);
                else if (major === '1.16') groups['1.16'].push(v);
                else if (major === '1.12') groups['1.12'].push(v);
                else groups['其他'].push(v);
            });
            
            return groups;
        });
        
        // 获取筛选选项
        const fetchFilters = async () => {
            try {
                const res = await axios.get(`${API_BASE}/modpacks/filters/options`);
                if (res.data && res.data.versions) {
                    filterOptions.versions = [...new Set(res.data.versions)].sort((a, b) => {
                        const aParts = a.split('.').map(Number);
                        const bParts = b.split('.').map(Number);
                        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                            const aVal = aParts[i] || 0;
                            const bVal = bParts[i] || 0;
                            if (aVal !== bVal) return bVal - aVal;
                        }
                        return 0;
                    });
                }
                if (res.data && res.data.tags) {
                    filterOptions.tags = [...new Set(res.data.tags)];
                }
            } catch (err) {
                console.error('获取筛选选项失败:', err);
                filterOptions.versions = [
                    '1.21.1', '1.20.4', '1.20.1', '1.19.2',
                    '1.18.2', '1.16.5', '1.12.2', '1.10.2', '1.7.10'
                ];
                filterOptions.tags = ['冒险', '科技', '魔法', '任务', '硬核', '休闲', '空岛', '大型', '轻量', '水槽', '地图', 'PvP', '国创', '剧情', '建筑'];
            }
        };
        
        // 判断是否为首页（无任何筛选）
        const isHomePage = () => {
            return !searchQuery.value && !filters.version && !filters.loader && filters.tags.length === 0;
        };
        
        // 获取整合包
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
                params.append('limit', 20);
                
                if (searchQuery.value) {
                    params.append('search', searchQuery.value);
                }
                
                // 版本筛选：只有选了具体版本才传参数
                if (filters.version && filters.version !== 'null' && filters.version !== '') {
                    params.append('version', filters.version);
                }
                
                // 加载器筛选：只有选了具体加载器才传参数
                if (filters.loader && filters.loader !== 'null' && filters.loader !== '') {
                    params.append('loader', filters.loader);
                }
                
                if (filters.tags.length > 0) {
                    params.append('tags', filters.tags.join(','));
                }
                
                // 尝试读取缓存（仅首页）
                const cacheKey = `modpacks_home`;
                if (reset && isHomePage()) {
                    const cachedData = localStorage.getItem(cacheKey);
                    if (cachedData) {
                        try {
                            const { data, timestamp } = JSON.parse(cachedData);
                            if (Date.now() - timestamp < CACHE_CONFIG.HOME) {
                                modpacks.value = data;
                                loading.value = false;
                                totalPages.value = Math.ceil(data.length / 20);
                                // 静默更新
                                fetchModpacksBackground(params, cacheKey);
                                return;
                            }
                        } catch(e) {}
                    }
                }
                
                const res = await axios.get(`${API_BASE}/modpacks?${params}`);
                const data = res.data.data.map(item => ({
                    ...item,
                    tags_list: item.tags ? item.tags.split(',').map(t => t.trim()) : []
                }));
                
                // 保存缓存（仅首页）
                if (reset && isHomePage()) {
                    localStorage.setItem(cacheKey, JSON.stringify({
                        data: data,
                        timestamp: Date.now()
                    }));
                }
                
                if (reset) {
                    modpacks.value = data;
                } else {
                    modpacks.value = [...modpacks.value, ...data];
                }
                
                totalPages.value = res.data.totalPages;
            } catch (err) {
                console.error('加载失败:', err);
            } finally {
                loading.value = false;
                loadingMore.value = false;
            }
        };
        
        // 后台静默更新
        const fetchModpacksBackground = async (params, cacheKey) => {
            try {
                const res = await axios.get(`${API_BASE}/modpacks?${params}`);
                const data = res.data.data.map(item => ({
                    ...item,
                    tags_list: item.tags ? item.tags.split(',').map(t => t.trim()) : []
                }));
                
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: data,
                    timestamp: Date.now()
                }));
                
                if (JSON.stringify(modpacks.value) !== JSON.stringify(data)) {
                    modpacks.value = data;
                    totalPages.value = Math.ceil(data.length / 20);
                    showUpdateNotification();
                }
            } catch (err) {
                console.error('后台更新失败:', err);
            }
        };
        
        // 显示更新提示
        const showUpdateNotification = () => {
            const toast = document.createElement('div');
            toast.innerHTML = `
                <i class="fas fa-sync-alt"></i> 
                内容已更新
                <button onclick="location.reload()">刷新</button>
            `;
            toast.style.cssText = `
                position: fixed;
                bottom: 100px;
                right: 20px;
                background: #3b82f6;
                color: white;
                padding: 12px 20px;
                border-radius: 40px;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 1000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                animation: slideIn 0.3s ease;
            `;
            const btn = toast.querySelector('button');
            if (btn) {
                btn.style.cssText = `
                    background: white;
                    color: #3b82f6;
                    border: none;
                    padding: 4px 12px;
                    border-radius: 30px;
                    cursor: pointer;
                    font-weight: 600;
                `;
            }
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, 5000);
        };
        
        // 设置版本
        const setVersion = (version) => {
            // 处理空值，包括 "null" 字符串
            if (version === null || version === undefined || version === '' || version === 'null') {
                filters.version = null;
            } else {
                filters.version = version;
            }
            fetchModpacks(true);
        };
        
        // 设置加载器
        const setLoader = (loader) => {
            if (loader === null || loader === undefined || loader === '' || loader === 'null') {
                filters.loader = null;
            } else {
                filters.loader = loader;
            }
            fetchModpacks(true);
        };
        
        // 切换标签
        const toggleTag = (tag) => {
            const index = filters.tags.indexOf(tag);
            if (index > -1) {
                filters.tags.splice(index, 1);
            } else {
                filters.tags.push(tag);
            }
            fetchModpacks(true);
        };
        
        // 清除筛选
        const clearFilters = () => {
            filters.version = null;
            filters.loader = null;
            filters.tags = [];
            fetchModpacks(true);
        };
        
        // 清除所有缓存
        const clearAllCache = () => {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('modpacks_') || key === 'modpacks_version') {
                    localStorage.removeItem(key);
                }
            });
            fetchModpacks(true);
            showUpdateNotification();
        };
        
        const handleSearch = () => {
            fetchModpacks(true);
        };
        
        // 滚动加载 - 节流
        let scrollTimer = null;
        const handleScroll = () => {
            if (scrollTimer) return;
            scrollTimer = setTimeout(() => {
                const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
                if (scrollTop + clientHeight >= scrollHeight - 500 && !loadingMore.value) {
                    if (currentPage.value < totalPages.value) {
                        currentPage.value++;
                        fetchModpacks(false);
                    }
                }
                scrollTimer = null;
            }, 100);
        };
        
        // 图片处理 - 直接返回原图
        const getImageUrl = (url) => {
            if (!url) return '';
            if (url.startsWith('/')) return url;
            return url;
        };
        
        // 图片加载失败处理
        const handleImageError = (e) => {
            const img = e.target;
            img.src = '';
            img.style.background = '#f1f5f9';
            img.style.minHeight = '180px';
            img.style.objectFit = 'cover';
            
            const parent = img.parentElement;
            if (parent && !parent.querySelector('.img-placeholder')) {
                const placeholder = document.createElement('div');
                placeholder.className = 'img-placeholder';
                placeholder.innerHTML = '<i class="fas fa-cube"></i>';
                placeholder.style.cssText = `
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 48px;
                    color: #94a3b8;
                    pointer-events: none;
                `;
                parent.style.position = 'relative';
                parent.appendChild(placeholder);
            }
            img.onerror = null;
        };
        
        const getDownloadUrl = (path) => {
            if (!path) return '#';
            if (path.startsWith('http')) return path;
            return `/public/down/${path}`;
        };
        
        const displayVersion = computed(() => {
            if (!filters.version) return null;
            return filters.version;
        });
        
        onMounted(() => {
            fetchFilters();
            fetchModpacks();
            window.addEventListener('scroll', handleScroll);
        });
        
        let searchTimeout;
        watch(searchQuery, () => {
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => handleSearch(), 500);
        });
        
        const hasMore = computed(() => currentPage.value < totalPages.value);
        
        return {
            modpacks,
            loading,
            searchQuery,
            filters,
            filterOptions,
            versionGroups,
            loadingMore,
            hasMore,
            displayVersion,
            setVersion,
            setLoader,
            toggleTag,
            clearFilters,
            clearAllCache,
            handleSearch,
            getImageUrl,
            handleImageError,
            getDownloadUrl
        };
    },
    template: `
        <div>
            <nav class="navbar">
                <div class="container">
                    <div class="nav-inner">
                        <a href="/" class="logo">
                            <div class="logo-icon">MH</div>
                            <div class="logo-text">Modpack <span>Hub</span></div>
                        </a>
<div class="nav-links">
    <a href="/" class="nav-link">首页</a>
    <a href="/modpacks.html" class="nav-link">整合包</a>
    <a href="/disclaimer.html" class="nav-link">免责声明</a>
    <a href="/submit.html" class="nav-link">提交汉化</a>
    <a href="/my-submissions.html" class="nav-link">我的提交</a>
    <a href="/admin/login.html" class="nav-link admin-link">
        <i class="fas fa-shield-alt"></i> 管理后台
    </a>
</div>
                    </div>
                </div>
            </nav>
            
            <main class="container">
                <section class="search-section">
                    <div class="search-wrapper">
                        <input type="text" class="search-input" v-model="searchQuery" placeholder="搜索整合包名称、标签或版本...">
                        <button class="search-button" @click="handleSearch"><i class="fas fa-search"></i> 搜索</button>
                    </div>
                </section>
                
                <div class="filter-panel">
                    <div style="display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start; margin-bottom: 20px;">
                        <div style="flex: 1; min-width: 200px;">
                            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 6px;"><i class="fas fa-tag"></i> 游戏版本</div>
                            <select class="filter-select" v-model="filters.version" @change="setVersion(filters.version)" style="width: 100%;">
                                <option :value="null">全部版本</option>
                                <optgroup v-for="(versions, group) in versionGroups" :key="group" :label="group">
                                    <option v-for="v in versions" :key="v" :value="v">{{ v }}</option>
                                </optgroup>
                            </select>
                        </div>
                        
                        <div style="flex: 1; min-width: 150px;">
                            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 6px;"><i class="fas fa-microchip"></i> 加载器</div>
                            <select class="filter-select" v-model="filters.loader" @change="setLoader(filters.loader)" style="width: 100%;">
                                <option :value="null">全部加载器</option>
                                <option v-for="loader in filterOptions.loaders" :key="loader" :value="loader">{{ loader }}</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="filter-row" style="margin-bottom: 16px;">
                        <span class="filter-label"><i class="fas fa-hashtag"></i> 标签 <span style="font-size: 11px; color: var(--text-muted);"></span></span>
                        <div class="filter-group">
                            <div v-for="tag in filterOptions.tags" :key="tag"
                                 class="filter-option"
                                 :class="{ active: filters.tags.includes(tag) }"
                                 @click="toggleTag(tag)">
                                {{ tag }}
                            </div>
                        </div>
                    </div>
                    
                    <div class="active-filters" v-if="filters.version || filters.loader || filters.tags.length > 0">
                        <span class="active-filter-tag" v-if="filters.version">
                            <i class="fas fa-tag"></i> 版本: {{ displayVersion }}
                            <i class="fas fa-times" @click="setVersion(null)"></i>
                        </span>
                        <span class="active-filter-tag" v-if="filters.loader">
                            <i class="fas fa-microchip"></i> 加载器: {{ filters.loader }}
                            <i class="fas fa-times" @click="setLoader(null)"></i>
                        </span>
                        <span class="active-filter-tag" v-for="tag in filters.tags" :key="tag">
                            <i class="fas fa-hashtag"></i> {{ tag }}
                            <i class="fas fa-times" @click="toggleTag(tag)"></i>
                        </span>
                        <button class="clear-all" @click="clearFilters">
                            <i class="fas fa-trash-alt"></i> 清除全部
                        </button>
                        <button class="clear-all" @click="clearAllCache" style="margin-left: 8px;">
                            <i class="fas fa-broom"></i> 清除缓存
                        </button>
                    </div>
                </div>
                
                <div v-if="loading" class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>加载整合包数据中...</p>
                </div>
                
                <div v-else-if="modpacks.length === 0" class="empty-state">
                    <div class="empty-icon"><i class="fas fa-search"></i></div>
                    <p>没有找到匹配的整合包</p>
                    <button class="btn-outline" @click="clearFilters">清除筛选条件</button>
                </div>
                
                <div v-else class="modpack-grid">
                    <div v-for="pack in modpacks" :key="pack.id" class="modpack-card">
                        <div class="card-image">
                            <img :src="getImageUrl(pack.img)" :alt="pack.name" loading="lazy" @error="handleImageError">
                            <div class="card-badge" :class="{ downloadable: pack.isdownload }">
                                <i :class="pack.isdownload ? 'fas fa-download' : 'fas fa-lock'"></i>
                                {{ pack.isdownload ? '可下载' : '待上传' }}
                            </div>
                        </div>
                        <div class="card-content">
                            <h3 class="card-title">{{ pack.name }}</h3>
                            <div class="card-meta">
                                <span><i class="fas fa-tag"></i> {{ pack.gversion }}</span>
                                <span><i class="fas fa-users"></i> {{ pack.i18team }}</span>
                            </div>
                            <div class="card-meta">
                                <span><i class="fas fa-language"></i> 汉化版本 {{ pack.i18version }}</span>
                            </div>
                            <div class="card-tags">
                                <span v-for="tag in pack.tags_list" class="card-tag">{{ tag }}</span>
                            </div>
                            
                            <!-- 完整链接按钮 -->
                            <div class="card-links">
                                <!-- CurseForge -->
                                <a v-if="pack.link?.curseforge" :href="'https://www.curseforge.com/minecraft/modpacks/' + pack.link.curseforge" class="card-link" target="_blank">
                                    <img src="/img/curseforge.svg" class="icon" alt="CurseForge"> CurseForge
                                </a>
                                
                                <!-- FTB -->
                                <a v-if="pack.link?.ftb" :href="'https://www.feed-the-beast.com/modpacks/' + pack.link.ftb" class="card-link" target="_blank">
                                    <img src="/img/ftb.svg" class="icon" alt="FTB"> FTB
                                </a>
                                
                                <!-- MC百科 -->
                                <a v-if="pack.link?.mcmod" :href="'https://www.mcmod.cn/modpack/' + pack.link.mcmod + '.html'" class="card-link" target="_blank">
                                    <img src="/img/mcmod.svg" class="icon" alt="MC百科"> MC百科
                                </a>
                                
                                <!-- GitHub -->
                                <a v-if="pack.link?.github" :href="'https://github.com/' + pack.link.github" class="card-link" target="_blank">
                                    <i class="fab fa-github"></i> GitHub
                                </a>
                                
                                <!-- B站主页 -->
                                <a v-if="pack.link?.bilibili" :href="'https://space.bilibili.com/' + pack.link.bilibili" class="card-link" target="_blank">
                                    <img src="/img/bilibili-line-blue.svg" class="icon" alt="B站主页"> B站主页
                                </a>
                                
                                <!-- B站视频 -->
                                <a v-if="pack.link?.bilibilidwvideo" :href="'https://www.bilibili.com/video/' + pack.link.bilibilidwvideo" class="card-link" target="_blank">
                                    <img src="/img/bilibili-line-red.svg" class="icon" alt="B站视频"> B站视频
                                </a>
                                
                                <!-- B站文章（红色）-->
                                <a v-if="pack.link?.bilibilidwred" :href="'https://www.bilibili.com/read/' + pack.link.bilibilidwred" class="card-link" target="_blank">
                                    <img src="/img/bilibili-line-red.svg" class="icon" alt="B站文章"> B站文章
                                </a>
                                
                                <!-- B站文章（黄色）-->
                                <a v-if="pack.link?.bilibilidwyellow" :href="'https://www.bilibili.com/read/' + pack.link.bilibilidwyellow" class="card-link" target="_blank">
                                    <img src="/img/bilibili-line-yellow.svg" class="icon" alt="B站文章"> B站文章
                                </a>
                                
                                <!-- 安逸君 -->
                                <a v-if="pack.link?.anyijun" href="https://anyijun.com/" class="card-link" target="_blank">
                                    <img src="/img/anyijun.svg" class="icon" alt="安逸君"> 安逸君
                                </a>
                                
                                <!-- CFPA -->
                                <a v-if="pack.link?.CFPAOrg" href="https://cfpa.site/" class="card-link" target="_blank">
                                    <img src="/img/cfpa.svg" class="icon" alt="CFPA"> CFPA
                                </a>
                                
                                <!-- GTNH -->
                                <a v-if="pack.link?.gtnh" href="https://gtnh.huijiwiki.com/wiki/%E9%A6%96%E9%A1%B5" class="card-link" target="_blank">
                                    <img src="/img/gtnh.svg" class="icon" alt="GTNH"> GTNH
                                </a>
                                
                                <!-- VM项目 -->
                                <a v-if="pack.link?.VM" :href="'https://vmct-cn.top/' + pack.link.VM" class="card-link" target="_blank">
                                    <img src="/img/vm.svg" class="icon" alt="VM项目"> VM项目
                                </a>
                                
                                <!-- VM主页 -->
                                <a v-if="pack.link?.VM0" href="https://vmct-cn.top/" class="card-link" target="_blank">
                                    <img src="/img/vm.svg" class="icon" alt="VM主页"> VM主页
                                </a>
                                
                                <!-- 百度网盘 -->
                                <a v-if="pack.link?.baidupan" :href="'https://pan.baidu.com/s/' + pack.link.baidupan" class="card-link" target="_blank">
                                    <img src="/img/baiduyun.svg" class="icon" alt="百度网盘"> 百度网盘
                                </a>
                                
                                <!-- Modrinth -->
                                <a v-if="pack.link?.modrinth" :href="'https://modrinth.com/modpack/' + pack.link.modrinth" class="card-link" target="_blank">
                                    <i class="fas fa-cube"></i> Modrinth
                                </a>
                                
                                <!-- 下载链接 -->
                                <a v-if="pack.link?.download" :href="getDownloadUrl(pack.link.download)" class="card-link" download>
                                    <i class="fas fa-download"></i> 下载
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div v-if="loadingMore" class="loading-state" style="padding: 40px 0">
                    <div class="loading-spinner" style="width: 32px; height: 32px;"></div>
                    <p>加载更多...</p>
                </div>
            </main>
            
            <footer class="footer">
                <div class="container">
                    <div class="footer-links">
                        <a href="/">首页</a>
                        <a href="/modpacks.html">整合包</a>
                        <a href="/disclaimer.html">免责声明</a>
                        <a href="/submit.html">提交汉化</a>
                        <a href="/my-submissions.html">我的提交</a>
                    </div>
                    <p>© 2026 Modpack Hub · Minecraft 整合包汉化社区</p>
                </div>
            </footer>
        </div>
    `
};

createApp(App).mount('#app');