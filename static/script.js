// Game state
let currentPuzzle = {
    clues: [],
    counts: [],
    gridSize: 4,
    userGrid: [],
    solutionHash: null,
    isCorrect: false,
    puzzleData: null  // For sharing
};

// Initialize the game
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadPuzzle();
});

function initializeEventListeners() {
    document.getElementById('newPuzzleBtn').addEventListener('click', () => generateNewPuzzle(null, true));
    document.getElementById('checkBtn').addEventListener('click', checkSolution);
    document.getElementById('giveUpBtn').addEventListener('click', giveUp);
    document.getElementById('instructionsBtn').addEventListener('click', showInstructions);
    document.getElementById('sharePuzzleBtn').addEventListener('click', copyPuzzleLink);

    // Modal close button
    const modal = document.getElementById('instructionsModal');
    const closeBtn = document.querySelector('.close');

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Beta banner dismiss
    initializeBetaBanner();
}

function initializeBetaBanner() {
    const banner = document.getElementById('betaBanner');
    const dismissBtn = document.getElementById('dismissBanner');

    // Check if banner was previously dismissed
    const bannerDismissed = localStorage.getItem('betaBannerDismissed');

    if (bannerDismissed === 'true') {
        banner.style.display = 'none';
    }

    dismissBtn.addEventListener('click', () => {
        banner.classList.add('hidden');
        localStorage.setItem('betaBannerDismissed', 'true');

        // Remove from DOM after animation completes
        setTimeout(() => {
            banner.style.display = 'none';
        }, 300);
    });
}

function showInstructions() {
    document.getElementById('instructionsModal').style.display = 'block';
}

function loadPuzzle() {
    // Check if there's a puzzle parameter in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const puzzleParam = urlParams.get('puzzle');

    if (puzzleParam) {
        // Load the shared puzzle
        generateNewPuzzle(puzzleParam);
    } else {
        // Generate a new puzzle
        generateNewPuzzle();
    }
}

async function generateNewPuzzle(puzzleParam = null, clearUrl = false) {
    // Hide grids and show loading state
    hideGrids();
    showLoadingState(puzzleParam ? 'retrieving' : 'generating');
    hideMessage();

    // Record the start time for minimum loading duration
    const startTime = Date.now();
    const minLoadingTime = 3500; // Minimum load time for smooth transitions

    try {
        // Build URL with puzzle parameter if provided
        let url = '/api/new-puzzle';
        if (puzzleParam) {
            url += `?puzzle=${encodeURIComponent(puzzleParam)}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            currentPuzzle.clues = data.clues;
            currentPuzzle.counts = data.counts;
            currentPuzzle.gridSize = data.gridSize;
            currentPuzzle.solutionHash = data.solutionHash;
            currentPuzzle.isCorrect = false;
            currentPuzzle.puzzleData = data.puzzleData;  // Store puzzle data for sharing

            // Initialize empty user grid
            currentPuzzle.userGrid = Array(currentPuzzle.gridSize)
                .fill(0)
                .map(() => Array(currentPuzzle.gridSize).fill(0));

            // Log actual generation time
            const elapsedTime = Date.now() - startTime;
            console.log(`Puzzle generated in ${elapsedTime}ms`);

            // Calculate remaining time to reach minimum loading duration
            const remainingTime = Math.max(0, minLoadingTime - elapsedTime);

            // Wait for remaining time before hiding loading state
            await new Promise(resolve => setTimeout(resolve, remainingTime));

            // Render grids only after minimum loading time has passed
            renderMainGrid();
            renderClues();

            hideLoadingState();
            showGrids();

            // Update URL based on context
            if (puzzleParam) {
                // Loading a shared puzzle - add parameter to URL
                const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?puzzle=${encodeURIComponent(puzzleParam)}`;
                window.history.replaceState({path: newUrl}, '', newUrl);
            } else if (clearUrl) {
                // Generating a new puzzle - clear URL parameters
                const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
                window.history.replaceState({path: newUrl}, '', newUrl);
            }
        } else {
            // Calculate remaining time for error case too
            const elapsedTime = Date.now() - startTime;
            const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
            await new Promise(resolve => setTimeout(resolve, remainingTime));

            hideLoadingState();
            showGrids();
            showMessage(data.error || 'failed to generate puzzle. please try again.', 'error');
        }
    } catch (error) {
        console.error('error generating puzzle:', error);

        // Calculate remaining time for error case too
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
        await new Promise(resolve => setTimeout(resolve, remainingTime));

        hideLoadingState();
        showGrids();
        showMessage('error connecting to server.', 'error');
    }
}

