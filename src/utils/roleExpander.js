/**
 * Determine the first quarter a role starts (has headcount > 0)
 * @param {Object} quarters - Object with Q1, Q2, Q3, Q4 counts
 * @returns {string} The start quarter ('Q1', 'Q2', 'Q3', 'Q4') or null
 */
function getStartQuarter(quarters) {
  const quarterOrder = ['Q1', 'Q2', 'Q3', 'Q4'];
  for (const q of quarterOrder) {
    if (quarters[q] > 0) return q;
  }
  return null;
}

/**
 * Expand role templates into individual person nodes based on headcount
 * @param {Array} roleTemplates - Array of role template objects
 * @param {string} quarter - Quarter to expand for ('Q1', 'Q2', 'Q3', 'Q4', or 'Full Year')
 * @param {Array} existingManagerIds - Optional array of manager IDs that need placeholders
 * @returns {Array} Array of person node objects
 */
export function expandRoleTemplates(roleTemplates, quarter, existingManagerIds = []) {
  const personNodes = [];
  const createdIds = new Set();

  roleTemplates.forEach(template => {
    let headcount;

    // Determine headcount for selected quarter
    if (quarter === 'Full Year') {
      // For full year, use the maximum headcount across all quarters
      headcount = Math.max(
        template.quarters.Q1,
        template.quarters.Q2,
        template.quarters.Q3,
        template.quarters.Q4
      );
    } else {
      headcount = template.quarters[quarter] || 0;
    }

    // Determine which quarters this person is active in (for Full Year view)
    const activeInQuarters = [];
    Object.entries(template.quarters).forEach(([q, count]) => {
      if (count > 0) activeInQuarters.push(q);
    });

    // Calculate start quarter for this role
    const startQuarter = getStartQuarter(template.quarters);

    // Check if this role is "future" (not yet active in current quarter)
    const quarterOrder = ['Q1', 'Q2', 'Q3', 'Q4'];
    const currentQIdx = quarterOrder.indexOf(quarter);
    const startQIdx = quarterOrder.indexOf(startQuarter);
    const isFutureRole = quarter !== 'Full Year' && startQIdx > currentQIdx;

    // Skip if no headcount for this quarter AND not needed as a manager placeholder
    if (headcount === 0) {
      // Check if any instance of this template is needed as a manager
      const neededAsManager = existingManagerIds.some(id => id && id.startsWith(template.id));
      if (!neededAsManager) return;

      // Create placeholder for future manager (use Q4 headcount as guide)
      headcount = Math.max(1, template.quarters.Q4 || 1);
    }

    // Create individual person nodes
    for (let i = 0; i < headcount; i++) {
      const nodeId = `${template.id}-person-${i}`;

      // Check if this specific node is needed as a manager placeholder
      const isNeededAsManager = existingManagerIds.includes(nodeId);
      const isCurrentlyActive = template.quarters[quarter] > i;

      // Skip if not active and not needed as manager
      if (!isCurrentlyActive && !isNeededAsManager && quarter !== 'Full Year') continue;

      const personNode = {
        id: nodeId,
        templateId: template.id,
        roleName: template.cleanName,
        displayName: headcount > 1 ? `${template.cleanName} ${i + 1}` : template.cleanName,
        department: template.department,
        departmentId: template.departmentId,
        managerId: null, // Will be set through UI
        position: { x: 0, y: 0 }, // Will be calculated by layout engine
        activeInQuarters,
        startQuarter,
        isFutureRole: !isCurrentlyActive && isNeededAsManager,
        metadata: {
          originalRoleName: template.originalName,
          costPerRole: template.costPerRole,
          instanceNumber: i + 1,
          totalInstances: headcount,
          templateMetadata: template.metadata
        }
      };

      personNodes.push(personNode);
      createdIds.add(nodeId);
    }
  });

  return personNodes;
}

/**
 * Get the maximum number of person nodes across all quarters
 * @param {Array} roleTemplates - Array of role template objects
 * @returns {Object} Object with quarter keys and total person counts
 */
export function getPersonCountsByQuarter(roleTemplates) {
  const counts = {
    Q1: 0,
    Q2: 0,
    Q3: 0,
    Q4: 0,
    'Full Year': 0
  };

  roleTemplates.forEach(template => {
    counts.Q1 += template.quarters.Q1;
    counts.Q2 += template.quarters.Q2;
    counts.Q3 += template.quarters.Q3;
    counts.Q4 += template.quarters.Q4;
  });

  // Full Year is the max headcount needed
  counts['Full Year'] = Math.max(counts.Q1, counts.Q2, counts.Q3, counts.Q4);

  return counts;
}

/**
 * Filter person nodes by specific criteria
 * @param {Array} personNodes - Array of person node objects
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered person nodes
 */
export function filterPersonNodes(personNodes, filters = {}) {
  let filtered = [...personNodes];

  // Filter by department
  if (filters.departmentId) {
    filtered = filtered.filter(node => node.departmentId === filters.departmentId);
  }

  // Filter by search text
  if (filters.searchText) {
    const searchLower = filters.searchText.toLowerCase();
    filtered = filtered.filter(node =>
      node.roleName.toLowerCase().includes(searchLower) ||
      node.displayName.toLowerCase().includes(searchLower)
    );
  }

  // Filter by unassigned manager
  if (filters.onlyUnassigned) {
    filtered = filtered.filter(node => node.managerId === null);
  }

  // Filter by has direct reports (is a manager)
  if (filters.onlyManagers) {
    const managerIds = new Set(filtered.map(n => n.managerId).filter(Boolean));
    filtered = filtered.filter(node => managerIds.has(node.id));
  }

  return filtered;
}

/**
 * Group person nodes by department
 * @param {Array} personNodes - Array of person node objects
 * @returns {Object} Object with department IDs as keys and arrays of person nodes as values
 */
export function groupPersonNodesByDepartment(personNodes) {
  const grouped = {};

  personNodes.forEach(node => {
    if (!grouped[node.departmentId]) {
      grouped[node.departmentId] = [];
    }
    grouped[node.departmentId].push(node);
  });

  return grouped;
}

/**
 * Get direct reports for a person node
 * @param {string} personId - ID of the person node
 * @param {Array} allPersonNodes - All person nodes
 * @returns {Array} Array of person nodes that report to this person
 */
export function getDirectReports(personId, allPersonNodes) {
  return allPersonNodes.filter(node => node.managerId === personId);
}

/**
 * Get the manager chain for a person node (all managers up the hierarchy)
 * @param {string} personId - ID of the person node
 * @param {Array} allPersonNodes - All person nodes
 * @returns {Array} Array of person nodes representing the management chain
 */
export function getManagerChain(personId, allPersonNodes) {
  const chain = [];
  let current = allPersonNodes.find(n => n.id === personId);

  while (current && current.managerId) {
    const manager = allPersonNodes.find(n => n.id === current.managerId);
    if (!manager) break;
    chain.push(manager);
    current = manager;

    // Prevent infinite loops
    if (chain.length > 20) break;
  }

  return chain;
}
