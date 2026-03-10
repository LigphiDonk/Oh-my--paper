import { pdfjs, Document, Page } from "react-pdf";
import { useMemo, useState } from "react";

import type { CompileResult } from "../types";

import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

interface PdfPaneProps {
  compileResult: CompileResult;
  highlightedPage: number;
  onPageJump: (page: number) => void;
}

export function PdfPane({ compileResult, highlightedPage, onPageJump }: PdfPaneProps) {
  const [pageCount, setPageCount] = useState(0);
  const file = useMemo(() => {
    if (!compileResult.pdfData) {
      return undefined;
    }
    return { data: compileResult.pdfData };
  }, [compileResult.pdfData]);

  return (
    <div className="panel pdf-pane">
      <div className="panel-header pdf-header">
        <div>
          <p className="eyebrow">Preview</p>
          <h2>Compiled PDF</h2>
        </div>
        <div className="pdf-meta">
          <span>{compileResult.status}</span>
          <span>{pageCount ? `${pageCount} pages` : "No pages yet"}</span>
        </div>
      </div>
      <div className="pdf-toolbar">
        {Array.from({ length: Math.max(pageCount, 2) }, (_, index) => (
          <button
            key={`jump-${index + 1}`}
            className={`page-chip ${highlightedPage === index + 1 ? "is-active" : ""}`}
            onClick={() => onPageJump(index + 1)}
            type="button"
          >
            {index + 1}
          </button>
        ))}
      </div>
      <div className="pdf-scroll">
        {file ? (
          <Document
            file={file}
            onLoadSuccess={({ numPages }) => setPageCount(numPages)}
            loading={<div className="pdf-placeholder">Rendering preview…</div>}
            error={<div className="pdf-placeholder">Unable to load preview PDF.</div>}
          >
            {Array.from({ length: pageCount || 1 }, (_, index) => {
              const page = index + 1;
              return (
                <div key={page} className={`pdf-page-frame ${highlightedPage === page ? "is-highlighted" : ""}`}>
                  <button className="pdf-page-hitbox" onClick={() => onPageJump(page)} type="button">
                    <Page pageNumber={page} width={430} renderTextLayer={false} renderAnnotationLayer={false} />
                  </button>
                </div>
              );
            })}
          </Document>
        ) : (
          <div className="pdf-placeholder">Compile the project to populate the PDF preview.</div>
        )}
      </div>
    </div>
  );
}
