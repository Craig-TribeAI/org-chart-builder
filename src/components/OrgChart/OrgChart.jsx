import { useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

import CustomNode from './CustomNode';
import { useOrgChartStore } from '../../stores/orgChartStore';
import './OrgChart.css';

const nodeTypes = {
  customRole: CustomNode
};

function OrgChart() {
  const {
    personNodes,
    departments,
    nodes: storeNodes,
    edges: storeEdges,
    setManager,
    updatePersonPosition,
    rebuildChart
  } = useOrgChartStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Update ReactFlow nodes/edges when store changes
  useEffect(() => {
    setNodes(storeNodes);
    setEdges(storeEdges);
  }, [storeNodes, storeEdges, setNodes, setEdges]);

  // Handle node drag stop - save position
  const onNodeDragStop = useCallback((event, node) => {
    updatePersonPosition(node.id, node.position);
  }, [updatePersonPosition]);

  // Handle new connection - assign manager
  const onConnect = useCallback((connection) => {
    const { source, target } = connection;
    // Source is the manager, target is the report
    const success = setManager(target, source);
    if (!success) {
      // Error is already set in store
      console.warn('Failed to set manager - circular reference');
    }
  }, [setManager]);

  if (personNodes.length === 0) {
    return (
      <div className="org-chart-empty">
        <p>No person nodes to display for the selected quarter.</p>
        <p className="hint">Try selecting a different quarter or uploading a CSV file.</p>
      </div>
    );
  }

  // Create a key based on node IDs and edge IDs to force re-render on structure changes
  const nodeIds = nodes.map(n => n.id).sort().join(',');
  const edgeIds = edges.map(e => e.id).sort().join(',');
  const chartKey = `${nodeIds}-${edgeIds}`;

  return (
    <div className="org-chart-container">
      <ReactFlow
        key={chartKey}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.1, maxZoom: 1.5 }}
        minZoom={0.05}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
          style: { strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: '#94A3B8'
          }
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            const dept = departments.find(d => d.id === node.data.person?.departmentId);
            return dept?.color || '#6B7280';
          }}
          maskColor="rgba(0, 0, 0, 0.05)"
          style={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px'
          }}
        />
      </ReactFlow>
    </div>
  );
}

export default OrgChart;
