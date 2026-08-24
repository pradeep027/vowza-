// ─── Markdown Message Renderer ────────────────────────────────────────────────
// Renders markdown inside chat bubbles: bold, italic, lists, tables, code blocks.
// Zero external dependencies — pure CSS + regex.

import { useMemo } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  text: string;
  className?: string;
}

// ─── Table parser ─────────────────────────────────────────────────────────────
function parseTable(block: string): React.ReactNode {
  const rows = block.trim().split('\n').filter(r => r.trim() && !r.match(/^\|[-| :]+\|$/));
  if (rows.length < 1) return null;

  const parseRow = (row: string) =>
    row.split('|').map(c => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1);

  const headers = parseRow(rows[0]);
  const body = rows.slice(1);

  return (
    <div className="overflow-x-auto my-3 rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-foreground border-b border-border">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
              {parseRow(row).map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-muted-foreground">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Inline formatter (bold, italic, code, links) ─────────────────────────────
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Matches: **bold**, *italic*, `code`, [text](url)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.*?)\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Push plain text before match
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    if (match[1].startsWith('**')) {
      parts.push(<strong key={match.index} className="font-semibold text-foreground">{match[2]}</strong>);
    } else if (match[1].startsWith('*')) {
      parts.push(<em key={match.index} className="italic">{match[3]}</em>);
    } else if (match[1].startsWith('`')) {
      parts.push(
        <code key={match.index} className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-maroon">
          {match[4]}
        </code>
      );
    } else if (match[5]) {
      const url = match[6];
      const isInternal = url.startsWith('/');
      parts.push(
        isInternal ? (
          <Link key={match.index} to={url} className="text-gold underline hover:text-gold-dark transition-colors">
            {match[5]}
          </Link>
        ) : (
          <a key={match.index} href={url} target="_blank" rel="noopener noreferrer"
             className="text-gold underline hover:text-gold-dark transition-colors">
            {match[5]}
          </a>
        )
      );
    }
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
}

// ─── Block renderer ───────────────────────────────────────────────────────────
function renderBlocks(text: string): React.ReactNode[] {
  const blocks: React.ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block ```
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push(
        <pre key={key++} className="my-3 p-3 rounded-xl bg-muted overflow-x-auto">
          <code className="font-mono text-xs text-foreground leading-relaxed">
            {codeLines.join('\n')}
          </code>
        </pre>
      );
      i++;
      continue;
    }

    // Table (starts with |)
    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      blocks.push(<div key={key++}>{parseTable(tableLines.join('\n'))}</div>);
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      blocks.push(
        <h3 key={key++} className="text-base font-display font-semibold text-foreground mt-4 mb-1">
          {renderInline(line.slice(4))}
        </h3>
      );
      i++; continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(
        <h2 key={key++} className="text-lg font-display font-bold text-foreground mt-4 mb-1">
          {renderInline(line.slice(3))}
        </h2>
      );
      i++; continue;
    }
    if (line.startsWith('# ')) {
      blocks.push(
        <h1 key={key++} className="text-xl font-display font-bold text-foreground mt-4 mb-2">
          {renderInline(line.slice(2))}
        </h1>
      );
      i++; continue;
    }

    // Unordered list
    if (line.match(/^[-•*] /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-•*] /)) {
        items.push(lines[i].replace(/^[-•*] /, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-2 space-y-1 pl-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
              <span className="text-foreground/90 leading-relaxed">{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\. /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ''));
        i++;
      }
      blocks.push(
        <ol key={key++} className="my-2 space-y-1.5 pl-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-gold/15 text-gold font-bold text-xs flex items-center justify-center flex-shrink-0">
                {idx + 1}
              </span>
              <span className="text-foreground/90 leading-relaxed">{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Horizontal rule
    if (line.match(/^[-*_]{3,}$/)) {
      blocks.push(<hr key={key++} className="my-3 border-border/40" />);
      i++; continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      blocks.push(
        <blockquote key={key++} className="border-l-2 border-gold/40 pl-3 my-2 text-sm text-muted-foreground italic">
          {renderInline(line.slice(2))}
        </blockquote>
      );
      i++; continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++; continue;
    }

    // Plain paragraph
    blocks.push(
      <p key={key++} className="text-sm leading-relaxed text-foreground/90 my-0.5">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return blocks;
}

// ─── Component ────────────────────────────────────────────────────────────────
const MarkdownMessage = ({ text, className = '' }: Props) => {
  const blocks = useMemo(() => renderBlocks(text), [text]);
  return <div className={`space-y-0.5 ${className}`}>{blocks}</div>;
};

export default MarkdownMessage;
