import TreeDiagram from "@/components/TreeDiagram";
import sample from "@/data/org-tree-sample.json";

export default function Home() {
  // IMPORTANT: the JSON root is { data: {...} }, so pass sample.data.
  return <TreeDiagram data={sample.data} />;
}
