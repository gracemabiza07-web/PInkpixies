const fs = require('fs');
let code = fs.readFileSync('main.js', 'utf8');

// Strip single line comments
code = code.replace(/\/\/.*/g, '');
// Strip multi line comments
code = code.replace(/\/\*[\s\S]*?\*\//g, '');
// Strip strings (simplistic)
code = code.replace(/`[^`]*`/g, '');
code = code.replace(/'[^']*'/g, '');
code = code.replace(/"[^"]*"/g, '');

let stack = [];
const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
    for (let j = 0; j < lines[i].length; j++) {
        const c = lines[i][j];
        if (c === '(') {
            stack.push(i + 1);
        } else if (c === ')') {
            if (stack.length === 0) {
                console.log('Extra ) found at line ' + (i + 1));
            } else {
                stack.pop();
            }
        } else if (c === '{') {
            stack.push('{'+(i+1));
        } else if (c === '}') {
            let last = stack[stack.length-1];
            if (typeof last === 'string' && last.startsWith('{')) {
                stack.pop();
            } else {
                console.log('Extra } or mismatched brace at line ' + (i+1) + ', stack: ' + stack.slice(-5));
                if (typeof last === 'string' && last.startsWith('{')) stack.pop(); // try to recover
                else if (typeof last === 'number') {
                     console.log('Seems like missing ) for ( at line ' + last);
                }
            }
        }
    }
}
console.log('Unmatched elements in stack:', stack);
