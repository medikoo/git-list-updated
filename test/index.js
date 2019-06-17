"use strict";

const { resolve }  = require("path")
    , { Readable } = require("stream")
    , { assert }   = require("chai")
    , proxyquire   = require("proxyquire");

const testList = ["LICENSE", "foo", "test/index.js", "elo"]
    , existingList = ["LICENSE", "test/index.js"];

const listUpdated = proxyquire("../", {
	"child-process-ext/spawn": (cmdName, [, , range]) => {
		let onResolve;
		if (range === "master...HEAD") {
			const promise = new Promise(resolve => {
				onResolve = () => resolve({ stdoutBuffer: `${ testList.join("\n") }\n` });
			});
			let index = 0;
			promise.stdout = new Readable({
				encoding: "utf8",
				read() {
					if (index === testList.length) {
						this.push(null);
						onResolve();
					} else {
						this.push(testList[index++], "utf8");
					}
				}
			});
			return promise;
		}
		if (range === "foo...HEAD") {
			const promise = new Promise((resolve, reject) => {
				onResolve = () =>
					reject(
						Object.assign(new Error("Error"), {
							stderrBuffer: [
								"fatal: ambiguous argument 'master...HEAD': " +
									"unknown revision or path not in the working tree.",
								"Use '--' to separate paths from revisions, like this:",
								"git <command> [<revision>...] -- [<file>...]"
							].join("\n")
						})
					);
			});
			promise.stdout = new Readable({
				encoding: "utf8",
				read() {
					onResolve();
					this.push(null);
				}
			});
			return promise;
		}
	}
});

const testPath = resolve(__dirname, "..");

describe("(main)", () => {
	it("Should resolve with expected list", () =>
		listUpdated(testPath).then(result => assert.deepEqual(result, existingList))
	);
	it("Should emit 'data' events with existing files", () => {
		const emitted = [], promise = listUpdated(testPath);
		promise.on("data", data => emitted.push(data));
		promise.then(() => assert.deepEqual(emitted, existingList));
	});
	it("Should filter according to \"ext\" option", () =>
		listUpdated(testPath, { ext: ["js"] }).then(result =>
			assert.deepEqual(result, existingList.filter(filename => filename.endsWith(".js")))
		)
	);
	it("Should reject with meaningful message", () =>
		listUpdated(testPath, { base: "foo", ext: ["js"] }).then(
			() => { throw new Error("Unexpected"); },
			error => { assert.equal(error.message, "'foo' is not in the working tree"); }
		)
	);
});
