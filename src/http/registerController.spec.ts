import {describe, it, expect} from "@jest/globals";
import {Readable} from "stream";
import {Router, Request, Response} from "../router";
import {HttpException} from "../exceptions/HttpException";
import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    Body,
    Query,
    Req,
    Res,
    Pipe,
    registerController
} from "./index";


class UpperPipe implements Pipe<string, string> {
    public constructor(
        protected readonly suffix: string = ""
    ) {}

    public transform(value: string): string {
        if(value === "missing") {
            throw new HttpException(404, "not found");
        }

        return value.toUpperCase() + this.suffix;
    }
}

const stream = new Readable();

@Controller("/items")
class ItemController {
    @Get()
    public list() {
        return [{id: "1"}];
    }

    @Get("json")
    public json() {
        return {route: "json"};
    }

    @Get(":id/upper")
    public upper(@Param("id", UpperPipe) id: string) {
        return {id};
    }

    @Post("create")
    public create(@Body() body: {name: string}, @Res() res: Response) {
        res.status(201);

        return {name: body.name};
    }

    @Post("echo")
    public echo(@Query() query: {a: string}, @Req() req: Request) {
        return {a: query.a, method: req.method};
    }

    @Post(":id/empty")
    public empty() {
        //
    }

    @Post(":id/sent")
    public sent(@Res() res: Response) {
        res.status(202).send({sent: true});
    }

    @Post(":id/not-modified")
    public notModified(@Res() res: Response) {
        res.status(304);

        return {message: "already"};
    }

    @Delete(":id")
    public remove(@Param("id") id: string) {
        if(id === "locked") {
            throw new HttpException(409, "locked");
        }
    }

    @Get(":id/version")
    public version(@Param("id") id: string, @Param("version") version: string) {
        return {id, version};
    }

    @Get(":id/async")
    public async delayed(@Param("id") id: string) {
        await Promise.resolve();

        return {id};
    }

    @Get(":id/stream")
    public stream() {
        return stream;
    }

    @Get(":id/boom")
    public boom() {
        throw new Error("boom");
    }

    // the last param is greedy, so a bare ":id" must come after the ":id/..." routes
    @Get(":id")
    public get(@Param("id") id: string) {
        return {route: "get", id};
    }
}

describe("registerController", (): void => {
    const setup = (resolvePipe?: Parameters<typeof registerController>[2]): Router => {
        const router = new Router();

        registerController(router, new ItemController(), resolvePipe);

        return router;
    };

    it("should register the controller prefix with an empty route path", async (): Promise<void> => {
        const res = await setup().exec("GET", "/items", {});

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual([{id: "1"}]);
    });

    it("should keep declaration order so static routes win over params", async (): Promise<void> => {
        const router = setup();

        expect((await router.exec("GET", "/items/json", {})).body).toEqual({route: "json"});
        expect((await router.exec("GET", "/items/5", {})).body).toEqual({route: "get", id: "5"});
    });

    it("should serve versioned paths and expose the version", async (): Promise<void> => {
        const res = await setup().exec("GET", "/v1.48/items/5/version", {});

        expect(res.body).toEqual({id: "5", version: "v1.48"});
    });

    it("should use the returned value as the body with status 200", async (): Promise<void> => {
        const res = await setup().exec("GET", "/items/7", {});

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({route: "get", id: "7"});
    });

    it("should let the handler set the status and still return the body", async (): Promise<void> => {
        const res = await setup().exec("POST", "/items/create", {name: "x"});

        expect(res.statusCode).toBe(201);
        expect(res.body).toEqual({name: "x"});
    });

    it("should pass body, query and request", async (): Promise<void> => {
        const res = await setup().exec("POST", "/items/echo", {a: "1"});

        expect(res.body).toEqual({a: "1", method: "POST"});
    });

    it("should send an empty object when nothing is returned or sent", async (): Promise<void> => {
        const res = await setup().exec("POST", "/items/1/empty", {});

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({});
    });

    it("should keep what the handler sent itself", async (): Promise<void> => {
        const res = await setup().exec("POST", "/items/1/sent", {});

        expect(res.statusCode).toBe(202);
        expect(res.body).toEqual({sent: true});
    });

    it("should support non-2xx statuses chosen by the handler", async (): Promise<void> => {
        const res = await setup().exec("POST", "/items/1/not-modified", {});

        expect(res.statusCode).toBe(304);
        expect(res.body).toEqual({message: "already"});
    });

    it("should await async handlers", async (): Promise<void> => {
        const res = await setup().exec("GET", "/items/9/async", {});

        expect(res.body).toEqual({id: "9"});
    });

    it("should return a stream as the body", async (): Promise<void> => {
        const res = await setup().exec("GET", "/items/1/stream", {});

        expect(res.body).toBe(stream);
    });

    it("should apply pipes created by the resolver", async (): Promise<void> => {
        const res = await setup((Pipe) => new (Pipe as typeof UpperPipe)("!")).exec("GET", "/items/abc/upper", {});

        expect(res.body).toEqual({id: "ABC!"});
    });

    it("should resolve each pipe once per route, not per request", async (): Promise<void> => {
        let created = 0;

        const router = setup((Pipe) => {
            created++;

            return new Pipe();
        });

        const before = created;

        await router.exec("GET", "/items/a/upper", {});
        await router.exec("GET", "/items/b/upper", {});

        expect(created).toBe(before);
    });

    it("should turn a pipe HttpException into a response", async (): Promise<void> => {
        const res = await setup().exec("GET", "/items/missing/upper", {});

        expect(res.statusCode).toBe(404);
        expect(res.body).toEqual({message: "not found"});
    });

    it("should turn a handler HttpException into a response", async (): Promise<void> => {
        const res = await setup().exec("DELETE", "/items/locked", {});

        expect(res.statusCode).toBe(409);
        expect(res.body).toEqual({message: "locked"});
    });

    it("should respond to a void handler with 200 and an empty object", async (): Promise<void> => {
        const res = await setup().exec("DELETE", "/items/free", {});

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({});
    });

    it("should let unexpected errors propagate", async (): Promise<void> => {
        await expect(setup().exec("GET", "/items/1/boom", {})).rejects.toThrow("boom");
    });
});
