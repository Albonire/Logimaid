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
const SPACING_X = 160;
const SPACING_Y = 80;

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

  const layoutNodes: LayoutNode[] = [];
  const nodeMap = new Map<string, LayoutNode>();

  let maxWidth = (maxLayer + 1) * SPACING_X + 100;
  let maxHeight = 0;

  for (let layer = 0; layer <= maxLayer; layer++) {
    const group = layerGroups[layer] || [];
    const layerHeight = group.length * SPACING_Y;
    maxHeight = Math.max(maxHeight, layerHeight);
    
    let currentY = (maxHeight - layerHeight) / 2 + 40;

    for (const nodeId of group) {
      const node = circuit.nodes.get(nodeId)!;
      const x = layer * SPACING_X + 40;
      const y = currentY;

      let inPorts: { id: string; x: number; y: number }[] = [];
      let outPort = { x: x + GATE_WIDTH, y: y + GATE_HEIGHT / 2 };

      if (node.type === 'INPUT') {
        outPort = { x: x + 40, y: y + GATE_HEIGHT / 2 };
      } else if (node.type === 'OUTPUT') {
        inPorts = [{ id: node.inputs[0], x: x, y: y + GATE_HEIGHT / 2 }];
        outPort = { x: x + 40, y: y + GATE_HEIGHT / 2 };
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
        
        let outX = x + 60;
        if (['NAND', 'NOR', 'XNOR'].includes(node.gateType!)) {
          outX = x + 70;
        }
        outPort = { x: outX, y: y + GATE_HEIGHT / 2 };
      }

      const lNode: LayoutNode = {
        id: nodeId,
        type: node.type,
        gateType: node.gateType,
        label: node.label,
        x,
        y,
        width: node.type === 'GATE' ? GATE_WIDTH : 40,
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
  for (const node of layoutNodes) {
    for (const inPort of node.inPorts) {
      const sourceNode = nodeMap.get(inPort.id);
      if (!sourceNode) continue;
      
      const startX = sourceNode.outPort.x;
      const startY = sourceNode.outPort.y;
      const endX = inPort.x;
      const endY = inPort.y;

      const midX = startX + (endX - startX) / 2;

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
    }
  }

  return {
    nodes: layoutNodes,
    wires,
    width: maxWidth,
    height: maxHeight + 80,
  };
}
