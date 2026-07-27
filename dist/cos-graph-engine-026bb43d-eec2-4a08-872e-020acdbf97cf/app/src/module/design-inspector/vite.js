"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stableHiggsfieldDesignHash = stableHiggsfieldDesignHash;
exports.higgsfieldDesignSourceBabelPlugin = higgsfieldDesignSourceBabelPlugin;
exports.higgsfieldDesignInspectorDefine = higgsfieldDesignInspectorDefine;
exports.higgsfieldDesignInspectorVitePlugin = higgsfieldDesignInspectorVitePlugin;
const DESIGN_REGISTRY_MODULE = "@/module/design-inspector/registry";
const CREATE_DESIGN_REF_LOCAL = "__hfCreateDesignRef";
const COMPOSE_DESIGN_REFS_LOCAL = "__hfComposeDesignRefs";
function stableHiggsfieldDesignHash(input) {
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
        hash = (Math.imul(31, hash) + input.charCodeAt(index)) | 0;
    }
    return Math.abs(hash).toString(36);
}
function normalizeFileName(filename) {
    if (!filename) {
        return null;
    }
    const normalized = filename.replace(/\\/g, "/");
    const marker = "/app/";
    const index = normalized.lastIndexOf(marker);
    return index >= 0 ? normalized.slice(index + marker.length) : normalized;
}
function routeForFile(file) {
    const marker = "src/routes/";
    const index = file.indexOf(marker);
    if (index < 0) {
        return null;
    }
    return file.slice(index + marker.length).replace(/\.(tsx|ts|jsx|js)$/, "");
}
function isIntrinsicTagName(name) {
    return /^[a-z]/.test(name) && !name.includes(".");
}
function isComponentTagName(name) {
    return /^[A-Z]/.test(name);
}
function jsxNameToString(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    const node = value;
    if (node.type === "JSXIdentifier" && typeof node.name === "string") {
        return node.name;
    }
    if (node.type === "JSXMemberExpression") {
        const objectName = jsxNameToString(node.object);
        const propertyName = jsxNameToString(node.property);
        return objectName && propertyName ? `${objectName}.${propertyName}` : null;
    }
    return null;
}
function shouldSkipTagName(name) {
    return name === "Fragment" || name === "React.Fragment";
}
function getAttribute(path, name) {
    const attributes = path.node.attributes ?? [];
    for (let index = 0; index < attributes.length; index += 1) {
        const attribute = attributes[index];
        if (!attribute || typeof attribute !== "object" || !("name" in attribute)) {
            continue;
        }
        const attrName = attribute.name;
        if (attrName?.name === name) {
            return { attribute: attribute, index };
        }
    }
    return null;
}
function refExpression(attribute) {
    const value = attribute.value;
    if (!value || value.type === "StringLiteral") {
        return null;
    }
    if (value.type !== "JSXExpressionContainer") {
        return null;
    }
    const expression = value.expression;
    if (!expression ||
        expression.type === "JSXEmptyExpression" ||
        expression.type === "StringLiteral") {
        return null;
    }
    return expression;
}
function ensureNamedImport(api, programPath, importedName, localName) {
    const t = api.types;
    const body = (programPath.node.body ?? []);
    const existing = body.find((node) => {
        const source = node.source;
        return node.type === "ImportDeclaration" && source?.value === DESIGN_REGISTRY_MODULE;
    });
    const specifier = t.importSpecifier(t.identifier(localName), t.identifier(importedName));
    if (existing) {
        const specifiers = (existing.specifiers ?? []);
        const alreadyImported = specifiers.some((item) => item.local?.name === localName);
        if (!alreadyImported) {
            specifiers.push(specifier);
        }
        return;
    }
    body.unshift(t.importDeclaration([specifier], t.stringLiteral(DESIGN_REGISTRY_MODULE)));
}
function programForPath(path) {
    return path.findParent?.((parent) => Boolean(parent.isProgram?.())) ?? null;
}
function componentNameForPath(path, fallback) {
    const owner = path.findParent?.((parent) => {
        const type = parent.node.type;
        return type === "FunctionDeclaration" || type === "VariableDeclarator";
    });
    const nodeName = owner?.node.id?.name;
    if (nodeName) {
        return nodeName;
    }
    const parentName = owner?.parent?.id?.name;
    return parentName ?? fallback;
}
function metaObject(api, input) {
    const t = api.types;
    const properties = [
        t.objectProperty(t.identifier("nodeId"), t.stringLiteral(input.nodeId)),
        t.objectProperty(t.identifier("componentName"), t.stringLiteral(input.componentName)),
        t.objectProperty(t.identifier("sourceFile"), t.stringLiteral(input.sourceFile)),
        t.objectProperty(t.identifier("tagName"), t.stringLiteral(input.tagName)),
    ];
    if (typeof input.sourceLine === "number") {
        properties.push(t.objectProperty(t.identifier("sourceLine"), t.numericLiteral(input.sourceLine)));
    }
    if (typeof input.sourceColumn === "number") {
        properties.push(t.objectProperty(t.identifier("sourceColumn"), t.numericLiteral(input.sourceColumn)));
    }
    if (input.routeFile) {
        properties.push(t.objectProperty(t.identifier("routeFile"), t.stringLiteral(input.routeFile)));
    }
    return t.objectExpression(properties);
}
function higgsfieldDesignSourceBabelPlugin(api) {
    return {
        name: "higgsfield-design-source-registry",
        visitor: {
            JSXOpeningElement(path) {
                const file = normalizeFileName(path.hub?.file?.opts?.filename);
                if (!file || file.includes("packages/") || file.includes("routeTree.gen")) {
                    return;
                }
                const tagName = jsxNameToString(path.node.name);
                if (!tagName || shouldSkipTagName(tagName)) {
                    return;
                }
                const isIntrinsic = isIntrinsicTagName(tagName);
                const isComponent = isComponentTagName(tagName);
                if (!isIntrinsic && !isComponent) {
                    return;
                }
                const programPath = programForPath(path);
                if (!programPath) {
                    return;
                }
                const line = path.node.loc?.start?.line;
                const column = path.node.loc?.start?.column;
                const sourceColumn = typeof column === "number" ? column + 1 : undefined;
                const nodeSeed = `${file}:${line ?? 0}:${column ?? 0}:${tagName}`;
                const createRefCall = api.types.callExpression(api.types.identifier(CREATE_DESIGN_REF_LOCAL), [
                    metaObject(api, {
                        nodeId: stableHiggsfieldDesignHash(nodeSeed),
                        componentName: isIntrinsic ? componentNameForPath(path, tagName) : tagName,
                        sourceFile: file,
                        sourceLine: line,
                        sourceColumn,
                        routeFile: routeForFile(file),
                        tagName,
                    }),
                ]);
                ensureNamedImport(api, programPath, "createHiggsfieldDesignRef", CREATE_DESIGN_REF_LOCAL);
                const ref = getAttribute(path, "ref");
                if (!ref) {
                    path.node.attributes?.push(api.types.jsxAttribute(api.types.jsxIdentifier("ref"), api.types.jsxExpressionContainer(createRefCall)));
                    return;
                }
                const existingRef = refExpression(ref.attribute);
                if (!existingRef) {
                    return;
                }
                ensureNamedImport(api, programPath, "composeHiggsfieldDesignRefs", COMPOSE_DESIGN_REFS_LOCAL);
                ref.attribute.value = api.types.jsxExpressionContainer(api.types.callExpression(api.types.identifier(COMPOSE_DESIGN_REFS_LOCAL), [
                    existingRef,
                    createRefCall,
                ]));
            },
        },
    };
}
function higgsfieldDesignInspectorDefine(enabled) {
    return {
        __HF_DESIGN_INSPECTOR__: JSON.stringify(enabled),
    };
}
function higgsfieldDesignInspectorVitePlugin(enabled) {
    return {
        name: "higgsfield-design-inspector-define",
        config() {
            return {
                define: higgsfieldDesignInspectorDefine(enabled),
            };
        },
    };
}
//# sourceMappingURL=vite.js.map