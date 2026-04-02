import {ContainerStatus} from "./ContainerStatus";


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
    };
    Config: {
        Image: string;
        Labels: {
            [key: string]: string;
        };
    };
    Created: Date;
};
