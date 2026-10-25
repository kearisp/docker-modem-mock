import {HttpMethod} from "../types/HttpMethod";


export interface Pipe<T = any, R = any> {
    transform(value: T): R | Promise<R>;
}

export type PipeClass = new (...args: any[]) => Pipe;

export type ParamSource = "param" | "body" | "query" | "req" | "res";

export type ParamDefinition = {
    index: number;
    source: ParamSource;
    name?: string;
    pipe?: PipeClass;
};

export type RouteDefinition = {
    method: HttpMethod;
    path: string;
    key: string | symbol;
};

type Key = string | symbol;

const prefixes = new WeakMap<Function, string>();
const routes = new WeakMap<Function, RouteDefinition[]>();
const params = new WeakMap<Function, Map<Key, ParamDefinition[]>>();

export const setPrefix = (target: Function, prefix: string): void => {
    prefixes.set(target, prefix);
};

export const getPrefix = (target: Function): string => {
    return prefixes.get(target) ?? "";
};

export const addRoute = (target: Function, route: RouteDefinition): void => {
    routes.set(target, [...getRoutes(target), route]);
};

export const getRoutes = (target: Function): RouteDefinition[] => {
    return routes.get(target) ?? [];
};

export const addParam = (target: Function, key: Key, definition: ParamDefinition): void => {
    const byKey = params.get(target) ?? new Map<Key, ParamDefinition[]>();

    byKey.set(key, [...byKey.get(key) ?? [], definition]);
    params.set(target, byKey);
};

export const getParams = (target: Function, key: Key): ParamDefinition[] => {
    return params.get(target)?.get(key) ?? [];
};
