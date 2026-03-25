let activeFilter = 'all';

function setupFilters() {
    const filtersContainer = document.querySelector('.filters');
    
    filtersContainer.addEventListener('click', function(e) {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;

        const filter = btn.getAttribute('data-filter');
        const allBtns = filtersContainer.querySelectorAll('.filter-btn');
        
        allBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = filter;
        
        applyFilters();
    });
}

function applyFilters() {
  const container = document.getElementById('modpacksContainer');
  const cards = container.querySelectorAll('.modpack-card');
  const searchInput = document.getElementById('searchInput');
  const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
  
  let hasVisibleCards = false;


  const oldNoResults = container.querySelector('.no-results, .loading');
  if (oldNoResults) oldNoResults.remove();

  cards.forEach(card => {
    let shouldShow = true;
    

    if (activeFilter === 'download') {
      shouldShow = card.querySelector('.download-available') !== null;
    } else if (activeFilter.startsWith('version:')) {
      const filterVersion = activeFilter.split(':')[1];
      const cardVersion = card.querySelector('.version')?.textContent || '';
      shouldShow = cardVersion.includes(filterVersion);
    } else if (activeFilter.startsWith('tag:')) {
      const filterTag = activeFilter.split(':')[1];
      const cardTags = card.querySelector('.modpack-tags')?.textContent || '';
      shouldShow = cardTags.includes(filterTag);
    }
    

    if (shouldShow && searchTerm) {
      const name = card.querySelector('.modpack-name').textContent.toLowerCase();
      const tags = card.querySelector('.modpack-tags').textContent.toLowerCase();
      const version = card.querySelector('.version')?.textContent.toLowerCase() || '';
      
      shouldShow = name.includes(searchTerm) || 
                  tags.includes(searchTerm) || 
                  version.includes(searchTerm);
    }
    
    card.style.display = shouldShow ? 'block' : 'none';
    if (shouldShow) hasVisibleCards = true;
  });


  if (!hasVisibleCards) {
    const noResults = document.createElement('div');
    noResults.className = 'no-results';
    noResults.innerHTML = '<i class="fas fa-search"></i><p>没有找到匹配的整合包</p>';
    container.appendChild(noResults);
  }
}