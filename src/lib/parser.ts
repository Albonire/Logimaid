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

export function parse(input: string): Statement[] {
  const tokens = tokenize(input);
  let current = 0;

  function peek(): Token {
    return tokens[current];
  }

  function consume(type: TokenType, msg?: string): Token {
    if (peek().type === type) {
      return tokens[current++];
    }
    throw new Error(msg || `Expected ${type}, got ${peek().type} at line ${peek().line}`);
  }

  const statements: Statement[] = [];

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
      const nameOrSource = consume('IDENTIFIER', 'Expected output name or source').value;
      if (peek().type === 'EQUALS') {
        consume('EQUALS');
        const source = consume('IDENTIFIER', 'Expected source identifier').value;
        statements.push({ type: 'OUTPUT', name: nameOrSource, source });
      } else {
        statements.push({ type: 'OUTPUT', name: nameOrSource, source: nameOrSource });
      }
    } else if (token.type === 'IDENTIFIER') {
      const id = consume('IDENTIFIER').value;
      consume('EQUALS', `Expected '=' after identifier '${id}'`);
      const gateType = consume('IDENTIFIER', 'Expected gate type (e.g., AND, OR)').value.toUpperCase();
      consume('LPAREN', 'Expected "("');
      const inputs: string[] = [];
      if (peek().type !== 'RPAREN') {
        inputs.push(consume('IDENTIFIER', 'Expected input identifier').value);
        while (peek().type === 'COMMA') {
          consume('COMMA');
          inputs.push(consume('IDENTIFIER', 'Expected input identifier').value);
        }
      }
      consume('RPAREN', 'Expected ")"');
      statements.push({ type: 'GATE', id, gateType, inputs });
    } else {
      throw new Error(`Unexpected token '${token.value}' at line ${token.line}`);
    }
  }

  return statements;
}
