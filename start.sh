#!/bin/bash

# ─────────────────────────────────────────────
#  StudySync Startup Script
# ─────────────────────────────────────────────

BLUE="\033[34m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
GRAY="\033[90m"
RESET="\033[0m"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${RESET}"
echo -e "${BLUE}║        🧠 StudySync Startup            ║${RESET}"
echo -e "${BLUE}╚════════════════════════════════════════╝${RESET}"
echo ""

# ── Prompt for Ollama/ngrok URL ──────────────────
echo -e "${YELLOW}📋 Enter your Colab ngrok URL${RESET}"
echo -e "${GRAY}   (from the ENDPOINT line in your Colab output)${RESET}"
echo -e "${GRAY}   Example: https://random-words-here.ngrok-free.app${RESET}"
echo ""
read -p "   Ngrok URL: " NGROK_URL

# Validate input
if [ -z "$NGROK_URL" ]; then
  echo -e "\n${RED}❌ No URL entered. Exiting.${RESET}"
  exit 1
fi

# Strip trailing slash if present
NGROK_URL="${NGROK_URL%/}"

echo ""
echo -e "${GRAY}──────────────────────────────────────────${RESET}"

# ── Prompt for model (optional) ──────────────────
echo -e "${YELLOW}🤖 Which model are you running in Colab?${RESET}"
echo -e "${GRAY}   Press Enter to keep current model, or type a new one${RESET}"
echo -e "${GRAY}   Options: mistral | llama3.1:8b | llama3.2:3b | phi3:mini${RESET}"
echo ""
read -p "   Model [leave blank to keep existing]: " OLLAMA_MODEL_INPUT

echo ""
echo -e "${GRAY}──────────────────────────────────────────${RESET}"

# ── Update backend .env ───────────────────────────
BACKEND_ENV="./backend/.env"

if [ ! -f "$BACKEND_ENV" ]; then
  echo -e "${RED}❌ backend/.env not found. Are you running this from the project root?${RESET}"
  exit 1
fi

# Update OLLAMA_BASE_URL in .env
if grep -q "OLLAMA_BASE_URL" "$BACKEND_ENV"; then
  sed -i "s|OLLAMA_BASE_URL=.*|OLLAMA_BASE_URL=${NGROK_URL}|" "$BACKEND_ENV"
else
  echo "OLLAMA_BASE_URL=${NGROK_URL}" >> "$BACKEND_ENV"
fi

# Update OLLAMA_MODEL if user entered one
if [ -n "$OLLAMA_MODEL_INPUT" ]; then
  if grep -q "OLLAMA_MODEL" "$BACKEND_ENV"; then
    sed -i "s|OLLAMA_MODEL=.*|OLLAMA_MODEL=${OLLAMA_MODEL_INPUT}|" "$BACKEND_ENV"
  else
    echo "OLLAMA_MODEL=${OLLAMA_MODEL_INPUT}" >> "$BACKEND_ENV"
  fi
fi

echo -e "  ${GREEN}✓${RESET} Updated backend/.env"
echo -e "  ${GRAY}  OLLAMA_BASE_URL = ${NGROK_URL}${RESET}"

CURRENT_MODEL=$(grep "OLLAMA_MODEL" "$BACKEND_ENV" | cut -d'=' -f2)
echo -e "  ${GRAY}  OLLAMA_MODEL    = ${CURRENT_MODEL}${RESET}"

echo ""
echo -e "${GRAY}──────────────────────────────────────────${RESET}"

# ── Start Backend ─────────────────────────────────
echo -e "  ${BLUE}◦${RESET} Starting backend..."
cd backend && npm start &
BACKEND_PID=$!
sleep 3

# ── Start Frontend ────────────────────────────────
echo -e "  ${BLUE}◦${RESET} Starting frontend..."
cd ../frontend/study-sync-app && npm run serve &
FRONTEND_PID=$!

echo ""
echo -e "${GRAY}──────────────────────────────────────────${RESET}"
echo -e "  ${GREEN}✓${RESET} Backend  → http://localhost:3001"
echo -e "  ${GREEN}✓${RESET} Frontend → http://localhost:8080"
echo -e "${GRAY}──────────────────────────────────────────${RESET}"
echo ""
echo -e "${GRAY}  Press Ctrl+C to stop both servers${RESET}"
echo ""

# ── Keep script alive, kill both on Ctrl+C ────────
trap "echo -e '\n${RED}🛑 Shutting down...${RESET}'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
