export type EndpointSettings = {
    NetworkID: string;
    EndpointID: string;
    Gateway: string;
    IPAddress: string;
    IPPrefixLen: number;
    IPv6Gateway: string;
    GlobalIPv6Address: string;
    GlobalIPv6PrefixLen: number;
    MacAddress: string;
    Aliases: string[] | null;
    DriverOpts: {
        [key: string]: string;
    } | null;
};
