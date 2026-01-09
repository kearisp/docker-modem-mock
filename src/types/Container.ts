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
    Created: Date;
};
