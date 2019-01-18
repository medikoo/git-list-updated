"use strict";

const { resolve }  = require("path")
    , { Readable } = require("stream")
    , { assert }   = require("chai")
    , proxyquire   = require("proxyquire");

const testList = ["LICENSE", "foo", "test/index.js", "elo"]
    , existingList = ["LICENSE", "test/index.js"];

const listUpdated = proxyquire("../", {
	"child-process-ext/spawn": () => {
		let onResolve;
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
});
