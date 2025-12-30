import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { parseOrgChartCSV } from '../utils/csvParser';
import { expandRoleTemplates } from '../utils/roleExpander';
import { calculateLayout } from '../utils/layoutEngine';

/**
 * Check if assigning a manager would create a circular reference
 */
function wouldCreateCircular(personId, newManagerId, allPersonNodes) {
  if (!newManagerId || personId === newManagerId) return true;

  // Walk up the tree from newManagerId
  let current = newManagerId;
  const visited = new Set();

  while (current) {
    if (current === personId) return true; // Circular!
    if (visited.has(current)) return true; // Loop detected
    visited.add(current);

    const person = allPersonNodes.find(p => p.id === current);
    current = person?.managerId;

    // Safety limit
    if (visited.size > 1000) return true;
  }

  return false;
}

export const useOrgChartStore = create(
  persist(
    (set, get) => ({
      // State
      rawCSVData: null,
      departments: [],
      roleTemplates: [],
      personNodes: [],
      managerAssignments: {}, // Canonical source: { personId: managerId } - persists across quarter switches
      selectedQuarter: 'Q4',
      nodes: [], // ReactFlow nodes
      edges: [], // ReactFlow edges
      csvFileName: null,
      lastSaved: null,
      isLoading: false,
      error: null,
      dataVersion: 7, // Increment this to force re-parse
      collapsedNodes: new Set(), // Track which nodes are collapsed

      // Actions

      /**
       * Load and parse CSV file
       */
      loadCSV: async (file) => {
        set({ isLoading: true, error: null });

        try {
          const { departments, roleTemplates } = await parseOrgChartCSV(file);

          console.log(`📥 Store: Received ${roleTemplates.length} role templates from parser`);

          // Calculate totals for verification
          const totals = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
          roleTemplates.forEach(template => {
            totals.Q1 += template.quarters.Q1;
            totals.Q2 += template.quarters.Q2;
            totals.Q3 += template.quarters.Q3;
            totals.Q4 += template.quarters.Q4;
          });
          console.log(`📊 Store: Calculated totals from templates: Q1=${totals.Q1}, Q2=${totals.Q2}, Q3=${totals.Q3}, Q4=${totals.Q4}`);

          // Expand role templates into person nodes for the selected quarter
          const quarter = get().selectedQuarter;
          const personNodes = expandRoleTemplates(roleTemplates, quarter);
          console.log(`👥 Store: Expanded into ${personNodes.length} person nodes for ${quarter}`);

          set({
            rawCSVData: file,
            csvFileName: file.name,
            departments,
            roleTemplates,
            personNodes,
            isLoading: false,
            error: null,
            lastSaved: new Date().toISOString()
          });

          // Rebuild the chart
          get().rebuildChart();
        } catch (error) {
          set({
            isLoading: false,
            error: error.message || 'Failed to parse CSV'
          });
          console.error('CSV parsing error:', error);
        }
      },

      /**
       * Set the selected quarter and expand roles accordingly
       */
      setSelectedQuarter: (quarter) => {
        const { roleTemplates, managerAssignments } = get();

        // Get all manager IDs from canonical assignments (this never gets corrupted)
        const referencedManagerIds = [...new Set(Object.values(managerAssignments).filter(Boolean))];

        // Expand with manager IDs so future managers appear as placeholders
        let personNodes = expandRoleTemplates(roleTemplates, quarter, referencedManagerIds);

        // Apply manager assignments from canonical source
        personNodes.forEach(node => {
          if (managerAssignments[node.id]) {
            node.managerId = managerAssignments[node.id];
          }
        });

        // Ensure all referenced managers exist as placeholders
        const existingIds = new Set(personNodes.map(n => n.id));

        // Recursively create placeholders for missing managers
        let iterations = 0;
        while (iterations < 10) {
          const missingManagers = new Set();
          personNodes.forEach(node => {
            if (node.managerId && !existingIds.has(node.managerId)) {
              missingManagers.add(node.managerId);
            }
          });

          if (missingManagers.size === 0) break;

          missingManagers.forEach(managerId => {
            const match = managerId.match(/^(role-\d+)-person-(\d+)$/);
            if (match) {
              const templateId = match[0].replace(/-person-\d+$/, '');
              const template = roleTemplates.find(t => t.id === templateId);
              if (template) {
                const startQuarter = ['Q1', 'Q2', 'Q3', 'Q4'].find(q => template.quarters[q] > 0);

                personNodes.push({
                  id: managerId,
                  templateId: template.id,
                  roleName: template.cleanName,
                  displayName: template.cleanName,
                  department: template.department,
                  departmentId: template.departmentId,
                  managerId: managerAssignments[managerId] || null,
                  position: { x: 0, y: 0 },
                  activeInQuarters: Object.entries(template.quarters)
                    .filter(([q, count]) => count > 0)
                    .map(([q]) => q),
                  startQuarter,
                  isFutureRole: true,
                  metadata: {
                    originalRoleName: template.originalName,
                    costPerRole: template.costPerRole,
                    instanceNumber: 1,
                    totalInstances: 1,
                    templateMetadata: template.metadata
                  }
                });
                existingIds.add(managerId);
              }
            }
          });
          iterations++;
        }

        set({
          selectedQuarter: quarter,
          personNodes
        });

        get().rebuildChart();
      },

      /**
       * Update department properties
       */
      updateDepartment: (deptId, changes) => {
        set(state => ({
          departments: state.departments.map(d =>
            d.id === deptId ? { ...d, ...changes } : d
          )
        }));
        get().rebuildChart();
      },

      /**
       * Reassign a role template to a different department
       */
      reassignRole: (templateId, newDeptId) => {
        const newDept = get().departments.find(d => d.id === newDeptId);
        if (!newDept) return;

        set(state => ({
          roleTemplates: state.roleTemplates.map(template =>
            template.id === templateId
              ? { ...template, department: newDept.name, departmentId: newDept.id }
              : template
          )
        }));

        // Re-expand person nodes to reflect the department change
        const quarter = get().selectedQuarter;
        const personNodes = expandRoleTemplates(get().roleTemplates, quarter);
        set({ personNodes });

        get().rebuildChart();
      },

      /**
       * Set manager for a person node
       */
      setManager: (personId, managerId, skipRebuild = false) => {
        const { personNodes, managerAssignments } = get();

        // Validate: prevent circular references
        if (managerId && wouldCreateCircular(personId, managerId, personNodes)) {
          set({ error: 'Cannot assign manager: would create circular reference' });
          return false;
        }

        // Update the canonical manager assignments
        const newAssignments = { ...managerAssignments };
        if (managerId) {
          newAssignments[personId] = managerId;
        } else {
          delete newAssignments[personId];
        }

        // Update the person node
        set(state => ({
          personNodes: state.personNodes.map(node =>
            node.id === personId ? { ...node, managerId } : node
          ),
          managerAssignments: newAssignments,
          error: null
        }));

        if (!skipRebuild) {
          get().rebuildChart();
        }
        return true;
      },

      /**
       * Bulk set manager for multiple people
       */
      bulkSetManager: (personIds, managerId) => {
        const { personNodes, managerAssignments } = get();
        let failedCount = 0;

        // Validate all assignments first
        for (const personId of personIds) {
          if (managerId && wouldCreateCircular(personId, managerId, personNodes)) {
            failedCount++;
          }
        }

        // Build new manager assignments
        const newAssignments = { ...managerAssignments };
        personIds.forEach(personId => {
          if (!managerId || !wouldCreateCircular(personId, managerId, personNodes)) {
            if (managerId) {
              newAssignments[personId] = managerId;
            } else {
              delete newAssignments[personId];
            }
          }
        });

        // Update all person nodes at once
        set(state => ({
          personNodes: state.personNodes.map(node => {
            if (personIds.includes(node.id)) {
              // Skip if it would create circular reference
              if (managerId && wouldCreateCircular(node.id, managerId, personNodes)) {
                return node;
              }
              return { ...node, managerId };
            }
            return node;
          }),
          managerAssignments: newAssignments,
          error: failedCount > 0 ? `${failedCount} assignment(s) skipped due to circular reference` : null
        }));

        get().rebuildChart();
        return personIds.length - failedCount; // Return success count
      },

      /**
       * Remove manager assignment
       */
      removeManager: (personId) => {
        const { managerAssignments } = get();
        const newAssignments = { ...managerAssignments };
        delete newAssignments[personId];

        set(state => ({
          personNodes: state.personNodes.map(node =>
            node.id === personId ? { ...node, managerId: null } : node
          ),
          managerAssignments: newAssignments
        }));
        get().rebuildChart();
      },

      /**
       * Bulk remove manager for multiple people
       */
      bulkRemoveManager: (personIds) => {
        const { managerAssignments } = get();
        const newAssignments = { ...managerAssignments };
        personIds.forEach(id => delete newAssignments[id]);

        set(state => ({
          personNodes: state.personNodes.map(node =>
            personIds.includes(node.id) ? { ...node, managerId: null } : node
          ),
          managerAssignments: newAssignments
        }));
        get().rebuildChart();
      },

      /**
       * Update person node position (after drag)
       */
      updatePersonPosition: (personId, position) => {
        set(state => ({
          personNodes: state.personNodes.map(node =>
            node.id === personId ? { ...node, position } : node
          )
        }));
      },

      /**
       * Rebuild ReactFlow nodes and edges
       */
      rebuildChart: () => {
        const { personNodes, departments } = get();
        let { collapsedNodes } = get();

        // Ensure collapsedNodes is a Set (might be array from localStorage)
        if (!(collapsedNodes instanceof Set)) {
          collapsedNodes = new Set(Array.isArray(collapsedNodes) ? collapsedNodes : []);
          set({ collapsedNodes });
        }

        // Helper function to check if a person should be visible
        const isPersonVisible = (person) => {
          // Walk up the tree and check if any ancestor is collapsed
          let current = person.managerId;
          while (current) {
            if (collapsedNodes.has(current)) {
              return false; // An ancestor is collapsed, so this person is hidden
            }
            const manager = personNodes.find(p => p.id === current);
            current = manager?.managerId;
          }
          return true; // No collapsed ancestors
        };

        // Filter to only visible person nodes
        const visiblePersonNodes = personNodes.filter(isPersonVisible);

        // Force recalculation of positions
        const newPositions = calculateLayout(visiblePersonNodes, departments);

        // Update person nodes with new positions
        const updatedPersonNodes = personNodes.map(person => ({
          ...person,
          position: newPositions[person.id] || person.position
        }));

        // Build ReactFlow nodes (only for visible people)
        const nodes = visiblePersonNodes.map(person => {
          const dept = departments.find(d => d.id === person.departmentId);
          const isManager = personNodes.some(n => n.managerId === person.id);
          const isCollapsed = collapsedNodes.has(person.id);
          const directReportsCount = personNodes.filter(n => n.managerId === person.id).length;

          return {
            id: person.id,
            type: 'customRole',
            data: {
              person,
              department: dept,
              isManager,
              isCollapsed,
              directReportsCount,
              displayName: person.displayName,
              roleName: person.roleName
            },
            position: updatedPersonNodes.find(p => p.id === person.id).position,
            style: {
              borderColor: dept?.color || '#6B7280',
              borderWidth: 2
            }
          };
        });

        // Build ReactFlow edges (only for visible people)
        // Group direct reports by manager and role to reduce edge clutter
        const edges = [];
        const edgesCreated = new Set(); // Track which manager-role combos have edges

        visiblePersonNodes.forEach(person => {
          if (person.managerId) {
            // Only create edge if manager also exists and is visible
            const managerExists = visiblePersonNodes.some(n => n.id === person.managerId);
            if (managerExists) {
              const manager = personNodes.find(n => n.id === person.managerId);
              const isCrossDepartment = manager?.departmentId !== person.departmentId;

              // Check if this person is a manager (has direct reports)
              const isPersonManager = personNodes.some(n => n.managerId === person.id);

              // For leaf nodes (non-managers), only show one edge per role group
              const roleKey = person.templateId || person.id;
              const edgeKey = `${person.managerId}-${roleKey}`;

              // Always show edges to managers, only show first edge per role for leaves
              if (isPersonManager || !edgesCreated.has(edgeKey)) {
                edgesCreated.add(edgeKey);

                edges.push({
                  id: `edge-${person.managerId}-${person.id}`,
                  source: person.managerId,
                  target: person.id,
                  type: 'bezier',
                  animated: false,
                  style: {
                    stroke: isCrossDepartment ? '#EF4444' : '#94A3B8',
                    strokeWidth: 1.5,
                    strokeDasharray: isCrossDepartment ? '5,5' : undefined
                  }
                });
              }
            }
          }
        });

        set({
          personNodes: updatedPersonNodes,
          nodes,
          edges,
          lastSaved: new Date().toISOString()
        });
      },

      /**
       * Reset all manager assignments
       */
      resetManagerAssignments: () => {
        set(state => ({
          personNodes: state.personNodes.map(node => ({
            ...node,
            managerId: null
          })),
          managerAssignments: {}
        }));
        get().rebuildChart();
      },

      /**
       * Clear error message
       */
      clearError: () => {
        set({ error: null });
      },

      /**
       * Export current state as JSON
       */
      exportToJSON: () => {
        const state = get();
        return {
          version: 1,
          exportDate: new Date().toISOString(),
          csvFileName: state.csvFileName,
          selectedQuarter: state.selectedQuarter,
          departments: state.departments,
          roleTemplates: state.roleTemplates,
          personNodes: state.personNodes,
          collapsedNodes: Array.from(state.collapsedNodes)
        };
      },

      /**
       * Import state from JSON
       */
      importFromJSON: (jsonData) => {
        try {
          // Build managerAssignments from personNodes
          const managerAssignments = {};
          jsonData.personNodes.forEach(node => {
            if (node.managerId) {
              managerAssignments[node.id] = node.managerId;
            }
          });

          set({
            departments: jsonData.departments,
            roleTemplates: jsonData.roleTemplates,
            personNodes: jsonData.personNodes,
            managerAssignments,
            selectedQuarter: jsonData.selectedQuarter,
            csvFileName: jsonData.csvFileName,
            collapsedNodes: jsonData.collapsedNodes ? new Set(jsonData.collapsedNodes) : new Set(),
            error: null
          });
          get().rebuildChart();
          return true;
        } catch (error) {
          set({ error: 'Failed to import data: invalid format' });
          return false;
        }
      },

      /**
       * Add a custom role (not from CSV)
       */
      addCustomRole: (roleName, departmentId) => {
        const { departments, personNodes } = get();
        const dept = departments.find(d => d.id === departmentId);

        if (!dept) {
          set({ error: 'Invalid department' });
          return false;
        }

        // Generate unique ID for custom role
        const customId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const newPersonNode = {
          id: customId,
          templateId: null, // No template for custom roles
          roleName: roleName,
          displayName: roleName,
          department: dept.name,
          departmentId: dept.id,
          managerId: null,
          position: { x: 0, y: 0 },
          activeInQuarters: ['Q1', 'Q2', 'Q3', 'Q4'],
          isCustom: true, // Mark as custom role
          metadata: {
            originalRoleName: roleName,
            costPerRole: '',
            instanceNumber: 1,
            totalInstances: 1,
            templateMetadata: {}
          }
        };

        set(state => ({
          personNodes: [...state.personNodes, newPersonNode],
          error: null
        }));

        get().rebuildChart();
        return true;
      },

      /**
       * Toggle collapse/expand state for a node
       */
      toggleNodeCollapse: (nodeId) => {
        set(state => {
          const newCollapsedNodes = new Set(state.collapsedNodes);
          if (newCollapsedNodes.has(nodeId)) {
            newCollapsedNodes.delete(nodeId);
          } else {
            newCollapsedNodes.add(nodeId);
          }
          return { collapsedNodes: newCollapsedNodes };
        });
        get().rebuildChart();
      },

      /**
       * Delete a person node (only custom roles)
       */
      deletePersonNode: (personId) => {
        const { personNodes, managerAssignments } = get();
        const person = personNodes.find(p => p.id === personId);

        if (!person) {
          set({ error: 'Person not found' });
          return false;
        }

        if (!person.isCustom) {
          set({ error: 'Cannot delete roles from CSV. Only custom roles can be deleted.' });
          return false;
        }

        // Update managerAssignments: remove this person and anyone who has them as manager
        const newAssignments = { ...managerAssignments };
        delete newAssignments[personId];
        Object.keys(newAssignments).forEach(key => {
          if (newAssignments[key] === personId) {
            delete newAssignments[key];
          }
        });

        // Remove the person and any references to them as manager
        set(state => ({
          personNodes: state.personNodes
            .filter(p => p.id !== personId)
            .map(p => p.managerId === personId ? { ...p, managerId: null } : p),
          managerAssignments: newAssignments
        }));

        get().rebuildChart();
        return true;
      }
    }),
    {
      name: 'org-chart-storage',
      version: 7, // Increment to clear old cached data and add managerAssignments
      onRehydrateStorage: () => (state) => {
        // After rehydrating from localStorage, rebuild the chart
        // This ensures nodes/edges are populated on initial load
        if (state && state.personNodes && state.personNodes.length > 0) {
          // Use setTimeout to ensure the store is fully initialized
          setTimeout(() => {
            state.rebuildChart();
          }, 0);
        }
      },
      partialize: (state) => ({
        departments: state.departments,
        roleTemplates: state.roleTemplates,
        personNodes: state.personNodes,
        managerAssignments: state.managerAssignments,
        selectedQuarter: state.selectedQuarter,
        csvFileName: state.csvFileName,
        lastSaved: state.lastSaved,
        dataVersion: state.dataVersion,
        collapsedNodes: Array.from(state.collapsedNodes) // Convert Set to Array for serialization
      }),
      migrate: (persistedState, version) => {
        console.log(`🔄 Store migration: old version=${version}, new version=7`);
        // If the version changed, clear the data to force re-parse
        if (version < 7) {
          console.log('🗑️  Clearing old cached data to load fresh default JSON');
          return {
            departments: [],
            roleTemplates: [],
            personNodes: [],
            managerAssignments: {},
            selectedQuarter: 'Q4',
            csvFileName: null,
            lastSaved: null,
            dataVersion: 7,
            collapsedNodes: []
          };
        }
        // Convert collapsedNodes array back to Set
        if (persistedState.collapsedNodes && Array.isArray(persistedState.collapsedNodes)) {
          persistedState.collapsedNodes = new Set(persistedState.collapsedNodes);
        } else {
          persistedState.collapsedNodes = new Set();
        }
        // Ensure managerAssignments exists
        if (!persistedState.managerAssignments) {
          persistedState.managerAssignments = {};
        }
        return persistedState;
      }
    }
  )
);
