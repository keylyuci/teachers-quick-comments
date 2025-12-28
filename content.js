// content.js - Content script for auto-insertion into web pages

// Listen for messages from background or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'insertText') {
        insertTextIntoActiveField(message.text);
        sendResponse({ success: true });
    }
    return true;
});

// Function to insert text into the active field
function insertTextIntoActiveField(text) {
    const activeElement = document.activeElement;
    
    if (isEditableElement(activeElement)) {
        insertAtCursor(activeElement, text);
        return true;
    }
    
    // If no active editable element, try to find the first suitable one
    const editableElements = document.querySelectorAll('input, textarea, [contenteditable="true"]');
    if (editableElements.length > 0) {
        const firstEditable = editableElements[0];
        firstEditable.focus();
        insertAtCursor(firstEditable, text);
        return true;
    }
    
    return false;
}

// Check if element is editable
function isEditableElement(element) {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    const isInput = tagName === 'input' || tagName === 'textarea';
    const isContentEditable = element.isContentEditable || 
                            element.getAttribute('contenteditable') === 'true';
    
    return isInput || isContentEditable;
}

// Insert text at cursor position
function insertAtCursor(element, text) {
    if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
        // For contenteditable elements
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            const textNode = document.createTextNode(text);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            element.focus();
            document.execCommand('insertText', false, text);
        }
    } else {
        // For input/textarea elements
        const start = element.selectionStart;
        const end = element.selectionEnd;
        const value = element.value;
        
        element.value = value.substring(0, start) + text + value.substring(end);
        element.selectionStart = element.selectionEnd = start + text.length;
        
        // Trigger input event for React/Vue compatibility
        const event = new Event('input', { bubbles: true });
        element.dispatchEvent(event);
    }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'insertText') {
        const success = insertTextIntoActiveField(request.text);
        sendResponse({ success: success });
    }
    return true;
});