
document.addEventListener('DOMContentLoaded', () => {
    // --- Global Variables ---
    let allVideosFlat = [];
    let allCategories = [];
    let topLevelTabs = [];
    let selectedTabId = null;
    let selectedChipId = null;
    let favorites = new Set();

    // --- DOM Elements ---
    const videoGrid = document.getElementById('video-grid');
    const tabsContainer = document.getElementById('tabs');
    const chipsContainer = document.getElementById('chips');
    const durationFilter = document.getElementById('duration-filter');

    // --- Check if essential elements exist ---
    if (!videoGrid || !tabsContainer || !chipsContainer || !durationFilter) {
        console.error("Initialization failed: Essential DOM elements not found.");
        if (videoGrid) videoGrid.innerHTML = '<p class="no-results-message" style="color: red;">Ошибка: Необходимые элементы страницы не найдены.</p>';
        return;
    }

    // --- Helper Functions ---

    /**
     * Load favorites from localStorage
     */
    function loadFavorites() {
        try {
            const stored = localStorage.getItem('fitness_favorites');
            if (stored) {
                favorites = new Set(JSON.parse(stored));
            }
        } catch (error) {
            console.warn('Failed to load favorites from localStorage:', error);
            favorites = new Set();
        }
    }

    /**
     * Save favorites to localStorage
     */
    function saveFavorites() {
        try {
            localStorage.setItem('fitness_favorites', JSON.stringify([...favorites]));
        } catch (error) {
            console.warn('Failed to save favorites to localStorage:', error);
        }
    }

    /**
     * Toggle favorite status of a video
     */
    function toggleFavorite(videoId) {
        if (favorites.has(videoId)) {
            favorites.delete(videoId);
        } else {
            favorites.add(videoId);
        }
        saveFavorites();
        updateFavoritesCount();
        updateVideoHearts();
    }

    /**
     * Update favorites count badge
     */
    function updateFavoritesCount() {
        const heartTab = document.querySelector('.heart-tab');
        if (!heartTab) return;
        
        let countBadge = heartTab.querySelector('.favorites-count');
        if (favorites.size > 0) {
            if (!countBadge) {
                countBadge = document.createElement('span');
                countBadge.className = 'favorites-count';
                heartTab.appendChild(countBadge);
            }
            countBadge.textContent = favorites.size;
        } else if (countBadge) {
            countBadge.remove();
        }
    }

    /**
     * Update heart icons for all visible videos
     */
    function updateVideoHearts() {
        document.querySelectorAll('.favorite-heart').forEach(heart => {
            const videoId = heart.dataset.videoId;
            if (favorites.has(videoId)) {
                heart.classList.add('favorited');
            } else {
                heart.classList.remove('favorited');
            }
        });
    }

    /**
     * Import favorites from comma-separated IDs
     */
    function importFavorites(idsString) {
        if (!idsString.trim()) return 0;
        
        const ids = idsString.split(',').map(id => id.trim()).filter(id => id);
        let importedCount = 0;
        
        ids.forEach(id => {
            // Check if video exists
            const videoExists = allVideosFlat.some(video => video.id === id);
            if (videoExists) {
                favorites.add(id);
                importedCount++;
            }
        });
        
        saveFavorites();
        updateFavoritesCount();
        return importedCount;
    }

    /**
     * Export favorites as comma-separated IDs
     */
    function exportFavorites() {
        return [...favorites].join(', ');
    }

    /**
     * Processes the data structure into videos with category information.
     */
    function processVideos(data) {
        const flatList = [];
        const parentGroups = data.meta?.parent_groups || {};

        data.categories.forEach(category => {
            category.videos.forEach(video => {
                if (video && typeof video === 'object' && video.id && video.title && video.link) {
                    let categoryPath = [category.name];
                    let displayCategory = category.name;
                    let topLevelCategory = category.name;
                    
                    if (category.parent && parentGroups[category.parent]) {
                        categoryPath = [parentGroups[category.parent], category.name];
                        displayCategory = category.name;
                        topLevelCategory = parentGroups[category.parent];
                    }

                    flatList.push({
                        ...video,
                        categoryId: category.id,
                        categoryPath: categoryPath,
                        displayCategory: displayCategory,
                        topLevelCategory: topLevelCategory,
                        parentGroup: category.parent || null,
                        thumbnail: video.thumbnail || null
                    });
                }
            });
        });

        return flatList;
    }

    /**
     * Builds the tab structure for display.
     */
    function buildTabStructure(data) {
        const parentGroups = data.meta?.parent_groups || {};
        const tabs = [];
        const processedGroups = new Set();

        // Add favorites tab first (but only show if there are favorites or after first favorite is added)
        tabs.push({
            id: 'favorites',
            name: '♥',
            type: 'favorites'
        });

        // Process categories in order they appear in JSON
        data.categories.forEach(category => {
            if (category.parent) {
                // This is a subcategory - add its parent group as a tab if not already added
                if (!processedGroups.has(category.parent) && parentGroups[category.parent]) {
                    tabs.push({
                        id: category.parent,
                        name: parentGroups[category.parent],
                        type: 'group'
                    });
                    processedGroups.add(category.parent);
                }
            } else {
                // This is a standalone category - add as a tab
                tabs.push({
                    id: category.id,
                    name: category.name,
                    type: 'category'
                });
            }
        });

        return tabs;
    }

    /**
     * Gets subcategories for a given tab.
     */
    function getSubcategoriesForTab(data, tabId) {
        if (!tabId) return [];

        return data.categories.filter(category => {
            if (category.parent === tabId) {
                return true; // Subcategory of this parent group
            }
            return false;
        });
    }

    /**
     * Renders the tabs.
     */
    function renderTabs(tabs) {
        if (!tabs || tabs.length === 0) {
            tabsContainer.innerHTML = '<p>Категории не найдены</p>';
            return;
        }

        tabsContainer.innerHTML = '';
        
        // Determine which tab should be selected by default
        let defaultTabIndex = 0;
        if (favorites.size === 0) {
            // If no favorites, skip to second tab (first non-favorites tab)
            defaultTabIndex = 1;
        }
        
        tabs.forEach((tab, index) => {
            const tabElement = document.createElement('div');
            tabElement.classList.add('tab');
            tabElement.dataset.tabId = tab.id;
            
            if (tab.type === 'favorites') {
                tabElement.classList.add('heart-tab');
                tabElement.innerHTML = `
                    <div class="heart-icon">
                        <svg viewBox="0 0 24 24">
                            <path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5 2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"/>
                        </svg>
                    </div>
                `;
            } else {
                tabElement.textContent = tab.name;
            }
            
            // Select default tab
            if (index === defaultTabIndex) {
                tabElement.classList.add('active');
                selectedTabId = tab.id;
            }
            
            tabsContainer.appendChild(tabElement);
        });
        
        updateFavoritesCount();
    }

    /**
     * Renders chips for the selected tab.
     */
    function renderChips(data, tabId) {
        const subcategories = getSubcategoriesForTab(data, tabId);
        
        chipsContainer.innerHTML = '';
        
        if (subcategories.length === 0) {
            // No subcategories for this tab
            return;
        }

        subcategories.forEach(subcat => {
            const chipElement = document.createElement('div');
            chipElement.classList.add('chip');
            chipElement.dataset.chipId = subcat.id;
            chipElement.textContent = subcat.name;
            chipsContainer.appendChild(chipElement);
        });
    }

    /**
     * Renders videos in the grid.
     */
    function renderVideos(videosToRender) {
        // Handle empty favorites tab with import functionality
        if (selectedTabId === 'favorites' && favorites.size === 0) {
            videoGrid.innerHTML = `
                <div class="empty-favorites">
                    <div class="heart-icon">
                        <svg viewBox="0 0 24 24">
                            <path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5 2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z" fill="none" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </div>
                    <p>У вас пока нет избранных видео</p>
                    <p>Нажмите на сердечко на любом видео, чтобы добавить его в избранное</p>
                    <div class="favorites-management">
                        <h3>Импорт избранного</h3>
                        <div class="import-export-row">
                            <input type="text" class="import-input" placeholder="Введите ID видео через запятую..." id="import-favorites-input">
                            <button class="import-export-btn" onclick="handleImportFavorites()">Импорт</button>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        if (!videosToRender || videosToRender.length === 0) {
            videoGrid.innerHTML = '<p class="no-results-message">Видео по вашим критериям не найдены.</p>';
            return;
        }

        const videosHtml = videosToRender.map(video => {
            const categoryTooltip = video.categoryPath ? video.categoryPath.join(' > ') : 'Нет категории';
            const displayCat = video.displayCategory || 'Нет категории';
            
            const thumbnailHtml = video.thumbnail 
                ? `<div class="video-thumbnail">
                     <img src="${video.thumbnail}" alt="${video.title}" loading="lazy" onerror="this.style.display='none'">
                   </div>`
                : '';

            const isFavorited = favorites.has(video.id);

            return `
                <div class="video-tile" data-id="${video.id}">
                    <div class="favorite-heart ${isFavorited ? 'favorited' : ''}" data-video-id="${video.id}" onclick="handleHeartClick(event, '${video.id}')">
                        <svg viewBox="0 0 24 24">
                            <path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5 2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"/>
                        </svg>
                    </div>
                    <a href="${video.link}" target="_blank" rel="noopener noreferrer">
                        ${thumbnailHtml}
                        <div class="video-content">
                            <h3>${video.title || 'Без названия'}</h3>
                            <div class="details">
                                <span class="duration">${video.duration || '?'} мин</span>
                                <span class="category" title="${categoryTooltip}">${displayCat}</span>
                            </div>
                        </div>
                    </a>
                </div>
            `;
        }).join('');

        // Add import/export section at the end for favorites with content
        const favoritesManagement = selectedTabId === 'favorites' && favorites.size > 0 ? `
            <div class="favorites-management">
                <h3>Управление избранным</h3>
                <div class="import-export-row">
                    <input type="text" class="import-input" placeholder="Добавить ID видео через запятую..." id="import-favorites-input">
                    <button class="import-export-btn" onclick="handleImportFavorites()">Добавить</button>
                    <button class="import-export-btn secondary" onclick="handleExportFavorites()">Экспорт</button>
                </div>
            </div>
        ` : '';

        videoGrid.innerHTML = videosHtml;

        // Add favorites management as footer if on favorites tab with content
        if (selectedTabId === 'favorites' && favorites.size > 0) {
            const appContainer = document.querySelector('.app-container');
            let favoritesFooter = document.getElementById('favorites-footer');
            
            if (!favoritesFooter) {
                favoritesFooter = document.createElement('div');
                favoritesFooter.id = 'favorites-footer';
                favoritesFooter.className = 'favorites-footer';
                appContainer.appendChild(favoritesFooter);
            }
            
            favoritesFooter.innerHTML = `
                <div class="favorites-management">
                    <h3>Управление избранным</h3>
                    <div class="import-export-row">
                        <input type="text" class="import-input" placeholder="Добавить ID видео через запятую..." id="import-favorites-input">
                        <button class="import-export-btn" onclick="handleImportFavorites()">Добавить</button>
                        <button class="import-export-btn secondary" onclick="handleExportFavorites()">Экспорт</button>
                    </div>
                </div>
            `;
            favoritesFooter.style.display = 'block';
        } else {
            // Hide favorites footer if not on favorites tab or no favorites
            const favoritesFooter = document.getElementById('favorites-footer');
            if (favoritesFooter) {
                favoritesFooter.style.display = 'none';
            }
        }
    }

    /**
     * Filters and renders videos based on current selections.
     */
    function filterAndRenderVideos() {
        const selectedDuration = durationFilter.value;
        let filteredVideos = allVideosFlat;

        // Filter by selected tab
        if (selectedTabId) {
            if (selectedTabId === 'favorites') {
                // Show only favorited videos
                filteredVideos = filteredVideos.filter(video => favorites.has(video.id));
            } else {
                filteredVideos = filteredVideos.filter(video => {
                    // If a chip is selected, filter by that specific subcategory
                    if (selectedChipId) {
                        return video.categoryId === selectedChipId;
                    }
                    
                    // Otherwise, show videos from the selected tab
                    // If it's a group tab, show videos from all its subcategories
                    const tab = topLevelTabs.find(t => t.id === selectedTabId);
                    if (tab && tab.type === 'group') {
                        return video.parentGroup === selectedTabId;
                    } else {
                        // It's a standalone category
                        return video.categoryId === selectedTabId;
                    }
                });
            }
        }

        // Filter by duration
        if (selectedDuration !== 'all') {
            filteredVideos = filteredVideos.filter(video => {
                const duration = video.duration;
                if (typeof duration !== 'number') return false;

                if (selectedDuration === 'short') return duration < 20;
                if (selectedDuration === 'medium') return duration >= 20 && duration <= 35;
                if (selectedDuration === 'long') return duration > 35;
                return false;
            });
        }

        renderVideos(filteredVideos);
    }

    /**
     * Handles tab click events.
     */
    function handleTabClick(event) {
        const target = event.target.closest('.tab');
        
        if (target) {
            const clickedTabId = target.getAttribute('data-tab-id');
            
            // Update active tab
            tabsContainer.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            target.classList.add('active');
            
            selectedTabId = clickedTabId;
            selectedChipId = null; // Reset chip selection
            
            // Update chips for the new tab (hide chips for favorites tab)
            if (clickedTabId === 'favorites') {
                chipsContainer.innerHTML = '';
            } else {
                renderChips(allCategories, selectedTabId);
            }
            
            // Update videos
            filterAndRenderVideos();
        }
    }

    /**
     * Handles chip click events.
     */
    function handleChipClick(event) {
        const target = event.target;
        
        if (target.classList.contains('chip')) {
            const clickedChipId = target.getAttribute('data-chip-id');
            
            // Toggle chip selection
            if (selectedChipId === clickedChipId) {
                selectedChipId = null;
                target.classList.remove('active');
            } else {
                chipsContainer.querySelectorAll('.chip').forEach(chip => chip.classList.remove('active'));
                selectedChipId = clickedChipId;
                target.classList.add('active');
            }
            
            filterAndRenderVideos();
        }
    }

    // --- Global Functions for Event Handlers ---
    
    /**
     * Handle heart icon click
     */
    window.handleHeartClick = function(event, videoId) {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(videoId);
        
        // If we're on favorites tab and this video was unfavorited, refresh the view
        if (selectedTabId === 'favorites' && !favorites.has(videoId)) {
            filterAndRenderVideos();
        }
    };

    /**
     * Handle import favorites
     */
    window.handleImportFavorites = function() {
        const input = document.getElementById('import-favorites-input');
        if (!input) return;
        
        const idsString = input.value.trim();
        if (!idsString) return;
        
        const importedCount = importFavorites(idsString);
        input.value = '';
        
        if (importedCount > 0) {
            updateFavoritesCount();
            filterAndRenderVideos();
            alert(`Импортировано ${importedCount} видео в избранное`);
        } else {
            alert('Не найдено подходящих видео для импорта');
        }
    };

    /**
     * Handle export favorites
     */
    window.handleExportFavorites = function() {
        if (favorites.size === 0) {
            alert('Нет избранных видео для экспорта');
            return;
        }
        
        const exportString = exportFavorites();
        
        // Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(exportString).then(() => {
                alert(`Экспортировано ${favorites.size} ID в буфер обмена`);
            }).catch(() => {
                // Fallback for clipboard
                showExportModal(exportString);
            });
        } else {
            // Fallback for older browsers
            showExportModal(exportString);
        }
    };

    /**
     * Show export modal as fallback
     */
    function showExportModal(exportString) {
        const modal = prompt('Скопируйте список ID избранных видео:', exportString);
    }

    // --- Main Initialization Function ---
    async function initializeApp() {
        try {
            videoGrid.innerHTML = '<p class="loading-message">Загрузка данных...</p>';
            tabsContainer.innerHTML = '<p>Загрузка категорий...</p>';

            // Load favorites first
            loadFavorites();

            const response = await fetch('data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // Process data
            allVideosFlat = processVideos(data);
            allCategories = data; // Store for chip rendering
            topLevelTabs = buildTabStructure(data);
            
            console.log(`Processed ${allVideosFlat.length} videos total.`);

            // Render tabs (will auto-select appropriate default tab)
            renderTabs(topLevelTabs);
            
            // Render chips for the selected tab (if any)
            if (selectedTabId && selectedTabId !== 'favorites') {
                renderChips(data, selectedTabId);
            }

            // Initial video render
            filterAndRenderVideos();

            // Add event listeners
            tabsContainer.addEventListener('click', handleTabClick);
            chipsContainer.addEventListener('click', handleChipClick);
            durationFilter.addEventListener('change', filterAndRenderVideos);

            console.log("Application initialized successfully.");

        } catch (error) {
            console.error("Failed to initialize the app:", error);
            videoGrid.innerHTML = `<p class="no-results-message" style="color: red;">Ошибка загрузки данных: ${error.message}</p>`;
            tabsContainer.innerHTML = '<p style="color: red;">Ошибка загрузки категорий.</p>';
        }
    }

    initializeApp();
});
