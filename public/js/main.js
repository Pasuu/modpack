const USE_SPLIT_FILES = false; // 设为true启用拆分文件加载

window.onload = function() {
  const container = document.getElementById('modpacksContainer');
  container.innerHTML = `
    <div class="loading">
      <i class="fas fa-spinner"></i>
      <p>正在加载整合包数据...</p>
    </div>
  `;

  const icon = document.getElementById('comment-icon');
  const lvContainer = document.getElementById('lv-container');

  icon.addEventListener('click', () => {
    if (lvContainer.style.display === 'none' || lvContainer.style.display === '') {
      lvContainer.style.display = 'block';
    } else {
      lvContainer.style.display = 'none';
    }
  });
  

const PAGE_SIZE = 50;
let currentPage = 1;
let allModpacks = {};
let isFetching = false; 



const loadData = () => {
  if (USE_SPLIT_FILES) {
    fetch('modpacks/index.json')
      .then(response => {
        if (!response.ok) throw new Error('索引文件加载失败');
        return response.json();
      })
      .then(index => {
        const promises = index.files.map(file => 
          fetch(`modpacks/${file}`)
            .then(r => r.json())
            .catch(e => {
              console.error(`加载 ${file} 失败:`, e);
              return null;
            })
        );
        
        return Promise.all(promises);
      })
      .then(modpacksArray => {
        const validPacks = modpacksArray.filter(pack => pack !== null);
        const combined = {};
        validPacks.forEach(pack => {
          const name = pack.name || 
                      file.replace('.json', '')
                           .replace(/_/g, ' ')
                           .replace(/\b\w/g, c => c.toUpperCase());
          combined[name] = pack;
        });
        
        allModpacks = combined;
        const container = document.getElementById('modpacksContainer');
        container.innerHTML = '';
        initializeApp(allModpacks);
        appendModpackCards(getPageData(1));
        setupScrollListener();
      })
      .catch(error => {
        console.error('加载拆分文件失败:', error);
        loadFallback();
      });
  } else {
    fetch('modpacks.json')
      .then(response => {
        if (!response.ok) throw new Error('网络响应异常');
        return response.json();
      })
      .then(data => {
        allModpacks = data;
        const container = document.getElementById('modpacksContainer');
        container.innerHTML = '';
        initializeApp(allModpacks);
        appendModpackCards(getPageData(1));
        setupScrollListener();
      })
      .catch(error => {
        console.error('加载整合包数据失败:', error);
        showError(error);
      });
  }
};

function getPageData(page) {
  const keys = Object.keys(allModpacks);
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageKeys = keys.slice(start, end);
  
  const pageData = {};
  pageKeys.forEach(key => {
    pageData[key] = allModpacks[key];
  });
  
  return pageData;
}

function setupScrollListener() {
  window.addEventListener('scroll', function() {
    if (isFetching) return;
    
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    if (scrollTop + clientHeight >= scrollHeight - 900) {
      loadNextPage();
    }
  });
}


function loadNextPage() {
  isFetching = true;
  currentPage++;
  
  const nextPageData = getPageData(currentPage);
  if (Object.keys(nextPageData).length === 0) {
    isFetching = false;
    return;
  }
  
  const container = document.getElementById('modpacksContainer');
  const loader = document.createElement('div');
  loader.className = 'loading';
  loader.innerHTML = '<i class="fas fa-spinner"></i><p>正在加载更多整合包...</p>';
  container.appendChild(loader);
  
  setTimeout(() => {
    loader.remove();
    appendModpackCards(nextPageData);
    isFetching = false;
  }, 500);
}

  const showError = (error) => {
    container.innerHTML = `
      <div class="loading">
        <i class="fas fa-exclamation-triangle"></i>
        <p>加载整合包数据失败，请刷新页面重试</p>
        <p>${error.message}</p>
      </div>
    `;
  };

  const loadFallback = () => {
    fetch('modpacks.json')
      .then(response => response.json())
      .then(data => initializeApp(data))
      .catch(finalError => {
        console.error('回退加载失败:', finalError);
        showError(finalError);
      });
  };

  loadData();
};