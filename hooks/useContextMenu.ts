"use client";
import { useEffect, useState } from "react";
import type { WhyNodeData } from "@/components/boardTypes";
import type { Node as RFNode } from "@xyflow/react";

export function useContextMenu(
  setNodes: React.Dispatch<React.SetStateAction<RFNode<WhyNodeData>[]>>
) {
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const openMenu = (id: string) => setMenuOpenFor(id);
  const closeMenu = () => setMenuOpenFor(null);

  useEffect(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, isMenuOpen: n.id === menuOpenFor } })));
  }, [menuOpenFor, setNodes]);

  return { menuOpenFor, openMenu, closeMenu } as const;
}
