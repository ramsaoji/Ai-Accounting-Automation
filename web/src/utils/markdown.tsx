import React, { useMemo } from 'react';

interface MessageTextProps {
  text: string;
  isUser?: boolean;
}

function parseInlineStyles(text: string): React.ReactNode[] {
  // Split on bold (**), italic (*), inline code (`), and links ([text](url))
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index} className="italic">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="bg-muted dark:bg-muted/80 text-foreground px-1.5 py-0.5 rounded font-mono text-[0.85em] border border-border/50">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const match = part.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        return (
          <a key={index} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors font-medium">
            {match[1]}
          </a>
        );
      }
    }
    return part;
  });
}

export interface MarkdownBlock {
  type: 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'list-unordered' | 'list-ordered' | 'code-block' | 'table' | 'spacer';
  lines: string[];
  lang?: string;
}

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.split('\n');
  const blocks: MarkdownBlock[] = [];
  let currentBlock: MarkdownBlock | null = null;
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // 1. Code block
    if (trimmed.startsWith('```')) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'code-block',
        lines: codeLines,
        lang
      });
      i++; // skip closing backticks
      continue;
    }
    
    // 2. Table lines (outside code block)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (currentBlock && currentBlock.type !== 'table') {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) {
        currentBlock = { type: 'table', lines: [] };
      }
      currentBlock.lines.push(line);
      i++;
      continue;
    }
    
    if (currentBlock && currentBlock.type === 'table') {
      blocks.push(currentBlock);
      currentBlock = null;
    }
    
    // 3. Headings
    if (line.startsWith('# ')) {
      if (currentBlock) blocks.push(currentBlock);
      blocks.push({ type: 'heading1', lines: [line.slice(2)] });
      currentBlock = null;
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      if (currentBlock) blocks.push(currentBlock);
      blocks.push({ type: 'heading2', lines: [line.slice(3)] });
      currentBlock = null;
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      if (currentBlock) blocks.push(currentBlock);
      blocks.push({ type: 'heading3', lines: [line.slice(4)] });
      currentBlock = null;
      i++;
      continue;
    }
    
    // 4. Unordered List Items
    if (line.startsWith('* ') || line.startsWith('- ')) {
      if (currentBlock && currentBlock.type !== 'list-unordered') {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) {
        currentBlock = { type: 'list-unordered', lines: [] };
      }
      currentBlock.lines.push(line.slice(2));
      i++;
      continue;
    }
    
    // 5. Ordered List Items
    const orderedMatch = line.match(/^(\d+)\.\s(.*)/);
    if (orderedMatch) {
      if (currentBlock && currentBlock.type !== 'list-ordered') {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) {
        currentBlock = { type: 'list-ordered', lines: [] };
      }
      currentBlock.lines.push(orderedMatch[2]);
      i++;
      continue;
    }
    
    // 6. Spacer
    if (!trimmed) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      blocks.push({ type: 'spacer', lines: [''] });
      i++;
      continue;
    }
    
    // 7. Paragraph
    if (currentBlock && currentBlock.type !== 'paragraph') {
      blocks.push(currentBlock);
      currentBlock = null;
    }
    if (!currentBlock) {
      currentBlock = { type: 'paragraph', lines: [] };
    }
    currentBlock.lines.push(line);
    i++;
  }
  
  if (currentBlock) {
    blocks.push(currentBlock);
  }
  
  return blocks;
}

export const SafeMarkdown: React.FC<{ text: string }> = ({ text }) => {
  const blocks = useMemo(() => parseMarkdownBlocks(text), [text]);
  
  return (
    <div className="space-y-2">
      {blocks.map((block, bIdx) => {
        switch (block.type) {
          case 'heading1':
            return <h1 key={bIdx} className="text-base sm:text-lg font-bold mt-4 mb-2 text-foreground">{parseInlineStyles(block.lines[0])}</h1>;
          case 'heading2':
            return <h2 key={bIdx} className="text-sm sm:text-base font-bold mt-3 mb-1.5 text-foreground">{parseInlineStyles(block.lines[0])}</h2>;
          case 'heading3':
            return <h3 key={bIdx} className="text-xs sm:text-sm font-bold mt-2 mb-1 text-foreground">{parseInlineStyles(block.lines[0])}</h3>;
          case 'list-unordered':
            return (
              <ul key={bIdx} className="list-disc list-inside pl-1 sm:pl-2 my-1 space-y-1">
                {block.lines.map((item, itemIdx) => (
                  <li key={itemIdx} className="leading-relaxed">{parseInlineStyles(item)}</li>
                ))}
              </ul>
            );
          case 'list-ordered':
            return (
              <ol key={bIdx} className="list-decimal list-inside pl-1 sm:pl-2 my-1 space-y-1">
                {block.lines.map((item, itemIdx) => (
                  <li key={itemIdx} className="leading-relaxed">{parseInlineStyles(item)}</li>
                ))}
              </ol>
            );
          case 'code-block':
            return (
              <pre key={bIdx} className="bg-muted dark:bg-muted/70 p-2 sm:p-3 rounded-lg font-mono text-[0.78rem] sm:text-xs overflow-x-auto my-2 border border-border/80 text-foreground">
                <code>{block.lines.join('\n')}</code>
              </pre>
            );
          case 'spacer':
            return <div key={bIdx} className="h-1 sm:h-1.5" />;
          case 'table': {
            const rows = block.lines.map(line => 
              line.split('|')
                .map(cell => cell.trim())
                .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
            );
            
            const isDividerRow = (row: string[]) => row.every(cell => /^:?-+:?$/.test(cell) || cell.length === 0);
            
            const headerRow = rows[0] || [];
            const bodyRows = rows.slice(1).filter(row => !isDividerRow(row));
            
            return (
              <div key={bIdx} className="overflow-x-auto my-2.5 rounded-lg border border-border max-w-full">
                <table className="min-w-full divide-y divide-border text-[0.75rem] sm:text-xs leading-normal">
                  <thead className="bg-muted/65">
                    <tr>
                      {headerRow.map((cell, idx) => (
                        <th key={idx} className="px-2.5 py-1.5 sm:px-3 sm:py-2 text-left font-bold text-foreground/80 border-r last:border-r-0 border-border">
                          {parseInlineStyles(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {bodyRows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-muted/20">
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="px-2.5 py-1.5 sm:px-3 sm:py-2 text-foreground/95 border-r last:border-r-0 border-border">
                            {parseInlineStyles(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          case 'paragraph':
          default:
            return <p key={bIdx} className="leading-relaxed my-1">{parseInlineStyles(block.lines.join('\n'))}</p>;
        }
      })}
    </div>
  );
};

export const MessageText: React.FC<MessageTextProps> = ({ text, isUser = false }) => {
  const textColor = isUser ? 'text-white' : 'text-foreground/90';
  return (
    <div className={`markdown-content ${textColor}`}>
      <SafeMarkdown text={text} />
    </div>
  );
};
