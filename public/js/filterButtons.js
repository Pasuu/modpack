function generateFilterButtons(modpacks) {
    const filtersContainer = document.querySelector('.filters');
    const versions = new Set();
    const tags = new Set();

    Object.values(modpacks).forEach(pack => {
        const version = pack.gversion;
        versions.add(version);
        
        const packTags = pack.link.tags.split(',').map(tag => tag.trim());
        packTags.forEach(tag => tags.add(tag));
    });

    filtersContainer.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn active';
    allBtn.setAttribute('data-filter', 'all');
    allBtn.textContent = '全部';
    filtersContainer.appendChild(allBtn);

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'filter-btn';
    downloadBtn.setAttribute('data-filter', 'download');
    downloadBtn.textContent = '可下载';
    filtersContainer.appendChild(downloadBtn);

    Array.from(versions)
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
        .forEach(version => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.setAttribute('data-filter', `version:${version}`);
            btn.textContent = version;
            filtersContainer.appendChild(btn);
        });

    Array.from(tags)
        .sort()
        .forEach(tag => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.setAttribute('data-filter', `tag:${tag}`);
            btn.textContent = tag;
            filtersContainer.appendChild(btn);
        });

    setupFilters();
}
