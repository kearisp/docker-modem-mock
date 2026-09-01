import {Router, Request, Response} from "../router";
import {DockerStorage} from "../makes/DockerStorage";
import {generateId} from "../utils/generateId";
import {Network} from "../types/Network";


export class NetworkController {
    public constructor(
        protected readonly router: Router,
        protected readonly dockerStorage: DockerStorage
    ) {
        this.router.get(["/networks", "/:version/networks"], this.list.bind(this));
        this.router.post(["/networks/create", "/:version/networks/create"], this.create.bind(this));
        this.router.get(["/networks/:id", "/:version/networks/:id"], this.inspect.bind(this));
    }

    protected toInspect(network: Network) {
        const containers: Record<string, any> = {};

        for(const container of this.dockerStorage.containers) {
            for(const [name, endpoint] of Object.entries(container.NetworkSettings.Networks)) {
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

    public async list(req: Request, res: Response) {
        res.status(200).send(
            this.dockerStorage.listNetworks().map((network) => this.toInspect(network))
        );
    }

    public async create(req: Request, res: Response) {
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
        } = req.body;

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

        this.dockerStorage.addNetwork(network);

        res.status(201).send({
            Id: network.Id,
            Warning: ""
        });
    }

    public async inspect(req: Request, res: Response) {
        const network = this.dockerStorage.getNetwork(req.params.id);

        if(!network) {
            res.status(404).send({
                message: `network ${req.params.id} not found`
            });

            return;
        }

        res.status(200).send(this.toInspect(network));
    }
}
