export type TreeNodeData = {
  name: string;
  email: string;
  description: string;
  type: "category" | "leaf" | string;
  children: TreeNodeData[];
};

export type TreeJson = { data: TreeNodeData };
