# Engine Architecture - LogicSVG Internal Specification

This document provides a formal technical specification of the LogicSVG engine. It is intended for software engineers and systems architects who require a deep understanding of the compilation, logical simulation, and graph-drawing heuristics implemented in the platform.

---

## 1. System Abstract

LogicSVG is an asynchronous simulation engine designed to handle Hardware Description Language (HDL) inputs and transform them into interactive Directed Acyclic Graphs (DAGs). The system employs a decoupling between the logical simulation layer and the spatial layout engine, allowing for high-performance rendering of complex propositional logic.

<img src="/home/fabian/Documents/Projects/logicsvg/assets/docs/pipeline.svg" alt="System Pipeline" width="800" />

---

## 2. Compiler Subsystem

The compiler transforms raw HDL text into a structured, executable circuit representation.

### 2.1 Lexical Analysis (Scanner)
The lexer utilizes a Deterministic Finite Automaton (DFA) approach to scan the input for tokens. It handles:
- **Identifier Resolution**: `[a-zA-Z0-9_]+` strings are mapped to unique identifiers.
- **Contextual Keywords**: Strictly reserved words like `INPUT` and `OUTPUT` trigger state changes in the parser.
- **Trivia Handling**: Whitespace and comments (prefixed with `#`) are discarded during the scanning phase to minimize token density.

### 2.2 Syntactic Analysis & EBNF Grammar
The parser implements a formal recursive descent strategy based on the following grammar:

```ebnf
Circuit      ::= (Statement)* EOF
Statement    ::= InputStmt | OutputStmt | GateStmt
InputStmt    ::= "INPUT" Identifier ("," Identifier)*
OutputStmt   ::= "OUTPUT" Identifier ["=" Expression]
GateStmt     ::= Identifier "=" Identifier "(" Arguments ")"
Expression   ::= Identifier "(" Arguments ")" | Identifier
Arguments    ::= Expression ("," Expression)*
```

### 2.3 Expression Flattening
LogicSVG supports deep nesting of gate calls (e.g., `OR(AND(A, B), AND(C, D))`). During the parsing phase, these nested expressions are transformed into **Intermediate Representation (IR)** by generating anonymous nodes. This ensures that the logical engine only processes flat node definitions with explicit input ID arrays.

---

## 3. Logical Core & Simulation

Once the statements are parsed, they are ingested by the logical engine to build a graph-based circuit model.

### 3.1 Graph Validation
The engine uses an adjacency list structure to represent the circuit. Before any simulation, it performs a **Global Dependency Check**:
1.  **Cycle Detection**: If a node eventually depends on its own output, an `Error` diagnostic is flagged, and compilation halts.
2.  **Topological Sort**: Using a modified DFS algorithm, the engine calculates an `evaluationOrder`. This ensures that for any node $N$, all nodes in $Inputs(N)$ are evaluated before $N$ itself.

### 3.2 Evaluation Lifecycle
Simulation is triggered by state changes in the `INPUT` nodes.
- **Topo-Order Execution**: The engine traverses the pre-computed `evaluationOrder` once per tick.
- **Truth Table Generation**: For formal verification, the engine performs $2^n$ evaluations (where $n$ is the number of inputs) to construct a complete Boolean state space.

---

## 4. Spatial Layout Engine (Sugiyama Framework)

The layout engine transforms the logical graph into a spatial representation. It follows an optimized version of the Sugiyama framework for layered graph drawing.

### 4.1 Hierarchical Layering
Nodes are assigned to discrete horizontal ranks (layers). The rank of a node $v$ is defined by:
$$rank(v) = \max(\{rank(u) \mid u \in Inputs(v)\}) + 1$$
This strictly enforces a left-to-right temporal flow in the visualization.

### 4.2 Barycenter Crossing Minimization
To reduce visual noise and "spaghetti" wiring, nodes within each layer are sorted using the **Barycenter Heuristic**.

<img src="/home/fabian/Documents/Projects/logicsvg/assets/docs/barycenter.svg" alt="Barycenter Heuristic" width="600" />

For each node $v$, its vertical position relative to its ancestors is calculated:
$$B(v) = \frac{\sum_{u \in Inputs(v)} y(u) \cdot w(u, v)}{\sum_{u \in Inputs(v)} w(u, v)}$$
Where $w(u, v)$ is the weight of the connection (currently unit-weighted). Sorting nodes by $B(v)$ significantly reduces edge intersections.

### 4.3 Elastic Node Sizing
Unlike standard layout engines that use fixed node sizes, LogicSVG employs an **Elastic Metric**:
- Node widths are calculated dynamically: $W = ch \cdot \lambda + p$, where $ch$ is the character width, $\lambda$ the string length, and $p$ the padding.
- Nodes of the same type in the same layer are "synced" to the maximum required width to maintain architectural alignment.

---

## 5. Graphic Pipeline & Rendering

### 5.1 Jittered Cubic Bezier Routing
Connections are rendered as Cubic Bezier curves. To prevent overlapping of parallel vertical segments, horizontal jittering is applied.

<img src="/home/fabian/Documents/Projects/logicsvg/assets/docs/routing.svg" alt="Wire Routing Logic" width="600" />

The control points $(P_1, P_2)$ share a jittered X-coordinate:
$$x_{mid} = x_{start} + \frac{x_{end} - x_{start}}{2} + \text{jitter}(node\_id)$$

### 5.2 Export & Serialization
High-fidelity export to JPG/PNG involves a multi-stage serialization process:
1.  **Asset Cloning**: A detached copy of the SVG DOM is created.
2.  **Coordinate Normalization**: Pan/Zoom transforms are stripped to project the entire circuit into the local coordinate system of the viewport.
3.  **Raster Projection**: The SVG is transformed into a Blob and projected onto an `HTMLCanvasElement` at $300\%$ scale (3x) for publishing-grade resolution.
