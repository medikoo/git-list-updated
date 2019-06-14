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
	constructor(dirname, spawnPromise, extensions) {
		super({ decodeStrings: false, encoding: "utf8" });
		this.dirname = dirname;
		this.extensions = extensions;
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
		if (this.extensions) {
			if (!this.extensions.some(extension => chunk.endsWith(`.${ extension }`))) {
				callback();
				return;
			}
		}
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
		    , head = isValue(options.head) ? ensureString(options.head) : "HEAD"
		    , extensions = isObject(options.ext) ? Array.from(options.ext).map(ensureString) : null;

		const spawnPromise = spawn("git", ["diff", "--name-only", `${ base }...${ head }`], {
			cwd,
			split: true
		});
		spawnPromise.catch(error => {
			if (!error.stderrBuffer) return;
			const errorMessage = String(error.stderrBuffer);
			if (errorMessage.includes("unknown revision or path not in the working tree")) {
				const refs = [base, head].filter(ref => ref !== "HEAD");
				if (refs.length > 1) {
					error.message = `Either '${ base }' or '${ head }' is not in the working tree`;
				} else {
					error.message = `'${ refs[0] }' is not in the working tree`;
				}
			} else {
				error.message = errorMessage;
			}
		});
		const { stdout } = spawnPromise;
		if (!stdout) return spawnPromise;
		return stdout.pipe(new ExistingFilesFilter(cwd, spawnPromise, extensions));
	} catch (error) {
		return Promise.reject(error);
	}
};
