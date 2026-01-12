export class ResponseException extends Error {
    public constructor(
        message: string,
        public readonly statusCode: number,
        public readonly reason: boolean | string,
        public readonly json: any
    ) {
        super(message);
    }
}
