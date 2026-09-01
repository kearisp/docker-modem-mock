import {ContainerStatus} from "./ContainerStatus";
import {EndpointSettings} from "./EndpointSettings";


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
    HostConfig: {
        ConsoleSize: [number, number];
        NetworkMode: string;
    };
    Config: {
        Image: string;
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
