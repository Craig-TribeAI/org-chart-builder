import { X, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { useOrgChartStore } from '../../stores/orgChartStore';
import './ManagerBreakdown.css';

function ManagerBreakdown({ isOpen, onClose }) {
  const { personNodes, departments } = useOrgChartStore();

  if (!isOpen) return null;

  // Calculate manager breakdown
  const managerData = [];
  const peopleWithManagers = new Set();

  personNodes.forEach(person => {
    if (person.managerId) {
      peopleWithManagers.add(person.id);
    }
  });

  // Find all managers (people who have direct reports)
  const managers = personNodes.filter(person => {
    return personNodes.some(p => p.managerId === person.id);
  });

  managers.forEach(manager => {
    const directReports = personNodes.filter(p => p.managerId === manager.id);
    const dept = departments.find(d => d.id === manager.departmentId);

    managerData.push({
      manager,
      department: dept,
      directReports,
      reportCount: directReports.length
    });
  });

  // Sort by report count (descending)
  managerData.sort((a, b) => b.reportCount - a.reportCount);

  // Calculate stats
  const totalManagers = managerData.length;
  const totalReports = managerData.reduce((sum, m) => sum + m.reportCount, 0);
  const avgSpanOfControl = totalManagers > 0 ? (totalReports / totalManagers).toFixed(1) : 0;
  const maxSpan = managerData.length > 0 ? managerData[0].reportCount : 0;
  const unassignedCount = personNodes.filter(p => !p.managerId && !peopleWithManagers.has(p.id)).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content manager-breakdown-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Users size={24} />
            <h2>Manager Breakdown</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Summary Stats */}
          <div className="breakdown-stats">
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}>
                <Users size={20} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Total Managers</span>
                <span className="stat-value">{totalManagers}</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>
                <TrendingUp size={20} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Avg Span of Control</span>
                <span className="stat-value">{avgSpanOfControl}</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                <TrendingUp size={20} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Max Direct Reports</span>
                <span className="stat-value">{maxSpan}</span>
              </div>
            </div>

            {unassignedCount > 0 && (
              <div className="stat-card">
                <div className="stat-icon" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                  <AlertCircle size={20} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Unassigned</span>
                  <span className="stat-value">{unassignedCount}</span>
                </div>
              </div>
            )}
          </div>

          {/* Manager List */}
          <div className="manager-list">
            {managerData.length === 0 ? (
              <div className="no-managers">
                <AlertCircle size={48} />
                <p>No managers assigned yet</p>
                <p className="hint">Assign managers to people to see the breakdown here.</p>
              </div>
            ) : (
              managerData.map(({ manager, department, directReports, reportCount }) => (
                <div key={manager.id} className="manager-card">
                  <div className="manager-info">
                    <div className="manager-header">
                      <div className="manager-name-section">
                        <span
                          className="dept-indicator"
                          style={{ backgroundColor: department?.color }}
                        ></span>
                        <div>
                          <h3>{manager.displayName}</h3>
                          <span className="manager-dept">{department?.displayName}</span>
                        </div>
                      </div>
                      <div className="report-count-badge">
                        <Users size={16} />
                        <span>{reportCount}</span>
                      </div>
                    </div>

                    <div className="direct-reports">
                      <h4>Direct Reports ({reportCount}):</h4>
                      <div className="reports-grid">
                        {directReports.map(report => {
                          const reportDept = departments.find(d => d.id === report.departmentId);
                          return (
                            <div key={report.id} className="report-item">
                              <span
                                className="report-dept-dot"
                                style={{ backgroundColor: reportDept?.color }}
                              ></span>
                              <span className="report-name">{report.displayName}</span>
                              {report.isCustom && (
                                <span className="custom-indicator">Custom</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="close-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ManagerBreakdown;
