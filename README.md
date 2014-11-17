*Note: All source code in this repository is under the Unlicense.*

Proposal for SpiderMonkey AST representation for import and export statements
=============================================================================

The current AST format is both inconsistent and complicated. Esprima and Acorn
have two different syntax trees for the same thing, and that currently heavily
hinders inter-op between the two. Since the module syntax is stabilized, but I
can tell the AST format isn't quite settled, I thought I would come up with a
more detailed proposal for the import and export declaration AST representation.


Reasoning behind the interface choice
-------------------------------------

1.  It's simple. It doesn't take a lot of extra logic to parse and create, and
    it will take even less to consume for most applications.

2.  It's more generic. The simplicity also alleviates a need for some of the
    current types, and it is still a mere equality comparison for determining
    import/export types. Checking for a default or namespace import is as simple
    as checking the imported identifier "binding"'s name. It is almost as simple
    to check if a binding is imported under an alias. It doesn't immediately
    show in the simpler cases, but it shows with larger ones. See
    &quot;./&#42;-codegen.js&quot; for examples of an identical code generator
    targeting all three AST formats. Here are some smaller examples of the API
    differences.

    ```js
    function proposal_isDefault(specifier) {
        return specifier.id.name === "default";
    }


    function acorn_isDefault(specifier) {
        return specifier.default ||
            specifier.type === "ImportSpecifier" &&
                specifier.id.name === "default";
    }


    function esprima_isDefault(specifier) {
        var type = specifier.type;
        return type === "ImportDefaultSpecifier" ||
            type === "ImportSpecifier" &&
                specifier.id.name === "default";
    }


    function proposal_isNamed(specifier) {
        var id = specifier.id.name;
        return id === specifier.name.name && id !== "default";
    }


    function acorn_isNamed(specifier) {
        return specifier.type === "ImportSpecifier" &&
            specifier.id.name !== "default";
    }


    function esprima_isNamed(specifier) {
        return specifier.type === "ImportSpecifier" &&
            specifier.id.name !== "default";
    }


    function proposal_isNamespace(specifier) {
        return specifier.id.name === "*";
    }


    function acorn_isNamed(specifier) {
        var type = specifier.type;
        return type === "ImportBatchSpecifier" ||
            type === "ExportBatchSpecifier";
    }


    function esprima_isNamed(specifier) {
        var type = specifier.type;
        return type === "ImportNamespaceSpecifier" ||
            type === "ExportBatchSpecifier";
    }
    ```

3.  It's strikingly similar to what the ES6 specification uses internally. Many
    of the special identifier names are taken straight from there, without
    modification. The special identifier names themselves aren't technically
    valid identifiers in any context. The people who devised the specification
    spent a lot longer designing the module functionality than it takes for us
    to define an AST representation.

--------------------------------------------------------------------------------


Import/Export AST Proposal
==========================

The interfaces specified by the Mozilla Parser API specification are used
throughout the specification here.

``​`null`​`` represents the language-specific primitive `null` or equivalent.


Interfaces
----------

### Syntax Notes

`private interface`

-   This interface is merely for specification purposes, and MUST NOT be exposed
    in any way through the public API.

`string`

-   This is an instance of Literal with the extra assertion that it represents
    an ECMAScript primitive string literal.

### Specification

  - The common parts of an import and export node.

```idl
private interface ImportExportDeclaration :> Node {
    specifiers: Specifier[]
    source: string or `null`
}
```

  - An import/export specifier.

```idl
private interface ModuleSpecifier :> Node {
    id: Identifier or `null`
    name: Identifier or `null`
}
```

  - An import declaration. E.g. `import name from "module";`

```idl
interface ImportDeclaration :> ImportExportDeclaration {
    type: "ImportDeclaration"
}
```

  - An import specifier. E.g. `name` in `import {name} from "module"`.

```idl
interface ImportSpecifier :> ModuleSpecifier {
    type: "ImportSpecifier"
}
```

  - An export declaration. E.g. `export {name}`.

```idl
interface ExportDeclaration :> ImportExportDeclaration {
    type: "ExportDeclaration"
    declaration: Expression or Declaration or `null`
}
```

  - An export specifier. E.g. `name` in `export {name}`.

```idl
interface ExportSpecifier :> ModuleSpecifier {
    type: "ExportSpecifier"
}
```


Parsing Cases
-------------

### Syntax Notes

