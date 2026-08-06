import React from "react";
import { render } from "@testing-library/react";

type AsyncComponent = (
  props: Record<string, unknown>,
) => React.ReactNode | Promise<React.ReactNode>;

async function resolveNode(node: React.ReactNode): Promise<React.ReactNode> {
  if (Array.isArray(node)) {
    return Promise.all(node.map(resolveNode));
  }

  if (!React.isValidElement(node)) {
    return node;
  }

  if (typeof node.type === "function") {
    const resolved = await Promise.resolve(
      (node.type as AsyncComponent)(node.props as Record<string, unknown>),
    );
    return resolveNode(resolved);
  }

  const children = React.Children.toArray(
    (node.props as { children?: React.ReactNode }).children,
  );

  if (children.length === 0) {
    return node;
  }

  const resolvedChildren = await Promise.all(children.map(resolveNode));
  return React.cloneElement(node, undefined, ...resolvedChildren);
}

export async function renderAsyncPage(element: React.JSX.Element) {
  const resolved = await resolveNode(element);
  if (React.isValidElement(resolved) && resolved.type === "html") {
    return render(resolved, { container: document });
  }

  return render(<>{resolved}</>);
}
