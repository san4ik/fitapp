document.addEventListener('DOMContentLoaded', () => {
    // --- Global Variables ---
    let allVideosFlat = []; // Stores a flat list of all videos with category path info
    let allCategories = []; // Stores the original nested category structure from JSON
    let selectedCategoryPath = null; // Stores the path array (e.g., ['Бонусные', 'Дыхание']) of the selected category

    // --- DOM Elements ---
    const videoGrid = document.getElementById('video-grid');
    const categoryTreeContainer = document.getElementById('category-tree');
    const durationFilter = document.getElementById('duration-filter');
    const resetFiltersButton = document.getElementById('reset-filters');

    // --- Check if essential elements exist ---
    if (!videoGrid || !categoryTreeContainer || !durationFilter || !resetFiltersButton) {
        console.error("Initialization failed: Essential DOM elements not found. Check HTML IDs.");
        // Display a user-friendly error if possible
        if (videoGrid) videoGrid.innerHTML = '<p class="no-results-message" style="color: red;">Ошибка: Необходимые элементы страницы не найдены.</p>';
        return; // Stop execution
    }

    // --- Helper Functions ---

    /**
     * Recursively flattens the nested category structure from JSON.
     * Adds 'categoryPath' (array of names from root) and 'displayCategory' (immediate parent name)
     * to each video object.
     * @param {Array} categories - The array of category objects (or subcategories).
     * @param {Array} path - The current path array being built.
     * @param {Array} flatList - The accumulating flat list of videos.
     * @returns {Array} - The final flat list of video objects.
     */
    function flattenVideos(categories, path = [], flatList = []) {
        categories.forEach(category => {
            const currentPath = [...path, category.name]; // Create new path array for this level

            // Process videos directly under this category
            if (category.videos && Array.isArray(category.videos)) {
                category.videos.forEach(video => {
                    // Basic validation for video object
                    if (video && typeof video === 'object' && video.id && video.title && video.link) {
                         flatList.push({
                            ...video,
                            categoryPath: currentPath,         // Full path, e.g., ['Бонусные', 'Дыхание']
                            displayCategory: category.name     // Direct parent category name, e.g., 'Дыхание'
                        });
                    } else {
                        console.warn("Skipping invalid video object in category:", category.name, video);
                    }
                });
            }

            // Recursively process subcategories
            if (category.subcategories && Array.isArray(category.subcategories)) {
                flattenVideos(category.subcategories, currentPath, flatList);
            }
        });
        return flatList;
    }

    /**
     * Recursively builds the HTML unordered list (<ul>) structure for the category tree.
     * @param {Array} categories - Array of category objects to build the tree from.
     * @param {Array} path - The current path array being built (used for data attribute).
     * @returns {string} - The HTML string for the category tree level.
     */
    function buildCategoryTreeHTML(categories, path = []) {
        // Start the list for the current level
        let html = '<ul>';

        categories.forEach(category => {
            // Create the path for this category
            const currentPath = [...path, category.name];
            // Stringify the path array to store it safely in a data attribute
            const pathString = JSON.stringify(currentPath);

            html += `<li>`;
            // Create the clickable span for the category name
            // Store the full path in the 'data-path' attribute
            html += `<span class="category-name" data-path='${pathString}'>${category.name}</span>`;

            // If there are subcategories, recursively call this function to build the nested list
            if (category.subcategories && category.subcategories.length > 0) {
                html += buildCategoryTreeHTML(category.subcategories, currentPath);
            }
            html += `</li>`;
        });

        // Close the list for the current level
        html += '</ul>';
        return html;
    }

    /**
     * Renders the provided list of video objects as tiles in the video grid.
     * @param {Array} videosToRender - An array of video objects to display.
     */
    function renderVideos(videosToRender) {
        videoGrid.innerHTML = ''; // Clear the grid first

        // Display a message if no videos match the filters
        if (!videosToRender || videosToRender.length === 0) {
            videoGrid.innerHTML = '<p class="no-results-message">Видео по вашим критериям не найдены.</p>';
            return;
        }

        // Create and append a tile for each video
        videosToRender.forEach(video => {
            const tile = document.createElement('div');
            tile.classList.add('video-tile');
            tile.dataset.id = video.id; // Add video ID as data attribute (optional)

            // Use categoryPath for tooltip, displayCategory for the badge text
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

    /**
     * Filters the `allVideosFlat` list based on the currently selected
     * `selectedCategoryPath` and duration filter, then renders the results.
     */
    function filterAndRenderVideos() {
        const selectedDuration = durationFilter.value;
        let filteredVideos = allVideosFlat; // Start with all videos

        // 1. Filter by Category Path
        if (selectedCategoryPath && Array.isArray(selectedCategoryPath)) {
            filteredVideos = filteredVideos.filter(video => {
                // Video must have a category path defined
                if (!video.categoryPath || !Array.isArray(video.categoryPath)) {
                    return false;
                }
                // Video's path must be at least as long as the selected path
                if (video.categoryPath.length < selectedCategoryPath.length) {
                    return false;
                }
                // Check if the video's path starts exactly with the selected path
                return selectedCategoryPath.every((pathElement, index) => pathElement === video.categoryPath[index]);
            });
        }

        // 2. Filter by Duration
        if (selectedDuration !== 'all') {
            filteredVideos = filteredVideos.filter(video => {
                const duration = video.duration;
                // Ensure duration is a number before comparing
                if (typeof duration !== 'number') return false;

                if (selectedDuration === 'short') return duration < 20;
                if (selectedDuration === 'medium') return duration >= 20 && duration <= 35;
                if (selectedDuration === 'long') return duration > 35;
                return false; // Should not happen with current options
            });
        }

        // Render the filtered list
        renderVideos(filteredVideos);
    }

    /**
     * Handles click events within the category tree container.
     * Identifies clicks on category names, updates selection state, and triggers filtering.
     * @param {Event} event - The click event object.
     */
    function handleCategoryClick(event) {
        const target = event.target;

        // Check if the clicked element is a category name span
        if (target.classList.contains('category-name')) {
            // Find all currently active categories (should normally be one)
            const currentActiveElements = categoryTreeContainer.querySelectorAll('.category-name.active');

            // Get the path array from the clicked element's data attribute
            const pathString = target.getAttribute('data-path');
            let clickedPath = null;
            try {
                clickedPath = JSON.parse(pathString);
            } catch (e) {
                console.error("Failed to parse category path:", pathString, e);
                return; // Don't proceed if path is invalid
            }

            // If clicking the already active category, deselect it
            if (currentActiveElements.length === 1 && currentActiveElements[0] === target) {
                // Clicking the already active category -> deselect
                selectedCategoryPath = null;
                target.classList.remove('active');
            } else {
                // Deselect any existing active categories
                currentActiveElements.forEach(el => el.classList.remove('active'));
                // Set new selection
                selectedCategoryPath = clickedPath;
                target.classList.add('active');
            }

            // Re-filter and render videos based on the new selection
            filterAndRenderVideos();
        }
    }

    /**
     * Resets all filters (category and duration) to their default state
     * and renders all videos.
     */
    function resetFilters() {
        // Clear category selection
        selectedCategoryPath = null;
        // Remove highlight from any active categories
        const activeNodes = categoryTreeContainer.querySelectorAll('.category-name.active');
        activeNodes.forEach(node => node.classList.remove('active'));

        // Reset duration dropdown
        durationFilter.value = 'all';

        // Re-render with all videos
        filterAndRenderVideos();
    }

    // --- Main Initialization Function ---
    async function initializeApp() {
        try {
            // Show loading states
            videoGrid.innerHTML = '<p class="loading-message">Загрузка данных...</p>';
            categoryTreeContainer.innerHTML = '<p>Загрузка категорий...</p>';

            // Fetch category and video data from the JSON file
            // In a real deployment, ensure 'data.json' is in the same directory or provide the correct path.
            const response = await fetch('data.json');
            if (!response.ok) {
                // Throw an error if the fetch failed (e.g., 404 Not Found)
                throw new Error(`HTTP error! status: ${response.status} - Failed to fetch data.json`);
            }
            allCategories = await response.json();

            // --- Data Processing ---
            // Flatten the video data for easier filtering
            allVideosFlat = flattenVideos(allCategories);
            console.log(`Processed ${allVideosFlat.length} videos total.`); // Log for debugging

            // --- UI Building ---
            // Build the category tree HTML and insert it into the container
            categoryTreeContainer.innerHTML = buildCategoryTreeHTML(allCategories);

            // --- Initial Render ---
            // Display all videos initially (or based on default filters if any)
            filterAndRenderVideos(); // Use filter function for consistency

            // --- Add Event Listeners ---
            // Listen for clicks within the category tree (uses event delegation)
            categoryTreeContainer.addEventListener('click', handleCategoryClick);
            // Listen for changes in the duration dropdown
            durationFilter.addEventListener('change', filterAndRenderVideos);
            // Listen for clicks on the reset button
            resetFiltersButton.addEventListener('click', resetFilters);

            console.log("Application initialized successfully.");

        } catch (error) {
            // Catch any errors during initialization (fetch, JSON parse, etc.)
            console.error("Failed to initialize the app:", error);
            // Display user-friendly error messages
            videoGrid.innerHTML = `<p class="no-results-message" style="color: red;">Ошибка загрузки данных: ${error.message}. Проверьте файл data.json и сетевое соединение.</p>`;
            categoryTreeContainer.innerHTML = '<p style="color: red;">Ошибка загрузки категорий.</p>';
        }
    }

    // --- Start the application ---
    initializeApp();

}); // End DOMContentLoaded
