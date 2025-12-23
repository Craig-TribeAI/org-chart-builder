# Org Chart Builder - Claude Code Prompt

I need you to build an interactive org chart builder application that visualizes our company's organizational structure and growth plans for 2026.

## PROJECT SETUP
- The CSV file is located in the project folder: `tribe_org-chart-v3`
- Build this as a web application (React preferred for interactivity)

## CSV DATA PROCESSING

1. Read the CSV file which contains roles and their quarterly growth data for 2026
2. Clean the role titles by:
   - Removing asterisks (*)
   - Removing any text in parentheses including the parentheses
   - Trimming whitespace
   - Result should be clean, normalized role titles
3. Detect department headers:
   - Headers/section titles above groups of roles should be used to auto-assign departments
   - Parse these intelligently from the CSV structure

## CORE FEATURES

### 1. Department Management
- Auto-assign departments based on headers detected in the CSV
- Provide an interface for me to view and edit department assignments for each role
- Allow me to rename departments or reassign roles to different departments
- Color-code or visually group roles by department in the org chart

### 2. Manager Assignment Interface
- Allow me to designate certain roles as managers
- Assign multiple roles to report to specific managers
- Store these relationships (consider using local storage or a simple JSON file)

### 3. Org Chart Visualization
- Display the organizational hierarchy as an interactive org chart
- Show reporting relationships between managers and their direct reports
- Visually distinguish departments (color coding, grouping, or labels)
- Use cards/nodes for each role showing the title and department

### 4. Quarter Selection
- Dropdown or tab selector to view org chart for:
  * Q1 2026
  * Q2 2026
  * Q3 2026
  * Q4 2026
  * Full Year 2026 (all roles)
- The chart should update based on when roles are added according to the CSV's quarterly growth data

### 5. Drag-and-Drop Editing
- Enable drag-and-drop functionality to:
  * Move role cards around for better visualization
  * Reassign reporting relationships by dragging a role card onto a different manager
  * Visually reorganize the chart layout

### 6. Data Persistence
- Save the manager assignments, department assignments, and org structure
- Preserve custom layout positions if possible

## UI/UX REQUIREMENTS
- Clean, professional interface
- Clear visual hierarchy showing reporting lines
- Role cards should display the normalized title and department
- Easy to distinguish managers from individual contributors
- Visual department groupings/color coding
- Edit panel or modal for adjusting department assignments
- Responsive design

## TECHNICAL APPROACH
- Use a library like react-flow, vis-network, or similar for the org chart visualization and drag-and-drop
- Parse CSV on load, detecting both roles and department headers
- Create a data structure that maps roles to quarters, managers, and departments

## NEXT STEPS
Please start by examining the CSV file structure to understand the department headers and role organization, then build the application step by step.
