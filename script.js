class VocabularyApp {
    constructor() {

        // Prevent multiple initializations
        if (window.vocabularyAppInitialized) {
            console.warn('VocabularyApp already initialized, returning existing instance');
            return window.appInstance;
        }

        window.vocabularyAppInitialized = true;
        window.appInstance = this;
        this.db = null;
        this.words = [];
        this.filteredWords = [];
        this.currentWordIndex = 0;
        this.personalWords = new Set();
        this.wordMastery = new Map();
        this.testState = {};
        this.isLoading = true;
        this.streak = 0;
        this.charts = {};

        // Pagination properties
        this.currentPage = 1;
        this.pageSize = 50;
        this.totalPages = 1;
        this.allWords = [];
        this.displayedWords = [];

        // Initialize missing methods to prevent errors
        this.setupPersonalWordsEventDelegation = this.setupPersonalWordsEventDelegation || function () {
            console.warn('setupPersonalWordsEventDelegation not implemented');
        };

        this.escapeString = this.escapeString || function (str) {
            if (!str) return '';
            return str
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/"/g, '\\"')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t')
                .replace(/\f/g, '\\f');
        };

        this.togglePersonalWord = this.togglePersonalWord || function (word) {
            if (this.personalWords.has(word)) {
                this.removeFromPersonalWords(word);
            } else {
                this.addToPersonalWords(word);
            }
        };

        // Don't auto-init, wait for DOM to be ready
        this.init().catch(error => {
            console.error('App initialization failed:', error);
        });
    }

    async init() {
        this.showLoading('Vocabulary Master', 'Initializing application...');
        this.updateLoadingProgress(10);

        await this.initDB();
        this.updateLoadingMessage('Database initialized', 20);

        await this.loadPersonalWords();
        this.updateLoadingMessage('Loading personal words...', 30);

        await this.loadWordMastery();
        this.updateLoadingMessage('Loading word mastery data...', 40);

        await this.loadStreak();
        this.updateLoadingMessage('Loading learning streak...', 50);

        // Check if we have words in DB
        const hasWords = await this.checkIfHasWords();

        if (!hasWords) {
            this.updateLoadingMessage('No dictionary found', 60);
            // Show upload interface if no words found
            this.showDictionaryUpload();
        } else {
            // Load words from DB
            this.updateLoadingMessage('Loading dictionary from database...', 60);
            await this.loadWordsFromDB();
            this.initializeApp();
        }
    }

    testDropdownFunctionality() {


        const genreDropdown = document.getElementById('genreDropdown');
        if (!genreDropdown) {
            console.error('Genre dropdown not found');
            return;
        }

        const options = genreDropdown.querySelectorAll('.dropdown-option');


        // Simulate a click on the first non-"all" option
        const firstGenreOption = Array.from(options).find(opt => opt.dataset.value !== 'all');
        if (firstGenreOption) {


            // Manually trigger the click to see if it works
            firstGenreOption.addEventListener('click', function () {

            }, { once: true });


        }

        // Test if dropdown header responds to clicks
        const dropdownHeader = genreDropdown.querySelector('.dropdown-selected');
        if (dropdownHeader) {
            dropdownHeader.addEventListener('click', function () {

            }, { once: true });
        }
    }

    showWelcomeMessage() {
        if (!localStorage.getItem('appFirstLaunch')) {
            this.showNotification('Welcome to Vocabulary Master! Start by exploring the dictionary or adding words to your personal list.', 'success');
            localStorage.setItem('appFirstLaunch', 'true');
        }
    }

    populateGenreDropdowns() {
        if (this.words.length === 0) {
            console.warn('No words available to populate genres');
            return;
        }

        // Get all unique genres from words
        const genreCounts = this.countWordsByGenre();


        // Sort genres by count (descending)
        const sortedGenres = Object.entries(genreCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([genre]) => genre);



        // Update flashcard genre dropdown
        this.updateDropdownWithGenres('genreDropdown', sortedGenres, genreCounts);

        // Update test genre dropdown
        this.updateDropdownWithGenres('testGenreDropdown', sortedGenres, genreCounts);


    }

    updateDropdownWithGenres(dropdownId, genres, genreCounts) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) {
            console.warn(`Dropdown ${dropdownId} not found`);
            return;
        }

        const optionsContainer = dropdown.querySelector('.dropdown-options');
        if (!optionsContainer) {
            console.warn(`Options container not found in ${dropdownId}`);
            return;
        }

        // Store the currently selected value
        const currentSelected = dropdown.querySelector('.dropdown-option.selected');
        const currentValue = currentSelected ? currentSelected.dataset.value : 'all';

        // Clear existing options (except "All Genres")
        const allOption = optionsContainer.querySelector('.dropdown-option[data-value="all"]');
        optionsContainer.innerHTML = '';
        if (allOption) {
            // Reset the "All Genres" option
            allOption.classList.remove('selected');
            optionsContainer.appendChild(allOption);
        }

        // Add genre options with counts
        genres.forEach(genre => {
            const count = genreCounts[genre] || 0;
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.dataset.value = genre;
            option.textContent = `${this.formatGenreName(genre)} (${count})`;

            // Mark as selected if it was previously selected
            if (genre === currentValue) {
                option.classList.add('selected');
                // Also update the dropdown header
                const selectedSpan = dropdown.querySelector('.dropdown-selected span');
                if (selectedSpan) {
                    selectedSpan.textContent = option.textContent;
                }
            }

            optionsContainer.appendChild(option);
        });

        // Update the "All Genres" option with total count
        if (allOption) {
            const total = Object.values(genreCounts).reduce((sum, val) => sum + val, 0);
            allOption.textContent = `All Genres (${total})`;

            // If "all" was selected, keep it selected
            if (currentValue === 'all') {
                allOption.classList.add('selected');
                const selectedSpan = dropdown.querySelector('.dropdown-selected span');
                if (selectedSpan) {
                    selectedSpan.textContent = allOption.textContent;
                }
            }
        }



        // Re-initialize the dropdown to capture new option clicks
        this.reinitializeDropdown(dropdownId);
    }

    // Add this method to reinitialize dropdowns
    reinitializeDropdown(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;

        // Trigger a custom event to reinitialize
        setTimeout(() => {
            dropdown.dispatchEvent(new Event('reinitialize'));
        }, 100);
    }

    formatGenreName(genre) {
        if (!genre || genre.trim() === '') {
            return 'General';
        }

        return genre
            .replace(/_/g, ' ')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .replace('Academ', 'Academic')
            .replace('Scien', 'Science')
            .replace('Tech', 'Technology')
            .replace('Medic', 'Medical');
    }

    countWordsByDifficulty() {
        const counts = { easy: 0, medium: 0, hard: 0 };
        this.words.forEach(word => {
            counts[word.difficulty] = (counts[word.difficulty] || 0) + 1;
        });
        return counts;
    }

    countWordsByGenre() {
        const counts = {};
        this.words.forEach(word => {
            const genre = word.genre || 'general';
            counts[genre] = (counts[genre] || 0) + 1;
        });
        return counts;
    }

    countPersonalWordsByDifficulty() {
        const counts = { easy: 0, medium: 0, hard: 0 };
        Array.from(this.personalWords).forEach(wordStr => {
            const word = this.words.find(w => w.word === wordStr);
            if (word) {
                counts[word.difficulty] = (counts[word.difficulty] || 0) + 1;
            }
        });
        return counts;
    }

    countPersonalWordsByGenre() {
        const counts = {};
        Array.from(this.personalWords).forEach(wordStr => {
            const word = this.words.find(w => w.word === wordStr);
            if (word) {
                const genre = word.genre || 'general';
                counts[genre] = (counts[genre] || 0) + 1;
            }
        });
        return counts;
    }

    // Method to update dropdown with counts
    updateDropdownWithCounts(dropdownId, counts, allText = 'All') {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;

        const options = dropdown.querySelectorAll('.dropdown-option');
        options.forEach(option => {
            const value = option.dataset.value;
            let count = 0;

            if (value === 'all') {
                // For "All" option, show total count
                const total = Object.values(counts).reduce((sum, val) => sum + val, 0);
                option.textContent = `${allText} (${total})`;
            } else if (counts[value]) {
                // For specific values, show their count
                option.textContent = `${option.textContent.split(' (')[0]} (${counts[value]})`;
            }
        });
    }

    // Add debounce utility function at the top of the VocabularyApp class
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Pagination 
    updatePaginationControls() {
        const controls = document.getElementById('paginationControls');
        if (!controls) {
            console.warn('Pagination controls not found in DOM');
            return;
        }

        const totalWords = this.displayedWords.length; // Use displayedWords instead of allWords
        const startIndex = (this.currentPage - 1) * this.pageSize + 1;
        const endIndex = Math.min(this.currentPage * this.pageSize, totalWords);

        // Safe element updates
        this.safeUpdateElement('pageStart', startIndex.toLocaleString());
        this.safeUpdateElement('pageEnd', endIndex.toLocaleString());
        this.safeUpdateElement('totalDisplayWords', totalWords.toLocaleString());
        this.safeUpdateElement('currentPage', this.currentPage);
        this.safeUpdateElement('totalPages', this.totalPages);

        // Safe button state updates
        this.safeUpdateButtonState('firstPage', this.currentPage === 1);
        this.safeUpdateButtonState('prevPage', this.currentPage === 1);
        this.safeUpdateButtonState('nextPage', this.currentPage === this.totalPages);
        this.safeUpdateButtonState('lastPage', this.currentPage === this.totalPages);

        // Generate page numbers
        this.generatePageNumbers();

        // Show controls if we have multiple pages
        controls.style.display = this.totalPages > 1 ? 'flex' : 'none';
    }

    safeUpdateElement(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    }

    safeUpdateButtonState(buttonId, disabled) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = disabled;
        }
    }

    generatePageNumbers() {
        const container = document.getElementById('pageNumbers');
        if (!container) return;

        container.innerHTML = '';

        const maxPagesToShow = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);

        // Adjust if we're near the end
        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        // Add first page if needed
        if (startPage > 1) {
            this.addPageNumber(1, container);
            if (startPage > 2) {
                this.addEllipsis(container);
            }
        }

        // Add page numbers
        for (let i = startPage; i <= endPage; i++) {
            this.addPageNumber(i, container);
        }

        // Add last page if needed
        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                this.addEllipsis(container);
            }
            this.addPageNumber(this.totalPages, container);
        }
    }

    addPageNumber(pageNumber, container) {
        const pageElement = document.createElement('button');
        pageElement.className = `page-number ${pageNumber === this.currentPage ? 'active' : ''}`;
        pageElement.textContent = pageNumber;
        pageElement.addEventListener('click', () => this.loadPage(pageNumber));
        container.appendChild(pageElement);
    }

    addEllipsis(container) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'page-ellipsis';
        ellipsis.textContent = '...';
        ellipsis.style.padding = '0.5rem';
        ellipsis.style.color = 'var(--text-secondary)';
        container.appendChild(ellipsis);
    }

    updatePageSize() {
        const pageSizeSelect = document.getElementById('pageSizeSelect');
        if (pageSizeSelect) {
            this.pageSize = parseInt(pageSizeSelect.value);
            this.totalPages = Math.ceil(this.allWords.length / this.pageSize);

            // Reset to first page with new size
            this.loadPage(1);
        }
    }

    safeAddEventListener(elementId, event, handler) {
        try {
            const element = document.getElementById(elementId);
            if (element) {

                element.addEventListener(event, handler);
            } else {
                console.warn(`Element with id '${elementId}' not found for event binding`);
            }
        } catch (error) {
            console.error(`Error adding event listener to ${elementId}:`, error);
        }
    }

    async checkIfHasWords() {
        try {
            const words = await this.getAllWordsFromDB();
            return words && words.length > 50; // Consider we have words if more than 50
        } catch (error) {
            return false;
        }
    }

    showDictionaryUpload() {
        this.hideLoading();
        document.getElementById('dictionaryUpload').style.display = 'flex';
        this.setupFileUploadListeners();
    }

    setupFileUploadListeners() {
        // JSON file upload
        document.getElementById('jsonFileInput').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0], 'json');
        });

        // JSONL file upload
        document.getElementById('jsonlFileInput').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0], 'jsonl');
        });

        // Sample words button
        document.getElementById('useSampleWords').addEventListener('click', () => {
            this.useSampleWords();
        });
    }

    // In handleFileUpload method
    async handleFileUpload(file, fileType) {
        if (!file) return;

        // Show file size warning for large files
        if (file.size > 10 * 1024 * 1024) { // 10MB
            const proceed = confirm(
                `This file is ${(file.size / (1024 * 1024)).toFixed(1)}MB. ` +
                `Processing may take a while. Continue?`
            );
            if (!proceed) return;
        }

        this.showLoading('Processing Dictionary', `Reading ${file.name}...`);
        this.updateLoadingProgress(5);
        document.getElementById('dictionaryUpload').style.display = 'none';

        try {
            this.updateLoadingMessage(`Reading file: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`, 10);

            const content = await this.readFileContent(file);
            let dictionary;

            // Try to parse as regular JSON first
            try {
                this.updateLoadingMessage('Parsing JSON data...', 20);
                dictionary = JSON.parse(content);


                // If it's a regular JSON object, check if it has the expected structure
                const keys = Object.keys(dictionary);
                const firstKey = keys[0];
                const firstValue = dictionary[firstKey];

                if (firstValue && firstValue.word && firstValue.definitions) {
                    // This is the new format in a single object

                    this.updateLoadingMessage('Detected dictionary format...', 25);
                } else if (firstValue && typeof firstValue === 'object') {
                    // This is old format where keys are words

                    this.updateLoadingMessage('Detected dictionary format...', 25);
                } else {
                    // Not a dictionary format, try JSONL
                    throw new Error('Not a dictionary format, trying JSONL');
                }

            } catch (jsonError) {
                this.updateLoadingMessage('Trying JSONL format...', 25);

                // Try to parse as JSONL (one object per line)
                dictionary = await this.parseJSONL(content);

            }

            // In handleFileUpload method, update the error checking:
            if (!dictionary || Object.keys(dictionary).length === 0) {
                console.error('Dictionary is empty or has no keys:', dictionary);
                console.error('First few lines of content:', content.substring(0, 500));
                throw new Error('No valid dictionary data found in file');
            }

            const wordCount = Object.keys(dictionary).length;
            this.updateLoadingMessage(`Found ${wordCount.toLocaleString()} words`, 30);


            // Process and save words
            this.updateLoadingMessage('Processing dictionary data...', 35);
            await this.processDictionaryDataWithProgress(dictionary);

            this.updateLoadingMessage('Saving to database...', 80);
            await this.saveWordsToDB(this.words);

            this.updateLoadingMessage('Finalizing setup...', 95);

            // Use setTimeout to ensure DOM is ready before initializing
            setTimeout(() => {
                this.initializeApp();
                this.showNotification(`Successfully loaded ${this.words.length.toLocaleString()} words!`);
            }, 100);

        } catch (error) {
            console.error('Error processing uploaded file:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
            this.showDictionaryUpload(); // Show upload again on error
        }
    }

    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));

            reader.readAsText(file);
        });
    }

    useSampleWords() {
        this.showLoading();
        document.getElementById('dictionaryUpload').style.display = 'none';

        this.words = this.getComprehensiveSampleWords();
        this.filteredWords = [...this.words];

        // Save sample words to DB for future use
        this.saveWordsToDB(this.words).then(() => {
            this.initializeApp();
            this.showNotification('Loaded sample words successfully!');
        });
    }

    initializeApp() {


        // Check if essential DOM elements exist
        const essentialElements = [
            'home', 'dictionary', 'personal', 'test', 'progress'
        ];

        const missingEssential = essentialElements.filter(id => !document.getElementById(id));
        if (missingEssential.length > 0) {
            console.warn('Missing essential DOM elements:', missingEssential);
            setTimeout(() => this.initializeApp(), 100);
            return;
        }

        setTimeout(() => {
            this.testDropdownFunctionality();
        }, 2000);

        try {
            this.setupEventListeners();
            this.setupCustomDropdowns();
            this.setupAccessibility();

            // Setup event delegation if methods exist
            if (typeof this.setupWordListEventDelegation === 'function') {
                this.setupWordListEventDelegation();
            }

            if (typeof this.setupPersonalWordsEventDelegation === 'function') {
                this.setupPersonalWordsEventDelegation();
            }

            // Initialize alphabet navigation with "All" selected
            if (document.getElementById('alphabetList')) {
                this.renderAlphabet();
                // Automatically select "All" by default
                setTimeout(() => {
                    this.highlightSelectedLetter('all');
                }, 100);
            }

            if (document.getElementById('flashcard') && this.filteredWords.length > 0) {
                this.updateFlashcard();
            } else if (this.filteredWords.length === 0 && this.words.length > 0) {
                // If filteredWords is empty but we have words, initialize it
                this.filteredWords = [...this.words];
                this.updateFlashcard();
            }

            this.updateProgressStats();
            this.updateDictionaryStats();

            // Update dropdowns with word counts
            this.updateAllDropdownCounts();

            // Populate genre dropdowns from actual data
            this.populateGenreDropdowns();

            // Initialize filter previews
            setTimeout(() => {
                this.updateFlashcardFilterCounts();
                this.updateTestFilterCounts();
            }, 500);

            // Initialize pagination controls if they exist
            if (this.paginationControlsExist()) {
                this.updatePaginationControls();
            }

            this.hideLoading();

            // Show welcome message
            this.showWelcomeMessage();

            // Show initial stats
            this.showNotification(`Loaded ${this.words.length.toLocaleString()} words from dictionary`, 'success');



        } catch (error) {
            console.error('Error during app initialization:', error);
            this.hideLoading();
            this.showNotification('Error initializing application', 'error');
        }
    }

    // Add this method to update all dropdown counts
    updateAllDropdownCounts() {
        if (this.words.length === 0) return;

        // Update flashcard filter dropdowns
        const difficultyCounts = this.countWordsByDifficulty();
        const genreCounts = this.countWordsByGenre();

        this.updateDropdownWithCounts('difficultyDropdown', difficultyCounts, 'All Difficulties');
        this.updateDropdownWithCounts('genreDropdown', genreCounts, 'All Genres');

        // Update test filter dropdowns
        this.updateDropdownWithCounts('testDifficultyDropdown', difficultyCounts, 'All Difficulties');
        this.updateDropdownWithCounts('testGenreDropdown', genreCounts, 'All Genres');

        // Update personal words filter dropdown
        const personalDifficultyCounts = this.countPersonalWordsByDifficulty();
        const personalGenreCounts = this.countPersonalWordsByGenre();

        this.updateDropdownWithCounts('personalFilterDropdown', {
            all: this.personalWords.size,
            new: Array.from(this.personalWords).filter(w => this.getMasteryLevel(w) === 'new').length,
            learning: Array.from(this.personalWords).filter(w => this.getMasteryLevel(w) === 'learning').length,
            known: Array.from(this.personalWords).filter(w => this.getMasteryLevel(w) === 'known').length,
            mastered: Array.from(this.personalWords).filter(w => this.getMasteryLevel(w) === 'mastered').length,
            trouble: Array.from(this.personalWords).filter(w => this.getMasteryLevel(w) === 'trouble').length
        }, 'All Words');
    }

    // Initialize IndexedDB with larger version for more words
    initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('VocabularyApp', 4); // Increased version

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('words')) {
                    const wordsStore = db.createObjectStore('words', { keyPath: 'word' });
                    wordsStore.createIndex('difficulty', 'difficulty', { unique: false });
                    wordsStore.createIndex('genre', 'genre', { unique: false });
                }
                if (!db.objectStoreNames.contains('personalWords')) {
                    db.createObjectStore('personalWords', { keyPath: 'word' });
                }
                if (!db.objectStoreNames.contains('testHistory')) {
                    db.createObjectStore('testHistory', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('wordMastery')) {
                    db.createObjectStore('wordMastery', { keyPath: 'word' });
                }
                if (!db.objectStoreNames.contains('streak')) {
                    db.createObjectStore('streak', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('appState')) {
                    db.createObjectStore('appState', { keyPath: 'key' });
                }
            };
        });
    }

    async loadWordsFromDB() {
        this.showLoading('Loading Dictionary', 'Connecting to database...');
        this.updateLoadingProgress(10);

        try {
            this.updateLoadingMessage('Counting words in database...', 20);
            const wordCount = await this.countWordsInDB();

            this.updateLoadingStats({
                'Total Words': wordCount.toLocaleString(),
                'Status': 'Processing'
            });



            if (wordCount === 0) {
                throw new Error('No words found in database');
            }

            this.updateLoadingMessage('Loading words from database...', 40);
            // Load all words into memory for filtering/sorting
            this.allWords = await this.getAllWordsFromDB();
            this.words = this.allWords; // Keep reference for compatibility
            this.displayedWords = [...this.allWords]; // Initialize displayedWords with all words
            this.totalPages = Math.ceil(this.displayedWords.length / this.pageSize);

            this.updateLoadingMessage('Preparing dictionary interface...', 60);
            this.updateLoadingStats({
                'Total Words': this.allWords.length.toLocaleString(),
                'Total Pages': this.totalPages,
                'Words Per Page': this.pageSize,
                'Status': 'Ready'
            });

            // Load only the first page for display
            await this.loadPage(1);

            this.updateLoadingMessage('Finalizing setup...', 80);
            this.updateDictionaryStats();



            // Ensure dictionary shows all words by default
            setTimeout(() => {
                if (document.getElementById('dictionary')) {
                    this.filterWordsByLetter('all');
                }
            }, 500);

            this.updateLoadingMessage('Application ready!', 100);
            setTimeout(() => {
                this.hideLoading();
            }, 500);

        } catch (error) {
            console.warn('Could not load words from DB:', error);
            this.hideLoading();
            this.showDictionaryUpload();
            this.showNotification('Could not load words from database. Please re-upload your dictionary.', 'error');
        }
    }

    async loadPage(pageNumber) {
        if (pageNumber < 1 || pageNumber > this.totalPages) return;

        const startIndex = (pageNumber - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;

        // Use displayedWords (filtered results) instead of allWords
        const pageWords = this.displayedWords.slice(startIndex, endIndex);
        this.currentPage = pageNumber;

        // Render the current page of words
        this.renderWordList(pageWords);

        // Update pagination controls if they exist
        if (this.paginationControlsExist()) {
            // Update totalDisplayWords to show filtered count
            this.safeUpdateElement('totalDisplayWords', this.displayedWords.length.toLocaleString());
            this.updatePaginationControls();
        }


    }

    paginationControlsExist() {
        return document.getElementById('paginationControls') !== null;
    }

    setupPersonalWordsEventDelegation() {
        const personalListContainer = document.getElementById('personalWordList');
        if (personalListContainer) {
            personalListContainer.addEventListener('click', (e) => {
                const wordItem = e.target.closest('.word-item');
                if (!wordItem) return;

                const word = wordItem.dataset.word;

                // Handle view button click
                if (e.target.closest('[data-action="view-word"]')) {
                    e.stopPropagation();
                    this.showWordModal(word);
                    return;
                }

                // Handle remove button click
                if (e.target.closest('[data-action="remove-personal"]')) {
                    e.stopPropagation();
                    this.removeFromPersonalWords(word);
                    return;
                }

                // Handle entire word item click (opens modal)
                if (e.target.closest('.word-item') && !e.target.closest('.word-actions')) {
                    this.showWordModal(word);
                }
            });
        }
    }


    async loadWordsFromJSON() {
        try {
            this.showImportProgress();


            // First, try to load your custom dictionary format
            let dictionary = await this.loadDictionaryFile('my_offline_dictionary.json');

            if (!dictionary || Object.keys(dictionary).length === 0) {
                // If custom dictionary is empty, try the kaikki.org format
                dictionary = await this.loadDictionaryFile('kaikki.org-dictionary-English.jsonl');
            }

            if (!dictionary || Object.keys(dictionary).length === 0) {
                throw new Error('No dictionary data found');
            }


            await this.processDictionaryDataWithProgress(dictionary);

            // Save all words to IndexedDB for future use
            await this.saveWordsToDB(this.words);


            this.updateDictionaryStats();
            this.hideImportProgress();

        } catch (error) {
            console.error('Error loading dictionary:', error);
            // Fallback to comprehensive sample words
            this.words = this.getComprehensiveSampleWords();
            this.filteredWords = [...this.words];
            this.hideImportProgress();
            this.showNotification('Using sample words. Please check your dictionary file.', 'error');
        }
    }

    async loadDictionaryFile(filename) {
        try {
            const response = await fetch(filename);
            if (!response.ok) {
                throw new Error(`Failed to load ${filename}: ${response.status}`);
            }

            const fileExtension = filename.split('.').pop();

            if (fileExtension === 'jsonl') {
                // Handle JSONL format (kaikki.org)
                return await this.parseJSONL(await response.text());
            } else {
                // Handle regular JSON format
                return await response.json();
            }
        } catch (error) {
            console.warn(`Could not load ${filename}:`, error);
            return null;
        }
    }

    async parseJSONL(jsonlText) {
        const lines = jsonlText.trim().split('\n');
        const dictionary = {};


        let validWords = 0;
        let errorLines = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue; // Skip empty lines

            try {
                const wordData = JSON.parse(line);

                // For your format: each line is a complete word object with "word" field
                if (wordData && wordData.word) {
                    // Store with word as key
                    dictionary[wordData.word.toLowerCase()] = wordData;
                    validWords++;
                } else {
                    console.warn(`Line ${i + 1} doesn't have a 'word' field:`, wordData);
                    errorLines++;
                }
            } catch (e) {
                console.warn(`Failed to parse JSONL line ${i + 1}:`, e.message, 'Line:', line.substring(0, 100));
                errorLines++;
            }

            // Show progress for large files
            if (i % 1000 === 0) {

            }
        }



        if (validWords === 0) {
            throw new Error('No valid words found in JSONL file');
        }

        return dictionary;
    }

    async processDictionaryDataWithProgress(dictionary) {
        const words = [];
        const totalWords = Object.keys(dictionary).length;
        let processed = 0;

        // FIX: Define startTime here
        const startTime = Date.now();

        this.showLoading('Processing Dictionary', `Found ${totalWords.toLocaleString()} words to process`);
        this.updateLoadingProgress(0);



        // Process words in smaller batches to avoid memory issues
        const batchSize = 500;
        const wordEntries = Object.entries(dictionary);

        for (let i = 0; i < wordEntries.length; i += batchSize) {
            const batch = wordEntries.slice(i, i + batchSize);
            const batchWords = [];

            // Process batch synchronously
            for (const [word, data] of batch) {
                try {
                    // Skip if data is null or undefined
                    if (!data) {
                        console.warn(`Skipping word "${word}" - no data`);
                        continue;
                    }

                    const wordData = this.processWordData(word, data);
                    if (wordData) {
                        batchWords.push(wordData);
                    }
                } catch (error) {
                    console.warn(`Error processing word "${word}":`, error);
                    console.warn(`Word data was:`, data);
                }

                processed++;

                // Update progress every 1000 words or at the end
                if (processed % 1000 === 0 || processed === totalWords) {
                    const progress = (processed / totalWords) * 100;
                    this.updateLoadingMessage(
                        `Processing: ${processed.toLocaleString()}/${totalWords.toLocaleString()} words`,
                        progress
                    );

                    this.updateLoadingStats({
                        'Processed': `${processed.toLocaleString()} words`,
                        'Progress': `${Math.round(progress)}%`,
                        'Speed': `${Math.round(processed / ((Date.now() - startTime) / 1000))} words/sec`
                    });
                }
            }

            words.push(...batchWords);

            // Allow UI updates
            await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
        }

        this.words = words;
        this.filteredWords = [...this.words];

        this.updateLoadingMessage(`Successfully processed ${words.length.toLocaleString()} words`, 100);
        this.updateLoadingStats({
            'Total Processed': `${words.length.toLocaleString()} words`,
            'Status': 'Complete'
        });

        setTimeout(() => {
            this.hideLoading();
        }, 1000);


        this.showProcessingSummary(words);
    }

    showProcessingSummary(words) {
        const genres = {};
        const difficulties = {};

        words.forEach(word => {
            genres[word.genre] = (genres[word.genre] || 0) + 1;
            difficulties[word.difficulty] = (difficulties[word.difficulty] || 0) + 1;
        });





    }

    processWordData(word, data) {
        // Add detailed logging for debugging


        // Handle different dictionary formats
        let definition, definitions = [], synonyms = [], antonyms = [], phonetic = '',
            partOfSpeech = 'noun', examples = [], genres = [];

        const difficultyScore = data.difficulty || 0.5;

        // Format 1: Your new JSONL format (word as field in each object)
        if (data.definitions && Array.isArray(data.definitions)) {
            // This is your new format
            definitions = data.definitions;
            synonyms = data.synonyms || [];
            antonyms = data.antonyms || [];
            phonetic = data.ipa || '';
            examples = data.examples || [];
            genres = data.genre || [];

            // Use first definition as main definition
            definition = definitions[0] || 'No definition available';

            // Determine part of speech from genre array
            const genreLower = genres.map(g => g.toLowerCase());
            partOfSpeech = genreLower.includes('noun') ? 'noun' :
                genreLower.includes('verb') ? 'verb' :
                    genreLower.includes('adjective') ? 'adjective' :
                        genreLower.includes('adverb') ? 'adverb' :
                            genres.length > 0 ? genres[0] : 'noun';
        }
        // Format 2: Your old custom format
        else if (data.meaning) {
            definition = data.meaning;
            definitions = [definition];
            synonyms = data.synonyms || [];
            antonyms = data.antonyms || [];
            phonetic = data.ipa || '';
            partOfSpeech = data.genre || 'noun';
            examples = data.example ? [data.example] : [];
            genres = [partOfSpeech];
        }
        // Format 3: Simple string format
        else if (typeof data === 'string') {
            definition = data;
            definitions = [definition];
            synonyms = [];
            antonyms = [];
            phonetic = '';
            partOfSpeech = 'noun';
            examples = [];
            genres = ['daily'];
        }
        // Format 4: Kaikki.org format
        else if (data.glosses && data.glosses.length > 0) {
            definition = data.glosses[0];
            definitions = [definition];
            synonyms = data.synonyms ? data.synonyms.map(s => s.word) : [];
            antonyms = data.antonyms ? data.antonyms.map(a => a.word) : [];
            phonetic = data.sounds && data.sounds[0] ? data.sounds[0].ipa : '';
            partOfSpeech = data.pos || 'noun';
            examples = data.senses && data.senses[0] && data.senses[0].examples && data.senses[0].examples[0] ?
                [data.senses[0].examples[0].text] : [];
            genres = [partOfSpeech];
        }
        // Format 5: Alternative format with definitions array
        else if (data.definitions && data.definitions.length > 0) {
            definition = data.definitions[0];
            definitions = data.definitions;
            synonyms = data.synonyms || [];
            antonyms = data.antonyms || [];
            phonetic = data.pronunciation || '';
            partOfSpeech = data.partOfSpeech || 'noun';
            examples = data.example ? [data.example] : [];
            genres = [partOfSpeech];
        }
        else {
            // Skip if no meaningful data
            console.warn(`No valid data for word: ${word}, data:`, data);
            return null;
        }

        // Skip if no definition
        if (!definition || definition.trim() === '') {
            console.warn(`No definition for word: ${word}`);
            return null;
        }

        // Convert difficulty float to string category
        let difficulty;
        if (difficultyScore >= 0.8) {
            difficulty = 'hard';
        } else if (difficultyScore >= 0.5) {
            difficulty = 'medium';
        } else {
            difficulty = 'easy';
        }

        // Determine genres from the data
        let finalGenres = [];

        // If genres array is empty, try to extract from other fields
        if (genres.length === 0) {
            // Try to extract from part of speech
            if (partOfSpeech && partOfSpeech !== 'noun') {
                finalGenres.push(partOfSpeech);
            }

            // Try to extract from definitions or tags
            if (data.tags && Array.isArray(data.tags)) {
                finalGenres = [...finalGenres, ...data.tags];
            }
            else if (data.meanings && Array.isArray(data.meanings)) {
                // Extract from meanings if available
                data.meanings.forEach(meaning => {
                    if (meaning.partOfSpeech) {
                        finalGenres.push(meaning.partOfSpeech);
                    }
                });
            }
        } else {
            finalGenres = genres;
        }

        // Clean up genres - remove duplicates, convert to lowercase
        finalGenres = [...new Set(finalGenres.map(g => g.toLowerCase().trim()))];

        // If still no genres, analyze the word - NOW WITH SAFETY
        if (finalGenres.length === 0) {
            try {
                finalGenres = this.analyzeWordForGenres(word, data);
            } catch (error) {
                console.warn(`Error analyzing genres for word ${word}:`, error);
                finalGenres = ['general']; // Default fallback
            }
        }

        // Remove generic POS tags if we have more specific genres
        const genericTags = ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'interjection'];
        const specificGenres = finalGenres.filter(g => !genericTags.includes(g));
        if (specificGenres.length > 0) {
            finalGenres = specificGenres;
        }

        // Ensure we have at least one genre
        if (finalGenres.length === 0) {
            finalGenres = ['general'];
        }

        // Determine main genre (first one)
        let mainGenre = finalGenres[0];

        return {
            word: word.toLowerCase(),
            phonetic: phonetic,
            meanings: [{
                partOfSpeech: partOfSpeech,
                definitions: [{
                    definition: definition,
                    examples: examples,
                    synonyms: synonyms,
                    antonyms: antonyms
                }]
            }],
            allDefinitions: definitions,
            allExamples: examples,
            allSynonyms: synonyms,
            allAntonyms: antonyms,
            difficulty: difficulty,
            genre: mainGenre,
            originalDifficulty: difficultyScore,
            allGenres: finalGenres,
            // For backward compatibility
            meaning: definition,
            example: examples.length > 0 ? examples[0] : ''
        };
    }

    analyzeWordForGenres(word, data) {
        // Add robust error handling at the beginning
        if (!data) {
            console.warn(`No data provided for word: ${word}, returning default genre`);
            return ['general'];
        }

        const wordLower = word.toLowerCase();

        // Handle different types of data
        let definition = '';

        if (typeof data === 'string') {
            definition = data;
        } else if (typeof data === 'object' && data !== null) {
            // Try to extract definition from different possible structures
            if (data.meaning) {
                definition = data.meaning;
            } else if (data.definitions && Array.isArray(data.definitions) && data.definitions[0]) {
                definition = data.definitions[0];
            } else if (data.meanings && Array.isArray(data.meanings) && data.meanings[0]?.definitions?.[0]?.definition) {
                definition = data.meanings[0].definitions[0].definition;
            } else if (data.glosses && Array.isArray(data.glosses) && data.glosses[0]) {
                definition = data.glosses[0];
            }
        }

        // If we still don't have a definition, return default
        if (!definition || typeof definition !== 'string') {
            return ['general'];
        }

        const genres = [];

        // Academic/School words
        if (wordLower.includes('educat') || wordLower.includes('learn') || wordLower.includes('study') ||
            wordLower.includes('school') || wordLower.includes('academ') || wordLower.includes('university') ||
            wordLower.includes('college') || wordLower.includes('student') || wordLower.includes('teacher') ||
            wordLower.includes('class') || wordLower.includes('course') || wordLower.includes('lesson') ||
            definition.includes('education') || definition.includes('learning') || definition.includes('school')) {
            genres.push('academic');
        }

        // Health/Medical words
        if (wordLower.includes('medic') || wordLower.includes('health') || wordLower.includes('hospital') ||
            wordLower.includes('doctor') || wordLower.includes('nurse') || wordLower.includes('patient') ||
            wordLower.includes('disease') || wordLower.includes('treatment') || wordLower.includes('therapy') ||
            wordLower.includes('drug') || wordLower.includes('pharma') || wordLower.includes('surg') ||
            definition.includes('medical') || definition.includes('health') || definition.includes('treatment')) {
            genres.push('health');
        }

        // Business/Finance words
        if (wordLower.includes('busi') || wordLower.includes('market') || wordLower.includes('sale') ||
            wordLower.includes('money') || wordLower.includes('financ') || wordLower.includes('econom') ||
            wordLower.includes('invest') || wordLower.includes('stock') || wordLower.includes('trade') ||
            definition.includes('business') || definition.includes('financial') || definition.includes('economic')) {
            genres.push('business');
        }

        // Technology words
        if (wordLower.includes('tech') || wordLower.includes('comput') || wordLower.includes('digital') ||
            wordLower.includes('software') || wordLower.includes('hardware') || wordLower.includes('program') ||
            wordLower.includes('code') || wordLower.includes('algorithm') || wordLower.includes('data') ||
            definition.includes('technology') || definition.includes('computer') || definition.includes('digital')) {
            genres.push('technology');
        }

        // Science words
        if (wordLower.includes('scien') || wordLower.includes('physic') || wordLower.includes('chem') ||
            wordLower.includes('biol') || wordLower.includes('math') || wordLower.includes('engineer') ||
            definition.includes('science') || definition.includes('scientific') || definition.includes('research')) {
            genres.push('science');
        }

        // Legal words
        if (wordLower.includes('law') || wordLower.includes('legal') || wordLower.includes('court') ||
            wordLower.includes('judge') || wordLower.includes('lawyer') || wordLower.includes('contract') ||
            definition.includes('legal') || definition.includes('law') || definition.includes('court')) {
            genres.push('legal');
        }

        // Arts/Entertainment
        if (wordLower.includes('art') || wordLower.includes('music') || wordLower.includes('film') ||
            wordLower.includes('movie') || wordLower.includes('theater') || wordLower.includes('dance') ||
            definition.includes('art') || definition.includes('music') || definition.includes('entertainment')) {
            genres.push('arts');
        }

        // Sports
        if (wordLower.includes('sport') || wordLower.includes('game') || wordLower.includes('athlet') ||
            wordLower.includes('team') || wordLower.includes('player') || wordLower.includes('coach') ||
            definition.includes('sport') || definition.includes('game') || definition.includes('athlete')) {
            genres.push('sports');
        }

        // Daily life (default)
        if (genres.length === 0) {
            genres.push('general');
        }

        return genres;
    }

    // Update the updateFlashcard method to handle multiple examples
    updateFlashcard() {
        if (this.filteredWords.length === 0) {
            this.showNoWordsMessage();
            return;
        }

        const currentWord = this.filteredWords[this.currentWordIndex];
        const meaning = currentWord.meanings[0];
        const definition = meaning.definitions[0];
        const mastery = this.getMasteryLevel(currentWord.word);

        // Front of card
        document.getElementById('wordFront').textContent = currentWord.word;
        document.getElementById('phoneticFront').textContent = currentWord.phonetic;

        const difficultyBadge = document.getElementById('difficultyBadge');
        difficultyBadge.textContent = currentWord.difficulty;
        difficultyBadge.className = `difficulty-badge ${currentWord.difficulty}`;

        const genreTag = document.getElementById('genreTag');
        genreTag.textContent = currentWord.genre;

        // Back of card
        document.getElementById('wordBack').textContent = currentWord.word;
        document.getElementById('phoneticBack').textContent = currentWord.phonetic;

        document.getElementById('difficultyBadgeBack').textContent = currentWord.difficulty;
        document.getElementById('difficultyBadgeBack').className = `difficulty-badge ${currentWord.difficulty}`;
        document.getElementById('genreTagBack').textContent = currentWord.genre;

        // Display first definition
        document.getElementById('meaning').textContent = definition.definition;

        // Display examples (max 3)
        this.displayExamples(currentWord, definition);

        // Display synonyms (max 3)
        this.displaySynonyms(currentWord, definition);

        // Display antonyms (max 3)
        this.displayAntonyms(currentWord, definition);

        this.updateMasteryButtons(currentWord.word, mastery);
        this.updateProgressInfo();
        this.updatePersonalWordButton(currentWord.word);
    }

    // Add new methods to display content with limits
    displayExamples(word, definition) {
        const exampleSection = document.getElementById('exampleSection');
        const exampleElement = document.getElementById('example');

        const examples = word.allExamples || definition.examples || [];

        if (examples.length === 0) {
            exampleSection.style.display = 'none';
            return;
        }

        // Display max 3 examples
        const displayExamples = examples.slice(0, 3);
        exampleElement.innerHTML = displayExamples.map(ex =>
            `<div class="example-item">"${ex}"</div>`
        ).join('');

        // Show count if more examples available
        if (examples.length > 3) {
            exampleElement.innerHTML += `<div class="example-more">+ ${examples.length - 3} more examples</div>`;
        }

        exampleSection.style.display = 'block';
    }

    displaySynonyms(word, definition) {
        const synonymsSection = document.getElementById('synonymsSection');
        const synonymsElement = document.getElementById('synonyms');

        const synonyms = word.allSynonyms || definition.synonyms || [];

        if (synonyms.length === 0) {
            synonymsSection.style.display = 'none';
            return;
        }

        // Display max 3 synonyms
        const displaySynonyms = synonyms.slice(0, 3);
        synonymsElement.textContent = displaySynonyms.join(', ');

        // Show count if more synonyms available
        if (synonyms.length > 3) {
            synonymsElement.textContent += ` (+${synonyms.length - 3} more)`;
        }

        synonymsSection.style.display = 'block';
    }

    displayAntonyms(word, definition) {
        const antonymsSection = document.getElementById('antonymsSection');
        const antonymsElement = document.getElementById('antonyms');

        const antonyms = word.allAntonyms || definition.antonyms || [];

        if (antonyms.length === 0) {
            antonymsSection.style.display = 'none';
            return;
        }

        // Display max 3 antonyms
        const displayAntonyms = antonyms.slice(0, 3);
        antonymsElement.textContent = displayAntonyms.join(', ');

        // Show count if more antonyms available
        if (antonyms.length > 3) {
            antonymsElement.textContent += ` (+${antonyms.length - 3} more)`;
        }

        antonymsSection.style.display = 'block';
    }

    // Update the showWordModal method to show all content without limits
    showWordModal(word) {
        const wordData = this.words.find(w => w.word === word);
        if (!wordData) {
            this.showNotification('Word not found', 'error');
            return;
        }

        const modal = document.getElementById('wordModal');
        const content = document.getElementById('modalContent');
        const isSaved = this.personalWords.has(word);

        if (!modal || !content) {
            console.error('Modal elements not found');
            return;
        }

        const definitions = wordData.allDefinitions || wordData.meanings[0]?.definitions[0]?.definition ?
            [wordData.meanings[0].definitions[0].definition] : [];
        const examples = wordData.allExamples || wordData.meanings[0]?.definitions[0]?.examples || [];
        const synonyms = wordData.allSynonyms || wordData.meanings[0]?.definitions[0]?.synonyms || [];
        const antonyms = wordData.allAntonyms || wordData.meanings[0]?.definitions[0]?.antonyms || [];
        const genres = wordData.allGenres || [wordData.genre];

        let modalHTML = `
    <div class="modal-word-header">
        <div>
            <h2>${wordData.word}</h2>
            <p class="phonetic">${wordData.phonetic || 'No phonetic available'}</p>
        </div>
        <div class="modal-tags">
            <span class="difficulty-badge ${wordData.difficulty}">${wordData.difficulty}</span>
            ${genres.map(genre => `<span class="genre-tag">${genre}</span>`).join('')}
        </div>
    </div>
    `;

        // Show all definitions
        if (definitions.length > 0) {
            modalHTML += `
        <div class="meaning-section">
            <h3>Definitions (${definitions.length})</h3>
            <div class="definitions-list">
        `;

            definitions.forEach((def, index) => {
                modalHTML += `
                <div class="definition-item">
                    <p class="definition-text">${index + 1}. ${def}</p>
                </div>
            `;
            });

            modalHTML += `</div></div>`;
        }

        // Show all examples
        if (examples.length > 0) {
            modalHTML += `
        <div class="meaning-section">
            <h3>Examples (${examples.length})</h3>
        `;

            examples.forEach((ex, index) => {
                modalHTML += `
                <div class="definition-item">
                    <p class="example"><strong>Example ${index + 1}:</strong> "${ex}"</p>
                </div>
            `;
            });

            modalHTML += `</div>`;
        }

        // Show all synonyms
        if (synonyms.length > 0) {
            modalHTML += `
        <div class="meaning-section">
            <h3>Synonyms (${synonyms.length})</h3>
            <div class="definition-item">
                <p class="synonyms">${synonyms.join(', ')}</p>
            </div>
        </div>
        `;
        }

        // Show all antonyms
        if (antonyms.length > 0) {
            modalHTML += `
        <div class="meaning-section">
            <h3>Antonyms (${antonyms.length})</h3>
            <div class="definition-item">
                <p class="antonyms">${antonyms.join(', ')}</p>
            </div>
        </div>
        `;
        }

        // Add mastery information
        const mastery = this.getMasteryLevel(word);
        modalHTML += `
    <div class="mastery-section">
        <h3>Your Mastery</h3>
        <div class="mastery-info">
            <span class="mastery-badge ${mastery}">${mastery}</span>
            <p>Current mastery level for this word</p>
        </div>
    </div>
    `;

        // Use escapeString if available for the action buttons
        const safeWord = typeof this.escapeString === 'function'
            ? this.escapeString(word)
            : word.replace(/'/g, "\\'");

        // Add action buttons
        modalHTML += `
    <div class="modal-actions">
        <button class="btn-primary" onclick="app.togglePersonalWord('${safeWord}'); app.hideWordModal()">
            <i class="${isSaved ? 'fas' : 'far'} fa-heart"></i>
            ${isSaved ? 'Remove from My Words' : 'Add to My Words'}
        </button>
        <button class="btn-secondary" onclick="app.speakWord('${safeWord}')">
            <i class="fas fa-volume-up"></i>
            Speak Word
        </button>
    </div>
    `;

        content.innerHTML = modalHTML;
        modal.style.display = 'block';


    }

    assignDifficulty(word, data) {
        // If difficulty is provided as a float, use it
        if (data.difficulty !== undefined) {
            const score = data.difficulty;
            if (score >= 0.8) return 'hard';
            if (score >= 0.5) return 'medium';
            return 'easy';
        }

        // Fallback to the old method if no difficulty provided
        const meaning = typeof data === 'string' ? data :
            data.definitions ? data.definitions[0] : '';
        const wordLength = word.length;
        const definitionComplexity = meaning.split(' ').length;
        const hasComplexChars = /[^a-zA-Z]/.test(word);

        let score = 0;

        // Word length factor
        if (wordLength <= 4) score += 1;
        else if (wordLength <= 7) score += 2;
        else score += 3;

        // Definition complexity factor
        if (definitionComplexity <= 6) score += 1;
        else if (definitionComplexity <= 10) score += 2;
        else score += 3;

        // Special characters factor
        if (hasComplexChars) score += 1;

        if (score <= 3) return 'easy';
        if (score <= 5) return 'medium';
        return 'hard';
    }

    assignGenre(word, data) {
        // If genre array is provided, use the first one
        if (data.genre && Array.isArray(data.genre) && data.genre.length > 0) {
            return data.genre[0];
        }

        // Fallback to old method
        const wordLower = word.toLowerCase();

        // Academic/School words
        if (wordLower.includes('educat') || wordLower.includes('learn') || wordLower.includes('study') ||
            wordLower.includes('school') || wordLower.includes('academ') || wordLower.includes('university') ||
            wordLower.includes('college') || wordLower.includes('student') || wordLower.includes('teacher') ||
            wordLower.includes('class') || wordLower.includes('course') || wordLower.includes('lesson')) {
            return 'school';
        }

        // Health/Medical words
        if (wordLower.includes('medic') || wordLower.includes('health') || wordLower.includes('hospital') ||
            wordLower.includes('doctor') || wordLower.includes('nurse') || wordLower.includes('patient') ||
            wordLower.includes('disease') || wordLower.includes('treatment') || wordLower.includes('therapy') ||
            wordLower.includes('drug') || wordLower.includes('pharma') || wordLower.includes('surg') ||
            wordLower.includes('clinic') || wordLower.includes('wellness') || wordLower.includes('fitness')) {
            return 'health';
        }

        // Business words
        if (wordLower.includes('busi') || wordLower.includes('market') || wordLower.includes('sale') ||
            wordLower.includes('money') || wordLower.includes('financ') || wordLower.includes('econom') ||
            wordLower.includes('invest') || wordLower.includes('stock') || wordLower.includes('trade') ||
            wordLower.includes('company') || wordLower.includes('corporat') || wordLower.includes('manager') ||
            wordLower.includes('execut') || wordLower.includes('profit') || wordLower.includes('revenue')) {
            return 'business';
        }

        // Technology words
        if (wordLower.includes('tech') || wordLower.includes('comput') || wordLower.includes('digital') ||
            wordLower.includes('software') || wordLower.includes('hardware') || wordLower.includes('program') ||
            wordLower.includes('code') || wordLower.includes('algorithm') || wordLower.includes('data') ||
            wordLower.includes('network') || wordLower.includes('internet') || wordLower.includes('web') ||
            wordLower.includes('system') || wordLower.includes('device') || wordLower.includes('mobile')) {
            return 'technology';
        }

        // Household words
        if (wordLower.includes('home') || wordLower.includes('house') || wordLower.includes('family') ||
            wordLower.includes('kitchen') || wordLower.includes('room') || wordLower.includes('garden') ||
            wordLower.includes('furniture') || wordLower.includes('appliance') || wordLower.includes('clean') ||
            wordLower.includes('cook') || wordLower.includes('food') || wordLower.includes('meal') ||
            wordLower.includes('parent') || wordLower.includes('child') || wordLower.includes('pet')) {
            return 'household';
        }

        // Default to daily life
        return 'daily';
    }

    getComprehensiveSampleWords() {
        // Return a larger set of sample words if JSON loading fails
        return [
            {
                word: "education",
                phonetic: "/ˌɛd.ʒəˈkeɪ.ʃən/",
                meanings: [{
                    partOfSpeech: "noun",
                    definitions: [{
                        definition: "The process of receiving or giving systematic instruction, especially at a school or university.",
                        example: "She completed her education at Harvard University.",
                        synonyms: ["schooling", "teaching", "instruction", "tuition", "tutoring"],
                        antonyms: ["ignorance", "illiteracy"]
                    }]
                }],
                difficulty: "easy",
                genre: "school"
            },
            {
                word: "perseverance",
                phonetic: "/ˌpɜː.sɪˈvɪə.rəns/",
                meanings: [{
                    partOfSpeech: "noun",
                    definitions: [{
                        definition: "Persistence in doing something despite difficulty or delay in achieving success.",
                        example: "Through perseverance and hard work, he achieved his goals.",
                        synonyms: ["persistence", "determination", "tenacity", "resolve", "dedication"],
                        antonyms: ["laziness", "quitting", "indifference"]
                    }]
                }],
                difficulty: "medium",
                genre: "daily"
            },
            {
                word: "ambiguous",
                phonetic: "/æmˈbɪɡ.ju.əs/",
                meanings: [{
                    partOfSpeech: "adjective",
                    definitions: [{
                        definition: "Open to more than one interpretation; not having one obvious meaning.",
                        example: "The contract's ambiguous wording led to legal disputes.",
                        synonyms: ["unclear", "vague", "equivocal", "uncertain", "doubtful"],
                        antonyms: ["clear", "unambiguous", "definite", "certain"]
                    }]
                }],
                difficulty: "hard",
                genre: "business"
            },
            {
                word: "diligent",
                phonetic: "/ˈdɪl.ɪ.dʒənt/",
                meanings: [{
                    partOfSpeech: "adjective",
                    definitions: [{
                        definition: "Having or showing care and conscientiousness in one's work or duties.",
                        example: "She was a diligent worker who always met her deadlines.",
                        synonyms: ["hardworking", "industrious", "conscientious", "assiduous", "meticulous"],
                        antonyms: ["lazy", "negligent", "careless", "slack"]
                    }]
                }],
                difficulty: "medium",
                genre: "business"
            },
            {
                word: "eclectic",
                phonetic: "/ɪˈklek.tɪk/",
                meanings: [{
                    partOfSpeech: "adjective",
                    definitions: [{
                        definition: "Deriving ideas, style, or taste from a broad and diverse range of sources.",
                        example: "His eclectic taste in music ranged from classical to jazz to rock.",
                        synonyms: ["diverse", "wide-ranging", "varied", "broad", "comprehensive"],
                        antonyms: ["narrow", "uniform", "limited", "homogeneous"]
                    }]
                }],
                difficulty: "hard",
                genre: "daily"
            },
            {
                word: "resilient",
                phonetic: "/rɪˈzɪl.i.ənt/",
                meanings: [{
                    partOfSpeech: "adjective",
                    definitions: [{
                        definition: "Able to withstand or recover quickly from difficult conditions.",
                        example: "Children are often more resilient than adults when facing adversity.",
                        synonyms: ["tough", "strong", "flexible", "durable", "robust"],
                        antonyms: ["fragile", "vulnerable", "weak", "delicate"]
                    }]
                }],
                difficulty: "medium",
                genre: "daily"
            },
            {
                word: "innovative",
                phonetic: "/ˈɪn.ə.veɪ.tɪv/",
                meanings: [{
                    partOfSpeech: "adjective",
                    definitions: [{
                        definition: "Featuring new methods; advanced and original.",
                        example: "The company was known for its innovative approach to problem-solving.",
                        synonyms: ["creative", "inventive", "original", "groundbreaking", "pioneering"],
                        antonyms: ["conventional", "traditional", "unoriginal", "derivative"]
                    }]
                }],
                difficulty: "medium",
                genre: "technology"
            },
            {
                word: "comprehensive",
                phonetic: "/ˌkɒm.prɪˈhen.sɪv/",
                meanings: [{
                    partOfSpeech: "adjective",
                    definitions: [{
                        definition: "Complete and including everything that is necessary.",
                        example: "The report provides a comprehensive analysis of the market trends.",
                        synonyms: ["complete", "thorough", "exhaustive", "all-inclusive", "extensive"],
                        antonyms: ["incomplete", "partial", "limited", "selective"]
                    }]
                }],
                difficulty: "medium",
                genre: "school"
            },
            {
                word: "therapeutic",
                phonetic: "/ˌθer.əˈpjuː.tɪk/",
                meanings: [{
                    partOfSpeech: "adjective",
                    definitions: [{
                        definition: "Relating to the healing of disease or contributing to general well-being.",
                        example: "Yoga has therapeutic benefits for both mind and body.",
                        synonyms: ["healing", "curative", "remedial", "medicinal", "restorative"],
                        antonyms: ["harmful", "damaging", "injurious", "destructive"]
                    }]
                }],
                difficulty: "medium",
                genre: "health"
            },
            {
                word: "sustainable",
                phonetic: "/səˈsteɪ.nə.bəl/",
                meanings: [{
                    partOfSpeech: "adjective",
                    definitions: [{
                        definition: "Able to be maintained at a certain rate or level without depleting resources.",
                        example: "The company adopted sustainable practices to protect the environment.",
                        synonyms: ["maintainable", "supportable", "defensible", "viable", "enduring"],
                        antonyms: ["unsustainable", "untenable", "unviable", "temporary"]
                    }]
                }],
                difficulty: "medium",
                genre: "business"
            },
            {
                word: "meticulous",
                phonetic: "/məˈtɪk.jə.ləs/",
                meanings: [{
                    partOfSpeech: "adjective",
                    definitions: [{
                        definition: "Showing great attention to detail; very careful and precise.",
                        example: "She was meticulous in her research, checking every fact multiple times.",
                        synonyms: ["thorough", "careful", "precise", "scrupulous", "painstaking"],
                        antonyms: ["careless", "sloppy", "negligent", "inattentive"]
                    }]
                }],
                difficulty: "hard",
                genre: "daily"
            },
            {
                word: "versatile",
                phonetic: "/ˈvɜː.sə.taɪl/",
                meanings: [{
                    partOfSpeech: "adjective",
                    definitions: [{
                        definition: "Able to adapt or be adapted to many different functions or activities.",
                        example: "He was a versatile actor who could perform both comedy and drama.",
                        synonyms: ["adaptable", "flexible", "all-around", "multitalented", "resourceful"],
                        antonyms: ["inflexible", "limited", "specialized", "restricted"]
                    }]
                }],
                difficulty: "medium",
                genre: "daily"
            },
            {
                word: "profound",
                phonetic: "/prəˈfaʊnd/",
                meanings: [{
                    partOfSpeech: "adjective",
                    definitions: [{
                        definition: "Very great or intense; having or showing great knowledge or insight.",
                        example: "The book had a profound impact on my understanding of human nature.",
                        synonyms: ["deep", "intense", "heartfelt", "wise", "philosophical"],
                        antonyms: ["superficial", "shallow", "trivial", "insignificant"]
                    }]
                }],
                difficulty: "hard",
                genre: "school"
            },
            {
                word: "efficient",
                phonetic: "/ɪˈfɪʃ.ənt/",
                meanings: [{
                    partOfSpeech: "adjective",
                    definitions: [{
                        definition: "Achieving maximum productivity with minimum wasted effort or expense.",
                        example: "The new system made the workflow much more efficient.",
                        synonyms: ["effective", "productive", "organized", "systematic", "streamlined"],
                        antonyms: ["inefficient", "wasteful", "unproductive", "disorganized"]
                    }]
                }],
                difficulty: "medium",
                genre: "business"
            },
            {
                word: "resilience",
                phonetic: "/rɪˈzɪl.i.əns/",
                meanings: [{
                    partOfSpeech: "noun",
                    definitions: [{
                        definition: "The capacity to recover quickly from difficulties; toughness.",
                        example: "Her resilience in the face of adversity was truly inspiring.",
                        synonyms: ["toughness", "hardiness", "strength", "flexibility", "durability"],
                        antonyms: ["fragility", "vulnerability", "weakness", "brittleness"]
                    }]
                }],
                difficulty: "medium",
                genre: "health"
            }
        ];
    }

    async saveWordsToDB(words) {
        return new Promise(async (resolve, reject) => {
            try {


                // First, clear the existing words store
                await this.clearWordsStore();

                // Save words in smaller batches with proper transaction management
                const batchSize = 100; // Reduced batch size for better transaction management
                let savedCount = 0;

                for (let i = 0; i < words.length; i += batchSize) {
                    const batch = words.slice(i, i + batchSize);
                    await this.saveWordBatch(batch);
                    savedCount += batch.length;

                    // Update progress every 1000 words
                    if (savedCount % 1000 === 0 || savedCount === words.length) {

                        this.updateSaveProgress(savedCount, words.length);
                    }

                    // Small delay to prevent transaction conflicts
                    await new Promise(resolve => setTimeout(resolve, 10));
                }


                resolve();

            } catch (error) {
                console.error('Error saving words to DB:', error);
                reject(error);
            }
        });
    }


    async saveWordBatch(batch) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['words'], 'readwrite');
            const store = transaction.objectStore('words');

            let completed = 0;
            let hasError = false;

            batch.forEach(word => {
                const request = store.put(word);

                request.onsuccess = () => {
                    completed++;
                    if (completed === batch.length && !hasError) {
                        resolve();
                    }
                };

                request.onerror = () => {
                    if (!hasError) {
                        hasError = true;
                        console.error('Error saving word batch:', request.error);
                        reject(request.error);
                    }
                };
            });

            // Add transaction error handler
            transaction.onerror = (event) => {
                if (!hasError) {
                    hasError = true;
                    console.error('Transaction error:', event);
                    reject(transaction.error);
                }
            };

            transaction.oncomplete = () => {
                if (!hasError && completed === batch.length) {
                    resolve();
                }
            };

            // Set a timeout for the transaction (30 seconds)
            setTimeout(() => {
                if (!hasError && completed < batch.length) {
                    hasError = true;
                    console.error('Transaction timeout');
                    reject(new Error('Transaction timeout'));
                }
            }, 30000);
        });
    }

    // Add these methods to the VocabularyApp class

    async countWordsInDB() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['words'], 'readonly');
            const store = transaction.objectStore('words');
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllWordsFromDB() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['words'], 'readonly');
            const store = transaction.objectStore('words');
            const request = store.getAll();

            request.onsuccess = () => {

                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Error getting words from DB:', request.error);
                reject(request.error);
            };
        });
    }

    async clearWordsStore() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['words'], 'readwrite');
            const store = transaction.objectStore('words');
            const request = store.clear();

            request.onsuccess = () => {

                resolve();
            };

            request.onerror = () => {
                console.error('Error clearing words store:', request.error);
                reject(request.error);
            };
        });
    }

    async saveWordBatch(batch) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['words'], 'readwrite');
            const store = transaction.objectStore('words');

            let completed = 0;
            let hasError = false;

            batch.forEach(word => {
                const request = store.put(word);

                request.onsuccess = () => {
                    completed++;
                    if (completed === batch.length && !hasError) {
                        resolve();
                    }
                };

                request.onerror = () => {
                    if (!hasError) {
                        hasError = true;
                        console.error('Error saving word batch:', request.error);
                        reject(request.error);
                    }
                };
            });

            // Add transaction error handler
            transaction.onerror = (event) => {
                if (!hasError) {
                    hasError = true;
                    console.error('Transaction error:', event);
                    reject(transaction.error);
                }
            };

            transaction.oncomplete = () => {
                if (!hasError && completed === batch.length) {
                    resolve();
                }
            };

            // Set a timeout for the transaction (30 seconds)
            setTimeout(() => {
                if (!hasError && completed < batch.length) {
                    hasError = true;
                    console.error('Transaction timeout');
                    reject(new Error('Transaction timeout'));
                }
            }, 30000);
        });
    }

    updateSaveProgress(saved, total) {
        const progress = (saved / total) * 100;


        // Update UI progress if elements exist
        const progressElement = document.getElementById('importProgressText');
        if (progressElement) {
            progressElement.textContent = `Saving to database... ${saved}/${total}`;
        }

        const progressFill = document.getElementById('importProgressFill');
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }

        const progressPercent = document.getElementById('importProgressPercent');
        if (progressPercent) {
            progressPercent.textContent = `${Math.round(progress)}%`;
        }
    }

    // Loading Progress Methods
    showImportProgressModal() {
        document.getElementById('importProgressModal').style.display = 'block';
    }

    hideImportProgressModal() {
        document.getElementById('importProgressModal').style.display = 'none';
    }

    showImportProgress() {
        this.showLoading('Importing Dictionary', 'Starting import process...');
        this.isLoading = true;
    }

    updateImportProgress(processed, total, progress) {
        this.updateLoadingMessage(
            `Processing: ${processed.toLocaleString()}/${total.toLocaleString()} words`,
            progress
        );

        this.updateLoadingStats({
            'Words Processed': processed.toLocaleString(),
            'Total Words': total.toLocaleString(),
            'Progress': `${Math.round(progress)}%`
        });
    }

    hideImportProgress() {
        this.hideLoading();
        this.isLoading = false;
    }

    // Loading Message System - UPDATED FOR NEW STRUCTURE
    showLoading(title = 'Loading Vocabulary App', message = 'Initializing application...') {
        const spinner = document.getElementById('loadingSpinner');
        const titleEl = document.getElementById('loadingTitle');
        const messageEl = document.getElementById('loadingMessage');

        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;
        if (spinner) spinner.style.display = 'flex';

        // Reset progress
        this.updateLoadingProgress(0);
        this.updateLoadingStats({ Status: 'Initializing' });

        this.isLoading = true;
    }

    updateLoadingMessage(message, progress = null) {
        const messageEl = document.getElementById('loadingMessage');
        if (messageEl) {
            messageEl.textContent = message;
        }

        if (progress !== null) {
            this.updateLoadingProgress(progress);
        }
    }

    updateLoadingProgress(percent) {
        const progressFill = document.getElementById('loadingProgressFill');
        const progressText = document.getElementById('loadingProgressText');

        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }
        if (progressText) {
            progressText.textContent = `${Math.round(percent)}%`;
        }
    }

    updateLoadingStats(stats) {
        const statsContainer = document.getElementById('loadingStats');
        if (!statsContainer) return;

        let statsHTML = '';
        for (const [key, value] of Object.entries(stats)) {
            // Format the key for display
            const formattedKey = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase())
                .trim();

            statsHTML += `
            <div class="stat-item">
                <span class="stat-label">${formattedKey}:</span>
                <span class="stat-value">${value}</span>
            </div>
        `;
        }

        statsContainer.innerHTML = statsHTML;
    }

    hideLoading() {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            // Add a fade out animation before hiding
            spinner.style.opacity = '0';
            spinner.style.transition = 'opacity 0.3s ease';

            setTimeout(() => {
                spinner.style.display = 'none';
                spinner.style.opacity = '1';
            }, 300);
        }
        this.isLoading = false;
    }

    // Personal Words Management
    async loadPersonalWords() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['personalWords'], 'readonly');
            const store = transaction.objectStore('personalWords');
            const request = store.getAll();

            request.onsuccess = () => {
                this.personalWords = new Set(request.result.map(item => item.word));
                // Update the personal word list display
                this.updatePersonalWordList();
                resolve();
            };

            request.onerror = () => reject(request.error);
        });
    }

    async addToPersonalWords(word) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['personalWords'], 'readwrite');
            const store = transaction.objectStore('personalWords');
            const request = store.add({
                word,
                dateAdded: new Date().toISOString(),
                reviewed: false
            });

            request.onsuccess = () => {
                this.personalWords.add(word);
                this.updatePersonalWordList();
                this.updateFlashcard();
                this.updateDictionaryStats();
                this.showNotification(`"${word}" added to your words!`);
                resolve();
            };

            request.onerror = () => reject(request.error);
        });
    }

    async removeFromPersonalWords(word) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['personalWords'], 'readwrite');
            const store = transaction.objectStore('personalWords');
            const request = store.delete(word);

            request.onsuccess = () => {
                this.personalWords.delete(word);
                this.updatePersonalWordList();
                this.updateFlashcard();
                this.updateDictionaryStats();
                this.showNotification(`"${word}" removed from your words.`);
                resolve();
            };

            request.onerror = () => reject(request.error);
        });
    }

    updatePersonalWordList(filter = 'all') {
        const container = document.getElementById('personalWordList');
        if (!container) return;

        const personalWordsArray = Array.from(this.personalWords);

        if (personalWordsArray.length === 0) {
            container.innerHTML = `
            <div class="no-words">
                <i class="far fa-folder-open"></i>
                <h3>No words saved yet</h3>
                <p>Start adding words from the dictionary or flashcards!</p>
            </div>
        `;
            return;
        }

        let filteredWords = personalWordsArray;
        if (filter !== 'all') {
            filteredWords = personalWordsArray.filter(word =>
                this.getMasteryLevel(word) === filter
            );
        }

        container.innerHTML = filteredWords.map(word => {
            const wordData = this.words.find(w => w.word === word);
            if (!wordData) return '';

            const meaning = wordData.meanings[0]?.definitions[0]?.definition || 'No definition available';
            const mastery = this.getMasteryLevel(word);

            // Use escapeString if available, otherwise use a simple replacement
            const safeWord = typeof this.escapeString === 'function'
                ? this.escapeString(word)
                : word.replace(/'/g, "\\'");

            return `
            <div class="word-item" data-word="${word}">
                <div class="word-header">
                    <h3>${word}</h3>
                    <span class="difficulty-badge ${wordData.difficulty}">${wordData.difficulty}</span>
                </div>
                <p class="phonetic">${wordData.phonetic}</p>
                <p class="meaning">${meaning.substring(0, 80)}${meaning.length > 80 ? '...' : ''}</p>
                <div class="word-mastery-info">
                    <span class="mastery-badge ${mastery}">${mastery}</span>
                </div>
                <div class="word-actions">
                    <button class="btn-small" onclick="app.showWordModal('${safeWord}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-small btn-remove" onclick="app.removeFromPersonalWords('${safeWord}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        }).join('');

        // Update the dropdown to show current filter
        this.updatePersonalFilterDropdown(filter);
    }

    // Word Mastery System
    async loadWordMastery() {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['wordMastery'], 'readonly');
            const store = transaction.objectStore('wordMastery');
            const request = store.getAll();

            request.onsuccess = () => {
                request.result.forEach(item => {
                    this.wordMastery.set(item.word, item);
                });
                resolve();
            };

            request.onerror = () => resolve();
        });
    }

    async updateWordMastery(word, level, isCorrect = null) {
        try {
            const currentMastery = this.wordMastery.get(word) || {
                word: word,
                level: 'new',
                correct: 0,
                total: 0,
                lastReviewed: new Date().toISOString()
            };

            if (level) {
                currentMastery.level = level;
            }

            if (isCorrect !== null) {
                currentMastery.total++;
                if (isCorrect) {
                    currentMastery.correct++;
                } else {
                    // Automatically mark incorrect answers as trouble
                    currentMastery.level = 'trouble';
                }
                currentMastery.lastReviewed = new Date().toISOString();

                // Update mastery based on accuracy (only if not manually set to trouble)
                if (currentMastery.level !== 'trouble' && currentMastery.total >= 3) {
                    const accuracy = currentMastery.correct / currentMastery.total;
                    if (accuracy >= 0.8) currentMastery.level = 'mastered';
                    else if (accuracy >= 0.6) currentMastery.level = 'known';
                    else if (accuracy >= 0.4) currentMastery.level = 'learning';
                    else currentMastery.level = 'trouble';
                }
            }

            this.wordMastery.set(word, currentMastery);

            // Save to database
            await new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['wordMastery'], 'readwrite');
                const store = transaction.objectStore('wordMastery');
                const request = store.put(currentMastery);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            // Update UI
            this.updateFlashcard();
            if (document.getElementById('progress')?.classList.contains('active')) {
                this.updateProgressStats();
            }

            this.showNotification(`Mastery level updated to ${level || currentMastery.level}`);

        } catch (error) {
            console.error('Error updating word mastery:', error);
            this.showNotification('Error updating mastery level', 'error');
        }
    }


    getMasteryLevel(word) {
        return this.wordMastery.get(word)?.level || 'new';
    }

    // Streak Management
    async loadStreak() {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['streak'], 'readonly');
            const store = transaction.objectStore('streak');
            const request = store.get('current');

            request.onsuccess = () => {
                if (request.result) {
                    this.streak = request.result.value || 0;
                }
                this.updateStreakDisplay();
                resolve();
            };

            request.onerror = () => resolve();
        });
    }

    async updateStreak() {
        this.streak++;
        const transaction = this.db.transaction(['streak'], 'readwrite');
        const store = transaction.objectStore('streak');
        store.put({ id: 'current', value: this.streak, lastUpdated: new Date().toISOString() });
        this.updateStreakDisplay();
    }

    updateStreakDisplay() {
        document.getElementById('streak').textContent = this.streak;
    }

    // Custom Dropdown System
    setupCustomDropdowns() {
        // Function to initialize a single dropdown
        const initDropdown = (dropdown) => {
            const selected = dropdown.querySelector('.dropdown-selected');
            const options = dropdown.querySelector('.dropdown-options');

            // Remove existing listeners first to avoid duplicates
            const newSelected = selected.cloneNode(true);
            const newOptions = options.cloneNode(true);
            dropdown.replaceChild(newSelected, selected);
            dropdown.replaceChild(newOptions, options);

            newSelected.addEventListener('click', (e) => {
                e.stopPropagation();
                newOptions.classList.toggle('show');

                // Close other dropdowns
                document.querySelectorAll('.dropdown-options.show').forEach(otherOptions => {
                    if (otherOptions !== newOptions) {
                        otherOptions.classList.remove('show');
                    }
                });
            });

            // Handle option clicks - with event delegation for dynamic content
            newOptions.addEventListener('click', (e) => {
                const option = e.target.closest('.dropdown-option');
                if (!option) return;

                const value = option.dataset.value;
                const text = option.textContent;

                newSelected.querySelector('span').textContent = text;
                newOptions.classList.remove('show');

                // Update selected state
                newOptions.querySelectorAll('.dropdown-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                option.classList.add('selected');

                // Dispatch custom event
                dropdown.dispatchEvent(new CustomEvent('change', {
                    detail: { value, text }
                }));


            });
        };

        // Initialize all existing dropdowns
        document.querySelectorAll('.custom-dropdown').forEach(initDropdown);

        // Also re-initialize dropdowns when new options are added
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.classList && node.classList.contains('custom-dropdown')) {

                            initDropdown(node);
                        } else if (node.parentNode && node.parentNode.classList &&
                            node.parentNode.classList.contains('custom-dropdown')) {
                            // If options were added to an existing dropdown
                            const dropdown = node.parentNode.closest('.custom-dropdown');
                            if (dropdown) {

                                initDropdown(dropdown);
                            }
                        }
                    });
                }
            });
        });

        // Start observing the document for changes
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.custom-dropdown')) {
                document.querySelectorAll('.dropdown-options.show').forEach(options => {
                    options.classList.remove('show');
                });
            }
        });
    }

    getDropdownValue(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) {
            console.warn(`Dropdown ${dropdownId} not found`);
            return 'all';
        }

        const selectedOption = dropdown.querySelector('.dropdown-option.selected');
        if (selectedOption) {
            return selectedOption.dataset.value;
        }

        // Fallback: check the dropdown header text
        const selectedText = dropdown.querySelector('.dropdown-selected span').textContent;
        const options = dropdown.querySelectorAll('.dropdown-option');

        for (let option of options) {
            if (option.textContent === selectedText) {
                return option.dataset.value;
            }
        }

        return 'all';
    }


    toggleSection(sectionId, hasContent) {
        const section = document.getElementById(sectionId);
        section.style.display = hasContent ? 'block' : 'none';
    }

    updateMasteryButtons(word, currentMastery) {
        document.querySelectorAll('.mastery-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.mastery === currentMastery) {
                btn.classList.add('active');
            }

            // Update the onclick handler properly
            btn.onclick = (e) => {
                e.stopPropagation();
                this.updateWordMastery(word, btn.dataset.mastery);
                this.updateFlashcard(); // Refresh to show new mastery level
            };
        });
    }

    updateProgressInfo() {
        document.getElementById('currentCard').textContent = this.currentWordIndex + 1;
        document.getElementById('totalCards').textContent = this.filteredWords.length;

        const progress = ((this.currentWordIndex + 1) / this.filteredWords.length) * 100;
        document.getElementById('cardProgress').style.width = `${progress}%`;
    }

    updatePersonalWordButton(word) {
        const addBtn = document.getElementById('addToPersonal');

        if (this.personalWords.has(word)) {
            addBtn.innerHTML = '<i class="fas fa-heart"></i> Remove from My Words';
            addBtn.classList.add('active');
            addBtn.onclick = () => this.removeFromPersonalWords(word);
        } else {
            addBtn.innerHTML = '<i class="far fa-heart"></i> Add to My Words';
            addBtn.classList.remove('active');
            addBtn.onclick = () => this.addToPersonalWords(word);
        }

        // Alternative: Use toggle method for consistency
        // addBtn.onclick = () => this.togglePersonalWord(word);
    }

    showNoWordsMessage() {
        document.getElementById('wordFront').textContent = 'No words found';
        document.getElementById('wordBack').textContent = 'No words found';
        document.getElementById('meaning').textContent = 'Try changing your filters or adding words to your personal list.';

        ['exampleSection', 'synonymsSection', 'antonymsSection'].forEach(section => {
            document.getElementById(section).style.display = 'none';
        });
    }

    nextCard() {
        if (this.filteredWords.length === 0) return;

        this.currentWordIndex = (this.currentWordIndex + 1) % this.filteredWords.length;
        this.resetFlashcard();
        this.updateFlashcard();
    }

    prevCard() {
        if (this.filteredWords.length === 0) return;

        this.currentWordIndex = this.currentWordIndex === 0 ?
            this.filteredWords.length - 1 : this.currentWordIndex - 1;
        this.resetFlashcard();
        this.updateFlashcard();
    }

    shuffleCards() {
        if (this.filteredWords.length === 0) return;

        for (let i = this.filteredWords.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.filteredWords[i], this.filteredWords[j]] = [this.filteredWords[j], this.filteredWords[i]];
        }
        this.currentWordIndex = 0;
        this.resetFlashcard();
        this.updateFlashcard();
        this.showNotification('Cards shuffled!');
    }

    resetFlashcard() {
        document.getElementById('flashcard').classList.remove('flipped');
    }

    // Dictionary Browser
    renderAlphabet() {
        const container = document.getElementById('alphabetList');
        if (!container) {
            console.warn('alphabetList container not found');
            return;
        }

        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

        container.innerHTML = `
        <div class="letter show-all active" data-letter="all">All</div>
        ${alphabet.map(letter =>
            `<div class="letter" data-letter="${letter}">${letter}</div>`
        ).join('')}
    `;
    }

    filterWords() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const sortBy = this.getDropdownValue('sortDropdown');

        let filtered = this.words; // Always filter from the original words array

        // Only apply search filter if there's a search term
        if (searchTerm) {
            filtered = this.words.filter(word =>
                word.word.toLowerCase().includes(searchTerm)
            );
        }

        filtered = this.sortWords(filtered, sortBy);

        // Update the displayed word list with filtered results
        // But DON'T modify this.allWords - keep it as the complete dataset
        this.displayedWords = filtered;

        // Reset to first page of filtered results
        this.currentPage = 1;
        this.totalPages = Math.ceil(filtered.length / this.pageSize);

        // Show only first page
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pagedResults = filtered.slice(startIndex, endIndex);

        this.renderWordList(pagedResults);
        this.updateDictionaryStats();

        // Clear letter highlighting when using search
        if (searchTerm) {
            this.clearLetterHighlighting();
            this.updateFilterInfo(null, searchTerm);
        } else {
            // If no search term, show the currently selected letter filter
            const activeLetter = document.querySelector('.letter.active')?.dataset.letter || 'all';
            this.updateFilterInfo(activeLetter, null);
        }

        // Update pagination controls
        if (this.paginationControlsExist()) {
            this.safeUpdateElement('totalDisplayWords', filtered.length.toLocaleString());
            this.updatePaginationControls();
        }
    }

    clearLetterHighlighting() {
        const letters = document.querySelectorAll('.letter');
        letters.forEach(l => l.classList.remove('active'));
    }

    sortWords(words, sortBy) {
        switch (sortBy) {
            case 'alphabetical':
                return words.sort((a, b) => a.word.localeCompare(b.word));
            case 'difficulty':
                const difficultyOrder = { easy: 1, medium: 2, hard: 3 };
                return words.sort((a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]);
            case 'genre':
                return words.sort((a, b) => a.genre.localeCompare(b.genre));
            case 'mastery':
                return words.sort((a, b) => {
                    const masteryA = this.getMasteryLevel(a.word);
                    const masteryB = this.getMasteryLevel(b.word);
                    const masteryOrder = { new: 1, learning: 2, known: 3, mastered: 4, trouble: 5 };
                    return masteryOrder[masteryA] - masteryOrder[masteryB];
                });
            default:
                return words;
        }
    }

    // Update the renderWordList to use data attributes instead of inline onclick
    renderWordList(words) {
        const container = document.getElementById('wordList');
        if (!container) {
            console.warn('wordList container not found');
            return;
        }

        if (words.length === 0) {
            container.innerHTML = `
            <div class="no-words">
                <i class="fas fa-search"></i>
                <h3>No words found</h3>
                <p>Try adjusting your search or filters</p>
            </div>
        `;
            return;
        }

        container.innerHTML = words.map(word => {
            const meaning = word.meanings?.[0]?.definitions?.[0]?.definition || 'No definition available';
            const example = word.meanings?.[0]?.definitions?.[0]?.example || '';
            const synonyms = word.meanings?.[0]?.definitions?.[0]?.synonyms || [];
            const isSaved = this.personalWords.has(word.word);

            // Get all data for display
            const definitions = word.allDefinitions || [meaning];
            const examples = word.allExamples || (example ? [example] : []);

            // Use escapeString if available, otherwise use a simple replacement
            const safeWord = typeof this.escapeString === 'function'
                ? this.escapeString(word.word)
                : word.word.replace(/'/g, "\\'");

            return `
<div class="word-item" data-word="${word.word}" data-action="view-word" style="cursor: pointer;">
    <div class="word-header">
        <h3>${word.word}</h3>
        <span class="difficulty-badge ${word.difficulty}">${word.difficulty}</span>
    </div>
    <p class="phonetic">${word.phonetic || 'No phonetic'}</p>
    
    <!-- Show first definition -->
    <p class="meaning">${meaning.substring(0, 100)}${meaning.length > 100 ? '...' : ''}</p>
    
    <!-- Show first example if available -->
    ${examples.length > 0 ?
                    `<p class="example-preview"><small><strong>Example:</strong> ${examples[0].substring(0, 80)}${examples[0].length > 80 ? '...' : ''}</small></p>` :
                    ''}
    
    <!-- Show first few synonyms if available -->
    ${synonyms.length > 0 ?
                    `<p class="synonyms-preview"><small><strong>Synonyms:</strong> ${synonyms.slice(0, 2).join(', ')}${synonyms.length > 2 ? '...' : ''}</small></p>` :
                    ''}
    
    <div class="word-stats">
        <small style="color: var(--text-muted);">
            ${definitions.length} definition${definitions.length !== 1 ? 's' : ''} • 
            ${examples.length} example${examples.length !== 1 ? 's' : ''} • 
            ${synonyms.length} synonym${synonyms.length !== 1 ? 's' : ''}
        </small>
    </div>
    
    <div class="word-actions">
        <button class="btn-small ${isSaved ? 'active' : ''}" data-action="toggle-personal" data-word="${safeWord}">
            <i class="${isSaved ? 'fas' : 'far'} fa-heart"></i>
        </button>
        <button class="btn-small" data-action="view-word" data-word="${safeWord}">
            <i class="fas fa-eye"></i>
            View All
        </button>
    </div>
</div>
`;

        }).join('');
    }

    updateDictionaryStats() {
        try {
            const totalWords = this.allWords.length;
            const savedWords = this.personalWords.size;
            const masteredCount = Array.from(this.wordMastery.values()).filter(m => m.level === 'mastered').length;

            // Safely update elements if they exist
            this.safeUpdateElement('totalWords', totalWords.toLocaleString());
            this.safeUpdateElement('savedWords', savedWords.toLocaleString());
            this.safeUpdateElement('personalWordCount', savedWords.toLocaleString());
            this.safeUpdateElement('masteredWordsCount', masteredCount.toLocaleString());
            this.safeUpdateElement('personalMasteredCount', masteredCount.toLocaleString());


        } catch (error) {
            console.warn('Error updating dictionary stats:', error);
        }
    }

    hideWordModal() {
        document.getElementById('wordModal').style.display = 'none';
    }

    // Test System
    startTest() {
        const testType = this.getDropdownValue('testTypeDropdown');
        const difficulty = this.getDropdownValue('testDifficultyDropdown');
        const genre = this.getDropdownValue('testGenreDropdown');
        const personalOnly = document.getElementById('testPersonalOnly').checked;
        const troubleWords = document.getElementById('testTroubleWords').checked;
        let questionCount = parseInt(document.getElementById('questionCount').value);

        let testWords = this.words.filter(word => {
            if (difficulty !== 'all' && word.difficulty !== difficulty) return false;
            if (genre !== 'all' && word.genre !== genre) return false;
            if (personalOnly && !this.personalWords.has(word.word)) return false;
            if (troubleWords && this.getMasteryLevel(word.word) !== 'trouble') return false;
            return true;
        });

        // Show detailed count information
        let countMessage = '';
        const totalWords = this.words.length;

        if (difficulty !== 'all') {
            const diffCount = this.countWordsByDifficulty()[difficulty];
            countMessage += `${difficulty}: ${diffCount} words`;
        }

        if (genre !== 'all') {
            const genreCount = this.countWordsByGenre()[genre] || 0;
            if (countMessage) countMessage += ' • ';
            countMessage += `${genre}: ${genreCount} words`;
        }

        if (personalOnly) {
            if (countMessage) countMessage += ' • ';
            countMessage += `Personal: ${this.personalWords.size} words`;
        }

        if (troubleWords) {
            const troubleCount = Array.from(this.wordMastery.values()).filter(m => m.level === 'trouble').length;
            if (countMessage) countMessage += ' • ';
            countMessage += `Trouble: ${troubleCount} words`;
        }

        if (testWords.length === 0) {
            let errorMsg = 'No words match your criteria!';
            if (countMessage) {
                errorMsg += ` Available: ${countMessage}`;
            }
            this.showNotification(errorMsg, 'error');
            return;
        }

        // Limit question count to available words
        const maxQuestions = Math.min(questionCount, testWords.length);
        if (maxQuestions < questionCount) {
            this.showNotification(`Only ${maxQuestions} words available. Test limited to ${maxQuestions} questions.`, 'warning');
        }

        testWords = this.shuffleArray([...testWords]).slice(0, maxQuestions);

        this.testState = {
            words: testWords,
            currentQuestion: 0,
            score: 0,
            answers: [],
            testType,
            questionCount: maxQuestions,
            startTime: new Date(),
            timer: 0
        };

        // Show count information
        let successMsg = `Starting test with ${maxQuestions} questions`;
        if (countMessage) {
            successMsg += ` (from ${countMessage})`;
        }
        this.showNotification(successMsg);

        this.startTestTimer();
        document.getElementById('testSetup').style.display = 'none';
        document.getElementById('testInterface').style.display = 'block';
        this.showQuestion();
    }

    startTestTimer() {
        this.testState.timerInterval = setInterval(() => {
            this.testState.timer++;
            this.updateTestTimer();
        }, 1000);
    }

    updateTestTimer() {
        const minutes = Math.floor(this.testState.timer / 60);
        const seconds = this.testState.timer % 60;
        document.getElementById('timer').textContent =
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    showQuestion() {
        if (this.testState.currentQuestion >= this.testState.words.length) {
            this.finishTest();
            return;
        }

        const question = this.testState.words[this.testState.currentQuestion];
        const progressFill = document.getElementById('testProgressFill');
        const progressText = document.getElementById('currentQuestion');
        const totalQuestions = document.getElementById('totalQuestions');

        const progress = (this.testState.currentQuestion / this.testState.questionCount) * 100;
        progressFill.style.width = `${progress}%`;
        progressText.textContent = this.testState.currentQuestion + 1;
        totalQuestions.textContent = this.testState.questionCount;

        switch (this.testState.testType) {
            case 'meaning':
                document.getElementById('question').textContent = `What is the meaning of "${question.word}"?`;
                this.generateMeaningOptions(question);
                break;
            case 'synonyms':
                document.getElementById('question').textContent = `What is a synonym of "${question.word}"?`;
                this.generateSynonymOptions(question);
                break;
            case 'antonyms':
                document.getElementById('question').textContent = `What is an antonym of "${question.word}"?`;
                this.generateAntonymOptions(question);
                break;
            case 'example':
                const example = question.meanings[0]?.definitions[0]?.example;
                if (example) {
                    document.getElementById('question').textContent = `Complete: "${example.replace(new RegExp(question.word, 'gi'), '______')}"`;
                } else {
                    document.getElementById('question').textContent = `What word fits this context for "${question.word}"?`;
                }
                this.generateExampleOptions(question);
                break;
        }

        document.getElementById('nextQuestion').style.display = 'none';
    }

    generateMeaningOptions(question) {
        const correctAnswer = question.meanings[0]?.definitions[0]?.definition;
        if (!correctAnswer) {
            this.nextTestQuestion();
            return;
        }

        const options = [correctAnswer];
        const otherWords = this.shuffleArray(this.words.filter(w => w.word !== question.word));

        for (let i = 0; i < 3 && i < otherWords.length; i++) {
            const wrongAnswer = otherWords[i].meanings[0]?.definitions[0]?.definition;
            if (wrongAnswer && !options.includes(wrongAnswer)) {
                options.push(wrongAnswer);
            }
        }

        while (options.length < 4) {
            options.push('Not enough data available');
        }

        this.renderOptions(this.shuffleArray(options), correctAnswer);
    }

    generateSynonymOptions(question) {
        const synonyms = question.meanings[0]?.definitions[0]?.synonyms || [];
        if (synonyms.length === 0) {
            this.nextTestQuestion();
            return;
        }

        const correctAnswer = synonyms[0];
        const options = [correctAnswer];
        const otherWords = this.shuffleArray(this.words.filter(w => w.word !== question.word));

        for (let i = 0; i < 3 && i < otherWords.length; i++) {
            const otherSynonyms = otherWords[i].meanings[0]?.definitions[0]?.synonyms || [];
            if (otherSynonyms.length > 0) {
                const wrongAnswer = otherSynonyms[0];
                if (!options.includes(wrongAnswer)) {
                    options.push(wrongAnswer);
                }
            }
        }

        while (options.length < 4) {
            options.push('No synonym available');
        }

        this.renderOptions(this.shuffleArray(options), correctAnswer);
    }

    generateAntonymOptions(question) {
        const antonyms = question.meanings[0]?.definitions[0]?.antonyms || [];
        if (antonyms.length === 0) {
            this.nextTestQuestion();
            return;
        }

        const correctAnswer = antonyms[0];
        const options = [correctAnswer];
        const otherWords = this.shuffleArray(this.words.filter(w => w.word !== question.word));

        for (let i = 0; i < 3 && i < otherWords.length; i++) {
            const otherAntonyms = otherWords[i].meanings[0]?.definitions[0]?.antonyms || [];
            if (otherAntonyms.length > 0) {
                const wrongAnswer = otherAntonyms[0];
                if (!options.includes(wrongAnswer)) {
                    options.push(wrongAnswer);
                }
            }
        }

        while (options.length < 4) {
            options.push('No antonym available');
        }

        this.renderOptions(this.shuffleArray(options), correctAnswer);
    }

    generateExampleOptions(question) {
        const correctAnswer = question.word;
        const options = [correctAnswer];
        const otherWords = this.shuffleArray(this.words.filter(w => w.word !== question.word));

        for (let i = 0; i < 3 && i < otherWords.length; i++) {
            options.push(otherWords[i].word);
        }

        this.renderOptions(this.shuffleArray(options), correctAnswer);
    }

    renderOptions(options, correctAnswer) {
        const optionsElement = document.getElementById('options');
        optionsElement.innerHTML = options.map(option =>
            `<div class="option" data-correct="${option === correctAnswer}">${option}</div>`
        ).join('');

        optionsElement.querySelectorAll('.option').forEach(option => {
            option.addEventListener('click', () => {
                if (option.classList.contains('selected')) return;

                optionsElement.querySelectorAll('.option').forEach(opt => {
                    opt.classList.remove('selected');
                });

                option.classList.add('selected');

                const isCorrect = option.dataset.correct === 'true';
                this.handleAnswer(option.textContent, correctAnswer, isCorrect);

                setTimeout(() => {
                    optionsElement.querySelectorAll('.option').forEach(opt => {
                        if (opt.dataset.correct === 'true') {
                            opt.classList.add('correct');
                        } else if (opt === option && !isCorrect) {
                            opt.classList.add('incorrect');
                        }
                    });
                    document.getElementById('nextQuestion').style.display = 'block';
                }, 500);
            });
        });
    }

    handleAnswer(selectedAnswer, correctAnswer, isCorrect) {
        const currentWord = this.testState.words[this.testState.currentQuestion];

        if (isCorrect) {
            this.testState.score++;
        }

        this.testState.answers.push({
            word: currentWord.word,
            correct: isCorrect,
            userAnswer: selectedAnswer,
            correctAnswer: correctAnswer,
            questionType: this.testState.testType
        });

        this.updateWordMastery(currentWord.word, null, isCorrect);
    }

    nextTestQuestion() {
        this.testState.currentQuestion++;
        this.showQuestion();
    }

    finishTest() {
        clearInterval(this.testState.timerInterval);

        const percentage = (this.testState.score / this.testState.questionCount) * 100;
        const timeTaken = this.formatTime(this.testState.timer);

        if (percentage >= 70) {
            this.updateStreak();
        }

        document.getElementById('testInterface').style.display = 'none';
        document.getElementById('testResults').style.display = 'block';

        document.getElementById('scorePercent').textContent = `${Math.round(percentage)}%`;
        document.getElementById('scoreValue').textContent = this.testState.score;
        document.getElementById('totalQuestionsValue').textContent = this.testState.questionCount;
        document.getElementById('correctAnswers').textContent = this.testState.score;
        document.getElementById('incorrectAnswers').textContent = this.testState.questionCount - this.testState.score;
        document.getElementById('timeTaken').textContent = timeTaken;

        const scoreText = document.getElementById('scoreText');
        if (percentage >= 90) scoreText.textContent = 'Excellent!';
        else if (percentage >= 70) scoreText.textContent = 'Great Job!';
        else if (percentage >= 50) scoreText.textContent = 'Good Effort!';
        else scoreText.textContent = 'Keep Practicing!';

        this.saveTestHistory(percentage, timeTaken);
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    async saveTestHistory(percentage, timeTaken) {
        const history = {
            date: new Date().toISOString(),
            score: this.testState.score,
            total: this.testState.questionCount,
            percentage: percentage,
            timeTaken: timeTaken,
            testType: this.testState.testType,
            answers: this.testState.answers
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['testHistory'], 'readwrite');
            const store = transaction.objectStore('testHistory');
            const request = store.add(history);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Progress and Analytics
    async updateProgressStats() {
        const testHistory = await this.getTestHistory();
        const wordStats = this.calculateWordStats();

        document.getElementById('totalTests').textContent = testHistory.length;
        document.getElementById('averageScore').textContent = this.calculateAverageScore(testHistory) + '%';
        document.getElementById('masteredWordsProgress').textContent = wordStats.mastered;
        document.getElementById('currentStreak').textContent = this.streak;

        this.updateScoreChart(testHistory);
        this.updateMasteryChart(wordStats);
        this.updateTestHistory(testHistory);
        this.updateWordProgressGrid();
    }

    async getTestHistory() {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['testHistory'], 'readonly');
            const store = transaction.objectStore('testHistory');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        });
    }

    calculateWordStats() {
        const stats = { new: 0, learning: 0, known: 0, mastered: 0, trouble: 0 };

        this.wordMastery.forEach(mastery => {
            stats[mastery.level]++;
        });

        stats.new += this.words.length - this.wordMastery.size;
        return stats;
    }

    calculateAverageScore(testHistory) {
        if (testHistory.length === 0) return 0;
        const total = testHistory.reduce((sum, test) => sum + test.percentage, 0);
        return Math.round(total / testHistory.length);
    }

    updateScoreChart(testHistory) {
        const ctx = document.getElementById('scoreChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.charts.scoreChart) {
            this.charts.scoreChart.destroy();
            this.charts.scoreChart = null;
        }

        const recentTests = testHistory.slice(-10);
        if (recentTests.length === 0) return;

        const labels = recentTests.map((test, index) => `Test ${index + 1}`);
        const scores = recentTests.map(test => test.percentage);

        try {
            this.charts.scoreChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Test Scores',
                        data: scores,
                        borderColor: '#4f46e5',
                        backgroundColor: 'rgba(79, 70, 229, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: function (value) {
                                    return value + '%';
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating score chart:', error);
        }
    }

    updateMasteryChart(wordStats) {
        const ctx = document.getElementById('masteryChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.charts.masteryChart) {
            this.charts.masteryChart.destroy();
            this.charts.masteryChart = null;
        }

        try {
            this.charts.masteryChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['New', 'Learning', 'Known', 'Mastered', 'Trouble'],
                    datasets: [{
                        data: [
                            wordStats.new,
                            wordStats.learning,
                            wordStats.known,
                            wordStats.mastered,
                            wordStats.trouble
                        ],
                        backgroundColor: [
                            '#dbeafe', '#fef3c7', '#dcfce7', '#fae8ff', '#fee2e2'
                        ],
                        borderColor: [
                            '#3b82f6', '#f59e0b', '#22c55e', '#d946ef', '#ef4444'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating mastery chart:', error);
        }
    }

    updateMasteryChart(wordStats) {
        const ctx = document.getElementById('masteryChart').getContext('2d');

        if (this.charts.masteryChart) {
            this.charts.masteryChart.destroy();
        }

        this.charts.masteryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['New', 'Learning', 'Known', 'Mastered', 'Trouble'],
                datasets: [{
                    data: [
                        wordStats.new,
                        wordStats.learning,
                        wordStats.known,
                        wordStats.mastered,
                        wordStats.trouble
                    ],
                    backgroundColor: [
                        '#dbeafe', '#fef3c7', '#dcfce7', '#fae8ff', '#fee2e2'
                    ],
                    borderColor: [
                        '#3b82f6', '#f59e0b', '#22c55e', '#d946ef', '#ef4444'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    updateTestHistory(testHistory) {
        const container = document.getElementById('testHistory');
        const recentTests = testHistory.slice(-5).reverse();

        if (recentTests.length === 0) {
            container.innerHTML = '<div class="no-data">No tests taken yet</div>';
            return;
        }

        container.innerHTML = recentTests.map(test => `
            <div class="history-item">
                <div class="history-info">
                    <h4>${this.formatTestType(test.testType)} Test</h4>
                    <div class="test-type">${new Date(test.date).toLocaleDateString()}</div>
                </div>
                <div class="history-score">
                    <div class="score-value ${this.getScoreClass(test.percentage)}">${Math.round(test.percentage)}%</div>
                    <div class="score-details">${test.score}/${test.total} • ${test.timeTaken}</div>
                </div>
            </div>
        `).join('');
    }

    updateWordProgressGrid(filter = 'all', page = 1) {
        const container = document.getElementById('wordProgressGrid');
        if (!container) return;

        let wordsToShow = [];

        if (filter === 'all') {
            wordsToShow = this.words.map(word => ({
                word: word.word,
                mastery: this.getMasteryLevel(word.word),
                wordData: word
            }));
        } else {
            wordsToShow = Array.from(this.wordMastery.entries())
                .filter(([word, mastery]) => mastery.level === filter)
                .map(([word, mastery]) => ({
                    word,
                    mastery: mastery.level,
                    wordData: this.words.find(w => w.word === word)
                }));

            if (filter === 'new') {
                const wordsWithMastery = new Set(Array.from(this.wordMastery.keys()));
                this.words.forEach(word => {
                    if (!wordsWithMastery.has(word.word)) {
                        wordsToShow.push({
                            word: word.word,
                            mastery: 'new',
                            wordData: word
                        });
                    }
                });
            }
        }

        // Add pagination for progress page
        const pageSize = 50;
        const totalPages = Math.ceil(wordsToShow.length / pageSize);
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const pagedWords = wordsToShow.slice(startIndex, endIndex);

        if (pagedWords.length === 0) {
            container.innerHTML = '<div class="no-data">No words found</div>';
            return;
        }

        container.innerHTML = pagedWords.map(({ word, mastery, wordData }) => {
            const definition = wordData?.meanings?.[0]?.definitions?.[0]?.definition || 'No definition available';

            // Use escapeString if available, otherwise use a simple replacement
            const safeWord = typeof this.escapeString === 'function'
                ? this.escapeString(word)
                : word.replace(/'/g, "\\'");

            return `
            <div class="progress-word-item" onclick="app.showWordModal('${safeWord}')" style="cursor: pointer;">
                <div class="progress-word-info">
                    <h4>${word}</h4>
                    <div class="mastery-level">${this.formatMasteryLevel(mastery)}</div>
                    <p class="word-preview">${definition.substring(0, 60)}${definition.length > 60 ? '...' : ''}</p>
                </div>
                <span class="mastery-badge ${mastery}">${mastery}</span>
            </div>
        `;
        }).join('');

        // Add progress page pagination controls if needed
        this.addProgressPaginationControls(totalPages, page, filter);
    }

    addProgressPaginationControls(totalPages, currentPage, filter) {
        const container = document.getElementById('progressPagination');
        if (!container || totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }

        container.innerHTML = `
        <div class="pagination-controls">
            <button class="pagination-btn" onclick="app.updateWordProgressGrid('${filter}', ${currentPage - 1})" 
                    ${currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
            
            <span class="page-info">Page ${currentPage} of ${totalPages}</span>
            
            <button class="pagination-btn" onclick="app.updateWordProgressGrid('${filter}', ${currentPage + 1})" 
                    ${currentPage === totalPages ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;
    }

    formatMasteryLevel(level) {
        const levels = {
            new: 'New word - not studied',
            learning: 'Learning - needs practice',
            known: 'Known - familiar with meaning',
            mastered: 'Mastered - can use correctly',
            trouble: 'Trouble - frequently missed'
        };
        return levels[level] || level;
    }

    formatTestType(type) {
        const types = {
            meaning: 'Meaning',
            synonyms: 'Synonyms',
            antonyms: 'Antonyms',
            example: 'Example',
            mixed: 'Mixed'
        };
        return types[type] || type;
    }

    getScoreClass(percentage) {
        if (percentage >= 80) return 'excellent';
        if (percentage >= 60) return 'good';
        return 'poor';
    }

    // Accessibility System
    setupAccessibility() {
        // Check if already initialized
        if (window.accessibilityInitialized) {

            return;
        }

        window.accessibilityInitialized = true;

        // Text to speech
        this.safeAddEventListener('textToSpeech', 'click', () => {
            const currentWord = this.filteredWords[this.currentWordIndex];
            if (currentWord) this.speakWord(currentWord.word);
        });

        // Font size controls
        this.safeAddEventListener('increaseFont', 'click', () => {
            const currentSize = parseFloat(getComputedStyle(document.body).fontSize);
            document.body.style.fontSize = `${currentSize * 1.1}px`;
            this.showNotification('Font size increased');
        });

        this.safeAddEventListener('decreaseFont', 'click', () => {
            const currentSize = parseFloat(getComputedStyle(document.body).fontSize);
            document.body.style.fontSize = `${currentSize * 0.9}px`;
            this.showNotification('Font size decreased');
        });

        // High contrast - FIXED: Only add event listener if not already added
        const highContrastBtn = document.getElementById('highContrast');
        if (highContrastBtn && !highContrastBtn.dataset.listenerAdded) {
            highContrastBtn.dataset.listenerAdded = 'true';

            highContrastBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();

                // Get current state
                const currentState = document.body.classList.contains('high-contrast');
                const newState = !currentState;



                // Apply the change
                if (newState) {
                    document.body.classList.add('high-contrast');
                    highContrastBtn.classList.add('active');
                    this.showNotification('High contrast enabled');
                    document.documentElement.setAttribute('data-theme', 'light');
                } else {
                    document.body.classList.remove('high-contrast');
                    highContrastBtn.classList.remove('active');
                    this.showNotification('High contrast disabled');
                    // Restore saved theme
                    const savedTheme = localStorage.getItem('theme') || 'light';
                    document.documentElement.setAttribute('data-theme', savedTheme);
                }

                // Save state
                localStorage.setItem('highContrast', newState);
            });
        }

        // Load saved high contrast setting
        const savedHighContrast = localStorage.getItem('highContrast') === 'true';
        if (savedHighContrast) {
            document.body.classList.add('high-contrast');
            document.documentElement.setAttribute('data-theme', 'light');

            // Set button as active
            if (highContrastBtn) {
                highContrastBtn.classList.add('active');
            }
        }

        // Load saved theme
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        const themeIcon = document.querySelector('#themeToggle i');
        if (themeIcon) {
            themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }

        // Toggle accessibility panel
        const accessibilityToggleBtn = document.getElementById('accessibilityToggle');
        if (accessibilityToggleBtn && !accessibilityToggleBtn.dataset.listenerAdded) {
            accessibilityToggleBtn.dataset.listenerAdded = 'true';

            accessibilityToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();

                const options = document.querySelector('.accessibility-options');
                if (options) {
                    options.classList.toggle('show');
                }
            });
        }

        // Close accessibility panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.accessibility-panel')) {
                const options = document.querySelector('.accessibility-options');
                if (options) {
                    options.classList.remove('show');
                }
            }
        });


    }

    speakWord(word) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.rate = 0.8;
            utterance.pitch = 1;
            speechSynthesis.speak(utterance);
        }
    }

    // Utility Methods
    shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    showNotification(message, type = 'success') {


        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}"></i>
        <span>${message}</span>
    `;

        notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: var(--radius-sm);
        box-shadow: var(--shadow-lg);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        animation: slideIn 0.3s ease;
    `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Event Listeners
    setupEventListeners() {
        try {


            // Navigation - only if elements exist
            const navButtons = document.querySelectorAll('.nav-btn');
            if (navButtons.length > 0) {
                navButtons.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));

                        e.currentTarget.classList.add('active');
                        const targetPage = document.getElementById(e.currentTarget.dataset.page);
                        if (targetPage) {
                            targetPage.classList.add('active');
                        }

                        // Update progress stats when progress page is opened
                        if (e.currentTarget.dataset.page === 'progress') {
                            this.updateProgressStats();
                        }

                        // Update dropdown counts when dictionary page is opened
                        if (e.currentTarget.dataset.page === 'dictionary') {
                            setTimeout(() => {
                                this.updateAllDropdownCounts();
                            }, 100);
                        }

                        // Update test filter counts when test page is opened
                        if (e.currentTarget.dataset.page === 'test') {
                            setTimeout(() => {
                                this.updateTestFilterCounts();
                            }, 100);
                        }
                    });
                });
            }

            // Safe event listener setup for all buttons
            this.safeAddEventListener('nextBtn', 'click', () => this.nextCard());
            this.safeAddEventListener('prevBtn', 'click', () => this.prevCard());
            this.safeAddEventListener('flipBtn', 'click', () => {
                const flashcard = document.getElementById('flashcard');
                if (flashcard) flashcard.classList.toggle('flipped');
            });
            this.safeAddEventListener('shuffleBtn', 'click', () => this.shuffleCards());
            this.safeAddEventListener('speakWord', 'click', () => {
                const currentWord = this.filteredWords[this.currentWordIndex];
                if (currentWord) this.speakWord(currentWord.word);
            });

            // Flashcard click to flip
            const flashcard = document.getElementById('flashcard');
            if (flashcard) {
                flashcard.addEventListener('click', (e) => {
                    if (!e.target.closest('button')) {
                        flashcard.classList.toggle('flipped');
                    }
                });
            }

            // Apply filters
            this.safeAddEventListener('applyFilters', 'click', () => this.applyFilters());

            // Update counts when filter dropdowns change
            document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
                dropdown.addEventListener('change', (e) => {
                    const dropdownId = e.currentTarget.id;

                    // Update counts for test dropdowns
                    if (dropdownId.includes('test')) {
                        this.updateTestFilterCounts();
                    }
                    // Update counts for flashcard dropdowns
                    else if (dropdownId.includes('difficulty') || dropdownId.includes('genre')) {
                        this.updateFlashcardFilterCounts();
                    }
                });
            });

            // Update counts when personal words checkbox changes
            const personalOnlyCheckbox = document.getElementById('personalListOnly');
            if (personalOnlyCheckbox) {
                personalOnlyCheckbox.addEventListener('change', () => {
                    this.updateFlashcardFilterCounts();
                });
            }

            // Update counts when test checkboxes change
            const testPersonalOnly = document.getElementById('testPersonalOnly');
            if (testPersonalOnly) {
                testPersonalOnly.addEventListener('change', () => {
                    this.updateTestFilterCounts();
                });
            }

            const testTroubleWords = document.getElementById('testTroubleWords');
            if (testTroubleWords) {
                testTroubleWords.addEventListener('change', () => {
                    this.updateTestFilterCounts();
                });
            }

            // Update test counts when question count changes
            let questionCount = document.getElementById('questionCount');
            if (questionCount) {
                questionCount.addEventListener('input', () => {
                    this.updateTestFilterCounts();
                });
            }

            // Dictionary search with debouncing
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                let searchTimeout;
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        this.filterWords();
                    }, 300);
                });
            }

            this.safeAddEventListener('clearSearch', 'click', () => {
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    searchInput.value = '';
                    this.filterWords();
                }
            });

            // Sort dropdown
            this.safeAddEventListener('sortDropdown', 'change', (e) => {
                this.filterWords();
            });

            // Alphabet navigation - filter by starting letter
            const alphabetList = document.getElementById('alphabetList');
            if (alphabetList) {
                alphabetList.addEventListener('click', (e) => {
                    if (e.target.classList.contains('letter')) {
                        const letter = e.target.dataset.letter;

                        // Clear search input when using alphabet navigation
                        const searchInput = document.getElementById('searchInput');
                        if (searchInput) {
                            searchInput.value = '';
                        }

                        // Filter words that start with the selected letter
                        this.filterWordsByLetter(letter);
                    }
                });
            }

            questionCount = document.getElementById('questionCount');
            const questionCountValue = document.getElementById('questionCountValue');
            if (questionCount && questionCountValue) {
                // Set initial value
                questionCountValue.textContent = questionCount.value;

                // Update on input
                questionCount.addEventListener('input', (e) => {
                    questionCountValue.textContent = e.target.value;
                    this.updateTestFilterCounts();
                });
            }

            // Test controls
            this.safeAddEventListener('startTest', 'click', () => this.startTest());
            this.safeAddEventListener('nextQuestion', 'click', () => this.nextTestQuestion());
            this.safeAddEventListener('newTest', 'click', () => {
                const testResults = document.getElementById('testResults');
                const testSetup = document.getElementById('testSetup');
                if (testResults && testSetup) {
                    testResults.style.display = 'none';
                    testSetup.style.display = 'block';
                }
            });

            // Test review and retake buttons
            this.safeAddEventListener('reviewTest', 'click', () => this.showReviewTest());
            this.safeAddEventListener('retestIncorrect', 'click', () => this.retestIncorrect());
            this.safeAddEventListener('closeReview', 'click', () => {
                document.getElementById('reviewTest').style.display = 'none';
                document.getElementById('testResults').style.display = 'block';
            });

            // Personal words actions
            this.safeAddEventListener('practiceWords', 'click', () => {
                this.startPracticeMode('flashcards');
            });

            this.safeAddEventListener('shufflePersonal', 'click', () => {
                this.shuffleCards();
            });

            // Export/Import
            this.safeAddEventListener('exportWords', 'click', () => this.exportWords());
            this.safeAddEventListener('importWordsBtn', 'click', () => {
                const importWords = document.getElementById('importWords');
                if (importWords) importWords.click();
            });

            const importWords = document.getElementById('importWords');
            if (importWords) {
                importWords.addEventListener('change', (e) => this.importWords(e));
            }

            // Practice mode buttons
            document.querySelectorAll('.practice-mode-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const mode = e.target.closest('button').dataset.mode;
                    this.startPracticeMode(mode);
                });
            });

            // Progress page filters
            document.querySelectorAll('.filter-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                    e.target.classList.add('active');
                    this.updateWordProgressGrid(e.target.dataset.filter);
                });
            });

            // Personal words filter
            this.safeAddEventListener('personalFilterDropdown', 'change', (e) => {
                this.filterPersonalWords(e.detail.value);
            });

            // Theme toggle
            this.safeAddEventListener('themeToggle', 'click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', newTheme);

                const icon = document.querySelector('#themeToggle i');
                if (icon) {
                    icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
                }
                localStorage.setItem('theme', newTheme);
            });

            // Load saved theme
            const savedTheme = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', savedTheme);
            const themeIcon = document.querySelector('#themeToggle i');
            if (themeIcon) {
                themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            }

            // Safe pagination event binding
            this.safeAddEventListener('firstPage', 'click', () => this.loadPage(1));
            this.safeAddEventListener('prevPage', 'click', () => this.loadPage(this.currentPage - 1));
            this.safeAddEventListener('nextPage', 'click', () => this.loadPage(this.currentPage + 1));
            this.safeAddEventListener('lastPage', 'click', () => this.loadPage(this.totalPages));
            this.safeAddEventListener('pageSizeSelect', 'change', () => this.updatePageSize());

            // Data management buttons (if they exist)
            this.safeAddEventListener('reuploadDictionary', 'click', () => {
                if (confirm('This will delete all current words and require you to re-upload your dictionary. Continue?')) {
                    this.forceReupload();
                }
            });

            this.safeAddEventListener('clearAllData', 'click', () => {
                if (confirm('This will delete ALL your data including progress, personal words, and test history. This cannot be undone. Continue?')) {
                    this.clearAllData();
                }
            });

            // Accessibility
            this.setupAccessibility();

            // Modal close
            const closeBtn = document.querySelector('.close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.hideWordModal());
            }

            window.addEventListener('click', (e) => {
                if (e.target === document.getElementById('wordModal')) {
                    this.hideWordModal();
                }
            });



        } catch (error) {
            console.error('Error setting up event listeners:', error);
        }
    }

    // Add these methods to update filter counts dynamically
    updateFlashcardFilterCounts() {
        const difficulty = this.getDropdownValue('difficultyDropdown');
        const genre = this.getDropdownValue('genreDropdown');
        const personalOnly = document.getElementById('personalListOnly')?.checked || false;

        // Calculate counts
        let totalCount = this.words.length;
        let difficultyCount = totalCount;
        let genreCount = totalCount;
        let personalCount = this.personalWords.size;
        let finalCount = totalCount;

        // Get difficulty count
        if (difficulty !== 'all') {
            difficultyCount = this.countWordsByDifficulty()[difficulty] || 0;
            finalCount = difficultyCount;
        }

        // Get genre count
        if (genre !== 'all') {
            genreCount = this.countWordsByGenre()[genre] || 0;
            finalCount = Math.min(finalCount, genreCount);
        }

        // Apply personal filter
        if (personalOnly) {
            finalCount = Math.min(finalCount, personalCount);
        }

        // Update preview displays
        this.updateFilterPreview('difficultyPreview', difficultyCount, 'words in selected difficulty');
        this.updateFilterPreview('genrePreview', genreCount, 'words in selected genre');
        this.updateFilterPreview('personalPreview', personalCount, 'personal words available');

        // Update the apply button text with count
        const filterCountElement = document.getElementById('filterCount');
        if (filterCountElement) {
            filterCountElement.textContent = finalCount;
        }

        // Also update the button text
        const applyBtn = document.getElementById('applyFilters');
        if (applyBtn) {
            applyBtn.innerHTML = `<i class="fas fa-filter"></i> Apply Filters (${finalCount} words)`;
        }
    }

    updateFilterPreview(elementId, count, label) {
        const element = document.getElementById(elementId);
        if (element) {
            // Format count with thousands separator
            const formattedCount = count.toLocaleString();
            element.innerHTML = `<span class="count">${formattedCount}</span> <span class="label">${label}</span>`;
            element.style.display = 'block';
        }
    }

    updateTestFilterCounts() {
        const difficulty = this.getDropdownValue('testDifficultyDropdown');
        const genre = this.getDropdownValue('testGenreDropdown');
        const personalOnly = document.getElementById('testPersonalOnly')?.checked || false;
        const troubleWords = document.getElementById('testTroubleWords')?.checked || false;
        const questionCount = parseInt(document.getElementById('questionCount')?.value || 10);

        let availableCount = this.words.length;

        // Apply difficulty filter
        if (difficulty !== 'all') {
            const diffCount = this.countWordsByDifficulty()[difficulty] || 0;
            availableCount = diffCount;
        }

        // Apply genre filter
        if (genre !== 'all') {
            const genreCount = this.countWordsByGenre()[genre] || 0;
            availableCount = Math.min(availableCount, genreCount);
        }

        // Apply personal filter
        if (personalOnly) {
            availableCount = Math.min(availableCount, this.personalWords.size);
        }

        // Apply trouble words filter
        if (troubleWords) {
            const troubleCount = Array.from(this.wordMastery.values()).filter(m => m.level === 'trouble').length;
            availableCount = Math.min(availableCount, troubleCount);
        }

        const maxQuestions = Math.min(questionCount, availableCount);

        // Update the start test button text with count
        const startBtn = document.getElementById('startTest');
        if (startBtn) {
            startBtn.innerHTML = `<i class="fas fa-play"></i> Start Test (${maxQuestions} questions available)`;
        }

        // Update test config preview
        this.updateTestConfigPreview(availableCount, maxQuestions);
    }

    updateTestConfigPreview(availableWords, maxQuestions) {
        const previewTotalWords = document.getElementById('previewTotalWords');
        const previewAvailableWords = document.getElementById('previewAvailableWords');
        const previewMaxQuestions = document.getElementById('previewMaxQuestions');

        if (previewTotalWords) {
            previewTotalWords.textContent = this.words.length.toLocaleString();
        }
        if (previewAvailableWords) {
            previewAvailableWords.textContent = availableWords.toLocaleString();
        }
        if (previewMaxQuestions) {
            previewMaxQuestions.textContent = maxQuestions;
        }
    }

    applyFilters() {
        const difficulty = this.getDropdownValue('difficultyDropdown');
        const genre = this.getDropdownValue('genreDropdown');
        const personalOnly = document.getElementById('personalListOnly').checked;

        // Count words for each filter combination
        let filtered = this.words;
        let filteredCount = filtered.length;

        if (difficulty !== 'all') {
            filtered = filtered.filter(word => word.difficulty === difficulty);
        }

        if (genre !== 'all') {
            filtered = filtered.filter(word => word.genre === genre);
        }

        if (personalOnly) {
            filtered = filtered.filter(word => this.personalWords.has(word.word));
        }

        this.filteredWords = filtered;
        this.currentWordIndex = 0;
        this.resetFlashcard();
        this.updateFlashcard();

        // Show counts in notification
        let message = '';
        if (difficulty !== 'all' || genre !== 'all' || personalOnly) {
            message = `Found ${filtered.length} words`;
            if (difficulty !== 'all') {
                const diffCount = this.countWordsByDifficulty()[difficulty];
                message += ` (${diffCount} in ${difficulty} difficulty)`;
            }
            if (genre !== 'all') {
                const genreCount = this.countWordsByGenre()[genre] || 0;
                message += ` (${genreCount} in ${genre} genre)`;
            }
            if (personalOnly) {
                message += ` (${this.personalWords.size} personal words)`;
            }
        } else {
            message = `Showing all ${filtered.length} words`;
        }

        if (this.filteredWords.length === 0) {
            this.showNotification('No words match your filters!', 'error');
        } else {
            this.showNotification(message);
        }

        // Update the filter info display
        this.updateFilterCountInfo(difficulty, genre, personalOnly);
    }

    // Add this method to show filter counts
    updateFilterCountInfo(difficulty, genre, personalOnly) {
        const filterInfo = document.getElementById('filterInfo');
        if (!filterInfo) return;

        let description = '';
        let totalCount = this.words.length;

        if (difficulty === 'all' && genre === 'all' && !personalOnly) {
            filterInfo.style.display = 'none';
            return;
        }

        filterInfo.style.display = 'block';

        if (difficulty !== 'all') {
            const diffCount = this.countWordsByDifficulty()[difficulty];
            description += `${difficulty} difficulty: ${diffCount} words`;
            totalCount = diffCount;
        }

        if (genre !== 'all') {
            const genreCount = this.countWordsByGenre()[genre] || 0;
            if (description) description += ' • ';
            description += `${genre} genre: ${genreCount} words`;
            totalCount = genreCount;
        }

        if (personalOnly) {
            if (description) description += ' • ';
            description += `Personal: ${this.personalWords.size} words`;
            totalCount = this.personalWords.size;
        }

        // If multiple filters, show combined count
        if ((difficulty !== 'all' && genre !== 'all') || (personalOnly && (difficulty !== 'all' || genre !== 'all'))) {
            description += ` → ${this.filteredWords.length} matching words`;
        }

        document.getElementById('filterDescription').textContent = description;
    }

    filterPersonalWords(filter = 'all', page = 1) {
        const container = document.getElementById('personalWordList');
        if (!container) return;

        const personalWordsArray = Array.from(this.personalWords);

        if (personalWordsArray.length === 0) {
            container.innerHTML = `
            <div class="no-words">
                <i class="far fa-folder-open"></i>
                <h3>No words saved yet</h3>
                <p>Start adding words from the dictionary or flashcards!</p>
            </div>
        `;
            return;
        }

        let filteredWords = personalWordsArray;
        if (filter !== 'all') {
            filteredWords = personalWordsArray.filter(word =>
                this.getMasteryLevel(word) === filter
            );
        }

        // Add pagination for personal words
        const pageSize = 50;
        const totalPages = Math.ceil(filteredWords.length / pageSize);
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const pagedWords = filteredWords.slice(startIndex, endIndex);

        container.innerHTML = pagedWords.map(word => {
            const wordData = this.words.find(w => w.word === word);
            if (!wordData) return '';

            const meaning = wordData.meanings[0]?.definitions[0]?.definition || 'No definition available';
            const mastery = this.getMasteryLevel(word);

            return `
            <div class="word-item" data-word="${word}">
                <div class="word-header">
                    <h3>${word}</h3>
                    <span class="difficulty-badge ${wordData.difficulty}">${wordData.difficulty}</span>
                </div>
                <p class="phonetic">${wordData.phonetic}</p>
                <p class="meaning">${meaning.substring(0, 80)}${meaning.length > 80 ? '...' : ''}</p>
                <div class="word-mastery-info">
                    <span class="mastery-badge ${mastery}">${mastery}</span>
                </div>
                <div class="word-actions">
                    <button class="btn-small" data-action="view-word">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-small btn-remove" data-action="remove-personal">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        }).join('');

        // Add personal words pagination
        this.addPersonalWordsPagination(totalPages, page, filter);

        // Update dropdown to show current filter
        this.updatePersonalFilterDropdown(filter);
    }

    // Add this method to update the dropdown display
    updatePersonalFilterDropdown(filter) {
        const dropdown = document.getElementById('personalFilterDropdown');
        if (!dropdown) return;

        const selectedSpan = dropdown.querySelector('.dropdown-selected span');
        const options = dropdown.querySelectorAll('.dropdown-option');

        if (selectedSpan) {
            const filterText = {
                'all': 'All Words',
                'new': 'New Words',
                'learning': 'Learning',
                'known': 'Known Words',
                'mastered': 'Mastered',
                'trouble': 'Trouble Words'
            }[filter] || 'All Words';

            selectedSpan.textContent = filterText;
        }

        options.forEach(option => {
            option.classList.remove('selected');
            if (option.dataset.value === filter) {
                option.classList.add('selected');
            }
        });
    }

    addPersonalWordsPagination(totalPages, currentPage, filter) {
        const container = document.getElementById('personalWordsPagination');
        if (!container || totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }

        container.innerHTML = `
        <div class="pagination-controls">
            <button class="pagination-btn" onclick="app.filterPersonalWords('${filter}', ${currentPage - 1})" 
                    ${currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
            
            <span class="page-info">Page ${currentPage} of ${totalPages}</span>
            
            <button class="pagination-btn" onclick="app.filterPersonalWords('${filter}', ${currentPage + 1})" 
                    ${currentPage === totalPages ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;
    }

    // Practice Modes
    startPracticeMode(mode) {
        if (this.personalWords.size === 0) {
            this.showNotification('Add some words to your list first!', 'error');
            return;
        }

        switch (mode) {
            case 'flashcards':
                document.querySelector('[data-page="home"]').click();
                document.getElementById('personalListOnly').checked = true;
                this.applyFilters();
                break;
            case 'test':
                document.querySelector('[data-page="test"]').click();
                document.getElementById('testPersonalOnly').checked = true;
                break;
            case 'matching':
                this.showNotification('Matching game coming soon!');
                break;
        }
    }

    // Export/Import
    async exportWords() {
        const personalWordsData = await this.getPersonalWordsData();
        const wordMasteryData = Array.from(this.wordMastery.values());

        const exportData = {
            personalWords: personalWordsData,
            wordMastery: wordMasteryData,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vocabulary-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('Words exported successfully!');
    }

    async importWords(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importData = JSON.parse(e.target.result);
                await this.processImportData(importData);
                this.showNotification('Words imported successfully!');
            } catch (error) {
                this.showNotification('Error importing words', 'error');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
    }

    async processImportData(importData) {
        if (importData.personalWords) {
            for (const wordData of importData.personalWords) {
                await this.addToPersonalWords(wordData.word);
            }
        }

        if (importData.wordMastery) {
            for (const mastery of importData.wordMastery) {
                this.wordMastery.set(mastery.word, mastery);
                await this.updateWordMastery(mastery.word, mastery.level);
            }
        }

        this.updatePersonalWordList();
        this.updateDictionaryStats();
        this.updateProgressStats();
    }

    async getPersonalWordsData() {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['personalWords'], 'readonly');
            const store = transaction.objectStore('personalWords');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve([]);
        });
    }

    // Data management methods (for reupload/clear buttons)
    async forceReupload() {
        try {
            await this.clearWordsStore();
            localStorage.setItem('forceDictionaryUpload', 'true');
            location.reload();
        } catch (error) {
            console.error('Error forcing re-upload:', error);
            this.showNotification('Error clearing dictionary', 'error');
        }
    }

    async clearAllData() {
        try {
            await this.clearObjectStore('words');
            await this.clearObjectStore('personalWords');
            await this.clearObjectStore('testHistory');
            await this.clearObjectStore('wordMastery');
            await this.clearObjectStore('streak');

            localStorage.clear();
            this.showNotification('All data cleared successfully');
            setTimeout(() => location.reload(), 1000);
        } catch (error) {
            console.error('Error clearing all data:', error);
            this.showNotification('Error clearing data', 'error');
        }
    }

    async clearObjectStore(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Helper method to safely update elements
    safeUpdateElement(elementId, text) {
        try {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = text;
            }
        } catch (error) {
            console.warn(`Error updating element ${elementId}:`, error);
        }
    }

    // Test
    showReviewTest() {


        const reviewContainer = document.getElementById('reviewTest');
        const reviewQuestions = document.getElementById('reviewQuestions');




        if (!reviewContainer || !reviewQuestions) {
            console.error('Review container not found');
            this.showNotification('Review section not found', 'error');
            return;
        }

        // Ensure we have test state and answers
        if (!this.testState || !this.testState.answers || this.testState.answers.length === 0) {
            console.error('No test answers available for review');

            this.showNotification('No test data available for review. Please complete a test first.', 'error');
            return;
        }



        // Create review content
        let reviewHTML = '';

        this.testState.answers.forEach((answer, index) => {
            const wordData = this.words.find(w => w.word === answer.word);
            const isCorrect = answer.correct;
            const userAnswer = answer.userAnswer || 'No answer provided';
            const correctAnswer = answer.correctAnswer || 'No correct answer available';

            const questionTypeText = this.formatTestType(answer.questionType);
            const definition = wordData?.meanings?.[0]?.definitions?.[0]?.definition || 'Definition not available';
            const example = wordData?.meanings?.[0]?.definitions?.[0]?.example || '';
            const synonyms = wordData?.meanings?.[0]?.definitions?.[0]?.synonyms || [];
            const antonyms = wordData?.meanings?.[0]?.definitions?.[0]?.antonyms || [];

            reviewHTML += `
            <div class="review-question ${isCorrect ? 'correct' : 'incorrect'}">
                <div class="question-header">
                    <h4>Question ${index + 1}</h4>
                    <span class="result-badge ${isCorrect ? 'correct' : 'incorrect'}">
                        <i class="fas fa-${isCorrect ? 'check' : 'times'}"></i>
                        ${isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                </div>
                
                <div class="question-content">
                    <div class="word-info">
                        <strong>Word:</strong> <span class="word-text">${answer.word}</span>
                    </div>
                    
                    <div class="question-type">
                        <strong>Type:</strong> ${questionTypeText}
                    </div>
                    
                    <div class="answer-comparison">
                        <div class="user-answer ${isCorrect ? 'correct' : 'incorrect'}">
                            <strong>Your Answer:</strong> ${userAnswer}
                        </div>
                        ${!isCorrect ? `
                            <div class="correct-answer">
                                <strong>Correct Answer:</strong> ${correctAnswer}
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="word-details">
                    <div class="definition">
                        <strong>Definition:</strong> ${definition}
                    </div>
                    ${example ? `
                        <div class="example">
                            <strong>Example:</strong> "${example}"
                        </div>
                    ` : ''}
                    ${synonyms.length > 0 ? `
                        <div class="synonyms">
                            <strong>Synonyms:</strong> ${synonyms.join(', ')}
                        </div>
                    ` : ''}
                    ${antonyms.length > 0 ? `
                        <div class="antonyms">
                            <strong>Antonyms:</strong> ${antonyms.join(', ')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        });


        reviewQuestions.innerHTML = reviewHTML;

        // Show the review container and hide results
        document.getElementById('testResults').style.display = 'none';
        reviewContainer.style.display = 'block';


        this.showNotification(`Reviewing ${this.testState.answers.length} test questions`);
    }

    retestIncorrect() {
        const incorrectWords = this.testState.answers
            .filter(answer => !answer.correct)
            .map(answer => this.words.find(w => w.word === answer.word))
            .filter(word => word); // Remove undefined values

        if (incorrectWords.length === 0) {
            this.showNotification('No incorrect answers to retest!', 'error');
            return;
        }

        this.testState = {
            words: incorrectWords,
            currentQuestion: 0,
            score: 0,
            answers: [],
            testType: this.testState.testType,
            questionCount: incorrectWords.length,
            startTime: new Date(),
            timer: 0
        };

        this.startTestTimer();
        document.getElementById('testResults').style.display = 'none';
        document.getElementById('testInterface').style.display = 'block';
        this.showQuestion();

        this.showNotification(`Retesting ${incorrectWords.length} incorrect words`);
    }

    filterWordsByLetter(letter) {
        if (!letter) return;

        let filtered;

        if (letter === 'all') {
            // Show all words from original dataset
            filtered = [...this.words];
        } else {
            // Filter words that start with the selected letter from original dataset
            filtered = this.words.filter(word =>
                word.word.toLowerCase().startsWith(letter.toLowerCase())
            );
        }

        const sortBy = this.getDropdownValue('sortDropdown');
        filtered = this.sortWords(filtered, sortBy);

        // Update displayed words with filtered results
        this.displayedWords = filtered;

        // Reset to first page
        this.currentPage = 1;
        this.totalPages = Math.ceil(filtered.length / this.pageSize);

        // Show first page
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pagedResults = filtered.slice(startIndex, endIndex);

        this.renderWordList(pagedResults);
        this.updateDictionaryStats();

        // Highlight the selected letter
        this.highlightSelectedLetter(letter);

        if (letter === 'all') {
            this.showNotification('Showing all words');
            this.updateFilterInfo(null, null);
        } else {
            this.showNotification(`Showing words starting with "${letter}"`);
            this.updateFilterInfo(letter, null);
        }

        // Clear search input when using letter navigation
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
        }

        // Update pagination
        if (this.paginationControlsExist()) {
            this.safeUpdateElement('totalDisplayWords', filtered.length.toLocaleString());
            this.updatePaginationControls();
        }
    }

    highlightSelectedLetter(letter) {
        const letters = document.querySelectorAll('.letter');
        letters.forEach(l => {
            l.classList.remove('active');
            if (l.dataset.letter === letter) {
                l.classList.add('active');
            }
        });
    }

    updateFilterInfo(letter = null, searchTerm = null) {
        const filterInfo = document.getElementById('filterInfo');
        const filterDescription = document.getElementById('filterDescription');

        if (!filterInfo || !filterDescription) return;

        if (letter === 'all' && !searchTerm) {
            filterInfo.style.display = 'none';
        } else if (letter && letter !== 'all') {
            filterInfo.style.display = 'block';
            filterDescription.textContent = `Showing words starting with "${letter}"`;
        } else if (searchTerm) {
            filterInfo.style.display = 'block';
            filterDescription.textContent = `Showing words containing "${searchTerm}"`;
        } else {
            filterInfo.style.display = 'none';
        }
    }

    setupWordListEventDelegation() {
        const wordListContainer = document.getElementById('wordList');
        if (wordListContainer) {
            wordListContainer.addEventListener('click', (e) => {
                const wordItem = e.target.closest('.word-item');
                if (!wordItem) return;

                const word = wordItem.dataset.word;

                // Handle heart button click
                const heartBtn = e.target.closest('.btn-small .fa-heart, .btn-small[data-action="toggle-personal"]');
                if (heartBtn) {
                    e.stopPropagation();
                    this.togglePersonalWord(word);
                    return;
                }

                // Handle view button click or eye icon
                const viewBtn = e.target.closest('.btn-small .fa-eye, .btn-small[data-action="view-word"], .btn-small');
                if (viewBtn && !viewBtn.querySelector('.fa-heart')) {
                    e.stopPropagation();
                    this.showWordModal(word);
                    return;
                }

                // Handle entire word item click (opens modal)
                if (e.target.closest('.word-item') && !e.target.closest('.word-actions')) {
                    this.showWordModal(word);
                }
            });
        }
    }

    // Helper method to escape strings for JavaScript
    escapeString(str) {
        if (!str) return '';
        return str
            .replace(/\\/g, '\\\\')  // Escape backslashes first
            .replace(/'/g, "\\'")    // Escape single quotes
            .replace(/"/g, '\\"')    // Escape double quotes
            .replace(/\n/g, '\\n')   // Escape newlines
            .replace(/\r/g, '\\r')   // Escape carriage returns
            .replace(/\t/g, '\\t')   // Escape tabs
            .replace(/\f/g, '\\f');  // Escape form feeds
    }

    debugTestState() {


        if (this.testState) {



        }


    }

    togglePersonalWord(word) {



        if (this.personalWords.has(word)) {

            this.removeFromPersonalWords(word);
        } else {

            this.addToPersonalWords(word);
        }
    }
}

// Add Custom Scrollbar and Additional Styles
const customScrollbarStyles = `
/* Custom Scrollbar Styles */
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: var(--surface-color);
    border-radius: 4px;
}

::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
    transition: var(--transition);
}

::-webkit-scrollbar-thumb:hover {
    background: var(--text-secondary);
}

::-webkit-scrollbar-corner {
    background: var(--surface-color);
}

/* Firefox Scrollbar */
* {
    scrollbar-width: thin;
    scrollbar-color: var(--border-color) var(--surface-color);
}

/* Loading and Progress Styles */
.import-progress {
    text-align: center;
    padding: 2rem;
}

.import-progress .progress-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 1rem;
    font-weight: 600;
}

.import-stats {
    margin-top: 1rem;
    color: var(--text-secondary);
}

/* Additional Styles */
.word-mastery-info {
    margin: 0.5rem 0;
}

.no-data {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
    font-style: italic;
}

.personal-filters {
    min-width: 150px;
}

.btn-small {
    padding: 0.5rem;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--surface-color);
    color: var(--text-primary);
    cursor: pointer;
    transition: var(--transition);
}

.btn-small:hover {
    background: var(--border-color);
}

.btn-small.active {
    background: var(--error-color);
    color: white;
}

.btn-remove {
    background: var(--error-color);
    color: white;
}

.btn-remove:hover {
    background: #dc2626;
}

.modal-word-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
}

.modal-tags {
    display: flex;
    gap: 0.5rem;
}

.meaning-section {
    margin-bottom: 2rem;
}

.meaning-section h3 {
    color: var(--text-secondary);
    font-size: 1rem;
    text-transform: capitalize;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
}

.definition-item {
    background: var(--surface-color);
    padding: 1rem;
    border-radius: var(--radius-sm);
    margin-bottom: 1rem;
}

.definition-item p {
    margin-bottom: 0.5rem;
}

.definition-item .example {
    font-style: italic;
    color: var(--text-secondary);
}

.modal-actions {
    display: flex;
    gap: 1rem;
    margin-top: 2rem;
    flex-wrap: wrap;
}

@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}

