import React, { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Code2, Cpu, Copy, Check, AlertCircle, Sparkles } from 'lucide-react';


function CopySnippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative">
      <pre className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded font-mono text-xs overflow-x-auto text-[var(--fg)]">
        {code}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)] opacity-0 group-hover:opacity-100 transition-all shadow-sm cursor-pointer"
        title="Copy to clipboard"
      >
        {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

const FULL_DOCS = `# LOGICSVG SYSTEM SPECIFICATION
# Use this context to generate valid LogicSVG circuit definitions.

## 1. LANGUAGE GRAMMAR
- IDENTIFIERS: Matches /[a-zA-Z0-9_]+/. Case-sensitive.
- COMMENTS: Lines starting with '#' are documentation/comments. Use them freely.
- KEYWORDS: INPUT, OUTPUT.
- GATE TYPES: AND, OR, NOT, NAND, NOR, XOR, XNOR.

## 2. SYNTAX (Supports Nesting)
- INPUT: INPUT <id1>, <id2>...
- GATE: <id> = <TYPE>(<expr1>, <expr2>...)
  - Note: Every gate must have a unique identifier.
  - NESTING: Expressions can be nested. Example: X = AND(OR(A, B), NOT(C))
- OUTPUT: OUTPUT <label> = <expr> OR OUTPUT <id>.
  - Note: Source can be an identifier or a full nested logic expression.

## 3. RULES
- Circuits must be Directed Acyclic Graphs (no cycles).
- All identifiers used must be defined (via INPUT or GATE) before or within expressions.
- One statement per line.
- The Truth Table is limited to circuits with 8 or fewer inputs.

## 4. EXAMPLE
# Full Adder using Nesting
INPUT A, B, Cin

Sum = XOR(XOR(A, B), Cin)
Cout = OR(AND(A, B), AND(XOR(A, B), Cin))

OUTPUT Sum
OUTPUT Cout
`;

export function Documentation() {
  const [isOpen, setIsOpen] = useState(false);
  const [allCopied, setAllCopied] = useState(false);

  const handleCopyAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(FULL_DOCS);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  };

  return (
    <div className="flex flex-col border border-[var(--border)] bg-[var(--surface)] rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-4 py-3 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-serif font-medium">
          <BookOpen size={16} className="text-[var(--muted)]" />
          Documentation
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAll}
            className="p-1.5 rounded-md hover:bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--fg)] transition-all cursor-pointer"
            title="Copy all documentation"
          >
            {allCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
          </button>
          {isOpen ? <ChevronUp size={16} className="text-[var(--muted)]" /> : <ChevronDown size={16} className="text-[var(--muted)]" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 flex flex-col gap-6 text-sm overflow-y-auto max-h-[500px]">
          <section className="flex flex-col gap-2">
            <h4 className="flex items-center gap-2 font-medium text-[var(--fg)]">
              <Code2 size={14} />
              Basic Syntax
            </h4>
            <p className="text-[var(--muted)] leading-relaxed">
              LogicSVG uses a declarative syntax. Lines starting with <code className="px-1.5 py-0.5 bg-[var(--bg)] rounded border border-[var(--border)] font-mono text-xs">#</code> are documentation/comment lines and are ignored by the simulator.
            </p>
          </section>

          <section className="flex flex-col gap-3">
             <div className="space-y-4">
               <div>
                 <p className="font-mono font-bold text-xs text-[var(--accent)] mb-1 uppercase tracking-tight">Inputs</p>
                 <p className="text-[var(--muted)] mb-2">Define signal inputs.</p>
                 <CopySnippet code="INPUT A, B, Cin" />
               </div>

               <div>
                 <p className="font-mono font-bold text-xs text-[var(--accent)] mb-1 uppercase tracking-tight">Gates & Expressions</p>
                 <p className="text-[var(--muted)] mb-2">Connect signals through logic gates. expressions can be nested for cleaner code.</p>
                 <CopySnippet code={`XOR1 = XOR(A, B)\nAND_ALL = AND(XOR1, NOT(Cin))`} />
               </div>

               <div>
                 <p className="font-mono font-bold text-xs text-[var(--accent)] mb-1 uppercase tracking-tight">Outputs</p>
                 <p className="text-[var(--muted)] mb-2">Define circuit outputs. Supports full expressions.</p>
                 <CopySnippet code={`OUTPUT Sum = XOR(XOR1, Cin)\nOUTPUT Carry = AND1`} />
               </div>
             </div>
          </section>

          <section className="flex flex-col gap-3">
            <h4 className="flex items-center gap-2 font-medium text-[var(--fg)]">
              <Cpu size={14} />
              Supported Gates
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR'].map(gate => (
                <div key={gate} className="px-2 py-1.5 bg-[var(--bg)] border border-[var(--border)] rounded font-mono text-[10px] text-center font-medium">
                  {gate}
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3 p-4 bg-stone-100 border border-stone-200 rounded-lg">
            <h4 className="flex items-center gap-2 font-medium text-[var(--fg)]">
              <Sparkles size={14} className="text-amber-600" />
              Advanced Features
            </h4>
            <ul className="list-disc list-inside text-[var(--muted)] space-y-1 text-xs">
              <li><strong>Recursion:</strong> Logic expressions <u>can</u> be nested infinitely (e.g., <code>A = AND(B, OR(C, D))</code>).</li>
              <li><strong>Flexible Outputs:</strong> Output definitions can directly contain logic expressions.</li>
              <li><strong>Auto-Layout:</strong> The system automatically manages internal connections for nested results.</li>
            </ul>
          </section>
          
          <section className="flex flex-col gap-3">
            <h4 className="flex items-center gap-2 font-medium text-[var(--fg)]">
              <BookOpen size={14} />
              AI Assistant Ready
            </h4>
            <p className="text-[var(--muted)] leading-relaxed">
              Optimized for AI assistants. Use the button in the header to provide the AI with this specification.
            </p>
            <div className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded text-[10px] text-[var(--muted)] font-mono">
              Tip: Tell the AI "Generate a [circuit name] using nested declarations."
            </div>
          </section>

          <section className="mt-2 pt-4 border-t border-[var(--border)]">
            <p className="text-[11px] text-[var(--muted)] italic leading-snug">
              Tip: Click on inputs in the diagram to toggle their state and see signals propagate.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
