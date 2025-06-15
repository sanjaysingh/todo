#!/bin/bash

echo "📝 Setting up Todo Service"
echo "=========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}Error: Wrangler CLI is not installed.${NC}"
    echo "Please install it with: npm install -g wrangler"
    exit 1
fi

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}You need to log in to Cloudflare first.${NC}"
    echo "Run: wrangler login"
    exit 1
fi

echo -e "${GREEN}✓ Wrangler CLI is installed and you're logged in.${NC}"
echo ""

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
if ! npm install; then
    echo -e "${RED}✗ Failed to install dependencies${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Create KV namespace
echo -e "${BLUE}Creating KV namespace for Todo Service...${NC}"
TODO_KV_ID=$(wrangler kv namespace create "TODO_KV" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)

if [ ! -z "$TODO_KV_ID" ]; then
    echo -e "${GREEN}✓ Todo Service KV namespace created${NC}"
    echo "  Production ID: $TODO_KV_ID"
    
    # Update wrangler.toml with the new KV namespace ID
    sed -i.bak "s/fbd76722a813416491790108fd312ddb/$TODO_KV_ID/g" wrangler.toml
    rm wrangler.toml.bak 2>/dev/null || true
    
    echo -e "${GREEN}✓ wrangler.toml updated with KV namespace ID${NC}"
else
    echo -e "${RED}✗ Failed to create Todo Service KV namespace${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}🔧 Configuration needed:${NC}"
echo "1. Update wrangler.toml with your auth service URL:"
echo "   - Replace 'your-subdomain' with your actual Cloudflare subdomain"
echo "   - Make sure it matches your deployed auth service URL"
echo ""
echo -e "${GREEN}✅ Todo Service setup complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Update AUTH_SERVICE_URL in wrangler.toml"
echo "2. Run 'npm run deploy' to deploy the service" 