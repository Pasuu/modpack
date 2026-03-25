const { createApp, ref, reactive, computed, onMounted, watch } = Vue;

const API_BASE = '/api';

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
        
        const fetchFilters = async () => {
            try {
                const res = await axios.get(`${API_BASE}/modpacks/filters/options`);
                if (res.data && res.data.versions) {
                    filterOptions.versions = res.data.versions;
                }
                if (res.data && res.data.tags) {
                    filterOptions.tags = res.data.tags;
                }
            } catch (err) {
                console.error('获取筛选选项失败:', err);
                filterOptions.versions = [
                    '1.7.10-Forge', '1.10.2-Forge', '1.12.2-Forge',
                    '1.15.2-Forge', '1.16.5-Forge', '1.18.2-Forge',
                    '1.19.2-Forge', '1.19.2-Fabric', '1.20.1-Forge',
                    '1.20.1-Fabric', '1.20.4-NeoForge', '1.21.1-NeoForge'
                ];
                filterOptions.tags = ['冒险', '科技', '魔法', '任务', '硬核', '休闲', '空岛', '大型', '轻量', '水槽', '地图', 'PvP', '国创', '剧情', '建筑'];
            }
        };
        
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
            
            filterOptions.versions.forEach(v => {
                if (v.startsWith('1.21')) groups['1.21'].push(v);
                else if (v.startsWith('1.20')) groups['1.20'].push(v);
                else if (v.startsWith('1.19')) groups['1.19'].push(v);
                else if (v.startsWith('1.18')) groups['1.18'].push(v);
                else if (v.startsWith('1.16')) groups['1.16'].push(v);
                else if (v.startsWith('1.12')) groups['1.12'].push(v);
                else groups['其他'].push(v);
            });
            
            return groups;
        });
        
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
                params.append('limit', 30);
                
                if (searchQuery.value) {
                    params.append('search', searchQuery.value);
                }
                
                if (filters.version && filters.version !== 'null' && filters.version !== '') {
                    params.append('version', filters.version);
                }
                
                if (filters.loader && filters.loader !== 'null' && filters.loader !== '') {
                    params.append('loader', filters.loader);
                }
                
                if (filters.tags.length > 0) {
                    params.append('tags', filters.tags.join(','));
                }
                
                const res = await axios.get(`${API_BASE}/modpacks?${params}`);
                const data = res.data.data.map(item => ({
                    ...item,
                    tags_list: item.tags ? item.tags.split(',').map(t => t.trim()) : []
                }));
                
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
        
        const setVersion = (version) => {
            if (!version || version === 'null' || version === 'undefined' || version === '') {
                filters.version = null;
            } else {
                filters.version = version;
            }
            fetchModpacks(true);
        };
        
        const setLoader = (loader) => {
            if (!loader || loader === 'null' || loader === 'undefined' || loader === '') {
                filters.loader = null;
            } else {
                filters.loader = loader;
            }
            fetchModpacks(true);
        };
        
        const toggleTag = (tag) => {
            const index = filters.tags.indexOf(tag);
            if (index > -1) {
                filters.tags.splice(index, 1);
            } else {
                filters.tags.push(tag);
            }
            fetchModpacks(true);
        };
        
        const clearFilters = () => {
            filters.version = null;
            filters.loader = null;
            filters.tags = [];
            fetchModpacks(true);
        };
        
        const handleSearch = () => {
            fetchModpacks(true);
        };
        
        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
            if (scrollTop + clientHeight >= scrollHeight - 500 && !loadingMore.value) {
                if (currentPage.value < totalPages.value) {
                    currentPage.value++;
                    fetchModpacks(false);
                }
            }
        };
        
        const getImageUrl = (url) => {
            if (!url) return '';
            if (url.startsWith('/')) return url;
            return `/api/image-proxy?url=${encodeURIComponent(url)}`;
        };
        
        const handleImageError = (e) => {
            e.target.src = '';
            e.target.style.background = '#f1f5f9';
        };
        
        const getDownloadUrl = (path) => {
            if (!path) return '#';
            if (path.startsWith('http')) return path;
            return `/public/down/${path}`;
        };
        
        const displayVersion = computed(() => {
            if (!filters.version) return null;
            return filters.version.replace(/-.*$/, '');
        });
        
        onMounted(() => {
            fetchFilters();
            fetchModpacks();
            window.addEventListener('scroll', handleScroll);
        });
        
        let searchTimeout;
        watch(searchQuery, () => {
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => handleSearch(), 300);
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
                            <a href="/modpacks.html" class="nav-link active">整合包</a>
                            <a href="/disclaimer.html" class="nav-link">免责声明</a>
                            <a href="/submit.html" class="nav-link">提交汉化</a>
                            <a href="/my-submissions.html" class="nav-link">我的提交</a>
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
                                    <option v-for="v in versions" :key="v" :value="v">{{ v.replace(/-.*$/, '') }}</option>
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
                            <img :src="getImageUrl(pack.img)" :alt="pack.name" @error="handleImageError">
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