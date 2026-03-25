function updateStats(modpacks) {
    const totalModpacks = Object.keys(modpacks).length;
    const downloadable = Object.values(modpacks).filter(pack => pack.isdownload).length;
    
    const versions = new Set();
    Object.values(modpacks).forEach(pack => {
        const version = pack.gversion.split('-')[0];
        versions.add(version);
    });
    
    const teams = new Set();
    Object.values(modpacks).forEach(pack => {
        teams.add(pack.i18team);
    });
    
    document.getElementById('totalModpacks').textContent = totalModpacks;
    document.getElementById('downloadable').textContent = downloadable;
    document.getElementById('teams').textContent = teams.size;
    document.getElementById('versions').textContent = versions.size;
}