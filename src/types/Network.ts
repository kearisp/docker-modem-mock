export type Network = {
    Id: string;
    Name: string;
    Driver: string;
    Scope: string;
    Created: Date;
    Internal: boolean;
    Attachable: boolean;
    Ingress: boolean;
    EnableIPv6: boolean;
    IPAM: {
        Driver: string;
        Config: {
            Subnet?: string;
            Gateway?: string;
            IPRange?: string;
        }[];
        Options: {
            [key: string]: string;
        } | null;
    };
    Options: {
        [key: string]: string;
    };
    Labels: {
        [key: string]: string;
    };
};
