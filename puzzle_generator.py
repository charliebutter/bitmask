import numpy as np
import random
from typing import List, Tuple, Optional
from z3 import *


class PuzzleGenerator:
    """Generate binary grid logic puzzles with unique solutions using Z3 SAT solver"""

    def __init__(self, grid_size=4, num_clues=5):
        self.grid_size = grid_size
        self.num_clues = num_clues
        self.total_cells = grid_size * grid_size

    def generate_key(self) -> np.ndarray:
        """Generate a random binary grid"""
        return np.random.randint(0, 2, (self.grid_size, self.grid_size), dtype=np.uint8)

    def generate_strategic_clues(self) -> List[np.ndarray]:
        """Generate clues with diverse patterns for better uniqueness"""
        clues = []

        # Strategy 1: Sparse clue
        clue = np.zeros((self.grid_size, self.grid_size), dtype=np.uint8)
        positions = random.sample(range(self.total_cells), k=random.randint(4, 8))
        for pos in positions:
            clue[pos // self.grid_size, pos % self.grid_size] = 1
        clues.append(clue)

        # Strategy 2: Dense clue
        clue = np.ones((self.grid_size, self.grid_size), dtype=np.uint8)
        positions = random.sample(range(self.total_cells), k=random.randint(4, 8))
        for pos in positions:
            clue[pos // self.grid_size, pos % self.grid_size] = 0
        clues.append(clue)

        # Strategy 3-5: Random clues with varying density
        for _ in range(self.num_clues - 2):
            density = random.uniform(0.3, 0.7)
            clue = (np.random.random((self.grid_size, self.grid_size)) < density) * np.uint8(1)
            clues.append(clue)

        return clues

    def apply_clue(self, key: np.ndarray, clue: np.ndarray) -> int:
        """Apply clue to key (element-wise AND) and count 1's"""
        return int(np.sum(key & clue))

    def grid_to_int(self, grid: np.ndarray) -> int:
        """Convert grid to integer for efficient representation"""
        return int(np.sum(grid.flatten() * (2 ** np.arange(self.total_cells))))

    def int_to_grid(self, value: int) -> np.ndarray:
        """Convert integer back to grid"""
        bits = [(value >> i) & 1 for i in range(self.total_cells)]
        return np.array(bits, dtype=np.uint8).reshape(self.grid_size, self.grid_size)

    def solve_puzzle(self, clues: List[np.ndarray], counts: List[int]) -> Optional[np.ndarray]:
        """
        Solve a puzzle using Z3 SAT solver.
        Returns the solution grid or None if no solution exists.
        """
        # Create boolean variables for each cell
        grid_vars = [[Bool(f"cell_{i}_{j}") for j in range(self.grid_size)] 
                     for i in range(self.grid_size)]
        
        solver = Solver()
        
        # Add constraints for each clue
        for clue, target_count in zip(clues, counts):
            # Count cells where both grid_var and clue are 1
            constraint_sum = Sum([
                If(grid_vars[i][j], 1, 0)
                for i in range(self.grid_size)
                for j in range(self.grid_size)
                if clue[i][j] == 1
            ])
            solver.add(constraint_sum == target_count)
        
        # Check if solution exists
        if solver.check() == sat:
            model = solver.model()
            solution = np.zeros((self.grid_size, self.grid_size), dtype=np.uint8)
            for i in range(self.grid_size):
                for j in range(self.grid_size):
                    if is_true(model[grid_vars[i][j]]):
                        solution[i][j] = 1
            return solution
        
        return None

    def check_uniqueness_fast(self, clues: List[np.ndarray], counts: List[int]) -> Tuple[bool, int]:
        """
        Check if there's exactly one solution using Z3 SAT solver.
        Returns (is_unique, num_solutions)
        
        This is MUCH faster than brute force, especially for larger grids
        """
        # Create boolean variables for each cell
        grid_vars = [[Bool(f"cell_{i}_{j}") for j in range(self.grid_size)] 
                     for i in range(self.grid_size)]
        
        solver = Solver()
        
        # Add constraints for each clue
        for clue, target_count in zip(clues, counts):
            # Count cells where both grid_var and clue are 1
            constraint_sum = Sum([
                If(grid_vars[i][j], 1, 0)
                for i in range(self.grid_size)
                for j in range(self.grid_size)
                if clue[i][j] == 1
            ])
            solver.add(constraint_sum == target_count)
        
        # Check for first solution
        if solver.check() != sat:
            return False, 0
        
        # Get first solution
        model1 = solver.model()
        
        # Create constraint that excludes this solution
        exclusion = Or([
            grid_vars[i][j] != model1[grid_vars[i][j]]
            for i in range(self.grid_size)
            for j in range(self.grid_size)
        ])
        solver.add(exclusion)
        
        # Check for second solution
        if solver.check() == sat:
            return False, 2  # At least 2 solutions exist
        else:
            return True, 1  # Exactly 1 solution

    # Keep old brute-force methods as backup for comparison/testing
    def solve_puzzle_brute_force(self, clues: List[np.ndarray], counts: List[int]) -> Optional[np.ndarray]:
        """
        Solve a puzzle by finding the first grid that satisfies all clues.
        Uses brute-force search over all 2^(grid_size^2) possible grids.
        Returns the solution grid or None if no solution exists.
        
        NOTE: Use solve_puzzle() instead - it uses Z3 and is much faster.
        """
        # Pre-flatten clues for faster computation
        flat_clues = [clue.flatten() for clue in clues]
        max_value = 2 ** self.total_cells

        # Check all possible grids
        for i in range(max_value):
            # Convert to binary array efficiently
            grid = np.array([(i >> j) & 1 for j in range(self.total_cells)], dtype=np.uint8)

            # Check if this grid satisfies all clues
            satisfies_all = True
            for flat_clue, target_count in zip(flat_clues, counts):
                if np.sum(grid & flat_clue) != target_count:
                    satisfies_all = False
                    break

            if satisfies_all:
                # Return the first solution found (reshaped to grid)
                return grid.reshape(self.grid_size, self.grid_size)

        # No solution found
        return None

    def check_uniqueness_brute_force(self, clues: List[np.ndarray], counts: List[int]) -> Tuple[bool, int]:
        """
        Efficiently check if there's exactly one solution using brute force.
        Returns (is_unique, num_solutions)
        
        NOTE: Use check_uniqueness_fast() instead - it uses Z3 and is much faster.
        """
        # Pre-flatten clues for faster computation
        flat_clues = [clue.flatten() for clue in clues]

        solution_count = 0
        max_value = 2 ** self.total_cells

        # Check all possible grids
        for i in range(max_value):
            # Convert to binary array efficiently
            grid = np.array([(i >> j) & 1 for j in range(self.total_cells)], dtype=np.uint8)

            # Check if this grid satisfies all clues
            satisfies_all = True
            for flat_clue, target_count in zip(flat_clues, counts):
                if np.sum(grid & flat_clue) != target_count:
                    satisfies_all = False
                    break

            if satisfies_all:
                solution_count += 1
                if solution_count > 1:
                    return False, solution_count

        return solution_count == 1, solution_count

    def generate_puzzle(self, max_attempts=10000, verbose=True) -> Optional[Tuple]:
        """
        Generate a puzzle with a unique solution.
        Returns (key, clues, counts, attempts) or None if failed.
        """
        if verbose:
            print(f"Generating puzzle (grid: {self.grid_size}x{self.grid_size}, clues: {self.num_clues})...")
            print("Using Z3 SAT solver for uniqueness checking")

        for attempt in range(1, max_attempts + 1):
            # Generate key
            key = self.generate_key()

            # Generate strategic clues
            clues = self.generate_strategic_clues()

            # Ensure every cell is covered by at least one clue (necessary for uniqueness)
            # If any cell isn't in any clue, that cell is ambiguous
            coverage = np.zeros((self.grid_size, self.grid_size), dtype=np.uint8)
            for clue in clues:
                coverage |= clue
            if np.sum(coverage) < self.total_cells:
                # Some cells aren't covered by any clue, skip this attempt
                continue

            counts = [self.apply_clue(key, clue) for clue in clues]

            # Skip if any clue has a count of 0 (makes puzzle too easy)
            if any(count == 0 for count in counts):
                continue
            
            # Skip if any clue's count equals its total number of 1s (makes puzzle too easy)
            if any(count == np.sum(clue) for count, clue in zip(counts, clues)):
                continue

            # Check uniqueness using Z3
            is_unique, num_solutions = self.check_uniqueness_fast(clues, counts)

            if verbose and attempt % 10 == 0:
                print(f"  Attempt {attempt}: Found {num_solutions} solution(s)...")

            if is_unique:
                if verbose:
                    print(f"✓ Puzzle generated successfully in {attempt} attempts!\n")
                return key, clues, counts, attempt

        if verbose:
            print(f"✗ Failed to generate puzzle with unique solution after {max_attempts} attempts")
        return None

    def print_puzzle(self, key: np.ndarray, clues: List[np.ndarray], counts: List[int]):
        """Pretty print the puzzle"""
        print("=" * 50)
        print("KEY GRID (Solution - not shown to solver):")
        print("=" * 50)
        self._print_grid(key)
        print()

        print("=" * 50)
        print("PUZZLE CLUES:")
        print("=" * 50)
        for i, (clue, count) in enumerate(zip(clues, counts)):
            print(f"\nClue #{i + 1} | Target Count: {count}")
            print("-" * 30)
            self._print_grid(clue)
        print("\n" + "=" * 50)

    def _print_grid(self, grid: np.ndarray):
        """Print a grid nicely"""
        for row in grid:
            print("  " + " ".join(str(x) for x in row))

    def verify_solution(self, key: np.ndarray, clues: List[np.ndarray], counts: List[int]) -> bool:
        """Verify that a key satisfies all clues"""
        for clue, target_count in zip(clues, counts):
            if self.apply_clue(key, clue) != target_count:
                return False
        return True

def main():
    """Demo the puzzle generator"""
    print("Bitmask Puzzle Generator with Z3 SAT Solver\n")
    
    # Create generator
    generator = PuzzleGenerator(grid_size=4, num_clues=5)

    # Generate puzzle
    result = generator.generate_puzzle(max_attempts=1000, verbose=True)

    if result:
        key, clues, counts, attempts = result

        # Print the puzzle
        generator.print_puzzle(key, clues, counts)

        # Verify the solution
        print("\nVerifying solution...")
        is_valid = generator.verify_solution(key, clues, counts)
        print(f"Solution is valid: {is_valid}")

        # Check uniqueness again
        is_unique, num_solutions = generator.check_uniqueness_fast(clues, counts)
        print(f"Number of solutions: {num_solutions}")
        print(f"Solution is unique: {is_unique}")
        
        # Test solving the puzzle
        print("\nTesting puzzle solver...")
        solved_key = generator.solve_puzzle(clues, counts)
        if solved_key is not None:
            print("Puzzle solved successfully!")
            print(f"Solution matches original key: {np.array_equal(solved_key, key)}")
        else:
            print("Failed to solve puzzle (this shouldn't happen)")
    else:
        print("\nFailed to generate a valid puzzle.")


if __name__ == "__main__":
    main()
