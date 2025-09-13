"use client";
import React from "react";

type Props = { source: string; className?: string };

export default function Markdown({ source, className }: Props) {
  const lines = source.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let ul: string[] = [];
  let ol: string[] = [];
  const flushLists = () => {
    if (ul.length) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc pl-6 my-2">
          {ul.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      );
      ul = [];
    }
    if (ol.length) {
      elements.push(
        <ol key={`ol-${elements.length}`} className="list-decimal pl-6 my-2">
          {ol.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      );
      ol = [];
    }
  };

  lines.forEach((raw) => {
    const line = raw.replace(/^\s+/, "");
    if (!line) {
      flushLists();
      elements.push(<div key={`br-${elements.length}`} className="h-2" />);
      return;
    }
    if (/^#\s+/.test(line)) {
      flushLists();
      elements.push(
        <h1 key={`h1-${elements.length}`} className="text-base font-semibold mt-3">
          {line.replace(/^#\s+/, "")}
        </h1>
      );
      return;
    }
    if (/^##\s+/.test(line)) {
      flushLists();
      elements.push(
        <h2 key={`h2-${elements.length}`} className="text-sm font-semibold mt-2">
          {line.replace(/^##\s+/, "")}
        </h2>
      );
      return;
    }
    if (/^(\-|\*|・)\s+/.test(line)) {
      ul.push(line.replace(/^(\-|\*|・)\s+/, ""));
      return;
    }
    if (/^\d+\)\s+/.test(line)) {
      ol.push(line.replace(/^\d+\)\s+/, ""));
      return;
    }
    // 普通の段落
    flushLists();
    elements.push(
      <p key={`p-${elements.length}`} className="my-1">
        {line}
      </p>
    );
  });
  flushLists();

  return <div className={className}>{elements}</div>;
}