The specification is written according to the rules of a ScriptBody in the
ECMAScript 6 specification. The following variables are accessible in the
section's global scope:

  - `capture(name: string, script: string[], callback: function(returnValue))`

    This is purely for specification purposes, and MUST NOT be exposed to user
    code. It is also OPTIONAL for a conforming implementation to implement this
    internal function - an equivalent process MAY be used.

    > Non-normative note for implementors:
    >
    > It may be significantly faster to use an equivalent process.

    For purposes of this specification, let `returnValue` be a local variable
    initialized to an empty ECMAScript object or language-specific map with
    string keys and `Node` values.

      - `name: string`

        The name of the production.

      - `script: string[]`

        An array of script strings to match against the source. See below for
        more details on the parsing rules.

      - `callback: function(returnValue: object): Node`

        The callback to get the production's AST value, called with argument
        `returnValue`. The return value of this is the value of the production
        `name`'s AST.

    The `script` string is to be interpreted literally after the following rules
    are applied:

      - `$(value: string)`

        Capture an ECMAScript primitive string node in this place, and store it
        in a property of `returnValue` named `value`.

      - `$(value: type)`

        Capture a node or production of type `type` in this place and store it
        in a property of `returnValue` named `value`.

  - All non-private interfaces are available as constructors, each taking a single
    object with the specified parameters.

    Exceptions:

    1.  `Identifier(name)` is equivalent to `Identifier({ name })`.

    2.  If the `raw` property of `Literal` exists, then `Literal(value)` is
        equivalent to `Literal({ value, raw })`, where `raw` is the exact
        ECMAScript source code representation of `value`.

        Otherwise, `Literal(value)` is equivalent to `Literal({ value })`.



### Specification

```js
capture(
"ImportAliasSpecifier",
    ["$(binding: Identifier) as $(alias: Identifier)"],

_ =>
    ImportSpecifier({
        "id": _.binding,
        "name": _.alias
    })
);


capture(
"ImportDefaultSpecifier",
    ["$(binding: Identifier)"],

_ =>
    ImportSpecifier({
        "id": Identifier("*default*"),
        "name": _.binding
    })
);


capture(
"ImportNamespaceSpecifier",
    ["* as $(binding: Identifier)"],

_ =>
    ImportSpecifier({
        "id": Identifier("*"),
        "name": _.binding
    })
);

capture(
"ImportUnaliasedSpecifier",
    ["$(binding: Identifier)"],

_ =>
    ImportSpecifier(
        id: _.binding,
        name: _.binding
    )
);


capture(
"ImportNamedSpecifier",
    ["$(binding: ImportAliasSpecifier)",
     "$(binding: ImportUnaliasedSpecifier)"],

_ =>
    _.binding
);


capture(
"ImportNamedSpecifierList",
    ["$(binding: ImportNamedSpecifier)"],

_ =>
    [ _.binding ]
);


capture(
"ImportNamedSpecifierList",
    ["$(binding: ImportNamedSpecifier), $(bindings: ImportNamedSpecifierList)"],

_ =>
    [
        binding,
        ...bindings
    ]
);


capture(
"ImportDeclaration",
    ["import $(name: ImportDefaultSpecifier) from $(source) ;"],

_ =>
    ImportDeclaration({
        specifiers: [ _.name ],
        source: _.source
    })
);


capture(
"ImportDeclaration",
    ["import $(source) ;"],

_ =>
    ImportDeclaration({
        specifiers: []
        source: _.source
    })
);


capture(
"ImportDeclaration",
    ["import $(binding: ImportNamespaceSpecifier) from $(source) ;"],

_ =>
    ImportDeclaration({
        specifiers: [ _.binding ],
        source: _.source
    })
);


capture(
"ImportDeclaration",
    ["import $(def: ImportDefaultSpecifier),
        $(name: ImportNamespaceSpecifier) from $(source) ;"],

_ =>
    ImportDeclaration({
        specifiers: [
            _.def,
            _.name
        ],
        source: _.source
    })
);


capture(
"ImportDeclaration",
    ["import $(name: ImportNamespaceSpecifier),
        $(def: ImportDefaultSpecifier) from $(source) ;"],

_ =>
    ImportDeclaration({
        specifiers: [
            _.name
            _.def,
        ],
        source: _.source
    })
);


capture(
"ImportDeclaration",
    ["import { $(bindings: ImportNamedSpecifierList) } from $(source) ;"],

_ =>
    ImportDeclaration({
        specifiers: _.bindings,
        source: _.source
    })


capture(
"ImportDeclaration",
    ["import $(def),
        { $(bindings: ImportNamedSpecifierList) } from $(source) ;"],

_ =>
    ImportDeclaration({
        specifiers: [
            _.def,
            ..._.bindings
        ],
        source: _.source
    })
);


capture(
"ExportAliasSpecifier",
    ["$(binding: Identifier) as $(alias: Identifier)"],

_ =>
    ExportSpecifier({
        id: _.binding,
        name: _.alias
    })
);


capture(
"ExportUnaliasedSpecifier",
    ["$(binding: Identifier)"],

_ =>
    ExportSpecifier({
        id: _.binding,
        name: _.binding
    })
);


capture(
"ExportNamedSpecifier",
    ["$(binding: ExportAliasSpecifier)"],

_ =>
    _.binding
);


capture(
"ExportNamedSpecifier[]",
    ["$(binding: ExportNamedSpecifier)"],

_ =>
    [ _.binding ]
);


capture(
"ExportNamedSpecifier[]",
    ["$(binding: ExportNamedSpecifier), $(bindings: ExportNamedSpecifier[])"],

_ =>
    [
        _.binding,
        ..._.bindings
    ]
);


capture(
"ExportDeclaration",
    ["export $(binding: ExportBatchSpecifier) from $(source) ;"],

_ =>
    ExportDeclaration({
        declaration: `null`,
        specifiers: [ _.binding ],
        source: _.source
    })
);


capture(
"ExportDeclaration",
    ["export * from $(source) ;"],

_ =>
    ExportDeclaration({
        declaration: `null`,
        specifiers: [
            ExportSpecifier(
                id: Identifier("*")
                name: null
            )
        ],
        source: _.source
    })
);


capture(
"ExportDeclaration",
    ["export { $(bindings: ExportNamedSpecifier[]) } from $(source) ;"],

_ =>
    ExportDeclaration({
        declaration: `null`,
        specifiers: _.bindings,
        source: _.source
    })
);


capture(
"ExportDeclaration",
    ["export { $(bindings: ExportNamedSpecifier[]) } ;"],

_ =>
    ExportDeclaration({
        declaration: `null`,
        specifiers: _.bindings,
        source: `null`
    })
);


function declToSpecifier(decl) {
    let ident = decl.id;
    return ExportSpecifier({
        id: ident,
        name: ident
    });
}


capture(
"ExportDeclaration",
    ["export $(declaration: VariableDeclaration) ;"],

_ => {
    let declaration = _.declaration;
    let specifiers = declaration.declarations.map(declToSpecifier);

    return ExportDeclaration({
        declaration,
        specifiers,
        source: `null`
    })
});


capture(
"ExportDeclaration",
    ["export $(func: FunctionDeclaration) ;"],

_ =>
    ExportDeclaration({
        declaration: _.func,
        specifiers: [
            declToSpecifier(_.func)
        ],
        source: `null`
    })
);


capture(
"ExportDeclaration",
    ["export default $(expr: Expression) ;"],

_ =>
    ExportDeclaration({
        declaration: expr,
        specifiers: [
            ExportSpecifier(
                id: Identifier("default"),
                name: Identifier("*default*")
            )
        ],
        source: null
    })
);
```


