// State management
const state = {
    availableTasks: [],
    usedTasks: [],
    skippedTasks: [],
    canvasTasks: [],
    groups: [],
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
    connectionsLayer: null,
    zoomIn: null,
    zoomOut: null,
    addGroupBtn: null,
    refreshDataBtn: null
};

function initElements() {
    elements.sidebar = document.getElementById('task-sidebar');
    elements.toggleBtn = document.getElementById('toggle-sidebar');
    elements.availableList = document.getElementById('available-tasks');
    elements.usedList = document.getElementById('used-tasks');
    elements.skippedList = document.getElementById('skipped-tasks');
    elements.searchInput = document.getElementById('task-search');
    elements.canvas = document.getElementById('canvas');
    elements.connectionsLayer = document.getElementById('connections-layer');
    elements.zoomIn = document.getElementById('zoom-in');
    elements.zoomOut = document.getElementById('zoom-out');
    elements.addGroupBtn = document.getElementById('add-group-btn');
}
