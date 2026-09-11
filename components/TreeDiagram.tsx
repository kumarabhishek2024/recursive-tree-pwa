"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { TreeNodeData } from "@/types/tree";

type Layout = "horizontal" | "vertical";
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
  matched,
  category,
  onSelect,
  onToggle,
  compact = false,
}: {
  node: TreeNodeData;
  path: string;
  open: boolean;
  matched: boolean;
  category: boolean;
  onSelect: (node: TreeNodeData) => void;
  onToggle: (path: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "relative z-10 flex items-center overflow-hidden text-white",
        "shadow-[0_7px_16px_rgba(34,67,98,0.14)]",
        compact
          ? "h-[66px] w-[303px] rounded-[14px]"
          : "h-[78px] w-[285px] rounded-[14px]",
        category
          ? "bg-[#f47b20]"
          : "bg-[#0876df]",
        matched
          ? [
              "outline outline-4 outline-[#ffd34d]",
              "shadow-[0_0_0_8px_rgba(255,211,77,0.20),0_8px_22px_rgba(34,67,98,0.20)]",
            ].join(" ")
          : "",
      ].join(" ")}
    >
      <button
        type="button"
        className={[
          "min-w-0 flex-1 cursor-pointer items-center",
          "border-0 bg-transparent text-left text-white",
          compact
            ? "flex h-[66px] gap-3 px-[15px] py-[12px]"
            : "flex h-[78px] gap-3 px-[14px] py-[13px]",
        ].join(" ")}
        onPointerDown={(event) =>
          event.stopPropagation()
        }
        onClick={(event) => {
          event.stopPropagation();
          onSelect(node);
        }}
        title={`Open details for ${node.name}`}
      >
        <span
          className={[
            "grid shrink-0 place-items-center rounded-[7px] bg-white/18",
            compact
              ? "h-[38px] w-[38px] text-[20px]"
              : "h-[38px] w-[38px] text-[21px]",
          ].join(" ")}
        >
          {category ? "▣" : "▤"}
        </span>

        <span
          className={[
            "min-w-0 truncate font-bold",
            "text-[18px]",
          ].join(" ")}
        >
          {node.name}
        </span>
      </button>

      {hasChildren(node) && (
        <button
          type="button"
          className={[
            "mr-2 grid shrink-0 cursor-pointer place-items-center",
            "rounded-[7px] border-0 bg-white/18 leading-none",
            "text-white hover:bg-white/30",
            compact
              ? "h-[40px] w-[40px] text-[22px]"
              : "h-[42px] w-[42px] text-[27px]",
          ].join(" ")}
          onPointerDown={(event) =>
            event.stopPropagation()
          }
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggle(path);
          }}
          aria-expanded={open}
          aria-label={
            open
              ? `Collapse ${node.name}`
              : `Expand ${node.name}`
          }
          title={
            open
              ? `Collapse ${node.name}`
              : `Expand ${node.name}`
          }
        >
          {open ? "−" : "+"}
        </button>
      )}
    </div>
  );
}

/* =========================================================
   HORIZONTAL LAYOUT
========================================================= */

const H_NODE_W = 303;
const H_NODE_H = 66;
const H_X_GAP = 57;
const H_Y_GAP = 13;

type HLayoutItem = {
  node: TreeNodeData;
  path: string;
  depth: number;
  x: number;
  y: number;
};

type HEdge = {
  parent: HLayoutItem;
  child: HLayoutItem;
};

