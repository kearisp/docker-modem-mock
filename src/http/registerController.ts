import {Router, Request, Response, RouteHandler} from "../router";
import {HttpException} from "../exceptions/HttpException";
import {
    Pipe,
    PipeClass,
    ParamDefinition,
    getPrefix,
    getRoutes,
    getParams
} from "./metadata";


export type PipeResolver = (pipe: PipeClass) => Pipe;

type Binding = {
    index: number;
    read: (req: Request, res: Response) => unknown;
    pipe?: Pipe;
};

const METHODS = {
    GET: "get",
    POST: "post",
    PUT: "put",
    PATCH: "patch",
    DELETE: "delete"
} as const;

const joinPath = (prefix: string, path: string): string => {
    const tail = path.replace(/^\//, "");

    return tail ? `${prefix}/${tail}` : prefix || "/";
};

const reader = ({source, name}: ParamDefinition): Binding["read"] => {
    switch(source) {
        case "param":
            return (req) => req.params[name as string];

        case "req":
            return (req) => req;

        case "res":
            return (_req, res) => res;

        default:
            return (req) => req.body;
    }
};

export const registerController = (
    router: Router,
    controller: object,
    resolvePipe: PipeResolver = (Pipe) => new Pipe()
): void => {
    const target = controller.constructor;
    const prefix = getPrefix(target);

    for(const {method, path, key} of getRoutes(target)) {
        const bindings: Binding[] = getParams(target, key).map((definition) => ({
            index: definition.index,
            read: reader(definition),
            pipe: definition.pipe && resolvePipe(definition.pipe)
        }));

        const handler: RouteHandler = async (req, res): Promise<void> => {
            try {
                const args: unknown[] = [];

                for(const {index, read, pipe} of bindings) {
                    const value = read(req, res);

                    args[index] = pipe ? await pipe.transform(value) : value;
                }

                const result = await (controller as any)[key](...args);

                if(result !== undefined) {
                    res.send(result);
                }
                else if(!res.sent) {
                    res.send({});
                }
            }
            catch(err) {
                if(!(err instanceof HttpException)) {
                    throw err;
                }

                res.status(err.status).send({
                    message: err.message
                });
            }
        };

        router[METHODS[method]](joinPath(prefix, path), handler);
    }
};
