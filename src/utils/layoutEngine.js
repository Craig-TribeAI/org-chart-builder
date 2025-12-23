import dagre from 'dagre';

/**
 * Calculate hierarchical layout for org chart using Dagre
 * @param {Array} personNodes - Array of person node objects
 * @param {Array} departments - Array of department objects
 * @returns {Object} Object with person IDs as keys and {x, y} positions as values
 */
export function calculateHierarchicalLayout(personNodes, departments) {
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 90;
  const NODE_SPACING_X = 260;
  const NODE_SPACING_Y = 140;

  const positions = {};

  // Separate nodes into those with managers (hierarchy) and without (unassigned)
  const nodesWithManagers = personNodes.filter(p => p.managerId);
  const unassignedNodes = personNodes.filter(p => !p.managerId);

  // Find all people who ARE managers (have direct reports)
  const managerIds = new Set(nodesWithManagers.map(p => p.managerId));

  // Separate unassigned into those who are managers vs not
  const unassignedManagers = unassignedNodes.filter(p => managerIds.has(p.id));
  const unassignedNonManagers = unassignedNodes.filter(p => !managerIds.has(p.id));

  let currentY = 50;

  // FIRST: Layout unassigned people at the TOP
  if (unassignedNonManagers.length > 0) {
    // Group by department
    const byDept = {};
    unassignedNonManagers.forEach(person => {
      if (!byDept[person.departmentId]) {
        byDept[person.departmentId] = [];
      }
      byDept[person.departmentId].push(person);
    });

    let deptIndex = 0;
    departments.forEach(dept => {
      if (byDept[dept.id] && byDept[dept.id].length > 0) {
        const deptNodes = byDept[dept.id];
        deptNodes.forEach((person, index) => {
          positions[person.id] = {
            x: 100 + (index * NODE_SPACING_X),
            y: currentY
          };
        });
        currentY += NODE_SPACING_Y;
        deptIndex++;
      }
    });

    currentY += 50; // Extra spacing after unassigned
  }

  // SECOND: Layout the hierarchy using Dagre
  if (nodesWithManagers.length > 0 || unassignedManagers.length > 0) {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    dagreGraph.setGraph({
      rankdir: 'TB',
      nodesep: 80,
      ranksep: 120,
      marginx: 40,
      marginy: 40,
      ranker: 'tight-tree'
    });

    // Add ALL nodes that are part of the hierarchy
    const hierarchyNodes = [...nodesWithManagers];
    unassignedManagers.forEach(p => {
      if (!hierarchyNodes.find(n => n.id === p.id)) {
        hierarchyNodes.push(p);
      }
    });

    hierarchyNodes.forEach(person => {
      dagreGraph.setNode(person.id, {
        width: NODE_WIDTH,
        height: NODE_HEIGHT
      });
    });

    // Add edges
    nodesWithManagers.forEach(person => {
      if (person.managerId && hierarchyNodes.some(n => n.id === person.managerId)) {
        dagreGraph.setEdge(person.managerId, person.id);
      }
    });

    // Calculate layout
    dagre.layout(dagreGraph);

    // Extract positions and offset by currentY
    hierarchyNodes.forEach(person => {
      if (dagreGraph.hasNode(person.id)) {
        const node = dagreGraph.node(person.id);
        positions[person.id] = {
          x: node.x - NODE_WIDTH / 2,
          y: (node.y - NODE_HEIGHT / 2) + currentY
        };
      }
    });
  }

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