function buildHorizontalLayout(
  root: TreeNodeData,
  expanded: Set<string>,
) {
  const items: HLayoutItem[] = [];
  const edges: HEdge[] = [];

  function visibleChildren(
    node: TreeNodeData,
    path: string,
  ) {
    const category =
      node.type === "category" ||
      hasChildren(node);

    return category && expanded.has(path)
      ? node.children
      : [];
  }

  function subtreeHeight(
    node: TreeNodeData,
    path: string,
  ): number {
    const children = visibleChildren(
      node,
      path,
    );

    if (!children.length) {
      return H_NODE_H;
    }

    return (
      H_NODE_H +
      H_Y_GAP +
      children.reduce(
        (total, child, index) =>
          total +
          subtreeHeight(
            child,
            `${path}.${index}`,
          ),
        0,
      ) +
      H_Y_GAP * (children.length - 1)
    );
  }

  function walk(
    node: TreeNodeData,
    path: string,
    depth: number,
    top: number,
  ): HLayoutItem {
    const item: HLayoutItem = {
      node,
      path,
      depth,
      x:
        depth *
        (H_NODE_W + H_X_GAP),
      y: top,
    };

    items.push(item);

    const children = visibleChildren(
      node,
      path,
    );

    let childTop =
      top +
      H_NODE_H +
      H_Y_GAP;

    for (
      let index = 0;
      index < children.length;
      index += 1
    ) {
      const child = children[index];
      const childPath =
        `${path}.${index}`;

      const childItem = walk(
        child,
        childPath,
        depth + 1,
        childTop,
      );

      edges.push({
        parent: item,
        child: childItem,
      });

      childTop +=
        subtreeHeight(
          child,
          childPath,
        ) +
        H_Y_GAP;
    }

    return item;
  }

  const height = subtreeHeight(
    root,
    "0",
  );

  walk(root, "0", 0, 0);

  const maxDepth = items.reduce(
    (max, item) =>
      Math.max(max, item.depth),
    0,
  );

  const width =
    (maxDepth + 1) * H_NODE_W +
    maxDepth * H_X_GAP;

  return {
    items,
    edges,
    width,
    height: Math.max(
      height,
      H_NODE_H,
    ),
  };
}

/* =========================================================
   HORIZONTAL TREE
========================================================= */

