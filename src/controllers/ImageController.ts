import {Router, Request, Response} from "../router";
import {DockerStorage} from "../makes/DockerStorage";
import {Logger} from "@kearisp/cli";

export class ImageController {
    public constructor(
        protected readonly router: Router,
        protected readonly dockerStorage: DockerStorage
    ) {
        this.router.get(["/images/json", "/:version/images/json"], this.list.bind(this));
        this.router.post(["/images/create", "/:version/images/create"], this.pull.bind(this));
        this.router.post(["/build", "/:version/build"], this.build.bind(this));
        this.router.get(["/images/:tag/json", "/:version/images/:tag/json"], this.inspect.bind(this));
        this.router.delete(["/images/:tag", "/:version/images/:tag"], this.delete.bind(this));
    }

    public async list(req: Request, res: Response) {
        if(Object.keys(req.body).length > 0) {
            // TODO
            Logger.warn("imageList(", req.body, ")");

            res.status(200).send([]);
            return;
        }

        const images = [];

        for(const image of this.dockerStorage.images) {
            images.push({
                Containers: -1,
                Created: 1747579856,
                Id: image.Id,
                Labels: image.Labels,
                ParentId: image.ParentId,
                Descriptor: {
                    mediaType: "application/vnd.oci.image.manifest.v1+json",
                    digest: "sha256:72e58c97811826c57ab14f700f6a7cbb5147e4c8a60e84c53e5c07981bd62498",
                    size: 6461
                },
                RepoDigests: [
                    "project-lidermarket@sha256:72e58c97811826c57ab14f700f6a7cbb5147e4c8a60e84c53e5c07981bd62498"
                ],
                RepoTags: image.RepoTags,
                SharedSize: -1,
                Size: 746947017
            });
        }

        res.status(200).send(images);
    }

    public async inspect(req: Request, res: Response) {
        const image = this.dockerStorage.getImage(req.params.tag);

        if(!image) {
            res.status(404).send({
                message: `Image ${req.params.tag} not found`
            });

            return;
        }

        res.status(200).send({
            Id: image.Id,
            RepoTags: image.RepoTags,
            RepoDigests: [
                "oven/bun@sha256:3476c857e7c05a7950b3a8a684ffbc82f5cbeffe1b523ea1a92bdefc4539dc57"
            ],
            Parent: "",
            Comment: "buildkit.dockerfile.v0",
            Created: "2025-05-10T14:05:18.376365783Z",
            DockerVersion: "",
            Author: "",
            Config: {
                Hostname: "",
                Domainname: "",
                User: "",
                AttachStdin: false,
                AttachStdout: false,
                AttachStderr: false,
                Tty: false,
                OpenStdin: false,
                StdinOnce: false,
                Env: [
                    "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/bun-node-fallback-bin",
                    "BUN_RUNTIME_TRANSPILER_CACHE_PATH=0",
                    "BUN_INSTALL_BIN=/usr/local/bin"
                ],
                Cmd: [
                    "/usr/local/bin/bun"
                ],
                ArgsEscaped: true,
                Image: "",
                Volumes: null,
                WorkingDir: "/home/bun/app",
                Entrypoint: [
                    "/usr/local/bin/docker-entrypoint.sh"
                ],
                OnBuild: null,
                Labels: {
                    "org.opencontainers.image.created": "2025-05-10T14:05:09.084Z",
                    "org.opencontainers.image.description": "Incredibly fast JavaScript runtime, bundler, test runner, and package manager – all inone",
                    "org.opencontainers.image.licenses": "NOASSERTION",
                    "org.opencontainers.image.revision": "64ed68c9e0faa7f5224876be8681d2bdc311454b",
                    "org.opencontainers.image.source": "https://github.com/oven-sh/bun",
                    "org.opencontainers.image.title": "bun",
                    "org.opencontainers.image.url": "https://github.com/oven-sh/bun",
                    "org.opencontainers.image.version": "1.2.13-alpine"
                }
            },
            Architecture: "amd64",
            Os: "linux",
            Size: 43424417,
            GraphDriver: {
                Data: null,
                Name: "overlayfs"
            },
            RootFS: {
                Type: "layers",
                Layers: [
                    "sha256:994456c4fd7b2b87346a81961efb4ce945a39592d32e0762b38768bca7c7d085",
                    "sha256:ef70d6692b1e80a64fc0b2e711743f8c48f3e6ee466627c41e8b20860e7f2585",
                    "sha256:d58e9e6425c6cae4632955cdfd38a4999dd9388c6634d715313daaac9597f75a",
                    "sha256:ad245466e7de8bcb67fcaeebd8b389a7d16d2b0c6f8f324991bf9cc4df245f2f",
                    "sha256:e372adeb3e6e54f548965d7606f46b59ebbbfff41adcbc82887fcc57f6f309af",
                    "sha256:93b857d12c79ea9799ac3c88b898ab836916901d160964b6e0088809af60cfe1"
                ]
            },
            Metadata: {
                LastTagTime: "2025-05-10T20:18:24.410728378Z"
            },
            Descriptor: {
                mediaType: "application/vnd.oci.image.index.v1+json",
                digest: "sha256:3476c857e7c05a7950b3a8a684ffbc82f5cbeffe1b523ea1a92bdefc4539dc57",
                size: 1609
            }
        });
    }

