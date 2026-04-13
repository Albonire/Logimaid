import React, { useState, useRef, useEffect } from 'react';
import { LayoutResult, LayoutNode, Wire } from '../lib/layout';
import { Circuit } from '../lib/circuit';

interface LogicSVGProps {
  layout: LayoutResult;
  circuit: Circuit;
  onToggleInput?: (inputId: string) => void;
}

const GatePaths: Record<string, React.ReactNode> = {
  AND: (
    <g>
      {/* Main AND gate shape: arc center moved to x=40, right edge now at x=60 */}
      <path d="M 0,0 L 40,0 A 20,20 0 0,1 40,40 L 0,40 Z" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
    </g>
  ),
  NAND: (
    <g>
      {/* Main NAND gate shape: arc center at x=30, flat edge at x=30 */}
      <path d="M 0,0 L 30,0 A 20,20 0 0,1 30,40 L 0,40 Z" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
      {/* Connector from flat edge to bubble */}
      <line x1="30" y1="20" x2="50" y2="20" stroke="var(--fg)" strokeWidth="2" />
      {/* Inversion bubble at x=55 (ends at x=60) */}
      <circle cx="55" cy="20" r="5" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
    </g>
  ),
  OR: (
    <g>
      {/* Main OR gate shape: stretched to reach x=60 at the tip */}
      <path d="M 0,0 Q 30,0 60,20 Q 30,40 0,40 Q 18,20 0,0 Z" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
    </g>
  ),
  NOR: (
    <g>
      {/* Main NOR gate shape: stretched to x=60 */}
      <path d="M 0,0 Q 30,0 60,20 Q 30,40 0,40 Q 18,20 0,0 Z" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
      {/* Inversion bubble at x=55 (ends at x=60) */}
      <circle cx="55" cy="20" r="5" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
    </g>
  ),
  XOR: (
    <g>
      {/* Main XOR gate shape: stretched to x=60 */}
      <path d="M 0,0 Q 30,0 60,20 Q 30,40 0,40 Q 18,20 0,0 Z" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
      {/* Extra curved input line (XOR signature) */}
      <path d="M -8,0 Q 7,20 -8,40" fill="none" stroke="var(--fg)" strokeWidth="2" />
    </g>
  ),
  XNOR: (
    <g>
      {/* Main XNOR gate shape: stretched to x=60 */}
      <path d="M 0,0 Q 30,0 60,20 Q 30,40 0,40 Q 18,20 0,0 Z" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
      {/* Extra curved input line (XNOR signature) */}
      <path d="M -8,0 Q 7,20 -8,40" fill="none" stroke="var(--fg)" strokeWidth="2" />
      {/* Inversion bubble at x=55 (ends at x=60) */}
      <circle cx="55" cy="20" r="5" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
    </g>
  ),
  NOT: (
    <g>
      {/* Triangle: tip at x=50, base at x=0 */}
      <path d="M 0,5 L 50,20 L 0,35 Z" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
      {/* Inversion bubble at x=55 (ends at x=60) */}
      <circle cx="55" cy="20" r="5" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
    </g>
  ),
};

// All gates visually reach x=60, output stub extends from 60→70
// Wire starts at x+60 (layout outPort), gate shape ends at x=60 (local)
const gateOutputX = 60;

// Input stub: all gates receive inputs at x=-10
const gateInputX = -10;

export function LogicSVG({ layout, circuit, onToggleInput }: LogicSVGProps) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    const delta = e.deltaY > 0 ? -zoomFactor : zoomFactor;
    const newScale = Math.max(0.1, Math.min(5, transform.scale + delta));
    setTransform(prev => ({ ...prev, scale: newScale }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left click for pan
      setIsDragging(true);
      dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      }));
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const renderNode = (node: LayoutNode) => {
    const circuitNode = circuit.nodes.get(node.id);
    const isActive = circuitNode?.value || false;

    if (node.type === 'INPUT') {
      return (
        <g
          key={node.id}
          transform={`translate(${node.x}, ${node.y})`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleInput?.(node.id);
          }}
          className="cursor-pointer"
        >
          <rect
            x="0" y="5" width={node.width} height="30" rx="4"
            fill={isActive ? "var(--accent)" : "var(--surface)"}
            stroke="var(--fg)" strokeWidth="2"
            className="transition-colors duration-200"
          />
          <text
            x={node.width / 2} y="25" textAnchor="middle"
            fontSize="14" fontFamily="var(--font-mono)" fontWeight="500"
            fill={isActive ? "var(--accentFg)" : "var(--fg)"}
            className="transition-colors duration-200 select-none"
          >
            {node.label}
          </text>
        </g>
      );
    }

    if (node.type === 'OUTPUT') {
      return (
        <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
          <rect
            x="0" y="5" width={node.width} height="30" rx="15"
            fill={isActive ? "var(--accent)" : "var(--surface)"}
            stroke="var(--fg)" strokeWidth="2"
            className="transition-colors duration-200"
          />
          <text 
            x={node.width / 2} y="25" textAnchor="middle" 
            fontSize="14" fontFamily="var(--font-mono)" fontWeight="500" 
            fill={isActive ? "var(--accentFg)" : "var(--fg)"}
            className="transition-colors duration-200 select-none"
          >
            {node.label}
          </text>
        </g>
      );
    }

    return (
      <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
        {/* Input stub lines: all connect at x=-10 to the gate body. 
            Moved before gate paths so they are behind the opaque gate body. */}
        {node.inPorts.map((port, i) => (
          <line
            key={i}
            x1={gateInputX} y1={port.y - node.y}
            x2={20} y2={port.y - node.y}
            stroke="var(--fg)" strokeWidth="2"
          />
        ))}

        {GatePaths[node.gateType || '']}

        {/* Output stub line: all connect from x=60 to x=70 */}
        <line
          x1={gateOutputX} y1="20"
          x2={gateOutputX + 10} y2="20"
          stroke={isActive ? "var(--accent)" : "var(--fg)"}
          strokeWidth="2"
          className="transition-colors duration-200"
        />
      </g>
    );
  };

  const renderWire = (wire: Wire) => {
    const pts = wire.points;
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      if (pts.length === 4 && i === 1) {
        d += ` C ${pts[1].x},${pts[1].y} ${pts[2].x},${pts[2].y} ${pts[3].x},${pts[3].y}`;
        break;
      } else {
        d += ` L ${pts[i].x},${pts[i].y}`;
      }
    }

    const sourceNode = circuit.nodes.get(wire.source);
    const isActive = sourceNode?.value || false;

    return (
      <path
        key={wire.id}
        d={d}
        fill="none"
        stroke={isActive ? "var(--accent)" : "var(--fg)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-colors duration-200"
      />
    );
  };

  return (
    <div className="w-full h-full overflow-hidden cursor-move" onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        xmlns="http://www.w3.org/2000/svg"
        className="select-none"
      >
        <g className="logic-transform-group" transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          <g transform="translate(20, 0)">
            {layout.wires.map(renderWire)}
            {layout.nodes.map(renderNode)}
          </g>
        </g>
      </svg>
    </div>
  );
}
