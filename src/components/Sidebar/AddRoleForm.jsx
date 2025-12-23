import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useOrgChartStore } from '../../stores/orgChartStore';
import './AddRoleForm.css';

function AddRoleForm() {
  const { departments, addCustomRole } = useOrgChartStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');

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

    const success = addCustomRole(roleName.trim(), selectedDepartment);

    if (success) {
      // Reset form
      setRoleName('');
      setSelectedDepartment('');
      setIsExpanded(false);
    }
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
          onClick={() => {
            setIsExpanded(false);
            setRoleName('');
            setSelectedDepartment('');
          }}
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
