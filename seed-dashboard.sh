#!/bin/bash
# Seed script to populate the database with realistic test data for the user stats dashboard.
# Usage: bash seed-dashboard.sh
set -e

API="http://localhost:3000"
DB_CONTAINER="backend-postgres-1"

echo "=== Step 1: Login ==="
TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com","password":"user1234"}' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to login"
  exit 1
fi
echo "Token acquired: ${TOKEN:0:20}..."

echo ""
echo "=== Step 2: Get workspace slug ==="
WORKSPACE_JSON=$(curl -s "$API/workspaces" -H "Authorization: Bearer $TOKEN")
echo "Workspaces response: $WORKSPACE_JSON"
SLUG=$(echo "$WORKSPACE_JSON" | grep -o '"slug":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$SLUG" ]; then
  echo "ERROR: No workspace found"
  exit 1
fi
echo "Using workspace slug: $SLUG"

echo ""
echo "=== Step 3: Create test agent users ==="

AGENTS=()
for i in 1 2 3; do
  NAMES=("Carlos" "Maria" "Pedro")
  LASTNAMES=("Garcia" "Lopez" "Martinez")
  IDX=$((i-1))

  RESULT=$(curl -s -X POST "$API/users" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"email\":\"agent${i}@test.com\",\"password\":\"user1234\",\"firstName\":\"${NAMES[$IDX]}\",\"lastName\":\"${LASTNAMES[$IDX]}\",\"isEmailVerified\":true}")

  USER_ID=$(echo "$RESULT" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

  if [ -z "$USER_ID" ]; then
    echo "Agent $i may already exist, trying to find ID..."
    USERS_LIST=$(curl -s "$API/users" -H "Authorization: Bearer $TOKEN")
    USER_ID=$(echo "$USERS_LIST" | grep -o "\"id\":\"[^\"]*\",\"email\":\"agent${i}@test.com\"" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  fi

  if [ -n "$USER_ID" ]; then
    AGENTS+=("$USER_ID")
    echo "Agent $i (${NAMES[$IDX]}): $USER_ID"

    # Add as workspace member
    curl -s -X POST "$API/workspaces/$SLUG/members" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{\"userId\":\"$USER_ID\",\"role\":\"agent\"}" > /dev/null 2>&1
    echo "  -> Added to workspace as agent"
  else
    echo "WARNING: Could not get ID for agent $i"
  fi
done

# Get admin user ID too
ADMIN_ID=$(curl -s "$API/users/me" -H "Authorization: Bearer $TOKEN" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Admin user ID: $ADMIN_ID"

echo ""
echo "=== Step 4: Create 35 tickets ==="

PRIORITIES=("low" "medium" "high" "critical")
CATEGORIES=("bug" "issue" "task")

TICKET_NAMES=(
  "Login page not loading"
  "Cannot upload attachments"
  "Dashboard shows wrong data"
  "Email notifications delayed"
  "Search returns no results"
  "API timeout on large requests"
  "Mobile layout broken"
  "Password reset not working"
  "Export to CSV fails"
  "User profile not saving"
  "Slow performance on reports"
  "SSL certificate expiring"
  "Database connection drops"
  "Webhook delivery failing"
  "CORS error on widget"
  "Dark mode colors wrong"
  "Pagination broken on list"
  "File download corrupted"
  "Timezone offset incorrect"
  "Memory leak in worker"
  "OAuth callback error"
  "Rate limiter too aggressive"
  "Missing translations"
  "Audit log not recording"
  "Backup job failing"
  "Disk space alert"
  "DNS resolution slow"
  "Cache invalidation issue"
  "Queue stuck processing"
  "Cron job not triggering"
  "Image resize quality poor"
  "PDF generation timeout"
  "WebSocket disconnects"
  "Batch import duplicates"
  "Role permission mismatch"
)

TICKET_IDS=()

for i in $(seq 0 34); do
  PRIO=${PRIORITIES[$((RANDOM % 4))]}
  CAT=${CATEGORIES[$((RANDOM % 3))]}
  NAME="${TICKET_NAMES[$i]}"

  RESULT=$(curl -s -X POST "$API/workspaces/$SLUG/tickets" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"name\":\"$NAME\",\"description\":\"Detailed description for: $NAME. This needs to be investigated and resolved.\",\"priority\":\"$PRIO\",\"category\":\"$CAT\"}")

  TID=$(echo "$RESULT" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  if [ -n "$TID" ]; then
    TICKET_IDS+=("$TID")
    echo "Ticket $((i+1))/35: $TID - $NAME ($PRIO/$CAT)"
  else
    echo "WARNING: Failed to create ticket $((i+1)): $RESULT"
  fi
done

echo ""
echo "Created ${#TICKET_IDS[@]} tickets"

echo ""
echo "=== Step 5: Assign tickets to agents ==="

ALL_AGENTS=("$ADMIN_ID" "${AGENTS[@]}")
NUM_AGENTS=${#ALL_AGENTS[@]}

for i in $(seq 0 $((${#TICKET_IDS[@]} - 1))); do
  # Assign ~80% of tickets
  if [ $((RANDOM % 5)) -ne 0 ]; then
    AGENT_IDX=$((i % NUM_AGENTS))
    AGENT_ID="${ALL_AGENTS[$AGENT_IDX]}"

    curl -s -X PATCH "$API/workspaces/$SLUG/tickets/${TICKET_IDS[$i]}/assign" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{\"assigneeId\":\"$AGENT_ID\"}" > /dev/null 2>&1
    echo "Ticket $((i+1)): assigned to agent $((AGENT_IDX+1))"
  fi
done

echo ""
echo "=== Step 6: Add comments to tickets (simulating first response) ==="

COMMENTS=(
  "I'm looking into this issue now."
  "Can you provide more details about the error?"
  "I've identified the root cause. Working on a fix."
  "This is related to the recent deployment."
  "Escalating to the infrastructure team."
  "Fix deployed. Please verify on your end."
  "Confirmed the issue. Investigating further."
  "This is a known limitation, documenting workaround."
)

for i in $(seq 0 $((${#TICKET_IDS[@]} - 1))); do
  # Add comments to ~70% of tickets
  if [ $((RANDOM % 10)) -lt 7 ]; then
    COMMENT="${COMMENTS[$((RANDOM % 8))]}"

    curl -s -X POST "$API/workspaces/$SLUG/tickets/${TICKET_IDS[$i]}/comments" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{\"content\":\"$COMMENT\"}" > /dev/null 2>&1
    echo "Ticket $((i+1)): comment added"
  fi
done

echo ""
echo "=== Step 7: Resolve/close some tickets ==="

RESOLVED_IDS=()
for i in $(seq 0 $((${#TICKET_IDS[@]} - 1))); do
  # Resolve ~60% of tickets
  if [ $((RANDOM % 10)) -lt 6 ]; then
    curl -s -X PATCH "$API/workspaces/$SLUG/tickets/${TICKET_IDS[$i]}/status" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{"status":"resolved"}' > /dev/null 2>&1
    RESOLVED_IDS+=("${TICKET_IDS[$i]}")
    echo "Ticket $((i+1)): resolved"
  elif [ $((RANDOM % 10)) -lt 2 ]; then
    curl -s -X PATCH "$API/workspaces/$SLUG/tickets/${TICKET_IDS[$i]}/status" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{"status":"in-progress"}' > /dev/null 2>&1
    echo "Ticket $((i+1)): in-progress"
  fi
done

echo ""
echo "=== Step 8: Backdate tickets to spread over last 30 days ==="

# Build SQL to spread createdAt over the last 30 days
SQL="BEGIN;"

TOTAL=${#TICKET_IDS[@]}
for i in $(seq 0 $((TOTAL - 1))); do
  # Spread tickets: oldest first, newest last
  DAYS_AGO=$(( 30 - (i * 30 / TOTAL) ))
  HOURS=$((RANDOM % 24))
  MINS=$((RANDOM % 60))

  TID="${TICKET_IDS[$i]}"
  SQL="${SQL} UPDATE tickets SET \"createdAt\" = NOW() - INTERVAL '${DAYS_AGO} days' - INTERVAL '${HOURS} hours' - INTERVAL '${MINS} minutes' WHERE id = '${TID}';"
done

# Also backdate firstResponseAt (a few hours after createdAt)
for i in $(seq 0 $((TOTAL - 1))); do
  RESPONSE_HOURS=$((1 + RANDOM % 8))
  TID="${TICKET_IDS[$i]}"
  SQL="${SQL} UPDATE tickets SET \"firstResponseAt\" = \"createdAt\" + INTERVAL '${RESPONSE_HOURS} hours' WHERE id = '${TID}' AND \"firstResponseAt\" IS NOT NULL;"
done

# Backdate resolvedAt for resolved tickets (1-5 days after creation)
for TID in "${RESOLVED_IDS[@]}"; do
  RESOLVE_DAYS=$((1 + RANDOM % 5))
  RESOLVE_HOURS=$((RANDOM % 24))
  SQL="${SQL} UPDATE tickets SET \"resolvedAt\" = \"createdAt\" + INTERVAL '${RESOLVE_DAYS} days' + INTERVAL '${RESOLVE_HOURS} hours' WHERE id = '${TID}';"
done

# Backdate comments to match
SQL="${SQL} UPDATE comments SET \"createdAt\" = t.\"firstResponseAt\" FROM tickets t WHERE comments.\"ticketId\" = t.id AND t.\"firstResponseAt\" IS NOT NULL;"

SQL="${SQL} COMMIT;"

echo "Running SQL to backdate ${TOTAL} tickets..."
docker exec "$DB_CONTAINER" psql -U postgres -d open_helpdesk -c "$SQL"

echo ""
echo "=== Done! ==="
echo "Created:"
echo "  - 3 agent users (added to workspace)"
echo "  - ${#TICKET_IDS[@]} tickets with varying priorities and categories"
echo "  - Comments on ~70% of tickets"
echo "  - ~60% resolved, rest open/in-progress"
echo "  - All spread over the last 30 days"
echo ""
echo "Visit the dashboard to see the stats!"
