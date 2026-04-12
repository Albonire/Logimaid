import React, { useState, useEffect, useRef } from 'react';
import { Download, Play, AlertCircle, FileCode2, Table2, Maximize2, Minimize2 } from 'lucide-react';
import { parse } from './lib/parser';
import { Circuit } from './lib/circuit';
import { layoutCircuit, LayoutResult } from './lib/layout';
import { LogicSVG } from './components/LogicSVG';
import { Documentation } from './components/Documentation';

const DEFAULT_CODE = `# Define inputs
INPUT A, B

# Define intermediate gates
XOR1 = XOR(A, B)
AND1 = AND(A, B)

# Define outputs
OUTPUT Sum = XOR1
OUTPUT Carry = AND1
`;

const EXAMPLES = [
  { name: 'Half Adder', code: `INPUT A, B\n\nXOR1 = XOR(A, B)\nAND1 = AND(A, B)\n\nOUTPUT Sum = XOR1\nOUTPUT Carry = AND1` },
  { name: 'Full Adder', code: `INPUT A, B, Cin\n\nXOR1 = XOR(A, B)\nAND1 = AND(A, B)\n\nXOR2 = XOR(XOR1, Cin)\nAND2 = AND(XOR1, Cin)\n\nOR1 = OR(AND1, AND2)\n\nOUTPUT Sum = XOR2\nOUTPUT Cout = OR1` },
  { name: 'SR Latch', code: `INPUT S, R\n\nNOR1 = NOR(R, NOR2)\nNOR2 = NOR(S, NOR1)\n\nOUTPUT Q = NOR1\nOUTPUT Q_not = NOR2` },
];

