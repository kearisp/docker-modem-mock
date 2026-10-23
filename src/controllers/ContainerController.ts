import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    Body,
    Query,
    Res,
    ContainerPipe
} from "../http";
import {Response} from "../router";
import {HttpException} from "../exceptions/HttpException";
import {DockerService, DockerStorage} from "../makes/DockerStorage";
import {generateId} from "../utils/generateId";
import {Container, PortBindings} from "../types/Container";
import {buildPorts, hostIps, parsePortKey} from "../utils/ports";
import {ContainerStatus} from "../types/ContainerStatus";


@Controller("/containers")
export class ContainerController {
    public constructor(
        protected readonly storage: DockerStorage
    ) {}

    protected getStatus(container: Container): string {
        if(!container.State.Running || !container.State.StartedAt) {
            return container.State.Status;
        }

        const diff = Math.floor((new Date().getTime() - container.State.StartedAt.getTime()) / 1000);

        if(diff < 60) {
            return `Up ${diff} seconds`;
        }

        if(diff < 3600) {
            return `Up ${Math.floor(diff / 60)} minutes`;
        }

        if(diff < 86400) {
            return `Up ${Math.floor(diff / 3600)} hours`;
        }

        return `Up ${Math.floor(diff / 86400)} days`;
    }

    protected getPortsMap(container: Container) {
        if(!container.State.Running) {
            return {};
        }

        const map: {[port: string]: {HostIp: string; HostPort: string}[] | null} = {};

        for(const key of Object.keys(container.Config.ExposedPorts)) {
            const bindings = container.HostConfig.PortBindings[key];

            map[key] = bindings && bindings.length > 0
                ? bindings.flatMap(({HostIp, HostPort}) => hostIps(HostIp).map((ip) => ({HostIp: ip, HostPort})))
                : null;
        }

        return map;
    }

    /**
     * Allocates free host ports for empty `HostPort` bindings and verifies that none of the host ports
     * is already taken by a running container. Like Docker, the conflict is reported on start, not on create.
     */
    protected bindPorts(container: Container): void {
        const taken = this.storage.containers
            .filter((other) => other !== container && other.State.Running)
            .flatMap((other) => other.Ports.filter((p) => p.PublicPort !== undefined));

        const bindings = Object.entries(container.HostConfig.PortBindings).flatMap(([key, list]) => {
            return list.map((binding) => ({key, binding}));
        });

        const allocated: {key: string; binding: PortBindings[string][number]; hostPort: string}[] = [];

        for(const {key, binding} of bindings) {
            const {type} = parsePortKey(key);
            const ip = binding.HostIp || "0.0.0.0";
            let hostPort = binding.HostPort;

            if(!hostPort) {
                hostPort = `${this.storage.allocateHostPort(type, taken.concat(allocated.map(a => ({
                    IP: a.binding.HostIp || "0.0.0.0",
                    PrivatePort: 0,
                    PublicPort: parseInt(a.hostPort),
                    Type: parsePortKey(a.key).type
                }))))}`;
            }

            const conflict = taken.some((p) => {
                return p.PublicPort === parseInt(hostPort)
                    && p.Type === type
                    && (p.IP === ip || p.IP === "0.0.0.0" || ip === "0.0.0.0");
            }) || allocated.some((a) => {
                const aIp = a.binding.HostIp || "0.0.0.0";

                return a.hostPort === hostPort
                    && parsePortKey(a.key).type === type
                    && (aIp === ip || aIp === "0.0.0.0" || ip === "0.0.0.0");
            });

            if(conflict) {
                throw new HttpException(
                    500,
                    `driver failed programming external connectivity on endpoint ${container.Name} (${container.Id}): ` +
                    `Bind for ${ip}:${hostPort} failed: port is already allocated`
                );
            }

            allocated.push({key, binding, hostPort});
        }

        for(const {binding, hostPort} of allocated) {
            binding.HostPort = hostPort;
        }

        container.Ports = buildPorts(Object.keys(container.Config.ExposedPorts), container.HostConfig.PortBindings);
    }