function renderMainGrid() {
    const mainGrid = document.getElementById('mainGrid');
    mainGrid.innerHTML = '';

    for (let i = 0; i < currentPuzzle.gridSize; i++) {
        for (let j = 0; j < currentPuzzle.gridSize; j++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = i;
            cell.dataset.col = j;

            if (currentPuzzle.userGrid[i][j] === 1) {
                cell.classList.add('active');
                cell.textContent = '1';

                // Add correct class to active cells if solution is correct
                if (currentPuzzle.isCorrect) {
                    cell.classList.add('correct');
                }
            } else {
                cell.textContent = '0';
            }

            cell.addEventListener('click', () => toggleCell(i, j));
            mainGrid.appendChild(cell);
        }
    }

    // Show/hide share button based on puzzle completion
    const shareButtonContainer = document.getElementById('shareButtonContainer');
    if (currentPuzzle.isCorrect) {
        shareButtonContainer.style.display = 'flex';
    } else {
        shareButtonContainer.style.display = 'none';
    }

    // Hide check and give up buttons when puzzle is solved
    const checkBtn = document.getElementById('checkBtn');
    const giveUpBtn = document.getElementById('giveUpBtn');
    if (currentPuzzle.isCorrect) {
        checkBtn.style.display = 'none';
        giveUpBtn.style.display = 'none';
    } else {
        checkBtn.style.display = '';
        giveUpBtn.style.display = '';
    }
}

function toggleCell(row, col) {
    // Toggle the cell value
    currentPuzzle.userGrid[row][col] = currentPuzzle.userGrid[row][col] === 1 ? 0 : 1;

    // Reset the correct state when user makes changes
    currentPuzzle.isCorrect = false;

    // Re-render both main grid and clues
    renderMainGrid();
    renderClues();
}

function calculateClueCount(clue) {
    // Count cells where both user grid and clue have 1
    let count = 0;
    for (let i = 0; i < currentPuzzle.gridSize; i++) {
        for (let j = 0; j < currentPuzzle.gridSize; j++) {
            if (clue[i][j] === 1 && currentPuzzle.userGrid[i][j] === 1) {
                count++;
            }
        }
    }
    return count;
}

function renderClues() {
    const cluesGrid = document.getElementById('cluesGrid');
    cluesGrid.innerHTML = '';

    currentPuzzle.clues.forEach((clue, clueIndex) => {
        const clueContainer = document.createElement('div');
        clueContainer.className = 'clue-container';

        // Calculate current count for this clue
        const currentCount = calculateClueCount(clue);
        const targetCount = currentPuzzle.counts[clueIndex];
        const isSatisfied = currentCount === targetCount;

        // Clue header with number and progress
        const header = document.createElement('div');
        header.className = 'clue-header';

        // Determine the count class based on current vs target
        let countClass;
        if (isSatisfied) {
            countClass = 'clue-count-satisfied';
        } else if (currentCount < targetCount) {
            countClass = 'clue-count-too-low';
        } else {
            countClass = 'clue-count-too-high';
        }

        header.innerHTML = `mask ${clueIndex}<br><span class="clue-count ${countClass}">${currentCount}/${targetCount}</span>`;
        clueContainer.appendChild(header);

        // Create the clue grid
        const clueGrid = document.createElement('div');
        clueGrid.className = 'grid clue-grid';

        for (let i = 0; i < currentPuzzle.gridSize; i++) {
            for (let j = 0; j < currentPuzzle.gridSize; j++) {
                const cell = document.createElement('div');
                cell.className = 'cell';

                // Check if this cell is a '1' in the clue
                const isClueHighlight = clue[i][j] === 1;

                // Check if this cell is active in user's grid
                const isUserActive = currentPuzzle.userGrid[i][j] === 1;

                if (isClueHighlight) {
                    cell.classList.add('clue-highlight');
                }

                if (isUserActive) {
                    cell.classList.add('user-active');
                }

                // Show the clue's value (not the user's value)
                cell.textContent = clue[i][j];

                clueGrid.appendChild(cell);
            }
        }

        clueContainer.appendChild(clueGrid);
        cluesGrid.appendChild(clueContainer);
    });
}

