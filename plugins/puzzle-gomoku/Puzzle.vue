<template>
    <div class="puzzle-module">
        <div class="puzzle-tabs">
            <button
                v-for="tab in tabs"
                :key="tab.key"
                class="tab-btn"
                :class="{ active: activeTab === tab.key }"
                @click="activeTab = tab.key"
            >
                {{ tab.label }}
            </button>
        </div>
        <div class="puzzle-content">
            <Gomoku v-if="activeTab === 'gomoku'" />
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import Gomoku from './Gomoku.vue'

const tabs = [
    { key: 'gomoku', label: '五子棋' }
]
const activeTab = ref('gomoku')
</script>

<style scoped>
.puzzle-module {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.puzzle-tabs {
    display: flex;
    gap: 4px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-primary);
    flex-shrink: 0;
}
.tab-btn {
    padding: 6px 16px;
    font-size: 14px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
}
.tab-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
}
.tab-btn.active {
    background: var(--accent-color, #5ba8ff);
    color: white;
}
.puzzle-content {
    flex: 1;
    overflow: auto;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 10px;
}
</style>