@media (max-width: 768px) {
    .mastery-buttons {
        grid-template-columns: 1fr;
    }
    
    .personal-filters {
        min-width: 100%;
    }
    
    .modal-word-header {
        flex-direction: column;
        gap: 1rem;
    }
    
    .modal-actions {
        flex-direction: column;
    }
}
`;

// Add the styles to the document
const styleSheet = document.createElement('style');
styleSheet.textContent = customScrollbarStyles;
document.head.appendChild(styleSheet);

// Initialize the app when DOM is loaded
let app;

// Wait for DOM to be fully ready
function initApp() {
    if (window.appInitialized) {

        return;
    }

    window.appInitialized = true;

    // Check if required DOM elements exist
    const requiredElements = [
        'loadingSpinner',
        'dictionaryUpload',
        'home'
    ];

    const missingElements = requiredElements.filter(id => !document.getElementById(id));

    if (missingElements.length > 0) {
        console.warn('Missing DOM elements, retrying...', missingElements);
        setTimeout(initApp, 100);
        return;
    }

    try {
        app = new VocabularyApp();
        window.app = app; // Make sure app is available globally
        window.appInitialized = true;

    } catch (error) {
        console.error('Failed to initialize app:', error);
        document.getElementById('loadingSpinner').style.display = 'none';
        document.body.innerHTML = `
            <div style="padding: 2rem; text-align: center;">
                <h2>Error Loading Application</h2>
                <p>There was an error loading the vocabulary app. Please refresh the page.</p>
                <button onclick="location.reload()" style="padding: 0.5rem 1rem; margin-top: 1rem;">
                    Refresh Page
                </button>
            </div>
        `;
    }
}

// Multiple DOM ready checks
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Fallback initialization
setTimeout(initApp, 1000);
