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

    public getImage(tag: string) {
        return this.images.find((image) => {
            return image.RepoTags.includes(tag);
        });
    }

    public addImage(image: Image) {
        this.images.push(image);
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
