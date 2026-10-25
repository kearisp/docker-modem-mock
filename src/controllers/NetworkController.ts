import {Controller, Get, Post, Param, Body, Res, NetworkPipe} from "../http";
import {Response} from "../router";
import {DockerStorage} from "../makes/DockerStorage";
import {generateId} from "../utils/generateId";
import {Network} from "../types/Network";


type CreateNetworkBody = Pick<Network, "Name"> & Partial<Omit<Network, "Id" | "Name" | "Scope" | "Created">>;

@Controller("/networks")
export class NetworkController {
    public constructor(
        protected readonly storage: DockerStorage
    ) {}

    protected toInspect(network: Network) {
        const containers: Record<string, any> = {};

        for(const container of this.storage.containers) {
            for(const endpoint of Object.values(container.NetworkSettings.Networks)) {
                if(endpoint.NetworkID !== network.Id) {
                    continue;
                }

                containers[container.Id] = {
                    Name: container.Name,
                    EndpointID: endpoint.EndpointID,
                    MacAddress: endpoint.MacAddress,
                    IPv4Address: endpoint.IPAddress,
                    IPv6Address: endpoint.GlobalIPv6Address
                };
            }
        }

        return {
            Id: network.Id,
            Name: network.Name,
            Created: network.Created.toISOString(),
            Scope: network.Scope,
            Driver: network.Driver,
            EnableIPv6: network.EnableIPv6,
            IPAM: network.IPAM,
            Internal: network.Internal,
            Attachable: network.Attachable,
            Ingress: network.Ingress,
            ConfigFrom: {
                Network: ""
            },
            ConfigOnly: false,
            Containers: containers,
            Options: network.Options,
            Labels: network.Labels
        };
    }

    @Get()
    public list() {
        return this.storage.listNetworks().map((network) => this.toInspect(network));
    }

    @Post("create")
    public create(@Body() body: CreateNetworkBody, @Res() res: Response) {
        const {
            Name,
            Driver = "bridge",
            Internal = false,
            Attachable = false,
            Ingress = false,
            EnableIPv6 = false,
            IPAM = {
                Driver: "default",
                Config: [],
                Options: null
            },
            Options = {},
            Labels = {}
        } = body;

        const network: Network = {
            Id: generateId(),
            Name,
            Driver,
            Scope: "local",
            Created: new Date(),
            Internal,
            Attachable,
            Ingress,
            EnableIPv6,
            IPAM,
            Options,
            Labels
        };

        this.storage.addNetwork(network);

        res.status(201);

        return {
            Id: network.Id,
            Warning: ""
        };
    }

    @Get(":id")
    public inspect(@Param("id", NetworkPipe) network: Network) {
        return this.toInspect(network);
    }
}
