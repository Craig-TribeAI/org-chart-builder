import { useEffect, useState } from 'react';
import Login from './components/Login/Login';
import Header from './components/Header/Header';
import Sidebar from './components/Sidebar/Sidebar';
import OrgChart from './components/OrgChart/OrgChart';
import { useOrgChartStore } from './stores/orgChartStore';
import './App.css';

function App() {
  const { csvFileName, importFromJSON, isLoading } = useOrgChartStore();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is already authenticated
  useEffect(() => {
    const authStatus = sessionStorage.getItem('isAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Auto-load default JSON on mount if not already loaded
  useEffect(() => {
    const loadDefaultData = async () => {
      // Only load if we don't already have data
      if (!csvFileName) {
        try {
          const response = await fetch('/org-chart-import.json');
          const jsonData = await response.json();
          importFromJSON(jsonData);
        } catch (error) {
          console.error('Failed to load default data:', error);
        }
      }
    };

    loadDefaultData();
  }, [csvFileName, importFromJSON]);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <Header />

      <div className="app-body">
        <Sidebar />

        <main className="main-content">
          {isLoading ? (
            <div className="welcome">
              <h2>Loading...</h2>
              <p>Loading org chart data...</p>
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
