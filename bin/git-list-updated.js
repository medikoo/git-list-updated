#!/usr/bin/env node

"use strict";

require("essentials");

const meta = require("../package");

const argv = require("minimist")(process.argv.slice(2), { string: ["base", "head"] });

const usage = `git-list-updated v${ meta.version }

Usage: git-list-updated [-h | --help] [--base=<base>] [--head=<head>] [<path>]

List updated and existing files for repository at <path> (defaults to current working folder)
at <head> against <base> branch.

Options:

    --base <base> Base to compare against (defaults to 'master')
    --head <head> Head to compare against (defaults to 'HEAD')
    --help,            -h  Show this message

`;

if (argv.h || argv.help) {
	process.stdout.write(usage);
	return;
}

if (argv.v || argv.version) {
	process.stdout.write(`${ meta.version }\n`);
	return;
}

const path = argv._[0] || process.cwd();

require("../")(path, argv).on("data", data => process.stdout.write(`${ data }\n`));
