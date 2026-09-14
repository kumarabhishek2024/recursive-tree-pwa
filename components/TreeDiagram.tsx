"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type WheelEvent as ReactWheelEvent,
  type TouchEvent as ReactTouchEvent,
  type CSSProperties,
} from "react";
import type { TreeNodeData } from "@/types/tree";

type Props = { data: TreeNodeData };

type SearchResult = {
  matches: Set<string>;
  parents: Set<string>;
};

const hasChildren = (node: TreeNodeData) =>
  Array.isArray(node.children) && node.children.length > 0;

function normalizeNode(value: unknown): TreeNodeData {
  const node = value as Partial<TreeNodeData>;

  return {
    name: typeof node?.name === "string" ? node.name : "Unnamed",
    email: typeof node?.email === "string" ? node.email : "",
    description:
      typeof node?.description === "string"
        ? node.description
        : "",
    type:
      typeof node?.type === "string"
        ? node.type
        : "leaf",
    children: Array.isArray(node?.children)
      ? node.children.map(normalizeNode)
      : [],
  };
}

function findSearch(
  root: TreeNodeData,
  query: string,
): SearchResult {
  const matches = new Set<string>();
  const parents = new Set<string>();

  if (!query) {
    return { matches, parents };
  }

  function walk(
    node: TreeNodeData,
    path: string,
    ancestors: string[],
  ) {
    const text =
      `${node.name} ${node.email} ${node.description}`.toLowerCase();

    if (text.includes(query)) {
      matches.add(path);

      ancestors.forEach((ancestor) =>
        parents.add(ancestor),
      );
    }

    node.children.forEach((child, index) => {
      walk(
        child,
        `${path}.${index}`,
        [...ancestors, path],
      );
    });
  }

  walk(root, "0", []);

  return { matches, parents };
}

/* =========================================================
   NODE CARD
========================================================= */

function NodeCard({
  node,
  path,
  open,
  selected,
  matched,
  category,
  onSelect,
  onToggle,
}: {
  node: TreeNodeData;
  path: string;
  open: boolean;
  selected: boolean;
  matched: boolean;
  category: boolean;
  onSelect: (node: TreeNodeData, path: string) => void;
  onToggle: (path: string) => void;
}) {
  return (
    <div className="w-full max-w-[560px]">
      <div
        role="button"
        tabIndex={0}
        title="Click to view details"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(node, path);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(node, path);
          }
        }}
        className={[
          "flex min-h-[42px] w-full items-center rounded-[8px]",
          hasChildren(node)
            ? "border-[#ff7a18] bg-[#ff7a18]"
            : "border-[#1473e6] bg-[#1473e6]",
          "px-3 py-2 cursor-pointer select-none",
          "transition-all duration-150",
          hasChildren(node)
            ? "hover:border-[#ff8b32] hover:bg-[#ff8b32]"
            : "hover:border-[#2582ef] hover:bg-[#2582ef]",
          selected ? "ring-2 ring-white/80" : "",
          matched ? "ring-2 ring-[#ffd34d]" : "",
        ].join(" ")}
      >
        {category ? (
          <span className="mr-2 w-4 shrink-0 text-center text-[15px] leading-none text-white">
            {open ? "▾" : "▸"}
          </span>
        ) : (
          <span className="mr-2 w-4 shrink-0" />
        )}

        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">
          {node.name}
        </span>

        {hasChildren(node) && (
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggle(path);
            }}
            className="ml-2 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#344a66] bg-[#1d334d] text-[17px] leading-none text-[#d7e7fb] hover:bg-[#274666]"
          >
            {open ? "−" : "+"}
          </button>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   VERTICAL NODE
========================================================= */

