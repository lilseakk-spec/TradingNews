"use client";

/**
 * Yapay zeka raporunun govdesi. Tam markdown degil: baslik, madde,
 * paragraf ve kalin. Rapor zaten bu kadarini kullaniyor, fazlasi icin
 * kutuphane tasimaya gerek yok.
 */

import { Fragment, type ReactNode } from "react";

function inline(text: string, keyBase: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyBase}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={`${keyBase}-${index}`}>{part}</Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let list: string[] = [];

  function flush(key: string) {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`ul-${key}`}>
        {list.map((item, index) => (
          <li key={`${key}-${index}`}>{inline(item, `${key}-${index}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  }

  lines.forEach((raw, index) => {
    const line = raw.trimEnd();
    if (/^#{1,6}\s/.test(line)) {
      flush(`h${index}`);
      blocks.push(<h2 key={`h-${index}`}>{inline(line.replace(/^#{1,6}\s/, ""), `h${index}`)}</h2>);
      return;
    }
    if (/^[-*]\s+/.test(line)) {
      list.push(line.replace(/^[-*]\s+/, ""));
      return;
    }
    flush(`p${index}`);
    if (line.trim()) {
      blocks.push(<p key={`p-${index}`}>{inline(line, `p${index}`)}</p>);
    }
  });
  flush("end");

  return <div className="report">{blocks}</div>;
}
