import Modem from "docker-modem";
import type {
    ConstructorOptions,
    DialOptions,
    RequestCallback
} from "docker-modem";
import {Router} from "../router";
import {DockerStorage} from "./DockerStorage";
import {Fixtures} from "./Fixtures";
import {HttpMethod} from "../types/HttpMethod";
import {SessionController} from "../controllers/SessionController";
import {ContainerController} from "../controllers/ContainerController";
import {ImageController} from "../controllers/ImageController";
import {ResponseException} from "../exceptions/ResponseException";


type Options = ConstructorOptions & {
    mockFixtures?: Fixtures;
};

export class ModemMock extends Modem {
    protected readonly mockRouter: Router;
    protected storage: DockerStorage;
    protected version!: string;

    public constructor({mockFixtures, ...rest}: Options) {
        super(rest);

        this.mockRouter = new Router();
        this.storage = new DockerStorage();

        new SessionController(this.mockRouter);
        new ContainerController(this.mockRouter, this.storage);
        new ImageController(this.mockRouter, this.storage);

        if(mockFixtures) {
            this.registerFixtures(mockFixtures);
        }
    }

    public dial(options: DialOptions, callback?: RequestCallback): void {
        const {
            method,
            statusCodes = {},
            options: body,
            file
        } = options;

        if(this.version) {
            options.path = `/${this.version}${options.path}`;
        }

        (async (): Promise<void> => {
            if(file && typeof file !== "string" && "on" in file) {
                await new Promise<void>((resolve) => {
                    file.on("data", () => undefined);
                    file.on("close", resolve);
                    file.on("error", resolve);
                });
            }

            try {
                const res = await this.mockRouter.exec(
                    method as HttpMethod,
                    options.path,
                    body
                );

                if(statusCodes[res.statusCode] !== true) {
                    const err = new ResponseException(
                        "(HTTP code " + res.statusCode + ") " +
                        (statusCodes[res.statusCode] || "unexpected") + " - " +
                        (res.body.message || res.body.error || res.body) + " ",
                        res.statusCode,
                        statusCodes[res.statusCode],
                        res.body
                    );

                    callback && callback(err, null);

                    return;
                }

                callback && callback(null, res.body);
            }
            catch(err) {
                callback && callback(err as Error, null)
            }
        })();
    }

    public registerFixtures(fixtures: Fixtures): void {
        this.storage.registerFixtures(fixtures);
    }

    public reset(): void {
        this.storage.reset();
    }
}
