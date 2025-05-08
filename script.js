document.addEventListener('DOMContentLoaded', () => {
    // --- Global Variables ---
    let allVideosFlat = [];
    let allCategories = [];
    let selectedCategoryPath = null;
    let currentDurationFilter = 'all'; // For toggle buttons

    // --- DOM Elements ---
    const videoGrid = document.getElementById('video-grid');
    const categoryTreeContainer = document.getElementById('category-tree');
    // const durationFilter = document.getElementById('duration-filter'); // Replaced
    const durationToggleButtonsContainer = document.getElementById('duration-toggle-buttons');
    const resetFiltersButton = document.getElementById('reset-filters');

    // --- Check if essential elements exist ---
    if (!videoGrid || !categoryTreeContainer || !durationToggleButtonsContainer || !resetFiltersButton) {
        console.error("Initialization failed: Essential DOM elements not found. Check HTML IDs.");
        if (videoGrid) videoGrid.innerHTML = '<p class="no-results-message" style="color: red;">Ошибка: Необходимые элементы страницы не найдены.</p>';
        return;
    }

    // --- Helper Functions ---
    function flattenVideos(categories, path = [], flatList = []) {
        categories.forEach(category => {
            const currentPath = [...path, category.name];
            if (category.videos && Array.isArray(category.videos)) {
                category.videos.forEach(video => {
                    if (video && typeof video === 'object' && video.id && video.title && video.link) {
                         flatList.push({
                            ...video,
                            categoryPath: currentPath,
                            displayCategory: category.name
                        });
                    } else {
                        console.warn("Skipping invalid video object in category:", category.name, video);
                    }
                });
            }
            if (category.subcategories && Array.isArray(category.subcategories)) {
                flattenVideos(category.subcategories, currentPath, flatList);
            }
        });
        return flatList;
    }

    function buildCategoryTreeHTML(categories, path = []) {
        let html = '<ul>';
        categories.forEach(category => {
            const currentPath = [...path, category.name];
            const pathString = JSON.stringify(currentPath);
            const hasSubcategories = category.subcategories && category.subcategories.length > 0;

            // Add 'initially-collapsed' if it has subcategories to apply default collapsed state via CSS if needed
            // Though JS will set display:none directly
            html += `<li class="${hasSubcategories ? 'has-subcategories' : ''}">`;
            html += `<div class="category-item">`; // Wrapper for name and toggle
            html += `<span class="category-name" data-path='${pathString}'>${category.name}</span>`;
            if (hasSubcategories) {
                html += `<span class="toggle-icon" role="button" aria-expanded="false">▶</span>`; // Icon indicates collapsed
            }
            html += `</div>`; // Close category-item

            if (hasSubcategories) {
                // Subcategories are hidden by default using inline style
                html += `<div class="subcategory-list" style="display: none;">`;
                html += buildCategoryTreeHTML(category.subcategories, currentPath);
                html += `</div>`; // Close subcategory-list
            }
            html += `</li>`;
        });
        html += '</ul>';
        return html;
    }

    function renderVideos(videosToRender) {
        videoGrid.innerHTML = '';
        if (!videosToRender || videosToRender.length === 0) {
            videoGrid.innerHTML = '<p class="no-results-message">Видео по вашим критериям не найдены.</p>';
            return;
        }
        videosToRender.forEach(video => {
            const tile = document.createElement('div');
            tile.classList.add('video-tile');
            tile.dataset.id = video.id;
            const categoryTooltip = video.categoryPath ? video.categoryPath.join(' > ') : 'Нет категории';
            const displayCat = video.displayCategory || 'Нет категории';
            tile.innerHTML = `
                <a href="${video.link}" target="_blank" rel="noopener noreferrer">
                    <h3>${video.title || 'Без названия'}</h3>
                    <div class="details">
                        <span class="duration">${video.duration || '?'} мин</span>
                        <span class="category" title="${categoryTooltip}">${displayCat}</span>
                    </div>
                </a>
            `;
            videoGrid.appendChild(tile);
        });
    }

    function filterAndRenderVideos() {
        const selectedDuration = currentDurationFilter; // Use new variable
        let filteredVideos = allVideosFlat;

        if (selectedCategoryPath && Array.isArray(selectedCategoryPath)) {
            filteredVideos = filteredVideos.filter(video => {
                if (!video.categoryPath || !Array.isArray(video.categoryPath)) return false;
                if (video.categoryPath.length < selectedCategoryPath.length) return false;
                return selectedCategoryPath.every((pathElement, index) => pathElement === video.categoryPath[index]);
            });
        }

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

    function handleCategoryTreeInteraction(event) {
        const target = event.target;

        // Handle category name click for filtering
        if (target.classList.contains('category-name')) {
            const currentActive = categoryTreeContainer.querySelector('.category-name.active');
            const pathString = target.getAttribute('data-path');
            let clickedPath = null;
            try {
                clickedPath = JSON.parse(pathString);
            } catch (e) {
                console.error("Failed to parse category path:", pathString, e);
                return;
            }

            if (currentActive === target) {
                selectedCategoryPath = null;
                target.classList.remove('active');
            } else {
                if (currentActive) {
                    currentActive.classList.remove('active');
                }
                selectedCategoryPath = clickedPath;
                target.classList.add('active');
            }
            filterAndRenderVideos();
        }

        // Handle toggle icon click for collapsing/expanding
        if (target.classList.contains('toggle-icon')) {
            const listItem = target.closest('li.has-subcategories');
            if (listItem) {
                const subcategoryList = listItem.querySelector('.subcategory-list');
                if (subcategoryList) {
                    const isExpanded = subcategoryList.style.display === 'block';
                    subcategoryList.style.display = isExpanded ? 'none' : 'block';
                    target.textContent = isExpanded ? '▶' : '▼'; // Update icon
                    target.setAttribute('aria-expanded', !isExpanded);
                }
            }
        }
    }

    function resetFilters() {
        selectedCategoryPath = null;
        const currentActiveCategory = categoryTreeContainer.querySelector('.category-name.active');
        if (currentActiveCategory) {
            currentActiveCategory.classList.remove('active');
        }

        // Collapse all categories
        const allSubcategoryLists = categoryTreeContainer.querySelectorAll('.subcategory-list');
        allSubcategoryLists.forEach(list => list.style.display = 'none');
        const allToggleIcons = categoryTreeContainer.querySelectorAll('.toggle-icon');
        allToggleIcons.forEach(icon => {
            icon.textContent = '▶';
            icon.setAttribute('aria-expanded', 'false');
        });


        // Reset duration toggle buttons
        currentDurationFilter = 'all';
        const currentActiveButton = durationToggleButtonsContainer.querySelector('.duration-toggle-btn.active');
        if (currentActiveButton) {
            currentActiveButton.classList.remove('active');
        }
        const allButton = durationToggleButtonsContainer.querySelector('.duration-toggle-btn[data-value="all"]');
        if (allButton) {
            allButton.classList.add('active');
        }

        filterAndRenderVideos();
    }

    async function initializeApp() {
        try {
            videoGrid.innerHTML = '<p class="loading-message">Загрузка данных...</p>';
            categoryTreeContainer.innerHTML = '<p>Загрузка категорий...</p>';

            const response = await fetch('data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - Failed to fetch data.json`);
            }
            allCategories = await response.json();
            allVideosFlat = flattenVideos(allCategories);
            console.log(`Processed ${allVideosFlat.length} videos total.`);

            categoryTreeContainer.innerHTML = buildCategoryTreeHTML(allCategories);
            filterAndRenderVideos();

            // Event Listeners
            categoryTreeContainer.addEventListener('click', handleCategoryTreeInteraction);

            if (durationToggleButtonsContainer) {
                durationToggleButtonsContainer.addEventListener('click', (event) => {
                    if (event.target.classList.contains('duration-toggle-btn')) {
                        const currentActiveBtn = durationToggleButtonsContainer.querySelector('.duration-toggle-btn.active');
                        if (currentActiveBtn) {
                            currentActiveBtn.classList.remove('active');
                        }
                        event.target.classList.add('active');
                        currentDurationFilter = event.target.dataset.value;
                        filterAndRenderVideos();
                    }
                });
            }
            resetFiltersButton.addEventListener('click', resetFilters);

            console.log("Application initialized successfully.");

        } catch (error) {
            console.error("Failed to initialize the app:", error);
            videoGrid.innerHTML = `<p class="no-results-message" style="color: red;">Ошибка загрузки данных: ${error.message}. Проверьте файл data.json и сетевое соединение.</p>`;
            categoryTreeContainer.innerHTML = '<p style="color: red;">Ошибка загрузки категорий.</p>';
        }
    }

    initializeApp();
});
