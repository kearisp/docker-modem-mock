import {Duplex} from "stream";
import {Router, Request, Response} from "../router";


export class SessionController {
    public constructor(
        protected readonly router: Router
    ) {
        this.router.post(["/session", "/:version/session"], (_req: Request, res: Response): void => {
            const duplex = new Duplex();

            res.send(duplex);
        });
    }
}
