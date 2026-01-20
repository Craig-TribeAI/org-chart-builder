import { X, AlertTriangle, Check, Loader2, Plus, Trash2, UserPlus, UserMinus } from 'lucide-react';

/**
 * Get icon for command type
 */
function getCommandIcon(type) {
  switch (type) {
    case 'ADD_ROLE':
    case 'ADD_MULTIPLE_ROLES':
      return <Plus size={20} />;
    case 'DELETE_ROLE':
      return <Trash2 size={20} />;
    case 'SET_MANAGER':
    case 'BULK_SET_MANAGER':
      return <UserPlus size={20} />;
    case 'REMOVE_MANAGER':
    case 'BULK_REMOVE_MANAGER':
      return <UserMinus size={20} />;
    default:
      return <Check size={20} />;
  }
}

/**
 * CommandPreview - Modal for previewing and confirming commands
 */
function CommandPreview({
  isOpen,
  preview,
  isExecuting,
  onConfirm,
  onCancel
}) {
  if (!isOpen || !preview) return null;

  const { type, description, isDestructive, affectedCount, details } = preview;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className={`modal-content command-preview-modal ${isDestructive ? 'destructive' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">
            <div className={`command-icon ${isDestructive ? 'destructive' : 'safe'}`}>
              {getCommandIcon(type)}
            </div>
            <h2>Confirm Action</h2>
          </div>
          <button className="modal-close" onClick={onCancel} disabled={isExecuting}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {isDestructive && (
            <div className="warning-banner">
              <AlertTriangle size={20} />
              <span>This action cannot be undone</span>
            </div>
          )}

          <div className="command-description">
            <p>{description}</p>
            {affectedCount > 0 && (
              <span className="affected-count">
                {affectedCount} {affectedCount === 1 ? 'person' : 'people'} affected
              </span>
            )}
          </div>

          {details && details.length > 0 && (
            <div className="command-details">
              <h4>Details</h4>
              <ul>
                {details.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="cancel-button"
            onClick={onCancel}
            disabled={isExecuting}
          >
            Cancel
          </button>
          <button
            className={`confirm-button ${isDestructive ? 'destructive' : ''}`}
            onClick={onConfirm}
            disabled={isExecuting}
          >
            {isExecuting ? (
              <>
                <Loader2 size={16} className="spin" />
                <span>Executing...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>{isDestructive ? 'Confirm Delete' : 'Confirm'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CommandPreview;
