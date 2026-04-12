import { Statement, Diagnostic } from './parser';

export type GateType = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR';

export interface CircuitNode {
  id: string;
  type: 'INPUT' | 'OUTPUT' | 'GATE';
  gateType?: GateType;
  label: string;
  inputs: string[];
  value: boolean;
}

export interface CircuitResult {
  circuit: Circuit | null;
  diagnostics: Diagnostic[];
}

export class Circuit {
  nodes: Map<string, CircuitNode> = new Map();
  inputs: string[] = [];
  outputs: string[] = [];
  evaluationOrder: string[] = [];
  diagnostics: Diagnostic[] = [];

  constructor(statements: Statement[]) {
    for (const stmt of statements) {
      if (stmt.type === 'INPUT') {
        for (const name of stmt.names) {
          if (this.nodes.has(name)) {
            this.diagnostics.push({ severity: 'Error', message: `Duplicate identifier: ${name}` });
            continue;
          }
          this.nodes.set(name, { id: name, type: 'INPUT', label: name, inputs: [], value: false });
          this.inputs.push(name);
        }
      } else if (stmt.type === 'GATE') {
        if (this.nodes.has(stmt.id)) {
          this.diagnostics.push({ severity: 'Error', message: `Duplicate identifier: ${stmt.id}` });
          continue;
        }
        this.nodes.set(stmt.id, {
          id: stmt.id,
          type: 'GATE',
          gateType: stmt.gateType as GateType,
          label: stmt.gateType,
          inputs: stmt.inputs,
          value: false,
        });
      } else if (stmt.type === 'OUTPUT') {
        const outId = `out_${stmt.name}`;
        if (this.nodes.has(outId)) {
          this.diagnostics.push({ severity: 'Warning', message: `Overwriting output: ${stmt.name}` });
        }
        this.nodes.set(outId, {
          id: outId,
          type: 'OUTPUT',
          label: stmt.name,
          inputs: [stmt.source],
          value: false,
        });
        this.outputs.push(outId);
      }
    }

    try {
      this.validateAndSort();
      this.diagnostics.push({ severity: 'Info', message: `Circuit compiled: ${this.inputs.length} inputs, ${this.nodes.size - this.inputs.length} components.` });
      
      // Check for unconnected outputs
      for (const [id, node] of this.nodes) {
        if (node.type === 'OUTPUT' && node.inputs.length === 0) {
          this.diagnostics.push({ severity: 'Warning', message: `Output '${node.label}' is not connected.` });
        }
      }
    } catch (err: any) {
      this.diagnostics.push({ severity: 'Error', message: err.message });
    }
  }

  validateAndSort() {
    const visited = new Set<string>();
    const temp = new Set<string>();
    const order: string[] = [];

    const visit = (nodeId: string) => {
      if (temp.has(nodeId)) throw new Error(`Cycle detected involving '${nodeId}'`);
      if (visited.has(nodeId)) return;

      const node = this.nodes.get(nodeId);
      if (!node) throw new Error(`Unknown identifier: '${nodeId}'`);

      temp.add(nodeId);
      for (const inputId of node.inputs) {
        visit(inputId);
      }
      temp.delete(nodeId);
      visited.add(nodeId);
      order.push(nodeId);
    };

    for (const outId of this.outputs) {
      visit(outId);
    }

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        visit(nodeId);
      }
    }

    this.evaluationOrder = order;
  }

  evaluate(inputValues: Record<string, boolean>): Record<string, boolean> {
    for (const [id, val] of Object.entries(inputValues)) {
      if (this.nodes.has(id)) {
        this.nodes.get(id)!.value = val;
      }
    }

    for (const nodeId of this.evaluationOrder) {
      const node = this.nodes.get(nodeId)!;
      if (node.type === 'INPUT') continue;

      const inVals = node.inputs.map(id => this.nodes.get(id)!.value);

      if (node.type === 'OUTPUT') {
        node.value = inVals[0];
      } else if (node.type === 'GATE') {
        switch (node.gateType) {
          case 'AND': node.value = inVals.every(v => v); break;
          case 'OR': node.value = inVals.some(v => v); break;
          case 'NOT': node.value = !inVals[0]; break;
          case 'NAND': node.value = !(inVals.every(v => v)); break;
          case 'NOR': node.value = !(inVals.some(v => v)); break;
          case 'XOR': node.value = inVals.reduce((a, b) => a !== b, false); break;
          case 'XNOR': node.value = !(inVals.reduce((a, b) => a !== b, false)); break;
          default: throw new Error(`Unknown gate type: ${node.gateType}`);
        }
      }
    }

    const result: Record<string, boolean> = {};
    for (const outId of this.outputs) {
      const node = this.nodes.get(outId)!;
      result[node.label] = node.value;
    }
    return result;
  }

  generateTruthTable(rowLimit: number = 2000): { headers: string[], rows: boolean[][], totalRows: number } {
    const headers = [...this.inputs, ...this.outputs.map(id => this.nodes.get(id)!.label)];
    const rows: boolean[][] = [];
    const numInputs = this.inputs.length;
    const totalRows = Math.pow(2, numInputs);
    
    // Performance safe-guard for UI rendering
    const displayRows = Math.min(totalRows, rowLimit);

    for (let i = 0; i < displayRows; i++) {
      const inputVals: Record<string, boolean> = {};
      const row: boolean[] = [];
      for (let j = 0; j < numInputs; j++) {
        const val = Boolean((i >> (numInputs - 1 - j)) & 1);
        inputVals[this.inputs[j]] = val;
        row.push(val);
      }

      const outVals = this.evaluate(inputVals);
      for (const outId of this.outputs) {
        row.push(this.nodes.get(outId)!.value);
      }
      rows.push(row);
    }

    return { headers, rows, totalRows };
  }
}
