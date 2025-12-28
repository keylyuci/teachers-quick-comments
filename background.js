// background.js - Background service worker for context menus

// Initialize when extension is installed or updated
chrome.runtime.onInstalled.addListener(async () => {
    // Initialize database
    await commentDB.initializeWithSamples();
    
    // Create context menu
    createContextMenu();
    
    console.log('Comment Helper extension installed');
});

// Create right-click context menu
async function createContextMenu() {
    // Remove existing menu items
    await chrome.contextMenus.removeAll();
    
    // Get top comments for the menu
    const topComments = await commentDB.getTopComments(8);
    
    // Create parent menu item
    chrome.contextMenus.create({
        id: 'parent',
        title: 'Вставить комментарий',
        contexts: ['editable', 'selection']
    });
    
    // Add top comments as submenu items
    topComments.forEach((comment, index) => {
        chrome.contextMenus.create({
            id: `comment_${comment.id}`,
            parentId: 'parent',
            title: `${comment.shortcode} (${comment.usedCount || 0})`,
            contexts: ['editable', 'selection']
        });
    });
    
    // Add separator
    chrome.contextMenus.create({
        type: 'separator',
        parentId: 'parent',
        contexts: ['editable', 'selection']
    });
    
    // Add "View all comments" option
    chrome.contextMenus.create({
        id: 'view_all',
        parentId: 'parent',
        title: '📋 Все комментарии...',
        contexts: ['editable', 'selection']
    });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'view_all') {
        // Open the popup
        chrome.action.openPopup();
    } 
    else if (info.menuItemId.startsWith('comment_')) {
        // Extract comment ID from menu item ID
        const commentId = info.menuItemId.replace('comment_', '');
        
        // Get comment text and increment use count
        const commentText = await commentDB.incrementUse(commentId);
        
        if (commentText) {
            // Copy to clipboard
            await navigator.clipboard.writeText(commentText);
            
            // Try to insert into active field
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'insertText',
                    text: commentText
                });
            } catch (err) {
                // Content script not available or permission not granted
                // User will paste manually with Ctrl+V
                console.log('Content script not available');
            }
            
            // Update context menu with new usage counts
            await updateContextMenu();
        }
    }
});

// Update context menu when comments change
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === 'commentsUpdated') {
        await updateContextMenu();
    }
});

// Update context menu items
async function updateContextMenu() {
    await chrome.contextMenus.removeAll();
    await createContextMenu();
}

// Handle keyboard shortcuts (Optional future feature)
chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'open_popup') {
        chrome.action.openPopup();
    }
});