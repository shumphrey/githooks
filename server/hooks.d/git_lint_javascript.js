#!/usr/bin/env node

/*
 * ./git_lint_javascript <commit> <file> <defaultconfigfile>
 *
 * This script takes a commit and a file
 * works out the best eslint config file to use and then runs eslint against
 * the file contained within the commit
 *
 * If the commit contains a local .eslint in yml format, this will be used as
 * the config.
 * Otherwise a default eslint config needs to be supplied.
 *
 * A local config is forced to extend the default config
 * This ensures we have a common minimum
 *
 * This only supports yaml eslint files in the root of the directory
 * It does not support hierarchical eslint files.
 * It does not support eslint files that extend a local file
 * It does not support json eslint files
 * It does not support package.json eslint files
 *
 */

'use strict';

/* eslint no-unused-vars: [2, {"varsIgnorePattern": "colour"}] */

const fs        = require('fs');
const path      = require('path');
const execSync  = require('child_process').execSync;
const _         = require('lodash');
const yaml      = require('js-yaml');
const colour    = require('colour');
const CLIEngine = require('eslint').CLIEngine;

// We can either include this
// or run it as a script
module.exports = run;
if ( !module.parent ) {
    const commit         = process.argv[2];
    const file           = process.argv[3];
    const DEFAULT_CONFIG = process.argv[4];

    if ( !commit || !file ) {
        console.error('./git_lint.js <commit> <file> <defaulteslint>');
        process.exit(1);
    }

    const errorstrings = run(commit, file, DEFAULT_CONFIG);
    // Print out any errors
    // exitcode is number of errors
    if ( errorstrings.length ) {
        console.error(errorstrings.join("\n"));
        process.exit(errorstrings.length);
    }
}

function run(commit, file, defaultconfig) {
    const config = getConfig(commit, defaultconfig);
    const source = getSource(commit, file);

    /* now we actually lint our source code */
    const cli = new CLIEngine({
        // envs: ["browser", "node", "es6", "mocha"],
        useEslintrc: false,
        baseConfig: config,
    });

    const messages = cli.executeOnText(source).results[0].messages;

    /* Loop through the messages
    * count the errors
    * construct the returned error strings
    */
    const errorstrings = [];
    messages.forEach((e) => {
        if ( e.severity === 2 ) {
            errorstrings.push(formatMessage(file, e));
        }
    });

    return errorstrings;
}

/* Pretty print the error message */
function formatMessage(file, e) {
    const where = `${file}:${e.line}:${e.column}`;
    return `${where.green} - ${e.message.red} [${e.ruleId.blue}]`;
}

/* This gets the most appropriate config file
 * Either the project specific one
 * or a global one if project doesn't have one
 */
function getConfig(commit, defaultconfig) {
    // We currently only support yaml based eslintrc files
    // If we can't parse it as yaml, we'll use a global default
    let config;
    for (const file of ['.eslintrc', '.eslintrc.yml', '.eslintrc.yaml']) {
        try {
            const buf = execSync(`git cat-file -p ${commit}:${file} 2>/dev/null`);
            config = yaml.load(buf.toString());
            break;
        }
        catch (e) {
            // file doesn't exist in this repo
        }
    }

    // Default
    if ( !config ) {
        const buf = fs.readFileSync(path.resolve(defaultconfig));
        config = yaml.load(buf.toString());
    }
    // add the company wide default config file to extends
    // This ensures we extended eslint:recommended
    // And any other rules we might have
    else if ( _.isArray(config.extends) ) {
        config.extends.unshift(defaultconfig);
    }
    else {
        config.extends = [defaultconfig, config.extends];
    }

    return config;
}

/* Obtain the source code from git
 * since the repo doesn't have checked out files */
function getSource(commit, file) {
    const buf = execSync(`git cat-file -p ${commit}:${file}`);
    return buf.toString();
}
