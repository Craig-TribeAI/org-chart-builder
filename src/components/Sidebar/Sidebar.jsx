import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import QuarterSelector from './QuarterSelector';
import ManagerAssignment from './ManagerAssignment';
import AddRoleForm from './AddRoleForm';
import ManagerBreakdown from '../Modals/ManagerBreakdown';
import { useOrgChartStore } from '../../stores/orgChartStore';
import './Sidebar.css';

function Sidebar() {
  const { csvFileName, roleTemplates, personNodes, departments } = useOrgChartStore();
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (!csvFileName) {
    return (
      <aside className="sidebar">
        <div className="sidebar-content">
          <h3>Controls</h3>
          <p className="sidebar-placeholder">Upload a CSV file to get started</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-content">
        <h3>Controls</h3>

        <QuarterSelector />

        <AddRoleForm />

        <div className="sidebar-section">
          <h4>Departments</h4>
          <div className="department-list">
            {departments.map(dept => {
              const deptPeople = personNodes.filter(p => p.departmentId === dept.id);
              return (
                <div key={dept.id} className="department-item">
                  <div
                    className="department-color"
                    style={{ backgroundColor: dept.color }}
                  ></div>
                  <span className="department-name">{dept.displayName}</span>
                  <span className="department-count">{deptPeople.length}</span>
                </div>
              );
            })}
          </div>
        </div>

        <ManagerAssignment />

        <button className="breakdown-button" onClick={() => setShowBreakdown(true)}>
          <BarChart3 size={16} />
          <span>View Manager Breakdown</span>
        </button>
      </div>

      <ManagerBreakdown isOpen={showBreakdown} onClose={() => setShowBreakdown(false)} />
    </aside>
  );
}

export default Sidebar;