async function hashGrid(grid) {
    // Convert grid to the same JSON string format as the backend
    // Python's json.dumps() adds spaces after commas and colons, so we need to match that
    const gridString = JSON.stringify(grid, null, 0).replace(/,/g, ', ').replace(/:/g, ': ');
    const encoder = new TextEncoder();
    const data = encoder.encode(gridString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

async function checkSolution() {
    if (!currentPuzzle.solutionHash) {
        showMessage('no puzzle loaded', 'error');
        return;
    }

    try {
        // Hash the current user grid
        const userGridHash = await hashGrid(currentPuzzle.userGrid);

        // Compare with the solution hash
        if (userGridHash === currentPuzzle.solutionHash) {
            currentPuzzle.isCorrect = true;
            renderMainGrid();
            showMessage('correct! well done!', 'success');
        } else {
            showMessage('not quite right. keep trying!', 'error');
        }
    } catch (error) {
        console.error('error checking solution:', error);
        showMessage('error checking solution.', 'error');
    }
}

async function giveUp() {
    if (!currentPuzzle.clues || currentPuzzle.clues.length === 0) {
        showMessage('no puzzle loaded', 'error');
        return;
    }

    try {
        // Call the backend to solve the puzzle
        const response = await fetch('/api/solve-puzzle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                clues: currentPuzzle.clues,
                counts: currentPuzzle.counts,
                gridSize: currentPuzzle.gridSize
            })
        });

        const data = await response.json();

        if (data.success) {
            // Set the user grid to the solution
            currentPuzzle.userGrid = data.solution;
            currentPuzzle.isCorrect = true;

            // Re-render the grids
            renderMainGrid();
            renderClues();

            // Show message
            showMessage('solution revealed!', 'success');
        } else {
            showMessage(data.error || 'failed to solve puzzle', 'error');
        }
    } catch (error) {
        console.error('error solving puzzle:', error);
        showMessage('error connecting to server.', 'error');
    }
}

// Store the message timeout ID
let messageTimeout = null;

// Store the loading message rotation interval ID
let loadingInterval = null;

// Store the last loading message to avoid repeats
let lastLoadingMessage = null;

function showMessage(text, type, autoHide = true) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.className = 'message';
    messageDiv.style.display = 'flex';

    if (type) {
        messageDiv.classList.add(type);
    }

    // Clear any existing timeout
    if (messageTimeout) {
        clearTimeout(messageTimeout);
    }

    // Auto-hide after 3 seconds if autoHide is true
    if (autoHide) {
        messageTimeout = setTimeout(() => {
            hideMessage();
        }, 3000);
    }
}

function hideMessage() {
    const messageDiv = document.getElementById('message');
    messageDiv.style.display = 'none';

    // Clear timeout if hiding manually
    if (messageTimeout) {
        clearTimeout(messageTimeout);
        messageTimeout = null;
    }
}

function hideGrids() {
    const mainGridContainer = document.querySelector('.main-grid-container');
    const cluesContainer = document.querySelector('.clues-container');

    if (mainGridContainer) mainGridContainer.style.display = 'none';
    if (cluesContainer) cluesContainer.style.display = 'none';
}

function showGrids() {
    const mainGridContainer = document.querySelector('.main-grid-container');
    const cluesContainer = document.querySelector('.clues-container');

    if (mainGridContainer) mainGridContainer.style.display = 'block';
    if (cluesContainer) cluesContainer.style.display = 'block';
}

