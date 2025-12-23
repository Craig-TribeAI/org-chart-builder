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
      selectedQuarter: 'Q1',
      nodes: [], // ReactFlow nodes
      edges: [], // ReactFlow edges
      csvFileName: null,
      lastSaved: null,
      isLoading: false,
      error: null,
      dataVersion: 4, // Increment this to force re-parse
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
        const { roleTemplates } = get();
        const personNodes = expandRoleTemplates(roleTemplates, quarter);

        // Preserve existing manager assignments if the person still exists
        const oldPersonNodes = get().personNodes;
        personNodes.forEach(newNode => {
          const oldNode = oldPersonNodes.find(n => n.id === newNode.id);
          if (oldNode && oldNode.managerId) {
            // Only preserve if manager also exists in new quarter
            const managerExists = personNodes.some(n => n.id === oldNode.managerId);
            if (managerExists) {
              newNode.managerId = oldNode.managerId;
            }
          }
        });

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
        const { personNodes } = get();

        // Validate: prevent circular references
        if (managerId && wouldCreateCircular(personId, managerId, personNodes)) {
          set({ error: 'Cannot assign manager: would create circular reference' });
          return false;
        }

        // Update the person node
        set(state => ({
          personNodes: state.personNodes.map(node =>
            node.id === personId ? { ...node, managerId } : node
          ),
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
        const { personNodes } = get();
        let failedCount = 0;

        // Validate all assignments first
        for (const personId of personIds) {
          if (managerId && wouldCreateCircular(personId, managerId, personNodes)) {
            failedCount++;
          }
        }

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
          error: failedCount > 0 ? `${failedCount} assignment(s) skipped due to circular reference` : null
        }));

        get().rebuildChart();
        return personIds.length - failedCount; // Return success count
      },

      /**
       * Remove manager assignment
       */
      removeManager: (personId) => {
        set(state => ({
          personNodes: state.personNodes.map(node =>
            node.id === personId ? { ...node, managerId: null } : node
          )
        }));
        get().rebuildChart();
      },

      /**
       * Bulk remove manager for multiple people
       */
      bulkRemoveManager: (personIds) => {
        set(state => ({
          personNodes: state.personNodes.map(node =>
            personIds.includes(node.id) ? { ...node, managerId: null } : node
          )
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
        const { personNodes, departments, collapsedNodes } = get();

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
        const edges = [];
        visiblePersonNodes.forEach(person => {
          if (person.managerId) {
            // Only create edge if manager also exists and is visible
            const managerExists = visiblePersonNodes.some(n => n.id === person.managerId);
            if (managerExists) {
              const manager = personNodes.find(n => n.id === person.managerId);
              const isCrossDepartment = manager?.departmentId !== person.departmentId;

              edges.push({
                id: `edge-${person.managerId}-${person.id}`,
                source: person.managerId,
                target: person.id,
                type: 'smoothstep',
                animated: false,
                style: {
                  stroke: isCrossDepartment ? '#EF4444' : '#94A3B8',
                  strokeWidth: 2,
                  strokeDasharray: isCrossDepartment ? '5,5' : undefined
                }
              });
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
          }))
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
          set({
            departments: jsonData.departments,
            roleTemplates: jsonData.roleTemplates,
            personNodes: jsonData.personNodes,
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
        const person = get().personNodes.find(p => p.id === personId);

        if (!person) {
          set({ error: 'Person not found' });
          return false;
        }

        if (!person.isCustom) {
          set({ error: 'Cannot delete roles from CSV. Only custom roles can be deleted.' });
          return false;
        }

        // Remove the person and any references to them as manager
        set(state => ({
          personNodes: state.personNodes
            .filter(p => p.id !== personId)
            .map(p => p.managerId === personId ? { ...p, managerId: null } : p)
        }));

        get().rebuildChart();
        return true;
      }
    }),
    {
      name: 'org-chart-storage',
      version: 4, // Increment to clear old cached data
      partialize: (state) => ({
        departments: state.departments,
        roleTemplates: state.roleTemplates,
        personNodes: state.personNodes,
        selectedQuarter: state.selectedQuarter,
        csvFileName: state.csvFileName,
        lastSaved: state.lastSaved,
        dataVersion: state.dataVersion,
        collapsedNodes: Array.from(state.collapsedNodes) // Convert Set to Array for serialization
      }),
      migrate: (persistedState, version) => {
        console.log(`🔄 Store migration: old version=${version}, new version=4`);
        // If the version changed, clear the data to force re-parse
        if (version < 4) {
          console.log('🗑️  Clearing old cached data to force fresh CSV parse with correct row exclusions');
          return {
            departments: [],
            roleTemplates: [],
            personNodes: [],
            selectedQuarter: 'Q1',
            csvFileName: null,
            lastSaved: null,
            dataVersion: 4,
            collapsedNodes: []
          };
        }
        // Convert collapsedNodes array back to Set
        if (persistedState.collapsedNodes && Array.isArray(persistedState.collapsedNodes)) {
          persistedState.collapsedNodes = new Set(persistedState.collapsedNodes);
        } else {
          persistedState.collapsedNodes = new Set();
        }
        return persistedState;
      }
    }
  )
);
