import { Users, Calendar, Download, Upload, RotateCcw } from 'lucide-react';
import { useOrgChartStore } from '../../stores/orgChartStore';
import CommandInput from '../CommandInput/CommandInput';
import './Header.css';

function Header() {
  const {
    csvFileName,
    personNodes,
    selectedQuarter,
    exportToJSON,
    importFromJSON,
    error
  } = useOrgChartStore();

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset? This will clear all changes and reload the default data.')) {
      localStorage.removeItem('org-chart-storage');
      window.location.reload();
    }
  };

  const handleExport = () => {
    const data = useOrgChartStore.getState().exportToJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `org-chart-${selectedQuarter}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const jsonData = JSON.parse(text);

        const success = importFromJSON(jsonData);
        if (success) {
          alert('Data imported successfully!');
        } else {
          alert('Failed to import data. Please check the file format.');
        }
      } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import data: ' + error.message);
      }
    };
    input.click();
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <h1>Org Chart Builder</h1>
          <span className="header-subtitle">2026 Growth Planning</span>
        </div>

        <div className="header-center">
          {csvFileName && (
            <>
              <div className="header-info">
                <Users size={16} />
                <span>{personNodes.length} people</span>
              </div>
              <div className="header-divider"></div>
              <div className="header-info">
                <Calendar size={16} />
                <span>{selectedQuarter}</span>
              </div>
            </>
          )}
        </div>

        <div className="header-right">
          {csvFileName && (
            <>
              <CommandInput />

              <button className="import-button" onClick={handleImport} title="Import saved data">
                <Upload size={18} />
                <span>Import</span>
              </button>

              <button className="export-button" onClick={handleExport}>
                <Download size={18} />
                <span>Export</span>
              </button>

              <button className="reset-button" onClick={handleReset} title="Reset to default data">
                <RotateCcw size={18} />
                <span>Reset</span>
              </button>
            </>
          )}

        </div>
      </div>

      {error && (
        <div className="header-error">
          <span>{error}</span>
          <button onClick={() => useOrgChartStore.getState().clearError()}>✕</button>
        </div>
      )}
    </header>
  );
}

export default Header;
