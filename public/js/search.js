function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', function() {
    applyFilters();
  });
}