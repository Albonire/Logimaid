import { Circuit } from './circuit';

export interface LayoutNode {
  id: string;
  type: 'INPUT' | 'OUTPUT' | 'GATE';
  gateType?: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  inPorts: { id: string; x: number; y: number }[];
  outPort: { x: number; y: number };
}

export interface Wire {
  id: string;
  source: string;
  target: string;
  points: { x: number; y: number }[];
  active: boolean;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  wires: Wire[];
  width: number;
  height: number;
}

const GATE_WIDTH = 60;
const GATE_HEIGHT = 40;
const MIN_IO_WIDTH = 40;
const SPACING_X = 160;
const SPACING_Y = 80;

function measureLabelWidth(label: string): number {
  const charWidth = 8.5; // Heuristic for 14px mono font
  const padding = 24;
  return Math.max(MIN_IO_WIDTH, Math.ceil(label.length * charWidth + padding));
}

export function layoutCircuit(circuit: Circuit): LayoutResult {
  const layers = new Map<string, number>();
  
  for (const inputId of circuit.inputs) {
    layers.set(inputId, 0);
  }

  for (const nodeId of circuit.evaluationOrder) {
    if (circuit.nodes.get(nodeId)!.type === 'INPUT') continue;
    
    const node = circuit.nodes.get(nodeId)!;
    let maxLayer = -1;
    for (const inId of node.inputs) {
      maxLayer = Math.max(maxLayer, layers.get(inId) || 0);
    }
    layers.set(nodeId, maxLayer + 1);
  }

  const layerGroups: string[][] = [];
  let maxLayer = 0;
  for (const [id, layer] of layers.entries()) {
    maxLayer = Math.max(maxLayer, layer);
    if (!layerGroups[layer]) layerGroups[layer] = [];
    layerGroups[layer].push(id);
  }

  // Calculate max widths per type as requested
  let maxInputWidth = MIN_IO_WIDTH;
  circuit.inputs.forEach(id => {
    maxInputWidth = Math.max(maxInputWidth, measureLabelWidth(circuit.nodes.get(id)!.label));
  });

  let maxOutputWidth = MIN_IO_WIDTH;
  circuit.outputs.forEach(id => {
    maxOutputWidth = Math.max(maxOutputWidth, measureLabelWidth(circuit.nodes.get(id)!.label));
  });

  const layoutNodes: LayoutNode[] = [];
  const nodeMap = new Map<string, LayoutNode>();

  // Determine starting X for each layer based on preceding layer widths
  const layerX = new Array(maxLayer + 1).fill(0);
  layerX[0] = 40;
  for (let l = 1; l <= maxLayer; l++) {
    const prevLayer = l - 1;
    const prevGroup = layerGroups[prevLayer];
    let prevMaxW = GATE_WIDTH;
    if (prevGroup.every(id => circuit.nodes.get(id)!.type === 'INPUT')) prevMaxW = maxInputWidth;
    else if (prevGroup.every(id => circuit.nodes.get(id)!.type === 'OUTPUT')) prevMaxW = maxOutputWidth;
    
    layerX[l] = layerX[prevLayer] + Math.max(prevMaxW + 80, SPACING_X);
  }

  let maxHeight = 0;

  for (let layer = 0; layer <= maxLayer; layer++) {
    const group = layerGroups[layer] || [];
    
    // SORTING HEURISTIC: Barycenter (Sugiyama algorithm)
    // Minimizes crossings by sorting nodes relative to their ancestors' vertical positions
    if (layer > 0) {
      const getBarycenter = (nodeId: string) => {
        const node = circuit.nodes.get(nodeId)!;
        const ancestors = node.inputs
          .map(id => nodeMap.get(id))
          .filter((n): n is LayoutNode => !!n);
        
        if (ancestors.length === 0) return 0;
        return ancestors.reduce((sum, n) => sum + n.y, 0) / ancestors.length;
      };

      group.sort((a, b) => getBarycenter(a) - getBarycenter(b));
    }

    const layerHeight = group.length * SPACING_Y;
    maxHeight = Math.max(maxHeight, layerHeight);
    
    let currentY = (maxHeight - layerHeight) / 2 + 40;

    for (const nodeId of group) {
      const node = circuit.nodes.get(nodeId)!;
      const x = layerX[layer];
      const y = currentY;

      let width = GATE_WIDTH;
      if (node.type === 'INPUT') width = maxInputWidth;
      else if (node.type === 'OUTPUT') width = maxOutputWidth;

      let inPorts: { id: string; x: number; y: number }[] = [];
      let outPort = { x: x + width, y: y + GATE_HEIGHT / 2 };

      if (node.type === 'INPUT') {
        outPort = { x: x + width, y: y + GATE_HEIGHT / 2 };
      } else if (node.type === 'OUTPUT') {
        inPorts = [{ id: node.inputs[0], x: x, y: y + GATE_HEIGHT / 2 }];
        outPort = { x: x + width, y: y + GATE_HEIGHT / 2 };
      } else {
        const numInputs = node.inputs.length;
        const inX = x - 10;
        if (numInputs === 1) {
          inPorts = [{ id: node.inputs[0], x: inX, y: y + GATE_HEIGHT / 2 }];
        } else {
          const step = (GATE_HEIGHT - 20) / (numInputs - 1 || 1);
          for (let i = 0; i < numInputs; i++) {
            inPorts.push({ id: node.inputs[i], x: inX, y: y + 10 + i * step });
          }
        }
        
        outPort = { x: x + width + 10, y: y + GATE_HEIGHT / 2 };
      }

      const lNode: LayoutNode = {
        id: nodeId,
        type: node.type,
        gateType: node.gateType,
        label: node.label,
        x,
        y,
        width,
        height: GATE_HEIGHT,
        inPorts,
        outPort,
      };

      layoutNodes.push(lNode);
      nodeMap.set(nodeId, lNode);
      currentY += SPACING_Y;
    }
  }

  const wires: Wire[] = [];
  layoutNodes.forEach((node, nodeIdx) => {
    node.inPorts.forEach((inPort, portIdx) => {
      const sourceNode = nodeMap.get(inPort.id);
      if (!sourceNode) return;
      
      const startX = sourceNode.outPort.x;
      const startY = sourceNode.outPort.y;
      const endX = inPort.x;
      const endY = inPort.y;

      // JITTERED ROUTING: Offsets midX slightly to prevent bundles of wires 
      // from overlapping at the exact same point.
      const baseMidX = startX + (endX - startX) / 2;
      const jitter = (nodeIdx % 5 - 2) * 5 + (portIdx * 3);
      const midX = baseMidX + jitter;

      wires.push({
        id: `wire_${sourceNode.id}_${node.id}_${inPort.id}`,
        source: sourceNode.id,
        target: node.id,
        points: [
          { x: startX, y: startY },
          { x: midX, y: startY },
          { x: midX, y: endY },
          { x: endX, y: endY },
        ],
        active: false,
      });
    });
  });

  const lastLayerX = layerX[maxLayer];
  const lastGroup = layerGroups[maxLayer];
  let lastMaxW = GATE_WIDTH;
  if (lastGroup && lastGroup.every(id => circuit.nodes.get(id)!.type === 'OUTPUT')) lastMaxW = maxOutputWidth;

  return {
    nodes: layoutNodes,
    wires,
    width: lastLayerX + lastMaxW + 80,
    height: maxHeight + 80,
  };
}
