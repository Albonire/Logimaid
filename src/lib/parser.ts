export type TokenType = 
  | 'KEYWORD' 
  | 'IDENTIFIER' 
  | 'EQUALS' 
  | 'COMMA' 
  | 'LPAREN' 
  | 'RPAREN' 
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
}

export interface Diagnostic {
  severity: 'Error' | 'Warning' | 'Info';
  message: string;
  line?: number;
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const lines = input.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    let line = lines[lineNum];
    
    // Remove comments
    const commentIdx = line.indexOf('#');
    if (commentIdx !== -1) {
      line = line.substring(0, commentIdx);
    }

    let i = 0;
    while (i < line.length) {
      const char = line[i];

      if (/\s/.test(char)) {
        i++;
        continue;
      }

      if (char === '=') {
        tokens.push({ type: 'EQUALS', value: '=', line: lineNum + 1 });
        i++;
        continue;
      }
      if (char === ',') {
        tokens.push({ type: 'COMMA', value: ',', line: lineNum + 1 });
        i++;
        continue;
      }
      if (char === '(') {
        tokens.push({ type: 'LPAREN', value: '(', line: lineNum + 1 });
        i++;
        continue;
      }
      if (char === ')') {
        tokens.push({ type: 'RPAREN', value: ')', line: lineNum + 1 });
        i++;
        continue;
      }

      const wordMatch = line.slice(i).match(/^[a-zA-Z0-9_]+/);
      if (wordMatch) {
        const word = wordMatch[0];
        if (word === 'INPUT' || word === 'OUTPUT') {
          tokens.push({ type: 'KEYWORD', value: word, line: lineNum + 1 });
        } else {
          tokens.push({ type: 'IDENTIFIER', value: word, line: lineNum + 1 });
        }
        i += word.length;
        continue;
      }

      throw new Error(`Unexpected character '${char}' at line ${lineNum + 1}`);
    }
  }

  tokens.push({ type: 'EOF', value: '', line: lines.length });
  return tokens;
}

export type Statement = InputStatement | GateStatement | OutputStatement;

export interface InputStatement {
  type: 'INPUT';
  names: string[];
}

export interface GateStatement {
  type: 'GATE';
  id: string;
  gateType: string;
  inputs: string[];
}

export interface OutputStatement {
  type: 'OUTPUT';
  name: string;
  source: string;
}

export interface ParseResult {
  statements: Statement[];
  diagnostics: Diagnostic[];
}

export function parse(input: string): ParseResult {
  const tokens = tokenize(input);
  const diagnostics: Diagnostic[] = [];
  const statements: Statement[] = [];
  let current = 0;
  let anonCounter = 0;

  function peek(): Token {
    return tokens[current];
  }

  function consume(type: TokenType, msg?: string): Token {
    if (peek().type === type) {
      return tokens[current++];
    }
    const token = peek();
    const errorMsg = msg || `Expected ${type}, got ${token.type}`;
    throw new Error(`${errorMsg} at line ${token.line}`);
  }

  function parseExpression(): string {
    const token = consume('IDENTIFIER', 'Expected identifier or gate type');
    
    if (peek().type === 'LPAREN') {
      const gateType = token.value.toUpperCase();
      consume('LPAREN');
      
      const args: string[] = [];
      if (peek().type !== 'RPAREN') {
        args.push(parseExpression());
        while (peek().type === 'COMMA') {
          consume('COMMA');
          args.push(parseExpression());
        }
      }
      consume('RPAREN');

      const anonId = `_g${anonCounter++}`;
      statements.push({ type: 'GATE', id: anonId, gateType, inputs: args });
      return anonId;
    } else {
      return token.value;
    }
  }

  try {
    while (peek().type !== 'EOF') {
      const token = peek();

      if (token.type === 'KEYWORD' && token.value === 'INPUT') {
        consume('KEYWORD');
        const names: string[] = [];
        names.push(consume('IDENTIFIER', 'Expected input name').value);
        while (peek().type === 'COMMA') {
          consume('COMMA');
          names.push(consume('IDENTIFIER', 'Expected input name').value);
        }
        statements.push({ type: 'INPUT', names });
      } else if (token.type === 'KEYWORD' && token.value === 'OUTPUT') {
        consume('KEYWORD');
        const labelToken = consume('IDENTIFIER', 'Expected output label');
        
        if (peek().type === 'EQUALS') {
          consume('EQUALS');
          const sourceId = parseExpression();
          statements.push({ type: 'OUTPUT', name: labelToken.value, source: sourceId });
        } else {
          statements.push({ type: 'OUTPUT', name: labelToken.value, source: labelToken.value });
        }
      } else if (token.type === 'IDENTIFIER') {
        const id = consume('IDENTIFIER').value;
        consume('EQUALS', `Expected '=' after identifier '${id}'`);
        const gateTypeToken = consume('IDENTIFIER', 'Expected gate type (e.g., AND, OR)');
        const gateType = gateTypeToken.value.toUpperCase();
        
        consume('LPAREN', 'Expected "(" after gate type');
        const args: string[] = [];
        if (peek().type !== 'RPAREN') {
          args.push(parseExpression());
          while (peek().type === 'COMMA') {
            consume('COMMA');
            args.push(parseExpression());
          }
        }
        consume('RPAREN', 'Expected ")"');
        
        statements.push({ type: 'GATE', id, gateType, inputs: args });
      } else {
        throw new Error(`Unexpected token '${token.value}' at line ${token.line}`);
      }
    }
    
    diagnostics.push({ severity: 'Info', message: `Successfully parsed ${statements.length} statements.` });
  } catch (err: any) {
    diagnostics.push({ severity: 'Error', message: err.message, line: peek().line });
    // Re-throw if error is fatal to the structure, but we return what we have
  }

  return { statements, diagnostics };
}
