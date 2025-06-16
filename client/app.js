// Configuration - Update this URL after deploying your service
const TODO_SERVICE_URL = 'https://todoservice.sanjaysingh.net';

// Initialize authentication manager
const authManager = new AuthManager({ storagePrefix: 'todoApp_' });

// Global state
let todos = [];

// DOM elements
const authSection = document.getElementById('auth-section');
const userSection = document.getElementById('user-section');
const usernameInput = document.getElementById('username');
const registerBtn = document.getElementById('register-btn');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userName = document.getElementById('user-name');
const todoTitleInput = document.getElementById('todo-title');
const todoDescriptionInput = document.getElementById('todo-description');
const addTodoBtn = document.getElementById('add-todo-btn');
const todoList = document.getElementById('todo-list');

// Utility functions
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.classList.remove('hidden');
    setTimeout(() => element.classList.add('hidden'), 5000);
}

function showSuccess(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.classList.remove('hidden');
    setTimeout(() => element.classList.add('hidden'), 3000);
}

function setLoading(button, loading) {
    if (loading) {
        button.disabled = true;
        if (button.classList.contains('icon-btn')) {
            button.innerHTML = '<span class="loading"></span>';
        } else {
            button.innerHTML = '<span class="loading"></span> Processing...';
        }
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalText || button.textContent;
    }
}

// Helper function to make authenticated API calls
async function makeAuthenticatedRequest(url, options = {}) {
    try {
        return await authManager.makeAuthenticatedRequest(url, options);
    } catch (error) {
        if (error.message === 'Session expired') {
            showError('auth-error', 'Session expired. Please log in again.');
            showUnauthenticatedUI();
        }
        throw error;
    }
}

// Authentication functions
async function register() {
    const username = usernameInput.value.trim();
    if (!username) {
        showError('auth-error', 'Please enter a username to register');
        return;
    }

    registerBtn.dataset.originalText = registerBtn.innerHTML;
    setLoading(registerBtn, true);

    try {
        const result = await authManager.register(username);
        showAuthenticatedUI();
        showSuccess('auth-success', result.message);
        await loadTodos();
    } catch (error) {
        console.error('Registration error:', error);
        showError('auth-error', error.message);
    } finally {
        setLoading(registerBtn, false);
    }
}

async function login() {
    loginBtn.dataset.originalText = loginBtn.innerHTML;
    setLoading(loginBtn, true);

    try {
        const result = await authManager.login();
        showAuthenticatedUI();
        showSuccess('auth-success', result.message);
        await loadTodos();
    } catch (error) {
        console.error('Login error:', error);
        showError('auth-error', error.message);
    } finally {
        setLoading(loginBtn, false);
    }
}

function logout() {
    authManager.logout();
    todos = [];
    showUnauthenticatedUI();
    usernameInput.value = '';
}

function showAuthenticatedUI() {
    authSection.classList.add('hidden');
    userSection.classList.remove('hidden');
    const authState = authManager.getAuthState();
    userName.textContent = authState.user.username;
}

function showUnauthenticatedUI() {
    authSection.classList.remove('hidden');
    userSection.classList.add('hidden');
}

// Todo functions
async function loadTodos() {
    try {
        const response = await makeAuthenticatedRequest(`${TODO_SERVICE_URL}/todos`);

        if (!response.ok) {
            throw new Error('Failed to load todos');
        }

        const result = await response.json();
        todos = result.todos || [];
        renderTodos();
        updateStats();

    } catch (error) {
        console.error('Load todos error:', error);
        if (error.message !== 'Session expired') {
            showError('todo-error', error.message);
        }
    }
}

