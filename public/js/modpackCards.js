function generateModpackCards(modpacks) {
    const container = document.getElementById('modpacksContainer');
    container.innerHTML = '';
}

function appendModpackCards(modpacks) {
    const container = document.getElementById('modpacksContainer');
    const fragment = document.createDocumentFragment();
    
    Object.entries(modpacks).forEach(([name, data]) => {
        const card = createModpackCard(name, data);
        fragment.appendChild(card);
    });
    
    container.appendChild(fragment);
    initLazyLoad();
    applyFilters();
}


function createModpackCard(name, data) {
    const tags = data.link.tags.split(',').map(tag => tag.trim());
    const tagElements = tags.map(tag => `<span class="tag">${tag}</span>`).join('');
    
    let downloadBtn = '';
    if (data.isdownload && data.link.download) {
        downloadBtn = `
            <a href="down/${data.link.download}" class="link-btn" download>
                <i class="fas fa-download"></i> 下载
            </a>
        `;
    } else if (data.isdownload) {
        downloadBtn = `<div class="download-available"><i class="fas fa-download"></i> 可下载资源</div>`;
    } else {
        downloadBtn = `<div class="download-not-available"><i class="fas fa-times-circle"></i> 无下载资源</div>`;
    }
    
    const i18nVersion = `
        <div class="i18n-version">
            <span>汉化版本:</span>
            <span>${data.i18version}</span>
        </div>
    `;
    
    const card = document.createElement('div');
    card.className = 'modpack-card';
    card.innerHTML = `
        <div class="card-header">
            <img data-src="${data.img}" alt="${name}" class="modpack-img lazy-load">
            <h3 class="modpack-name">${name}</h3>
        </div>
        <div class="card-content">
            <div class="modpack-meta">
                <span class="version">${data.gversion}</span>
                <span class="team">${data.i18team}</span>
            </div>
            
            ${i18nVersion}
            
            <div class="modpack-tags">
                ${tagElements}
            </div>
            
            ${downloadBtn}
            
            <div class="modpack-links">
                ${data.link.curseforge ? 
                    `<a href="https://www.curseforge.com/minecraft/modpacks/${data.link.curseforge}" class="link-btn" target="_blank">
                        <img src="img/curseforge.svg" alt="CurseForge" class="icon"> CurseForge
                    </a>` : ''
                }

        ${data.link.ftb ? 
        `<a href="https://www.feed-the-beast.com/modpacks/${data.link.ftb}" class="link-btn" target="_blank">
            <img src="img/ftb.svg" alt="FTB" class="icon"> FTB
        </a>` : ''
    }

    ${data.link.mcmod ? 
        `<a href="https://www.mcmod.cn/modpack/${data.link.mcmod}.html" class="link-btn" target="_blank">
            <img src="img/mcmod.svg" alt="MC百科" class="icon"> MC百科
        </a>` : ''
    }

    ${data.link.github ? 
        `<a href="https://github.com/${data.link.github}" class="link-btn" target="_blank">
            <i class="fab fa-github icon"></i> GitHub
        </a>` : ''
    }

    ${data.link.bilibili ? 
        `<a href="https://space.bilibili.com/${data.link.bilibili}" class="link-btn" target="_blank">
            <img src="img/bilibili-line-blue.svg" alt="B站主页" class="icon"> B站主页
        </a>` : ''
    }

    ${data.link.bilibiliopus ? 
        `<a href="https://www.bilibili.com/opus/${data.link.bilibiliopus}" class="link-btn" target="_blank">
            <img src="img/bilibili-line-red.svg" alt="B站文章红" class="icon"> B站文章
        </a>` : ''
    }


    ${data.link.bilibilidwred ? 
        `<a href="https://www.bilibili.com/read/${data.link.bilibilidwred}" class="link-btn" target="_blank">
            <img src="img/bilibili-line-red.svg" alt="B站文章红" class="icon"> B站文章
        </a>` : ''
    }

    ${data.link.bilibilidwyellow ? 
        `<a href="https://www.bilibili.com/read/${data.link.bilibilidwyellow}" class="link-btn" target="_blank">
            <img src="img/bilibili-line-yellow.svg" alt="B站文章黄" class="icon"> B站文章
        </a>` : ''
    }

    ${data.link.bilibilidwvideo ? 
        `<a href="https://www.bilibili.com/video/${data.link.bilibilidwvideo}" class="link-btn" target="_blank">
            <img src="img/bilibili-line-red.svg" alt="B站视频" class="icon"> B站视频
        </a>` : ''
    }

    ${data.link.anyijun ? 
        `<a href="https://anyijun.com/" class="link-btn" target="_blank">
            <img src="img/anyijun.svg" alt="安逸君" class="icon"> 安逸君
        </a>` : ''
    }

    ${data.link.CFPAOrg ? 
        `<a href="https://cfpa.site/" class="link-btn" target="_blank">
            <img src="img/cfpa.svg" alt="CFPA" class="icon"> CFPA
        </a>` : ''
    }

    ${data.link.gtnh ? 
        `<a href="https://gtnh.huijiwiki.com/wiki/%E9%A6%96%E9%A1%B5" class="link-btn" target="_blank">
            <img src="img/gtnh.svg" alt="GTNH" class="icon"> GTNH
        </a>` : ''
    }

    ${data.link.VM ? 
        `<a href="https://vmct-cn.top/${data.link.VM}" class="link-btn" target="_blank">
            <img src="img/vm.svg" alt="VM项目" class="icon"> VM项目
        </a>` : ''
    }

    ${data.link.VM0 ? 
        `<a href="https://vmct-cn.top/" class="link-btn" target="_blank">
            <img src="img/vm.svg" alt="VM主页" class="icon"> VM主页
        </a>` : ''
    }

    ${data.link.baidupan ? 
        `<a href="https://pan.baidu.com/s/${data.link.baidupan}" class="link-btn" target="_blank">
            <img src="img/baiduyun.svg" alt="百度网盘" class="icon"> 百度网盘
        </a>` : ''
    }

            </div>
        </div>
    `;
    
    return card;
}

function initLazyLoad() {
    const lazyImages = document.querySelectorAll('.lazy-load');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                loadImage(img);
                observer.unobserve(img);
            }
        });
    }, { rootMargin: '100px' });

    lazyImages.forEach(img => {
        const rect = img.getBoundingClientRect();
        if (rect.top < window.innerHeight + 100) {
            loadImage(img);
        } else {
            observer.observe(img);
        }
    });
    

    function loadImage(img) {
        if (!img.dataset.src) return;
        

        if (img.src) return;
        
        img.src = img.dataset.src;
        
        img.onload = () => {
            img.classList.add('loaded');
        };
        
        img.onerror = () => {
            img.src = 'https://via.placeholder.com/400x180/2c3e50/ffffff?text=Modpack+Image';
            img.classList.add('loaded');
        };
    }
}