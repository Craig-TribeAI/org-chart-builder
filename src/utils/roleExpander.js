/**
 * Expand role templates into individual person nodes based on headcount
 * @param {Array} roleTemplates - Array of role template objects
 * @param {string} quarter - Quarter to expand for ('Q1', 'Q2', 'Q3', 'Q4', or 'Full Year')
 * @returns {Array} Array of person node objects
 */
export function expandRoleTemplates(roleTemplates, quarter) {
  const personNodes = [];

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

    // Skip if no headcount for this quarter
    if (headcount === 0) return;

    // Determine which quarters this person is active in (for Full Year view)
    const activeInQuarters = [];
    Object.entries(template.quarters).forEach(([q, count]) => {
      if (count > 0) activeInQuarters.push(q);
    });

    // Create individual person nodes
    for (let i = 0; i < headcount; i++) {
      const personNode = {
        id: `${template.id}-person-${i}`,
        templateId: template.id,
        roleName: template.cleanName,
        displayName: headcount > 1 ? `${template.cleanName} ${i + 1}` : template.cleanName,
        department: template.department,
        departmentId: template.departmentId,
        managerId: null, // Will be set through UI
        position: { x: 0, y: 0 }, // Will be calculated by layout engine
        activeInQuarters,
        metadata: {
          originalRoleName: template.originalName,
          costPerRole: template.costPerRole,
          instanceNumber: i + 1,
          totalInstances: headcount,
          templateMetadata: template.metadata
        }
      };

      personNodes.push(personNode);
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
