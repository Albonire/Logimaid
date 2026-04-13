import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, Play, AlertCircle, FileCode2, Table2, 
  Maximize2, Minimize2, Image as ImageIcon, ChevronDown, 
  Sun, Moon, Terminal, FileSpreadsheet, CheckCircle2, 
  Info, AlertTriangle, Copy
} from 'lucide-react';
import { parse, Diagnostic } from './lib/parser';
import { Circuit } from './lib/circuit';
import { layoutCircuit, LayoutResult } from './lib/layout';
import { LogicSVG } from './components/LogicSVG';
import { Documentation } from './components/Documentation';

const DEFAULT_CODE = `# LogicSVG Circuit
# Feel free to use nested gate calls!

INPUT A, B, Cin

# Nested logic for Sum
Sum = XOR(XOR(A, B), Cin)

# Nested logic for Carry Out
Cout = OR(AND(A, B), AND(XOR(A, B), Cin))

OUTPUT Sum
OUTPUT Cout
`;

const EXAMPLES = [
  { name: 'Half Adder', code: `INPUT A, B\n\nXOR1 = XOR(A, B)\nAND1 = AND(A, B)\n\nOUTPUT Sum = XOR1\nOUTPUT Carry = AND1` },
  { name: 'Full Adder', code: `INPUT A, B, Cin\n\nSum = XOR(XOR(A, B), Cin)\nCout = OR(AND(A, B), AND(XOR(A, B), Cin))\n\nOUTPUT Sum\nOUTPUT Cout` },
  { name: '2-Bit Comparator', code: `INPUT A1, A0, B1, B0\n\n# A > B logic\nG1 = AND(A1, NOT(B1))\nG2 = AND(A0, NOT(B0))\nG3 = XNOR(A1, B1)\nGT = OR(G1, AND(G3, G2))\n\n# A < B logic\nL1 = AND(NOT(A1), B1)\nL2 = AND(NOT(A0), B0)\nL3 = XNOR(A1, B1)\nLT = OR(L1, AND(L3, L2))\n\n# Equal\nEQ = AND(XNOR(A1, B1), XNOR(A0, B0))\n\nOUTPUT A_gt_B = GT\nOUTPUT A_lt_B = LT\nOUTPUT Equal = EQ` },
];

