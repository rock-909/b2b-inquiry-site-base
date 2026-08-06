const ts = require("typescript");

function getPropertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return undefined;
}

function getBindingIdentifier(bindingName, identifierName) {
  if (ts.isIdentifier(bindingName)) {
    return bindingName.text === identifierName ? bindingName : undefined;
  }
  for (const element of bindingName.elements) {
    if (!ts.isBindingElement(element)) continue;
    const identifier = getBindingIdentifier(element.name, identifierName);
    if (identifier) return identifier;
  }
  return undefined;
}

function findTopLevelVariableDeclarations(sourceFile, sourceName) {
  const declarations = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === sourceName
      ) {
        declarations.push(declaration);
      }
    }
  }
  return declarations;
}

function isConstVariableDeclaration(node) {
  return (
    ts.isVariableDeclarationList(node.parent) &&
    (node.parent.flags & ts.NodeFlags.Const) !== 0
  );
}

function findDirectFunctionBindingIdentifiers(
  functionDeclaration,
  identifierName,
) {
  const identifiers = [];
  for (const parameter of functionDeclaration.parameters) {
    const identifier = getBindingIdentifier(parameter.name, identifierName);
    if (identifier) identifiers.push(identifier);
  }
  for (const statement of functionDeclaration.body?.statements ?? []) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const identifier = getBindingIdentifier(
          declaration.name,
          identifierName,
        );
        if (identifier) identifiers.push(identifier);
      }
    } else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement)) &&
      statement.name?.text === identifierName
    ) {
      identifiers.push(statement.name);
    }
  }
  return identifiers;
}

function findNamedFunctionDeclarations(sourceFile, functionName) {
  return sourceFile.statements.filter(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === functionName,
  );
}

function getUniqueMatch(matches) {
  if (matches.length === 0) return { status: "missing" };
  if (matches.length > 1) return { status: "ambiguous" };
  return { match: matches[0], status: "matched" };
}

function getPropertyAccessPath(node, rootSymbol, checker, unwrapExpression) {
  const segments = [];
  let current = node;
  while (ts.isPropertyAccessExpression(current)) {
    segments.unshift(current.name.text);
    current = unwrapExpression(current.expression);
  }
  if (!ts.isIdentifier(current)) return null;
  return checker.getSymbolAtLocation(current) === rootSymbol ? segments : null;
}

