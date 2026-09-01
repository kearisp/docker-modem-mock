import {describe, it, expect} from "@jest/globals";
import {FileSystem} from "@wocker/core";
import {Logger} from "@kearisp/cli";
import Docker from "dockerode";
import {ModemMock} from "./ModemMock";
import {ModemRecorder} from "./ModemRecorder";
import {Fixtures} from "./Fixtures";


describe("ModemMock", () => {
    const fs = new FileSystem(`${__dirname}/../../fixtures`),
          fixtures = Fixtures.fromFS(fs);

    const getContext = (version: string) => {
        const modem = new ModemMock({
            mockFixtures: fixtures,
            version: version === "v1" ? undefined : version
        });

        const modemRecorder = new ModemRecorder({
            recordFixtures: fixtures,
            version: version === "v1" ? undefined : version
        });

        const docker = new Docker({
            // @ts-ignore
            modem
        });

        const dockerRecorder = new Docker({
            // @ts-ignore
            modem: modemRecorder
        });

        return {docker, dockerRecorder};
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

    it("should retrieve filtered list of images", async () => {
        const {
            docker
            // dockerRecorder: docker
        } = getContext("v1");

        await followStream(await docker.pull("node:22"));
        await followStream(await docker.pull("node:23"));
        await followStream(await docker.pull("node:24"));
        await followStream(await docker.pull("node:25"));

        const images = await docker.listImages({
            // all: true,
            filters: {
                reference: ["node:22"]
            }
        });

        console.log(images.map(i => i.RepoTags![0]));

        expect(images.length).toBe(1);
        expect(images[0].RepoTags).toContain("node:22");

        const imagesWildcard = await docker.listImages({
            filters: {
                reference: ["node:*"]
            }
        });

        expect(imagesWildcard.length).toBe(4);

        // Test "before" filter
        // node:22 - 2026-03-05
        // node:23 - 2025-05-15
        // node:24 - 2026-02-24
        // node:25 - 2026-03-03
        // Order: 23 (2025-05) < 24 (2026-02) < 25 (2026-03-03) < 22 (2026-03-05)
        const imagesBefore = await docker.listImages({
            filters: {
                before: ["node:25"]
            }
        });

        // node:23 and node:24 are before node:25
        expect(imagesBefore.length).toBe(2);
        const tagsBefore = imagesBefore.map(i => i.RepoTags![0]);
        expect(tagsBefore).toContain("node:23");
        expect(tagsBefore).toContain("node:24");

        // Test "since" filter
        const imagesSince = await docker.listImages({
            filters: {
                since: ["node:25"]
            }
        });

        // node:22 is after node:25
        expect(imagesSince.length).toBe(1);
        expect(imagesSince[0].RepoTags).toContain("node:22");

        // Test "until" filter
        const imagesUntil = await docker.listImages({
            filters: {
                until: ["2026-01-01"]
            }
        });

        // Only node:23 (2025-05) is before 2026
        expect(imagesUntil.length).toBe(1);
        expect(imagesUntil[0].RepoTags).toContain("node:23");

        // Test "dangling" filter
        const imagesDangling = await docker.listImages({
            filters: {
                dangling: ["false"]
            }
        });

        // All pulled images have tags
        expect(imagesDangling.length).toBe(4);

        const imagesDanglingTrue = await docker.listImages({
            filters: {
                dangling: ["true"]
            }
        });

        expect(imagesDanglingTrue.length).toBe(0);
    });

    it("should throw error when inspecting non-existent image", async (): Promise<void> => {
        const {docker} = getContext("v1");

        await expect(docker.pull("not:found")).rejects.toThrow();
    });

    it("should throw error when inspecting non-existent container", async (): Promise<void> => {
        const {docker} = getContext("v1");

        await expect(docker.getContainer("not-exists").inspect()).rejects.toThrow();
    });

    it("should create a network and inspect it", async (): Promise<void> => {
        const {docker} = getContext("v1");

        const network = await docker.createNetwork({
            Name: "test-net",
            Driver: "bridge"
        });

        expect(network.id).toBeTruthy();

        const inspectInfo = await docker.getNetwork(network.id).inspect();

        expect(inspectInfo.Id).toBe(network.id);
        expect(inspectInfo.Name).toBe("test-net");
        expect(inspectInfo.Driver).toBe("bridge");

        const networks = await docker.listNetworks();

        expect(networks.map((network) => network.Name)).toContain("test-net");
    });

    it("should create a container attached to a custom network", async (): Promise<void> => {
        const {docker} = getContext("v1");

        await followStream(await docker.pull("node:23"));

        const network = await docker.createNetwork({
            Name: "custom-net"
        });

        const container = await docker.createContainer({
            name: "network.workspace",
            Image: "node:23",
            HostConfig: {
                NetworkMode: "custom-net"
            }
        });

        const inspectInfo = await container.inspect();

        expect(inspectInfo.HostConfig.NetworkMode).toBe("custom-net");
        expect(inspectInfo.NetworkSettings.Networks).toHaveProperty("custom-net");
        expect(inspectInfo.NetworkSettings.Networks["custom-net"].NetworkID).toBe(network.id);

        await container.remove();
    });

    it("should default to the bridge network when none is specified", async (): Promise<void> => {
        const {docker} = getContext("v1");

        await followStream(await docker.pull("node:23"));

        const container = await docker.createContainer({
            name: "default-network.workspace",
            Image: "node:23"
        });

        const inspectInfo = await container.inspect();

        expect(inspectInfo.HostConfig.NetworkMode).toBe("bridge");
        expect(inspectInfo.NetworkSettings.Networks).toHaveProperty("bridge");
        expect(inspectInfo.NetworkSettings.Networks.bridge.NetworkID).toBeTruthy();

        await container.remove();
    });

    it("should throw the same error Docker returns when creating a container with a non-existent network", async (): Promise<void> => {
        const {docker} = getContext("v1");

        await followStream(await docker.pull("node:23"));

        let thrown: any;

        try {
            await docker.createContainer({
                name: "missing-network.workspace",
                Image: "node:23",
                HostConfig: {
                    NetworkMode: "does-not-exist"
                }
            });
        }
        catch(err) {
            thrown = err;
        }

        expect(thrown).toBeDefined();
        expect(thrown.statusCode).toBe(404);
        expect(thrown.json.message).toBe("network does-not-exist not found");
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
            expect(list[0].Names).toEqual(["/test-1.workspace"]);
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
        expect(list[0].Names).toContain("/web-server");
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
        expect(runningList[0].Names).toContain("/web-server");

        const createdList = await docker.listContainers({
            all: true,
            filters: {
                status: ["created"]
            }
        });
        expect(createdList.length).toBe(1);
        expect(createdList[0].Names).toContain("/db-server");
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
        expect(names).toContain("/c1");
        expect(names).toContain("/c3");
        expect(names).not.toContain("/c2");
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

    it("should list containers filtered by label", async (): Promise<void> => {
        const {docker} = getContext("v1");

        await followStream(await docker.pull("node:23"));

        const c0 = await docker.createContainer({
            name: "c0",
            Image: "node:23"
        });

        const c1 = await docker.createContainer({
            name: "c1",
            Image: "node:23",
            Labels: {
                "test": "c1",
                "test.c1": "true"
            }
        });

        const c2 = await docker.createContainer({
            name: "c2",
            Image: "node:23",
            Labels: {
                "test": "c2",
                "test.c2": "true"
            }
        });

        const c0Info = await c0.inspect(),
              c1Info = await c1.inspect(),
              c2Info = await c2.inspect();

        expect(c0Info.Config.Labels).not.toHaveProperty("test");
        expect(c0Info.Config.Labels).not.toHaveProperty("test.c1");
        expect(c0Info.Config.Labels).not.toHaveProperty("test.c2");

        expect(c1Info.Config.Labels).toEqual(
            expect.objectContaining({
                "test": "c1",
                "test.c1": "true"
            })
        );

        expect(c2Info.Config.Labels).toEqual(
            expect.objectContaining({
                "test": "c2",
                "test.c2": "true"
            })
        );

        const list1 = await docker.listContainers({
            all: true,
            filters: {
                label: ["test"]
            }
        });

        expect(list1.length).toBe(2);
        expect(list1).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    Labels: expect.objectContaining({
                        "test": "c1",
                        "test.c1": "true"
                    })
                }),
                expect.objectContaining({
                    Labels: expect.objectContaining({
                        "test": "c2",
                        "test.c2": "true"
                    })
                })
            ])
        );

        const list2 = await docker.listContainers({
            all: true,
            filters: {
                label: ["test=c1"]
            }
        });

        expect(list2.length).toBe(1);
        expect(list2[0].Labels).toEqual(
            expect.objectContaining({
                "test": "c1",
                "test.c1": "true"
            })
        );

        const list3 = await docker.listContainers({
            all: true,
            filters: {
                label: ["test", "test.c2=true"]
            }
        });

        expect(list3.length).toBe(1);
        expect(list3[0].Labels).toEqual(
            expect.objectContaining({
                "test": "c2",
                "test.c2": "true"
            })
        );
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
        expect(list[0].Names).toContain("/container-2");
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
