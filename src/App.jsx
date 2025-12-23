import { useEffect } from 'react';
import Header from './components/Header/Header';
import Sidebar from './components/Sidebar/Sidebar';
import OrgChart from './components/OrgChart/OrgChart';
import { useOrgChartStore } from './stores/orgChartStore';
import './App.css';

function App() {
  const { csvFileName, loadCSV, isLoading } = useOrgChartStore();

  // Auto-load CSV on mount if not already loaded
  useEffect(() => {
    const loadDefaultCSV = async () => {
      // Only load if we don't already have data
      if (!csvFileName) {
        try {
          const response = await fetch('/headcount-data.csv');
          const blob = await response.blob();
          const file = new File([blob], 'headcount-data.csv', { type: 'text/csv' });
          await loadCSV(file);
        } catch (error) {
          console.error('Failed to load default CSV:', error);
        }
      }
    };

    loadDefaultCSV();
  }, [csvFileName, loadCSV]);

  return (
    <div className="app">
      <Header />

      <div className="app-body">
        <Sidebar />

        <main className="main-content">
          {isLoading ? (
            <div className="welcome">
              <h2>Loading...</h2>
              <p>Parsing CSV data...</p>
            </div>
          ) : csvFileName ? (
            <OrgChart />
          ) : (
            <div className="welcome">
              <h2>Welcome to Org Chart Builder</h2>
              <p>Upload your CSV file to begin building your 2026 organizational chart.</p>
              <ul>
                <li>Visualize quarterly headcount growth</li>
                <li>Assign manager relationships</li>
                <li>Manage departments and roles</li>
                <li>Export and save your work</li>
              </ul>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
