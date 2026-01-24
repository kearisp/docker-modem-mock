import {describe, it, expect} from "@jest/globals";
import {FileSystem} from "@wocker/core";
import {Logger} from "@kearisp/cli";
import Docker from "dockerode";
import {ModemMock} from "./ModemMock";
import {Fixtures} from "./Fixtures";


describe("ModemMock", () => {
    const fs = new FileSystem(`${__dirname}/../../fixtures`),
          fixtures = Fixtures.fromFS(fs);

    const getContext = (version: string) => {
        const modem = new ModemMock({
            mockFixtures: fixtures,
            version: version === "v1" ? undefined : version
        });

        const docker = new Docker({
            // @ts-ignore
            modem
        });

        return {docker};
    };

    const followStream = async (stream: NodeJS.ReadableStream, log?: boolean): Promise<void> => {
        await new Promise<void>((resolve, reject) => {
            stream.on("data", (chunk): void => {
                try {
                    const text = chunk.toString().replace(/}\s*\{/g, '},{'),
                          items: any[] = JSON.parse(`[${text}]`);

                    if(log) {
                        Logger.info(items);
                    }
                }
                catch(err) {
                    expect(err).toBeNull();
                }
            });
            stream.on("end", resolve);
            stream.on("error", reject);
        });
    };

    it("should pull image", async (): Promise<void> => {
        const {docker} = getContext("v1");

        const image = docker.getImage("node:23");

        await expect(image.inspect()).rejects.toThrow();

        const stream = await docker.pull("node:23");

        await followStream(stream, false);

        const inspectInfo = await image.inspect();

        expect(inspectInfo.RepoTags).toContain("node:23");

        await image.remove();

        const images = await docker.listImages();

        expect(images).toEqual([]);
    });

    it("should build image", async (): Promise<void> => {
        const version = "v1";
        const {docker} = getContext(version);

        const name = "test-project",
              tag = "latest",
              image = docker.getImage(`${name}:${tag}`);

        await expect(image.inspect()).rejects.toThrow();

        const stream = await docker.buildImage({
            context: fs.path(`projects/${name}`),
            src: fs.readdir(`projects/${name}`, {
                recursive: true
            })
        }, {
            t: `${name}:${tag}`,
            dockerfile: "./Dockerfile",
            forcerm: true
        });

        await followStream(stream);

        const inspect = await image.inspect();

        expect(inspect).not.toBeNull();
        expect(inspect.RepoTags).toContain(`${name}:${tag}`);
    });

    it("should retrieve list of images", async (): Promise<void> => {
        const {docker} = getContext("v1");

        expect(await docker.listImages({all: true})).toEqual([]);

        await followStream(await docker.pull("node:23"));

        const images = await docker.listImages();

        expect(images.length).toBe(1);
        expect(images[0].RepoTags).toEqual(["node:23"]);
    });

    it("should throw error when inspecting non-existent image", async (): Promise<void> => {
        const {docker} = getContext("v1");

        await expect(docker.pull("not:found")).rejects.toThrow();
    });

    it("should throw error when inspecting non-existent container", async (): Promise<void> => {
        const {docker} = getContext("v1");

        await expect(docker.getContainer("not-exists").inspect()).rejects.toThrow();
    });

    it("should get empty containers list", async (): Promise<void> => {
        const {docker} = getContext("v1");

        const containers = await docker.listContainers({
            all: true
        });

        expect(containers).toEqual([]);
    });

    it("should start container", async (): Promise<void> => {
        const {docker} = getContext("v1");

        const beforeStart = new Date();

        const stream = await docker.pull("node:23");

        await followStream(stream);

        const container = await docker.createContainer({
            name: "test.workspace",
            Image: "node:23"
        });

        let inspectInfo = await container.inspect();

        expect(inspectInfo.Id).toBe(container.id);
        expect(inspectInfo.State.Running).toBeFalsy();
        expect(inspectInfo.State.Dead).toBeFalsy();
        expect(inspectInfo.State.Status).toBe("created");
        expect(inspectInfo.State.Error).toBe("");

        await container.start();

        inspectInfo = await container.inspect();

        expect(inspectInfo.Id).toBe(container.id);
        expect(inspectInfo.State.Running).toBeTruthy();
        expect(inspectInfo.State.Dead).toBeFalsy();
        expect(inspectInfo.State.Status).toBe("running");
        expect(inspectInfo.State.Error).toBe("");
        expect(new Date(inspectInfo.State.StartedAt).getTime()).toBeGreaterThan(beforeStart.getTime());

        await container.stop();

        inspectInfo = await container.inspect();

        expect(inspectInfo.Id).toBe(container.id);
        expect(inspectInfo.State.Running).toBeFalsy();

        await container.remove();

        const containers = await docker.listContainers();

        expect(containers.length).toBe(0);
    });

    it("should rename container", async (): Promise<void> => {
        const {docker} = getContext("v1");

        const stream = await docker.pull("node:23");

        await followStream(stream);

        const container = await docker.createContainer({
            name: "test.workspace",
            Image: "node:23"
        });

        await container.rename({
            name: "test-1.workspace"
        });

        const list = await docker.listContainers({
            all: true
        });

        expect(list.length).toBe(1);

        if(list.length === 1) {
            expect(list[0].Names).toEqual(["test-1.workspace"]);
        }
    });
});
