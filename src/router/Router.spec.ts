import {describe, it, expect, jest} from "@jest/globals";
import {Router, RouteHandler} from "./Router";
import {Request} from "./Request";
import {Response} from "./Response";
import {HttpMethod} from "../types/HttpMethod";


describe("Router", (): void => {
    it.each<{
        method: HttpMethod;
        pattern: string;
        path: string;
        response: any;
    }>([
        {
            method: "GET",
            pattern: "/test-route",
            path: "/test-route",
            response: {
                params: {}
            }
        },
        {
            method: "POST",
            pattern: "/test-route",
            path: "/test-route",
            response: {
                params: {}
            }
        },
        {
            method: "PUT",
            pattern: "/test-route",
            path: "/test-route",
            response: {
                params: {}
            }
        },
        {
            method: "PATCH",
            pattern: "/test-route",
            path: "/test-route",
            response: {
                params: {}
            }
        },
        {
            method: "DELETE",
            pattern: "/:name/:id",
            path: "/test/1",
            response: {
                params: {
                    name: "test",
                    id: "1"
                }
            }
        }
    ])("should exec $method $pattern", async ({method, pattern, path, response}): Promise<void> => {
        const router = new Router();

        const handler: RouteHandler = jest.fn((req: Request, res: Response): void => {
            res.status(200).send({
                params: req.params
            });
        });

        // @ts-ignore
        router[method.toLowerCase()](pattern, handler);

        const res = await router.exec(method, path, {});

        expect(handler).toHaveBeenCalled();
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(response);
    });
});