export default function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [layoutResult, setLayoutResult] = useState<LayoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputState, setInputState] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'diagram' | 'truthTable'>('diagram');
  const [isMaximized, setIsMaximized] = useState(false);
  
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const compileCircuit = (source: string) => {
    try {
      setError(null);
      const ast = parse(source);
      const newCircuit = new Circuit(ast);
      const result = layoutCircuit(newCircuit);
      
      // Initialize input state
      const initialInputs: Record<string, boolean> = {};
      newCircuit.inputs.forEach(i => initialInputs[i] = false);
      
      setCircuit(newCircuit);
      setLayoutResult(result);
      setInputState(initialInputs);
      
      // Initial evaluation
      newCircuit.evaluate(initialInputs);
    } catch (err: any) {
      setError(err.message || 'Failed to compile circuit');
      setCircuit(null);
      setLayoutResult(null);
    }
  };

  useEffect(() => {
    compileCircuit(code);
  }, []);

  const handleToggleInput = (inputId: string) => {
    if (!circuit) return;
    const newState = { ...inputState, [inputId]: !inputState[inputId] };
    setInputState(newState);
    circuit.evaluate(newState);
    // Force re-render to show updated wire states
    setCircuit(Object.assign(Object.create(Object.getPrototypeOf(circuit)), circuit));
  };

  const handleDownloadSVG = () => {
    if (!svgContainerRef.current) return;
    const originalSvg = svgContainerRef.current.querySelector('svg');
    if (!originalSvg) return;

    // Clone the SVG to avoid modifying the live UI
    const svgElement = originalSvg.cloneNode(true) as SVGSVGElement;
    
    // Capture current CSS variable values from the theme
    const rootStyle = getComputedStyle(document.documentElement);
    const themeVars = ['bg', 'surface', 'fg', 'muted', 'border', 'accent', 'accentFg'];
    const varDefinitions = themeVars
      .map(v => `--${v}: ${rootStyle.getPropertyValue(`--${v}`).trim()};`)
      .join('\n      ');

    const fontMono = rootStyle.getPropertyValue('--font-mono').trim() || 'ui-monospace, monospace';
    const fontSans = rootStyle.getPropertyValue('--font-sans').trim() || 'ui-sans-serif, system-ui';

    // Create and inject style element
    const styleElement = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleElement.textContent = `
      :root {
        ${varDefinitions}
        --font-mono: ${fontMono};
        --font-sans: ${fontSans};
      }
      svg { background-color: var(--bg); font-family: var(--font-sans); }
      text { font-family: var(--font-mono); }
    `;
    svgElement.prepend(styleElement);

    // Add a background rectangle to maintain the Stone theme in the standalone file
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", "100%");
    rect.setAttribute("height", "100%");
    rect.setAttribute("fill", "var(--bg)");
    // Insert after the style element but before existing content
    svgElement.insertBefore(rect, svgElement.childNodes[1]);

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgElement);
    
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
    
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `logic-circuit-${new Date().getTime()}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[var(--accent)] rounded-md flex items-center justify-center text-[var(--accentFg)] font-serif italic font-medium">
            L
          </div>
          <h1 className="text-xl font-serif font-medium tracking-tight">LogicSVG</h1>
        </div>
        <p className="text-sm text-[var(--muted)]">Declarative Logic Circuits</p>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Editor */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--fg)]">Circuit Definition</label>
              <button
                onClick={() => compileCircuit(code)}
                className="flex items-center gap-1.5 text-xs bg-[var(--accent)] text-[var(--accentFg)] px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
              >
                <Play size={14} />
                Compile
              </button>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-[400px] p-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
              spellCheck={false}
            />
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-[var(--fg)]">Examples</h3>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.name}
                  onClick={() => {
                    setCode(ex.code);
                    compileCircuit(ex.code);
                  }}
                  className="text-xs border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg)] px-3 py-1.5 rounded-md transition-colors"
                >
                  {ex.name}
                </button>
              ))}
          </div>
          <Documentation />
        </div>
      </div>

        {/* Right Column: Visualization */}
        <div className={`flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden min-h-[500px] transition-all duration-300 ${isMaximized ? 'fixed inset-4 z-50 shadow-2xl' : 'lg:col-span-8 relative'}`}>
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2 bg-[var(--bg)]">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('diagram')}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${activeTab === 'diagram' ? 'bg-[var(--surface)] shadow-sm text-[var(--fg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
              >
                <FileCode2 size={16} />
                Diagram
              </button>
              <button
                onClick={() => setActiveTab('truthTable')}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${activeTab === 'truthTable' ? 'bg-[var(--surface)] shadow-sm text-[var(--fg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
              >
                <Table2 size={16} />
                Truth Table
              </button>
            </div>
            {activeTab === 'diagram' && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadSVG}
                  disabled={!layoutResult}
                  className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)] disabled:opacity-50 transition-colors"
                >
                  <Download size={16} />
                  Export SVG
                </button>
                <div className="w-px h-4 bg-[var(--border)] mx-1" />
                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)] transition-colors p-1 hover:bg-[var(--surface)] rounded cursor-pointer"
                  title={isMaximized ? "Minimize" : "Maximize"}
                >
                  {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
              </div>
            )}
          </div>
          
          <div className="flex-1 relative overflow-auto p-6" ref={svgContainerRef}>
            {error ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center text-red-800 max-w-md text-center p-6 bg-red-50 rounded-lg border border-red-100">
                  <AlertCircle size={24} className="mb-3 text-red-600" />
                  <p className="font-medium text-sm">Compilation Error</p>
                  <p className="text-sm mt-1 opacity-80 font-mono">{error}</p>
                </div>
              </div>
            ) : circuit && layoutResult ? (
              activeTab === 'diagram' ? (
                <div className="w-full h-full flex items-center justify-center min-w-max min-h-max">
                   <LogicSVG layout={layoutResult} circuit={circuit} onToggleInput={handleToggleInput} />
                </div>
              ) : (
                <div className="w-full flex justify-center">
                  <TruthTableView circuit={circuit} />
                </div>
              )
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--muted)] text-sm">
                No circuit compiled.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function TruthTableView({ circuit }: { circuit: Circuit }) {
  try {
    const { headers, rows } = circuit.generateTruthTable();
    
    return (
      <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-[var(--bg)] border-b border-[var(--border)]">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-3 font-medium text-[var(--fg)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-[var(--bg)] transition-colors">
                {row.map((val, j) => (
                  <td key={j} className="px-4 py-2 font-mono">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-sm ${val ? 'bg-[var(--accent)] text-[var(--accentFg)]' : 'bg-transparent text-[var(--muted)]'}`}>
                      {val ? '1' : '0'}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } catch (err: any) {
    return (
      <div className="text-red-600 text-sm p-4 bg-red-50 rounded-lg border border-red-100">
        {err.message || 'Failed to generate truth table.'}
      </div>
    );
  }
}