Examples
--------

### Default
```js
import request from "request";
```

```json
{
    "type": "ImportDeclaration",
    "specifiers": [
        {
            "type": "ImportSpecifier",
            "id": {
                "type": "Identifier",
                "name": "default",
            },
            "name": {
                "type": "Identifier",
                "name": "request"
            }
        }
    ],
    "source": {
        "type": "Literal",
        "value": "request",
        "raw": "\"request\""
    }
}
```

--------------------------------------------------------------------------------

### Namespace
```js
import * as _ from "underscore";
```

```json
{
    "type": "ImportDeclaration",
    "specifiers": [
        {
            "type": "ImportSpecifier",
            "id": {
                "type": "Identifier",
                "name": "*",
            },
            "name": {
                "type": "Identifier",
                "name": "_"
            }
        }
    ],
    "source": {
        "type": "Literal",
        "value": "underscore",
        "raw": "\"underscore\""
    }
}
```

--------------------------------------------------------------------------------

### Default + Namespace
```js
import $, * as jQuery from "jquery";
```

```json
{
    "type": "ImportDeclaration",
    "specifiers": [
        {
            "type": "ImportSpecifier",
            "id": {
                "type": "Identifier",
                "name": "default",
            },
            "name": {
                "type": "Identifier",
                "name": "$"
            }
        },
        {
            "type": "ImportSpecifier",
            "id": "*",
            "name": "jQuery"
        }
    ],
    "source": {
        "type": "Literal",
        "value": "jquery",
        "raw": "\"jquery\""
    }
}
```

--------------------------------------------------------------------------------

### Namespace + Default
```js
import * as _, chain from "lodash";
```

