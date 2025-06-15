# Todo Application with Passkey Authentication

A modern, secure todo application featuring passkey authentication and automatic deployments. Built with a clean separation between frontend and backend services.

## 🌐 Live Application

- **Frontend**: [todo.sanjaysingh.net](https://todo.sanjaysingh.net)
- **Backend API**: [todoservice.sanjaysingh.net](https://todoservice.sanjaysingh.net)

## ✨ Features

### 🔐 Security First
- **Passkey Authentication**: Passwordless authentication using WebAuthn
- **JWT Token Verification**: Secure API access with token-based authentication
- **CORS Protection**: Configured for specific domain access

### 📝 Todo Management
- Create, read, update, and delete todos
- Mark todos as completed/incomplete
- Rich todo descriptions
- Persistent storage per user

### 🚀 Modern Architecture
- **Frontend**: Vanilla HTML/CSS/JavaScript with passkey integration
- **Backend**: Cloudflare Workers with KV storage
- **Deployment**: Automated CI/CD with GitHub Actions

## 🏗️ Architecture

```
┌─────────────────┐    HTTPS     ┌──────────────────────┐
│                 │◄────────────►│                      │
│   Frontend      │              │  Cloudflare Workers  │
│  (GitHub Pages) │              │     Backend API      │
│                 │              │                      │
└─────────────────┘              └──────────────────────┘
                                           │
                                           ▼
                                 ┌─────────────────┐
                                 │                 │
                                 │  Cloudflare KV  │
                                 │   (Database)    │
                                 │                 │
                                 └─────────────────┘
```

## 📁 Project Structure

```
todo/
├── client/                 # Frontend application
│   ├── index.html         # Main HTML file with embedded CSS/JS
│   └── CNAME              # Custom domain configuration
├── server/                # Backend API service
│   ├── src/
│   │   └── index.js       # Main server logic
│   ├── package.json       # Node.js dependencies
│   └── wrangler.toml      # Cloudflare Workers configuration
├── .github/
│   └── workflows/         # GitHub Actions CI/CD
│       ├── deploy-client.yml
│       └── deploy-server.yml
└── README.md
```

## 🔧 Tech Stack

### Frontend
- **HTML5/CSS3/JavaScript**: Modern vanilla web technologies
- **WebAuthn API**: For passkey authentication
- **SimpleWebAuthn**: Client library for WebAuthn integration
- **GitHub Pages**: Static site hosting

### Backend
- **Cloudflare Workers**: Serverless compute platform
- **Cloudflare KV**: Key-value storage for todos
- **JWT**: Token-based authentication
- **CORS**: Cross-origin resource sharing

### DevOps
- **GitHub Actions**: Automated CI/CD pipelines
- **Conditional Deployment**: Deploy only when relevant files change

## 🚀 Deployment

### Automated Deployment

The application uses GitHub Actions for automatic deployments:

#### Client Deployment
- **Trigger**: Changes in `client/` folder
- **Target**: GitHub Pages at `todo.sanjaysingh.net`
- **Workflow**: `.github/workflows/deploy-client.yml`

#### Server Deployment
- **Trigger**: Changes in `server/` folder
- **Target**: Cloudflare Workers at `todoservice.sanjaysingh.net`
- **Workflow**: `.github/workflows/deploy-server.yml`

### Manual Deployment

#### Frontend
```bash
# No build step required - static files
# Just push changes to trigger GitHub Actions
```

#### Backend
```bash
cd server
npm install
wrangler deploy
```

## ⚙️ Setup & Configuration

### Prerequisites
- Cloudflare account with Workers and KV enabled
- GitHub repository with Pages enabled
- Custom domain configured in DNS

### Environment Variables

#### Server (`server/wrangler.toml`)
```toml
[vars]
AUTH_SERVICE_URL = "https://authservice.sanjaysingh.net"

[[kv_namespaces]]
binding = "TODO_KV"
id = "your-kv-namespace-id"
```

#### GitHub Secrets
```
CLOUDFLARE_API_TOKEN = your_cloudflare_api_token
```

### Domain Configuration
- `todo.sanjaysingh.net` → GitHub Pages
- `todoservice.sanjaysingh.net` → Cloudflare Workers

## 🔌 API Endpoints

### Authentication
All API endpoints require a Bearer token in the Authorization header.

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/todos` | Get all todos for authenticated user |
| `POST` | `/todos` | Create a new todo |
| `PUT` | `/todos/:id` | Update a specific todo |
| `DELETE` | `/todos/:id` | Delete a specific todo |
| `GET` | `/health` | Health check endpoint |

### Example Usage

```javascript
// Get todos
const response = await fetch('https://todoservice.sanjaysingh.net/todos', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Create todo
const newTodo = await fetch('https://todoservice.sanjaysingh.net/todos', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'My Todo',
    description: 'Todo description'
  })
});
```

## 🔒 Security Features

- **Passkey Authentication**: No passwords to compromise
- **JWT Token Verification**: Secure API access
- **Domain Restrictions**: CORS configured for specific domains
- **HTTPS Only**: All communications encrypted
- **Input Validation**: Server-side validation of all inputs

## 🛠️ Development

### Local Development
```bash
# Frontend - serve client folder
cd client
python -m http.server 8000
# or use any static file server

# Backend - run locally with Wrangler
cd server
npm install
wrangler dev
```

### Testing
- Frontend: Open `http://localhost:8000`
- Backend: API available at `http://localhost:8787`

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


