import {ContainerStatus} from "./ContainerStatus";
import {EndpointSettings} from "./EndpointSettings";
import {Port} from "./Port";


export type PortBindings = {
    [port: string]: {
        HostIp: string;
        HostPort: string;
    }[];
};

export type Container = {
    Id: string;
    Name: string;
    Image: string;
    State: {
        Status: ContainerStatus;
        Running: boolean;
        Paused: boolean;
        Dead: boolean;
        StartedAt?: Date;
        FinishedAt?: Date;
        Error: string;
    };
    Ports: Port[];
    HostConfig: {
        ConsoleSize: [number, number];
        NetworkMode: string;
        PortBindings: PortBindings;
    };
    Config: {
        Image: string;
        ExposedPorts: {
            [port: string]: {};
        };
        Labels: {
            [key: string]: string;
        };
    };
    NetworkSettings: {
        Networks: {
            [name: string]: EndpointSettings;
        };
    };
    Created: Date;
};