```json
{
    "type": "ImportDeclaration",
    "specifiers": [
        {
            "type": "ImportSpecifier",
            "id": {
                "type": "Identifier",
                "name": "default",
            },
            "name": {
                "type": "Identifier",
                "name": "chain"
            }
        },
        {
            "type": "ImportSpecifier",
            "id": "*",
            "name": "_"
        }
    ],
    "source": {
        "type": "Literal",
        "value": "lodash",
        "raw": "\"lodash\""
    }
}
```

--------------------------------------------------------------------------------

### Default + Named
```js
import $, {each, ajax} from "jquery";
```

```json
{
    "type": "ImportDeclaration",
    "specifiers": [
        {
            "type": "ImportSpecifier",
            "id": {
                "type": "Identifier",
                "name": "default",
            },
            "name": {
                "type": "Identifier",
                "name": "$"
            }
        },
        {
            "type": "ImportSpecifier",
            "id": {
                "type": "Identifier",
                "name": "each",
            },
            "name": {
                "type": "Identifier",
                "name": "each"
            }
        },
        {
            "type": "ImportSpecifier",
            "id": {
                "type": "Identifier",
                "name": "ajax",
            },
            "name": {
                "type": "Identifier",
                "name": "ajax"
            }
        }
    ],
    "source": {
        "type": "Literal",
        "value": "jquery",
        "raw": "\"jquery\""
    }
}
```

--------------------------------------------------------------------------------

### Named
```js
import {map, reduce} from "underscore";
```

```json
{
    "type": "ImportDeclaration",
    "specifiers": [
        {
            "type": "ImportSpecifier",
            "id": {
                "type": "Identifier",
                "name": "map",
            },
            "name": {
                "type": "Identifier",
                "name": "map"
            }
        },
        {
            "type": "ImportSpecifier",
            "id": {
                "type": "Identifier",
                "name": "reduce",
            },
            "name": {
                "type": "Identifier",
                "name": "reduce"
            }
        }
    ],
    "source": {
        "type": "Literal",
        "value": "underscore",
        "raw": "\"underscore\""
    }
}
```

--------------------------------------------------------------------------------

### Default Export
```js
export default foo;
```

```json
{
    "type": "ExportDeclaration",
    "declaration": {
        "type": "Identifier",
        "name": "foo"
    },
    "specifiers": [
        {
            "type": "ExportSpecifier",
            "id": {
                "type": "Identifier",
                "name": "default"
            },
            "name": {
                "type": "Identifier",
                "name": "*default*"
            }
        }
    ],
    "source": null
}
```

--------------------------------------------------------------------------------

### Named Export
```js
export {foo, bar};
```

```json
{
    "type": "ExportDeclaration",
    "declaration": null,
    "specifiers": [
        {
            "type": "ExportSpecifier",
            "id": {
                "type": "Identifier",
                "name": "foo"
            },
            "name": {
                "type": "Identifier",
                "name": "foo"
            }
        }
    ],
    "source": null
}
```

--------------------------------------------------------------------------------

### Named Export From Module
```js
export {foo, bar} from "mod";
```

```json
{
    "type": "ExportDeclaration",
    "declaration": null,
    "specifiers": [
        {
            "type": "ExportSpecifier",
            "id": {
                "type": "Identifier",
                "name": "foo"
            },
            "name": {
                "type": "Identifier",
                "name": "foo"
            }
        }
    ],
    "source": {
        "type": "Literal",
        "value": "mod",
        "raw": "\"mod\""
    }
}
```

--------------------------------------------------------------------------------

### Namespace Export
```js
export * from "mod";
```

```json
{
    "type": "ExportDeclaration",
    "declaration": null,
    "specifiers": [
        {
            "type": "ExportSpecifier",
            "id": {
                "type": "Identifier",
                "name": "*"
            },
            "name": null
        }
    ],
    "source": {
        "type": "Literal",
        "value": "mod",
        "raw": "\"mod\""
    }
}
```

--------------------------------------------------------------------------------

### Export Variable Declaration
```js
export var foo = 1;
```

```json
{
    "type": "ExportDeclaration",
    "declaration": {
        "type": "VariableDeclaration",
        "declarations": [
            {
                "type": "VariableDeclarator",
                "id": {
                    "type": "Identifier",
                    "name": "foo"
                },
                "init": {
                    "type": "Literal",
                    "value": 1,
                    "raw": "1"
                }
            }
        ]
    },
    "specifiers": [
        {
            "type": "ExportSpecifier",
            "id": {
                "type": "Identifier",
                "name": "foo"
            },
            "name": {
                "type": "Identifier",
                "name": "foo"
            }
        }
    ],
    "source": null
}
```
