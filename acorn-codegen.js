/* global generateDeclaration, generateExpression */
'use strict';

/*
 * A code generator for import/export nodes in ES6 using Acorn's AST.
 *
 * Author: Isiah Meadows
 * License: Unlicense
 */


function getId(specifier) {
    return specifier.id.name;
}


function getName(specifier) {
    return specifier.name.name;
}


function fromClause(source) {
    if (source.raw)
        return source.raw;

    var str = source.value;
    var singles = str.split("'");
    var doubles = str.split('"');

    if (singles.length > doubles.length)
        return " from '" + singles.join("\\'") + "';";
    else
        return ' from "' + doubles.join('\\"') + '";';
}


function generateSpecifier(specifier) {
    var id = getId(specifier);
    var name = getName(specifier);

    if (name == null)
        return id;
    else
        return id + " as " + name;
}


function generateCurlyList(specifiers, i) {
    var ret = "{" + generateSpecifier(specifiers[i++]);
    for ( ; i < specifiers.length; i++) {
        ret += "," + generateSpecifier(specifiers[i]);
    }
    return ret + "}";
}


function generateList(specifiers) {
    var len = specifiers.length;
    var firstSpecifier = specifiers[0];
    var firstType = firstSpecifier.type;
    var firstName = getName(firstSpecifier);
    var str = "";
    var start = 1;

    if (firstType.default) {
        str = getName(firstSpecifier);

        if (len === 1)
            return str;
        else if (specifiers[1].type === "ImportBatchSpecifier")
            return str + ", * as " + getName(specifiers[1]);

        str += ", ";
    } else if (firstType === "ImportBatchSpecifier") {
        str = "* as " + firstName;

        if (len === 1)
            return str;
        else if (specifiers[1].default)
            return str + ", " + getName(specifiers[1]);

        str += ", ";
    } else {
        start = 0;
    }

    return str + generateCurlyList(specifiers, start);
}


exports.generateImport = function (node) {
    return "import " + generateList(node.specifiers) + fromClause(node.source);
};


exports.generateExport = function (node) {
    var specifiers = node.specifiers;

    if (node.declaration != null) {
        if (specifiers[0].default)
            return "export default " +
                generateExpression(node.declaration) + ";";
        else
            return "export " + generateDeclaration(node.declaration) + ";";
    } else if (specifiers[0].type === "ExportBatchSpecifier") {
        return "export *" + fromClause(node.source);
    }

    var str = "export " + generateCurlyList(specifiers, 0);

    if (node.source != null)
        return str + fromClause(node.source) + ";";
    else
        return str + ";";
};