function VerticalNode({
  node,
  path,
  expanded,
  matches,
  selectedPath,
  onSelect,
  onToggle,
}: {
  node: TreeNodeData;
  path: string;
  expanded: Set<string>;
  matches: Set<string>;
  selectedPath: string | null;
  onSelect: (node: TreeNodeData, path: string) => void;
  onToggle: (path: string) => void;
}) {
  const category = node.type === "category" || hasChildren(node);
  const open = expanded.has(path);

  return (
    <div className="relative w-full">
      <div className="flex w-full max-w-[300px] flex-col">
        <NodeCard
          node={node}
          path={path}
          open={open}
          selected={selectedPath === path}
          matched={matches.has(path)}
          category={category}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      </div>

      {category && open && node.children.length > 0 && (
        <div className="relative ml-3 mt-1 border-l border-[#59616e] pl-3">
          {node.children.map((child, index) => (
            <div
              key={`${path}.${index}`}
              className="relative pb-2 last:pb-0"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute left-[-13px] top-1/2 h-px w-3 -translate-y-1/2 bg-[#59616e]"
              />

              <VerticalNode
                node={child}
                path={`${path}.${index}`}
                expanded={expanded}
                matches={matches}
                selectedPath={selectedPath}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   MAIN TREE DIAGRAM
========================================================= */

export default function TreeDiagram({
  data,
}: Props) {
  const root = useMemo(
    () => normalizeNode(data),
    [data],
  );

  // Keep wide trees inside the viewport without horizontal scrolling.
  // More direct children => slightly narrower cards/gaps; small trees stay larger.
  const layoutVars = useMemo(() => {
    return {
      "--tree-node-width": "min(230px, calc(100vw - 32px))",
    } as CSSProperties;
  }, []);

  const [expanded, setExpanded] =
    useState<Set<string>>(
      () =>
        new Set([
          "0",
          "0.0",
          "0.1",
        ]),
    );

  const [query, setQuery] =
    useState("");

  const [zoom, setZoom] =
    useState(1);


  const [selectedPath, setSelectedPath] =
    useState<string | null>(null);
  const [selectedNode, setSelectedNode] =
    useState<TreeNodeData | null>(null);


  const pinch =
    useRef({
      distance: 0,
      zoom: 1,
    });

  // The tree is transformed with scale(). CSS transforms do not change
  // layout height, so at small zoom values the browser can show a
  // scrollbar even though the tree is visually inside the viewport.
  // Measure the real tree height and use the scaled height for scrolling.
  const treeContentRef = useRef<HTMLDivElement | null>(null);
  const [treeContentHeight, setTreeContentHeight] = useState(0);

  const search = useMemo(
    () =>
      findSearch(
        root,
        query
          .trim()
          .toLowerCase(),
      ),
    [root, query],
  );

  /* =======================================================
     SEARCH AUTO EXPAND
  ======================================================= */

  const effectiveExpanded =
    useMemo(() => {
      if (
        !query.trim() ||
        search.parents.size === 0
      ) {
        return expanded;
      }

      return new Set([
        ...expanded,
        ...search.parents,
      ]);
    }, [
      expanded,
      query,
      search.parents,
    ]);

  useEffect(() => {
    const element = treeContentRef.current;
    if (!element) return;

    const updateHeight = () => {
      setTreeContentHeight(element.scrollHeight);
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);

    return () => observer.disconnect();
  }, [root, effectiveExpanded, zoom]);

  /* =======================================================
     TOGGLE
  ======================================================= */

  const toggle = useCallback(
    (path: string) => {
      setExpanded(
        (current) => {
          const next =
            new Set(current);

          if (
            next.has(path)
          ) {
            next.delete(path);
          } else {
            next.add(path);
          }

          return next;
        },
      );
    },
    [],
  );

  /* =======================================================
     ZOOM
  ======================================================= */

  const changeZoom =
    useCallback(
      (amount: number) => {
        setZoom(
          (current) =>
            Math.min(
              2.5,
              Math.max(
                0.4,
                Number(
                  (
                    current +
                    amount
                  ).toFixed(2),
                ),
              ),
            ),
        );
      },
      [],
    );

  const resetView = () => {
    setZoom(1);
  };

  /* =======================================================
     FIXED WHEEL HANDLER
     
     IMPORTANT:
     React onWheel expects React.WheelEvent,
     NOT browser/native WheelEvent.
     
     Also DO NOT use event.preventDefault()
     here because it causes passive listener
     warnings on mobile browsers.
  ======================================================= */

  const onWheel = (event: ReactWheelEvent<HTMLElement>) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      changeZoom(event.deltaY < 0 ? 0.1 : -0.1);
    }
  };

  /* =======================================================
     PINCH ZOOM
  ======================================================= */

  const touchDistance = (
    event: ReactTouchEvent<HTMLElement>,
  ) => {
    return Math.hypot(
      event.touches[0]
        .clientX -
        event.touches[1]
          .clientX,

      event.touches[0]
        .clientY -
        event.touches[1]
          .clientY,
    );
  };

  const onTouchStart = (
    event: ReactTouchEvent<HTMLElement>,
  ) => {
    if (
      event.touches.length ===
      2
    ) {
      pinch.current = {
        distance:
          touchDistance(
            event,
          ),
        zoom,
      };
    }
  };

  const onTouchMove = (
    event: ReactTouchEvent<HTMLElement>,
  ) => {
    if (
      event.touches.length !==
        2 ||
      !pinch.current
        .distance
    ) {
      return;
    }

    const ratio =
      touchDistance(
        event,
      ) /
      pinch.current
        .distance;

    const next =
      pinch.current.zoom *
      ratio;

    setZoom(
      Math.min(
        2.5,
        Math.max(
          0.4,
          Number(
            next.toFixed(2),
          ),
        ),
      ),
    );
  };

  /* =======================================================
     UI
  ======================================================= */

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-white text-[#18324f]">
      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="shrink-0 border-b border-[#dbe3ec] bg-white px-3 py-3 sm:px-[22px] sm:py-[14px]">
        <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[13px] bg-[#1d6fff] text-[24px] text-white sm:h-[58px] sm:w-[62px] sm:rounded-[15px] sm:text-[30px]">
            ⌘
          </div>

          <div className="min-w-0">
            <h1 className="m-0 truncate text-[19px] font-bold text-[#18324f] sm:text-[22px]">
              Recursive Tree Diagram
            </h1>

            <p className="m-0 mt-1 truncate text-sm text-[#8f9bad] sm:text-base">
              Nested JSON → interactive hierarchy
            </p>
          </div>
        </div>

        {/* =================================================
            SEARCH + LAYOUT CONTROLS
        ================================================= */}

        <div className="mt-3 flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
          <div className="flex h-11 min-w-0 w-full items-center gap-2 rounded-[10px] border border-[#d5dee8] bg-white px-3 text-[#6b7f95] sm:h-[50px] sm:flex-1 lg:w-[525px] lg:flex-none">
            <span className="text-xl">
              ⌕
            </span>

            <input
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target
                    .value,
                )
              }
              placeholder="Search name, email, description..."
              className="min-w-0 w-full border-0 bg-transparent text-[15px] text-[#18324f] outline-none placeholder:text-[#9aaabd] sm:text-[17px]"
            />

            {query && (
              <button
                type="button"
                className="shrink-0 border-0 bg-transparent px-1 text-2xl leading-none text-[#6b7f95]"
                onClick={() =>
                  setQuery("")
                }
              >
                ×
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ===================================================
          TOOLBAR
      =================================================== */}

      <div className="shrink-0 border-b border-[#dbe3ec] bg-white px-3 py-2.5 sm:px-[22px]">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[#9aa5b6]">
            <span className="flex items-center gap-2">
              <i className="h-[15px] w-[15px] rounded bg-[#f47b20]" />
              Category
            </span>

            <span className="flex items-center gap-2">
              <i className="h-[15px] w-[15px] rounded bg-[#0876df]" />
              Leaf
            </span>

            {query && (
              <b className="text-[#075fb4]">
                {search.matches.size}{" "}
                match
                {search.matches.size ===
                1
                  ? ""
                  : "es"}
              </b>
            )}
          </div>

          {/* =================================================
              ZOOM CONTROLS
          ================================================= */}

          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
            <button
              type="button"
              className="h-9 min-w-10 shrink-0 rounded-[9px] border border-[#d5dee8] bg-white text-[#35516f]"
              onClick={() =>
                changeZoom(
                  -0.1,
                )
              }
              aria-label="Zoom out"
            >
              −
            </button>

            <span className="min-w-[55px] shrink-0 text-center text-sm text-[#a9b4c4]">
              {Math.round(
                zoom * 100,
              )}
              %
            </span>

            <button
              type="button"
              className="h-9 min-w-10 shrink-0 rounded-[9px] border border-[#d5dee8] bg-white text-[#35516f]"
              onClick={() =>
                changeZoom(
                  0.1,
                )
              }
              aria-label="Zoom in"
            >
              +
            </button>

            <button
              type="button"
              className="h-9 shrink-0 rounded-[9px] border border-[#d5dee8] bg-white px-3 text-sm text-[#35516f]"
              onClick={
                resetView
              }
            >
              Reset
            </button>

          </div>
        </div>
      </div>

      {/* ===================================================
          TREE CANVAS
      =================================================== */}

      <section
        className={[
          "relative flex-1 min-h-0 overflow-x-hidden overflow-y-auto",
          "touch-pan-y select-none overscroll-contain",
          "bg-white",
          "[background-image:radial-gradient(#d7e1ec_1px,transparent_1px)]",
          "[background-size:24px_24px]",
        ].join(" ")}
        onWheel={onWheel}
        onTouchStart={
          onTouchStart
        }
        onTouchMove={
          onTouchMove
        }
      >
        <div
          className="relative w-full px-3 py-4 sm:px-6 sm:py-5"
          style={{
            height:
              treeContentHeight > 0
                ? `${treeContentHeight * zoom + 40}px`
                : undefined,
          }}
        >
          <div
            ref={treeContentRef}
            className="w-full max-w-[620px]"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            <VerticalNode
              node={root}
              path="0"
              expanded={effectiveExpanded}
              matches={search.matches}
              selectedPath={selectedPath}
              onSelect={(node, path) => {
                setSelectedPath((current) =>
                  current === path ? null : path
                );
                setSelectedNode((current) =>
                  current && selectedPath === path ? null : node
                );
              }}
              onToggle={toggle}
            />
          </div>
        </div>

        {/* =================================================
            HELP TEXT
        ================================================= */}

        
      </section>


      {selectedNode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onPointerDown={() => {
            setSelectedNode(null);
            setSelectedPath(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedNode.name} details`}
            className="w-full max-w-[430px] overflow-hidden rounded-2xl border border-[#d5dee8] bg-white shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#d5dee8] px-5 py-4">
              <h2 className="m-0 min-w-0 truncate text-lg font-bold text-[#18324f]">
                {selectedNode.name}
              </h2>
              <button
                type="button"
                aria-label="Close details"
                className="ml-3 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#d5dee8] bg-[#eef3f8] text-lg text-[#18324f] hover:bg-[#e2eaf2]"
                onClick={() => {
                  setSelectedNode(null);
                  setSelectedPath(null);
                }}
              >
                ×
              </button>
            </div>
<div className="px-6 py-6">
  {/* Node identity */}
  <div className="mb-6">
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a9ab0]">
      Name
    </div>

    <div className="flex items-center gap-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${
          selectedNode.type === "category"
            ? "bg-[#ff7417]"
            : "bg-[#0878df]"
        }`}
      >
        <span className="text-base font-bold">
          {selectedNode.name?.charAt(0)?.toUpperCase() || "?"}
        </span>
      </div>

      <div className="min-w-0">
        <div className="break-words text-[18px] font-semibold leading-6 text-[#18324f]">
          {selectedNode.name || "Unnamed"}
        </div>

        <div className="mt-1 text-xs font-medium text-[#91a0b3]">
          {selectedNode.type === "category" ? "Category" : "Leaf node"}
        </div>
      </div>
    </div>
  </div>

  {/* Divider */}
  <div className="mb-5 h-px bg-[#e8edf3]" />

  {/* Email */}
  <div className="mb-5">
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a9ab0]">
      Email
    </div>

    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#e8edf3] bg-[#fafbfd] px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eaf3ff] text-[#0878df]">
        <span className="text-sm font-bold">@</span>
      </div>

      <div className="min-w-0 break-all text-[14px] font-medium text-[#29415c]">
        {selectedNode.email || "—"}
      </div>
    </div>
  </div>

  {/* Description */}
  <div>
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a9ab0]">
      Description
    </div>

    <div className="rounded-xl border border-[#e8edf3] bg-[#fafbfd] px-4 py-4">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fff1e6] text-[#ff7417]">
          <span className="text-base font-bold">≡</span>
        </div>

        <div className="min-w-0 break-words text-[14px] leading-6 text-[#53677f]">
          {selectedNode.description || "No description available."}
        </div>
      </div>
    </div>
      </div>
      </div>
          </div>
        </div>
      )}
    </main>
  );
}