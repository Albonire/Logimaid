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
    <path d="M 0,0 L 30,0 A 20,20 0 0,1 30,40 L 0,40 Z" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
  ),
  NAND: (
    <g>
      <path d="M 0,0 L 30,0 A 20,20 0 0,1 30,40 L 0,40 Z" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
      <circle cx="55" cy="20" r="5" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
      <line x1="50" y1="20" x2="50" y2="20" stroke="var(--fg)" strokeWidth="2" />
    </g>
  ),
  OR: (
    <path d="M 0,0 Q 25,0 50,20 Q 25,40 0,40 Q 15,20 0,0 Z" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
  ),
  NOR: (
    <g>
      <path d="M 0,0 Q 25,0 50,20 Q 25,40 0,40 Q 15,20 0,0 Z" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
      <circle cx="55" cy="20" r="5" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
    </g>
  ),
  XOR: (
    <g>
      <path d="M 0,0 Q 25,0 50,20 Q 25,40 0,40 Q 15,20 0,0 Z" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
      <path d="M -8,0 Q 7,20 -8,40" fill="none" stroke="var(--fg)" strokeWidth="2" />
    </g>
  ),
  XNOR: (
    <g>
      <path d="M 0,0 Q 25,0 50,20 Q 25,40 0,40 Q 15,20 0,0 Z" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
      <path d="M -8,0 Q 7,20 -8,40" fill="none" stroke="var(--fg)" strokeWidth="2" />
      <circle cx="55" cy="20" r="5" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
    </g>
  ),
  NOT: (
    <g>
      <path d="M 0,5 L 30,20 L 0,35 Z" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
      <circle cx="35" cy="20" r="5" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2" />
    </g>
  ),
};

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
            x="0" y="5" width="40" height="30" rx="4" 
            fill={isActive ? "var(--accent)" : "var(--surface)"} 
            stroke="var(--fg)" strokeWidth="2" 
            className="transition-colors duration-200"
          />
          <text 
            x="20" y="25" textAnchor="middle" 
            fontSize="14" fontFamily="var(--font-mono)" fontWeight="500" 
            fill={isActive ? "var(--accentFg)" : "var(--fg)"}
            className="transition-colors duration-200 select-none"
          >
            {node.label}
          </text>
          <line x1="40" y1="20" x2="50" y2="20" stroke={isActive ? "var(--accent)" : "var(--fg)"} strokeWidth="2" className="transition-colors duration-200" />
        </g>
      );
    }

    if (node.type === 'OUTPUT') {
      return (
        <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
          <line x1="-10" y1="20" x2="0" y2="20" stroke={isActive ? "var(--accent)" : "var(--fg)"} strokeWidth="2" className="transition-colors duration-200" />
          <rect 
            x="0" y="5" width="40" height="30" rx="15" 
            fill={isActive ? "var(--accent)" : "var(--surface)"} 
            stroke="var(--fg)" strokeWidth="2" 
            className="transition-colors duration-200"
          />
          <text 
            x="20" y="25" textAnchor="middle" 
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
        {GatePaths[node.gateType || '']}
        
        {node.inPorts.map((port, i) => (
          <line 
            key={i}
            x1="-10" y1={port.y - node.y} x2={node.gateType === 'OR' || node.gateType === 'NOR' || node.gateType === 'XOR' || node.gateType === 'XNOR' ? 8 : 0} y2={port.y - node.y} 
            stroke="var(--fg)" strokeWidth="2" 
          />
        ))}
        
        {node.gateType === 'NAND' || node.gateType === 'NOR' || node.gateType === 'XNOR' ? (
          <line x1="60" y1="20" x2="70" y2="20" stroke={isActive ? "var(--accent)" : "var(--fg)"} strokeWidth="2" className="transition-colors duration-200" />
        ) : node.gateType === 'NOT' ? (
          <line x1="40" y1="20" x2="50" y2="20" stroke={isActive ? "var(--accent)" : "var(--fg)"} strokeWidth="2" className="transition-colors duration-200" />
        ) : (
          <line x1="50" y1="20" x2="60" y2="20" stroke={isActive ? "var(--accent)" : "var(--fg)"} strokeWidth="2" className="transition-colors duration-200" />
        )}
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
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          <g transform="translate(20, 0)">
            {layout.wires.map(renderWire)}
            {layout.nodes.map(renderNode)}
          </g>
        </g>
      </svg>
    </div>
  );
}
