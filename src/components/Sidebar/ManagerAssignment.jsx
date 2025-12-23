import { useState } from 'react';
import { Users, X, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';
import { useOrgChartStore } from '../../stores/orgChartStore';
import './ManagerAssignment.css';

function ManagerAssignment() {
  const { personNodes, departments, setManager, removeManager, bulkSetManager, bulkRemoveManager } = useOrgChartStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeople, setSelectedPeople] = useState(new Set());
  const [bulkManagerId, setBulkManagerId] = useState('');
  const [filterDepartmentId, setFilterDepartmentId] = useState('');
  const [managerSearchTerm, setManagerSearchTerm] = useState('');

  // Get unassigned people (no manager)
  const unassignedPeople = personNodes.filter(p => !p.managerId);

  // Filter person nodes based on search and department
  const filteredNodes = personNodes.filter(node => {
    const matchesSearch = node.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         node.roleName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = !filterDepartmentId || node.departmentId === filterDepartmentId;
    return matchesSearch && matchesDept;
  });

  // Filter potential managers based on search
  const filteredManagers = personNodes
    .filter(p => !selectedPeople.has(p.id))
    .filter(p => {
      if (!managerSearchTerm) return true;
      return p.displayName.toLowerCase().includes(managerSearchTerm.toLowerCase()) ||
             p.roleName.toLowerCase().includes(managerSearchTerm.toLowerCase());
    });

  const handleAssignManager = (personId, managerId) => {
    if (managerId === '') {
      removeManager(personId);
    } else {
      setManager(personId, managerId);
    }
  };

  const togglePersonSelection = (personId) => {
    const newSelected = new Set(selectedPeople);
    if (newSelected.has(personId)) {
      newSelected.delete(personId);
    } else {
      newSelected.add(personId);
    }
    setSelectedPeople(newSelected);
  };

  const selectAll = () => {
    const allIds = new Set(filteredNodes.map(p => p.id));
    setSelectedPeople(allIds);
  };

  const deselectAll = () => {
    setSelectedPeople(new Set());
  };

  const handleBulkAssign = () => {
    if (selectedPeople.size === 0) {
      alert('Please select at least one person');
      return;
    }

    if (!bulkManagerId) {
      alert('Please select a manager');
      return;
    }

    // Assign manager to all selected people at once
    const peopleArray = Array.from(selectedPeople);
    const successCount = bulkSetManager(peopleArray, bulkManagerId);

    // Clear selections and reset
    setSelectedPeople(new Set());
    setBulkManagerId('');

    if (successCount > 0) {
      alert(`Successfully assigned manager to ${successCount} people`);
    }
  };

  const handleBulkRemove = () => {
    if (selectedPeople.size === 0) {
      alert('Please select at least one person');
      return;
    }

    if (!confirm(`Remove manager from ${selectedPeople.size} selected people?`)) {
      return;
    }

    const peopleArray = Array.from(selectedPeople);
    bulkRemoveManager(peopleArray);

    setSelectedPeople(new Set());
  };

  return (
    <div className="manager-assignment">
      <div className="manager-assignment-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="header-title">
          <Users size={16} />
          <span>Manager Assignments</span>
          {unassignedPeople.length > 0 && (
            <span className="unassigned-badge">{unassignedPeople.length} unassigned</span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {isExpanded && (
        <div className="manager-assignment-body">
          {/* Instruction Banner */}
          {selectedPeople.size === 0 && (
            <div className="instruction-banner">
              <strong>💡 Bulk Assignment:</strong> Check the boxes next to multiple people, then use the floating panel to assign a manager.
            </div>
          )}

          <div className="filter-controls">
            <input
              type="text"
              placeholder="Search people..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />

            <select
              value={filterDepartmentId}
              onChange={(e) => setFilterDepartmentId(e.target.value)}
              className="dept-filter-select"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>
                  {dept.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Selection controls */}
          {filteredNodes.length > 0 && (
            <div className="selection-controls">
              <button className="select-all-btn" onClick={selectAll}>
                <CheckSquare size={14} />
                Select All
              </button>
              {selectedPeople.size > 0 && (
                <button className="deselect-all-btn" onClick={deselectAll}>
                  <Square size={14} />
                  Deselect All
                </button>
              )}
            </div>
          )}

          <div className="person-list">
            {filteredNodes.length === 0 ? (
              <p className="no-results">No people found</p>
            ) : (
              filteredNodes.map(person => {
                const manager = personNodes.find(p => p.id === person.managerId);
                const isSelected = selectedPeople.has(person.id);

                return (
                  <div key={person.id} className={`person-item ${isSelected ? 'selected' : ''}`}>
                    <div className="person-item-header">
                      <label className="checkbox-container">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePersonSelection(person.id)}
                        />
                        <span className="person-name">{person.displayName}</span>
                      </label>
                      {person.managerId && (
                        <button
                          className="remove-manager-btn"
                          onClick={() => removeManager(person.id)}
                          title="Remove manager"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {!isSelected && (
                      <>
                        <select
                          value={person.managerId || ''}
                          onChange={(e) => handleAssignManager(person.id, e.target.value)}
                          className="manager-select"
                        >
                          <option value="">No manager (top level)</option>
                          {personNodes
                            .filter(p => p.id !== person.id)
                            .map(p => (
                              <option key={p.id} value={p.id}>
                                {p.displayName}
                              </option>
                            ))}
                        </select>

                        {manager && (
                          <div className="current-manager">
                            Reports to: <strong>{manager.displayName}</strong>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {filteredNodes.length > 50 && (
            <div className="more-results">
              Showing all {filteredNodes.length} people
            </div>
          )}
        </div>
      )}

      {/* Floating Bulk Assignment Panel */}
      {selectedPeople.size > 0 && (
        <div className="bulk-assignment-panel">
          <div className="bulk-panel-header">
            <span className="selected-count">✓ {selectedPeople.size} people selected</span>
            <button className="deselect-btn" onClick={deselectAll}>
              ✕ Clear
            </button>
          </div>

          <label className="bulk-label">
            <strong>Step 1:</strong> Search & select a manager
          </label>

          <input
            type="text"
            placeholder="Search managers..."
            value={managerSearchTerm}
            onChange={(e) => setManagerSearchTerm(e.target.value)}
            className="manager-search-input"
          />

          <select
            value={bulkManagerId}
            onChange={(e) => setBulkManagerId(e.target.value)}
            className="bulk-manager-select"
            size="8"
          >
            <option value="">-- Select a manager --</option>
            {filteredManagers.map(p => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>

          {managerSearchTerm && filteredManagers.length === 0 && (
            <div className="no-results-small">No managers found</div>
          )}

          <label className="bulk-label">
            <strong>Step 2:</strong> Apply changes
          </label>
          <div className="bulk-actions">
            <button
              className="bulk-assign-btn"
              onClick={handleBulkAssign}
              disabled={!bulkManagerId}
            >
              ✓ Assign Manager
            </button>
            <button className="bulk-remove-btn" onClick={handleBulkRemove}>
              ✕ Remove Managers
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManagerAssignment;
