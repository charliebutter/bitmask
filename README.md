# Bitmask - Binary Grid Logic Puzzle

A web-based logic puzzle game where you find the unique 4x4 binary grid that satisfies all given clues.

## Game Rules

Find the unique 4x4 binary grid (0s and 1s) that satisfies all the clues:

- Click cells in the main grid to toggle them between 0 (off) and 1 (on)
- Each clue grid shows a pattern of 1s and 0s
- When you AND your answer grid with a clue grid, count the resulting 1s
- This count must match the target count shown for that clue
- All clues must be satisfied simultaneously

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the Flask app:
```bash
python app.py
```

3. Open your browser and navigate to:
```
http://localhost:5000
```

## Project Structure

```
bitmask/
├── app.py                  # Flask backend
├── puzzle_generator.py     # Puzzle generation logic
├── requirements.txt        # Python dependencies
├── templates/
│   └── index.html         # Main game page
└── static/
    ├── style.css          # Styling
    └── script.js          # Game logic
```

## Technology Stack

- **Backend**: Flask (Python)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Puzzle Generation**: NumPy and Z3 for efficiency
