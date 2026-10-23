import {Port} from "../types/Port";
import {PortBindings} from "../types/Container";


export const parsePortKey = (key: string): {port: number; type: string} => {
    const [port, type = "tcp"] = key.split("/");

    return {
        port: parseInt(port),
        type
    };
};

export const hostIps = (hostIp?: string): string[] => {
    return hostIp ? [hostIp] : ["0.0.0.0", "::"];
};

/**
 * Builds the list that Docker returns in `Ports`: every bound port with its public part,
 * and every exposed-but-unbound port with only `PrivatePort` and `Type`.
 */
export const buildPorts = (exposedKeys: string[], bindings: PortBindings): Port[] => {
    const ports: Port[] = [];

    for(const key of Object.keys(bindings)) {
        const {port, type} = parsePortKey(key);

        for(const binding of bindings[key] || []) {
            if(!binding.HostPort) {
                continue;
            }

            // Docker publishes on both address families when no HostIp is given.
            for(const ip of hostIps(binding.HostIp)) {
                ports.push({
                    IP: ip,
                    PrivatePort: port,
                    PublicPort: parseInt(binding.HostPort),
                    Type: type
                });
            }
        }
    }

    for(const key of exposedKeys) {
        const {port, type} = parsePortKey(key);

        const bound = ports.some((p) => p.PrivatePort === port && p.Type === type);

        if(!bound) {
            ports.push({
                IP: "",
                PrivatePort: port,
                Type: type
            });
        }
    }

    return ports;
};
