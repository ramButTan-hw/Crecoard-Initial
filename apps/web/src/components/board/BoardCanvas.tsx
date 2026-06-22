"use client";

import { useCallback, useRef } from "react";
import { useBoardStore, useActiveBoard } from "@/store/boardStore";
import { BoardBox } from "./BoardBox";
import { Ruler } from "./Ruler";
import { cn } from "@/lib/utils";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/boardConstants";

export function BoardCanvas() {
  const board = useActiveBoard();
  const { showGrid, showRuler, zoom, selectBox, activeBoardId } = useBoardStore();
  const draggingBlockId = useBoardStore((s) => s.draggingBlockId);
  const appBg = useBoardStore((s) => s.appBg);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => { if (e.target === canvasRef.current) selectBox(null); },
    [selectBox]
  );

  if (!board) return null;

  const bgSize = board.backgroundSize ?? "cover";

  return (
    <div className="relative flex-1 overflow-hidden" style={{ background: board.backgroundColor ?? "#1a1b1e" }}>
      {board.backgroundImage && (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
              backgroundImage: `url(${board.backgroundImage})`,
              backgroundSize: bgSize,
              backgroundPosition: board.backgroundPosition ?? "center",
              backgroundRepeat: bgSize === "auto" ? "no-repeat" : undefined,
              opacity: board.backgroundOpacity ?? 1,
              filter: board.backgroundFilter || undefined,
            }}
          />
          {(board.backgroundOverlayOpacity ?? 0) > 0 && (
            <div
              aria-hidden
              style={{
                position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
                backgroundColor: board.backgroundOverlayColor ?? "#000000",
                opacity: board.backgroundOverlayOpacity,
              }}
            />
          )}
        </>
      )}

      {showRuler && <Ruler zoom={zoom} />}

      <div
        className="absolute inset-0 overflow-auto"
        style={{ paddingTop: showRuler ? 24 : 0, paddingLeft: showRuler ? 24 : 0, zIndex: 2 }}
      >
        <div
          ref={canvasRef}
          onClick={handleCanvasClick}
          className={cn("relative origin-top-left", showGrid && "board-grid")}
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `scale(${zoom})`, transformOrigin: "top left" }}
        >
          {board.boxes.map((box) => (
            <BoardBox
              key={box.id}
              box={box}
              boardId={activeBoardId}
              isDragging={draggingBlockId === box.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
