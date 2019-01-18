"use strict";

const isObject      = require("es5-ext/object/is-object")
    , isValue       = require("es5-ext/object/is-value")
    , ensureString  = require("es5-ext/object/validate-stringifiable-value")
    , { lstat }     = require("fs")
    , { resolve }   = require("path")
    , { Transform } = require("stream")
    , toThenable    = require("2-thenable")
    , spawn         = require("child-process-ext/spawn");

class ExistingFilesFilter extends Transform {
	constructor(dirname, spawnPromise) {
		super({ decodeStrings: false, encoding: "utf8" });
		this.dirname = dirname;
		this.files = [];
		toThenable(
			this,
			new Promise((promiseResolve, reject) => {
				this.on("error", reject);
				this.on("data", chunk => this.files.push(chunk));
				spawnPromise.catch(reject);
				this.on("end", () => promiseResolve(spawnPromise.then(() => this.files)));
			})
		);
	}
	_transform(chunk, encoding, callback) {
		lstat(resolve(this.dirname, chunk), error => {
			if (error) {
				if (error.code === "ENOENT") {
					callback();
					return;
				}
				callback(error);
				return;
			}
			callback(null, chunk);
		});
	}
}

module.exports = (cwd, options = {}) => {
	try {
		cwd = resolve(ensureString(cwd));
		if (!isObject(options)) options = {};
		const base = isValue(options.base) ? ensureString(options.base) : "master"
		    , head = isValue(options.head) ? ensureString(options.head) : "HEAD";

		const spawnPromise = spawn("git", ["diff", "--name-only", `${ base }...${ head }`], {
			cwd,
			split: true
		});
		const { stdout } = spawnPromise;
		if (!stdout) return spawnPromise;
		return stdout.pipe(new ExistingFilesFilter(cwd, spawnPromise));
	} catch (error) {
		return Promise.reject(error);
	}
};
