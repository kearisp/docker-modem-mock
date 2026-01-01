import {describe, it, expect} from "@jest/globals";
import {FileSystemDriver} from "@wocker/core";
import {vol} from "memfs";
import {FixturesGen} from "./FixturesGen";


describe("FixturesGen", (): void => {
    it("should generate build stream with correct data", (done) => {
        const fixtures = FixturesGen.fromPath("/home/wocker-test/fixtures", vol as unknown as FileSystemDriver);
        const stream = fixtures.build("1.0.0", "2.0.0", "node", "node:latest");
        const chunks: string[] = [];

        stream.on("data", (chunk) => {
            chunks.push(chunk);
        });

        stream.on("end", () => {
            expect(chunks).toHaveLength(2);
            expect(chunks[0]).toBe(`{"stream":"Successfully built 8fadf8b40731\\n"}`);
            expect(chunks[1]).toBe(`{"stream":"Successfully tagged node:latest\\n"}`);
            done();
        });
    });

    it("should create readable stream in object mode", () => {
        const fixtures = FixturesGen.fromPath("/home/wocker-test/fixtures", vol as unknown as FileSystemDriver);
        const stream = fixtures.build("1.0.0", "2.0.0", "node", "node:latest");

        expect(stream.readable).toBe(true);
        expect(stream.readableObjectMode).toBe(true);
    });
});
