import {describe, it, expect, beforeEach} from "@jest/globals";
import {DockerStorage} from "../makes/DockerStorage";
import {HttpException} from "../exceptions/HttpException";
import {Container} from "../types/Container";
import {Image} from "../types/Image";
import {ContainerPipe, NetworkPipe, ImagePipe} from "./pipes";


describe("pipes", (): void => {
    let storage: DockerStorage;

    beforeEach((): void => {
        storage = new DockerStorage();
    });

    it("ContainerPipe should resolve a container", (): void => {
        const container = {Id: "abc"} as Container;

        storage.addContainer(container);

        expect(new ContainerPipe(storage).transform("abc")).toBe(container);
    });

    it("ContainerPipe should throw 404 for an unknown container", (): void => {
        expect.assertions(2);

        try {
            new ContainerPipe(storage).transform("nope");
        }
        catch(err) {
            expect(err).toBeInstanceOf(HttpException);
            expect(err).toMatchObject({status: 404, message: "No such container: nope"});
        }
    });

    it("NetworkPipe should resolve a network by name", (): void => {
        expect(new NetworkPipe(storage).transform("bridge").Name).toBe("bridge");
    });

    it("NetworkPipe should throw 404 for an unknown network", (): void => {
        expect(() => new NetworkPipe(storage).transform("nope")).toThrow("network nope not found");
    });

    it("ImagePipe should resolve an image by tag", (): void => {
        const image = {Id: "i", RepoTags: ["node:23"]} as Image;

        storage.addImage(image);

        expect(new ImagePipe(storage).transform("node:23")).toBe(image);
    });

    it("ImagePipe should throw 404 for an unknown image", (): void => {
        expect(() => new ImagePipe(storage).transform("nope:1")).toThrow("Image nope:1 not found");
    });
});