export default function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [layoutResult, setLayoutResult] = useState<LayoutResult | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [inputState, setInputState] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'diagram' | 'truthTable' | 'logs'>('diagram');
  const [isMaximized, setIsMaximized] = useState(false);
  const [evalVersion, setEvalVersion] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  
  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const compileCircuit = (source: string) => {
    try {
      const { statements, diagnostics: parseDiag } = parse(source);
      const newCircuit = new Circuit(statements);
      const allDiag = [...parseDiag, ...newCircuit.diagnostics];
      
      setDiagnostics(allDiag);

      if (allDiag.some(d => d.severity === 'Error')) {
        setCircuit(null);
        setLayoutResult(null);
        return;
      }

      const result = layoutCircuit(newCircuit);
      
      // Initialize input state if needed
      const initialInputs: Record<string, boolean> = {};
      newCircuit.inputs.forEach(i => initialInputs[i] = inputState[i] || false);
      
      setCircuit(newCircuit);
      setLayoutResult(result);
      setInputState(initialInputs);
      newCircuit.evaluate(initialInputs);
      setEvalVersion(v => v + 1);
    } catch (err: any) {
      setDiagnostics([{ severity: 'Error', message: err.message || 'System error during compilation' }]);
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
    setEvalVersion(v => v + 1);
  };

  const getHighFidelitySVG = (): { source: string, width: number, height: number } | null => {
    if (!svgContainerRef.current) return null;
    const originalSvg = svgContainerRef.current.querySelector('svg');
    if (!originalSvg) return null;

    const svgElement = originalSvg.cloneNode(true) as SVGSVGElement;
    const rootStyle = getComputedStyle(document.documentElement);
    const themeVars = ['bg', 'surface', 'fg', 'muted', 'border', 'accent', 'accentFg'];
    const varDefinitions = themeVars
      .map(v => `--${v}: ${rootStyle.getPropertyValue(`--${v}`).trim()};`)
      .join('\n      ');

    const fontMono = rootStyle.getPropertyValue('--font-mono').trim() || 'ui-monospace, monospace';
    const fontSans = rootStyle.getPropertyValue('--font-sans').trim() || 'ui-sans-serif, system-ui';

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

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", "100%");
    rect.setAttribute("height", "100%");
    rect.setAttribute("fill", "var(--bg)");
    svgElement.insertBefore(rect, svgElement.childNodes[1]);

    const serializer = new XMLSerializer();
    
    // Reset pan/zoom transform before exporting
    const transformGroup = svgElement.querySelector('.logic-transform-group');
    if (transformGroup) {
      transformGroup.removeAttribute('transform');
    }

    let source = serializer.serializeToString(svgElement);
    return {
      source: '<?xml version="1.0" standalone="no"?>\r\n' + source,
      width: originalSvg.viewBox.baseVal.width || 800,
      height: originalSvg.viewBox.baseVal.height || 600
    };
  };

  const handleDownloadSVG = () => {
    const result = getHighFidelitySVG();
    if (result) {
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(result.source);
      const link = document.createElement("a");
      link.href = url;
      link.download = `logic-circuit-${new Date().getTime()}.svg`;
      link.click();
    }
  };

  const handleDownloadJPG = () => {
    const result = getHighFidelitySVG();
    if (!result) return;
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = result.width * scale;
    canvas.height = result.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    const svgBlob = new Blob([result.source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const jpgUrl = canvas.toDataURL('image/jpeg', 0.9);
      const link = document.createElement("a");
      link.href = jpgUrl;
      link.download = `logic-circuit-${new Date().getTime()}.jpg`;
      link.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleCopyImage = async () => {
    const result = getHighFidelitySVG();
    if (!result) return;
    
    const canvas = document.createElement('canvas');
    const scale = 3; // Higher scale for clipboard
    canvas.width = result.width * scale;
    canvas.height = result.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    const svgBlob = new Blob([result.source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = async () => {
      try {
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              const item = new ClipboardItem({ 'image/png': blob });
              await navigator.clipboard.write([item]);
              alert('Diagram copied to clipboard as PNG!');
            } catch (err) {
              console.error('Clipboard error:', err);
              alert('Could not copy to clipboard. Please check browser permissions.');
            }
          }
          URL.revokeObjectURL(url);
        }, 'image/png');
      } catch (err) {
        console.error('Export error:', err);
        URL.revokeObjectURL(url);
      }
    };
    img.src = url;
  };

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300">
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4 flex items-center justify-between shadow-sm z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[var(--accent)] rounded-md flex items-center justify-center text-[var(--accentFg)] font-serif italic font-medium transition-transform hover:rotate-12">
            L
          </div>
          <div>
            <h1 className="text-xl font-serif font-medium tracking-tight">LogicSVG</h1>
            <p className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-bold">Pro Circuit Engine</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-full hover:bg-[var(--bg)] transition-colors text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer border border-transparent hover:border-[var(--border)]"
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            title="Toggle theme"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="w-px h-6 bg-[var(--border)]" />
          <p className="text-xs text-[var(--muted)] font-medium hidden sm:block">Fabian González</p>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Editor */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--fg)] flex items-center gap-2">
                <FileCode2 size={16} className="text-[var(--muted)]" />
                Circuit Definition
              </label>
              <button
                onClick={() => compileCircuit(code)}
                className="flex items-center gap-1.5 text-xs bg-[var(--accent)] text-[var(--accentFg)] px-3 py-1.5 rounded-md hover:opacity-90 transition-all shadow-sm hover:shadow active:scale-95"
              >
                <Play size={14} />
                Compile
              </button>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-[450px] p-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--border)] resize-none transition-shadow"
              spellCheck={false}
            />
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Templates</h3>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.name}
                  onClick={() => {
                    setCode(ex.code);
                    compileCircuit(ex.code);
                  }}
                  className="text-xs border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg)] px-3 py-1.5 rounded-md transition-all cursor-pointer hover:shadow-sm"
                >
                  {ex.name}
                </button>
              ))}
            </div>
            <Documentation />
          </div>
        </div>

        {/* Right Column: Visualization */}
        <div className={`flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden min-h-[500px] transition-all duration-300 shadow-sm ${isMaximized ? 'fixed inset-4 z-50 shadow-2xl' : 'lg:col-span-8 relative'}`}>
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2 bg-[var(--bg)]">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('diagram')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'diagram' ? 'bg-[var(--surface)] shadow-sm text-[var(--fg)] border border-[var(--border)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
              >
                <FileCode2 size={14} />
                Diagram
              </button>
              <button
                onClick={() => setActiveTab('truthTable')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'truthTable' ? 'bg-[var(--surface)] shadow-sm text-[var(--fg)] border border-[var(--border)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
              >
                <Table2 size={14} />
                Truth Table
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'logs' ? 'bg-[var(--surface)] shadow-sm text-[var(--fg)] border border-[var(--border)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
              >
                <Terminal size={14} />
                Compiler Logs
                {diagnostics.some(d => d.severity === 'Error') && <span className="w-2 h-2 rounded-full bg-[var(--error)] animate-pulse" />}
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              {activeTab === 'diagram' && (
                <div className="relative group">
                  <button
                    disabled={!layoutResult}
                    className="flex items-center gap-1.5 text-xs font-medium rounded-md py-1.5 px-3 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] disabled:opacity-50 transition-all cursor-pointer border border-transparent hover:border-[var(--border)]"
                  >
                    <Download size={14} />
                    Export
                    <ChevronDown size={12} className="opacity-50" />
                  </button>
                  <div className="absolute right-0 top-full pt-1 opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all z-50">
                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl py-1 min-w-[160px] overflow-hidden">
                      <button onClick={handleDownloadSVG} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-left hover:bg-[var(--bg)] text-[var(--fg)] transition-colors cursor-pointer">
                        <FileCode2 size={14} className="text-[var(--muted)]" />
                        Vector (SVG)
                      </button>
                      <button onClick={handleDownloadJPG} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-left hover:bg-[var(--bg)] text-[var(--fg)] transition-colors cursor-pointer">
                        <ImageIcon size={14} className="text-[var(--muted)]" />
                        Image (JPG)
                      </button>
                      <button onClick={handleCopyImage} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-left hover:bg-[var(--bg)] text-[var(--fg)] transition-colors cursor-pointer border-t border-[var(--border)]">
                        <Copy size={14} className="text-[var(--muted)]" />
                        Copy Image
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="w-px h-4 bg-[var(--border)] hidden sm:block" />
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)] transition-colors p-1.5 hover:bg-[var(--surface)] rounded cursor-pointer"
                aria-label={isMaximized ? "Minimize" : "Maximize"}
                title={isMaximized ? "Minimize" : "Maximize"}
              >
                {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
            </div>
          </div>
          
          <div className="flex-1 relative overflow-auto p-6 bg-[var(--bg)]" ref={svgContainerRef}>
            {activeTab === 'diagram' ? (
              circuit && layoutResult ? (
                <React.Fragment key={evalVersion}>
                  <LogicSVG layout={layoutResult} circuit={circuit} onToggleInput={handleToggleInput} />
                </React.Fragment>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[var(--muted)] text-sm italic">
                  Complete the circuit definition to see the diagram.
                </div>
              )
            ) : activeTab === 'truthTable' ? (
              <div className="w-full h-full flex flex-col gap-4">
                {circuit ? <TruthTableView circuit={circuit} /> : <div className="text-center p-12 text-[var(--muted)] italic">No table available.</div>}
              </div>
            ) : (
              <div className="w-full h-full flex flex-col">
                <LogsArea diagnostics={diagnostics} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function LogsArea({ diagnostics }: { diagnostics: Diagnostic[] }) {
  if (diagnostics.length === 0) return <div className="text-center p-12 text-[var(--muted)] italic">No relevant logs.</div>;

  return (
    <div className="flex flex-col gap-2 font-mono text-xs">
      {diagnostics.map((diag, i) => {
        const Icon = diag.severity === 'Error' ? AlertCircle : diag.severity === 'Warning' ? AlertTriangle : Info;
        const colorClass = diag.severity === 'Error'
          ? 'text-[var(--error)] border-[var(--errorBorder)] bg-[var(--errorBg)]'
          : diag.severity === 'Warning'
            ? 'text-[var(--warning)] border-[var(--warningBorder)] bg-[var(--warningBg)]'
            : 'text-[var(--info)] border-[var(--infoBorder)] bg-[var(--infoBg)]';

        return (
          <div key={i} className={`p-3 border rounded-md flex gap-3 ${colorClass} animate-in fade-in slide-in-from-left-2 duration-300`}>
            <Icon size={14} className="shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-bold uppercase text-[10px] opacity-70">{diag.severity}</span>
                {diag.line && <span className="opacity-50">[Line {diag.line}]</span>}
              </div>
              <p className="leading-relaxed">{diag.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TruthTableView({ circuit }: { circuit: Circuit }) {
  const [data, setData] = useState<{ headers: string[], rows: boolean[][], totalRows: number } | null>(null);

  useEffect(() => {
    setData(circuit.generateTruthTable(100)); // Limit to 100 in the UI
  }, [circuit]);

  if (!data) return null;

  const downloadCSV = () => {
    const { headers, rows } = circuit.generateTruthTable(1000000); // Massive limit for CSV
    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(v => v ? '1' : '0').join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `truth-table-${new Date().getTime()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex flex-col">
          <p className="text-xs font-medium text-[var(--fg)]">Total State Possibilities: {data.totalRows}</p>
          {data.totalRows > 100 && (
            <p className="text-[10px] text-[var(--warning)] font-medium"> Previewing first 100 states only. Download CSV for full data.</p>
          )}
        </div>
        <button 
          onClick={downloadCSV}
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider bg-[var(--surface)] border border-[var(--border)] px-4 py-2 rounded-md hover:bg-[var(--bg)] transition-colors cursor-pointer"
        >
          <FileSpreadsheet size={14} />
          Export Full CSV
        </button>
      </div>

      <div className="overflow-auto border border-[var(--border)] rounded-lg bg-[var(--surface)] max-h-[600px]">
        <table className="min-w-full text-[10px] text-left">
          <thead className="bg-[var(--bg)] border-b border-[var(--border)] sticky top-0 z-10">
            <tr>
              {data.headers.map((h, i) => (
                <th key={i} className="px-4 py-3 font-bold text-[var(--muted)] uppercase tracking-tighter">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {data.rows.map((row, i) => (
              <tr key={i} className="hover:bg-[var(--bg)] transition-colors group">
                {row.map((val, j) => (
                  <td key={j} className="px-4 py-2 font-mono">
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-sm text-[10px] font-bold ${val ? 'bg-[var(--accent)] text-[var(--accentFg)]' : 'bg-[var(--border)]/30 text-[var(--muted)]'}`}>
                      {val ? '1' : '0'}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
