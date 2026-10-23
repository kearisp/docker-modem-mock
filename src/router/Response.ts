export class Response {
    protected _status: number = 200;
    protected _body: any;
    protected _sent: boolean = false;

    public constructor() {}

    public get sent(): boolean {
        return this._sent;
    }

    public get statusCode(): number {
        return this._status;
    }

    public get body(): any {
        return this._body;
    }

    public status(status: number): this {
        this._status = status;
        return this;
    }

    public send(body: any): this {
        this._body = body;
        this._sent = true;
        return this;
    }
}