    @Get("json")
    public list(@Query() query: DockerService.ListContainerOptions) {
        return this.storage.listContainer(query).map((container) => {
            return {
                Id: container.Id,
                Names: [`/${container.Name}`],
                Image: container.Image,
                ImageID: "",
                Created: container.Created,
                State: container.State.Status,
                Status: this.getStatus(container),
                Ports: container.State.Running ? container.Ports : [],
                Labels: container.Config.Labels || {},
                NetworkSettings: {
                    Networks: container.NetworkSettings.Networks
                }
            };
        });
    }

    @Post("create")
    public create(
        @Body() body: any,
        @Res() res: Response
    ) {
        const {
            Image: imageName,
            Labels = {},
            ExposedPorts = {},
            HostConfig: {
                NetworkMode,
                PortBindings = {}
            } = {},
            NetworkingConfig: {
                EndpointsConfig = {}
            } = {}
        } = body;

        const image = this.storage.getImage(imageName);

        if(!image) {
            throw new HttpException(404, `No such image: ${imageName}`);
        }

        // Resolve which network names the container references: the (implicit or explicit) NetworkMode
        // plus every key of NetworkingConfig.EndpointsConfig. "container:<id>" shares another container's
        // network namespace and isn't a network resource, so it's excluded from resolution/validation.
        const resolvedNetworkMode = NetworkMode && NetworkMode !== "default"
            ? NetworkMode
            : "bridge";

        const networkNames = new Set<string>(Object.keys(EndpointsConfig));

        if(!resolvedNetworkMode.startsWith("container:")) {
            networkNames.add(resolvedNetworkMode);
        }

        for(const name of networkNames) {
            if(!this.storage.getNetwork(name)) {
                throw new HttpException(404, `network ${name} not found`);
            }
        }

        const networks: Container["NetworkSettings"]["Networks"] = {};

        for(const name of networkNames) {
            const network = this.storage.getNetwork(name)!;
            const endpointConfig = EndpointsConfig[name] || {};

            networks[name] = {
                NetworkID: network.Id,
                EndpointID: generateId(),
                Gateway: "",
                IPAddress: "",
                IPPrefixLen: 0,
                IPv6Gateway: "",
                GlobalIPv6Address: "",
                GlobalIPv6PrefixLen: 0,
                MacAddress: "",
                Aliases: endpointConfig.Aliases || null,
                DriverOpts: endpointConfig.DriverOpts || null
            };
        }

        const portBindings: PortBindings = {};

        for(const [key, bindings] of Object.entries<any[] | null>(PortBindings)) {
            portBindings[key] = (bindings || []).map((binding) => ({
                HostIp: binding.HostIp || "",
                HostPort: binding.HostPort || ""
            }));
        }

        const exposedPorts: Container["Config"]["ExposedPorts"] = {
            ...image.Config.ExposedPorts || {},
            ...ExposedPorts
        };

        for(const key of Object.keys(portBindings)) {
            exposedPorts[key] = {};
        }

        const container: Container = {
            Id: generateId(),
            Name: `${body.name}`,
            Image: image.Id,
            State: {
                Running: false,
                Paused: false,
                Dead: false,
                Status: ContainerStatus.CREATED,
                Error: ""
            },
            HostConfig: {
                ConsoleSize: [0, 0],
                NetworkMode: resolvedNetworkMode,
                PortBindings: portBindings
            },
            NetworkSettings: {
                Networks: networks
            },
            Ports: buildPorts(Object.keys(exposedPorts), portBindings),
            Config: {
                Image: imageName,
                ExposedPorts: exposedPorts,
                Labels: {
                    ...image.Config.Labels || {},
                    ...Labels
                }
            },
            Created: new Date()
        };

        this.storage.addContainer(container);

        res.status(201);

        return {
            Id: container.Id
        };
    }

