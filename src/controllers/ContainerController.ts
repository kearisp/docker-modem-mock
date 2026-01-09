import {Router, Request, Response} from "../router";
import {DockerStorage} from "../makes/DockerStorage";
import {generateId} from "../utils/generateId";
import {Container} from "../types/Container";
import {ContainerStatus} from "../types/ContainerStatus";


export class ContainerController {
    public constructor(
        protected readonly router: Router,
        protected readonly dockerStorage: DockerStorage
    ) {
        this.router.get(["/containers/json", "/:version/containers/json"], this.list.bind(this));
        this.router.post(["/containers/create", "/:version/containers/create"], this.create.bind(this));
        this.router.get(["/containers/:id/json", "/:version/containers/:id/json"], this.inspect.bind(this));
        this.router.post(["/containers/:id/start", "/:version/containers/:id/start"], this.start.bind(this));
        this.router.post(["/containers/:id/stop", "/:version/containers/:id/stop"], this.stop.bind(this));
        this.router.post(["/containers/:id/resize", "/:version/containers/:id/resize"], this.resize.bind(this));
        this.router.post(["/containers/:id/kill", "/:version/containers/:id/kill"], this.kill.bind(this));
        this.router.post(["/containers/:id/restart", "/:version/containers/:id/restart"], this.restart.bind(this));
        this.router.post(["/containers/:id/rename", "/:version/containers/:id/rename"], this.rename.bind(this));
        this.router.post(["/containers/:id/pause", "/:version/containers/:id/pause"], this.pause.bind(this));
        this.router.post(["/containers/:id/unpause", "/:version/containers/:id/unpause"], this.unpause.bind(this));
        this.router.delete(["/containers/:id", "/:version/containers/:id"], this.delete.bind(this));
    }

    public async list(req: Request, res: Response) {
        const {
            all,
            filters: {
                name
            } = {}
        } = req.body;

        res.status(200).send(
            this.dockerStorage.containers.filter((container) => {
                if(all) {
                    return true;
                }

                if(name && container.Name === `/${name}`) {

                }

                return container.State.Running;
            }).map((container) => {
                return {
                    Id: container.Id,
                    Names: [container.Name],
                    Image: container.Image,
                    ImageID: "",
                    Created: container.Created,
                    State: container.State.Status,
                    Status: "Up 1 seconds",
                    Ports: []
                };
            })
        );
    }

    public async create(req: Request, res: Response) {
        const container: Container = {
            Id: generateId(),
            Name: `${req.body.name}`,
            Image: req.body.Image,
            State: {
                Running: false,
                Paused: false,
                Dead: false,
                Status: ContainerStatus.CREATED,
                Error: ""
            },
            Created: new Date()
        };

        this.dockerStorage.addContainer(container);

        res.status(201).send({
            Id: container.Id
        });
    }

    public async start(req: Request, res: Response) {
        const container = this.dockerStorage.getContainer(req.params.id);

        if(!container) {
            res.status(404).send({
                message: `No such container: ${req.params.id}`
            });

            return;
        }

        if(container.State.Running) {
            res.status(304).send({
                message: "container already started"
            });

            return;
        }

        if(container.State.Paused) {
            res.status(304).send({
                message: "cannot start a paused container, try unpause instead"
            });

            return;
        }

        container.State.Running = true;
        container.State.Status = ContainerStatus.RUNNING;
        container.State.StartedAt = new Date();

        res.status(204).send({});
    }

    public async stop(req: Request, res: Response) {
        const container = this.dockerStorage.getContainer(req.params.id);

        if(!container) {
            res.status(404).send({
                message: `No such container: ${req.params.id}`
            });

            return;
        }

        container.State.Running = false;
        container.State.Paused = false;
        container.State.Status = ContainerStatus.EXITED;
        container.State.FinishedAt = new Date();

        res.status(200).send({});
    }

    public async restart(req: Request, res: Response) {
        const container = this.dockerStorage.getContainer(req.params.id);

        if(!container) {
            res.status(404).send({
                message: `No such container: ${req.params.id}`
            });

            return;
        }

        res.status(204).send({});
    }

    public async rename(req: Request, res: Response) {
        const container = this.dockerStorage.getContainer(req.params.id);

        if(!container) {
            res.status(404).send({
                message: `No such container: ${req.params.id}`
            });

            return;
        }

        container.Name = req.body.name;

        res.status(204).send({});
    }

