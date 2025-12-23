import { Handle, Position } from 'reactflow';
import { User, Crown, Plus, Minus } from 'lucide-react';
import { useOrgChartStore } from '../../stores/orgChartStore';
import './CustomNode.css';

function CustomNode({ data }) {
  const { person, department, isManager, displayName, roleName, isCollapsed, directReportsCount } = data;
  const { toggleNodeCollapse } = useOrgChartStore();
  const isCustom = person?.isCustom || false;

  const handleToggleCollapse = (e) => {
    e.stopPropagation();
    toggleNodeCollapse(person.id);
  };

  return (
    <div
      className={`custom-node ${isCustom ? 'custom-role' : ''}`}
      style={{
        borderColor: isCustom ? '#8B5CF6' : (department?.color || '#6B7280'),
        borderLeftWidth: 4,
        borderLeftStyle: 'solid'
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="node-handle node-handle-top"
      />

      <div className="node-header">
        <div
          className="node-icon"
          style={{
            backgroundColor: isCustom ? '#8B5CF620' : (department?.color + '20'),
            color: isCustom ? '#8B5CF6' : department?.color
          }}
        >
          {isCustom ? <Plus size={16} /> : isManager ? <Crown size={16} /> : <User size={16} />}
        </div>
        <div className="node-info">
          <div className="node-name">{displayName}</div>
          <div className="node-dept" style={{ color: isCustom ? '#8B5CF6' : department?.color }}>
            {department?.displayName}
          </div>
        </div>
      </div>

      <div className="node-badges">
        {isCustom && (
          <div className="node-badge custom-badge">Custom Role</div>
        )}
        {isManager && !isCustom && (
          <div className="node-badge manager-badge">Manager</div>
        )}
      </div>

      {isManager && (
        <button
          className="collapse-button"
          onClick={handleToggleCollapse}
          title={isCollapsed ? `Expand ${directReportsCount} direct reports` : `Collapse ${directReportsCount} direct reports`}
        >
          {isCollapsed ? (
            <>
              <Plus size={14} />
              <span>{directReportsCount}</span>
            </>
          ) : (
            <>
              <Minus size={14} />
              <span>{directReportsCount}</span>
            </>
          )}
        </button>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="node-handle node-handle-bottom"
      />
    </div>
  );
}

export default CustomNode;
