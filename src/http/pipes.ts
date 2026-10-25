import {DockerStorage} from "../makes/DockerStorage";
import {HttpException} from "../exceptions/HttpException";
import {Container} from "../types/Container";
import {Image} from "../types/Image";
import {Network} from "../types/Network";
import {Pipe} from "./metadata";


export class ContainerPipe implements Pipe<string, Container> {
    public constructor(
        protected readonly storage: DockerStorage
    ) {}

    public transform(id: string): Container {
        const container = this.storage.getContainer(id);

        if(!container) {
            throw new HttpException(404, `No such container: ${id}`);
        }

        return container;
    }
}

export class NetworkPipe implements Pipe<string, Network> {
    public constructor(
        protected readonly storage: DockerStorage
    ) {}

    public transform(id: string): Network {
        const network = this.storage.getNetwork(id);

        if(!network) {
            throw new HttpException(404, `network ${id} not found`);
        }

        return network;
    }
}

export class ImagePipe implements Pipe<string, Image> {
    public constructor(
        protected readonly storage: DockerStorage
    ) {}

    public transform(tag: string): Image {
        const image = this.storage.getImage(tag);

        if(!image) {
            throw new HttpException(404, `Image ${tag} not found`);
        }

        return image;
    }
}