function collectPropertyAccessKeys({
  sourceFile,
  checker,
  consumer,
  catalogKeys,
  unwrapExpression,
}) {
  const keys = new Set();
  const root = getUniqueMatch(
    findTopLevelVariableDeclarations(sourceFile, consumer.rootName),
  );
  if (root.status !== "matched") return { keys, status: root.status };
  if (!isConstVariableDeclaration(root.match)) {
    return { keys, status: "unsupported" };
  }
  const rootSymbol = checker.getSymbolAtLocation(root.match.name);
  if (!rootSymbol) return { keys, status: "missing" };
  let matchedAccess = false;
  let unsupportedAccess = false;

  function visit(node) {
    if (ts.isElementAccessExpression(node)) {
      let current = unwrapExpression(node.expression);
      while (ts.isPropertyAccessExpression(current)) {
        current = unwrapExpression(current.expression);
      }
      if (
        ts.isIdentifier(current) &&
        checker.getSymbolAtLocation(current) === rootSymbol
      ) {
        unsupportedAccess = true;
      }
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      !(
        ts.isPropertyAccessExpression(node.parent) &&
        node.parent.expression === node
      )
    ) {
      const pathSegments = getPropertyAccessPath(
        node,
        rootSymbol,
        checker,
        unwrapExpression,
      );
      if (pathSegments && pathSegments.length > 0) {
        matchedAccess = true;
        const key = `${consumer.prefix}${pathSegments.join(".")}`;
        const childPrefix = `${key}.`;
        const children = [...catalogKeys].filter((catalogKey) =>
          catalogKey.startsWith(childPrefix),
        );
        if (children.length > 0) {
          for (const child of children) keys.add(child);
        } else {
          keys.add(key);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return {
    keys,
    status: unsupportedAccess
      ? "unsupported"
      : matchedAccess
        ? "matched"
        : "missing",
  };
}

function collectCallArgumentKeys({
  sourceFile,
  checker,
  consumer,
  getStaticString,
}) {
  const keys = new Set();
  const owner = getUniqueMatch(
    findNamedFunctionDeclarations(sourceFile, consumer.ownerFunction),
  );
  if (owner.status !== "matched") return { keys, status: owner.status };
  const target = getUniqueMatch(
    findDirectFunctionBindingIdentifiers(owner.match, consumer.callee),
  );
  if (target.status !== "matched") return { keys, status: target.status };
  const targetSymbol = checker.getSymbolAtLocation(target.match);
  if (!targetSymbol) return { keys, status: "missing" };
  let matchedCall = false;
  let unsupportedCall = false;

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      checker.getSymbolAtLocation(node.expression) === targetSymbol
    ) {
      const value = getStaticString(node.arguments[0], new Map());
      if (value !== undefined) {
        matchedCall = true;
        for (const prefix of consumer.prefixes) keys.add(`${prefix}${value}`);
      } else {
        unsupportedCall = true;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(owner.match);
  return {
    keys,
    status: unsupportedCall
      ? "unsupported"
      : matchedCall
        ? "matched"
        : "missing",
  };
}

function createConsumerCollector({ unwrapExpression, getStaticString }) {
  function getStaticPrimitive(node) {
    const current = unwrapExpression(node);
    if (!current) return undefined;
    if (
      ts.isStringLiteral(current) ||
      ts.isNoSubstitutionTemplateLiteral(current) ||
      ts.isNumericLiteral(current)
    ) {
      return current.text;
    }
    if (current.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (current.kind === ts.SyntaxKind.FalseKeyword) return false;
    return undefined;
  }

  function getObjectPropertyResult(object, propertyName) {
    for (const property of object.properties) {
      if (
        ts.isShorthandPropertyAssignment(property) &&
        property.name.text === propertyName
      ) {
        return { status: "unsupported" };
      }
      if (!ts.isPropertyAssignment(property)) continue;
      if (getPropertyName(property.name) !== propertyName) continue;
      const value = getStaticPrimitive(property.initializer);
      return value === undefined
        ? { status: "unsupported" }
        : { status: "matched", value };
    }
    return { status: "missing" };
  }

  function matchesEntryFilters(object, filters = []) {
    for (const filter of filters) {
      const result = getObjectPropertyResult(object, filter.property);
      if (result.status === "unsupported") {
        return { matches: false, supported: false };
      }
      if (result.status === "missing") {
        return { matches: false, supported: true };
      }
      if (Object.hasOwn(filter, "equals")) {
        if (result.value !== filter.equals) {
          return { matches: false, supported: true };
        }
        continue;
      }
      if (Object.hasOwn(filter, "notEquals")) {
        if (result.value === filter.notEquals) {
          return { matches: false, supported: true };
        }
        continue;
      }
      return { matches: false, supported: false };
    }
    return { matches: true, supported: true };
  }

  function getTopLevelVariableInitializer(sourceFile, sourceName) {
    const result = getUniqueMatch(
      findTopLevelVariableDeclarations(sourceFile, sourceName),
    );
    if (result.status !== "matched") return result;
    if (!isConstVariableDeclaration(result.match)) {
      return { status: "unsupported" };
    }
    const initializer = result.match.initializer
      ? unwrapExpression(result.match.initializer)
      : undefined;
    return initializer
      ? { initializer, status: "matched" }
      : { status: "missing" };
  }

  function containsCollectionSpread(node) {
    let found = false;
    function visit(current) {
      if (found || ts.isFunctionLike(current)) return;
      if (ts.isSpreadAssignment(current) || ts.isSpreadElement(current)) {
        found = true;
        return;
      }
      ts.forEachChild(current, visit);
    }
    visit(node);
    return found;
  }

  function collectFilteredObjectEntryKeys(sourceFile, sourceName, filters) {
    const source = getTopLevelVariableInitializer(sourceFile, sourceName);
    const keys = new Set();
    if (source.status !== "matched") return { keys, status: source.status };
    if (containsCollectionSpread(source.initializer)) {
      return { keys, status: "unsupported" };
    }
    if (!ts.isObjectLiteralExpression(source.initializer)) {
      return { keys, status: "missing" };
    }
    for (const property of source.initializer.properties) {
      if (!ts.isPropertyAssignment(property)) {
        return { keys, status: "unsupported" };
      }
      const key = getPropertyName(property.name);
      const value = unwrapExpression(property.initializer);
      if (key === undefined || !value || !ts.isObjectLiteralExpression(value)) {
        return { keys, status: "unsupported" };
      }
      const filterResult = matchesEntryFilters(value, filters);
      if (!filterResult.supported) return { keys, status: "unsupported" };
      if (filterResult.matches) keys.add(key);
    }
    return { keys, status: "matched" };
  }

  function collectFilteredPropertyValues(initializer, consumer, values) {
    if (!consumer.valueProperty || !consumer.entryFilters) return null;
    const unwrapped = unwrapExpression(initializer);
    if (!unwrapped) return null;
    let entryNodes = [];
    if (ts.isObjectLiteralExpression(unwrapped)) {
      for (const property of unwrapped.properties) {
        if (!ts.isPropertyAssignment(property)) {
          return { status: "unsupported" };
        }
        entryNodes.push(unwrapExpression(property.initializer));
      }
    } else if (ts.isArrayLiteralExpression(unwrapped)) {
      entryNodes = unwrapped.elements.map((element) =>
        unwrapExpression(element),
      );
    } else {
      return null;
    }
    for (const entry of entryNodes) {
      if (!entry || !ts.isObjectLiteralExpression(entry)) {
        return { status: "unsupported" };
      }
      const filterResult = matchesEntryFilters(entry, consumer.entryFilters);
      if (!filterResult.supported) return { status: "unsupported" };
      if (!filterResult.matches) continue;
      const valueResult = getObjectPropertyResult(
        entry,
        consumer.valueProperty,
      );
      if (
        valueResult.status !== "matched" ||
        typeof valueResult.value !== "string"
      ) {
        return { status: "unsupported" };
      }
      values.add(valueResult.value);
    }
    return { status: "matched" };
  }

  function collectNamedCollectionValues(sourceFile, consumer) {
    const values = new Set();
    const source = getTopLevelVariableInitializer(
      sourceFile,
      consumer.sourceName,
    );
    if (source.status !== "matched") {
      return { status: source.status, values };
    }
    if (containsCollectionSpread(source.initializer)) {
      return { status: "unsupported", values };
    }
    const entryKeys = consumer.entryKeySource
      ? collectFilteredObjectEntryKeys(
          sourceFile,
          consumer.entryKeySource.sourceName,
          consumer.entryKeySource.filters,
        )
      : null;
    if (entryKeys && entryKeys.status !== "matched") {
      return { status: entryKeys.status, values };
    }
    const allowedEntryKeys = entryKeys?.keys ?? null;

    function getCollectionValue(node) {
      const value = getStaticString(node, new Map());
      return value;
    }

    let unsupportedValue = false;

    function collectConfiguredPropertyValue(node) {
      if (
        ts.isShorthandPropertyAssignment(node) &&
        node.name.text === consumer.valueProperty
      ) {
        unsupportedValue = true;
        return;
      }
      if (!ts.isPropertyAssignment(node)) return;
      const propertyName = getPropertyName(node.name);
      if (propertyName !== consumer.valueProperty) return;
      const value = getStaticString(node.initializer, new Map());
      if (value !== undefined) {
        values.add(value);
      } else if (
        unwrapExpression(node.initializer)?.kind !== ts.SyntaxKind.NullKeyword
      ) {
        unsupportedValue = true;
      }
    }

    function collectValues(node) {
      if (ts.isFunctionLike(node)) return;
      if (consumer.valueProperty) {
        collectConfiguredPropertyValue(node);
        ts.forEachChild(node, collectValues);
        return;
      }

      const current = unwrapExpression(node);
      if (current && ts.isArrayLiteralExpression(current)) {
        for (const element of current.elements) {
          const value = getCollectionValue(element);
          if (value !== undefined) values.add(value);
          else unsupportedValue = true;
        }
        return;
      }
      if (current && ts.isObjectLiteralExpression(current)) {
        for (const property of current.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const entryKey = getPropertyName(property.name);
          if (
            allowedEntryKeys &&
            (entryKey === undefined || !allowedEntryKeys.has(entryKey))
          ) {
            continue;
          }
          const value = getCollectionValue(property.initializer);
          if (value !== undefined) values.add(value);
          else unsupportedValue = true;
        }
        return;
      }
      unsupportedValue = true;
    }

    const filteredValues = collectFilteredPropertyValues(
      source.initializer,
      consumer,
      values,
    );
    if (filteredValues?.status === "unsupported") {
      return { status: "unsupported", values };
    }
    if (!filteredValues) {
      collectValues(source.initializer);
    }
    return {
      status: unsupportedValue ? "unsupported" : "matched",
      values,
    };
  }

  return { collectNamedCollectionValues };
}

function collectObjectKeyConsumerUsage({
  sourceProgram,
  objectKeyConsumers,
  unwrapExpression,
  getStaticString,
}) {
  const findings = [];
  const staticKeys = new Set();

  for (const consumer of objectKeyConsumers) {
    const sourceFile = sourceProgram.sourceFiles.get(consumer.file);
    if (!sourceFile) {
      findings.push({
        file: "scripts/quality/message-key-usage-baseline.js",
        error: `message object-key consumer source is missing "${consumer.file}"`,
      });
      continue;
    }
    const source = getUniqueMatch(
      findTopLevelVariableDeclarations(sourceFile, consumer.objectName),
    );
    if (source.status === "ambiguous") {
      findings.push({
        file: "scripts/quality/message-key-usage-baseline.js",
        error: `message object-key consumer is ambiguous "${consumer.file}#${consumer.objectName}"`,
      });
      continue;
    }
    if (
      source.status === "matched" &&
      !isConstVariableDeclaration(source.match)
    ) {
      findings.push({
        file: "scripts/quality/message-key-usage-baseline.js",
        error: `message object-key consumer is unsupported "${consumer.file}#${consumer.objectName}"`,
      });
      continue;
    }
    const initializer = unwrapExpression(source.match?.initializer);
    if (
      source.status !== "matched" ||
      !ts.isObjectLiteralExpression(initializer)
    ) {
      findings.push({
        file: "scripts/quality/message-key-usage-baseline.js",
        error: `message object-key consumer is stale "${consumer.file}#${consumer.objectName}"`,
      });
      continue;
    }
    const objectKeys = new Set();
    let unsupportedProperty = false;
    for (const property of initializer.properties) {
      if (!ts.isPropertyAssignment(property)) {
        unsupportedProperty = true;
        break;
      }
      const propertyName = getStaticString(property.name, new Map());
      if (propertyName !== undefined) {
        objectKeys.add(`${consumer.prefix}${propertyName}`);
      } else if (ts.isIdentifier(property.name)) {
        objectKeys.add(`${consumer.prefix}${property.name.text}`);
      } else {
        unsupportedProperty = true;
        break;
      }
    }
    if (unsupportedProperty) {
      findings.push({
        file: "scripts/quality/message-key-usage-baseline.js",
        error: `message object-key consumer is unsupported "${consumer.file}#${consumer.objectName}"`,
      });
      continue;
    }
    for (const key of objectKeys) staticKeys.add(key);
  }

  return { findings, staticKeys };
}

function collectDerivedKeyConsumerUsage({
  sourceEntries,
  sourceProgram,
  catalogKeys,
  derivedKeyConsumers,
  unwrapExpression,
  getStaticString,
}) {
  const collectors = createConsumerCollector({
    unwrapExpression,
    getStaticString,
  });
  const sourceByFile = new Map(
    sourceEntries.map((entry) => [entry.file, entry.content]),
  );
  const findings = [];
  const staticKeys = new Set();
  for (const consumer of derivedKeyConsumers) {
    const content = sourceByFile.get(consumer.file);
    if (content === undefined) {
      findings.push({
        file: "scripts/quality/message-key-usage-baseline.js",
        error: `derived message key consumer source is missing "${consumer.file}"`,
      });
      continue;
    }
    const sourceFile = sourceProgram.sourceFiles.get(consumer.file);
    if (!sourceFile) {
      findings.push({
        file: "scripts/quality/message-key-usage-baseline.js",
        error: `derived message key consumer source is missing "${consumer.file}"`,
      });
      continue;
    }

    let keys = new Set();
    let status = "missing";
    if (consumer.kind === "collection-values") {
      const result = collectors.collectNamedCollectionValues(
        sourceFile,
        consumer,
      );
      status = result.status;
      for (const value of result.values) {
        for (const suffix of consumer.suffixes) {
          keys.add(`${consumer.prefix}${value}${suffix}`);
        }
      }
    } else if (consumer.kind === "property-accesses") {
      const result = collectPropertyAccessKeys({
        sourceFile,
        checker: sourceProgram.checker,
        consumer,
        catalogKeys,
        unwrapExpression,
      });
      status = result.status;
      keys = result.keys;
    } else if (consumer.kind === "call-arguments") {
      const result = collectCallArgumentKeys({
        sourceFile,
        checker: sourceProgram.checker,
        consumer,
        getStaticString,
      });
      status = result.status;
      keys = result.keys;
    }

    if (status !== "matched" || keys.size === 0) {
      findings.push({
        file: "scripts/quality/message-key-usage-baseline.js",
        error: `derived message key consumer is ${status === "ambiguous" ? "ambiguous" : status === "unsupported" ? "unsupported" : "stale"} "${consumer.file}#${consumer.kind}"`,
      });
      continue;
    }
    for (const key of keys) staticKeys.add(key);
  }
  return { findings, staticKeys };
}

module.exports = {
  collectDerivedKeyConsumerUsage,
  collectObjectKeyConsumerUsage,
  // 通用 TS AST 助手，`message-key-usage.js` 也要用。那边已经把
  // unwrapExpression / getStaticString 注入进来了，这两条走反方向：定义在
  // 下层、被上层引用，省得两边各留一份会各自漂移的拷贝。
  getBindingIdentifier,
  isConstVariableDeclaration,
};
