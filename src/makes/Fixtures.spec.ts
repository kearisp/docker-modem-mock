import {describe, it, beforeEach, expect, jest} from "@jest/globals";
import {FileSystem, FileSystemDriver} from "@wocker/core";
import {Readable, Writable} from "stream";
import {vol} from "memfs";
import {Fixtures} from "./Fixtures";


describe("Fixtures", (): void => {
    const testFS = new FileSystem("/home/wocker-test/fixtures", vol as unknown as FileSystemDriver),
          testFixtures = Fixtures.fromPath(testFS.path());

    beforeEach((): void => {
        vol.reset();
        vol.mkdirSync(testFS.path(), {
            recursive: true
        });
    });

    it("should return null when inspecting non-existent image", (): void => {
        expect(testFixtures.imageInspect("v1", "not", "found")).toBeNull();
    });

    it("should throw error when reading from stream fails", async (): Promise<void> => {
        const stream = new Readable({
            objectMode: true,
            read(): void {
                this.emit("error", new Error("Read error"));
            }
        });

        await expect(testFixtures.recordStream(stream, testFS.createWriteStream("test.txt"))).rejects.toThrow();
    });

    it("should pause and resume the readable stream on backpressure", async (): Promise<void> => {
        const chunkLimit = 3;
        let chunkIndex = 0;

        const stream = new Readable({
            highWaterMark: 1,
            read(): void {
                chunkIndex++;

                if(chunkIndex < chunkLimit) {
                    this.push(chunkIndex.toString());
                }
                else {
                    this.push(null);
                }
            }
        });

        const target = new Writable({
            objectMode: true,
            highWaterMark: 1,
            write(_chunk, _encoding, callback) {
                if(chunkIndex === 2) {
                    setTimeout(() => {
                        callback();
                    }, false as unknown as number);
                }
                else {
                    callback();
                }
            }
        });

        jest.spyOn(stream, "pause");
        jest.spyOn(stream, "resume");
        jest.spyOn(target, "once");

        await testFixtures.recordStream(stream, target);

        expect(stream.pause).toHaveBeenCalled();
        expect(stream.resume).toHaveBeenCalled();
        expect(target.once).toHaveBeenCalledWith("drain", expect.any(Function));
    });
});
