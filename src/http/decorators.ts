import {HttpMethod} from "../types/HttpMethod";
import {
    PipeClass,
    ParamSource,
    setPrefix,
    addRoute,
    addParam
} from "./metadata";


export const Controller = (prefix: string = ""): ClassDecorator => {
    return (target) => {
        setPrefix(target, prefix);
    };
};

const route = (method: HttpMethod) => {
    return (path: string = ""): MethodDecorator => {
        return (target, key) => {
            addRoute(target.constructor, {method, path, key});
        };
    };
};

export const Get = route("GET");
export const Post = route("POST");
export const Put = route("PUT");
export const Patch = route("PATCH");
export const Delete = route("DELETE");

const param = (source: ParamSource, name?: string, pipe?: PipeClass): ParameterDecorator => {
    return (target, key, index) => {
        if(key === undefined) {
            return;
        }

        addParam(target.constructor, key, {index, source, name, pipe});
    };
};

export const Param = (name: string, pipe?: PipeClass): ParameterDecorator => param("param", name, pipe);
export const Body = (pipe?: PipeClass): ParameterDecorator => param("body", undefined, pipe);
// docker-modem passes the query string and the request body as a single object
export const Query = (pipe?: PipeClass): ParameterDecorator => param("query", undefined, pipe);
export const Req = (): ParameterDecorator => param("req");
export const Res = (): ParameterDecorator => param("res");
