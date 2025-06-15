// Helper function to create structured logs
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...data
  };
  console.log(JSON.stringify(logEntry));
}

// Helper function to verify token with auth service
async function verifyTokenWithAuthService(env, token) {
  const startTime = Date.now();
  log('info', 'Starting auth service verification');
  
  try {
    const response = await fetch(`${env.AUTH_SERVICE_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      log('warn', 'Auth service verification failed', {
        status: response.status,
        duration,
        authServiceUrl: env.AUTH_SERVICE_URL
      });
      return null;
    }

    const result = await response.json();
    const isValid = result.valid ? result : null;
    
    log('info', 'Auth service verification completed', {
      success: !!isValid,
      duration,
      userId: isValid?.userId || 'unknown'
    });
    
    return isValid;
  } catch (error) {
    const duration = Date.now() - startTime;
    log('error', 'Auth service verification error', {
      error: error.message,
      duration,
      authServiceUrl: env.AUTH_SERVICE_URL
    });
    return null;
  }
}

// Helper function to generate todo ID
function generateTodoId() {
  const id = crypto.randomUUID();
  log('debug', 'Generated new todo ID', { todoId: id });
  return id;
}

// Helper function to get user todos
async function getUserTodos(env, userId) {
  const startTime = Date.now();
  log('info', 'Fetching user todos from KV', { userId });
  
  try {
    const todosJson = await env.TODO_KV.get(`todos:${userId}`);
    const todos = todosJson ? JSON.parse(todosJson) : [];
    const duration = Date.now() - startTime;
    
    log('info', 'Successfully fetched user todos', {
      userId,
      todoCount: todos.length,
      duration
    });
    
    return todos;
  } catch (error) {
    const duration = Date.now() - startTime;
    log('error', 'Failed to fetch user todos from KV', {
      userId,
      error: error.message,
      duration
    });
    throw error;
  }
}

// Helper function to save user todos
async function saveUserTodos(env, userId, todos) {
  const startTime = Date.now();
  log('info', 'Saving user todos to KV', { userId, todoCount: todos.length });
  
  try {
    await env.TODO_KV.put(`todos:${userId}`, JSON.stringify(todos));
    const duration = Date.now() - startTime;
    
    log('info', 'Successfully saved user todos', {
      userId,
      todoCount: todos.length,
      duration
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log('error', 'Failed to save user todos to KV', {
      userId,
      todoCount: todos.length,
      error: error.message,
      duration
    });
    throw error;
  }
}

// Helper function to check if origin is allowed (subdomain of sanjaysingh.net)
function isAllowedOrigin(origin) {
  if (!origin) {
    log('debug', 'No origin provided');
    return false;
  }
  
  try {
    const url = new URL(origin);
    
    // Allow exact domain and all subdomains of sanjaysingh.net
    if (url.hostname === 'sanjaysingh.net' || url.hostname.endsWith('.sanjaysingh.net')) {
      log('debug', 'Origin allowed', { origin, hostname: url.hostname });
      return true;
    }
    
    // Allow localhost for development (any port)
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      log('debug', 'Localhost origin allowed', { origin, hostname: url.hostname });
      return true;
    }
    
    log('warn', 'Origin not allowed', { origin, hostname: url.hostname });
    return false;
  } catch (error) {
    log('warn', 'Invalid origin URL', { origin, error: error.message });
    return false;
  }
}

// CORS headers
function getCorsHeaders(origin) {
  // Check if the origin is allowed
  const allowOrigin = isAllowedOrigin(origin) ? origin : 'https://sanjaysingh.net';
  
  log('debug', 'Setting CORS headers', { requestOrigin: origin, allowedOrigin: allowOrigin });
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Handle OPTIONS requests for CORS
function handleOptions(origin) {
  log('info', 'Handling CORS preflight request', { origin });
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

// Middleware to authenticate requests
async function authenticate(request, env) {
  log('info', 'Starting authentication');
  
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    log('warn', 'Missing or invalid Authorization header');
    return { error: 'Missing or invalid token', status: 401 };
  }

  const token = authHeader.substring(7);
  log('debug', 'Extracted token from header', { tokenPrefix: token.substring(0, 10) + '...' });
  
  const authResult = await verifyTokenWithAuthService(env, token);
  
  if (!authResult) {
    log('warn', 'Token verification failed');
    return { error: 'Invalid token', status: 401 };
  }

  log('info', 'Authentication successful', { userId: authResult.userId, username: authResult.user?.username });
  return { user: authResult.user, userId: authResult.userId };
}

export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const origin = request.headers.get('Origin');
    const userAgent = request.headers.get('User-Agent');
    
    // Log incoming request
    log('info', 'Incoming request', {
      method,
      path,
      origin,
      userAgent: userAgent?.substring(0, 100) || 'unknown',
      cf: {
        country: request.cf?.country,
        city: request.cf?.city,
        ip: request.headers.get('CF-Connecting-IP')
      }
    });

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return handleOptions(origin);
    }

    try {
      let response;
      
      switch (true) {
        case path === '/todos' && method === 'GET':
          log('info', 'Processing GET todos request');
          response = await handleGetTodos(request, env);
          break;
        case path === '/todos' && method === 'POST':
          log('info', 'Processing POST todos request');
          response = await handleCreateTodo(request, env);
          break;
        case path.startsWith('/todos/') && method === 'PUT':
          const updateId = path.split('/')[2];
          log('info', 'Processing PUT todo request', { todoId: updateId });
          response = await handleUpdateTodo(request, env, updateId);
          break;
        case path.startsWith('/todos/') && method === 'DELETE':
          const deleteId = path.split('/')[2];
          log('info', 'Processing DELETE todo request', { todoId: deleteId });
          response = await handleDeleteTodo(request, env, deleteId);
          break;
        case path === '/health':
          log('info', 'Processing health check request');
          response = new Response(JSON.stringify({ status: 'ok', service: 'todo-service' }), {
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
          });
          break;
        default:
          log('warn', 'Unknown endpoint requested', { method, path });
          response = new Response('Not Found', { 
            status: 404,
            headers: getCorsHeaders(origin)
          });
      }
      
      const duration = Date.now() - startTime;
      log('info', 'Request completed', {
        method,
        path,
        status: response.status,
        duration
      });
      
      return response;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      log('error', 'Request failed with error', {
        method,
        path,
        error: error.message,
        stack: error.stack,
        duration
      });
      
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(origin)
        }
      });
    }
  }
};

async function handleGetTodos(request, env) {
  const startTime = Date.now();
  log('info', 'Starting handleGetTodos');
  
  const authResult = await authenticate(request, env);
  if (authResult.error) {
    log('warn', 'Authentication failed in handleGetTodos', { error: authResult.error });
    return new Response(JSON.stringify({ error: authResult.error }), {
      status: authResult.status,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
    });
  }

  try {
    const todos = await getUserTodos(env, authResult.userId);
    const duration = Date.now() - startTime;
    
    log('info', 'handleGetTodos completed successfully', {
      userId: authResult.userId,
      todoCount: todos.length,
      duration
    });
    
    return new Response(JSON.stringify({ todos }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log('error', 'handleGetTodos failed', {
      userId: authResult.userId,
      error: error.message,
      duration
    });
    throw error;
  }
}

async function handleCreateTodo(request, env) {
  const startTime = Date.now();
  log('info', 'Starting handleCreateTodo');
  
  const authResult = await authenticate(request, env);
  if (authResult.error) {
    log('warn', 'Authentication failed in handleCreateTodo', { error: authResult.error });
    return new Response(JSON.stringify({ error: authResult.error }), {
      status: authResult.status,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
    });
  }

  try {
    const requestBody = await request.json();
    const { title, description } = requestBody;
    
    log('info', 'Parsed todo creation request', {
      userId: authResult.userId,
      title: title?.substring(0, 50) || 'empty',
      hasDescription: !!description
    });
    
    if (!title) {
      log('warn', 'Todo creation failed - missing title', { userId: authResult.userId });
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
      });
    }

    const newTodo = {
      id: generateTodoId(),
      title,
      description: description || '',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    log('info', 'Created new todo object', {
      userId: authResult.userId,
      todoId: newTodo.id,
      title: newTodo.title.substring(0, 50)
    });

    const todos = await getUserTodos(env, authResult.userId);
    todos.push(newTodo);
    await saveUserTodos(env, authResult.userId, todos);

    const duration = Date.now() - startTime;
    log('info', 'handleCreateTodo completed successfully', {
      userId: authResult.userId,
      todoId: newTodo.id,
      newTotalCount: todos.length,
      duration
    });

    return new Response(JSON.stringify({ todo: newTodo }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log('error', 'handleCreateTodo failed', {
      userId: authResult.userId,
      error: error.message,
      duration
    });
    throw error;
  }
}

async function handleUpdateTodo(request, env, todoId) {
  const startTime = Date.now();
  log('info', 'Starting handleUpdateTodo', { todoId });
  
  const authResult = await authenticate(request, env);
  if (authResult.error) {
    log('warn', 'Authentication failed in handleUpdateTodo', { todoId, error: authResult.error });
    return new Response(JSON.stringify({ error: authResult.error }), {
      status: authResult.status,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
    });
  }

  try {
    const updateData = await request.json();
    log('info', 'Parsed todo update request', {
      userId: authResult.userId,
      todoId,
      updateFields: Object.keys(updateData)
    });
    
    const todos = await getUserTodos(env, authResult.userId);
    
    const todoIndex = todos.findIndex(todo => todo.id === todoId);
    if (todoIndex === -1) {
      log('warn', 'Todo not found for update', { userId: authResult.userId, todoId });
      return new Response(JSON.stringify({ error: 'Todo not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
      });
    }

    const originalTodo = { ...todos[todoIndex] };
    
    // Update todo with provided fields
    const updatedTodo = {
      ...todos[todoIndex],
      ...updateData,
      id: todoId, // Ensure ID cannot be changed
      updatedAt: new Date().toISOString(),
    };

    todos[todoIndex] = updatedTodo;
    await saveUserTodos(env, authResult.userId, todos);

    const duration = Date.now() - startTime;
    log('info', 'handleUpdateTodo completed successfully', {
      userId: authResult.userId,
      todoId,
      changedFields: Object.keys(updateData),
      wasCompleted: originalTodo.completed,
      nowCompleted: updatedTodo.completed,
      duration
    });

    return new Response(JSON.stringify({ todo: updatedTodo }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log('error', 'handleUpdateTodo failed', {
      userId: authResult.userId,
      todoId,
      error: error.message,
      duration
    });
    throw error;
  }
}

async function handleDeleteTodo(request, env, todoId) {
  const startTime = Date.now();
  log('info', 'Starting handleDeleteTodo', { todoId });
  
  const authResult = await authenticate(request, env);
  if (authResult.error) {
    log('warn', 'Authentication failed in handleDeleteTodo', { todoId, error: authResult.error });
    return new Response(JSON.stringify({ error: authResult.error }), {
      status: authResult.status,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
    });
  }

  try {
    const todos = await getUserTodos(env, authResult.userId);
    const todoIndex = todos.findIndex(todo => todo.id === todoId);
    
    if (todoIndex === -1) {
      log('warn', 'Todo not found for deletion', { userId: authResult.userId, todoId });
      return new Response(JSON.stringify({ error: 'Todo not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
      });
    }

    const deletedTodo = todos.splice(todoIndex, 1)[0];
    await saveUserTodos(env, authResult.userId, todos);

    const duration = Date.now() - startTime;
    log('info', 'handleDeleteTodo completed successfully', {
      userId: authResult.userId,
      todoId,
      deletedTitle: deletedTodo.title.substring(0, 50),
      remainingCount: todos.length,
      duration
    });

    return new Response(JSON.stringify({ 
      message: 'Todo deleted successfully',
      todo: deletedTodo 
    }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log('error', 'handleDeleteTodo failed', {
      userId: authResult.userId,
      todoId,
      error: error.message,
      duration
    });
    throw error;
  }
} 