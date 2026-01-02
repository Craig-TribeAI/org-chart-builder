import { useState, useRef, useEffect } from 'react';
import { Plus, X, Search, ChevronDown } from 'lucide-react';
import { useOrgChartStore } from '../../stores/orgChartStore';
import './AddRoleForm.css';

function AddRoleForm() {
  const { departments, personNodes, addCustomRole } = useOrgChartStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedManager, setSelectedManager] = useState('');
  const [managerSearch, setManagerSearch] = useState('');
  const [isManagerDropdownOpen, setIsManagerDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsManagerDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter potential managers (anyone can be a manager)
  const filteredManagers = personNodes.filter(person => {
    const searchLower = managerSearch.toLowerCase();
    return (
      person.displayName.toLowerCase().includes(searchLower) ||
      person.roleName.toLowerCase().includes(searchLower)
    );
  });

  // Get selected manager display name
  const selectedManagerName = selectedManager
    ? personNodes.find(p => p.id === selectedManager)?.displayName || ''
    : '';

  const handleSelectManager = (managerId) => {
    setSelectedManager(managerId);
    setManagerSearch('');
    setIsManagerDropdownOpen(false);
  };

  const handleClearManager = (e) => {
    e.stopPropagation();
    setSelectedManager('');
    setManagerSearch('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!roleName.trim()) {
      alert('Please enter a role name');
      return;
    }

    if (!selectedDepartment) {
      alert('Please select a department');
      return;
    }

    const success = addCustomRole(roleName.trim(), selectedDepartment, selectedManager || null);

    if (success) {
      // Reset form
      setRoleName('');
      setSelectedDepartment('');
      setSelectedManager('');
      setManagerSearch('');
      setIsExpanded(false);
    }
  };

  const resetForm = () => {
    setIsExpanded(false);
    setRoleName('');
    setSelectedDepartment('');
    setSelectedManager('');
    setManagerSearch('');
  };

  if (!isExpanded) {
    return (
      <button className="add-role-button" onClick={() => setIsExpanded(true)}>
        <Plus size={16} />
        <span>Add Custom Role</span>
      </button>
    );
  }

  return (
    <div className="add-role-form">
      <div className="add-role-header">
        <h4>Add Custom Role</h4>
        <button
          className="close-button"
          onClick={resetForm}
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="roleName">Role Name</label>
          <input
            type="text"
            id="roleName"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="e.g., Chief of Staff, VP Sales"
            className="form-input"
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="department">Department</label>
          <select
            id="department"
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="form-select"
          >
            <option value="">Select department...</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>
                {dept.displayName}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="manager">Manager (Optional)</label>
          <div className="searchable-dropdown" ref={dropdownRef}>
            <div
              className={`dropdown-trigger ${isManagerDropdownOpen ? 'open' : ''}`}
              onClick={() => setIsManagerDropdownOpen(!isManagerDropdownOpen)}
            >
              {selectedManager ? (
                <div className="selected-manager">
                  <span>{selectedManagerName}</span>
                  <button
                    type="button"
                    className="clear-manager"
                    onClick={handleClearManager}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <span className="placeholder">Select manager...</span>
              )}
              <ChevronDown size={16} className="dropdown-icon" />
            </div>

            {isManagerDropdownOpen && (
              <div className="dropdown-menu">
                <div className="search-container">
                  <Search size={14} className="search-icon" />
                  <input
                    type="text"
                    className="manager-search"
                    placeholder="Search by name or role..."
                    value={managerSearch}
                    onChange={(e) => setManagerSearch(e.target.value)}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="dropdown-options">
                  {filteredManagers.length === 0 ? (
                    <div className="no-results">No matches found</div>
                  ) : (
                    filteredManagers.map(person => {
                      const dept = departments.find(d => d.id === person.departmentId);
                      return (
                        <div
                          key={person.id}
                          className={`dropdown-option ${selectedManager === person.id ? 'selected' : ''}`}
                          onClick={() => handleSelectManager(person.id)}
                        >
                          <div className="option-content">
                            <span
                              className="dept-indicator"
                              style={{ backgroundColor: dept?.color || '#6B7280' }}
                            />
                            <div className="option-text">
                              <span className="option-name">{person.displayName}</span>
                              <span className="option-role">{person.roleName}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="submit-button">
            <Plus size={16} />
            Add Role
          </button>
        </div>
      </form>

      <div className="form-hint">
        <p>Custom roles will appear with a purple badge on the org chart.</p>
      </div>
    </div>
  );
}

export default AddRoleForm;
