// State management
const state = {
    availableTasks: [],
    usedTasks: [],
    skippedTasks: [],
    canvasTasks: [],
    groups: [],
    connections: [], // { id, fromId, toId, type: 'obligatory'|'exclusion'|'equivalent' }
    nextInstanceId: 1,
    nextGroupId: 1,
    zoomLevel: 1
};

// DOM Elements
const elements = {
    sidebar: null,
    toggleBtn: null,
    availableList: null,
    usedList: null,
    skippedList: null,
    searchInput: null,
    canvas: null,
    canvasContainer: null,
    canvasSizer: null,
    connectionsLayer: null,
    zoomIn: null,
    zoomOut: null,
    fitBtn: null,
    addGroupBtn: null,
    refreshDataBtn: null,
    undoBtn: null,
    saveFileBtn: null,
    loadFileBtn: null,
    resetBtn: null
};

function initElements() {
    elements.sidebar = document.getElementById('task-sidebar');
    elements.toggleBtn = document.getElementById('toggle-sidebar');
    elements.availableList = document.getElementById('available-tasks');
    elements.usedList = document.getElementById('used-tasks');
    elements.skippedList = document.getElementById('skipped-tasks');
    elements.searchInput = document.getElementById('task-search');
    elements.canvas = document.getElementById('canvas');
    elements.canvasContainer = document.getElementById('canvas-container');
    elements.canvasSizer = document.getElementById('canvas-sizer');
    elements.connectionsLayer = document.getElementById('connections-layer');
    elements.zoomIn = document.getElementById('zoom-in');
    elements.zoomOut = document.getElementById('zoom-out');
    elements.fitBtn = document.getElementById('fit-btn');
    elements.addGroupBtn = document.getElementById('add-group-btn');
    elements.undoBtn = document.getElementById('undo-btn');
    elements.saveFileBtn = document.getElementById('save-file-btn');
    elements.loadFileBtn = document.getElementById('load-file-btn');
    elements.resetBtn = document.getElementById('reset-btn');
}