async function addTodo() {
    const title = todoTitleInput.value.trim();
    if (!title) {
        showError('todo-error', 'Please enter a todo title');
        return;
    }

    const description = todoDescriptionInput.value.trim();

    addTodoBtn.dataset.originalText = addTodoBtn.textContent;
    setLoading(addTodoBtn, true);

    try {
        const response = await makeAuthenticatedRequest(`${TODO_SERVICE_URL}/todos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, description })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add todo');
        }

        const result = await response.json();
        todos.push(result.todo);
        renderTodos();
        updateStats();
        
        // Clear form
        todoTitleInput.value = '';
        todoDescriptionInput.value = '';
        
        showSuccess('todo-success', 'Todo added successfully!');

    } catch (error) {
        console.error('Add todo error:', error);
        if (error.message !== 'Session expired') {
            showError('todo-error', error.message);
        }
    } finally {
        setLoading(addTodoBtn, false);
    }
}

async function toggleTodo(todoId) {
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;

    try {
        const response = await makeAuthenticatedRequest(`${TODO_SERVICE_URL}/todos/${todoId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ completed: !todo.completed })
        });

        if (!response.ok) {
            throw new Error('Failed to update todo');
        }

        const result = await response.json();
        const index = todos.findIndex(t => t.id === todoId);
        todos[index] = result.todo;
        renderTodos();
        updateStats();

    } catch (error) {
        console.error('Toggle todo error:', error);
        if (error.message !== 'Session expired') {
            showError('todo-error', error.message);
        }
    }
}

async function deleteTodo(todoId) {
    if (!confirm('Are you sure you want to delete this todo?')) return;

    try {
        const response = await makeAuthenticatedRequest(`${TODO_SERVICE_URL}/todos/${todoId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete todo');
        }

        todos = todos.filter(t => t.id !== todoId);
        renderTodos();
        updateStats();
        showSuccess('todo-success', 'Todo deleted successfully!');

    } catch (error) {
        console.error('Delete todo error:', error);
        if (error.message !== 'Session expired') {
            showError('todo-error', error.message);
        }
    }
}

function renderTodos() {
    todoList.innerHTML = '';
    
    if (todos.length === 0) {
        todoList.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 2rem;">No todos yet. Add one above!</p>';
        return;
    }

    todos.forEach(todo => {
        const todoElement = document.createElement('div');
        todoElement.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        
        todoElement.innerHTML = `
            <div class="todo-header">
                <h4 class="todo-title ${todo.completed ? 'completed' : ''}">${escapeHtml(todo.title)}</h4>
                <div class="todo-actions">
                    <input type="checkbox" class="checkbox" ${todo.completed ? 'checked' : ''} 
                           onchange="toggleTodo('${todo.id}')">
                    <button class="btn btn-danger btn-delete" onclick="deleteTodo('${todo.id}')" title="Delete todo">🗑️</button>
                </div>
            </div>
            ${todo.description ? `<p class="todo-description">${escapeHtml(todo.description)}</p>` : ''}
            <small style="color: #6c757d;">Created: ${new Date(todo.createdAt).toLocaleString()}</small>
        `;
        
        todoList.appendChild(todoElement);
    });
}

function updateStats() {
    const total = todos.length;
    const completed = todos.filter(t => t.completed).length;
    const pending = total - completed;

    document.getElementById('total-todos').textContent = total;
    document.getElementById('completed-todos').textContent = completed;
    document.getElementById('pending-todos').textContent = pending;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event listeners
registerBtn.addEventListener('click', register);
loginBtn.addEventListener('click', login);
logoutBtn.addEventListener('click', logout);
addTodoBtn.addEventListener('click', addTodo);

// Allow Enter key to submit forms
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
});

todoTitleInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTodo();
});

todoDescriptionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTodo();
});

// Initialize app
async function initializeApp() {
    // Check if WebAuthn is supported
    if (!authManager.isWebAuthnSupported()) {
        showError('auth-error', 'WebAuthn is not supported in this browser. Please use a modern browser with passkey support.');
        registerBtn.disabled = true;
        loginBtn.disabled = true;
        showUnauthenticatedUI();
        return;
    }

    // Try to restore authentication from localStorage
    const authState = await authManager.initialize(`${TODO_SERVICE_URL}/todos`);
    
    if (authState.authenticated) {
        showAuthenticatedUI();
        await loadTodos();
    } else {
        showUnauthenticatedUI();
    }
}

// Start the app
initializeApp(); 