/**
 * Builds context from the org chart store for Claude command interpretation
 */

/**
 * Get a summary of roles and their counts
 * @param {Array} personNodes - Array of person nodes
 * @returns {Array} Role summary with name and count
 */
export function getRoleSummary(personNodes) {
  const roleCounts = {};

  personNodes.forEach(node => {
    const roleName = node.roleName;
    if (!roleCounts[roleName]) {
      roleCounts[roleName] = { roleName, count: 0, ids: [] };
    }
    roleCounts[roleName].count++;
    roleCounts[roleName].ids.push(node.id);
  });

  return Object.values(roleCounts).sort((a, b) => b.count - a.count);
}

/**
 * Build a map of managers and their direct reports by department
 * @param {Array} personNodes - Array of person nodes
 * @param {Object} managerAssignments - Map of personId -> managerId
 * @returns {Object} Manager hierarchy information
 */
export function buildManagerHierarchy(personNodes, managerAssignments) {
  // Build a map of managerId -> list of direct reports
  const managerToReports = {};

  // Track who has direct reports (these are managers)
  Object.entries(managerAssignments).forEach(([personId, managerId]) => {
    if (!managerToReports[managerId]) {
      managerToReports[managerId] = [];
    }
    const person = personNodes.find(p => p.id === personId);
    if (person) {
      managerToReports[managerId].push({
        id: person.id,
        name: person.displayName,
        role: person.roleName,
        department: person.department
      });
    }
  });

  // Build manager info with their teams
  const managers = [];
  Object.entries(managerToReports).forEach(([managerId, reports]) => {
    const manager = personNodes.find(p => p.id === managerId);
    if (manager) {
      // Group reports by role
      const roleGroups = {};
      reports.forEach(r => {
        if (!roleGroups[r.role]) {
          roleGroups[r.role] = 0;
        }
        roleGroups[r.role]++;
      });

      managers.push({
        id: manager.id,
        name: manager.displayName,
        role: manager.roleName,
        department: manager.department,
        directReportCount: reports.length,
        reportsByRole: roleGroups
      });
    }
  });

  // Sort by number of direct reports (most active managers first)
  return managers.sort((a, b) => b.directReportCount - a.directReportCount);
}

/**
 * Get department managers - people who manage others in each department
 * @param {Array} personNodes - Array of person nodes
 * @param {Object} managerAssignments - Map of personId -> managerId
 * @returns {Object} Map of departmentId -> array of managers
 */
export function getDepartmentManagers(personNodes, managerAssignments) {
  const deptManagers = {};

  // Find who manages people in each department
  Object.entries(managerAssignments).forEach(([personId, managerId]) => {
    const person = personNodes.find(p => p.id === personId);
    const manager = personNodes.find(p => p.id === managerId);

    if (person && manager) {
      const dept = person.department;
      if (!deptManagers[dept]) {
        deptManagers[dept] = {};
      }
      if (!deptManagers[dept][managerId]) {
        deptManagers[dept][managerId] = {
          id: manager.id,
          name: manager.displayName,
          role: manager.roleName,
          department: manager.department,
          managesInDept: 0
        };
      }
      deptManagers[dept][managerId].managesInDept++;
    }
  });

  // Convert to sorted arrays
  const result = {};
  Object.entries(deptManagers).forEach(([dept, managers]) => {
    result[dept] = Object.values(managers).sort((a, b) => b.managesInDept - a.managesInDept);
  });

  return result;
}

/**
 * Format person nodes for Claude context (limited to avoid token overflow)
 * @param {Array} personNodes - Array of person nodes
 * @param {number} limit - Max number of nodes to include
 * @returns {string} Formatted person nodes
 */