    public async pull(req: Request, res: Response) {
        const {
            params: {
                version = "v1"
            },
            body: {
                fromImage,
                tag
            }
        } = req;

        // const stream = this.imagePull(version, fromImage, tag);

        const fixture = (() => {
            for(const fixture of this.dockerStorage.fixtures) {
                if(fixture.hasPull(version, fromImage, tag)) {
                    return fixture;
                }
            }

            return null;
        })();

        if(!fixture) {
            res.status(404).send({
                message: `Not image "${fromImage}:${tag}" found`
            });

            return;
        }

        const stream = fixture.pull(version, fromImage, tag);

        stream.on("end", () => {
            const image = fixture.imageInspect(version, fromImage, tag);

            if(!image) {
                return null;
            }

            this.dockerStorage.addImage(image);
        });

        res.status(200).send(stream);
    }

    public async build(req: Request, res: Response) {
        const {
            params: {
                version = "v1"
            },
            body
        } = req;

        const {
            t: tag,
            version: builderVersion = "1"
        } = body;

        const [imageName, imageTag = "latest"] = tag.split(":");

        const fixture = this.dockerStorage.fixtures.find((fixture) => {
            return fixture.hasBuild(version, builderVersion, imageName, imageTag);
        });

        if(!fixture) {
            res.status(500).send({
                message: `Fixture not found`
            });

            return;
        }

        const stream = fixture.build(version, builderVersion, imageName, imageTag);

        stream.on("end", (): void => {
            let image = this.dockerStorage.images.find((image) => {
                return image.RepoTags.includes(`${imageName}:${imageTag}`);
            });

            if(!image) {
                image = fixture.imageInspect(version, imageName, imageTag);
            }

            if(image) {
                this.dockerStorage.addImage(image);
            }
        });

        stream.on("error", (err) => {
            // Logger.error(err.message);
        });

        res.status(200).send(stream);
    }

    public async delete(req: Request, res: Response) {
        const {
            params: {
                tag: imageTag
            }
        } = req;

        this.dockerStorage.images = this.dockerStorage.images
            .filter((image) => {
                return !(image.RepoTags.length === 1 && image.RepoTags.includes(imageTag));
            })
            .map((image) => {
                if(image.RepoTags.includes(imageTag)) {
                    image.RepoTags = image.RepoTags.filter((tag: string) => {
                        return tag !== imageTag;
                    });
                }

                return image;
            });

        res.status(200).send({});
    }
}