    @Get(":id/json")
    public inspect(@Param("id", ContainerPipe) container: Container) {
        const image = this.storage.getImageById(container.Image);

        if(!image) {
            throw new HttpException(500, `Image ${container.Image} not found`);
        }

        return {
            Id: container.Id,
            Name: `/${container.Name}`,
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
            Image: image.Id,
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
                NetworkMode: container.HostConfig.NetworkMode,
                PortBindings: container.HostConfig.PortBindings,
                RestartPolicy: {
                    Name: "no",
                    MaximumRetryCount: 0
                },
                AutoRemove:false,
                VolumeDriver: "",
                VolumesFrom: null,
                ConsoleSize: container.HostConfig.ConsoleSize,
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
                ExposedPorts: container.Config.ExposedPorts,
                Volumes: null,
                WorkingDir: "/home/bun/app",
                Entrypoint: [
                    "/usr/local/bin/docker-entrypoint.sh"
                ],
                OnBuild: null,
                Labels: container.Config.Labels || {}
            },
            NetworkSettings: {
                Bridge: "",
                SandboxID: "",
                SandboxKey: "",
                Ports: this.getPortsMap(container),
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
                Networks: Object.fromEntries(
                    Object.entries(container.NetworkSettings.Networks).map(([name, endpoint]) => [
                        name,
                        {
                            IPAMConfig: null,
                            Links: null,
                            Aliases: endpoint.Aliases,
                            MacAddress: endpoint.MacAddress,
                            DriverOpts: endpoint.DriverOpts,
                            GwPriority: 0,
                            NetworkID: endpoint.NetworkID,
                            EndpointID: endpoint.EndpointID,
                            Gateway: endpoint.Gateway,
                            IPAddress: endpoint.IPAddress,
                            IPPrefixLen: endpoint.IPPrefixLen,
                            IPv6Gateway: endpoint.IPv6Gateway,
                            GlobalIPv6Address: endpoint.GlobalIPv6Address,
                            GlobalIPv6PrefixLen: endpoint.GlobalIPv6PrefixLen,
                            DNSNames: null
                        }
                    ])
                )
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
        };
    }

    @Post(":id/start")
    public start(@Param("id", ContainerPipe) container: Container, @Res() res: Response) {
        if(container.State.Running) {
            throw new HttpException(304, "container already started");
        }

        if(container.State.Paused) {
            throw new HttpException(304, "cannot start a paused container, try unpause instead");
        }

        this.bindPorts(container);

        container.State.Running = true;
        container.State.Status = ContainerStatus.RUNNING;
        container.State.StartedAt = new Date();

        res.status(204);
    }

    @Post(":id/stop")
    public stop(@Param("id", ContainerPipe) container: Container) {
        container.State.Running = false;
        container.State.Paused = false;
        container.State.Status = ContainerStatus.EXITED;
        container.State.FinishedAt = new Date();
    }

    @Post(":id/resize")
    public resize(@Param("id", ContainerPipe) container: Container, @Query() query: {h: string; w: string}) {
        const h = parseInt(query.h);
        const w = parseInt(query.w);

        container.HostConfig.ConsoleSize = [h, w];
    }

    @Post(":id/kill")
    public kill(@Param("id", ContainerPipe) container: Container, @Res() res: Response) {
        if(!container.State.Running) {
            throw new HttpException(409, "Container is not running");
        }

        container.State.Running = false;
        container.State.Status = ContainerStatus.EXITED;

        res.status(204);
    }

    @Post(":id/restart")
    public restart(@Param("id", ContainerPipe) _container: Container, @Res() res: Response) {
        res.status(204);
    }

    @Post(":id/rename")
    public rename(@Param("id", ContainerPipe) container: Container, @Query() query: {name: string}, @Res() res: Response) {
        container.Name = query.name;

        res.status(204);
    }

    @Post(":id/pause")
    public pause(@Param("id", ContainerPipe) container: Container, @Res() res: Response) {
        container.State.Status = ContainerStatus.PAUSED;
        container.State.Paused = true;

        res.status(204);
    }

    @Post(":id/unpause")
    public unpause(@Param("id", ContainerPipe) container: Container, @Res() res: Response) {
        if(!container.State.Paused) {
            throw new HttpException(304, `Container ${container.Id} is not paused`);
        }

        container.State.Status = ContainerStatus.RUNNING;
        container.State.Paused = false;

        res.status(204);
    }

    @Delete(":id")
    public remove(@Param("id") id: string) {
        this.storage.containers = this.storage.containers.filter((container) => {
            return container.Id !== id;
        });
    }
}
