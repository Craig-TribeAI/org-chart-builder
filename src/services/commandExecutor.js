/**
 * Command executor - maps parsed commands to org chart store actions
 */

import { useOrgChartStore } from '../stores/orgChartStore';

/**
 * Execute a parsed command against the org chart store
 * @param {Object} command - The parsed command object from Claude
 * @returns {Object} Result with success status and message
 */
export function executeCommand(command) {
  const store = useOrgChartStore.getState();
  const { type, params } = command;

  try {
    switch (type) {
      case 'ADD_ROLE': {
        const { roleName, departmentId, managerId } = params;
        const success = store.addCustomRole(roleName, departmentId, managerId || null);
        return {
          success,
          message: success
            ? `Created new role: ${roleName}`
            : 'Failed to create role. Check department ID and manager ID.'
        };
      }

      case 'ADD_MULTIPLE_ROLES': {
        const { roles } = params;
        const results = [];
        let createdIds = [];

        for (const role of roles) {
          // If role references a manager from a previous role in this batch,
          // we need to find the ID that was just created
          let managerId = role.managerId;

          // Handle case where managerId is a placeholder like "new_manager_1"
          if (managerId && managerId.startsWith('new_manager_')) {
            const managerIndex = parseInt(managerId.split('_').pop()) - 1;
            if (createdIds[managerIndex]) {
              managerId = createdIds[managerIndex];
            }
          }

          const success = store.addCustomRole(role.roleName, role.departmentId, managerId || null);
          results.push({ roleName: role.roleName, success });

          // Track the ID of the newly created role for subsequent roles
          if (success) {
            const { personNodes } = useOrgChartStore.getState();
            const newNode = personNodes.find(
              p => p.roleName === role.roleName && p.isCustom
            );
            if (newNode) {
              createdIds.push(newNode.id);
            }
          }
        }

        const successCount = results.filter(r => r.success).length;
        return {
          success: successCount > 0,
          message: `Created ${successCount} of ${roles.length} roles`
        };
      }

      case 'DELETE_ROLE': {
        const { personIds } = params;
        let successCount = 0;
        let failCount = 0;
        const errors = [];

        for (const personId of personIds) {
          const success = store.deletePersonNode(personId);
          if (success) {
            successCount++;
          } else {
            failCount++;
            // Check if it's because the node isn't custom
            const { personNodes } = useOrgChartStore.getState();
            const node = personNodes.find(p => p.id === personId);
            if (node && !node.isCustom) {
              errors.push(`${node.displayName} is from CSV data and cannot be deleted`);
            }
          }
        }

        return {
          success: successCount > 0,
          message: successCount > 0
            ? `Deleted ${successCount} role(s)${failCount > 0 ? `. ${failCount} could not be deleted.` : ''}`
            : `Could not delete roles. ${errors.join('. ')}`
        };
      }

      case 'SET_MANAGER': {
        const { personId, managerId } = params;
        const success = store.setManager(personId, managerId);
        return {
          success,
          message: success
            ? 'Manager assignment updated'
            : 'Failed to set manager. Check for circular references.'
        };
      }

      case 'BULK_SET_MANAGER': {
        const { personIds, managerId } = params;
        const count = store.bulkSetManager(personIds, managerId);
        return {
          success: count > 0,
          message: count > 0
            ? `Assigned manager to ${count} people`
            : 'Failed to assign manager. Check for circular references.'
        };
      }

      case 'REMOVE_MANAGER': {
        const { personId } = params;
        store.removeManager(personId);
        return {
          success: true,
          message: 'Manager assignment removed'
        };
      }

      case 'BULK_REMOVE_MANAGER': {
        const { personIds } = params;
        store.bulkRemoveManager(personIds);
        return {
          success: true,
          message: `Removed manager from ${personIds.length} people`
        };
      }

      default:
        return {
          success: false,
          message: `Unknown command type: ${type}`
        };
    }
  } catch (error) {
    console.error('Command execution error:', error);
    return {
      success: false,
      message: `Execution error: ${error.message}`
    };
  }
}

/**
 * Get a preview of what the command will do without executing
 * @param {Object} command - The parsed command object
 * @returns {Object} Preview information
 */
export function getCommandPreview(command) {
  const store = useOrgChartStore.getState();
  const { personNodes, departments } = store;
  const { type, params, description, isDestructive, affectedCount } = command;

  const preview = {
    type,
    description,
    isDestructive: isDestructive || false,
    affectedCount: affectedCount || 0,
    details: []
  };

  switch (type) {
    case 'ADD_ROLE': {
      const dept = departments.find(d => d.id === params.departmentId);
      const manager = params.managerId
        ? personNodes.find(p => p.id === params.managerId)
        : null;

      preview.details.push(`Role: ${params.roleName}`);
      preview.details.push(`Department: ${dept?.displayName || dept?.name || params.departmentId}`);
      if (manager) {
        preview.details.push(`Reports to: ${manager.displayName}`);
      }
      break;
    }

    case 'ADD_MULTIPLE_ROLES': {
      const { roles } = params;
      preview.affectedCount = roles.length;
      roles.forEach((role, index) => {
        const dept = departments.find(d => d.id === role.departmentId);
        preview.details.push(`${index + 1}. ${role.roleName} (${dept?.displayName || dept?.name || role.departmentId})`);
      });
      break;
    }

    case 'DELETE_ROLE': {
      const { personIds } = params;
      preview.affectedCount = personIds.length;
      personIds.forEach(id => {
        const person = personNodes.find(p => p.id === id);
        if (person) {
          const canDelete = person.isCustom;
          preview.details.push(
            `${person.displayName} (${person.department})${!canDelete ? ' - CANNOT DELETE (from CSV)' : ''}`
          );
        }
      });
      break;
    }

    case 'SET_MANAGER':
    case 'BULK_SET_MANAGER': {
      const ids = type === 'SET_MANAGER' ? [params.personId] : params.personIds;
      const manager = personNodes.find(p => p.id === params.managerId);
      preview.affectedCount = ids.length;
      preview.details.push(`New manager: ${manager?.displayName || params.managerId}`);
      preview.details.push('People to reassign:');
      ids.slice(0, 10).forEach(id => {
        const person = personNodes.find(p => p.id === id);
        if (person) {
          preview.details.push(`  - ${person.displayName}`);
        }
      });
      if (ids.length > 10) {
        preview.details.push(`  ... and ${ids.length - 10} more`);
      }
      break;
    }

    case 'REMOVE_MANAGER':
    case 'BULK_REMOVE_MANAGER': {
      const ids = type === 'REMOVE_MANAGER' ? [params.personId] : params.personIds;
      preview.affectedCount = ids.length;
      preview.details.push('People to unassign:');
      ids.slice(0, 10).forEach(id => {
        const person = personNodes.find(p => p.id === id);
        if (person) {
          const currentManager = personNodes.find(p => p.id === person.managerId);
          preview.details.push(
            `  - ${person.displayName}${currentManager ? ` (currently reports to ${currentManager.displayName})` : ''}`
          );
        }
      });
      if (ids.length > 10) {
        preview.details.push(`  ... and ${ids.length - 10} more`);
      }
      break;
    }
  }

  return preview;
}