    public async resize(req: Request, res: Response) {
        const container = this.dockerStorage.getContainer(req.params.id);

        if(!container) {
            res.status(404).send({
                message: `No such container: ${req.params.id}`
            });

            return;
        }

        res.status(200).send({});
    }

    public async kill(req: Request, res: Response) {
        const container = this.dockerStorage.getContainer(req.params.id);

        if(!container) {
            res.status(404).send({
                message: `No such container: ${req.params.id}`
            });

            return;
        }

        if(!container.State.Running) {
            res.status(409).send({
                message: `Container is not running`
            });

            return;
        }

        container.State.Running = false;
        container.State.Status = ContainerStatus.EXITED;

        res.status(204).send({});
    }

    public async pause(req: Request, res: Response) {
        const container = this.dockerStorage.getContainer(req.params.id);

        if(!container) {
            res.status(404).send({
                message: `No such container: ${req.params.id}`
            });

            return;
        }

        container.State.Status = ContainerStatus.PAUSED;
        container.State.Paused = true;

        res.status(204).send({});
    }

    public async unpause(req: Request, res: Response) {
        const container = this.dockerStorage.getContainer(req.params.id);

        if(!container) {
            res.status(404).send({
                message: `No such container: ${req.params.id}`
            });

            return;
        }

        if(!container.State.Paused) {
            res.status(304).send({
                message: `Container ${container.Id} is not paused`
            });

            return;
        }

        container.State.Status = ContainerStatus.RUNNING;
        container.State.Paused = false;

        res.status(204).send({});
    }

