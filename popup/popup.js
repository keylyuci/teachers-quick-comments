// popup.js - Main popup logic
document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const elements = {
        commentsContainer: document.getElementById('commentsContainer'),
        searchInput: document.getElementById('searchInput'),
        categoryFilters: document.getElementById('categoryFilters'),
        addCommentBtn: document.getElementById('addCommentBtn'),
        addSampleBtn: document.getElementById('addSampleBtn'),
        commentModal: document.getElementById('commentModal'),
        modalTitle: document.getElementById('modalTitle'),
        commentText: document.getElementById('commentText'),
        shortcode: document.getElementById('shortcode'),
        category: document.getElementById('category'),
        saveBtn: document.getElementById('saveBtn'),
        cancelBtn: document.getElementById('cancelBtn'),
        emptyState: document.getElementById('emptyState')
    };

    // State
    let state = {
        currentCategory: 'Все',
        searchTerm: '',
        editingCommentId: null,
        comments: []
    };

    // Initialize
    await init();

    // Event listeners
    elements.searchInput.addEventListener('input', (e) => {
        state.searchTerm = e.target.value;
        renderComments();
    });

    elements.addCommentBtn.addEventListener('click', () => openModal());
    elements.addSampleBtn.addEventListener('click', addSampleComments);
    elements.cancelBtn.addEventListener('click', closeModal);
    elements.saveBtn.addEventListener('click', saveComment);

    // Initialize database and load data
    async function init() {
        await commentDB.initializeWithSamples();
        await loadCategories();
        await loadComments();
    }

    // Load comments from database
    async function loadComments() {
        state.comments = await commentDB.getAll(state.currentCategory, state.searchTerm);
        renderComments();
    }

    // Render comments to the UI
    function renderComments() {
        elements.commentsContainer.innerHTML = '';
        
        if (state.comments.length === 0) {
            elements.emptyState.style.display = 'block';
            return;
        }
        
        elements.emptyState.style.display = 'none';
        
        state.comments.forEach(comment => {
            const commentElement = createCommentElement(comment);
            elements.commentsContainer.appendChild(commentElement);
        });
    }

    // Create HTML for a single comment
    function createCommentElement(comment) {
        const div = document.createElement('div');
        div.className = 'comment-card';
        
        div.innerHTML = `
            <div class="comment-header">
                <span class="shortcode" title="${comment.shortcode}">${comment.shortcode}</span>
                <span class="comment-category category-${comment.category}">${comment.category}</span>
            </div>
            <p class="comment-text" title="${comment.text}">${comment.text}</p>
            <div class="comment-footer">
                <div class="comment-actions">
                    <button class="action-btn" title="Копировать" data-action="copy" data-id="${comment.id}">📋</button>
                    <button class="action-btn" title="Использовать (авто-вставка)" data-action="use" data-id="${comment.id}">🚀</button>
                    <button class="action-btn" title="Редактировать" data-action="edit" data-id="${comment.id}">✏️</button>
                    <button class="action-btn" title="Удалить" data-action="delete" data-id="${comment.id}">🗑️</button>
                </div>
                <span class="use-count">Использован: ${comment.usedCount || 0} раз</span>
            </div>
        `;
        
        // Add event listeners to action buttons
        div.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const action = e.target.closest('[data-action]').dataset.action;
                const id = e.target.closest('[data-action]').dataset.id;
                
                switch(action) {
                    case 'copy':
                        await copyToClipboard(id);
                        break;
                    case 'use':
                        await useComment(id);
                        break;
                    case 'edit':
                        await editComment(id);
                        break;
                    case 'delete':
                        await deleteComment(id);
                        break;
                }
            });
        });
        
        return div;
    }

    // Load and render category filters
    async function loadCategories() {
        const categories = await commentDB.getCategories();
        elements.categoryFilters.innerHTML = '';
        
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = `category-btn ${cat === state.currentCategory ? 'active' : ''}`;
            btn.textContent = cat;
            btn.dataset.category = cat;
            
            btn.addEventListener('click', () => {
                state.currentCategory = cat;
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadComments();
            });
            
            elements.categoryFilters.appendChild(btn);
        });
    }

    // Copy comment to clipboard
    async function copyToClipboard(commentId) {
        const comment = await commentDB.getById(commentId);
        if (comment) {
            try {
                await navigator.clipboard.writeText(comment.text);
                await commentDB.incrementUse(commentId);
                showNotification('Комментарий скопирован в буфер!');
                await loadComments(); // Refresh to update use count
            } catch (err) {
                showNotification('Ошибка копирования', true);
            }
        }
    }

    // Use comment (copy and attempt to insert into active field)
    async function useComment(commentId) {
        const commentText = await commentDB.incrementUse(commentId);
        if (commentText) {
            await navigator.clipboard.writeText(commentText);
            
            // Try to insert into active field
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                await chrome.tabs.sendMessage(tab.id, { 
                    action: 'insertText', 
                    text: commentText 
                });
                showNotification('Комментарий вставлен!');
            } catch (err) {
                // Content script not available, just copy to clipboard
                showNotification('Комментарий скопирован. Вставьте вручную (Ctrl+V)');
            }
            
            await loadComments();
            setTimeout(() => window.close(), 300); // Close popup after delay
        }
    }

    // Edit comment
    async function editComment(commentId) {
        const comment = await commentDB.getById(commentId);
        if (comment) {
            state.editingCommentId = commentId;
            elements.modalTitle.textContent = 'Редактировать комментарий';
            elements.commentText.value = comment.text;
            elements.shortcode.value = comment.shortcode;
            elements.category.value = comment.category;
            openModal();
        }
    }

    // Delete comment
    async function deleteComment(commentId) {
        if (confirm('Удалить этот комментарий?')) {
            await commentDB.delete(commentId);
            await loadComments();
            showNotification('Комментарий удален');
        }
    }

    // Modal functions
    function openModal() {
        if (!state.editingCommentId) {
            // New comment
            elements.modalTitle.textContent = 'Новый комментарий';
            elements.commentText.value = '';
            elements.shortcode.value = '';
            elements.category.value = 'Общее';
        }
        elements.commentModal.classList.add('show');
    }

    function closeModal() {
        elements.commentModal.classList.remove('show');
        state.editingCommentId = null;
    }

    // Save comment (new or edit)
    async function saveComment() {
        const commentData = {
            text: elements.commentText.value.trim(),
            shortcode: elements.shortcode.value.trim(),
            category: elements.category.value
        };

        if (!commentData.text) {
            alert('Введите текст комментария');
            return;
        }

        if (!commentData.shortcode) {
            alert('Введите короткую фразу для поиска');
            return;
        }

        if (state.editingCommentId) {
            await commentDB.update(state.editingCommentId, commentData);
            showNotification('Комментарий обновлен');
        } else {
            await commentDB.add(commentData);
            showNotification('Комментарий добавлен');
        }

        closeModal();
        await loadComments();
        await loadCategories(); // Refresh categories in case new one was added
    }

    // Add sample comments
    async function addSampleComments() {
        await commentDB.initializeWithSamples();
        await loadComments();
        await loadCategories();
        showNotification('Примеры комментариев добавлены');
    }

    // Show notification
    function showNotification(message, isError = false) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${isError ? 'error' : 'success'}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${isError ? '#ff6b6b' : '#51cf66'};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    // Add CSS animations for notifications
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
});