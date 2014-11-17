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

    if (id === name)
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
    var firstId = getId(specifiers[0]);
    var firstName = getName(specifiers[0]);
    var str = "";
    var start = 1;

    if (firstId === "*default*") {
        str = firstName;

        if (len === 1)
            return str;
        else if (getId(specifiers[1]) === "*")
            return str + ", * as " + getName(specifiers[1]);

        str += ", ";
    } else if (firstId === "*") {
        str = "* as " + firstName;

        if (len === 1)
            return str;
        else if (getId(specifiers[1]) === "*")
            return str + ", " + getName(specifiers[1]);

        str += ", ";
    } else {
        start = 0;
    }

    return str + generateCurlyList(specifiers, 0);
}


exports.generateImport = function (node) {
    return "import " + generateList(node.specifiers) + fromClause(node.source);
};


exports.generateExport = function (node) {
    var specifiers = node.specifiers;

    if (node.declaration != null) {
        if (getId(specifiers[0]) === "default")
            return "export default " +
                generateExpression(node.declaration) + ";";
        else
            return "export " + generateDeclaration(node.declaration) + ";";
    } else if (getId(specifiers[0]) === "*") {
        return "export *" + fromClause(node.source);
    }

    var last = specifiers.pop();
    var str = "export " + generateCurlyList(specifiers, last);

    if (node.source != null)
        return str + fromClause(node.source) + ";";
    else
        return str + ";";
};
