// db.js - Database module for Comment Helper
class CommentDB {
    constructor() {
        this.STORAGE_KEY = 'comments';
        this.CATEGORIES = ['All', 'Praise', 'Critics', 'Grammar', 'Structure', 'General'];
    }

    // Get all comments (with optional filtering)
    async getAll(filterCategory = 'All', searchTerm = '') {
        return new Promise((resolve) => {
            chrome.storage.local.get({ [this.STORAGE_KEY]: [] }, (result) => {
                let comments = result[this.STORAGE_KEY];
                
                // Apply filters
                if (filterCategory !== 'All') {
                    comments = comments.filter(c => c.category === filterCategory);
                }
                
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    comments = comments.filter(c => 
                        c.text.toLowerCase().includes(term) || 
                        c.shortcode.toLowerCase().includes(term)
                    );
                }
                
                // Sort by most used first, then by date
                comments.sort((a, b) => {
                    if (b.usedCount !== a.usedCount) return b.usedCount - a.usedCount;
                    return b.createdAt - a.createdAt;
                });
                
                resolve(comments);
            });
        });
    }

    // Get a single comment by ID
    async getById(id) {
        const comments = await this.getAll();
        return comments.find(c => c.id === id);
    }

    // Add a new comment
    async add(commentData) {
        const newComment = {
            id: 'comment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            text: commentData.text,
            shortcode: commentData.shortcode || this._generateShortcode(commentData.text),
            category: commentData.category || 'General',
            createdAt: Date.now(),
            usedCount: 0
        };

        const comments = await this.getAll();
        comments.push(newComment);
        
        await this._saveAll(comments);
        return newComment;
    }

    // Update an existing comment
    async update(id, updates) {
        const comments = await this.getAll();
        const index = comments.findIndex(c => c.id === id);
        
        if (index !== -1) {
            comments[index] = { ...comments[index], ...updates };
            await this._saveAll(comments);
            return true;
        }
        
        return false;
    }

    // Delete a comment
    async delete(id) {
        const comments = await this.getAll();
        const filtered = comments.filter(c => c.id !== id);
        await this._saveAll(filtered);
        return filtered.length !== comments.length;
    }

    // Increment usage counter
    async incrementUse(id) {
        const comment = await this.getById(id);
        if (comment) {
            comment.usedCount = (comment.usedCount || 0) + 1;
            await this.update(id, { usedCount: comment.usedCount });
            return comment.text;
        }
        return null;
    }

    // Get top comments for context menu (most used)
    async getTopComments(limit = 8) {
        const comments = await this.getAll();
        return comments
            .sort((a, b) => b.usedCount - a.usedCount)
            .slice(0, limit);
    }

    // Get all categories from existing comments
    async getCategories() {
        const comments = await this.getAll();
        const categories = new Set(comments.map(c => c.category));
        return ['All', ...Array.from(categories).sort()];
    }

    // Initialize with sample data if empty
    async initializeWithSamples() {
        const comments = await this.getAll();
        
        if (comments.length === 0) {
            const samples = [
                {
                    text: "Excellent argumentation, supported by sources.",
                    shortcode: "argument",
                    category: "Praise"
                },
                {
                    text: "Pay attention to the structure of the work. The introduction and conclusion do not match.",
                    shortcode: "structure",
                    category: "Structure"
                },
                {
                    text: "There are several grammatical errors in the third paragraph.",
                    shortcode: "grammar",
                    category: "Grammar"
                },
                {
                    text: "Sources are outdated, it is recommended to use publications from the last 3-5 years.",
                    shortcode: "sources",
                    category: "Critics"
                }
            ];
            
            for (const sample of samples) {
                await this.add(sample);
            }
        }
    }

    // Private helper methods
    async _saveAll(comments) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.STORAGE_KEY]: comments }, () => resolve());
        });
    }

    _generateShortcode(text) {
        // Take first 2-3 meaningful words for shortcode
        const words = text.split(' ').filter(w => w.length > 3);
        return words.slice(0, 2).join(' ').substring(0, 30);
    }
}

// Create and export a singleton instance
const commentDB = new CommentDB();