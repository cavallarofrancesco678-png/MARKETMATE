#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "MarketMate - App per ambulanti con design Neumorphic. Implementare Spese Extra generiche e migliorare il prompt AI Buongiorno."

backend:
  - task: "AI Chat endpoint /api/ai/chat - Buongiorno structured prompt v2"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
        - agent: "testing"
        - comment: "Previously tested and working"
        - working: "NA"
        - agent: "main"
        - comment: "UPGRADED system prompt to 8 sections: 1) Saluto personalizzato, 2) Meteo, 3) Mercato & Percorso, 4) Carburante economico, 5) Incasso settimana precedente (per mercato specifico), 6) Notizie del giorno, 7) Promemoria scontrino/media clienti, 8) Consiglio del giorno"
        - working: true
        - agent: "testing"
        - comment: "COMPREHENSIVE TEST PASSED: Both GET /api/ health check and POST /api/ai/chat endpoints working perfectly. AI response contains ALL 8 required structured sections: 1) Saluto personalizzato (mentions Marco), 2) Meteo (SOLE, 25 gradi), 3) Mercato & Percorso (Milano to Magenta, 30km), 4) Carburante economico (cost optimization tips), 5) Incasso specifico mercato Magenta (800€ previous week), 6) Notizie del giorno (asks user preference), 7) Promemoria scontrino (photo reminder), 8) Consiglio del giorno (weather-based sales tips). Response is 1359 chars, well-formatted with emojis and bold headers. All specific content checks passed: mentions Marco, Milano, Magenta, weather details, and previous earnings."

frontend:
  - task: "Welcome Screen i18n reactivity + back navigation"
    implemented: true
    working: true
    file: "app/welcome.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
        - agent: "main"
        - comment: "All hardcoded Italian text replaced with t() calls using new 'welcome' namespace. Back arrow already present and working. Language change instantly updates all text on screen. Verified via screenshots."

  - task: "Login Screen - Logo MARKETMATE + 3-line security text"
    implemented: true
    working: true
    file: "app/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
        - agent: "main"
        - comment: "Replaced PNG logo with clean text-based logo (Ionicons storefront + MARKETMATE text, no gray bg). Added 3 separate localized security lines: data stays on device, no external server access, privacy guaranteed. All 6 languages translated."

  - task: "SpeseExtraModal - Generic expenses (voci generiche)"
    implemented: true
    working: "NA"
    file: "src/components/SpeseExtraModal.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
        - agent: "main"
        - comment: "Previously implemented, not retesting."

  - task: "BuongiornoModal - AI chat frontend"
    implemented: true
    working: "NA"
    file: "src/components/BuongiornoModal.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
        - agent: "main"
        - comment: "Frontend sends context and message, backend prompt upgraded."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
    - message: "Please test the POST /api/ai/chat endpoint with the UPGRADED prompt. Send POST to /api/ai/chat with body: {\"message\": \"Buongiorno!\", \"context\": \"Attivita: MarketMate\\nTitolare: Marco\\nMercato oggi: Magenta\\nPartenza da: Milano\\nMeteo oggi: SOLE, 25 gradi\\nKm oggi: 30\\nCosto/km: 0.25\\nCollaboratori: Luca, Anna\\nFornitori: Rossi SRL\\nSpese annuali: Assicurazione: 1200/anno\\nSettimana precedente totale: Lordo: 3500, Netto: 2100, 5 giorni lavorati\\nSettimana precedente mercato Magenta: Lordo: 800, 1 giornata\\nCarburante: Ultimo rifornimento: 01/04/2026, 85 euro\", \"session_id\": \"test_v2_1\"}. The response should now have 8 structured sections including: Meteo, Carburante economico, Incasso per mercato specifico, Notizie del giorno request, Promemoria scontrino, and Consiglio."
    - agent: "testing"
    - message: "TESTING COMPLETED SUCCESSFULLY: Both backend endpoints tested and working perfectly. GET /api/ returns correct health check response. POST /api/ai/chat with Buongiorno message returns comprehensive response with ALL 8 required structured sections: Saluto personalizzato (mentions Marco), Meteo (SOLE, 25 gradi), Mercato & Percorso (Milano to Magenta, 30km), Carburante economico, Incasso specifico mercato Magenta (800€), Notizie del giorno, Promemoria scontrino, and Consiglio del giorno. Response is well-formatted with emojis and bold headers. All content validation checks passed. Backend API is fully functional and ready for production use."