function HorizontalTree({
  root,
  expanded,
  matches,
  onSelect,
  onToggle,
}: {
  root: TreeNodeData;
  expanded: Set<string>;
  matches: Set<string>;
  onSelect: (node: TreeNodeData) => void;
  onToggle: (path: string) => void;
}) {
  const layout = useMemo(
    () =>
      buildHorizontalLayout(
        root,
        expanded,
      ),
    [root, expanded],
  );

  const edgesByParent = useMemo(() => {
    const map = new Map<
      string,
      HLayoutItem[]
    >();

    for (const edge of layout.edges) {
      const children =
        map.get(edge.parent.path) ??
        [];

      children.push(edge.child);

      map.set(
        edge.parent.path,
        children,
      );
    }

    return map;
  }, [layout.edges]);

  return (
    <div
      className="relative"
      style={{
        width: layout.width,
        height: layout.height,
      }}
    >
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 overflow-visible"
        width={layout.width}
        height={layout.height}
      >
        {Array.from(
          edgesByParent.entries(),
        ).map(
          ([
            parentPath,
            children,
          ]) => {
            const parent =
              layout.items.find(
                (item) =>
                  item.path ===
                  parentPath,
              );

            if (
              !parent ||
              !children.length
            ) {
              return null;
            }

            const trunkX =
              parent.x +
              H_NODE_W / 2;

            const lastChild =
              children[
                children.length - 1
              ];

            const trunkTop =
              parent.y +
              H_NODE_H;

            const trunkBottom =
              lastChild.y +
              H_NODE_H / 2;

            return (
              <g key={parentPath}>
                <path
                  d={`M ${trunkX} ${trunkTop} V ${trunkBottom}`}
                  fill="none"
                  stroke="#7894ad"
                  strokeWidth="3"
                  strokeLinecap="square"
                />

                {children.map(
                  (child) => {
                    const childY =
                      child.y +
                      H_NODE_H / 2;

                    const childLeft =
                      child.x;

                    return (
                      <path
                        key={`${parentPath}-${child.path}`}
                        d={`M ${trunkX} ${childY} H ${childLeft}`}
                        fill="none"
                        stroke="#7894ad"
                        strokeWidth="3"
                        strokeLinecap="square"
                      />
                    );
                  },
                )}
              </g>
            );
          },
        )}
      </svg>

      {layout.items.map(
        (item) => {
          const category =
            item.node.type ===
              "category" ||
            hasChildren(
              item.node,
            );

          const open =
            expanded.has(
              item.path,
            );

          return (
            <div
              key={item.path}
              className="absolute"
              style={{
                left: item.x,
                top: item.y,
              }}
            >
              <NodeCard
                node={item.node}
                path={item.path}
                open={open}
                matched={matches.has(
                  item.path,
                )}
                category={
                  category
                }
                onSelect={
                  onSelect
                }
                onToggle={
                  onToggle
                }
                compact
              />
            </div>
          );
        },
      )}
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
  onSelect,
  onToggle,
}: {
  node: TreeNodeData;
  path: string;
  expanded: Set<string>;
  matches: Set<string>;
  onSelect: (node: TreeNodeData) => void;
  onToggle: (path: string) => void;
}) {
  const category =
    node.type === "category" ||
    hasChildren(node);

  const open =
    expanded.has(path);

  return (
    <div className="relative flex w-max flex-col items-center">
      <NodeCard
        node={node}
        path={path}
        open={open}
        matched={matches.has(
          path,
        )}
        category={category}
        onSelect={onSelect}
        onToggle={onToggle}
      />

      {category && open && (
        <div className="relative mt-[58px] flex w-max items-start justify-center gap-[34px]">
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[-58px] h-[29px] w-[3px] -translate-x-1/2 bg-[#7894ad]"
          />

          {node.children.length >
            1 && (
            <span
              aria-hidden
              className="pointer-events-none absolute top-[-29px] h-[3px] bg-[#7894ad]"
              style={{
                left: 142.5,
                right: 142.5,
              }}
            />
          )}

          {node.children.map(
            (
              child,
              index,
            ) => (
              <div
                key={`${path}.${index}`}
                className="relative flex w-max flex-col items-center"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-[-29px] h-[29px] w-[3px] -translate-x-1/2 bg-[#7894ad]"
                />

                <VerticalNode
                  node={child}
                  path={`${path}.${index}`}
                  expanded={
                    expanded
                  }
                  matches={
                    matches
                  }
                  onSelect={
                    onSelect
                  }
                  onToggle={
                    onToggle
                  }
                />
              </div>
            ),
          )}
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

  const [expanded, setExpanded] =
    useState<Set<string>>(
      () =>
        new Set([
          "0",
          "0.0",
          "0.1",
        ]),
    );

  const [layout, setLayout] =
    useState<Layout>(
      "horizontal",
    );

  const [query, setQuery] =
    useState("");

  const [zoom, setZoom] =
    useState(1);

  const [pan, setPan] =
    useState({
      x: 29,
      y: 27,
    });

  const [selected, setSelected] =
    useState<TreeNodeData | null>(
      null,
    );

  const [installEvent, setInstallEvent] =
    useState<any>(null);

  const dragging =
    useRef(false);

  const lastPoint =
    useRef({
      x: 0,
      y: 0,
    });

  const pinch =
    useRef({
      distance: 0,
      zoom: 1,
    });

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

  /* =======================================================
     PWA INSTALL PROMPT
  ======================================================= */

  useEffect(() => {
    const handler = (
      event: Event,
    ) => {
      event.preventDefault();
      setInstallEvent(event);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handler,
    );

    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handler,
      );
  }, []);

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

    setPan({
      x: 29,
      y: 27,
    });
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

  const onWheel = (
    event: ReactWheelEvent<HTMLElement>,
  ) => {
    changeZoom(
      event.deltaY < 0
        ? 0.1
        : -0.1,
    );
  };

  /* =======================================================
     POINTER PAN
  ======================================================= */

  const onPointerDown = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    const target =
      event.target as HTMLElement;

    if (
      event.button !== 0 ||
      target.closest(
        "button, input",
      )
    ) {
      return;
    }

    dragging.current =
      true;

    lastPoint.current = {
      x: event.clientX,
      y: event.clientY,
    };

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );
  };

  const onPointerMove = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (
      !dragging.current
    ) {
      return;
    }

    const dx =
      event.clientX -
      lastPoint.current.x;

    const dy =
      event.clientY -
      lastPoint.current.y;

    lastPoint.current = {
      x: event.clientX,
      y: event.clientY,
    };

    setPan(
      (current) => ({
        x:
          current.x + dx,
        y:
          current.y + dy,
      }),
    );
  };

  const onPointerUp =
    () => {
      dragging.current =
        false;
    };

  /* =======================================================
     PINCH ZOOM
  ======================================================= */

  const touchDistance = (
    event: React.TouchEvent<HTMLElement>,
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
    event: React.TouchEvent<HTMLElement>,
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
    event: React.TouchEvent<HTMLElement>,
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
     PWA INSTALL
  ======================================================= */

  const install =
    async () => {
      if (!installEvent) {
        window.alert(
          "Install prompt is not available. Use the browser menu and choose Install app / Add to Home screen.",
        );

        return;
      }

      await installEvent.prompt();

      setInstallEvent(
        null,
      );
    };

  /* =======================================================
     UI
  ======================================================= */

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#f7f9fc] text-[#17324d]">
      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="shrink-0 border-b border-[#e1e8ef] bg-white px-3 py-3 sm:px-[22px] sm:py-[14px]">
        <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[13px] bg-[#0876df] text-[24px] text-white sm:h-[62px] sm:w-[62px] sm:rounded-[15px] sm:text-[30px]">
            ⌘
          </div>

          <div className="min-w-0">
            <h1 className="m-0 truncate text-[19px] font-bold sm:text-[22px]">
              Recursive Tree Diagram
            </h1>

            <p className="m-0 mt-1 truncate text-sm text-[#718297] sm:text-base">
              Nested JSON → interactive hierarchy
            </p>
          </div>
        </div>

        {/* =================================================
            SEARCH + LAYOUT CONTROLS
        ================================================= */}

        <div className="mt-3 flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
          <div className="flex h-11 min-w-0 w-full items-center gap-2 rounded-[12px] border border-[#d6e0ea] bg-white px-3 text-[#6e8195] sm:h-[50px] sm:flex-1 lg:w-[525px] lg:flex-none">
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
              className="min-w-0 w-full border-0 bg-transparent text-[15px] outline-none sm:text-[17px]"
            />

            {query && (
              <button
                type="button"
                className="shrink-0 border-0 bg-transparent px-1 text-2xl leading-none text-[#6e8195]"
                onClick={() =>
                  setQuery("")
                }
              >
                ×
              </button>
            )}
          </div>

          <div className="flex h-11 w-full overflow-hidden rounded-[12px] border border-[#d6e0ea] sm:h-[50px] sm:w-auto">
            <button
              type="button"
              className={`flex-1 px-4 font-semibold sm:flex-none ${
                layout ===
                "horizontal"
                  ? "bg-[#eaf4ff] text-[#075fb4]"
                  : "bg-white text-[#597087]"
              }`}
              onClick={() =>
                setLayout(
                  "horizontal",
                )
              }
            >
              ↔ Horizontal
            </button>

            <button
              type="button"
              className={`flex-1 border-l border-[#d6e0ea] px-4 font-semibold sm:flex-none ${
                layout ===
                "vertical"
                  ? "bg-[#eaf4ff] text-[#075fb4]"
                  : "bg-white text-[#597087]"
              }`}
              onClick={() =>
                setLayout(
                  "vertical",
                )
              }
            >
              ↕ Vertical
            </button>
          </div>
        </div>
      </header>

      {/* ===================================================
          TOOLBAR
      =================================================== */}

      <div className="shrink-0 border-b border-[#e1e8ef] bg-[#fbfcfe] px-3 py-2.5 sm:px-[22px]">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[#62768b]">
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
              className="h-9 min-w-10 shrink-0 rounded-[9px] border border-[#d5e0ea] bg-white text-[#536a80]"
              onClick={() =>
                changeZoom(
                  -0.1,
                )
              }
              aria-label="Zoom out"
            >
              −
            </button>

            <span className="min-w-[55px] shrink-0 text-center text-sm text-[#61758a]">
              {Math.round(
                zoom * 100,
              )}
              %
            </span>

            <button
              type="button"
              className="h-9 min-w-10 shrink-0 rounded-[9px] border border-[#d5e0ea] bg-white text-[#536a80]"
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
              className="h-9 shrink-0 rounded-[9px] border border-[#d5e0ea] bg-white px-3 text-sm text-[#536a80]"
              onClick={
                resetView
              }
            >
              Reset
            </button>

            {installEvent && (
              <button
                type="button"
                className="h-9 shrink-0 rounded-[9px] bg-[#0876df] px-3 text-sm font-semibold text-white"
                onClick={install}
              >
                Install
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================
          TREE CANVAS
      =================================================== */}

      <section
        className={[
          "relative flex-1 overflow-hidden",
          "touch-none select-none overscroll-contain",
          "bg-[#f8fafc]",
          "[background-image:radial-gradient(#d7e0e9_1.2px,transparent_1.2px)]",
          "[background-size:28px_28px]",
        ].join(" ")}
        onWheel={onWheel}
        onPointerDown={
          onPointerDown
        }
        onPointerMove={
          onPointerMove
        }
        onPointerUp={
          onPointerUp
        }
        onPointerCancel={
          onPointerUp
        }
        onTouchStart={
          onTouchStart
        }
        onTouchMove={
          onTouchMove
        }
      >
        <div
          className="absolute left-0 top-0 w-max origin-top-left p-5"
          style={{
            transform:
              `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {layout ===
          "horizontal" ? (
            <HorizontalTree
              root={root}
              expanded={
                effectiveExpanded
              }
              matches={
                search.matches
              }
              onSelect={
                setSelected
              }
              onToggle={
                toggle
              }
            />
          ) : (
            <VerticalNode
              node={root}
              path="0"
              expanded={
                effectiveExpanded
              }
              matches={
                search.matches
              }
              onSelect={
                setSelected
              }
              onToggle={
                toggle
              }
            />
          )}
        </div>

        {/* =================================================
            HELP TEXT
        ================================================= */}

        <div className="pointer-events-none absolute bottom-[18px] left-1/2 hidden -translate-x-1/2 rounded-full border border-[#dbe4ec] bg-white/90 px-4 py-2 text-xs text-[#718499] sm:block">
          Click a node for details · Use + / − to expand ·
          Drag to pan · Wheel/pinch to zoom
        </div>
      </section>

      {/* ===================================================
          DETAIL POPUP
      =================================================== */}

      {selected && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(12,29,47,0.42)] p-5"
          onClick={() =>
            setSelected(null)
          }
        >
          <div
            className="relative w-full max-w-[480px] rounded-[18px] bg-white p-[30px] shadow-[0_30px_80px_rgba(10,30,50,0.25)]"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="absolute right-3.5 top-3.5 grid h-[34px] w-[34px] place-items-center rounded-full border-0 bg-[#edf3f8] text-2xl text-[#5e7388]"
              onClick={() =>
                setSelected(null)
              }
              aria-label="Close"
            >
              ×
            </button>

            <div
              className={[
                "mb-3 grid h-[54px] w-[54px]",
                "place-items-center rounded-[13px]",
                "text-[25px] text-white",
                hasChildren(
                  selected,
                )
                  ? "bg-[#f47b20]"
                  : "bg-[#0876df]",
              ].join(" ")}
            >
              {hasChildren(
                selected,
              )
                ? "▣"
                : "▤"}
            </div>

            <small className="font-extrabold tracking-[1.3px] text-[#8a99a8]">
              {hasChildren(
                selected,
              )
                ? "CATEGORY"
                : "LEAF"}
            </small>

            <h2 className="mb-5 mt-1 break-words text-[27px] font-bold">
              {selected.name}
            </h2>

            <div className="grid gap-3">
              <label className="text-[11px] font-extrabold uppercase text-[#8a99a8]">
                Email
              </label>

              <p className="m-[-7px_0_4px] break-words rounded-[10px] border border-[#e2e9ef] bg-[#f7f9fc] p-[13px] text-[#304961]">
                {selected.email ||
                  "—"}
              </p>

              <label className="text-[11px] font-extrabold uppercase text-[#8a99a8]">
                Description
              </label>

              <p className="m-[-7px_0_4px] break-words rounded-[10px] border border-[#e2e9ef] bg-[#f7f9fc] p-[13px] text-[#304961]">
                {selected.description ||
                  "—"}
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}