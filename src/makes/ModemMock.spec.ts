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

        const list = await docker.listContainers();
        expect(list.length).toBe(1);
        expect(list[0].Status).toMatch(/^Up \d+ seconds$/);

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

    it("should list containers with different filters", async (): Promise<void> => {
        const {docker} = getContext("v1");

        const stream = await docker.pull("node:23");
        await followStream(stream);

        const c1 = await docker.createContainer({
            name: "container1",
            Image: "node:23"
        });
        const c2 = await docker.createContainer({
            name: "container2",
            Image: "node:23"
        });

        // Initially both are stopped (created status)
        let list = await docker.listContainers();
        expect(list.length).toBe(0);

        list = await docker.listContainers({all: true});
        expect(list.length).toBe(2);

        await c1.start();

        // Now c1 is running
        list = await docker.listContainers();
        expect(list.length).toBe(1);
        expect(list[0].Id).toBe(c1.id);

        await c2.start();
        list = await docker.listContainers();
        expect(list.length).toBe(2);

        await c1.stop();
        list = await docker.listContainers();
        expect(list.length).toBe(1);
        expect(list[0].Id).toBe(c2.id);

        list = await docker.listContainers({all: true});
        expect(list.length).toBe(2);
    });

    it("should list containers filtered by name", async (): Promise<void> => {
        const {docker} = getContext("v1");

        const stream = await docker.pull("node:23");
        await followStream(stream);

        await docker.createContainer({
            name: "web-server",
            Image: "node:23"
        });
        await docker.createContainer({
            name: "db-server",
            Image: "node:23"
        });

        const list = await docker.listContainers({
            all: true,
            filters: {
                name: ["web-server"]
            }
        });

        expect(list.length).toBe(1);
        expect(list[0].Names).toContain("web-server");
    });

    it("should list containers filtered by status", async (): Promise<void> => {
        const {docker} = getContext("v1");

        const stream = await docker.pull("node:23");
        await followStream(stream);

        const c1 = await docker.createContainer({
            name: "web-server",
            Image: "node:23"
        });
        await docker.createContainer({
            name: "db-server",
            Image: "node:23"
        });

        await c1.start();

        const runningList = await docker.listContainers({
            filters: {
                status: ["running"]
            }
        });
        expect(runningList.length).toBe(1);
        expect(runningList[0].Names).toContain("web-server");

        const createdList = await docker.listContainers({
            all: true,
            filters: {
                status: ["created"]
            }
        });
        expect(createdList.length).toBe(1);
        expect(createdList[0].Names).toContain("db-server");
    });

    it("should list containers filtered by multiple names", async (): Promise<void> => {
        const {docker} = getContext("v1");

        const stream = await docker.pull("node:23");
        await followStream(stream);

        await docker.createContainer({
            name: "c1",
            Image: "node:23"
        });
        await docker.createContainer({
            name: "c2",
            Image: "node:23"
        });
        await docker.createContainer({
            name: "c3",
            Image: "node:23"
        });

        const list = await docker.listContainers({
            all: true,
            filters: {
                name: ["c1", "c3"]
            }
        });

        expect(list.length).toBe(2);
        const names = list.map(c => c.Names[0]);
        expect(names).toContain("c1");
        expect(names).toContain("c3");
        expect(names).not.toContain("c2");
    });

    it("should list containers filtered by multiple statuses", async (): Promise<void> => {
        const {docker} = getContext("v1");

        const stream = await docker.pull("node:23");
        await followStream(stream);

        const c1 = await docker.createContainer({
            name: "c1",
            Image: "node:23"
        });
        const c2 = await docker.createContainer({
            name: "c2",
            Image: "node:23"
        });
        const c3 = await docker.createContainer({
            name: "c3",
            Image: "node:23"
        });

        await c1.start();
        await c2.start();
        await c2.stop();

        // c1: running, c2: exited, c3: created
        const list = await docker.listContainers({
            all: true,
            filters: {
                status: ["running", "created"]
            }
        });

        expect(list.length).toBe(2);
        const statuses = list.map(c => c.State);
        expect(statuses).toContain("running");
        expect(statuses).toContain("created");
        expect(statuses).not.toContain("exited");
    });

    it("should create two containers and remove one", async (): Promise<void> => {
        const {docker} = getContext("v1");

        const stream = await docker.pull("node:23");
        await followStream(stream);

        const c1 = await docker.createContainer({
            name: "container-1",
            Image: "node:23"
        });

        const c2 = await docker.createContainer({
            name: "container-2",
            Image: "node:23"
        });

        let list = await docker.listContainers({all: true});
        expect(list.length).toBe(2);

        await c1.remove();

        list = await docker.listContainers({all: true});
        expect(list.length).toBe(1);
        expect(list[0].Names).toContain("container-2");
        expect(list[0].Id).toBe(c2.id);

        await expect(docker.getContainer(c1.id).inspect()).rejects.toThrow();
    });

    it("should resize container", async (): Promise<void> => {
        const {docker} = getContext("v1");

        const stream = await docker.pull("node:23");
        await followStream(stream);

        const container = await docker.createContainer({
            name: "test-resize",
            Image: "node:23"
        });

        await container.resize({
            h: 40,
            w: 80
        });

        const inspect = await container.inspect();
        expect(inspect.HostConfig.ConsoleSize).toEqual([40, 80]);
    });
});
