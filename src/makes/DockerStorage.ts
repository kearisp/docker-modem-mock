import {IncomingMessage} from "http";
import {Fixtures} from "./Fixtures";
import {Container} from "../types/Container";
import {Image} from "../types/Image";


export class DockerStorage {
    public containers: Container[] = [];
    public images: Image[] = [];
    public fixtures: Fixtures[] = [];

    public getContainer(id: string) {
        return this.containers.find((container) => {
            return container.Id === id;
        });
    }

    public addContainer(container: Container) {
        this.containers.push(container);
    }

    public getImageById(id: string) {
        return this.images.find(image => image.Id === id);
    }

    public getImage(tag: string) {
        return this.images.find((image) => {
            return image.RepoTags.includes(tag);
        });
    }

    public addImage(image: Image) {
        this.images.push(image);
    }

    public getImages(options: DockerService.ImagesOptions = {}) {
        const {
            filters: {
                before,
                since,
                label,
                reference,
                dangling,
                until
            } = {}
        } = options;

        return this.images.filter((image) => {
            if(reference && reference.length > 0) {
                const matches = reference.some((ref) => {
                    return image.RepoTags.some((tag) => {
                        if(ref.includes("*") || ref.includes("?")) {
                            const regex = new RegExp("^" + ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*").replace(/\\\?/g, ".") + "$");
                            return regex.test(tag);
                        }

                        return tag === ref || tag.startsWith(ref + ":");
                    });
                });

                if(!matches)
                    return false;
            }

            if(before && before.length > 0) {
                const referenceImage = this.getImageByIdOrTag(before[0]);

                if(referenceImage && image.Created >= referenceImage.Created) {
                    return false;
                }
            }

            if(since && since.length > 0) {
                const referenceImage = this.getImageByIdOrTag(since[0]);

                if(referenceImage && image.Created <= referenceImage.Created) {
                    return false;
                }
            }

            if(until && until.length > 0) {
                const untilDate = new Date(until[0]).getTime();

                if(!isNaN(untilDate) && image.Created > untilDate) {
                    return false;
                }
            }

            if(label && label.length > 0) {
                const matchesLabels = label.every((lbl) => {
                    const [key, value] = lbl.split("=");

                    if(value !== undefined) {
                        return image.Labels[key] === value;
                    }

                    return image.Labels.hasOwnProperty(key);
                });

                if(!matchesLabels)
                    return false;
            }

            if(dangling && dangling.length > 0) {
                const isDangling = image.RepoTags.length === 0 || image.RepoTags.includes("<none>:<none>");
                const filterValue = dangling[0] === "true";

                if(isDangling !== filterValue)
                    return false;
            }

            return true;
        });
    }

    public getImageByIdOrTag(idOrTag: string) {
        return this.images.find(image =>
            image.Id === idOrTag ||
            image.Id.startsWith(idOrTag) ||
            image.RepoTags.includes(idOrTag)
        );
    }

    protected chunkedResponse(chunks: string[]): IncomingMessage {
        const socket = {
            end: () => {}
        } as any;

        const response = new IncomingMessage(socket);

        response.statusCode = 200;
        response.statusMessage = "OK";
        response.headers = {
            "content-type": "application/json"
        };

        // let index = 0;

        // const tick = () => {
        //     if(chunks[index]) {
        //         response.push(Buffer.from(chunks[index]));
        //         index++;
        //         response.emit("readable");
        //
        //         process.nextTick(tick);
        //     }
        //     else {
        //         response.push(null);
        //     }
        // };
        //
        // process.nextTick(tick);

        for(const chunk of chunks) {
            response.push(Buffer.from(chunk));
        }

        response.push(null);

        response.emit("readable");

        return response;
    }

    public registerFixtures(fixtures: Fixtures): void {
        this.fixtures.push(fixtures);
    }

    public reset(): void {
        this.containers = [];
        this.images = [];
        this.fixtures = [];
    }
}

export namespace DockerService {
    export type ImagesOptions = {
        all?: boolean;
        digests?: boolean;
        manifests?: boolean;
        "shared-size"?: boolean;
        filters?: {
            reference?: string[];
            since?: string[];
            before?: string[];
            label?: string[];
            dangling?: string[];
            until?: string[];
        };
    };
}
