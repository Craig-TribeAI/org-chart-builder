import { Upload } from 'lucide-react';
import './FileUpload.css';

function FileUpload({ onFileSelect, isLoading }) {
  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      onFileSelect(file);
    } else if (file) {
      alert('Please select a valid CSV file');
    }
  };

  return (
    <div className="file-upload">
      <input
        type="file"
        id="csv-upload"
        accept=".csv"
        onChange={handleFileChange}
        disabled={isLoading}
        style={{ display: 'none' }}
      />
      <label htmlFor="csv-upload" className={`upload-button ${isLoading ? 'loading' : ''}`}>
        <Upload size={18} />
        <span>{isLoading ? 'Loading...' : 'Upload CSV'}</span>
      </label>
    </div>
  );
}

export default FileUpload;