function showLoadingState(mode = 'generating') {
    const loadingState = document.getElementById('loadingState');
    const loadingTitle = document.getElementById('loadingTitle');

    // Update the title based on mode
    if (loadingTitle) {
        loadingTitle.textContent = mode === 'retrieving' ? 'retrieving puzzle' : 'generating puzzle';
    }

    if (loadingState) {
        // Loading messages organized by mode
        const generatingOnlyMessages = [
            'flipping digital coins',
            'summoning the logic spirits',
            'asking the magic 8-bit ball',
            'negotiating with boolean variables',
            'finding a unique solution',
            'validating puzzle uniqueness',
            'generating strategic mask patterns',
            'invoking the SAT solver',
            'checking solution space',
            'optimizing puzzle difficulty',
            'evaluating clue coverage',
            'pruning the search tree',
            'minimizing hint redundancy',
            'randomizing grid initialization',
            'comparing binary matrices',
            'solving boolean satisfiability',
            'building constraint network'
        ];

        const retrievingOnlyMessages = [
            'decoding puzzle data',
            'unpacking clue patterns',
            'reconstructing mask arrays',
            'parsing puzzle parameters',
            'deserializing grid state',
            'validating puzzle format',
            'loading mask configurations',
            'restoring puzzle state',
            'decompressing puzzle data',
            'verifying data integrity',
        ];

        const sharedMessages = [
            'crunching binary bits',
            'dividing by zero',
            'beep boop, puzzling in progress',
            'aligning the logic circuits',
            'inverting the bit matrix',
            'warming up the logic processors',
            'shuffling quantum states',
            'debugging the universe',
            'counting backwards from infinity',
            'running bitwise AND operations',
            'verifying logical consistency',
            'analyzing bit patterns',
        ];

        // Build the messages array based on mode
        let messages;
        if (mode === 'retrieving') {
            messages = [...retrievingOnlyMessages, ...sharedMessages];
        } else {
            messages = [...generatingOnlyMessages, ...sharedMessages];
        }

        const subtitle = loadingState.querySelector('p');

        // Function to get a random message different from the last one
        const getRandomMessage = () => {
            if (messages.length === 1) return messages[0];

            let randomMessage;
            do {
                randomMessage = messages[Math.floor(Math.random() * messages.length)];
            } while (randomMessage === lastLoadingMessage);

            lastLoadingMessage = randomMessage;
            return "[" + randomMessage + "]";
        };

        // Function to update message with fade effect
        const updateMessage = () => {
            if (!subtitle) return;

            // Fade out
            subtitle.classList.add('fade-out');

            // Wait for fade out, then change text and fade in
            setTimeout(() => {
                const randomMessage = getRandomMessage();
                subtitle.textContent = randomMessage;
                subtitle.classList.remove('fade-out');
            }, 400); // Match the CSS transition duration
        };

        // Show initial message with fade-in
        if (subtitle) {
            // Start with opacity 0 (fade-out class)
            subtitle.classList.add('fade-out');
            const randomMessage = getRandomMessage();

            // Use requestAnimationFrame to ensure the fade-out class is applied before removing it
            requestAnimationFrame(() => {
                subtitle.textContent = randomMessage;
                requestAnimationFrame(() => {
                    subtitle.classList.remove('fade-out');
                });
            });
        }

        // Rotate messages every 1.8 seconds (1200ms display + 600ms for fade-out/fade-in transition)
        loadingInterval = setInterval(updateMessage, 1800);

        loadingState.style.display = 'flex';
    }

    // Hide control buttons (but not the instructions button)
    document.getElementById('checkBtn').style.display = 'none';
    document.getElementById('giveUpBtn').style.display = 'none';
    document.getElementById('newPuzzleBtn').style.display = 'none';
}

function hideLoadingState() {
    const loadingState = document.getElementById('loadingState');

    // Clear the rotation interval
    if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
    }

    if (loadingState) loadingState.style.display = 'none';

    // Show control buttons again
    document.getElementById('checkBtn').style.display = '';
    document.getElementById('giveUpBtn').style.display = '';
    document.getElementById('newPuzzleBtn').style.display = '';
}

async function copyPuzzleLink() {
    if (!currentPuzzle.puzzleData) {
        showMessage('no puzzle data available to share.', 'error');
        return;
    }

    try {
        // Build the full URL with puzzle parameter
        const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
        const shareUrl = `${baseUrl}?puzzle=${encodeURIComponent(currentPuzzle.puzzleData)}`;

        // Copy to clipboard
        await navigator.clipboard.writeText(shareUrl);

        // Show success message
        showMessage('puzzle link copied to clipboard!', 'success');
    } catch (error) {
        console.error('error copying to clipboard:', error);
        showMessage('failed to copy link. please try again.', 'error');
    }
}