    public async inspect(req: Request, res: Response) {
        const container = this.dockerStorage.getContainer(req.params.id);

        if(!container) {
            res.status(404).send({
                message: `No such container: ${req.params.id}`
            });

            return;
        }

        res.status(200).send({
            Id: container.Id,
            Name: container.Name,
            Created: container.Created.toISOString(),
            Path: "/usr/local/bin/docker-entrypoint.sh",
            Args: ["/usr/local/bin/bun"],
            State: {
                Status: container.State.Status,
                Running: container.State.Running,
                Paused: container.State.Paused,
                Restarting: false,
                OOMKilled: false,
                Dead: false,
                Pid: 0,
                ExitCode: 0,
                Error: "",
                StartedAt: container.State.StartedAt ? container.State.StartedAt.toISOString() : "0001-01-01T00:00:00Z",
                FinishedAt: container.State.FinishedAt ? container.State.FinishedAt.toISOString() : "0001-01-01T00:00:00Z"
            },
            Image: "sha256:3476c857e7c05a7950b3a8a684ffbc82f5cbeffe1b523ea1a92bdefc4539dc57",
            ResolvConfPath: "",
            HostnamePath: "",
            HostsPath: "",
            LogPath: "",
            RestartCount: 0,
            Driver: "overlayfs",
            Platform: "linux",
            MountLabel: "",
            ProcessLabel: "",
            AppArmorProfile: "",
            ExecIDs: null,
            HostConfig: {
                Binds: null,
                ContainerIDFile: "",
                LogConfig: {
                    Type: "json-file",
                    Config: {}
                },
                NetworkMode: "bridge",
                PortBindings: {},
                RestartPolicy: {
                    Name: "no",
                    MaximumRetryCount: 0
                },
                AutoRemove:false,
                VolumeDriver: "",
                VolumesFrom: null,
                ConsoleSize: [0,0],
                CapAdd: null,
                CapDrop: null,
                CgroupnsMode: "host",
                Dns:null,
                DnsOptions: null,
                DnsSearch: null,
                ExtraHosts: null,
                GroupAdd: null,
                IpcMode: "private",
                Cgroup: "",
                Links: null,
                OomScoreAdj: 0,
                PidMode: "",
                Privileged: false,
                PublishAllPorts: false,
                ReadonlyRootfs: false,
                SecurityOpt: null,
                UTSMode: "",
                UsernsMode: "",
                ShmSize: 67108864,
                Runtime: "runc",
                Isolation: "",
                CpuShares: 0,
                Memory: 0,
                NanoCpus: 0,
                CgroupParent: "",
                BlkioWeight: 0,
                BlkioWeightDevice: null,
                BlkioDeviceReadBps: null,
                BlkioDeviceWriteBps: null,
                BlkioDeviceReadIOps: null,
                BlkioDeviceWriteIOps: null,
                CpuPeriod: 0,
                CpuQuota: 0,
                CpuRealtimePeriod: 0,
                CpuRealtimeRuntime: 0,
                CpusetCpus: "",
                CpusetMems: "",
                Devices: null,
                DeviceCgroupRules: null,
                DeviceRequests: null,
                MemoryReservation:0,
                MemorySwap: 0,
                MemorySwappiness: null,
                OomKillDisable: false,
                PidsLimit: null,
                Ulimits: null,
                CpuCount: 0,
                CpuPercent: 0,
                IOMaximumIOps: 0,
                IOMaximumBandwidth: 0,
                MaskedPaths: [
                    "/proc/asound", "/proc/acpi", "/proc/kcore", "/proc/keys", "/proc/latency_stats",
                    "/proc/timer_list", "/proc/timer_stats", "/proc/sched_debug", "/proc/scsi",
                    "/sys/firmware", "/sys/devices/virtual/powercap"
                ],
                ReadonlyPaths: [
                    "/proc/bus", "/proc/fs", "/proc/irq", "/proc/sys", "/proc/sysrq-trigger"
                ]
            },
            GraphDriver: {
                Data: null,
                Name: "overlayfs"
            },
            Mounts: [],
            Config: {
                Hostname: "36a07d831a95",
                Domainname: "",
                User: "",
                AttachStdin: false,
                AttachStdout: false,
                AttachStderr: false,
                Tty: false,
                OpenStdin: false,
                StdinOnce: false,
                Env: [
                    "PATH=/usr/local/sbin:/usr/local/b in:/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/bun-node-fallback-bin",
                    "BUN_RUNTIME_TRANSPILER_CACHE_PATH=0",
                    "BUN_INSTALL_BIN=/usr/local/bin"
                ],
                Cmd: [
                    "/usr/local/bin/bun"
                ],
                Image: "oven/bun:alpine",
                Volumes: null,
                WorkingDir: "/home/bun/app",
                Entrypoint: [
                    "/usr/local/bin/docker-entrypoint.sh"
                ],
                OnBuild: null,
                Labels: {
                    "desktop.docker.io/wsl-distro":"Ubuntu",
                    "org.opencontainers.image.created": "2025-05-10T14:05:09.084Z",
                    "org.opencontainers.image.description":"Incredibly fast JavaScript runtime, bundler, test runner, and package manager – all in one",
                    "org.opencontainers.image.licenses":"NOASSERTION",
                    "org.opencontainers.image.revision":"64ed68c9e0faa7f5224876be8681d2bdc311454b",
                    "org.opencontainers.image.source": "https://github.com/oven-sh/bun",
                    "org.opencontainers.image.title":"bun",
                    "org.opencontainers.image.url": "https://github.com/oven-sh/bun",
                    "org.opencontainers.image.version":"1.2.13-alpine"
                }
            },
            NetworkSettings: {
                Bridge: "",
                SandboxID: "",
                SandboxKey: "",
                Ports: {},
                HairpinMode: false,
                LinkLocalIPv6Address: "",
                LinkLocalIPv6PrefixLen: 0,
                SecondaryIPAddresses: null,
                SecondaryIPv6Addresses: null,
                EndpointID: "",
                Gateway: "",
                GlobalIPv6Address: "",
                GlobalIPv6PrefixLen: 0,
                IPAddress: "",
                IPPrefixLen: 0,
                IPv6Gateway: "",
                MacAddress: "",
                Networks: {
                    bridge: {
                        IPAMConfig: null,
                        Links: null,
                        Aliases: null,
                        MacAddress: "",
                        DriverOpts: null,
                        GwPriority: 0,
                        NetworkID: "",
                        EndpointID: "",
                        Gateway: "",
                        IPAddress: "",
                        IPPrefixLen: 0,
                        IPv6Gateway: "",
                        GlobalIPv6Address: "",
                        GlobalIPv6PrefixLen: 0,
                        DNSNames: null
                    }
                }
            },
            ImageManifestDescriptor: {
                mediaType: "application/vnd.oci.image.manifest.v1+json",
                digest: "sha256:2cdc992a4322a4f82e07435700d22687a5f2101cbbbe2e4f9956eb490b07675b",
                size: 1430,
                platform: {
                    architecture: "amd64",
                    os: "linux"
                }
            }
        });
    }

    public async delete(req: Request, res: Response) {
        this.dockerStorage.containers = this.dockerStorage.containers.filter((container) => {
            return container.Id === req.params.id;
        });

        res.status(200).send({});
    }
}
