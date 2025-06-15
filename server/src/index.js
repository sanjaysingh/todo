// Helper function to verify token with auth service
async function verifyTokenWithAuthService(env, token) {
  try {
    const response = await fetch(`${env.AUTH_SERVICE_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    return result.valid ? result : null;
  } catch (error) {
    console.error('Auth service verification failed:', error);
    return null;
  }
}

// Helper function to generate todo ID
function generateTodoId() {
  return crypto.randomUUID();
}

// Helper function to get user todos
async function getUserTodos(env, userId) {
  const todosJson = await env.TODO_KV.get(`todos:${userId}`);
  return todosJson ? JSON.parse(todosJson) : [];
}

// Helper function to save user todos
async function saveUserTodos(env, userId, todos) {
  await env.TODO_KV.put(`todos:${userId}`, JSON.stringify(todos));
}

// Helper function to check if origin is allowed (subdomain of sanjaysingh.net)
function isAllowedOrigin(origin) {
  if (!origin) return false;
  
  try {
    const url = new URL(origin);
    
    // Allow exact domain and all subdomains of sanjaysingh.net
    if (url.hostname === 'sanjaysingh.net' || url.hostname.endsWith('.sanjaysingh.net')) {
      return true;
    }
    
    // Allow localhost for development (any port)
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

// CORS headers
function getCorsHeaders(origin) {
  // Check if the origin is allowed
  const allowOrigin = isAllowedOrigin(origin) ? origin : 'https://sanjaysingh.net';
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Handle OPTIONS requests for CORS
function handleOptions(origin) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

// Middleware to authenticate requests
async function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid token', status: 401 };
  }

  const token = authHeader.substring(7);
  const authResult = await verifyTokenWithAuthService(env, token);
  
  if (!authResult) {
    return { error: 'Invalid token', status: 401 };
  }

  return { user: authResult.user, userId: authResult.userId };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const origin = request.headers.get('Origin');

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return handleOptions(origin);
    }

    try {
      switch (true) {
        case path === '/todos' && method === 'GET':
          return await handleGetTodos(request, env);
        case path === '/todos' && method === 'POST':
          return await handleCreateTodo(request, env);
        case path.startsWith('/todos/') && method === 'PUT':
          const updateId = path.split('/')[2];
          return await handleUpdateTodo(request, env, updateId);
        case path.startsWith('/todos/') && method === 'DELETE':
          const deleteId = path.split('/')[2];
          return await handleDeleteTodo(request, env, deleteId);
        case path === '/health':
          return new Response(JSON.stringify({ status: 'ok', service: 'todo-service' }), {
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
          });
        default:
          return new Response('Not Found', { 
            status: 404,
            headers: getCorsHeaders(origin)
          });
      }
    } catch (error) {
      console.error('Error:', error);
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
  const authResult = await authenticate(request, env);
  if (authResult.error) {
    return new Response(JSON.stringify({ error: authResult.error }), {
      status: authResult.status,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
    });
  }

  const todos = await getUserTodos(env, authResult.userId);
  
  return new Response(JSON.stringify({ todos }), {
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
  });
}

async function handleCreateTodo(request, env) {
  const authResult = await authenticate(request, env);
  if (authResult.error) {
    return new Response(JSON.stringify({ error: authResult.error }), {
      status: authResult.status,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
    });
  }

  const { title, description } = await request.json();
  
  if (!title) {
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

  const todos = await getUserTodos(env, authResult.userId);
  todos.push(newTodo);
  await saveUserTodos(env, authResult.userId, todos);

  return new Response(JSON.stringify({ todo: newTodo }), {
    status: 201,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
  });
}

async function handleUpdateTodo(request, env, todoId) {
  const authResult = await authenticate(request, env);
  if (authResult.error) {
    return new Response(JSON.stringify({ error: authResult.error }), {
      status: authResult.status,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
    });
  }

  const updateData = await request.json();
  const todos = await getUserTodos(env, authResult.userId);
  
  const todoIndex = todos.findIndex(todo => todo.id === todoId);
  if (todoIndex === -1) {
    return new Response(JSON.stringify({ error: 'Todo not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
    });
  }

  // Update todo with provided fields
  const updatedTodo = {
    ...todos[todoIndex],
    ...updateData,
    id: todoId, // Ensure ID cannot be changed
    updatedAt: new Date().toISOString(),
  };

  todos[todoIndex] = updatedTodo;
  await saveUserTodos(env, authResult.userId, todos);

  return new Response(JSON.stringify({ todo: updatedTodo }), {
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
  });
}

async function handleDeleteTodo(request, env, todoId) {
  const authResult = await authenticate(request, env);
  if (authResult.error) {
    return new Response(JSON.stringify({ error: authResult.error }), {
      status: authResult.status,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
    });
  }

  const todos = await getUserTodos(env, authResult.userId);
  const todoIndex = todos.findIndex(todo => todo.id === todoId);
  
  if (todoIndex === -1) {
    return new Response(JSON.stringify({ error: 'Todo not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
    });
  }

  const deletedTodo = todos.splice(todoIndex, 1)[0];
  await saveUserTodos(env, authResult.userId, todos);

  return new Response(JSON.stringify({ 
    message: 'Todo deleted successfully',
    todo: deletedTodo 
  }), {
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('Origin')) }
  });
} 