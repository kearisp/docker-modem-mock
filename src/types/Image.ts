export type Image = {
    Id: string;
    RepoTags: string[];
    ParentId?: string;
    Labels: {
        [name: string]: string;
    };
    Created: number;
    Config: {
        ExposedPorts?: {
            [port: string]: {};
        };
        Labels: {
            [key: string]: string;
        };
    };
};
