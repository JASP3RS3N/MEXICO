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

user_problem_statement: |
  App para control financiero, de inventario y P&L de un restaurante smokehouse, con roles:
  - Dueño: acceso a todo; único que ve finanzas y venta del día.
  - Cajera: levanta órdenes y cobra; el ticket se envía a preparación.
  - Preparación: acepta la orden; pantalla de cliente muestra el estatus de las comandas.
  Registrar materia prima con data maestra, generar orden de compra, dashboard P&L,
  editar precios y crear usuarios.

backend:
  - task: "Auth JWT + RBAC (owner/cashier/prep) and user management"
    implemented: true
    working: true
    file: "backend/routes_auth.py, backend/security.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "JWT + bcrypt, role guards. smoke_test.py verifies cashier/prep blocked from finances & users (403), owner allowed. Last-owner guardrails."
  - task: "Menu/products + price edit (owner only)"
    implemented: true
    working: true
    file: "backend/routes_menu.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Categories/products CRUD; PATCH price owner-only; recipe cost auto-computed. Verified via smoke_test."
  - task: "Materia prima master data + purchase orders + stock movements"
    implemented: true
    working: true
    file: "backend/routes_inventory.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Materials CRUD, adjust, low-stock, reorder suggestions. PO create + receive updates stock/cost. Verified."
  - task: "Orders lifecycle: POS -> kitchen -> pay + inventory deduction"
    implemented: true
    working: true
    file: "backend/routes_orders.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Create (cashier), kitchen queue hides prices, public /display no money, accept/ready/deliver/pay. Pay deducts recipe materials + records COGS + change. Verified."
  - task: "Finance P&L, daily sales, dashboard, expenses (owner only)"
    implemented: true
    working: true
    file: "backend/routes_finance.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "P&L (revenue, COGS, gross/net profit, margins, series, by category, top products), daily (by method/hour), dashboard KPIs, expenses CRUD. Verified gross_profit=revenue-cogs and net=gross-opex."

frontend:
  - task: "Auth context, role-based routing, app shell"
    implemented: true
    working: "NA"
    file: "frontend/src/App.js, context/AuthContext.js, components/Layout.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Role-filtered sidebar, protected routes redirect by role. Not yet UI-tested (no live Mongo in build env)."
  - task: "POS, Orders, Kitchen, public Client Display"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/POS.js, Orders.js, Kitchen.js, Display.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "POS cart+charge, kitchen KDS with timers, public status board polling. Needs UI test."
  - task: "Owner admin: P&L dashboard, menu/prices, inventory, purchase orders, users, expenses, settings"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/Dashboard.js, Menu.js, Inventory.js, PurchaseOrders.js, Users.js, Expenses.js, Settings.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Recharts P&L dashboard, inline price edit, materia prima master data, reorder-suggested POs, user CRUD. Needs UI test."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "Auth context, role-based routing, app shell"
    - "POS, Orders, Kitchen, public Client Display"
    - "Owner admin: P&L dashboard, menu/prices, inventory, purchase orders, users, expenses, settings"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: |
      Built full smokehouse management app on FastAPI+Mongo+React. Backend verified end-to-end
      with backend/smoke_test.py (42/42 passing) using mongomock-motor: auth/RBAC, POS order flow,
      kitchen transitions, payment with inventory deduction + COGS, purchase orders receiving,
      and P&L math. Frontend compiles; needs live UI testing against a running Mongo.
      Seed users: dueno/dueno123 (owner), caja/caja123 (cashier), cocina/cocina123 (prep).