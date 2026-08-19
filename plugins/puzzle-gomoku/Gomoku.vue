<template>
    <div class="gomoku-game">
        <div class="game-info">
            <div class="current-player" :class="currentPlayer">
                当前: {{ currentPlayer === 'black' ? '黑棋' : '白棋' }}
            </div>
            <button class="restart-btn" @click="restart">重新开始</button>
        </div>
        <div class="board" :style="boardStyle">
            <div
                v-for="(cell, index) in board"
                :key="index"
                class="cell"
                :class="{ 'has-stone': cell, [cell]: cell }"
                @click="placeStone(index)"
            >
                <div v-if="cell" class="stone" :class="cell"></div>
            </div>
        </div>
        <div v-if="winner" class="winner-banner">
            {{ winner === 'black' ? '黑棋获胜！' : '白棋获胜！' }}
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const BOARD_SIZE = 15
const board = ref(Array(BOARD_SIZE * BOARD_SIZE).fill(null))
const currentPlayer = ref('black')
const winner = ref(null)

const boardStyle = computed(() => ({
    gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
    gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)`
}))

function placeStone(index) {
    if (board.value[index] || winner.value) return
    board.value[index] = currentPlayer.value
    if (checkWin(index)) {
        winner.value = currentPlayer.value
        return
    }
    currentPlayer.value = currentPlayer.value === 'black' ? 'white' : 'black'
}

function checkWin(index) {
    const size = BOARD_SIZE
    const row = Math.floor(index / size)
    const col = index % size
    const player = board.value[index]

    const directions = [
        [1, 0], [0, 1], [1, 1], [1, -1]
    ]

    for (const [dr, dc] of directions) {
        let count = 1
        for (let i = 1; i < 5; i++) {
            const r = row + dr * i, c = col + dc * i
            if (r < 0 || r >= size || c < 0 || c >= size) break
            if (board.value[r * size + c] === player) count++
            else break
        }
        for (let i = 1; i < 5; i++) {
            const r = row - dr * i, c = col - dc * i
            if (r < 0 || r >= size || c < 0 || c >= size) break
            if (board.value[r * size + c] === player) count++
            else break
        }
        if (count >= 5) return true
    }
    return false
}

function restart() {
    board.value = Array(BOARD_SIZE * BOARD_SIZE).fill(null)
    currentPlayer.value = 'black'
    winner.value = null
}
</script>

<style scoped>
.gomoku-game {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 20px;
    user-select: none;
}
.game-info {
    display: flex;
    align-items: center;
    gap: 20px;
}
.current-player {
    font-size: 16px;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 6px;
    background: var(--bg-secondary);
}
.current-player.black { color: #333; }
.current-player.white { color: #888; }
.restart-btn {
    padding: 6px 14px;
    font-size: 14px;
    border: none;
    border-radius: 6px;
    background: var(--accent-color, #5ba8ff);
    color: white;
    cursor: pointer;
}
.restart-btn:hover { opacity: 0.85; }
.board {
    display: grid;
    width: 450px;
    height: 450px;
    background: #deb887;
    border: 2px solid #8b6914;
    border-radius: 4px;
    padding: 4px;
    gap: 1px;
}
.cell {
    position: relative;
    background: #f0d9a8;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}
.cell:hover:not(.has-stone) { background: #e8cfa0; }
.stone {
    width: 80%;
    height: 80%;
    border-radius: 50%;
    box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
}
.stone.black { background: #1a1a1a; }
.stone.white { background: #f5f5f5; border: 1px solid #ccc; }
.winner-banner {
    font-size: 20px;
    font-weight: 700;
    padding: 10px 24px;
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--accent-color, #5ba8ff);
    animation: popIn 0.3s ease;
}
@keyframes popIn {
    from { transform: scale(0.8); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}
</style>
