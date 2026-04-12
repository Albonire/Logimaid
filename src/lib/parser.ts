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
  let anonCounter = 0;
  const statements: Statement[] = [];

  function peek(): Token {
    return tokens[current];
  }

  function lookAhead(n: number = 1): Token {
    return tokens[current + n] || tokens[tokens.length - 1];
  }

  function consume(type: TokenType, msg?: string): Token {
    if (peek().type === type) {
      return tokens[current++];
    }
    throw new Error(msg || `Expected ${type}, got ${peek().type} at line ${peek().line}`);
  }

  function parseExpression(): string {
    const token = consume('IDENTIFIER', 'Expected identifier or gate type');
    
    if (peek().type === 'LPAREN') {
      // It's a nested gate call: GATETYPE(arg1, arg2...)
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
      // It's a simple identifier (variable/input)
      return token.value;
    }
  }

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
        // Shorthand: OUTPUT Y (matches source with same name)
        statements.push({ type: 'OUTPUT', name: labelToken.value, source: labelToken.value });
      }
    } else if (token.type === 'IDENTIFIER') {
      const id = consume('IDENTIFIER').value;
      consume('EQUALS', `Expected '=' after identifier '${id}'`);
      
      // Right hand side should be a gate expression
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

  return statements;
}
