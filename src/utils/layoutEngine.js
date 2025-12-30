import dagre from 'dagre';

/**
 * Calculate hierarchical layout for org chart
 * Managers are laid out horizontally, direct reports organized by role in columns
 * @param {Array} personNodes - Array of person node objects
 * @param {Array} departments - Array of department objects
 * @returns {Object} Object with person IDs as keys and {x, y} positions as values
 */
export function calculateHierarchicalLayout(personNodes, departments) {
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 100;
  const HORIZONTAL_GAP = 20;      // Gap between columns
  const VERTICAL_GAP = 15;        // Gap between stacked reports
  const LEVEL_GAP = 40;           // Gap between hierarchy levels

  const positions = {};

  // Build lookup maps
  const nodeMap = new Map(personNodes.map(p => [p.id, p]));
  const childrenMap = new Map();

  personNodes.forEach(p => {
    if (p.managerId) {
      if (!childrenMap.has(p.managerId)) {
        childrenMap.set(p.managerId, []);
      }
      childrenMap.get(p.managerId).push(p);
    }
  });

  // Find root nodes (no manager, or manager not in our set)
  const rootNodes = personNodes.filter(p => !p.managerId || !nodeMap.has(p.managerId));

  // Separate true roots (managers with reports) from unassigned leaf nodes
  const managerIds = new Set(personNodes.filter(p => p.managerId).map(p => p.managerId));
  const trueRoots = rootNodes.filter(p => managerIds.has(p.id));
  const unassignedLeaves = rootNodes.filter(p => !managerIds.has(p.id));

  /**
   * Group children by their role (templateId)
   */
  function groupChildrenByRole(children) {
    const groups = new Map();
    children.forEach(child => {
      const roleKey = child.templateId || child.id; // Use templateId or id for custom roles
      if (!groups.has(roleKey)) {
        groups.set(roleKey, []);
      }
      groups.get(roleKey).push(child);
    });
    return Array.from(groups.values());
  }

  /**
   * Calculate the width needed for a subtree
   */
  function getSubtreeWidth(nodeId) {
    const children = childrenMap.get(nodeId) || [];
    if (children.length === 0) {
      return NODE_WIDTH;
    }

    // Check if children are managers (have their own reports)
    const childrenAreManagers = children.some(c =>
      childrenMap.has(c.id) && childrenMap.get(c.id).length > 0
    );

    if (childrenAreManagers) {
      // Children spread horizontally - sum their widths
      let totalWidth = 0;
      children.forEach((child, i) => {
        totalWidth += getSubtreeWidth(child.id);
        if (i < children.length - 1) totalWidth += HORIZONTAL_GAP;
      });
      return Math.max(NODE_WIDTH, totalWidth);
    } else {
      // Children are leaf nodes - group by role, each role gets a column
      const roleGroups = groupChildrenByRole(children);
      const numColumns = roleGroups.length;
      return Math.max(NODE_WIDTH, numColumns * NODE_WIDTH + (numColumns - 1) * HORIZONTAL_GAP);
    }
  }

  /**
   * Layout a subtree starting at given position
   * Returns the actual width used
   */
  function layoutSubtree(nodeId, startX, startY) {
    const children = childrenMap.get(nodeId) || [];
    const subtreeWidth = getSubtreeWidth(nodeId);

    // Center this node over its subtree
    const nodeX = startX + (subtreeWidth - NODE_WIDTH) / 2;
    positions[nodeId] = { x: nodeX, y: startY };

    if (children.length === 0) {
      return subtreeWidth;
    }

    // Check if children are managers
    const childrenAreManagers = children.some(c =>
      childrenMap.has(c.id) && childrenMap.get(c.id).length > 0
    );

    const childY = startY + NODE_HEIGHT + LEVEL_GAP;

    if (childrenAreManagers) {
      // Layout children horizontally
      let currentX = startX;
      children.forEach((child) => {
        const childWidth = layoutSubtree(child.id, currentX, childY);
        currentX += childWidth + HORIZONTAL_GAP;
      });
    } else {
      // Group children by role and create columns
      const roleGroups = groupChildrenByRole(children);
      let currentX = startX;

      roleGroups.forEach((group) => {
        // Stack this role's instances vertically
        let currentY = childY;
        group.forEach((child) => {
          positions[child.id] = { x: currentX, y: currentY };
          currentY += NODE_HEIGHT + VERTICAL_GAP;
        });
        currentX += NODE_WIDTH + HORIZONTAL_GAP;
      });
    }

    return subtreeWidth;
  }

  let currentX = 50;
  let currentY = 50;

  // First, layout unassigned leaf nodes at the top in a grid
  if (unassignedLeaves.length > 0) {
    const COLS = 6;
    unassignedLeaves.forEach((person, index) => {
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      positions[person.id] = {
        x: currentX + col * (NODE_WIDTH + HORIZONTAL_GAP),
        y: currentY + row * (NODE_HEIGHT + VERTICAL_GAP)
      };
    });
    const rows = Math.ceil(unassignedLeaves.length / COLS);
    currentY += rows * (NODE_HEIGHT + VERTICAL_GAP) + LEVEL_GAP;
  }

  // Layout each root's subtree horizontally
  trueRoots.forEach((root) => {
    const width = layoutSubtree(root.id, currentX, currentY);
    currentX += width + HORIZONTAL_GAP * 2;
  });

  return positions;
}

/**
 * Calculate simple grid layout for nodes without hierarchy
 * @param {Array} personNodes - Array of person node objects
 * @param {Array} departments - Array of department objects
 * @returns {Object} Object with person IDs as keys and {x, y} positions as values
 */
export function calculateGridLayout(personNodes, departments) {
  const positions = {};
  const COLS = 4;
  const NODE_SPACING_X = 240;
  const NODE_SPACING_Y = 120;
  const DEPT_SPACING_Y = 180;

  let currentY = 0;

  // Group nodes by department
  departments.forEach(dept => {
    const deptNodes = personNodes.filter(p => p.departmentId === dept.id);

    if (deptNodes.length === 0) return;

    // Layout nodes in grid
    deptNodes.forEach((person, index) => {
      const col = index % COLS;
      const row = Math.floor(index / COLS);

      positions[person.id] = {
        x: col * NODE_SPACING_X,
        y: currentY + (row * NODE_SPACING_Y)
      };
    });

    // Move to next department
    const rows = Math.ceil(deptNodes.length / COLS);
    currentY += (rows * NODE_SPACING_Y) + DEPT_SPACING_Y;
  });

  return positions;
}

/**
 * Calculate layout positions for all person nodes
 * Uses hierarchical layout if manager relationships exist, otherwise grid layout
 * @param {Array} personNodes - Array of person node objects
 * @param {Array} departments - Array of department objects
 * @returns {Object} Object with person IDs as keys and {x, y} positions as values
 */
export function calculateLayout(personNodes, departments) {
  // Check if any person has a manager assigned
  const hasHierarchy = personNodes.some(p => p.managerId !== null);

  if (hasHierarchy) {
    return calculateHierarchicalLayout(personNodes, departments);
  } else {
    return calculateGridLayout(personNodes, departments);
  }
}
