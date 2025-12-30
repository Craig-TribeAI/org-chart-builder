import { Handle, Position } from 'reactflow';
import { User, Crown, Plus } from 'lucide-react';
import './CustomNode.css';

function CustomNode({ data }) {
  const { person, department, isManager, displayName } = data;
  const isCustom = person?.isCustom || false;
  const isFutureRole = person?.isFutureRole || false;
  const startQuarter = person?.startQuarter;

  // Determine if we should show the start quarter badge
  // Show if role starts in a different quarter than Q1
  const showStartQuarter = startQuarter && startQuarter !== 'Q1' && !isCustom;

  return (
    <div
      className={`custom-node ${isCustom ? 'custom-role' : ''} ${isFutureRole ? 'future-role' : ''}`}
      style={{
        borderColor: isCustom ? '#8B5CF6' : (department?.color || '#6B7280'),
        borderLeftWidth: 4,
        borderLeftStyle: 'solid',
        opacity: isFutureRole ? 0.5 : 1
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
        {isFutureRole && (
          <div className="node-badge future-badge">Starts {startQuarter}</div>
        )}
        {showStartQuarter && !isFutureRole && (
          <div className="node-badge quarter-badge">Hired {startQuarter}</div>
        )}
        {isManager && !isCustom && (
          <div className="node-badge manager-badge">Manager</div>
        )}
      </div>


      <Handle
        type="source"
        position={Position.Bottom}
        className="node-handle node-handle-bottom"
      />
    </div>
  );
}

export default CustomNode;
