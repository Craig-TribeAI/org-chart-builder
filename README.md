# Org Chart Builder

An interactive web application for visualizing and managing organizational structure for 2026 growth planning.

## Features

- 📊 **CSV Import**: Load quarterly headcount data from CSV files
- 👥 **Manager Assignments**: Assign reporting relationships with drag-and-drop or bulk selection
- 🔍 **Searchable**: Find people quickly with search and department filters
- 📥 **Import/Export**: Save and load your org chart configurations as JSON
- ➕/➖ **Expand/Collapse**: Collapse manager branches to focus on specific areas
- 🎨 **Department Colors**: Visual distinction between departments
- 💾 **Auto-Save**: Work is automatically saved to browser storage
- 🔄 **Quarter Views**: Switch between Q1, Q2, Q3, and Q4 2026 views

## Local Development

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` folder.

### Preview Production Build

```bash
npm run preview
```

## Usage

1. **Load CSV**: The app automatically loads your headcount data on startup
2. **Assign Managers**:
   - Click on a person node and draw connections
   - Use the Manager Assignment sidebar for bulk operations
   - Search for people using the search box
3. **Organize**: Collapse manager branches using the +/- buttons on nodes
4. **Export**: Save your work using the Export button
5. **Import**: Restore previous work using the Import button

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for instructions on deploying to Railway.app.

## Technology Stack

- **React 18** - UI framework
- **Vite** - Build tool
- **ReactFlow** - Interactive org chart visualization
- **Zustand** - State management
- **Dagre** - Automatic graph layout
- **Papaparse** - CSV parsing
- **Lucide React** - Icons

## Project Structure

```
src/
├── components/
│   ├── Header/          # App header with export/import
│   ├── Sidebar/         # Manager assignment controls
│   └── OrgChart/        # Org chart visualization
├── stores/              # Zustand state management
├── utils/               # CSV parsing, layout engine
└── App.jsx             # Main application component
```

## Data Storage

- **Browser Storage**: Data is stored in localStorage (persists across sessions)
- **Export/Import**: JSON format for sharing between users
- **No Backend Required**: Fully client-side application

## License

Proprietary - Internal use only
