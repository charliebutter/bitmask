from flask import Flask, render_template, jsonify, request
import numpy as np
import hashlib
import json
import base64
from puzzle_generator import PuzzleGenerator

app = Flask(__name__)

generator = PuzzleGenerator(grid_size=4, num_clues=5)


def hash_solution(grid):
    """Generate a SHA-256 hash of the grid solution"""
    # Convert grid to a consistent string representation
    grid_string = json.dumps(grid.tolist())
    return hashlib.sha256(grid_string.encode()).hexdigest()


def serialize_puzzle(key, clues):
    """
    Serialize a puzzle (solution + clues) into a URL-safe base64 string.
    Format: [grid_size][solution_bits][num_clues][clue1_bits][clue2_bits]...
    """
    grid_size = key.shape[0]
    total_cells = grid_size * grid_size

    # Convert grids to integers
    def grid_to_int(grid):
        bits = grid.flatten()
        value = 0
        for i, bit in enumerate(bits):
            value |= (int(bit) << i)
        return value

    # Build byte array
    bytes_array = bytearray()

    # Grid size (1 byte)
    bytes_array.append(grid_size)

    # Solution (convert to bytes, little-endian)
    solution_int = grid_to_int(key)
    num_bytes = (total_cells + 7) // 8  # Round up to nearest byte
    solution_bytes = solution_int.to_bytes(num_bytes, byteorder='little')
    bytes_array.extend(solution_bytes)

    # Number of clues (1 byte)
    bytes_array.append(len(clues))

    # Each clue
    for clue in clues:
        clue_int = grid_to_int(clue)
        clue_bytes = clue_int.to_bytes(num_bytes, byteorder='little')
        bytes_array.extend(clue_bytes)

    # Convert to URL-safe base64
    return base64.urlsafe_b64encode(bytes_array).decode('ascii').rstrip('=')


def deserialize_puzzle(puzzle_string):
    """
    Deserialize a puzzle from a URL-safe base64 string.
    Returns (key, clues) or None if invalid.
    """
    try:
        # Add padding if needed
        padding = (4 - len(puzzle_string) % 4) % 4
        puzzle_string += '=' * padding

        # Decode from base64
        bytes_array = base64.urlsafe_b64decode(puzzle_string)

        # Parse grid size
        grid_size = bytes_array[0]
        total_cells = grid_size * grid_size
        num_bytes = (total_cells + 7) // 8

        # Helper to convert bytes to grid
        def int_to_grid(value, grid_size):
            bits = [(value >> i) & 1 for i in range(grid_size * grid_size)]
            return np.array(bits, dtype=np.uint8).reshape(grid_size, grid_size)

        # Parse solution
        solution_bytes = bytes_array[1:1+num_bytes]
        solution_int = int.from_bytes(solution_bytes, byteorder='little')
        key = int_to_grid(solution_int, grid_size)

        # Parse number of clues
        num_clues = bytes_array[1+num_bytes]

        # Parse clues
        clues = []
        offset = 2 + num_bytes
        for i in range(num_clues):
            clue_bytes = bytes_array[offset:offset+num_bytes]
            clue_int = int.from_bytes(clue_bytes, byteorder='little')
            clue = int_to_grid(clue_int, grid_size)
            clues.append(clue)
            offset += num_bytes

        return key, clues
    except Exception as e:
        print(f"error deserializing puzzle: {e}")
        return None


@app.route('/')
def index():
    """Render the main game page"""
    return render_template('index.html')


@app.route('/api/new-puzzle', methods=['GET'])
def new_puzzle():
    """Generate a new puzzle and return clues, counts, and hashed solution"""
    # Check if puzzle parameter is provided (for loading shared puzzles)
    puzzle_param = request.args.get('puzzle')

    if puzzle_param:
        # Deserialize the shared puzzle
        result = deserialize_puzzle(puzzle_param)
        if result:
            key, clues = result
            # Calculate counts from the key and clues
            counts = [int(np.sum(key & clue)) for clue in clues]

            return jsonify({
                'success': True,
                'clues': [clue.tolist() for clue in clues],
                'counts': counts,
                'gridSize': key.shape[0],
                'solutionHash': hash_solution(key),
                'puzzleData': puzzle_param  # Send back the puzzle data for sharing
            })
        else:
            return jsonify({
                'success': False,
                'error': 'invalid puzzle data'
            }), 400

    # Generate a new puzzle
    result = generator.generate_puzzle(max_attempts=10000, verbose=False)

    if result:
        key, clues, counts, attempts = result

        # Serialize the puzzle for sharing
        puzzle_data = serialize_puzzle(key, clues)

        # Return clues, counts, and hashed solution to frontend
        return jsonify({
            'success': True,
            'clues': [clue.tolist() for clue in clues],
            'counts': counts,
            'gridSize': generator.grid_size,
            'solutionHash': hash_solution(key),
            'puzzleData': puzzle_data  # Include serialized puzzle for sharing
        })
    else:
        return jsonify({
            'success': False,
            'error': 'failed to generate puzzle. please try again'
        }), 500


@app.route('/api/solve-puzzle', methods=['POST'])
def solve_puzzle():
    """Solve a puzzle given clues and counts"""
    try:
        data = request.json
        clues = [np.array(clue, dtype=np.uint8) for clue in data['clues']]
        counts = data['counts']
        grid_size = data.get('gridSize', 4)

        # Create a generator with the appropriate grid size
        solver = PuzzleGenerator(grid_size=grid_size)

        # Solve the puzzle
        solution = solver.solve_puzzle(clues, counts)

        if solution is not None:
            return jsonify({
                'success': True,
                'solution': solution.tolist()
            })
        else:
            return jsonify({
                'success': False,
                'error': 'No solution found'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