export function formatPersonNodes(personNodes, limit = 100) {
  const nodes = personNodes.slice(0, limit);

  const formatted = nodes.map(p =>
    `- ${p.displayName} (id: "${p.id}", role: "${p.roleName}", dept: "${p.department}", manager: ${p.managerId ? `"${p.managerId}"` : 'none'}, isCustom: ${p.isCustom || false})`
  ).join('\n');

  if (personNodes.length > limit) {
    return `${formatted}\n... and ${personNodes.length - limit} more people`;
  }

  return formatted;
}

/**
 * Format departments for Claude context
 * @param {Array} departments - Array of department objects
 * @returns {string} Formatted departments
 */
export function formatDepartments(departments) {
  return departments.map(d =>
    `- ${d.displayName || d.name} (id: "${d.id}")`
  ).join('\n');
}

/**
 * Build the complete context object for Claude
 * @param {Object} store - The org chart store state
 * @returns {Object} Context object with all relevant information
 */
export function buildOrgChartContext(store) {
  const { departments, personNodes, selectedQuarter, managerAssignments } = store;

  const roleSummary = getRoleSummary(personNodes);
  const managerHierarchy = buildManagerHierarchy(personNodes, managerAssignments);
  const departmentManagers = getDepartmentManagers(personNodes, managerAssignments);

  return {
    departments,
    personNodes,
    selectedQuarter,
    managerAssignments,
    roleSummary,
    managerHierarchy,
    departmentManagers,
    stats: {
      totalPeople: personNodes.length,
      totalDepartments: departments.length,
      totalRoles: roleSummary.length,
      assignedManagers: Object.keys(managerAssignments).length
    }
  };
}

/**
 * Format manager hierarchy for Claude context
 * @param {Array} managerHierarchy - Array of manager info objects
 * @param {number} limit - Max number of managers to include
 * @returns {string} Formatted manager hierarchy
 */
function formatManagerHierarchy(managerHierarchy, limit = 30) {
  const managers = managerHierarchy.slice(0, limit);

  const formatted = managers.map(m => {
    const roleBreakdown = Object.entries(m.reportsByRole)
      .map(([role, count]) => `${count} ${role}`)
      .join(', ');
    return `- ${m.name} (id: "${m.id}", role: "${m.role}", dept: "${m.department}") manages ${m.directReportCount} people: ${roleBreakdown}`;
  }).join('\n');

  if (managerHierarchy.length > limit) {
    return `${formatted}\n... and ${managerHierarchy.length - limit} more managers`;
  }

  return formatted;
}

/**
 * Format department managers for Claude context
 * @param {Object} departmentManagers - Map of dept -> managers
 * @returns {string} Formatted department managers
 */
function formatDepartmentManagers(departmentManagers) {
  return Object.entries(departmentManagers).map(([dept, managers]) => {
    const topManagers = managers.slice(0, 3);
    const managerList = topManagers.map(m =>
      `${m.name} (id: "${m.id}", manages ${m.managesInDept} in dept)`
    ).join(', ');
    return `- ${dept}: ${managerList}`;
  }).join('\n');
}

/**
 * Build the user prompt with org chart context
 * @param {string} command - The user's text command
 * @param {Object} context - The org chart context
 * @returns {string} Formatted user prompt
 */
export function buildUserPrompt(command, context) {
  const { departments, personNodes, roleSummary, stats, selectedQuarter, managerHierarchy, departmentManagers } = context;

  return `Current org chart state (Quarter: ${selectedQuarter}):

Departments:
${formatDepartments(departments)}

People (${stats.totalPeople} total):
${formatPersonNodes(personNodes)}

Role summary:
${roleSummary.map(r => `- ${r.roleName}: ${r.count} people`).join('\n')}

Manager hierarchy (who manages whom):
${formatManagerHierarchy(managerHierarchy)}

Department managers (who manages people in each department):
${formatDepartmentManagers(departmentManagers)}

Stats:
- Total people: ${stats.totalPeople}
- Total departments: ${stats.totalDepartments}
- People with managers assigned: ${stats.assignedManagers}

User command: "${command}"

Parse this command and return the structured JSON response.`;
}
