# Recursive Tree Diagram - Tailwind replacement

This version replaces the previous CSS-based connector layout with recursive connector elements rendered directly in `components/TreeDiagram.tsx` using Tailwind classes and a small number of geometry constants.

## Run

```powershell
npm install
npm run dev
```

Open http://localhost:3000

## Layout geometry

Horizontal node width: 285px.
Child starts 190px from the parent's left edge, giving 95px overlap.
The parent center is connected to the child trunk, and each child gets a horizontal connector from the trunk to its left edge.

Vertical layout keeps each category's descendants inside that category's own subtree, so Engineering children do not mix with Marketing children.
